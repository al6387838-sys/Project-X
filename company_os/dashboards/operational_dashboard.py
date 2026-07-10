"""
Operational Dashboard
=====================
Dashboard operacional da LifeOS para times de engenharia e operações.

Foca em performance, disponibilidade, segurança e saúde técnica
da plataforma em tempo real.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

from ..models.health_scores import PlatformHealthScore, HealthStatus
from ..models.alerts import Alert, AlertSeverity, AlertType


class OperationalDashboard:
    """
    Dashboard operacional da LifeOS.

    Monitora a saúde técnica da plataforma:
    - Disponibilidade e uptime
    - Performance (latência, throughput)
    - Taxa de erros
    - Segurança
    - Incidentes ativos
    """

    def __init__(self):
        self._platform_health: Optional[PlatformHealthScore] = None
        self._active_alerts: List[Alert] = []
        self._incident_history: List[Dict[str, Any]] = []
        self._service_statuses: Dict[str, str] = {}
        self._performance_metrics: Dict[str, Any] = {}

    def load(
        self,
        platform_health: PlatformHealthScore,
        active_alerts: Optional[List[Alert]] = None,
        incident_history: Optional[List[Dict[str, Any]]] = None,
        service_statuses: Optional[Dict[str, str]] = None,
        performance_metrics: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Carrega dados operacionais."""
        self._platform_health = platform_health
        self._active_alerts = active_alerts or []
        self._incident_history = incident_history or []
        self._service_statuses = service_statuses or {}
        self._performance_metrics = performance_metrics or {}

    def get_platform_overview(self) -> Dict[str, Any]:
        """Visão geral da plataforma."""
        if not self._platform_health:
            return {"error": "Dados não carregados."}

        ph = self._platform_health

        # Alertas operacionais
        ops_alerts = [
            a for a in self._active_alerts
            if a.alert_type in (
                AlertType.PERFORMANCE, AlertType.AVAILABILITY, AlertType.SECURITY
            )
        ]

        return {
            "generated_at": datetime.utcnow().isoformat(),

            # ── Saúde da Plataforma ──────────────────────────────────
            "platform_health": {
                "score": ph.score,
                "status": ph.status.value,
                "components": ph.components,
            },

            # ── Disponibilidade ──────────────────────────────────────
            "availability": {
                "uptime_pct": ph.uptime_pct,
                "incidents_30d": ph.incidents_30d,
                "sla_compliance": ph.uptime_pct >= 99.9,
            },

            # ── Performance ──────────────────────────────────────────
            "performance": {
                "p95_latency_ms": ph.p95_latency_ms,
                "avg_response_ms": ph.avg_response_ms,
                "error_rate_pct": ph.error_rate_pct,
                "api_success_rate_pct": ph.api_success_rate,
            },

            # ── Segurança ────────────────────────────────────────────
            "security": {
                "score": ph.security_score,
                "status": HealthStatus.from_score(ph.security_score).value,
            },

            # ── Serviços ─────────────────────────────────────────────
            "services": self._service_statuses,

            # ── Alertas Operacionais ─────────────────────────────────
            "operational_alerts": {
                "total": len(ops_alerts),
                "critical": sum(
                    1 for a in ops_alerts
                    if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)
                ),
                "alerts": [a.to_dict() for a in ops_alerts[:10]],
            },

            # ── Incidentes Recentes ──────────────────────────────────
            "recent_incidents": self._incident_history[-5:],

            # ── Métricas Adicionais ──────────────────────────────────
            "performance_metrics": self._performance_metrics,
        }

    def get_sla_report(self) -> Dict[str, Any]:
        """Relatório de SLA da plataforma."""
        if not self._platform_health:
            return {}

        ph = self._platform_health
        downtime_minutes = (100.0 - ph.uptime_pct) / 100.0 * 30 * 24 * 60

        return {
            "period": "last_30_days",
            "uptime_pct": ph.uptime_pct,
            "downtime_minutes": round(downtime_minutes, 1),
            "sla_target_pct": 99.9,
            "sla_met": ph.uptime_pct >= 99.9,
            "incidents": ph.incidents_30d,
            "p95_latency_ms": ph.p95_latency_ms,
            "error_rate_pct": ph.error_rate_pct,
        }

    def render_text(self) -> str:
        """Renderiza o Operational Dashboard em formato texto."""
        if not self._platform_health:
            return "Dados não carregados."

        ph = self._platform_health
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

        ops_critical = sum(
            1 for a in self._active_alerts
            if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)
            and a.alert_type in (AlertType.PERFORMANCE, AlertType.AVAILABILITY, AlertType.SECURITY)
        )

        sla_status = "✓ SLA OK" if ph.uptime_pct >= 99.9 else "✗ SLA VIOLADO"

        lines = [
            "=" * 72,
            "  OPERATIONAL DASHBOARD — LifeOS Platform Health",
            f"  Gerado em: {now}",
            "=" * 72,
            "",
            "── PLATFORM HEALTH ──────────────────────────────────────────────────",
            f"  Score:           {ph.score:>6.1f}/100  [{ph.status.value.upper():^12}]",
            f"  Uptime:          {ph.uptime_pct:>9.3f}%  {sla_status}",
            f"  P95 Latência:    {ph.p95_latency_ms:>9.0f} ms",
            f"  Latência Média:  {ph.avg_response_ms:>9.0f} ms",
            f"  Taxa de Erros:   {ph.error_rate_pct:>9.3f}%",
            f"  API Success:     {ph.api_success_rate:>9.2f}%",
            f"  Segurança:       {ph.security_score:>9.1f}/100",
            f"  Incidentes 30d:  {ph.incidents_30d:>9}",
            "",
            "── ALERTAS OPERACIONAIS ─────────────────────────────────────────────",
            f"  Total Ativos:    {len(self._active_alerts):>4}  |  Críticos: {ops_critical:>3}",
        ]

        if self._service_statuses:
            lines += ["", "── STATUS DOS SERVIÇOS ──────────────────────────────────────────────"]
            for svc, status in self._service_statuses.items():
                indicator = "✓" if status == "operational" else "✗"
                lines.append(f"  {indicator} {svc:<30} {status.upper()}")

        lines += ["", "=" * 72]
        return "\n".join(lines)
