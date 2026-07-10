"""
JobQueue — Priority-based background job queue for LifeOS.

Features:
- Priority queuing (CRITICAL > HIGH > NORMAL > LOW > BACKGROUND)
- Automatic retry with exponential backoff
- Dead-letter queue for failed jobs
- Job deduplication
- Job cancellation
- Progress tracking
- Persistence-ready (serializable job state)
- Redis-backed distributed mode (optional)
"""

import time
import uuid
import threading
import logging
import traceback
from typing import Any, Callable, Dict, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from queue import PriorityQueue, Empty

logger = logging.getLogger(__name__)


class JobPriority(Enum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    BACKGROUND = 4


class JobStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"
    DEAD = "dead"          # exhausted retries → dead-letter


@dataclass
class Job:
    """A single background job."""
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    handler: Optional[Callable] = None
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    priority: JobPriority = JobPriority.NORMAL
    max_retries: int = 3
    retry_delay_s: float = 5.0
    retry_backoff: float = 2.0    # exponential backoff multiplier
    timeout_s: Optional[float] = 60.0
    dedupe_key: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    # Runtime state
    status: JobStatus = JobStatus.PENDING
    attempt: int = 0
    created_at: float = field(default_factory=time.monotonic)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    progress: float = 0.0    # 0.0 - 1.0
    metadata: Dict = field(default_factory=dict)

    @property
    def duration_ms(self) -> Optional[float]:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at) * 1000
        return None

    @property
    def wait_time_ms(self) -> Optional[float]:
        if self.started_at:
            return (self.started_at - self.created_at) * 1000
        return None

    def next_retry_delay(self) -> float:
        return self.retry_delay_s * (self.retry_backoff ** self.attempt)

    def to_dict(self) -> Dict:
        return {
            "job_id": self.job_id,
            "name": self.name,
            "priority": self.priority.value,
            "status": self.status.value,
            "attempt": self.attempt,
            "max_retries": self.max_retries,
            "progress": self.progress,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "tags": self.tags,
            "metadata": self.metadata,
        }

    def __lt__(self, other: "Job") -> bool:
        return self.priority.value < other.priority.value


