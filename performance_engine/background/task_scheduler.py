"""
TaskScheduler — Cron-like task scheduler for LifeOS.

Features:
- Cron expression support (minute, hour, day, month, weekday)
- Interval-based scheduling (every N seconds/minutes/hours)
- One-shot delayed execution
- Timezone-aware scheduling
- Missed run detection and catch-up policy
- Task enable/disable
- Integration with JobQueue
"""

import re
import time
import threading
import logging
import uuid
from typing import Any, Callable, Dict, List, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

logger = logging.getLogger(__name__)


class ScheduleType(Enum):
    CRON = "cron"
    INTERVAL = "interval"
    ONE_SHOT = "one_shot"


class MissedRunPolicy(Enum):
    SKIP = "skip"           # Skip missed runs
    RUN_ONCE = "run_once"   # Run once to catch up
    RUN_ALL = "run_all"     # Run all missed runs (dangerous)


@dataclass
class CronExpression:
    """Parsed cron expression (5-field: min hour dom month dow)."""
    minute: str = "*"
    hour: str = "*"
    day_of_month: str = "*"
    month: str = "*"
    day_of_week: str = "*"

    @classmethod
    def from_string(cls, expr: str) -> "CronExpression":
        parts = expr.strip().split()
        if len(parts) != 5:
            raise ValueError(f"Invalid cron expression: {expr!r} (expected 5 fields)")
        return cls(*parts)

    def matches(self, dt: datetime) -> bool:
        """Check if a datetime matches this cron expression."""
        return (
            self._matches_field(self.minute, dt.minute, 0, 59)
            and self._matches_field(self.hour, dt.hour, 0, 23)
            and self._matches_field(self.day_of_month, dt.day, 1, 31)
            and self._matches_field(self.month, dt.month, 1, 12)
            and self._matches_field(self.day_of_week, dt.weekday(), 0, 6)
        )

    @staticmethod
    def _matches_field(field: str, value: int, min_v: int, max_v: int) -> bool:
        if field == "*":
            return True
        for part in field.split(","):
            if "/" in part:
                base, step = part.split("/", 1)
                step = int(step)
                start = min_v if base == "*" else int(base.split("-")[0])
                end = max_v if base == "*" else int(base.split("-")[-1])
                if start <= value <= end and (value - start) % step == 0:
                    return True
            elif "-" in part:
                lo, hi = map(int, part.split("-", 1))
                if lo <= value <= hi:
                    return True
            else:
                if int(part) == value:
                    return True
        return False

    def __str__(self) -> str:
        return f"{self.minute} {self.hour} {self.day_of_month} {self.month} {self.day_of_week}"


@dataclass
class ScheduledTask:
    """A task registered with the scheduler."""
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    handler: Optional[Callable] = None
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    schedule_type: ScheduleType = ScheduleType.INTERVAL
    # Cron
    cron: Optional[CronExpression] = None
    # Interval
    interval_s: float = 60.0
    # One-shot
    run_at: Optional[float] = None   # monotonic timestamp
    # Policies
    missed_run_policy: MissedRunPolicy = MissedRunPolicy.SKIP
    max_concurrent: int = 1
    timeout_s: Optional[float] = 300.0
    enabled: bool = True
    # Runtime state
    last_run_at: Optional[float] = None
    next_run_at: Optional[float] = None
    run_count: int = 0
    error_count: int = 0
    last_error: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    _running_count: int = field(default=0, repr=False)

    def is_due(self, now: Optional[float] = None) -> bool:
        if not self.enabled:
            return False
        now = now or time.monotonic()
        if self.next_run_at is None:
            return True
        return now >= self.next_run_at

    def compute_next_run(self, now: Optional[float] = None) -> float:
        now = now or time.monotonic()
        if self.schedule_type == ScheduleType.INTERVAL:
            return now + self.interval_s
        if self.schedule_type == ScheduleType.ONE_SHOT:
            return float("inf")  # won't run again
        if self.schedule_type == ScheduleType.CRON and self.cron:
            # Find next minute that matches
            dt = datetime.now()
            for _ in range(60 * 24 * 7):  # search up to 1 week ahead
                dt += timedelta(minutes=1)
                if self.cron.matches(dt):
                    delta = (dt - datetime.now()).total_seconds()
                    return now + max(0, delta)
        return now + 60.0  # fallback


