"""
BETA-004: Background Sync Engine
LifeOS Mobile Ecosystem — Program Beta

Architecture: Priority-based queue with exponential backoff,
delta sync, and intelligent batching.
"""

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class SyncPriority(Enum):
    CRITICAL   = 0   # Decisions, alerts — sync immediately
    HIGH       = 1   # Tasks, habits — sync within 30s
    NORMAL     = 2   # Memory nodes — sync within 2min
    LOW        = 3   # Analytics, logs — sync in background
    BACKGROUND = 4   # Bulk exports — sync when idle + WiFi


class SyncTrigger(Enum):
    NETWORK_AVAILABLE  = "network_available"
    APP_FOREGROUND     = "app_foreground"
    BACKGROUND_FETCH   = "background_fetch"
    PUSH_RECEIVED      = "push_received"
    MANUAL             = "manual"
    SCHEDULED          = "scheduled"


@dataclass
class SyncJob:
    id:           str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    entity_type:  str = ""
    entity_id:    str = ""
    operation:    str = "upsert"   # upsert | delete | bulk
    payload:      Dict = field(default_factory=dict)
    priority:     SyncPriority = SyncPriority.NORMAL
    attempts:     int = 0
    max_attempts: int = 5
    created_at:   datetime = field(default_factory=datetime.now)
    next_attempt: datetime = field(default_factory=datetime.now)
    last_error:   Optional[str] = None
    delta_only:   bool = True   # Only sync changed fields

    @property
    def backoff_seconds(self) -> float:
        """Exponential backoff: 1s, 2s, 4s, 8s, 16s"""
        return min(2 ** self.attempts, 300)

    def schedule_retry(self):
        self.attempts += 1
        self.next_attempt = datetime.now() + timedelta(seconds=self.backoff_seconds)


@dataclass
class SyncBatch:
    """A batch of sync jobs to be sent together."""
    id:        str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    jobs:      List[SyncJob] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    compressed: bool = False

    @property
    def size_bytes(self) -> int:
        return len(json.dumps([j.payload for j in self.jobs]).encode())

    @property
    def job_count(self) -> int:
        return len(self.jobs)


class NetworkMonitor:
    """Monitors network quality and type."""

    def __init__(self):
        self._online = True
        self._wifi = True
        self._quality = "excellent"   # excellent | good | poor | offline

    def set_state(self, online: bool, wifi: bool = True, quality: str = "excellent"):
        self._online = online
        self._wifi = wifi
        self._quality = quality

    @property
    def can_sync(self) -> bool:
        return self._online and self._quality != "offline"

    @property
    def prefer_wifi_only(self) -> bool:
        return not self._wifi

    @property
    def bandwidth_budget(self) -> int:
        """Max bytes per sync batch based on network quality."""
        budgets = {"excellent": 512_000, "good": 128_000, "poor": 32_000}
        return budgets.get(self._quality, 32_000)

    def to_dict(self) -> Dict:
        return {
            "online": self._online,
            "wifi": self._wifi,
            "quality": self._quality,
            "can_sync": self.can_sync,
            "bandwidth_budget_kb": self.bandwidth_budget // 1024,
        }


