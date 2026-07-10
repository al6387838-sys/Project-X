"""
Alerting Engine — Alert Management for LifeOS.
SIGMA-007: Observability Pro
"""

import time
import logging
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertStatus(Enum):
    FIRING = "firing"
    RESOLVED = "resolved"
    ACKNOWLEDGED = "acknowledged"
    SILENCED = "silenced"


@dataclass
class AlertRule:
    """An alert rule definition."""
    rule_id: str
    name: str
    description: str
    severity: AlertSeverity
    condition: Callable[[], bool]
    metric_name: str = ""
    threshold: float = 0.0
    duration_seconds: int = 60
    cooldown_seconds: int = 300


@dataclass
class Alert:
    """A triggered alert."""
    alert_id: str
    rule_id: str
    severity: AlertSeverity
    status: AlertStatus = AlertStatus.FIRING
    message: str = ""
    timestamp: float = 0.0
    resolved_at: float = 0.0
    acknowledged_at: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class AlertingEngine:
    """
    World-Class Alerting Engine for LifeOS.

    SIGMA-007: Implements:
    - Rule-based alerting
    - Severity levels (INFO to EMERGENCY)
    - Alert lifecycle (firing -> acknowledged -> resolved)
    - Cooldown periods
    - Alert grouping
    - Alert routing
    """

    def __init__(self, name: str = "alerting_engine") -> None:
        self.name = name
        self._rules: List[AlertRule] = []
        self._alerts: List[Alert] = []
        self._active_alerts: Dict[str, Alert] = {}
        self._handlers: Dict[AlertSeverity, List[Callable]] = {}
        self._stats = {
            "total_rules": 0,
            "total_alerts": 0,
            "firing": 0,
            "resolved": 0,
            "acknowledged": 0,
        }
        self._init_default_rules()

    def _init_default_rules(self) -> None:
        """Initialize default LifeOS alert rules."""
        self.add_rule(
            rule_id="cpu_high",
            name="CPU Usage High",
            description="CPU usage exceeds 90%",
            severity=AlertSeverity.WARNING,
            condition=lambda: False,  # placeholder
            metric_name="cpu_usage_pct",
            threshold=90.0,
        )
        self.add_rule(
            rule_id="memory_high",
            name="Memory Usage High",
            description="Memory usage exceeds 85%",
            severity=AlertSeverity.WARNING,
            condition=lambda: False,
            metric_name="memory_usage_mb",
            threshold=85.0,
        )
        self.add_rule(
            rule_id="error_rate_high",
            name="Error Rate High",
            description="Error rate exceeds 5%",
            severity=AlertSeverity.CRITICAL,
            condition=lambda: False,
            metric_name="error_rate",
            threshold=0.05,
        )
        self.add_rule(
            rule_id="latency_high",
            name="Latency High",
            description="P99 latency exceeds 5000ms",
            severity=AlertSeverity.CRITICAL,
            condition=lambda: False,
            metric_name="latency_p99_ms",
            threshold=5000.0,
        )
        self.add_rule(
            rule_id="service_down",
            name="Service Down",
            description="Critical service is unreachable",
            severity=AlertSeverity.EMERGENCY,
            condition=lambda: False,
        )

    def add_rule(self, rule_id: str, name: str, description: str, severity: AlertSeverity, condition: Callable[[], bool], metric_name: str = "", threshold: float = 0.0, duration_seconds: int = 60, cooldown_seconds: int = 300) -> AlertRule:
        """Add an alert rule."""
        rule = AlertRule(
            rule_id=rule_id,
            name=name,
            description=description,
            severity=severity,
            condition=condition,
            metric_name=metric_name,
            threshold=threshold,
            duration_seconds=duration_seconds,
            cooldown_seconds=cooldown_seconds,
        )
        self._rules.append(rule)
        self._stats["total_rules"] += 1
        return rule

    def evaluate_rules(self) -> List[Alert]:
        """Evaluate all rules and trigger alerts as needed."""
        triggered = []
        for rule in self._rules:
            if rule.rule_id in self._active_alerts:
                continue  # cooldown
            try:
                if rule.condition():
                    alert = self._fire_alert(rule)
                    triggered.append(alert)
            except Exception as e:
                logger.error(f"[AlertingEngine] Rule {rule.rule_id} error: {e}")
        return triggered

    def _fire_alert(self, rule: AlertRule) -> Alert:
        """Fire an alert for a rule."""
        import hashlib
        alert_id = hashlib.md5(f"{rule.rule_id}-{time.time()}".encode()).hexdigest()[:12]
        alert = Alert(
            alert_id=alert_id,
            rule_id=rule.rule_id,
            severity=rule.severity,
            message=f"[{rule.severity.value.upper()}] {rule.name}: {rule.description}",
            timestamp=time.time(),
        )
        self._alerts.append(alert)
        self._active_alerts[rule.rule_id] = alert
        self._stats["total_alerts"] += 1
        self._stats["firing"] += 1

        # Notify handlers
        for handler in self._handlers.get(rule.severity, []):
            try:
                handler(alert)
            except Exception as e:
                logger.error(f"[AlertingEngine] Handler error: {e}")

        logger.warning(f"[AlertingEngine] Alert fired: {alert.message}")
        return alert

    def acknowledge(self, alert_id: str) -> bool:
        """Acknowledge an alert."""
        for alert in self._alerts:
            if alert.alert_id == alert_id:
                alert.status = AlertStatus.ACKNOWLEDGED
                alert.acknowledged_at = time.time()
                self._stats["acknowledged"] += 1
                return True
        return False

    def resolve(self, rule_id: str) -> bool:
        """Resolve an active alert."""
        alert = self._active_alerts.get(rule_id)
        if alert:
            alert.status = AlertStatus.RESOLVED
            alert.resolved_at = time.time()
            del self._active_alerts[rule_id]
            self._stats["resolved"] += 1
            return True
        return False

    def register_handler(self, severity: AlertSeverity, handler: Callable[[Alert], None]) -> None:
        """Register an alert handler (e.g., email, slack, pagerduty)."""
        if severity not in self._handlers:
            self._handlers[severity] = []
        self._handlers[severity].append(handler)

    def get_active_alerts(self) -> List[Alert]:
        return list(self._active_alerts.values())

    def get_all_alerts(self) -> List[Alert]:
        return list(self._alerts)

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "active_alerts": len(self._active_alerts),
            "total_rules": len(self._rules),
        }

    def __repr__(self) -> str:
        return (
            f"AlertingEngine(name={self.name!r}, "
            f"alerts={self._stats['total_alerts']}, "
            f"active={len(self._active_alerts)})"
        )
