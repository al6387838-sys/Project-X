"""
Auto Monitor
============
Motor de monitoramento automático da LifeOS.

Avalia continuamente as métricas do negócio e dispara alertas
quando thresholds são ultrapassados. Cobre:

    Receita     — queda de MRR, churn elevado, queda de receita
    Usuários    — queda de retenção, aumento de churn
    Performance — latência elevada, error rate alto
    Segurança   — anomalias de acesso, vulnerabilidades
    Disponibilidade — downtime, degradação de serviços
"""

from typing import Dict, List, Any, Optional
from datetime import datetime

from ..models.alerts import Alert, AlertRule, AlertSeverity, AlertType, AlertStatus
from ..models.health_scores import (
    BusinessHealthScore, GrowthScore, ProductHealthScore,
    CustomerHealthScore, PlatformHealthScore, CompanyHealthSnapshot
)
from .metrics_collector import MetricsCollector


# ─────────────────────────────────────────────────────────────────────────────
# Regras de alerta padrão da LifeOS
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_ALERT_RULES: List[AlertRule] = [

    # ── Receita ──────────────────────────────────────────────────────────────
    AlertRule(
        name="Queda de MRR > 5%",
        alert_type=AlertType.REVENUE,
        severity=AlertSeverity.CRITICAL,
        metric_name="mrr",
        operator="change_pct",
        change_threshold_pct=5.0,
        message_template="MRR caiu {change_pct:.1f}% (de R$ {previous:,.2f} para R$ {current:,.2f}).",
        recommended_action="Investigar churn recente. Verificar falhas de cobrança e cancelamentos.",
        cooldown_minutes=120,
    ),
    AlertRule(
        name="Churn Mensal > 8%",
        alert_type=AlertType.REVENUE,
        severity=AlertSeverity.CRITICAL,
        metric_name="monthly_churn_pct",
        operator="gt",
        threshold=8.0,
        message_template="Churn mensal atingiu {current:.1f}% (threshold: {threshold:.1f}%).",
        recommended_action="Ativar campanhas de retenção. Analisar cohorts com maior churn.",
        cooldown_minutes=240,
    ),
    AlertRule(
        name="Churn Mensal > 5%",
        alert_type=AlertType.REVENUE,
        severity=AlertSeverity.WARNING,
        metric_name="monthly_churn_pct",
        operator="gt",
        threshold=5.0,
        message_template="Churn mensal em {current:.1f}% (threshold: {threshold:.1f}%).",
        recommended_action="Revisar onboarding e campanhas de engajamento.",
        cooldown_minutes=120,
    ),

    # ── Retenção ─────────────────────────────────────────────────────────────
    AlertRule(
        name="Retenção D30 < 15%",
        alert_type=AlertType.RETENTION,
        severity=AlertSeverity.CRITICAL,
        metric_name="d30_retention_pct",
        operator="lt",
        threshold=15.0,
        message_template="Retenção D30 caiu para {current:.1f}% (threshold: {threshold:.1f}%).",
        recommended_action="Revisar Aha Moment e onboarding. Analisar drop-off no funil.",
        cooldown_minutes=240,
    ),
    AlertRule(
        name="Retenção D30 < 20%",
        alert_type=AlertType.RETENTION,
        severity=AlertSeverity.WARNING,
        metric_name="d30_retention_pct",
        operator="lt",
        threshold=20.0,
        message_template="Retenção D30 em {current:.1f}% (threshold: {threshold:.1f}%).",
        recommended_action="Revisar campanhas de engajamento e notificações push.",
        cooldown_minutes=120,
    ),

    # ── Usuários ─────────────────────────────────────────────────────────────
    AlertRule(
        name="Queda de Novos Usuários > 20%",
        alert_type=AlertType.USERS,
        severity=AlertSeverity.WARNING,
        metric_name="new_signups_30d",
        operator="change_pct",
        change_threshold_pct=20.0,
        message_template="Novos cadastros caíram {change_pct:.1f}% (de {previous:.0f} para {current:.0f}).",
        recommended_action="Verificar canais de aquisição. Revisar campanhas pagas.",
        cooldown_minutes=120,
    ),

    # ── Performance ──────────────────────────────────────────────────────────
    AlertRule(
        name="Latência P95 > 2000ms",
        alert_type=AlertType.PERFORMANCE,
        severity=AlertSeverity.CRITICAL,
        metric_name="p95_latency_ms",
        operator="gt",
        threshold=2000.0,
        message_template="Latência P95 atingiu {current:.0f}ms (threshold: {threshold:.0f}ms).",
        recommended_action="Verificar banco de dados e serviços externos. Escalar se necessário.",
        cooldown_minutes=30,
    ),
    AlertRule(
        name="Latência P95 > 1000ms",
        alert_type=AlertType.PERFORMANCE,
        severity=AlertSeverity.WARNING,
        metric_name="p95_latency_ms",
        operator="gt",
        threshold=1000.0,
        message_template="Latência P95 em {current:.0f}ms (threshold: {threshold:.0f}ms).",
        recommended_action="Monitorar tendência. Verificar queries lentas.",
        cooldown_minutes=60,
    ),
    AlertRule(
        name="Taxa de Erros > 2%",
        alert_type=AlertType.PERFORMANCE,
        severity=AlertSeverity.CRITICAL,
        metric_name="error_rate_pct",
        operator="gt",
        threshold=2.0,
        message_template="Taxa de erros atingiu {current:.2f}% (threshold: {threshold:.1f}%).",
        recommended_action="Verificar logs de erro. Identificar endpoints com falha.",
        cooldown_minutes=30,
    ),
    AlertRule(
        name="Taxa de Erros > 0.5%",
        alert_type=AlertType.PERFORMANCE,
        severity=AlertSeverity.WARNING,
        metric_name="error_rate_pct",
        operator="gt",
        threshold=0.5,
        message_template="Taxa de erros em {current:.2f}% (threshold: {threshold:.1f}%).",
        recommended_action="Monitorar tendência. Verificar deploys recentes.",
        cooldown_minutes=60,
    ),

    # ── Disponibilidade ───────────────────────────────────────────────────────
    AlertRule(
        name="Uptime < 99.9% (SLA Violado)",
        alert_type=AlertType.AVAILABILITY,
        severity=AlertSeverity.EMERGENCY,
        metric_name="uptime_pct",
        operator="lt",
        threshold=99.9,
        message_template="Uptime caiu para {current:.3f}% — SLA violado (threshold: {threshold:.1f}%).",
        recommended_action="INCIDENTE CRÍTICO: Acionar on-call. Iniciar runbook de incidente.",
        cooldown_minutes=15,
    ),
    AlertRule(
        name="Uptime < 99.5%",
        alert_type=AlertType.AVAILABILITY,
        severity=AlertSeverity.CRITICAL,
        metric_name="uptime_pct",
        operator="lt",
        threshold=99.5,
        message_template="Uptime em {current:.3f}% (threshold: {threshold:.1f}%).",
        recommended_action="Verificar infraestrutura. Preparar comunicado de status.",
        cooldown_minutes=30,
    ),

    # ── Segurança ─────────────────────────────────────────────────────────────
    AlertRule(
        name="Score de Segurança < 60",
        alert_type=AlertType.SECURITY,
        severity=AlertSeverity.CRITICAL,
        metric_name="security_score",
        operator="lt",
        threshold=60.0,
        message_template="Score de segurança caiu para {current:.0f} (threshold: {threshold:.0f}).",
        recommended_action="Revisar vulnerabilidades. Acionar time de segurança.",
        cooldown_minutes=60,
    ),

    # ── Crescimento ───────────────────────────────────────────────────────────
    AlertRule(
        name="LTV/CAC < 1.5",
        alert_type=AlertType.GROWTH,
        severity=AlertSeverity.CRITICAL,
        metric_name="ltv_cac_ratio",
        operator="lt",
        threshold=1.5,
        message_template="LTV/CAC caiu para {current:.2f}x (threshold: {threshold:.1f}x).",
        recommended_action="Revisar CAC por canal. Otimizar conversão e retenção.",
        cooldown_minutes=240,
    ),
    AlertRule(
        name="LTV/CAC < 2.5",
        alert_type=AlertType.GROWTH,
        severity=AlertSeverity.WARNING,
        metric_name="ltv_cac_ratio",
        operator="lt",
        threshold=2.5,
        message_template="LTV/CAC em {current:.2f}x (threshold: {threshold:.1f}x).",
        recommended_action="Monitorar unit economics. Revisar eficiência de aquisição.",
        cooldown_minutes=120,
    ),
]