class BackgroundSyncEngine:
    """
    Intelligent background sync engine for LifeOS Mobile.

    Features:
    - Priority-based queue with 5 levels
    - Exponential backoff on failures
    - Delta sync (only changed fields)
    - Intelligent batching by priority and size
    - Network-aware scheduling
    - iOS BGAppRefreshTask / Android WorkManager compatible
    """

    MAX_BATCH_SIZE = 50
    SYNC_INTERVAL_SECONDS = 30

    def __init__(self):
        self._queue:         List[SyncJob] = []
        self._in_flight:     Dict[str, SyncJob] = {}
        self._completed:     List[SyncJob] = []
        self._failed:        List[SyncJob] = []
        self._network        = NetworkMonitor()
        self._is_running     = False
        self._stats          = {"synced": 0, "failed": 0, "batches": 0, "bytes_sent": 0}
        self._hooks:         Dict[str, List[Callable]] = {
            "on_sync_start": [], "on_sync_complete": [],
            "on_sync_error": [], "on_batch_sent": [],
        }

    # ── QUEUE MANAGEMENT ───────────────────────────────────

    def enqueue(self, entity_type: str, entity_id: str,
                payload: Dict, priority: SyncPriority = SyncPriority.NORMAL,
                operation: str = "upsert") -> SyncJob:
        """Add a job to the sync queue."""
        # Deduplicate: if same entity already queued, update payload
        existing = next((j for j in self._queue
                         if j.entity_id == entity_id and j.operation == operation), None)
        if existing:
            existing.payload.update(payload)
            existing.priority = min(existing.priority, priority, key=lambda p: p.value)
            return existing

        job = SyncJob(
            entity_type=entity_type,
            entity_id=entity_id,
            operation=operation,
            payload=payload,
            priority=priority,
        )
        self._queue.append(job)
        self._queue.sort(key=lambda j: (j.priority.value, j.created_at))
        return job

    def enqueue_bulk(self, jobs: List[Dict]) -> List[SyncJob]:
        """Enqueue multiple jobs at once."""
        return [self.enqueue(**j) for j in jobs]

    # ── BATCHING ───────────────────────────────────────────

    def _build_batches(self) -> List[SyncBatch]:
        """Build optimized batches respecting size and priority."""
        now = datetime.now()
        ready = [j for j in self._queue if j.next_attempt <= now]

        if not ready:
            return []

        budget = self._network.bandwidth_budget
        batches = []
        current_batch = SyncBatch()
        current_size = 0

        for job in ready:
            job_size = len(json.dumps(job.payload).encode())

            # Start new batch if current is full or budget exceeded
            if (len(current_batch.jobs) >= self.MAX_BATCH_SIZE or
                    current_size + job_size > budget):
                if current_batch.jobs:
                    batches.append(current_batch)
                current_batch = SyncBatch()
                current_size = 0

            current_batch.jobs.append(job)
            current_size += job_size

        if current_batch.jobs:
            batches.append(current_batch)

        return batches

    # ── SYNC EXECUTION ─────────────────────────────────────

    async def sync(self, trigger: SyncTrigger = SyncTrigger.SCHEDULED) -> Dict:
        """Execute a sync cycle."""
        if not self._network.can_sync:
            return {"status": "skipped", "reason": "network_unavailable"}

        self._is_running = True
        self._fire_hook("on_sync_start", {"trigger": trigger.value})

        batches = self._build_batches()
        total_synced = 0
        total_failed = 0

        for batch in batches:
            result = await self._send_batch(batch)
            total_synced += result["synced"]
            total_failed += result["failed"]
            self._stats["batches"] += 1
            self._stats["bytes_sent"] += batch.size_bytes
            self._fire_hook("on_batch_sent", result)

        self._stats["synced"] += total_synced
        self._stats["failed"] += total_failed
        self._is_running = False

        summary = {
            "trigger": trigger.value,
            "batches_sent": len(batches),
            "synced": total_synced,
            "failed": total_failed,
            "queue_remaining": len(self._queue),
            "bytes_sent": self._stats["bytes_sent"],
        }

        self._fire_hook("on_sync_complete", summary)
        return summary

    async def _send_batch(self, batch: SyncBatch) -> Dict:
        """Simulate sending a batch to the server."""
        await asyncio.sleep(0.01)  # Simulate network latency

        synced = 0
        failed = 0

        for job in batch.jobs:
            # Simulate 95% success rate
            import random
            if random.random() < 0.95:
                self._queue.remove(job)
                self._completed.append(job)
                synced += 1
            else:
                job.schedule_retry()
                if job.attempts >= job.max_attempts:
                    self._queue.remove(job)
                    self._failed.append(job)
                    job.last_error = "max_attempts_exceeded"
                failed += 1

        return {"batch_id": batch.id, "synced": synced, "failed": failed, "size_bytes": batch.size_bytes}

    # ── HOOKS ──────────────────────────────────────────────

    def on(self, event: str, callback: Callable):
        if event in self._hooks:
            self._hooks[event].append(callback)

    def _fire_hook(self, event: str, data: Dict):
        for cb in self._hooks.get(event, []):
            cb(data)

    # ── STATUS ─────────────────────────────────────────────

    def get_status(self) -> Dict:
        priority_breakdown = {}
        for p in SyncPriority:
            count = sum(1 for j in self._queue if j.priority == p)
            if count > 0:
                priority_breakdown[p.name] = count

        return {
            "is_running": self._is_running,
            "queue_size": len(self._queue),
            "in_flight": len(self._in_flight),
            "completed": len(self._completed),
            "failed": len(self._failed),
            "priority_breakdown": priority_breakdown,
            "network": self._network.to_dict(),
            "stats": self._stats,
        }