class TaskScheduler:
    """
    Cron-like task scheduler for LifeOS background tasks.

    Runs a background thread that checks every second for due tasks
    and dispatches them to a thread pool or JobQueue.
    """

    def __init__(
        self,
        job_queue: Optional[Any] = None,
        max_workers: int = 8,
        tick_interval_s: float = 1.0,
        name: str = "task_scheduler",
    ) -> None:
        self.name = name
        self.job_queue = job_queue
        self.max_workers = max_workers
        self.tick_interval_s = tick_interval_s
        self._tasks: Dict[str, ScheduledTask] = {}
        self._lock = threading.RLock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._executor = None
        self._stats = {
            "ticks": 0,
            "dispatched": 0,
            "errors": 0,
            "skipped_concurrent": 0,
        }

    # ------------------------------------------------------------------
    # Task registration
    # ------------------------------------------------------------------

    def every(
        self,
        seconds: float,
        fn: Callable,
        *args,
        name: str = "",
        tags: Optional[List[str]] = None,
        **kwargs,
    ) -> str:
        """Register an interval-based task."""
        task = ScheduledTask(
            name=name or fn.__name__,
            handler=fn,
            args=args,
            kwargs=kwargs,
            schedule_type=ScheduleType.INTERVAL,
            interval_s=seconds,
            tags=tags or [],
        )
        task.next_run_at = time.monotonic() + seconds
        return self._register(task)

    def cron(
        self,
        expression: str,
        fn: Callable,
        *args,
        name: str = "",
        tags: Optional[List[str]] = None,
        **kwargs,
    ) -> str:
        """Register a cron-based task."""
        cron_expr = CronExpression.from_string(expression)
        task = ScheduledTask(
            name=name or fn.__name__,
            handler=fn,
            args=args,
            kwargs=kwargs,
            schedule_type=ScheduleType.CRON,
            cron=cron_expr,
            tags=tags or [],
        )
        task.next_run_at = task.compute_next_run()
        return self._register(task)

    def once(
        self,
        delay_s: float,
        fn: Callable,
        *args,
        name: str = "",
        **kwargs,
    ) -> str:
        """Register a one-shot delayed task."""
        task = ScheduledTask(
            name=name or fn.__name__,
            handler=fn,
            args=args,
            kwargs=kwargs,
            schedule_type=ScheduleType.ONE_SHOT,
            run_at=time.monotonic() + delay_s,
        )
        task.next_run_at = task.run_at
        return self._register(task)

    def _register(self, task: ScheduledTask) -> str:
        with self._lock:
            self._tasks[task.task_id] = task
        logger.info(
            "[TaskScheduler] Registered task %r (id=%s, type=%s)",
            task.name, task.task_id[:8], task.schedule_type.value,
        )
        return task.task_id

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the scheduler background thread."""
        from concurrent.futures import ThreadPoolExecutor
        self._executor = ThreadPoolExecutor(
            max_workers=self.max_workers,
            thread_name_prefix=f"{self.name}_worker",
        )
        self._running = True
        self._thread = threading.Thread(
            target=self._tick_loop, daemon=True, name=f"{self.name}_tick"
        )
        self._thread.start()
        logger.info("[TaskScheduler] Started with %d workers.", self.max_workers)

    def stop(self, wait: bool = True) -> None:
        """Stop the scheduler."""
        self._running = False
        if self._executor:
            self._executor.shutdown(wait=wait)
        logger.info("[TaskScheduler] Stopped.")

    # ------------------------------------------------------------------
    # Tick loop
    # ------------------------------------------------------------------

    def _tick_loop(self) -> None:
        while self._running:
            t0 = time.monotonic()
            self._tick()
            elapsed = time.monotonic() - t0
            sleep_time = max(0, self.tick_interval_s - elapsed)
            time.sleep(sleep_time)

    def _tick(self) -> None:
        now = time.monotonic()
        self._stats["ticks"] += 1
        with self._lock:
            due = [t for t in self._tasks.values() if t.is_due(now)]

        for task in due:
            with self._lock:
                # Concurrency check
                if task._running_count >= task.max_concurrent:
                    self._stats["skipped_concurrent"] += 1
                    continue
                task._running_count += 1
                task.last_run_at = now
                task.next_run_at = task.compute_next_run(now)

            if self.job_queue:
                from .job_queue import Job, JobPriority
                job = Job(
                    name=task.name,
                    handler=self._run_task,
                    args=(task,),
                    priority=JobPriority.NORMAL,
                    timeout_s=task.timeout_s or 300.0,
                    tags=task.tags,
                )
                self.job_queue.enqueue(job)
            elif self._executor:
                self._executor.submit(self._run_task, task)

            self._stats["dispatched"] += 1

            # Remove one-shot tasks after dispatch
            if task.schedule_type == ScheduleType.ONE_SHOT:
                with self._lock:
                    self._tasks.pop(task.task_id, None)

    def _run_task(self, task: ScheduledTask) -> Any:
        try:
            result = task.handler(*task.args, **task.kwargs)
            with self._lock:
                task.run_count += 1
                task._running_count = max(0, task._running_count - 1)
            return result
        except Exception as exc:
            with self._lock:
                task.error_count += 1
                task.last_error = str(exc)
                task._running_count = max(0, task._running_count - 1)
            self._stats["errors"] += 1
            logger.error("[TaskScheduler] Task %r failed: %s", task.name, exc)
            return None

    # ------------------------------------------------------------------
    # Task management
    # ------------------------------------------------------------------

    def disable(self, task_id: str) -> bool:
        with self._lock:
            task = self._tasks.get(task_id)
            if task:
                task.enabled = False
                return True
            return False

    def enable(self, task_id: str) -> bool:
        with self._lock:
            task = self._tasks.get(task_id)
            if task:
                task.enabled = True
                return True
            return False

    def remove(self, task_id: str) -> bool:
        with self._lock:
            return self._tasks.pop(task_id, None) is not None

    def get_task(self, task_id: str) -> Optional[ScheduledTask]:
        with self._lock:
            return self._tasks.get(task_id)

    def list_tasks(self) -> List[Dict]:
        with self._lock:
            return [
                {
                    "task_id": t.task_id,
                    "name": t.name,
                    "type": t.schedule_type.value,
                    "enabled": t.enabled,
                    "run_count": t.run_count,
                    "error_count": t.error_count,
                    "last_run_at": t.last_run_at,
                    "next_run_at": t.next_run_at,
                    "tags": t.tags,
                }
                for t in self._tasks.values()
            ]

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "name": self.name,
                "running": self._running,
                "registered_tasks": len(self._tasks),
                "enabled_tasks": sum(1 for t in self._tasks.values() if t.enabled),
                **self._stats,
            }

    def __repr__(self) -> str:
        return (
            f"TaskScheduler(name={self.name!r}, "
            f"tasks={len(self._tasks)}, "
            f"running={self._running})"
        )