class AutoMonitor:
    """
    Monitor automático da LifeOS.

    Avalia métricas em tempo real e dispara alertas
    quando thresholds são ultrapassados.

    Uso:
        monitor = AutoMonitor()
        monitor.add_rules(DEFAULT_ALERT_RULES)
        alerts = monitor.evaluate(metrics_dict)
    """

    def __init__(self):
        self._rules: List[AlertRule] = []
        self._active_alerts: List[Alert] = []
        self._alert_history: List[Alert] = []
        self._collector = MetricsCollector()
        self._last_evaluation: Optional[datetime] = None

    def add_rules(self, rules: List[AlertRule]) -> None:
        """Adiciona regras de alerta."""
        self._rules.extend(rules)

    def add_rule(self, rule: AlertRule) -> None:
        """Adiciona uma regra de alerta individual."""
        self._rules.append(rule)

    def load_default_rules(self) -> None:
        """Carrega as regras de alerta padrão da LifeOS."""
        import copy
        self._rules = [copy.deepcopy(r) for r in DEFAULT_ALERT_RULES]

    def evaluate(self, metrics: Dict[str, float]) -> List[Alert]:
        """
        Avalia as métricas contra todas as regras ativas.

        Retorna a lista de novos alertas disparados.
        """
        # Registra as métricas no collector
        for name, value in metrics.items():
            self._collector.record(name, value)

        new_alerts = []

        for rule in self._rules:
            if not rule.is_enabled:
                continue

            current = metrics.get(rule.metric_name)
            if current is None:
                continue

            previous = self._collector.get_previous(rule.metric_name)

            if rule.should_trigger(current, previous):
                alert = rule.build_alert(
                    current_value=current,
                    previous_value=previous or 0.0,
                )
                new_alerts.append(alert)
                self._active_alerts.append(alert)
                self._alert_history.append(alert)

        self._last_evaluation = datetime.utcnow()
        return new_alerts

    def evaluate_health_snapshot(self, snapshot: CompanyHealthSnapshot) -> List[Alert]:
        """
        Avalia um CompanyHealthSnapshot e gera alertas para áreas críticas.
        """
        alerts = []

        checks = [
            ("Negócio", snapshot.business.score, snapshot.business.status),
            ("Crescimento", snapshot.growth.score, snapshot.growth.status),
            ("Produto", snapshot.product.score, snapshot.product.status),
            ("Clientes", snapshot.customer.score, snapshot.customer.status),
            ("Plataforma", snapshot.platform.score, snapshot.platform.status),
        ]

        for area_name, score, status in checks:
            from ..models.health_scores import HealthStatus
            if status == HealthStatus.CRITICAL:
                alert = Alert(
                    alert_type=AlertType.PRODUCT,
                    severity=AlertSeverity.CRITICAL,
                    title=f"Health Score Crítico: {area_name}",
                    message=f"O Health Score de {area_name} está em {score:.1f}/100 (CRITICAL).",
                    metric_name=f"health_score_{area_name.lower()}",
                    current_value=score,
                    threshold_value=40.0,
                    recommended_action=f"Revisar métricas de {area_name} imediatamente.",
                )
                alerts.append(alert)
                self._active_alerts.append(alert)
            elif status == HealthStatus.WARNING:
                alert = Alert(
                    alert_type=AlertType.PRODUCT,
                    severity=AlertSeverity.WARNING,
                    title=f"Health Score em Atenção: {area_name}",
                    message=f"O Health Score de {area_name} está em {score:.1f}/100 (WARNING).",
                    metric_name=f"health_score_{area_name.lower()}",
                    current_value=score,
                    threshold_value=60.0,
                    recommended_action=f"Monitorar métricas de {area_name} de perto.",
                )
                alerts.append(alert)
                self._active_alerts.append(alert)

        return alerts

    def get_active_alerts(
        self,
        severity: Optional[AlertSeverity] = None,
        alert_type: Optional[AlertType] = None,
    ) -> List[Alert]:
        """Retorna alertas ativos, com filtros opcionais."""
        alerts = [a for a in self._active_alerts if a.status == AlertStatus.ACTIVE]

        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        if alert_type:
            alerts = [a for a in alerts if a.alert_type == alert_type]

        return sorted(alerts, key=lambda a: a.created_at, reverse=True)

    def acknowledge_alert(self, alert_id: str, by: str = "system") -> bool:
        """Reconhece um alerta pelo ID."""
        for alert in self._active_alerts:
            if alert.alert_id == alert_id:
                alert.acknowledge(by)
                return True
        return False

    def resolve_alert(self, alert_id: str) -> bool:
        """Resolve um alerta pelo ID."""
        for alert in self._active_alerts:
            if alert.alert_id == alert_id:
                alert.resolve()
                return True
        return False

    def get_alert_summary(self) -> Dict[str, Any]:
        """Resumo dos alertas ativos."""
        active = self.get_active_alerts()
        by_severity = {s.value: 0 for s in AlertSeverity}
        by_type = {t.value: 0 for t in AlertType}

        for alert in active:
            by_severity[alert.severity.value] += 1
            by_type[alert.alert_type.value] += 1

        return {
            "total_active": len(active),
            "by_severity": by_severity,
            "by_type": by_type,
            "last_evaluation": self._last_evaluation.isoformat() if self._last_evaluation else None,
            "total_rules": len(self._rules),
            "active_rules": sum(1 for r in self._rules if r.is_enabled),
            "critical_alerts": [
                a.to_dict() for a in active
                if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)
            ],
        }