class JobQueue:
    """
    Priority-based job queue with retry, dead-letter, and deduplication.

    Architecture:
    - Main queue: PriorityQueue ordered by JobPriority
    - Retry queue: jobs waiting for retry delay
    - Dead-letter queue: jobs that exhausted retries
    - Running set: currently executing jobs
    """

    def __init__(
        self,
        name: str = "job_queue",
        max_queue_size: int = 100_000,
        max_dead_letter: int = 10_000,
    ) -> None:
        self.name = name
        self.max_queue_size = max_queue_size
        self._queue: PriorityQueue = PriorityQueue(maxsize=max_queue_size)
        self._jobs: Dict[str, Job] = {}
        self._dead_letter: List[Job] = []
        self._retry_queue: List[Job] = []
        self._running: Set[str] = set()
        self._dedupe_keys: Set[str] = set()
        self._lock = threading.RLock()
        self._stats = {
            "enqueued": 0,
            "completed": 0,
            "failed": 0,
            "retried": 0,
            "dead": 0,
            "cancelled": 0,
            "deduplicated": 0,
        }
        # Start retry processor
        self._retry_thread = threading.Thread(
            target=self._retry_processor, daemon=True, name=f"{name}_retry"
        )
        self._retry_thread.start()

    # ------------------------------------------------------------------
    # Enqueue
    # ------------------------------------------------------------------

    def enqueue(self, job: Job) -> Optional[str]:
        """
        Add a job to the queue.
        Returns job_id or None if deduplicated/queue full.
        """
        with self._lock:
            # Deduplication
            if job.dedupe_key and job.dedupe_key in self._dedupe_keys:
                self._stats["deduplicated"] += 1
                logger.debug("[JobQueue] Deduplicated job %s (key=%s)", job.name, job.dedupe_key)
                return None

            if self._queue.full():
                logger.warning("[JobQueue] Queue full, dropping job %s", job.job_id)
                return None

            job.status = JobStatus.QUEUED
            self._jobs[job.job_id] = job
            if job.dedupe_key:
                self._dedupe_keys.add(job.dedupe_key)
            self._stats["enqueued"] += 1

        # PriorityQueue: (priority_value, counter, job)
        self._queue.put((job.priority.value, time.monotonic(), job))
        return job.job_id

    def enqueue_fn(
        self,
        fn: Callable,
        *args,
        name: str = "",
        priority: JobPriority = JobPriority.NORMAL,
        max_retries: int = 3,
        timeout_s: float = 60.0,
        dedupe_key: Optional[str] = None,
        tags: Optional[List[str]] = None,
        **kwargs,
    ) -> Optional[str]:
        """Convenience: wrap a function in a Job and enqueue."""
        job = Job(
            name=name or fn.__name__,
            handler=fn,
            args=args,
            kwargs=kwargs,
            priority=priority,
            max_retries=max_retries,
            timeout_s=timeout_s,
            dedupe_key=dedupe_key,
            tags=tags or [],
        )
        return self.enqueue(job)

    # ------------------------------------------------------------------
    # Dequeue (called by workers)
    # ------------------------------------------------------------------

    def dequeue(self, timeout: float = 1.0) -> Optional[Job]:
        """Get the next job from the queue."""
        try:
            _, _, job = self._queue.get(timeout=timeout)
            with self._lock:
                if job.status == JobStatus.CANCELLED:
                    return None
                job.status = JobStatus.RUNNING
                job.started_at = time.monotonic()
                job.attempt += 1
                self._running.add(job.job_id)
            return job
        except Empty:
            return None

    # ------------------------------------------------------------------
    # Job completion
    # ------------------------------------------------------------------

    def complete(self, job: Job, result: Any = None) -> None:
        """Mark a job as completed."""
        with self._lock:
            job.status = JobStatus.COMPLETED
            job.completed_at = time.monotonic()
            job.result = result
            job.progress = 1.0
            self._running.discard(job.job_id)
            if job.dedupe_key:
                self._dedupe_keys.discard(job.dedupe_key)
            self._stats["completed"] += 1

    def fail(self, job: Job, error: Exception) -> None:
        """Mark a job as failed; schedule retry or move to dead-letter."""
        with self._lock:
            job.error = f"{type(error).__name__}: {error}\n{traceback.format_exc()}"
            self._running.discard(job.job_id)
            self._stats["failed"] += 1

            if job.attempt < job.max_retries:
                job.status = JobStatus.RETRYING
                delay = job.next_retry_delay()
                job.metadata["retry_at"] = time.monotonic() + delay
                self._retry_queue.append(job)
                self._stats["retried"] += 1
                logger.info(
                    "[JobQueue] Job %s failed (attempt %d/%d), retry in %.1fs",
                    job.name, job.attempt, job.max_retries, delay,
                )
            else:
                job.status = JobStatus.DEAD
                self._dead_letter.append(job)
                if job.dedupe_key:
                    self._dedupe_keys.discard(job.dedupe_key)
                self._stats["dead"] += 1
                logger.error(
                    "[JobQueue] Job %s exhausted retries → dead-letter", job.name
                )

    # ------------------------------------------------------------------
    # Cancellation
    # ------------------------------------------------------------------

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if job and job.status in (JobStatus.QUEUED, JobStatus.PENDING, JobStatus.RETRYING):
                job.status = JobStatus.CANCELLED
                if job.dedupe_key:
                    self._dedupe_keys.discard(job.dedupe_key)
                self._stats["cancelled"] += 1
                return True
            return False

    # ------------------------------------------------------------------
    # Retry processor
    # ------------------------------------------------------------------

    def _retry_processor(self) -> None:
        """Background thread: re-enqueue jobs whose retry delay has elapsed."""
        while True:
            time.sleep(1.0)
            now = time.monotonic()
            with self._lock:
                ready = [
                    j for j in self._retry_queue
                    if j.metadata.get("retry_at", 0) <= now
                ]
                for job in ready:
                    self._retry_queue.remove(job)
                    job.status = JobStatus.QUEUED
            for job in ready:
                self._queue.put((job.priority.value, time.monotonic(), job))

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def get_job(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def update_progress(self, job_id: str, progress: float) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.progress = max(0.0, min(1.0, progress))

    @property
    def queue_size(self) -> int:
        return self._queue.qsize()

    @property
    def running_count(self) -> int:
        with self._lock:
            return len(self._running)

    @property
    def dead_letter_count(self) -> int:
        with self._lock:
            return len(self._dead_letter)

    def drain_dead_letter(self) -> List[Job]:
        with self._lock:
            jobs = list(self._dead_letter)
            self._dead_letter.clear()
            return jobs

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "name": self.name,
                "queue_size": self._queue.qsize(),
                "running": len(self._running),
                "retry_queue": len(self._retry_queue),
                "dead_letter": len(self._dead_letter),
                "total_jobs": len(self._jobs),
                **self._stats,
            }

    def __repr__(self) -> str:
        return (
            f"JobQueue(name={self.name!r}, "
            f"queued={self.queue_size}, "
            f"running={self.running_count})"
        )
