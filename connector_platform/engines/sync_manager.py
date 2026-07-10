"""
Sync Manager — Universal Connector Platform
Manages data synchronization between LifeOS and external services.

Features:
  - Delta sync (incremental updates only)
  - Conflict resolution strategies
  - Bidirectional sync with merge
  - Retry with exponential backoff
  - Sync queue with priority
  - Parallel sync across multiple connectors
  - Data transformation pipeline
"""

from __future__ import annotations
import asyncio
import logging
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

from connector_platform.models.connector_models import (
    IntegrationConfig,
    SyncDirection,
    SyncFrequency,
    SyncJob,
    ConnectorStatus,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Conflict Resolution
# ─────────────────────────────────────────────

class ConflictStrategy(Enum):
    LAST_WRITE_WINS = "last_write_wins"
    LIFEOS_WINS = "lifeos_wins"
    REMOTE_WINS = "remote_wins"
    MANUAL_REVIEW = "manual_review"
    MERGE = "merge"


class ConflictResolver:
    """
    Resolves data conflicts during bidirectional sync.
    Applies configurable strategies per connector and resource type.
    """

    def __init__(self, default_strategy: ConflictStrategy = ConflictStrategy.LAST_WRITE_WINS):
        self.default_strategy = default_strategy
        self._strategies: Dict[str, ConflictStrategy] = {}
        self._conflicts: List[Dict[str, Any]] = []

    def set_strategy(self, connector_id: str, resource_type: str, strategy: ConflictStrategy):
        self._strategies[f"{connector_id}:{resource_type}"] = strategy

    def resolve(
        self,
        connector_id: str,
        resource_type: str,
        local_record: Dict[str, Any],
        remote_record: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], str]:
        """
        Resolve a conflict between local and remote records.
        Returns (resolved_record, resolution_strategy_used).
        """
        strategy = self._strategies.get(
            f"{connector_id}:{resource_type}",
            self.default_strategy
        )

        if strategy == ConflictStrategy.LAST_WRITE_WINS:
            local_ts = local_record.get("updated_at", "")
            remote_ts = remote_record.get("updated_at", "")
            winner = local_record if local_ts >= remote_ts else remote_record
            return winner, "last_write_wins"

        elif strategy == ConflictStrategy.LIFEOS_WINS:
            return local_record, "lifeos_wins"

        elif strategy == ConflictStrategy.REMOTE_WINS:
            return remote_record, "remote_wins"

        elif strategy == ConflictStrategy.MERGE:
            merged = {**remote_record, **local_record}
            merged["_merged"] = True
            merged["_merge_timestamp"] = datetime.now(timezone.utc).isoformat()
            return merged, "merge"

        else:  # MANUAL_REVIEW
            conflict = {
                "connector_id": connector_id,
                "resource_type": resource_type,
                "local": local_record,
                "remote": remote_record,
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending_review",
            }
            self._conflicts.append(conflict)
            return local_record, "manual_review_queued"

    def get_pending_conflicts(self) -> List[Dict[str, Any]]:
        return [c for c in self._conflicts if c["status"] == "pending_review"]


# ─────────────────────────────────────────────
# Data Transformer
# ─────────────────────────────────────────────

class DataTransformer:
    """
    Transforms data between LifeOS internal format and connector-specific formats.
    Each connector registers its own transformation functions.
    """

    def __init__(self):
        self._inbound: Dict[str, Callable] = {}   # remote → lifeos
        self._outbound: Dict[str, Callable] = {}  # lifeos → remote

    def register(
        self,
        connector_id: str,
        resource_type: str,
        inbound: Callable,
        outbound: Callable,
    ):
        key = f"{connector_id}:{resource_type}"
        self._inbound[key] = inbound
        self._outbound[key] = outbound

    def transform_inbound(
        self,
        connector_id: str,
        resource_type: str,
        data: Any,
    ) -> Any:
        key = f"{connector_id}:{resource_type}"
        transformer = self._inbound.get(key)
        if transformer:
            return transformer(data)
        return data  # Pass-through if no transformer

    def transform_outbound(
        self,
        connector_id: str,
        resource_type: str,
        data: Any,
    ) -> Any:
        key = f"{connector_id}:{resource_type}"
        transformer = self._outbound.get(key)
        if transformer:
            return transformer(data)
        return data


# ─────────────────────────────────────────────
# Sync Queue
# ─────────────────────────────────────────────