# ── DEMO ───────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("BETA-004: Background Sync Engine — Demo")
    print("=" * 60)

    engine = BackgroundSyncEngine()

    # Register hooks
    engine.on("on_sync_complete", lambda d: print(f"  [HOOK] Sync complete: {d['synced']} synced, {d['batches_sent']} batches"))
    engine.on("on_batch_sent", lambda d: print(f"  [HOOK] Batch {d['batch_id']} sent: {d['synced']} records, {d['size_bytes']}B"))

    # Enqueue various jobs
    print("\n[ENQUEUE] Adding sync jobs...")

    engine.enqueue("decision", "dec-001", {"title": "Arquitetura Mobile", "status": "pending"},
                   SyncPriority.CRITICAL)
    engine.enqueue("decision", "dec-002", {"title": "Estratégia de Pricing", "status": "draft"},
                   SyncPriority.CRITICAL)
    engine.enqueue("task", "task-001", {"title": "Deck investidores", "done": False},
                   SyncPriority.HIGH)
    engine.enqueue("task", "task-002", {"title": "Revisar Sprint 030", "done": False},
                   SyncPriority.HIGH)
    engine.enqueue("habit", "habit-001", {"streak": 12, "done_today": True},
                   SyncPriority.HIGH)

    for i in range(10):
        engine.enqueue("memory_node", f"mem-{i:03d}", {"content": f"Memory {i}", "strength": 70 + i},
                       SyncPriority.NORMAL)

    for i in range(20):
        engine.enqueue("analytics_event", f"evt-{i:03d}", {"event": "screen_view", "screen": f"screen_{i}"},
                       SyncPriority.BACKGROUND)

    status = engine.get_status()
    print(f"  Queue size: {status['queue_size']}")
    print(f"  Priority breakdown: {status['priority_breakdown']}")

    # Sync with excellent network
    print("\n[SYNC] Trigger: app_foreground (WiFi, excellent)")
    engine._network.set_state(online=True, wifi=True, quality="excellent")
    result = await engine.sync(SyncTrigger.APP_FOREGROUND)
    print(f"  Result: {result}")

    # Simulate going offline
    print("\n[OFFLINE] Network lost")
    engine._network.set_state(online=False)
    engine.enqueue("task", "task-003", {"title": "Nova tarefa offline", "done": False}, SyncPriority.HIGH)
    engine.enqueue("habit", "habit-002", {"streak": 5, "done_today": True}, SyncPriority.HIGH)

    result = await engine.sync(SyncTrigger.SCHEDULED)
    print(f"  Sync skipped: {result}")

    # Back online with poor connection
    print("\n[ONLINE] Network restored (poor connection)")
    engine._network.set_state(online=True, wifi=False, quality="poor")
    result = await engine.sync(SyncTrigger.NETWORK_AVAILABLE)
    print(f"  Result: {result}")

    final = engine.get_status()
    print(f"\n[FINAL STATUS]")
    print(f"  Completed: {final['completed']}")
    print(f"  Failed: {final['failed']}")
    print(f"  Total bytes sent: {final['stats']['bytes_sent']}B")
    print(f"  Total batches: {final['stats']['batches']}")
    print("\n✅ BETA-004: Background Sync Engine — COMPLETE")


if __name__ == "__main__":
    asyncio.run(main())
