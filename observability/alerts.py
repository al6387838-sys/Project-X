"""
LifeOS Alert Manager
=====================
Rule-based alerting for LifeOS V1.0 RC.
Integrates with security events, performance thresholds, and system health.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
import uuid


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"
    SILENCED = "silenced"


@dataclass
class AlertRule:
    name: str
    description: str
    severity: AlertSeverity
    condition: Callable[..., bool]
    message_template: str
    cooldown_seconds: int = 300  # 5 minutes default


@dataclass
class Alert:
    alert_id: str = field(default_factory=lambda: f"ALT-{uuid.uuid4().hex[:8].upper()}")
    rule_name: str = ""
    severity: AlertSeverity = AlertSeverity.INFO
    message: str = ""
    status: AlertStatus = AlertStatus.ACTIVE
    fired_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resolved_at: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class AlertManager:
    """
    Manages alert rules, firing, and resolution for LifeOS.
    """

    def __init__(self):
        self._rules: Dict[str, AlertRule] = {}
        self._active_alerts: List[Alert] = []
        self._alert_history: List[Alert] = []
        self._last_fired: Dict[str, float] = {}
        self._handlers: List[Callable[[Alert], None]] = []

        # Register default rules
        self._register_default_rules()

    def _register_default_rules(self):
        """Register built-in alert rules."""
        import time

        self.register_rule(AlertRule(
            name="high_error_rate",
            description="Error rate exceeds threshold",
            severity=AlertSeverity.CRITICAL,
            condition=lambda errors, total: (errors / max(total, 1)) > 0.05,
            message_template="High error rate: {errors}/{total} ({rate:.1%})",
        ))

        self.register_rule(AlertRule(
            name="decision_latency_high",
            description="Decision engine P95 latency exceeds 100ms",
            severity=AlertSeverity.WARNING,
            condition=lambda p95_ms: p95_ms > 100,
            message_template="Decision latency P95={p95_ms:.1f}ms exceeds 100ms threshold",
        ))

        self.register_rule(AlertRule(
            name="offline_queue_overflow",
            description="Offline queue exceeds 1000 operations",
            severity=AlertSeverity.WARNING,
            condition=lambda queue_size: queue_size > 1000,
            message_template="Offline queue size={queue_size} exceeds 1000 operations",
        ))

        self.register_rule(AlertRule(
            name="security_brute_force",
            description="Brute force attack detected",
            severity=AlertSeverity.CRITICAL,
            condition=lambda failed_attempts: failed_attempts >= 5,
            message_template="Brute force detected: {failed_attempts} failed attempts",
            cooldown_seconds=60,
        ))

        self.register_rule(AlertRule(
            name="sync_failure",
            description="Cloud sync failure detected",
            severity=AlertSeverity.WARNING,
            condition=lambda consecutive_failures: consecutive_failures >= 3,
            message_template="Cloud sync failed {consecutive_failures} consecutive times",
        ))

    def register_rule(self, rule: AlertRule):
        """Register a new alert rule."""
        self._rules[rule.name] = rule

    def add_handler(self, handler: Callable[[Alert], None]):
        """Add a callback for when alerts are fired."""
        self._handlers.append(handler)

    def check(self, rule_name: str, **kwargs) -> Optional[Alert]:
        """Evaluate a rule and fire an alert if condition is met."""
        import time

        rule = self._rules.get(rule_name)
        if not rule:
            return None

        # Check cooldown
        last = self._last_fired.get(rule_name, 0)
        if time.time() - last < rule.cooldown_seconds:
            return None

        try:
            if rule.condition(**kwargs):
                alert = Alert(
                    rule_name=rule_name,
                    severity=rule.severity,
                    message=rule.message_template.format(**kwargs),
                    metadata=kwargs,
                )
                self._active_alerts.append(alert)
                self._last_fired[rule_name] = time.time()

                for handler in self._handlers:
                    try:
                        handler(alert)
                    except Exception:
                        pass

                return alert
        except Exception:
            pass

        return None

    def resolve(self, rule_name: str) -> bool:
        """Resolve all active alerts for a rule."""
        resolved = False
        for alert in self._active_alerts[:]:
            if alert.rule_name == rule_name and alert.status == AlertStatus.ACTIVE:
                alert.status = AlertStatus.RESOLVED
                alert.resolved_at = datetime.now(timezone.utc).isoformat()
                self._active_alerts.remove(alert)
                self._alert_history.append(alert)
                resolved = True
        return resolved

    def get_active_alerts(self, severity: Optional[AlertSeverity] = None) -> List[Alert]:
        """Get all active alerts, optionally filtered by severity."""
        if severity:
            return [a for a in self._active_alerts if a.severity == severity]
        return list(self._active_alerts)

    def get_history(self, limit: int = 100) -> List[Alert]:
        """Get alert history."""
        return self._alert_history[-limit:]

    def summary(self) -> Dict[str, Any]:
        """Return alert summary."""
        return {
            "active_total": len(self._active_alerts),
            "active_critical": len([a for a in self._active_alerts if a.severity == AlertSeverity.CRITICAL]),
            "active_warning": len([a for a in self._active_alerts if a.severity == AlertSeverity.WARNING]),
            "history_total": len(self._alert_history),
            "rules_registered": len(self._rules),
        }


# Global alert manager instance
alert_manager = AlertManager()
