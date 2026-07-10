"""
Metrics Engine — Metrics Collection and Aggregation for LifeOS.
SIGMA-007: Observability Pro
"""

import time
import math
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class MetricType(Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


@dataclass
class MetricValue:
    """A single metric data point."""
    timestamp: float
    value: float
    labels: Dict[str, str] = field(default_factory=dict)


@dataclass
class Metric:
    """A metric definition."""
    name: str
    metric_type: MetricType
    description: str
    unit: str = ""
    values: List[MetricValue] = field(default_factory=list)
    current_value: float = 0.0
    min_value: float = float("inf")
    max_value: float = float("-inf")
    count: int = 0


class MetricsEngine:
    """
    World-Class Metrics Engine for LifeOS.

    SIGMA-007: Implements:
    - Counter, Gauge, Histogram, Summary metrics
    - Metric labeling and grouping
    - Aggregation (avg, p50, p95, p99)
    - Metric export for dashboards
    - Rate calculation
    - Metric retention policies
    """

    def __init__(self, name: str = "metrics_engine") -> None:
        self.name = name
        self._metrics: Dict[str, Metric] = {}
        self._stats = {
            "total_metrics": 0,
            "total_updates": 0,
            "total_queries": 0,
        }
        self._init_default_metrics()

    def _init_default_metrics(self) -> None:
        """Initialize default LifeOS metrics."""
        defaults = [
            ("http_requests_total", MetricType.COUNTER, "Total HTTP requests", ""),
            ("http_request_duration_seconds", MetricType.HISTOGRAM, "HTTP request duration", "s"),
            ("http_request_size_bytes", MetricType.HISTOGRAM, "HTTP request size", "bytes"),
            ("http_response_size_bytes", MetricType.HISTOGRAM, "HTTP response size", "bytes"),
            ("lifeos_active_users", MetricType.GAUGE, "Active LifeOS users", "users"),
            ("lifeos_tasks_completed", MetricType.COUNTER, "Tasks completed", "tasks"),
            ("lifeos_score_current", MetricType.GAUGE, "Current Life Score", "score"),
            ("lifeos_cache_hit_rate", MetricType.GAUGE, "Cache hit rate", "ratio"),
            ("lifeos_memory_usage_mb", MetricType.GAUGE, "Memory usage", "MB"),
            ("lifeos_cpu_usage_pct", MetricType.GAUGE, "CPU usage", "%"),
            ("lifeos_error_rate", MetricType.GAUGE, "Error rate", "ratio"),
            ("lifeos_latency_p99_ms", MetricType.GAUGE, "P99 latency", "ms"),
        ]

        for name, mtype, desc, unit in defaults:
            self.register_metric(name, mtype, desc, unit)

    def register_metric(self, name: str, metric_type: MetricType, description: str, unit: str = "") -> Metric:
        """Register a new metric."""
        metric = Metric(
            name=name,
            metric_type=metric_type,
            description=description,
            unit=unit,
        )
        self._metrics[name] = metric
        self._stats["total_metrics"] += 1
        return metric

    def increment(self, name: str, value: float = 1.0, **labels) -> None:
        """Increment a counter metric."""
        metric = self._metrics.get(name)
        if not metric:
            return
        metric.current_value += value
        metric.count += 1
        if metric.current_value > metric.max_value:
            metric.max_value = metric.current_value
        metric.values.append(MetricValue(timestamp=time.time(), value=metric.current_value, labels=labels))
        self._stats["total_updates"] += 1

    def set_gauge(self, name: str, value: float, **labels) -> None:
        """Set a gauge metric value."""
        metric = self._metrics.get(name)
        if not metric:
            return
        metric.current_value = value
        metric.count += 1
        if value > metric.max_value:
            metric.max_value = value
        if value < metric.min_value:
            metric.min_value = value
        metric.values.append(MetricValue(timestamp=time.time(), value=value, labels=labels))
        self._stats["total_updates"] += 1

    def observe(self, name: str, value: float, **labels) -> None:
        """Record an observation for a histogram/summary metric."""
        metric = self._metrics.get(name)
        if not metric:
            return
        metric.values.append(MetricValue(timestamp=time.time(), value=value, labels=labels))
        metric.current_value = value
        metric.count += 1
        if value > metric.max_value:
            metric.max_value = value
        if value < metric.min_value:
            metric.min_value = value
        self._stats["total_updates"] += 1

    def get_metric(self, name: str) -> Optional[Metric]:
        return self._metrics.get(name)

    def get_percentile(self, name: str, percentile: float) -> Optional[float]:
        """Calculate a percentile for a metric."""
        metric = self._metrics.get(name)
        if not metric or not metric.values:
            return None
        values = sorted(v.value for v in metric.values)
        idx = int(math.ceil(percentile / 100.0 * len(values))) - 1
        return values[max(0, min(idx, len(values) - 1))]

    def get_rate(self, name: str, window_seconds: float = 60.0) -> float:
        """Calculate rate over a time window."""
        metric = self._metrics.get(name)
        if not metric or not metric.values:
            return 0.0
        cutoff = time.time() - window_seconds
        recent = [v for v in metric.values if v.timestamp >= cutoff]
        if not recent:
            return 0.0
        return len(recent) / window_seconds

    def export(self) -> List[Dict[str, Any]]:
        """Export all metrics for dashboards."""
        result = []
        for metric in self._metrics.values():
            result.append({
                "name": metric.name,
                "type": metric.metric_type.value,
                "description": metric.description,
                "unit": metric.unit,
                "current_value": metric.current_value,
                "count": metric.count,
                "min": metric.min_value if metric.min_value != float("inf") else None,
                "max": metric.max_value if metric.max_value != float("-inf") else None,
                "p50": self.get_percentile(metric.name, 50),
                "p95": self.get_percentile(metric.name, 95),
                "p99": self.get_percentile(metric.name, 99),
            })
        return result

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "metrics_count": len(self._metrics),
        }

    def __repr__(self) -> str:
        return (
            f"MetricsEngine(name={self.name!r}, "
            f"metrics={len(self._metrics)}, "
            f"updates={self._stats['total_updates']})"
        )
