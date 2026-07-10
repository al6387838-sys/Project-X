"""
Canary Deployer — Gradual Canary Deployment for LifeOS.
SIGMA-006: DevOps Automation
"""

import time
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class CanaryConfig:
    """Canary deployment configuration."""
    initial_traffic_pct: float = 5.0
    traffic_steps: List[float] = field(default_factory=lambda: [5, 10, 25, 50, 75, 100])
    step_interval_seconds: int = 300
    error_rate_threshold: float = 0.02  # 2%
    latency_threshold_ms: float = 3000.0
    auto_rollback: bool = True


@dataclass
class CanaryState:
    """Current canary deployment state."""
    version: str
    current_step: int = 0
    traffic_pct: float = 0.0
    error_rate: float = 0.0
    avg_latency_ms: float = 0.0
    is_healthy: bool = True
    promoted: bool = False
    rolled_back: bool = False


class CanaryDeployer:
    """
    World-Class Canary Deployer for LifeOS.

    SIGMA-006: Implements:
    - Gradual traffic shifting
    - Real-time health monitoring
    - Automatic promotion on success
    - Automatic rollback on failure
    - Metrics collection per step
    """

    def __init__(self, name: str = "canary_deployer") -> None:
        self.name = name
        self._config = CanaryConfig()
        self._state: Optional[CanaryState] = None
        self._history: List[Dict[str, Any]] = []
        self._stats = {
            "deployments": 0,
            "promotions": 0,
            "rollbacks": 0,
            "steps_completed": 0,
        }

    def start_canary(self, version: str) -> CanaryState:
        """Start a canary deployment."""
        self._state = CanaryState(
            version=version,
            current_step=0,
            traffic_pct=self._config.initial_traffic_pct,
        )
        self._stats["deployments"] += 1
        logger.info(f"[CanaryDeployer] Canary started: {version} at {self._config.initial_traffic_pct}%")
        return self._state

    def advance_step(self, error_rate: float = 0.0, latency_ms: float = 0.0) -> Optional[CanaryState]:
        """Advance to next canary step."""
        if not self._state or self._state.promoted or self._state.rolled_back:
            return None

        # Check health
        if error_rate > self._config.error_rate_threshold:
            self._state.is_healthy = False
            if self._config.auto_rollback:
                self._rollback()
            return self._state

        if latency_ms > self._config.latency_threshold_ms:
            self._state.is_healthy = False
            if self._config.auto_rollback:
                self._rollback()
            return self._state

        self._state.error_rate = error_rate
        self._state.avg_latency_ms = latency_ms

        # Move to next step
        if self._state.current_step < len(self._config.traffic_steps) - 1:
            self._state.current_step += 1
            self._state.traffic_pct = self._config.traffic_steps[self._state.current_step]
            self._stats["steps_completed"] += 1
        else:
            # Promote
            self._state.traffic_pct = 100.0
            self._state.promoted = True
            self._stats["promotions"] += 1
            logger.info(f"[CanaryDeployer] Canary promoted: {self._state.version}")

        self._history.append({
            "step": self._state.current_step,
            "traffic": self._state.traffic_pct,
            "error_rate": error_rate,
            "latency": latency_ms,
            "healthy": self._state.is_healthy,
        })

        return self._state

    def _rollback(self) -> None:
        if self._state:
            self._state.rolled_back = True
            self._stats["rollbacks"] += 1
            logger.warning(f"[CanaryDeployer] Canary rolled back: {self._state.version}")

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "state": {"version": self._state.version, "traffic": self._state.traffic_pct, "promoted": self._state.promoted, "rolled_back": self._state.rolled_back} if self._state else None,
            "history_steps": len(self._history),
        }

    def __repr__(self) -> str:
        return (
            f"CanaryDeployer(name={self.name!r}, "
            f"deployments={self._stats['deployments']}, "
            f"promotions={self._stats['promotions']})"
        )
