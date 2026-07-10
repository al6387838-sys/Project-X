"""
LifeOS Metrics Collector
=========================
In-process metrics collection for LifeOS V1.0 RC.
Exposes Prometheus-compatible metrics endpoint.
"""
import time
from collections import defaultdict
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional


class Counter:
    """Thread-safe monotonic counter."""

    def __init__(self, name: str, description: str, labels: List[str] = None):
        self.name = name
        self.description = description
        self.label_names = labels or []
        self._values: Dict[tuple, float] = defaultdict(float)
        self._lock = Lock()

    def inc(self, amount: float = 1.0, **labels):
        key = tuple(labels.get(l, "") for l in self.label_names)
        with self._lock:
            self._values[key] += amount

    def get(self, **labels) -> float:
        key = tuple(labels.get(l, "") for l in self.label_names)
        return self._values.get(key, 0.0)


class Gauge:
    """Thread-safe gauge metric."""

    def __init__(self, name: str, description: str, labels: List[str] = None):
        self.name = name
        self.description = description
        self.label_names = labels or []
        self._values: Dict[tuple, float] = {}
        self._lock = Lock()

    def set(self, value: float, **labels):
        key = tuple(labels.get(l, "") for l in self.label_names)
        with self._lock:
            self._values[key] = value

    def get(self, **labels) -> float:
        key = tuple(labels.get(l, "") for l in self.label_names)
        return self._values.get(key, 0.0)


class Histogram:
    """Thread-safe histogram for latency tracking."""

    DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

    def __init__(self, name: str, description: str, buckets: List[float] = None):
        self.name = name
        self.description = description
        self.buckets = sorted(buckets or self.DEFAULT_BUCKETS)
        self._observations: List[float] = []
        self._lock = Lock()

    def observe(self, value: float):
        with self._lock:
            self._observations.append(value)

    def summary(self) -> Dict[str, float]:
        with self._lock:
            if not self._observations:
                return {"count": 0, "sum": 0, "avg": 0, "p50": 0, "p95": 0, "p99": 0}
            sorted_obs = sorted(self._observations)
            n = len(sorted_obs)
            return {
                "count": n,
                "sum": sum(sorted_obs),
                "avg": sum(sorted_obs) / n,
                "p50": sorted_obs[int(n * 0.50)],
                "p95": sorted_obs[int(n * 0.95)],
                "p99": sorted_obs[int(n * 0.99)],
                "min": sorted_obs[0],
                "max": sorted_obs[-1],
            }


class MetricsCollector:
    """
    Central metrics registry for LifeOS.
    """

    def __init__(self):
        self._start_time = time.time()

        # Core metrics
        self.decisions_processed = Counter(
            "lifeos_decisions_total",
            "Total decisions processed",
            labels=["domain", "status"]
        )
        self.decision_latency = Histogram(
            "lifeos_decision_latency_ms",
            "Decision processing latency in milliseconds"
        )
        self.sync_operations = Counter(
            "lifeos_sync_operations_total",
            "Total cloud sync operations",
            labels=["operation", "status"]
        )
        self.security_events = Counter(
            "lifeos_security_events_total",
            "Total security events",
            labels=["event_type", "severity"]
        )
        self.active_sessions = Gauge(
            "lifeos_active_sessions",
            "Current active user sessions"
        )
        self.offline_queue_size = Gauge(
            "lifeos_offline_queue_size",
            "Current offline operation queue size"
        )
        self.errors = Counter(
            "lifeos_errors_total",
            "Total errors by module",
            labels=["module", "error_type"]
        )

    def uptime_seconds(self) -> float:
        return time.time() - self._start_time

    def snapshot(self) -> Dict[str, Any]:
        """Return a full metrics snapshot."""
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": self.uptime_seconds(),
            "decisions": {
                "total": self.decisions_processed.get(),
                "latency": self.decision_latency.summary(),
            },
            "sync": {
                "total": self.sync_operations.get(),
                "offline_queue_size": self.offline_queue_size.get(),
            },
            "security": {
                "events_total": self.security_events.get(),
                "active_sessions": self.active_sessions.get(),
            },
            "errors": {
                "total": self.errors.get(),
            },
        }


# Global metrics instance
metrics = MetricsCollector()
