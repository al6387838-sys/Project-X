"""
Integration Monitor — Universal Connector Platform
Real-time monitoring, alerting, and observability for all integrations.

Features:
  - Health checks for all active integrations
  - Latency and error rate tracking
  - SLA monitoring
  - Automated alerts and escalation
  - Metrics aggregation
  - Audit log
"""

from __future__ import annotations
import asyncio
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Deque, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class MetricType(Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


# ─────────────────────────────────────────────
# Data Classes
# ─────────────────────────────────────────────

class Metric:
    def __init__(self, name: str, value: float, metric_type: MetricType,
                 labels: Dict[str, str] = None, timestamp: datetime = None):
        self.name = name
        self.value = value
        self.metric_type = metric_type
        self.labels = labels or {}
        self.timestamp = timestamp or datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "type": self.metric_type.value,
            "labels": self.labels,
            "timestamp": self.timestamp.isoformat(),
        }


class Alert:
    def __init__(self, alert_id: str, severity: AlertSeverity, title: str,
                 message: str, connector_id: str = None, integration_id: str = None):
        self.alert_id = alert_id
        self.severity = severity
        self.title = title
        self.message = message
        self.connector_id = connector_id
        self.integration_id = integration_id
        self.created_at = datetime.now(timezone.utc)
        self.resolved_at: Optional[datetime] = None
        self.acknowledged = False

    def resolve(self):
        self.resolved_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "connector_id": self.connector_id,
            "integration_id": self.integration_id,
            "created_at": self.created_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "acknowledged": self.acknowledged,
        }


class AuditEvent:
    def __init__(self, event_type: str, user_id: str, connector_id: str,
                 details: Dict[str, Any] = None, ip_address: str = None):
        self.event_id = f"audit_{datetime.now(timezone.utc).timestamp():.6f}"
        self.event_type = event_type
        self.user_id = user_id
        self.connector_id = connector_id
        self.details = details or {}
        self.ip_address = ip_address
        self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "user_id": self.user_id,
            "connector_id": self.connector_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat(),
        }


# ─────────────────────────────────────────────
# Integration Monitor
# ─────────────────────────────────────────────

