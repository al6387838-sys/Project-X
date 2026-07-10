"""
Alert Models
============
Modelos para o sistema de alertas automáticos da LifeOS.

Suporta alertas de:
    - Receita (queda de MRR, churn elevado)
    - Usuários (queda de retenção, aumento de churn)
    - Performance (latência, error rate)
    - Segurança (tentativas de acesso, vulnerabilidades)
    - Disponibilidade (downtime, degradação)
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable
from enum import Enum
import uuid


class AlertSeverity(str, Enum):
    """Severidade do alerta."""
    INFO     = "info"
    WARNING  = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertType(str, Enum):
    """Categoria do alerta."""
    REVENUE     = "revenue"
    USERS       = "users"
    RETENTION   = "retention"
    PERFORMANCE = "performance"
    SECURITY    = "security"
    AVAILABILITY = "availability"
    GROWTH      = "growth"
    PRODUCT     = "product"


class AlertStatus(str, Enum):
    """Status do ciclo de vida do alerta."""
    ACTIVE       = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED     = "resolved"
    SUPPRESSED   = "suppressed"


@dataclass
class Alert:
    """
    Alerta automático do sistema.

    Gerado quando uma métrica cruza um threshold definido.
    Inclui contexto completo para diagnóstico e ação.
    """
    alert_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    alert_type: AlertType = AlertType.REVENUE
    severity: AlertSeverity = AlertSeverity.INFO
    title: str = ""
    message: str = ""
    metric_name: str = ""
    current_value: float = 0.0
    threshold_value: float = 0.0
    previous_value: float = 0.0
    change_pct: float = 0.0
    context: Dict[str, Any] = field(default_factory=dict)
    recommended_action: str = ""
    status: AlertStatus = AlertStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    acknowledged_by: str = ""

    def acknowledge(self, by: str = "system") -> None:
        self.status = AlertStatus.ACKNOWLEDGED
        self.acknowledged_at = datetime.utcnow()
        self.acknowledged_by = by

    def resolve(self) -> None:
        self.status = AlertStatus.RESOLVED
        self.resolved_at = datetime.utcnow()

    @property
    def age_minutes(self) -> float:
        return (datetime.utcnow() - self.created_at).total_seconds() / 60

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "alert_type": self.alert_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "metric_name": self.metric_name,
            "current_value": self.current_value,
            "threshold_value": self.threshold_value,
            "previous_value": self.previous_value,
            "change_pct": round(self.change_pct, 2),
            "recommended_action": self.recommended_action,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "age_minutes": round(self.age_minutes, 1),
            "context": self.context,
        }


@dataclass
class AlertRule:
    """
    Regra de alerta — define quando um alerta deve ser disparado.

    Compara o valor atual de uma métrica com um threshold
    usando um operador de comparação.
    """
    rule_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    alert_type: AlertType = AlertType.REVENUE
    severity: AlertSeverity = AlertSeverity.WARNING
    metric_name: str = ""
    operator: str = "lt"              # lt, gt, lte, gte, eq, change_pct
    threshold: float = 0.0
    change_threshold_pct: float = 0.0  # Para operator=change_pct
    message_template: str = ""
    recommended_action: str = ""
    is_enabled: bool = True
    cooldown_minutes: int = 60        # Evita spam de alertas
    last_triggered_at: Optional[datetime] = None

    def should_trigger(self, current_value: float, previous_value: Optional[float] = None) -> bool:
        """Verifica se a regra deve disparar um alerta."""
        if not self.is_enabled:
            return False

        # Cooldown
        if self.last_triggered_at:
            elapsed = (datetime.utcnow() - self.last_triggered_at).total_seconds() / 60
            if elapsed < self.cooldown_minutes:
                return False

        if self.operator == "lt":
            return current_value < self.threshold
        elif self.operator == "gt":
            return current_value > self.threshold
        elif self.operator == "lte":
            return current_value <= self.threshold
        elif self.operator == "gte":
            return current_value >= self.threshold
        elif self.operator == "eq":
            return current_value == self.threshold
        elif self.operator == "change_pct" and previous_value is not None and previous_value != 0:
            change = abs(current_value - previous_value) / abs(previous_value) * 100
            return change >= self.change_threshold_pct
        return False

    def build_alert(self, current_value: float, previous_value: float = 0.0) -> Alert:
        """Cria um Alert a partir desta regra."""
        change_pct = 0.0
        if previous_value != 0:
            change_pct = (current_value - previous_value) / abs(previous_value) * 100

        message = self.message_template.format(
            current=current_value,
            threshold=self.threshold,
            change_pct=round(change_pct, 1),
            previous=previous_value,
        )

        self.last_triggered_at = datetime.utcnow()

        return Alert(
            alert_type=self.alert_type,
            severity=self.severity,
            title=self.name,
            message=message,
            metric_name=self.metric_name,
            current_value=current_value,
            threshold_value=self.threshold,
            previous_value=previous_value,
            change_pct=change_pct,
            recommended_action=self.recommended_action,
        )
