"""
LatencyMonitor — Request latency tracking for LifeOS SLA compliance.

Tracks:
- P50, P90, P95, P99, P99.9 latencies
- SLA breach detection
- Per-endpoint breakdown
- Apdex score calculation
- Latency histograms
- Slow request logging
"""

import time
import math
import threading
import contextlib
import logging
from typing import Any, Callable, Dict, List, Optional
from collections import defaultdict, deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# Sprint 027 SLA targets (milliseconds)
SLA_TARGETS = {
    "startup": 2000,
    "dashboard": 500,
    "life_graph_search": 300,
    "companion_response": 1000,
    "default": 1000,
}

# Apdex: satisfied < T, tolerating < 4T, frustrated >= 4T
APDEX_T_MS = 500.0


@dataclass
class LatencySample:
    endpoint: str
    latency_ms: float
    ts: float = field(default_factory=time.monotonic)
    status: str = "ok"   # ok | error | timeout
    user_id: Optional[str] = None


class LatencyMonitor:
    """
    Latency monitor with percentile tracking and SLA alerting.

    Uses a sliding window of samples per endpoint to compute
    real-time percentile statistics.
    """

    def __init__(
        self,
        window_size: int = 1000,
        slow_threshold_ms: float = 1000.0,
        sla_targets: Optional[Dict[str, float]] = None,
        name: str = "latency_monitor",
    ) -> None:
        self.name = name
        self.window_size = window_size
        self.slow_threshold_ms = slow_threshold_ms
        self.sla_targets = sla_targets or SLA_TARGETS
        self._samples: Dict[str, deque] = defaultdict(lambda: deque(maxlen=window_size))
        self._slow_requests: deque = deque(maxlen=500)
        self._sla_breaches: deque = deque(maxlen=1000)
        self._lock = threading.RLock()
        self._stats: Dict[str, Dict] = defaultdict(lambda: {
            "total": 0, "errors": 0, "sla_breaches": 0
        })

    # ------------------------------------------------------------------
    # Recording
    # ------------------------------------------------------------------

    def record(
        self,
        endpoint: str,
        latency_ms: float,
        status: str = "ok",
        user_id: Optional[str] = None,
    ) -> None:
        """Record a single latency observation."""
        sample = LatencySample(
            endpoint=endpoint,
            latency_ms=latency_ms,
            status=status,
            user_id=user_id,
        )
        with self._lock:
            self._samples[endpoint].append(sample)
            self._stats[endpoint]["total"] += 1
            if status == "error":
                self._stats[endpoint]["errors"] += 1

            # SLA check
            sla = self.sla_targets.get(endpoint, self.sla_targets.get("default", 1000))
            if latency_ms > sla:
                self._stats[endpoint]["sla_breaches"] += 1
                self._sla_breaches.append({
                    "endpoint": endpoint,
                    "latency_ms": latency_ms,
                    "sla_ms": sla,
                    "ts": sample.ts,
                })

            # Slow request log
            if latency_ms > self.slow_threshold_ms:
                self._slow_requests.append(sample)

    @contextlib.contextmanager
    def measure(self, endpoint: str, user_id: Optional[str] = None):
        """Context manager that automatically records latency."""
        t0 = time.monotonic()
        status = "ok"
        try:
            yield
        except Exception:
            status = "error"
            raise
        finally:
            latency_ms = (time.monotonic() - t0) * 1000
            self.record(endpoint, latency_ms, status=status, user_id=user_id)

    def timer(self, endpoint: str):
        """Decorator that measures function execution time."""
        def decorator(fn: Callable) -> Callable:
            def wrapper(*args, **kwargs):
                with self.measure(endpoint):
                    return fn(*args, **kwargs)
            return wrapper
        return decorator

    # ------------------------------------------------------------------
    # Percentile calculations
    # ------------------------------------------------------------------

    def percentile(self, endpoint: str, p: float) -> Optional[float]:
        """Calculate Pth percentile latency for an endpoint."""
        with self._lock:
            samples = [s.latency_ms for s in self._samples[endpoint]]
        if not samples:
            return None
        sorted_samples = sorted(samples)
        idx = math.ceil(p / 100.0 * len(sorted_samples)) - 1
        return round(sorted_samples[max(0, idx)], 2)

    def percentiles(self, endpoint: str) -> Dict[str, Optional[float]]:
        """Return P50, P90, P95, P99, P99.9 for an endpoint."""
        return {
            "p50": self.percentile(endpoint, 50),
            "p90": self.percentile(endpoint, 90),
            "p95": self.percentile(endpoint, 95),
            "p99": self.percentile(endpoint, 99),
            "p999": self.percentile(endpoint, 99.9),
        }

    def average(self, endpoint: str) -> Optional[float]:
        with self._lock:
            samples = [s.latency_ms for s in self._samples[endpoint]]
        return round(sum(samples) / len(samples), 2) if samples else None

    def apdex(self, endpoint: str, t_ms: float = APDEX_T_MS) -> Optional[float]:
        """
        Calculate Apdex score for an endpoint.
        Score = (satisfied + tolerating/2) / total
        """
        with self._lock:
            samples = [s.latency_ms for s in self._samples[endpoint]]
        if not samples:
            return None
        satisfied = sum(1 for ms in samples if ms <= t_ms)
        tolerating = sum(1 for ms in samples if t_ms < ms <= 4 * t_ms)
        return round((satisfied + tolerating / 2) / len(samples), 3)

    # ------------------------------------------------------------------
    # SLA compliance
    # ------------------------------------------------------------------

    def sla_compliance(self, endpoint: str) -> Optional[float]:
        """Return SLA compliance percentage for an endpoint."""
        with self._lock:
            stats = self._stats[endpoint]
        total = stats["total"]
        if not total:
            return None
        breaches = stats["sla_breaches"]
        return round((total - breaches) / total * 100, 2)

    def sla_status(self) -> Dict[str, Dict]:
        """Return SLA status for all monitored endpoints."""
        result = {}
        with self._lock:
            endpoints = list(self._samples.keys())
        for ep in endpoints:
            sla_ms = self.sla_targets.get(ep, self.sla_targets.get("default", 1000))
            compliance = self.sla_compliance(ep)
            p99 = self.percentile(ep, 99)
            result[ep] = {
                "sla_ms": sla_ms,
                "p99_ms": p99,
                "compliance_pct": compliance,
                "apdex": self.apdex(ep),
                "status": "OK" if (p99 or 0) <= sla_ms else "BREACH",
            }
        return result

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def endpoint_stats(self, endpoint: str) -> Dict[str, Any]:
        with self._lock:
            stats = dict(self._stats[endpoint])
            sample_count = len(self._samples[endpoint])
        return {
            "endpoint": endpoint,
            "sample_count": sample_count,
            "avg_ms": self.average(endpoint),
            **self.percentiles(endpoint),
            "apdex": self.apdex(endpoint),
            "sla_compliance_pct": self.sla_compliance(endpoint),
            **stats,
        }

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            endpoints = list(self._samples.keys())
        return {
            "name": self.name,
            "endpoints": {ep: self.endpoint_stats(ep) for ep in endpoints},
            "sla_status": self.sla_status(),
            "slow_requests_count": len(self._slow_requests),
            "sla_breaches_count": len(self._sla_breaches),
        }

    def __repr__(self) -> str:
        with self._lock:
            n = len(self._samples)
        return f"LatencyMonitor(name={self.name!r}, endpoints={n})"