class IntegrationMonitor:
    """
    Real-time monitoring system for LifeOS integrations.

    Tracks:
      - Sync success/failure rates
      - API latency per connector
      - Token expiry warnings
      - Webhook delivery rates
      - Error patterns and anomalies
      - SLA compliance
    """

    def __init__(self):
        # Metrics storage: integration_id → list of Metric
        self._metrics: Dict[str, Deque[Metric]] = defaultdict(lambda: deque(maxlen=1000))
        # Global metrics
        self._global_metrics: Deque[Metric] = deque(maxlen=5000)
        # Alerts
        self._alerts: Dict[str, Alert] = {}
        self._active_alerts: List[str] = []
        # Audit log
        self._audit_log: Deque[AuditEvent] = deque(maxlen=10000)
        # Health check results: integration_id → bool
        self._health_checks: Dict[str, Tuple[bool, datetime]] = {}
        # Error counters: integration_id → count
        self._error_counters: Dict[str, int] = defaultdict(int)
        # Latency buckets: connector_id → list of ms
        self._latency_buckets: Dict[str, Deque[float]] = defaultdict(lambda: deque(maxlen=500))
        # Alert handlers
        self._alert_handlers: List[Callable[[Alert], None]] = []
        # SLA thresholds
        self._sla_thresholds = {
            "max_error_rate": 0.05,       # 5% error rate
            "max_latency_ms": 5000,        # 5 seconds
            "min_uptime": 0.99,            # 99% uptime
            "max_sync_delay_minutes": 30,  # 30 minutes max delay
        }
        self._initialized_at = datetime.now(timezone.utc)
        logger.info("[IntegrationMonitor] Initialized")

    # ── Metrics Recording ─────────────────────

    def record_sync(self, integration_id: str, connector_id: str,
                    success: bool, records: int, duration_ms: float):
        """Record a sync operation result."""
        ts = datetime.now(timezone.utc)
        labels = {"connector_id": connector_id, "integration_id": integration_id}

        self._metrics[integration_id].append(
            Metric("sync_records", records, MetricType.COUNTER, labels, ts)
        )
        self._metrics[integration_id].append(
            Metric("sync_success", 1.0 if success else 0.0, MetricType.GAUGE, labels, ts)
        )
        self._metrics[integration_id].append(
            Metric("sync_duration_ms", duration_ms, MetricType.TIMER, labels, ts)
        )
        self._latency_buckets[connector_id].append(duration_ms)

        if not success:
            self._error_counters[integration_id] += 1
            self._check_error_threshold(integration_id, connector_id)

        self._global_metrics.append(
            Metric("global_sync_total", 1.0, MetricType.COUNTER,
                   {"connector_id": connector_id, "success": str(success)}, ts)
        )

    def record_api_call(self, connector_id: str, endpoint: str,
                        status_code: int, duration_ms: float):
        """Record an API call."""
        labels = {"connector_id": connector_id, "endpoint": endpoint, "status": str(status_code)}
        self._global_metrics.append(
            Metric("api_call_duration_ms", duration_ms, MetricType.TIMER, labels)
        )
        self._latency_buckets[connector_id].append(duration_ms)
        if status_code >= 500:
            self._fire_alert(
                severity=AlertSeverity.WARNING,
                title=f"API Error: {connector_id}",
                message=f"HTTP {status_code} on {endpoint} ({duration_ms:.0f}ms)",
                connector_id=connector_id,
            )

    def record_webhook_delivery(self, webhook_id: str, success: bool, duration_ms: float):
        """Record webhook delivery result."""
        labels = {"webhook_id": webhook_id, "success": str(success)}
        self._global_metrics.append(
            Metric("webhook_delivery", 1.0 if success else 0.0, MetricType.GAUGE, labels)
        )

    def record_token_refresh(self, integration_id: str, connector_id: str, success: bool):
        """Record token refresh result."""
        if not success:
            self._fire_alert(
                severity=AlertSeverity.ERROR,
                title=f"Token Refresh Failed: {connector_id}",
                message=f"Failed to refresh OAuth token for integration {integration_id}",
                connector_id=connector_id,
                integration_id=integration_id,
            )

    def record_token_expiry_warning(self, integration_id: str, connector_id: str,
                                    expires_in_minutes: int):
        """Warn about upcoming token expiry."""
        if expires_in_minutes <= 5:
            self._fire_alert(
                severity=AlertSeverity.WARNING,
                title=f"Token Expiring Soon: {connector_id}",
                message=f"Token expires in {expires_in_minutes} minutes",
                connector_id=connector_id,
                integration_id=integration_id,
            )

    # ── Health Checks ─────────────────────────

    async def run_health_check(self, integration_id: str, connector) -> bool:
        """Run health check for a connector."""
        start = time.monotonic()
        try:
            healthy = await connector.test_connection()
            duration_ms = (time.monotonic() - start) * 1000
            self._health_checks[integration_id] = (healthy, datetime.now(timezone.utc))
            self.record_api_call(
                connector.manifest.connector_id,
                "/health_check",
                200 if healthy else 503,
                duration_ms,
            )
            return healthy
        except Exception as e:
            self._health_checks[integration_id] = (False, datetime.now(timezone.utc))
            self._fire_alert(
                severity=AlertSeverity.ERROR,
                title=f"Health Check Failed: {integration_id}",
                message=str(e),
                integration_id=integration_id,
            )
            return False

    async def run_all_health_checks(self, connectors: Dict[str, Any]) -> Dict[str, bool]:
        """Run health checks for all connectors concurrently."""
        tasks = {
            iid: self.run_health_check(iid, connector)
            for iid, connector in connectors.items()
        }
        results = {}
        for iid, coro in tasks.items():
            results[iid] = await coro
        return results

    # ── Alerts ────────────────────────────────

    def _fire_alert(self, severity: AlertSeverity, title: str, message: str,
                    connector_id: str = None, integration_id: str = None):
        """Fire an alert."""
        alert_id = f"alert_{datetime.now(timezone.utc).timestamp():.6f}"
        alert = Alert(alert_id, severity, title, message, connector_id, integration_id)
        self._alerts[alert_id] = alert
        self._active_alerts.append(alert_id)
        logger.warning(f"[Monitor] ALERT [{severity.value.upper()}] {title}: {message}")
        for handler in self._alert_handlers:
            try:
                handler(alert)
            except Exception as e:
                logger.error(f"[Monitor] Alert handler error: {e}")

    def _check_error_threshold(self, integration_id: str, connector_id: str):
        """Check if error rate exceeds SLA threshold."""
        errors = self._error_counters[integration_id]
        if errors >= 5:
            self._fire_alert(
                severity=AlertSeverity.ERROR,
                title=f"High Error Rate: {connector_id}",
                message=f"Integration {integration_id} has {errors} consecutive errors",
                connector_id=connector_id,
                integration_id=integration_id,
            )

    def add_alert_handler(self, handler: Callable[[Alert], None]):
        """Register an alert handler (e.g., Slack notification, email)."""
        self._alert_handlers.append(handler)

    def resolve_alert(self, alert_id: str):
        """Resolve an active alert."""
        if alert_id in self._alerts:
            self._alerts[alert_id].resolve()
            if alert_id in self._active_alerts:
                self._active_alerts.remove(alert_id)

    def acknowledge_alert(self, alert_id: str):
        if alert_id in self._alerts:
            self._alerts[alert_id].acknowledged = True

    def get_active_alerts(self) -> List[Alert]:
        return [self._alerts[aid] for aid in self._active_alerts if aid in self._alerts]

    # ── Audit Log ─────────────────────────────

    def audit(self, event_type: str, user_id: str, connector_id: str,
              details: Dict[str, Any] = None, ip_address: str = None):
        """Record an audit event."""
        event = AuditEvent(event_type, user_id, connector_id, details, ip_address)
        self._audit_log.append(event)
        logger.info(f"[Audit] {event_type} user={user_id} connector={connector_id}")

    def get_audit_log(self, user_id: str = None, connector_id: str = None,
                      limit: int = 100) -> List[AuditEvent]:
        """Query audit log with optional filters."""
        events = list(self._audit_log)
        if user_id:
            events = [e for e in events if e.user_id == user_id]
        if connector_id:
            events = [e for e in events if e.connector_id == connector_id]
        return events[-limit:]

    # ── Metrics Queries ───────────────────────

    def get_connector_metrics(self, integration_id: str) -> Dict[str, Any]:
        """Get aggregated metrics for a specific integration."""
        metrics = list(self._metrics.get(integration_id, []))
        if not metrics:
            return {"integration_id": integration_id, "no_data": True}

        sync_metrics = [m for m in metrics if m.name == "sync_success"]
        duration_metrics = [m for m in metrics if m.name == "sync_duration_ms"]
        record_metrics = [m for m in metrics if m.name == "sync_records"]

        success_rate = (
            sum(m.value for m in sync_metrics) / len(sync_metrics) * 100
            if sync_metrics else 0
        )
        avg_duration = (
            sum(m.value for m in duration_metrics) / len(duration_metrics)
            if duration_metrics else 0
        )
        total_records = sum(m.value for m in record_metrics)

        health_result = self._health_checks.get(integration_id)
        return {
            "integration_id": integration_id,
            "success_rate_pct": round(success_rate, 1),
            "avg_sync_duration_ms": round(avg_duration, 1),
            "total_records_synced": int(total_records),
            "error_count": self._error_counters.get(integration_id, 0),
            "last_health_check": {
                "healthy": health_result[0] if health_result else None,
                "checked_at": health_result[1].isoformat() if health_result else None,
            },
            "sla_compliant": success_rate >= (1 - self._sla_thresholds["max_error_rate"]) * 100,
        }

    def get_latency_percentiles(self, connector_id: str) -> Dict[str, float]:
        """Get latency percentiles for a connector."""
        latencies = sorted(self._latency_buckets.get(connector_id, []))
        if not latencies:
            return {}
        n = len(latencies)
        return {
            "p50_ms": latencies[int(n * 0.50)],
            "p75_ms": latencies[int(n * 0.75)],
            "p90_ms": latencies[int(n * 0.90)],
            "p95_ms": latencies[int(n * 0.95)],
            "p99_ms": latencies[int(n * 0.99)] if n >= 100 else latencies[-1],
            "max_ms": latencies[-1],
            "min_ms": latencies[0],
            "sample_count": n,
        }

    def get_health_report(self) -> Dict[str, Any]:
        """Get overall health report for all integrations."""
        total = len(self._health_checks)
        healthy = sum(1 for h, _ in self._health_checks.values() if h)
        active_alerts = self.get_active_alerts()

        return {
            "overall_status": "healthy" if healthy == total and not active_alerts else
                              "degraded" if healthy > total // 2 else "unhealthy",
            "total_integrations": total,
            "healthy_integrations": healthy,
            "unhealthy_integrations": total - healthy,
            "uptime_pct": round(healthy / max(total, 1) * 100, 1),
            "active_alerts": len(active_alerts),
            "critical_alerts": sum(1 for a in active_alerts if a.severity == AlertSeverity.CRITICAL),
            "error_alerts": sum(1 for a in active_alerts if a.severity == AlertSeverity.ERROR),
            "warning_alerts": sum(1 for a in active_alerts if a.severity == AlertSeverity.WARNING),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def get_global_stats(self) -> Dict[str, Any]:
        """Get global platform statistics."""
        total_syncs = sum(
            1 for m in self._global_metrics
            if m.name == "global_sync_total"
        )
        successful_syncs = sum(
            1 for m in self._global_metrics
            if m.name == "global_sync_total" and m.labels.get("success") == "True"
        )
        return {
            "total_syncs": total_syncs,
            "successful_syncs": successful_syncs,
            "success_rate_pct": round(successful_syncs / max(total_syncs, 1) * 100, 1),
            "total_alerts_fired": len(self._alerts),
            "active_alerts": len(self._active_alerts),
            "audit_events": len(self._audit_log),
            "monitored_integrations": len(self._health_checks),
            "uptime_since": self._initialized_at.isoformat(),
        }
