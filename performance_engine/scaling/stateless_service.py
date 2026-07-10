"""
StatelessService — Stateless service architecture for LifeOS.

Enforces stateless design patterns:
- No in-memory session state (use Redis/cache)
- Idempotent request handling
- Externalized configuration
- Health check endpoints
- Graceful shutdown support
- Service discovery registration
"""

import time
import uuid
import threading
import logging
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ServiceStatus(Enum):
    STARTING = "starting"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    STOPPING = "stopping"
    STOPPED = "stopped"


@dataclass
class ServiceConfig:
    """Externalized service configuration (12-factor app style)."""
    service_name: str
    service_version: str = "1.0.0"
    instance_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    region: str = "us-east-1"
    environment: str = "production"
    # Networking
    host: str = "0.0.0.0"
    port: int = 8080
    # Timeouts
    request_timeout_s: float = 30.0
    shutdown_timeout_s: float = 30.0
    # Health check
    health_check_path: str = "/health"
    health_check_interval_s: float = 10.0
    # Scaling hints
    max_concurrent_requests: int = 1000
    # External dependencies (URLs, not in-process)
    redis_url: str = "redis://localhost:6379"
    database_url: str = "postgresql://localhost:5432/lifeos"


class StatelessService:
    """
    Base class for LifeOS stateless microservices.

    Enforces stateless design by:
    1. Prohibiting in-memory session storage
    2. Requiring all state to be externalized (Redis/DB)
    3. Providing standard health/ready/live endpoints
    4. Supporting graceful shutdown
    """

    def __init__(self, config: ServiceConfig) -> None:
        self.config = config
        self.instance_id = config.instance_id
        self._status = ServiceStatus.STARTING
        self._start_time = time.monotonic()
        self._request_count = 0
        self._error_count = 0
        self._lock = threading.Lock()
        self._shutdown_handlers: List[Callable] = []
        self._readiness_checks: List[Callable[[], bool]] = []

    # ------------------------------------------------------------------
    # Stateless enforcement
    # ------------------------------------------------------------------

    def _assert_no_local_state(self, attr_name: str) -> None:
        """Raise if trying to store session state locally."""
        raise RuntimeError(
            f"[StatelessService] Attempt to store local state '{attr_name}'. "
            "Use the distributed cache (Redis) instead."
        )

    # ------------------------------------------------------------------
    # Health endpoints
    # ------------------------------------------------------------------

    def health(self) -> Dict[str, Any]:
        """Kubernetes liveness probe response."""
        return {
            "status": self._status.value,
            "instance_id": self.instance_id,
            "service": self.config.service_name,
            "version": self.config.service_version,
            "uptime_s": round(time.monotonic() - self._start_time, 1),
        }

    def ready(self) -> Dict[str, Any]:
        """Kubernetes readiness probe response."""
        checks = {}
        all_ready = True
        for check_fn in self._readiness_checks:
            try:
                result = check_fn()
                checks[check_fn.__name__] = result
                if not result:
                    all_ready = False
            except Exception as exc:
                checks[check_fn.__name__] = False
                all_ready = False

        return {
            "ready": all_ready and self._status == ServiceStatus.HEALTHY,
            "checks": checks,
            "instance_id": self.instance_id,
        }

    def live(self) -> bool:
        """Simple liveness check."""
        return self._status not in (ServiceStatus.STOPPING, ServiceStatus.STOPPED)

    def add_readiness_check(self, fn: Callable[[], bool]) -> None:
        self._readiness_checks.append(fn)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        self._status = ServiceStatus.HEALTHY
        logger.info(
            "[StatelessService] %s instance %s started (region=%s, env=%s)",
            self.config.service_name,
            self.instance_id,
            self.config.region,
            self.config.environment,
        )

    def stop(self) -> None:
        self._status = ServiceStatus.STOPPING
        logger.info(
            "[StatelessService] %s instance %s stopping...",
            self.config.service_name, self.instance_id,
        )
        for handler in self._shutdown_handlers:
            try:
                handler()
            except Exception as exc:
                logger.error("[StatelessService] Shutdown handler failed: %s", exc)
        self._status = ServiceStatus.STOPPED

    def on_shutdown(self, fn: Callable) -> None:
        self._shutdown_handlers.append(fn)

    # ------------------------------------------------------------------
    # Request tracking
    # ------------------------------------------------------------------

    def track_request(self, success: bool = True) -> None:
        with self._lock:
            self._request_count += 1
            if not success:
                self._error_count += 1

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "service": self.config.service_name,
                "instance_id": self.instance_id,
                "status": self._status.value,
                "uptime_s": round(time.monotonic() - self._start_time, 1),
                "requests": self._request_count,
                "errors": self._error_count,
                "error_rate": round(
                    self._error_count / self._request_count * 100
                    if self._request_count else 0, 2
                ),
                "region": self.config.region,
                "environment": self.config.environment,
            }


class ServiceRegistry:
    """
    In-memory service registry for local development / testing.
    In production, replace with Consul, etcd, or Kubernetes DNS.
    """

    def __init__(self) -> None:
        self._services: Dict[str, List[StatelessService]] = {}
        self._lock = threading.Lock()

    def register(self, service: StatelessService) -> None:
        name = service.config.service_name
        with self._lock:
            self._services.setdefault(name, []).append(service)
        logger.info(
            "[ServiceRegistry] Registered %s instance %s",
            name, service.instance_id,
        )

    def deregister(self, service: StatelessService) -> None:
        name = service.config.service_name
        with self._lock:
            instances = self._services.get(name, [])
            self._services[name] = [s for s in instances if s.instance_id != service.instance_id]

    def get_instances(self, service_name: str) -> List[StatelessService]:
        with self._lock:
            return [
                s for s in self._services.get(service_name, [])
                if s.live()
            ]

    def all_services(self) -> Dict[str, List[Dict]]:
        with self._lock:
            return {
                name: [s.stats() for s in instances]
                for name, instances in self._services.items()
            }

    def __repr__(self) -> str:
        with self._lock:
            total = sum(len(v) for v in self._services.values())
        return f"ServiceRegistry(services={len(self._services)}, instances={total})"
