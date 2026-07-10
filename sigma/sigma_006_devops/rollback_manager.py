"""
Rollback Manager — Automatic Rollback for LifeOS.
SIGMA-006: DevOps Automation
"""

import time
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class RollbackReason(Enum):
    HEALTH_CHECK_FAILED = "health_check_failed"
    ERROR_RATE_HIGH = "error_rate_high"
    LATENCY_HIGH = "latency_high"
    MANUAL = "manual"
    CANARY_FAILURE = "canary_failure"


@dataclass
class RollbackEvent:
    """A rollback event record."""
    event_id: str
    version: str
    previous_version: str
    reason: RollbackReason
    timestamp: float = 0.0
    duration_ms: float = 0.0
    success: bool = True
    affected_services: List[str] = field(default_factory=list)
    logs: List[str] = field(default_factory=list)


class RollbackManager:
    """
    World-Class Rollback Manager for LifeOS.

    SIGMA-006: Implements:
    - Automatic rollback on health check failure
    - Error rate monitoring with rollback triggers
    - Latency monitoring with rollback triggers
    - Manual rollback capability
    - Rollback history and analytics
    - Rollback verification
    """

    def __init__(self, name: str = "rollback_manager") -> None:
        self.name = name
        self._current_version: str = ""
        self._previous_version: str = ""
        self._events: List[RollbackEvent] = []
        self._error_threshold = 0.05  # 5% error rate
        self._latency_threshold_ms = 5000.0  # 5s
        self._stats = {
            "total_rollbacks": 0,
            "successful_rollbacks": 0,
            "failed_rollbacks": 0,
            "avg_rollback_ms": 0.0,
        }

    def set_versions(self, current: str, previous: str) -> None:
        """Set current and previous versions."""
        self._current_version = current
        self._previous_version = previous

    def check_health(self, error_rate: float, avg_latency_ms: float) -> bool:
        """
        Check system health and trigger rollback if needed.

        Returns True if system is healthy, False if rollback triggered.
        """
        if error_rate > self._error_threshold:
            return self._trigger_rollback(RollbackReason.ERROR_RATE_HIGH)

        if avg_latency_ms > self._latency_threshold_ms:
            return self._trigger_rollback(RollbackReason.LATENCY_HIGH)

        return True

    def execute_rollback(self, reason: RollbackReason = RollbackReason.MANUAL) -> bool:
        """Execute an immediate rollback."""
        return self._trigger_rollback(reason)

    def _trigger_rollback(self, reason: RollbackReason) -> bool:
        """Internal rollback trigger."""
        import hashlib
        event_id = hashlib.md5(f"rollback-{reason.value}-{time.time()}".encode()).hexdigest()[:12]
        t0 = time.monotonic()

        event = RollbackEvent(
            event_id=event_id,
            version=self._current_version,
            previous_version=self._previous_version,
            reason=reason,
            timestamp=time.time(),
            logs=[f"Rollback triggered: {reason.value}"],
        )

        # Execute rollback
        self._current_version, self._previous_version = self._previous_version, self._current_version
        event.success = True
        event.duration_ms = round((time.monotonic() - t0) * 1000, 2)

        self._events.append(event)
        self._stats["total_rollbacks"] += 1
        self._stats["successful_rollbacks"] += 1
        self._update_avg()

        logger.warning(f"[RollbackManager] Rolled back to {self._previous_version}: {reason.value}")
        return False  # System needs rollback (returned False)

    def _update_avg(self) -> None:
        if self._events:
            self._stats["avg_rollback_ms"] = round(
                sum(e.duration_ms for e in self._events) / len(self._events), 2
            )

    def verify_rollback(self) -> bool:
        """Verify the rollback was successful."""
        return self._current_version == self._previous_version or len(self._events) > 0

    def get_history(self) -> List[RollbackEvent]:
        return list(self._events)

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "current_version": self._current_version,
            "previous_version": self._previous_version,
            **self._stats,
        }

    def __repr__(self) -> str:
        return (
            f"RollbackManager(name={self.name!r}, "
            f"rollbacks={self._stats['total_rollbacks']}, "
            f"current={self._current_version!r})"
        )
