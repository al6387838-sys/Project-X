"""
PerformanceDashboard — Central performance monitoring hub for LifeOS.

Aggregates metrics from:
- CPU Monitor
- Memory Monitor
- Latency Monitor
- Database Monitor
- Cache Manager
- Job Queue
- Task Scheduler

Provides:
- Unified health snapshot
- SLA compliance report
- Capacity planning metrics
- Alert management
- Export to JSON / Prometheus format
"""

import time
import json
import threading
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

from .cpu_monitor import CPUMonitor
from .memory_monitor import MemoryMonitor
from .latency_monitor import LatencyMonitor
from .database_monitor import DatabaseMonitor

logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    UNHEALTHY = "UNHEALTHY"
    UNKNOWN = "UNKNOWN"


@dataclass
class Alert:
    """A performance alert."""
    alert_id: str
    severity: str   # INFO | WARNING | CRITICAL
    component: str
    message: str
    value: Any
    threshold: Any
    ts: float = field(default_factory=time.monotonic)
    resolved: bool = False


class PerformanceDashboard:
    """
    Central performance monitoring dashboard for LifeOS.

    Collects metrics from all subsystems and provides a unified
    view of system health, SLA compliance, and capacity.
    """

    def __init__(
        self,
        cpu_monitor: Optional[CPUMonitor] = None,
        memory_monitor: Optional[MemoryMonitor] = None,
        latency_monitor: Optional[LatencyMonitor] = None,
        database_monitor: Optional[DatabaseMonitor] = None,
        cache_manager: Optional[Any] = None,
        job_queue: Optional[Any] = None,
        task_scheduler: Optional[Any] = None,
        name: str = "performance_dashboard",
    ) -> None:
        self.name = name
        self.cpu = cpu_monitor or CPUMonitor()
        self.memory = memory_monitor or MemoryMonitor()
        self.latency = latency_monitor or LatencyMonitor()
        self.database = database_monitor or DatabaseMonitor()
        self.cache = cache_manager
        self.job_queue = job_queue
        self.scheduler = task_scheduler
        self._alerts: List[Alert] = []
        self._lock = threading.Lock()
        self._start_time = time.monotonic()
        self._snapshot_history: List[Dict] = []
        self._max_history = 100

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start all monitors."""
        self.cpu.start()
        self.memory.start()
        logger.info("[PerformanceDashboard] All monitors started.")

    def stop(self) -> None:
        """Stop all monitors."""
        self.cpu.stop()
        self.memory.stop()
        logger.info("[PerformanceDashboard] All monitors stopped.")

    # ------------------------------------------------------------------
    # Health assessment
    # ------------------------------------------------------------------

    def health(self) -> Dict[str, Any]:
        """Return overall system health status."""
        components = {}
        overall = HealthStatus.HEALTHY

        # CPU
        cpu_stats = self.cpu.stats()
        cpu_pct = cpu_stats.get("current_cpu_pct")
        if cpu_pct is not None:
            if cpu_pct > 90:
                components["cpu"] = HealthStatus.UNHEALTHY.value
                overall = HealthStatus.UNHEALTHY
            elif cpu_pct > 70:
                components["cpu"] = HealthStatus.DEGRADED.value
                if overall == HealthStatus.HEALTHY:
                    overall = HealthStatus.DEGRADED
            else:
                components["cpu"] = HealthStatus.HEALTHY.value
        else:
            components["cpu"] = HealthStatus.UNKNOWN.value

        # Memory
        mem_risk = self.memory.oom_risk()
        mem_map = {
            "LOW": HealthStatus.HEALTHY,
            "MEDIUM": HealthStatus.DEGRADED,
            "HIGH": HealthStatus.UNHEALTHY,
            "CRITICAL": HealthStatus.UNHEALTHY,
            "UNKNOWN": HealthStatus.UNKNOWN,
        }
        mem_health = mem_map.get(mem_risk, HealthStatus.UNKNOWN)
        components["memory"] = mem_health.value
        if mem_health == HealthStatus.UNHEALTHY and overall != HealthStatus.UNHEALTHY:
            overall = HealthStatus.UNHEALTHY
        elif mem_health == HealthStatus.DEGRADED and overall == HealthStatus.HEALTHY:
            overall = HealthStatus.DEGRADED

        # Latency SLA
        sla = self.latency.sla_status()
        sla_breaches = sum(1 for ep in sla.values() if ep.get("status") == "BREACH")
        if sla_breaches > 0:
            components["latency"] = HealthStatus.DEGRADED.value
            if overall == HealthStatus.HEALTHY:
                overall = HealthStatus.DEGRADED
        else:
            components["latency"] = HealthStatus.HEALTHY.value

        # Cache
        if self.cache:
            cache_health = self.cache.health_check()
            all_up = all(cache_health.values())
            components["cache"] = HealthStatus.HEALTHY.value if all_up else HealthStatus.DEGRADED.value
        else:
            components["cache"] = HealthStatus.UNKNOWN.value

        # Job Queue
        if self.job_queue:
            dl = self.job_queue.dead_letter_count
            components["job_queue"] = HealthStatus.HEALTHY.value if dl < 100 else HealthStatus.DEGRADED.value
        else:
            components["job_queue"] = HealthStatus.UNKNOWN.value

        return {
            "overall": overall.value,
            "components": components,
            "uptime_s": round(time.monotonic() - self._start_time, 1),
            "ts": time.monotonic(),
        }

    # ------------------------------------------------------------------
    # Full snapshot
    # ------------------------------------------------------------------

    def snapshot(self) -> Dict[str, Any]:
        """Return a complete performance snapshot."""
        snap = {
            "ts": time.monotonic(),
            "health": self.health(),
            "cpu": self.cpu.stats(),
            "memory": self.memory.stats(),
            "latency": self.latency.stats(),
            "database": self.database.stats(),
        }
        if self.cache:
            snap["cache"] = self.cache.all_stats()
        if self.job_queue:
            snap["job_queue"] = self.job_queue.stats()
        if self.scheduler:
            snap["scheduler"] = self.scheduler.stats()

        with self._lock:
            self._snapshot_history.append(snap)
            if len(self._snapshot_history) > self._max_history:
                self._snapshot_history.pop(0)

        return snap

    # ------------------------------------------------------------------
    # SLA Report
    # ------------------------------------------------------------------

    def sla_report(self) -> Dict[str, Any]:
        """Generate a Sprint 027 SLA compliance report."""
        sla_status = self.latency.sla_status()
        targets = {
            "startup": {"target_ms": 2000, "description": "Application startup time"},
            "dashboard": {"target_ms": 500, "description": "Dashboard initial load"},
            "life_graph_search": {"target_ms": 300, "description": "Life Graph search"},
            "companion_response": {"target_ms": 1000, "description": "AI Companion response"},
        }
        report = {}
        for endpoint, target_info in targets.items():
            status = sla_status.get(endpoint, {})
            report[endpoint] = {
                **target_info,
                "p99_ms": status.get("p99_ms"),
                "compliance_pct": status.get("compliance_pct"),
                "apdex": status.get("apdex"),
                "status": status.get("status", "NO_DATA"),
            }
        return {
            "sprint": "027",
            "generated_at": time.monotonic(),
            "sla_targets": report,
            "overall_sla_met": all(
                v.get("status") in ("OK", "NO_DATA") for v in report.values()
            ),
        }

    # ------------------------------------------------------------------
    # Capacity planning
    # ------------------------------------------------------------------

    def capacity_estimate(self) -> Dict[str, Any]:
        """
        Estimate system capacity at various user scales.
        Based on current resource utilization.
        """
        cpu_stats = self.cpu.stats()
        mem_stats = self.memory.stats()
        cpu_pct = cpu_stats.get("current_cpu_pct") or cpu_stats.get("avg_cpu_pct") or 10.0
        mem_pct = mem_stats.get("system_pct") or 20.0

        # Headroom: how much more load can we absorb?
        cpu_headroom = max(0, 80 - cpu_pct) / 100.0
        mem_headroom = max(0, 80 - mem_pct) / 100.0
        headroom = min(cpu_headroom, mem_headroom)

        # Assume current load = 1 unit; scale linearly
        # (simplified; real capacity planning is more complex)
        scale_factor = 1 + headroom * 10

        return {
            "current_cpu_pct": round(cpu_pct, 1),
            "current_memory_pct": round(mem_pct, 1),
            "estimated_headroom_pct": round(headroom * 100, 1),
            "estimated_scale_factor": round(scale_factor, 1),
            "tiers": {
                "100k_users": {
                    "status": "READY" if scale_factor >= 1 else "NEEDS_SCALING",
                    "required_instances": 1,
                    "notes": "Single instance with caching",
                },
                "1m_users": {
                    "status": "READY" if scale_factor >= 2 else "NEEDS_SCALING",
                    "required_instances": max(1, round(10 / scale_factor)),
                    "notes": "Horizontal scaling + Redis cluster",
                },
                "10m_users": {
                    "status": "NEEDS_SCALING",
                    "required_instances": max(10, round(100 / scale_factor)),
                    "notes": "Multi-region + database sharding",
                },
                "100m_users": {
                    "status": "NEEDS_SCALING",
                    "required_instances": max(100, round(1000 / scale_factor)),
                    "notes": "Global CDN + microservices + event streaming",
                },
            },
        }

    # ------------------------------------------------------------------
    # Alerts
    # ------------------------------------------------------------------

    def add_alert(self, alert: Alert) -> None:
        with self._lock:
            self._alerts.append(alert)
            if len(self._alerts) > 1000:
                self._alerts = self._alerts[-1000:]

    def active_alerts(self) -> List[Dict]:
        with self._lock:
            return [
                {
                    "alert_id": a.alert_id,
                    "severity": a.severity,
                    "component": a.component,
                    "message": a.message,
                    "ts": a.ts,
                }
                for a in self._alerts
                if not a.resolved
            ]

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def to_json(self, indent: int = 2) -> str:
        """Export full snapshot as JSON string."""
        snap = self.snapshot()
        return json.dumps(snap, indent=indent, default=str)

    def to_prometheus(self) -> str:
        """Export key metrics in Prometheus text format."""
        snap = self.snapshot()
        lines = []
        cpu = snap.get("cpu", {})
        mem = snap.get("memory", {})

        if cpu.get("current_cpu_pct") is not None:
            lines.append(f'lifeos_cpu_usage_percent {cpu["current_cpu_pct"]}')
        if mem.get("system_pct") is not None:
            lines.append(f'lifeos_memory_usage_percent {mem["system_pct"]}')
        if mem.get("process_rss_mb") is not None:
            lines.append(f'lifeos_process_rss_mb {mem["process_rss_mb"]}')

        # Latency metrics
        lat = snap.get("latency", {})
        for ep, ep_stats in lat.get("endpoints", {}).items():
            ep_label = ep.replace("/", "_").replace("-", "_")
            if ep_stats.get("p99") is not None:
                lines.append(f'lifeos_latency_p99_ms{{endpoint="{ep_label}"}} {ep_stats["p99"]}')
            if ep_stats.get("apdex") is not None:
                lines.append(f'lifeos_apdex{{endpoint="{ep_label}"}} {ep_stats["apdex"]}')

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Display
    # ------------------------------------------------------------------

    def print_summary(self) -> None:
        """Print a human-readable performance summary."""
        snap = self.snapshot()
        health = snap["health"]
        print(f"\n{'='*60}")
        print(f"  LifeOS Performance Dashboard — Sprint 027")
        print(f"{'='*60}")
        print(f"  Overall Health: {health['overall']}")
        print(f"  Uptime: {health['uptime_s']:.0f}s")
        print()
        cpu = snap.get("cpu", {})
        mem = snap.get("memory", {})
        print(f"  CPU:    {cpu.get('current_cpu_pct', 'N/A')}% (avg {cpu.get('avg_cpu_pct', 'N/A')}%)")
        print(f"  Memory: {mem.get('system_pct', 'N/A')}% used | OOM Risk: {mem.get('oom_risk', 'N/A')}")
        print()
        sla = self.sla_report()
        print("  SLA Compliance:")
        for ep, data in sla["sla_targets"].items():
            status = data.get("status", "NO_DATA")
            p99 = data.get("p99_ms")
            target = data["target_ms"]
            p99_str = f"{p99:.0f}ms" if p99 else "N/A"
            print(f"    {ep:<25} target={target}ms  p99={p99_str}  [{status}]")
        print(f"{'='*60}\n")

    def __repr__(self) -> str:
        health = self.health()
        return f"PerformanceDashboard(name={self.name!r}, health={health['overall']!r})"