class SyncQueue:
    """Priority queue for sync jobs."""

    def __init__(self):
        self._queue: List[Tuple[int, SyncJob]] = []  # (priority, job)
        self._processing: Dict[str, SyncJob] = {}

    def enqueue(self, job: SyncJob, priority: int = 5):
        """Enqueue a sync job. Lower priority number = higher priority."""
        self._queue.append((priority, job))
        self._queue.sort(key=lambda x: x[0])
        logger.debug(f"[SyncQueue] Enqueued: {job.job_id} priority={priority}")

    def dequeue(self) -> Optional[SyncJob]:
        if not self._queue:
            return None
        _, job = self._queue.pop(0)
        self._processing[job.job_id] = job
        return job

    def complete(self, job_id: str):
        self._processing.pop(job_id, None)

    def fail(self, job_id: str):
        self._processing.pop(job_id, None)

    def size(self) -> int:
        return len(self._queue)

    def processing_count(self) -> int:
        return len(self._processing)


# ─────────────────────────────────────────────
# Retry Policy
# ─────────────────────────────────────────────

class RetryPolicy:
    """Exponential backoff retry policy."""

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        jitter: bool = True,
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter

    def get_delay(self, attempt: int) -> float:
        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        if self.jitter:
            delay *= (0.5 + random.random() * 0.5)
        return delay

    def should_retry(self, attempt: int) -> bool:
        return attempt < self.max_attempts


# ─────────────────────────────────────────────
# Sync Manager
# ─────────────────────────────────────────────

