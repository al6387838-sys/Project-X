"""
HealthChecker — Service instance health monitoring for LifeOS.

Performs periodic health checks on service instances and
updates the LoadBalancer accordingly.

Check types:
- HTTP health endpoint
- TCP connectivity
- Custom function
- Composite (all checks must pass)
"""

import time
import socket
import threading
import logging
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class CheckType(Enum):
    HTTP = "http"
    TCP = "tcp"
    CUSTOM = "custom"


@dataclass
class ServiceInstance:
    """A service instance to health-check."""
    instance_id: str
    host: str
    port: int
    check_type: CheckType = CheckType.TCP
    check_path: str = "/health"   # for HTTP checks
    check_fn: Optional[Callable[[], bool]] = None  # for CUSTOM checks
    check_interval_s: float = 10.0
    check_timeout_s: float = 3.0
    healthy_threshold: int = 2    # consecutive successes to mark healthy
    unhealthy_threshold: int = 3  # consecutive failures to mark unhealthy
    # Runtime
    healthy: bool = True
    consecutive_successes: int = 0
    consecutive_failures: int = 0
    last_check_at: float = 0.0
    last_check_ms: float = 0.0
    total_checks: int = 0
    total_failures: int = 0


class HealthChecker:
    """
    Periodic health checker for service instances.

    Runs background threads to check each instance and
    notifies registered callbacks on status changes.
    """

    def __init__(
        self,
        name: str = "health_checker",
    ) -> None:
        self.name = name
        self._instances: Dict[str, ServiceInstance] = {}
        self._lock = threading.RLock()
        self._running = False
        self._threads: Dict[str, threading.Thread] = {}
        self._on_healthy: List[Callable[[str], None]] = []
        self._on_unhealthy: List[Callable[[str], None]] = []

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, instance: ServiceInstance) -> None:
        with self._lock:
            self._instances[instance.instance_id] = instance
        if self._running:
            self._start_checker(instance)
        logger.info(
            "[HealthChecker] Registered instance %s (%s:%d)",
            instance.instance_id, instance.host, instance.port,
        )

    def deregister(self, instance_id: str) -> None:
        with self._lock:
            self._instances.pop(instance_id, None)

    def on_healthy(self, fn: Callable[[str], None]) -> None:
        self._on_healthy.append(fn)

    def on_unhealthy(self, fn: Callable[[str], None]) -> None:
        self._on_unhealthy.append(fn)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        self._running = True
        with self._lock:
            instances = list(self._instances.values())
        for inst in instances:
            self._start_checker(inst)
        logger.info("[HealthChecker] Started for %d instances.", len(instances))

    def stop(self) -> None:
        self._running = False

    def _start_checker(self, instance: ServiceInstance) -> None:
        t = threading.Thread(
            target=self._check_loop,
            args=(instance,),
            daemon=True,
            name=f"hc_{instance.instance_id}",
        )
        t.start()
        self._threads[instance.instance_id] = t

    # ------------------------------------------------------------------
    # Check loop
    # ------------------------------------------------------------------

    def _check_loop(self, instance: ServiceInstance) -> None:
        while self._running and instance.instance_id in self._instances:
            self._do_check(instance)
            time.sleep(instance.check_interval_s)

    def _do_check(self, instance: ServiceInstance) -> bool:
        t0 = time.monotonic()
        success = False
        try:
            if instance.check_type == CheckType.TCP:
                success = self._tcp_check(instance)
            elif instance.check_type == CheckType.HTTP:
                success = self._http_check(instance)
            elif instance.check_type == CheckType.CUSTOM and instance.check_fn:
                success = instance.check_fn()
        except Exception as exc:
            logger.debug("[HealthChecker] Check error for %s: %s", instance.instance_id, exc)
            success = False

        elapsed_ms = (time.monotonic() - t0) * 1000

        with self._lock:
            instance.total_checks += 1
            instance.last_check_at = time.monotonic()
            instance.last_check_ms = elapsed_ms

            if success:
                instance.consecutive_successes += 1
                instance.consecutive_failures = 0
                if (
                    not instance.healthy
                    and instance.consecutive_successes >= instance.healthy_threshold
                ):
                    instance.healthy = True
                    logger.info("[HealthChecker] Instance %s is now HEALTHY", instance.instance_id)
                    for cb in self._on_healthy:
                        try:
                            cb(instance.instance_id)
                        except Exception:
                            pass
            else:
                instance.consecutive_failures += 1
                instance.consecutive_successes = 0
                instance.total_failures += 1
                if (
                    instance.healthy
                    and instance.consecutive_failures >= instance.unhealthy_threshold
                ):
                    instance.healthy = False
                    logger.warning("[HealthChecker] Instance %s is now UNHEALTHY", instance.instance_id)
                    for cb in self._on_unhealthy:
                        try:
                            cb(instance.instance_id)
                        except Exception:
                            pass

        return success

    def _tcp_check(self, instance: ServiceInstance) -> bool:
        try:
            sock = socket.create_connection(
                (instance.host, instance.port),
                timeout=instance.check_timeout_s,
            )
            sock.close()
            return True
        except Exception:
            return False

    def _http_check(self, instance: ServiceInstance) -> bool:
        try:
            import urllib.request
            url = f"http://{instance.host}:{instance.port}{instance.check_path}"
            req = urllib.request.urlopen(url, timeout=instance.check_timeout_s)
            return 200 <= req.status < 300
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            instances = list(self._instances.values())
        healthy = sum(1 for i in instances if i.healthy)
        return {
            "name": self.name,
            "total_instances": len(instances),
            "healthy_instances": healthy,
            "unhealthy_instances": len(instances) - healthy,
            "instances": [
                {
                    "id": i.instance_id,
                    "host": f"{i.host}:{i.port}",
                    "healthy": i.healthy,
                    "last_check_ms": round(i.last_check_ms, 2),
                    "total_checks": i.total_checks,
                    "failure_rate_pct": round(
                        i.total_failures / i.total_checks * 100 if i.total_checks else 0, 2
                    ),
                }
                for i in instances
            ],
        }

    def __repr__(self) -> str:
        with self._lock:
            healthy = sum(1 for i in self._instances.values() if i.healthy)
            total = len(self._instances)
        return f"HealthChecker(name={self.name!r}, healthy={healthy}/{total})"
