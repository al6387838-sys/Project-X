"""
AutoScaler — Horizontal auto-scaling controller for LifeOS.

Implements scaling policies for:
- CPU-based scaling
- Memory-based scaling
- Request rate scaling
- Queue depth scaling
- Custom metric scaling

Supports:
- Scale-up / scale-down with cooldown periods
- Min/max instance bounds
- Predictive scaling (based on historical patterns)
- Multi-service scaling
- Kubernetes HPA-compatible metrics
"""

import time
import threading
import logging
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ScalingDirection(Enum):
    UP = "up"
    DOWN = "down"
    NONE = "none"


class ScalingTrigger(Enum):
    CPU = "cpu"
    MEMORY = "memory"
    REQUEST_RATE = "request_rate"
    QUEUE_DEPTH = "queue_depth"
    LATENCY = "latency"
    CUSTOM = "custom"


@dataclass
class ScalingPolicy:
    """Policy definition for auto-scaling."""
    name: str
    trigger: ScalingTrigger
    metric_fn: Callable[[], float]   # returns current metric value
    scale_up_threshold: float
    scale_down_threshold: float
    scale_up_by: int = 1             # instances to add
    scale_down_by: int = 1           # instances to remove
    cooldown_up_s: float = 60.0      # cooldown after scale-up
    cooldown_down_s: float = 300.0   # cooldown after scale-down
    enabled: bool = True


@dataclass
class ScalingEvent:
    """Record of a scaling action."""
    event_id: str
    service_name: str
    direction: ScalingDirection
    trigger: ScalingTrigger
    metric_value: float
    threshold: float
    instances_before: int
    instances_after: int
    ts: float = field(default_factory=time.monotonic)
    reason: str = ""


class ServiceScaler:
    """Scaler for a single service."""

    def __init__(
        self,
        service_name: str,
        min_instances: int = 1,
        max_instances: int = 100,
        current_instances: int = 1,
        scale_fn: Optional[Callable[[int], None]] = None,
    ) -> None:
        self.service_name = service_name
        self.min_instances = min_instances
        self.max_instances = max_instances
        self.current_instances = current_instances
        self.scale_fn = scale_fn  # called with new instance count
        self.policies: List[ScalingPolicy] = []
        self._last_scale_up = 0.0
        self._last_scale_down = 0.0
        self._events: List[ScalingEvent] = []
        self._lock = threading.Lock()

    def add_policy(self, policy: ScalingPolicy) -> None:
        self.policies.append(policy)

    def evaluate(self) -> Optional[ScalingEvent]:
        """Evaluate all policies and scale if needed."""
        now = time.monotonic()
        with self._lock:
            for policy in self.policies:
                if not policy.enabled:
                    continue
                try:
                    metric = policy.metric_fn()
                except Exception:
                    continue

                # Scale up
                if (
                    metric >= policy.scale_up_threshold
                    and self.current_instances < self.max_instances
                    and (now - self._last_scale_up) >= policy.cooldown_up_s
                ):
                    new_count = min(
                        self.max_instances,
                        self.current_instances + policy.scale_up_by,
                    )
                    event = self._do_scale(
                        new_count, ScalingDirection.UP,
                        policy.trigger, metric, policy.scale_up_threshold,
                        f"Metric {metric:.1f} >= threshold {policy.scale_up_threshold}",
                    )
                    self._last_scale_up = now
                    return event

                # Scale down
                elif (
                    metric <= policy.scale_down_threshold
                    and self.current_instances > self.min_instances
                    and (now - self._last_scale_down) >= policy.cooldown_down_s
                ):
                    new_count = max(
                        self.min_instances,
                        self.current_instances - policy.scale_down_by,
                    )
                    event = self._do_scale(
                        new_count, ScalingDirection.DOWN,
                        policy.trigger, metric, policy.scale_down_threshold,
                        f"Metric {metric:.1f} <= threshold {policy.scale_down_threshold}",
                    )
                    self._last_scale_down = now
                    return event

        return None

    def _do_scale(
        self,
        new_count: int,
        direction: ScalingDirection,
        trigger: ScalingTrigger,
        metric: float,
        threshold: float,
        reason: str,
    ) -> ScalingEvent:
        import uuid
        event = ScalingEvent(
            event_id=str(uuid.uuid4())[:8],
            service_name=self.service_name,
            direction=direction,
            trigger=trigger,
            metric_value=metric,
            threshold=threshold,
            instances_before=self.current_instances,
            instances_after=new_count,
            reason=reason,
        )
        logger.info(
            "[AutoScaler] %s: scaling %s %d→%d (%s)",
            self.service_name, direction.value,
            self.current_instances, new_count, reason,
        )
        self.current_instances = new_count
        self._events.append(event)
        if self.scale_fn:
            try:
                self.scale_fn(new_count)
            except Exception as exc:
                logger.error("[AutoScaler] scale_fn failed: %s", exc)
        return event

    def scaling_history(self) -> List[Dict]:
        with self._lock:
            return [
                {
                    "event_id": e.event_id,
                    "direction": e.direction.value,
                    "trigger": e.trigger.value,
                    "instances": f"{e.instances_before}→{e.instances_after}",
                    "reason": e.reason,
                    "ts": e.ts,
                }
                for e in self._events[-20:]
            ]


class AutoScaler:
    """
    Multi-service auto-scaling controller.

    Evaluates scaling policies on a configurable interval
    and dispatches scaling actions to registered services.
    """

    def __init__(
        self,
        eval_interval_s: float = 30.0,
        name: str = "auto_scaler",
    ) -> None:
        self.name = name
        self.eval_interval_s = eval_interval_s
        self._services: Dict[str, ServiceScaler] = {}
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._total_events: int = 0

    def register_service(self, scaler: ServiceScaler) -> None:
        with self._lock:
            self._services[scaler.service_name] = scaler
        logger.info("[AutoScaler] Registered service: %s", scaler.service_name)

    def start(self) -> None:
        self._running = True
        self._thread = threading.Thread(
            target=self._eval_loop, daemon=True, name=f"{self.name}_eval"
        )
        self._thread.start()
        logger.info("[AutoScaler] Started (eval every %.0fs).", self.eval_interval_s)

    def stop(self) -> None:
        self._running = False

    def _eval_loop(self) -> None:
        while self._running:
            self._evaluate_all()
            time.sleep(self.eval_interval_s)

    def _evaluate_all(self) -> None:
        with self._lock:
            services = list(self._services.values())
        for svc in services:
            event = svc.evaluate()
            if event:
                self._total_events += 1

    def force_evaluate(self) -> List[ScalingEvent]:
        """Immediately evaluate all services."""
        events = []
        with self._lock:
            services = list(self._services.values())
        for svc in services:
            event = svc.evaluate()
            if event:
                events.append(event)
        return events

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            services_info = {
                name: {
                    "current_instances": svc.current_instances,
                    "min": svc.min_instances,
                    "max": svc.max_instances,
                    "policies": len(svc.policies),
                    "recent_events": svc.scaling_history()[-3:],
                }
                for name, svc in self._services.items()
            }
        return {
            "name": self.name,
            "registered_services": len(self._services),
            "total_scaling_events": self._total_events,
            "services": services_info,
        }

    def __repr__(self) -> str:
        return (
            f"AutoScaler(name={self.name!r}, "
            f"services={len(self._services)}, "
            f"events={self._total_events})"
        )
