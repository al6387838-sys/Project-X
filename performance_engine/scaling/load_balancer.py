"""
LoadBalancer — Software load balancer for LifeOS service instances.

Strategies:
- Round Robin (default)
- Weighted Round Robin
- Least Connections
- Random
- IP Hash (sticky sessions via hash)
- Least Response Time

Features:
- Health-aware routing (skip unhealthy instances)
- Connection tracking
- Circuit breaker integration
- Metrics per instance
"""

import time
import random
import hashlib
import threading
import logging
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class LoadBalancingStrategy(Enum):
    ROUND_ROBIN = "round_robin"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    LEAST_CONNECTIONS = "least_connections"
    RANDOM = "random"
    IP_HASH = "ip_hash"
    LEAST_RESPONSE_TIME = "least_response_time"


@dataclass
class BackendInstance:
    """A backend service instance."""
    instance_id: str
    host: str
    port: int
    weight: int = 1
    healthy: bool = True
    active_connections: int = 0
    total_requests: int = 0
    total_errors: int = 0
    avg_response_ms: float = 0.0
    last_health_check: float = field(default_factory=time.monotonic)

    @property
    def error_rate(self) -> float:
        return self.total_errors / self.total_requests if self.total_requests else 0.0

    @property
    def address(self) -> str:
        return f"{self.host}:{self.port}"


class LoadBalancer:
    """
    Software load balancer for LifeOS.

    Routes requests to healthy backend instances using
    the configured load balancing strategy.
    """

    def __init__(
        self,
        strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN,
        name: str = "load_balancer",
    ) -> None:
        self.name = name
        self.strategy = strategy
        self._instances: List[BackendInstance] = []
        self._lock = threading.RLock()
        self._rr_index = 0
        self._stats = {
            "total_requests": 0,
            "routed": 0,
            "rejected_no_healthy": 0,
        }

    # ------------------------------------------------------------------
    # Instance management
    # ------------------------------------------------------------------

    def add_instance(self, instance: BackendInstance) -> None:
        with self._lock:
            self._instances.append(instance)
        logger.info("[LoadBalancer] Added instance %s (%s)", instance.instance_id, instance.address)

    def remove_instance(self, instance_id: str) -> bool:
        with self._lock:
            before = len(self._instances)
            self._instances = [i for i in self._instances if i.instance_id != instance_id]
            return len(self._instances) < before

    def mark_healthy(self, instance_id: str) -> None:
        with self._lock:
            for inst in self._instances:
                if inst.instance_id == instance_id:
                    inst.healthy = True
                    inst.last_health_check = time.monotonic()

    def mark_unhealthy(self, instance_id: str) -> None:
        with self._lock:
            for inst in self._instances:
                if inst.instance_id == instance_id:
                    inst.healthy = False
                    inst.last_health_check = time.monotonic()

    # ------------------------------------------------------------------
    # Routing
    # ------------------------------------------------------------------

    def select(self, client_ip: Optional[str] = None) -> Optional[BackendInstance]:
        """Select a backend instance for the next request."""
        with self._lock:
            healthy = [i for i in self._instances if i.healthy]
            self._stats["total_requests"] += 1

            if not healthy:
                self._stats["rejected_no_healthy"] += 1
                logger.warning("[LoadBalancer] No healthy instances available!")
                return None

            instance = self._select_strategy(healthy, client_ip)
            if instance:
                instance.active_connections += 1
                instance.total_requests += 1
                self._stats["routed"] += 1
            return instance

    def release(self, instance: BackendInstance, response_ms: float, error: bool = False) -> None:
        """Release a connection and record metrics."""
        with self._lock:
            instance.active_connections = max(0, instance.active_connections - 1)
            if error:
                instance.total_errors += 1
            # Update rolling average response time
            n = instance.total_requests
            instance.avg_response_ms = (
                (instance.avg_response_ms * (n - 1) + response_ms) / n if n > 0 else response_ms
            )

    def _select_strategy(
        self,
        healthy: List[BackendInstance],
        client_ip: Optional[str],
    ) -> Optional[BackendInstance]:
        if self.strategy == LoadBalancingStrategy.ROUND_ROBIN:
            inst = healthy[self._rr_index % len(healthy)]
            self._rr_index += 1
            return inst

        if self.strategy == LoadBalancingStrategy.RANDOM:
            return random.choice(healthy)

        if self.strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
            return min(healthy, key=lambda i: i.active_connections)

        if self.strategy == LoadBalancingStrategy.LEAST_RESPONSE_TIME:
            return min(healthy, key=lambda i: i.avg_response_ms)

        if self.strategy == LoadBalancingStrategy.IP_HASH and client_ip:
            h = int(hashlib.md5(client_ip.encode()).hexdigest(), 16)
            return healthy[h % len(healthy)]

        if self.strategy == LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
            total_weight = sum(i.weight for i in healthy)
            r = random.randint(0, total_weight - 1)
            cumulative = 0
            for inst in healthy:
                cumulative += inst.weight
                if r < cumulative:
                    return inst

        # Fallback: round robin
        inst = healthy[self._rr_index % len(healthy)]
        self._rr_index += 1
        return inst

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            healthy_count = sum(1 for i in self._instances if i.healthy)
            return {
                "name": self.name,
                "strategy": self.strategy.value,
                "total_instances": len(self._instances),
                "healthy_instances": healthy_count,
                "instances": [
                    {
                        "id": i.instance_id,
                        "address": i.address,
                        "healthy": i.healthy,
                        "active_connections": i.active_connections,
                        "total_requests": i.total_requests,
                        "avg_response_ms": round(i.avg_response_ms, 2),
                        "error_rate_pct": round(i.error_rate * 100, 2),
                    }
                    for i in self._instances
                ],
                **self._stats,
            }

    def __repr__(self) -> str:
        with self._lock:
            healthy = sum(1 for i in self._instances if i.healthy)
        return (
            f"LoadBalancer(name={self.name!r}, "
            f"strategy={self.strategy.value!r}, "
            f"instances={healthy}/{len(self._instances)})"
        )