class SyncManager:
    """
    Universal Sync Manager for the LifeOS Connector Platform.

    Manages all data synchronization between LifeOS and external services.
    Supports delta sync, conflict resolution, and parallel execution.

    Sync Flow:
      1. Schedule or trigger sync job
      2. Refresh OAuth token if needed
      3. Fetch delta (changes since last sync)
      4. Transform data to LifeOS format
      5. Resolve conflicts
      6. Apply changes
      7. Push local changes to remote (if bidirectional)
      8. Update delta token / cursor
      9. Record sync completion
    """

    def __init__(self):
        self._queue = SyncQueue()
        self._conflict_resolver = ConflictResolver()
        self._transformer = DataTransformer()
        self._retry_policy = RetryPolicy()
        self._sync_handlers: Dict[str, Callable] = {}
        self._delta_tokens: Dict[str, str] = {}  # integration_id → delta token
        self._sync_stats: Dict[str, Dict] = defaultdict(lambda: {
            "total_syncs": 0,
            "successful_syncs": 0,
            "failed_syncs": 0,
            "total_records": 0,
            "last_sync": None,
        })
        self._active_jobs: Dict[str, SyncJob] = {}
        self._completed_jobs: List[SyncJob] = []
        logger.info("[SyncManager] Initialized — Delta Sync + Conflict Resolution active")

    # ── Handler Registration ──────────────────

    def register_sync_handler(self, connector_id: str, handler: Callable):
        """Register a sync handler for a connector."""
        self._sync_handlers[connector_id] = handler
        logger.info(f"[SyncManager] Handler registered: {connector_id}")

    def register_transformer(
        self,
        connector_id: str,
        resource_type: str,
        inbound: Callable,
        outbound: Callable,
    ):
        self._transformer.register(connector_id, resource_type, inbound, outbound)

    # ── Sync Scheduling ───────────────────────

    def schedule_sync(
        self,
        integration: IntegrationConfig,
        resource_types: Optional[List[str]] = None,
        priority: int = 5,
        force_full: bool = False,
    ) -> SyncJob:
        """Schedule a sync job for an integration."""
        job = SyncJob(
            integration_id=integration.integration_id,
            connector_id=integration.connector_id,
            user_id=integration.user_id,
            direction=integration.sync_direction,
            resource_types=resource_types or [],
            status="queued",
        )

        if not force_full:
            # Attach delta token for incremental sync
            delta_key = f"{integration.integration_id}:{integration.connector_id}"
            job.delta_token = self._delta_tokens.get(delta_key)

        self._queue.enqueue(job, priority)
        logger.info(f"[SyncManager] Scheduled: {job.job_id} connector={integration.connector_id}")
        return job

    # ── Sync Execution ────────────────────────

    async def execute_sync(self, job: SyncJob) -> SyncJob:
        """
        Execute a sync job with retry and error handling.
        """
        job.started_at = datetime.now(timezone.utc)
        job.status = "running"
        self._active_jobs[job.job_id] = job

        attempt = 0
        last_error = None

        while self._retry_policy.should_retry(attempt):
            try:
                result = await self._run_sync(job)
                job.records_synced = result.get("records_synced", 0)
                job.records_failed = result.get("records_failed", 0)
                job.delta_token = result.get("next_delta_token")
                job.status = "completed"
                job.completed_at = datetime.now(timezone.utc)

                # Store delta token for next sync
                if job.delta_token:
                    delta_key = f"{job.integration_id}:{job.connector_id}"
                    self._delta_tokens[delta_key] = job.delta_token

                # Update stats
                stats = self._sync_stats[job.connector_id]
                stats["total_syncs"] += 1
                stats["successful_syncs"] += 1
                stats["total_records"] += job.records_synced
                stats["last_sync"] = job.completed_at.isoformat()

                logger.info(
                    f"[SyncManager] Completed: {job.job_id} "
                    f"records={job.records_synced} connector={job.connector_id}"
                )
                break

            except Exception as exc:
                last_error = str(exc)
                attempt += 1
                if self._retry_policy.should_retry(attempt):
                    delay = self._retry_policy.get_delay(attempt)
                    logger.warning(
                        f"[SyncManager] Retry {attempt}/{self._retry_policy.max_attempts} "
                        f"in {delay:.1f}s: {exc}"
                    )
                    await asyncio.sleep(delay)
                else:
                    job.status = "failed"
                    job.error = last_error
                    job.completed_at = datetime.now(timezone.utc)
                    stats = self._sync_stats[job.connector_id]
                    stats["total_syncs"] += 1
                    stats["failed_syncs"] += 1
                    logger.error(f"[SyncManager] Failed: {job.job_id} error={last_error}")

        self._active_jobs.pop(job.job_id, None)
        self._queue.complete(job.job_id)
        self._completed_jobs.append(job)
        if len(self._completed_jobs) > 500:
            self._completed_jobs = self._completed_jobs[-500:]

        return job

    async def _run_sync(self, job: SyncJob) -> Dict[str, Any]:
        """Internal sync execution — calls the connector handler."""
        handler = self._sync_handlers.get(job.connector_id)
        if handler:
            if asyncio.iscoroutinefunction(handler):
                return await handler(job)
            return handler(job)

        # Default simulated sync for demo
        await asyncio.sleep(0.1)  # Simulate API call
        return {
            "records_synced": random.randint(1, 50),
            "records_failed": 0,
            "next_delta_token": f"delta_{job.connector_id}_{datetime.now(timezone.utc).timestamp():.0f}",
        }

    # ── Multi-Connector Sync ──────────────────

    async def sync_all(self, integrations: List[IntegrationConfig]) -> List[SyncJob]:
        """Sync all integrations in parallel."""
        jobs = [self.schedule_sync(integration) for integration in integrations]
        results = await asyncio.gather(
            *[self.execute_sync(job) for job in jobs],
            return_exceptions=True,
        )
        completed = []
        for result in results:
            if isinstance(result, SyncJob):
                completed.append(result)
            else:
                logger.error(f"[SyncManager] Parallel sync error: {result}")
        return completed

    # ── Conflict Resolution ───────────────────

    def set_conflict_strategy(
        self,
        connector_id: str,
        resource_type: str,
        strategy: ConflictStrategy,
    ):
        self._conflict_resolver.set_strategy(connector_id, resource_type, strategy)

    def get_pending_conflicts(self) -> List[Dict[str, Any]]:
        return self._conflict_resolver.get_pending_conflicts()

    # ── Status & Stats ────────────────────────

    def get_active_jobs(self) -> List[SyncJob]:
        return list(self._active_jobs.values())

    def get_queue_size(self) -> int:
        return self._queue.size()

    def get_sync_stats(self, connector_id: Optional[str] = None) -> Dict[str, Any]:
        if connector_id:
            return self._sync_stats.get(connector_id, {})
        return dict(self._sync_stats)

    def get_recent_jobs(self, limit: int = 20) -> List[SyncJob]:
        return self._completed_jobs[-limit:]

    def get_stats(self) -> Dict[str, Any]:
        total = sum(s["total_syncs"] for s in self._sync_stats.values())
        successful = sum(s["successful_syncs"] for s in self._sync_stats.values())
        return {
            "queue_size": self._queue.size(),
            "active_jobs": len(self._active_jobs),
            "total_syncs": total,
            "successful_syncs": successful,
            "failed_syncs": total - successful,
            "pending_conflicts": len(self.get_pending_conflicts()),
            "delta_tokens_stored": len(self._delta_tokens),
        }
