"""
Company Dashboard
=================
Dashboard principal da LifeOS — visão consolidada da empresa.

Agrega os 5 Health Scores, KPIs críticos, OKRs e alertas
em uma única visão para o time de liderança.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

from ..models.health_scores import (
    BusinessHealthScore, GrowthScore, ProductHealthScore,
    CustomerHealthScore, PlatformHealthScore, CompanyHealthSnapshot,
    HealthStatus
)
from ..models.kpi import CEODashboardData, KPISnapshot
from ..models.alerts import Alert, AlertSeverity


class CompanyDashboard:
    """
    Dashboard central da LifeOS.

    Consolida todos os sistemas em uma visão única:
    - 5 Health Scores (Business, Growth, Product, Customer, Platform)
    - KPIs críticos do CEO
    - Alertas ativos
    - OKR progress
    - Tendências de crescimento
    """

    def __init__(self):
        self._health_snapshot: Optional[CompanyHealthSnapshot] = None
        self._ceo_data: Optional[CEODashboardData] = None
        self._active_alerts: List[Alert] = []
        self._okr_summary: Dict[str, Any] = {}
        self._last_updated: Optional[datetime] = None

    def load(
        self,
        health_snapshot: CompanyHealthSnapshot,
        ceo_data: CEODashboardData,
        active_alerts: Optional[List[Alert]] = None,
        okr_summary: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Carrega todos os dados no dashboard."""
        self._health_snapshot = health_snapshot
        self._ceo_data = ceo_data
        self._active_alerts = active_alerts or []
        self._okr_summary = okr_summary or {}
        self._last_updated = datetime.utcnow()

    def get_overview(self) -> Dict[str, Any]:
        """
        Visão geral consolidada da empresa.

        Retorna o estado atual de todos os sistemas
        em formato adequado para o painel principal.
        """
        if not self._health_snapshot or not self._ceo_data:
            return {"error": "Dados não carregados. Chame load() primeiro."}

        hs = self._health_snapshot
        ceo = self._ceo_data

        # Alertas por severidade
        alerts_by_severity = {s.value: 0 for s in AlertSeverity}
        for alert in self._active_alerts:
            alerts_by_severity[alert.severity.value] += 1

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "last_data_update": self._last_updated.isoformat() if self._last_updated else None,

            # ── Saúde Geral ──────────────────────────────────────────
            "company_health": {
                "overall_score": hs.overall_score,
                "overall_status": hs.overall_status.value,
                "scores": {
                    "business":  {"score": hs.business.score,  "status": hs.business.status.value},
                    "growth":    {"score": hs.growth.score,    "status": hs.growth.status.value},
                    "product":   {"score": hs.product.score,   "status": hs.product.status.value},
                    "customer":  {"score": hs.customer.score,  "status": hs.customer.status.value},
                    "platform":  {"score": hs.platform.score,  "status": hs.platform.status.value},
                },
                "critical_areas": hs.get_critical_areas(),
            },

            # ── KPIs Principais ──────────────────────────────────────
            "top_kpis": {
                "mrr": ceo.mrr,
                "arr": ceo.arr,
                "mrr_growth_mom_pct": ceo.mrr_growth_mom_pct,
                "new_users_30d": ceo.new_users_30d,
                "active_users_mau": ceo.active_users_mau,
                "d30_retention_pct": ceo.d30_retention_pct,
                "monthly_churn_pct": ceo.monthly_churn_pct,
                "ltv_cac_ratio": ceo.ltv_cac_ratio,
                "nps": ceo.nps,
                "uptime_pct": ceo.uptime_pct,
            },

            # ── Alertas ──────────────────────────────────────────────
            "alerts": {
                "total_active": len(self._active_alerts),
                "by_severity": alerts_by_severity,
                "critical_alerts": [
                    a.to_dict() for a in self._active_alerts
                    if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)
                ][:5],
            },

            # ── OKRs ─────────────────────────────────────────────────
            "okr_summary": self._okr_summary,
        }

    def get_health_scorecard(self) -> Dict[str, Any]:
        """Retorna o scorecard completo de saúde da empresa."""
        if not self._health_snapshot:
            return {}
        return self._health_snapshot.to_dict()

    def render_text(self) -> str:
        """Renderiza o Company Dashboard em formato texto."""
        if not self._health_snapshot or not self._ceo_data:
            return "Dados não carregados."

        hs = self._health_snapshot
        ceo = self._ceo_data
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

        critical_count = sum(
            1 for a in self._active_alerts
            if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)
        )

        lines = [
            "=" * 72,
            "  COMPANY DASHBOARD — LifeOS Autonomous Company System",
            f"  Gerado em: {now}",
            "=" * 72,
            "",
            "── COMPANY HEALTH SCORE ─────────────────────────────────────────────",
            f"  Score Geral:     {hs.overall_score:>6.1f}/100  [{hs.overall_status.value.upper():^12}]",
            "",
            f"  Negócio:         {hs.business.score:>6.1f}/100  [{hs.business.status.value.upper():^12}]",
            f"  Crescimento:     {hs.growth.score:>6.1f}/100  [{hs.growth.status.value.upper():^12}]",
            f"  Produto:         {hs.product.score:>6.1f}/100  [{hs.product.status.value.upper():^12}]",
            f"  Clientes:        {hs.customer.score:>6.1f}/100  [{hs.customer.status.value.upper():^12}]",
            f"  Plataforma:      {hs.platform.score:>6.1f}/100  [{hs.platform.status.value.upper():^12}]",
            "",
            "── KPIs CRÍTICOS ────────────────────────────────────────────────────",
            f"  MRR:             R$ {ceo.mrr:>12,.2f}",
            f"  ARR:             R$ {ceo.arr:>12,.2f}",
            f"  Crescimento MoM:    {ceo.mrr_growth_mom_pct:>9.2f}%",
            f"  Novos Usuários:     {ceo.new_users_30d:>9,}",
            f"  Usuários Ativos:    {ceo.active_users_mau:>9,} (MAU)",
            f"  Retenção D30:       {ceo.d30_retention_pct:>9.1f}%",
            f"  Churn Mensal:       {ceo.monthly_churn_pct:>9.2f}%",
            f"  LTV/CAC:            {ceo.ltv_cac_ratio:>9.2f}x",
            f"  NPS:                {ceo.nps:>9.0f}",
            f"  Disponibilidade:    {ceo.uptime_pct:>9.3f}%",
            "",
            "── ALERTAS ──────────────────────────────────────────────────────────",
            f"  Alertas Ativos:  {len(self._active_alerts):>4}  |  Críticos: {critical_count:>3}",
        ]

        if hs.get_critical_areas():
            lines += ["", "── ÁREAS CRÍTICAS ───────────────────────────────────────────────────"]
            for area in hs.get_critical_areas():
                lines.append(f"  ⚠  {area}")

        if self._okr_summary:
            progress = self._okr_summary.get("overall_progress_pct", 0)
            lines += [
                "",
                "── OKRs ─────────────────────────────────────────────────────────────",
                f"  Progresso Geral: {progress:>6.1f}%",
            ]

        lines += ["", "=" * 72]
        return "\n".join(lines)
