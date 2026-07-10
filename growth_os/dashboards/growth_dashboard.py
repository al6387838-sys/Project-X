"""
Growth Dashboard
================
Dashboard principal do Growth OS da LifeOS.

Consolida todas as métricas em uma visão executiva única:
novos usuários, usuários ativos, retenção, churn,
conversão e receita recorrente.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

from ..models.funnel import FunnelStage, FunnelEvent
from ..models.user_journey import UserJourney
from ..engines.growth_engine import GrowthEngine
from .acquisition_dashboard import AcquisitionDashboard
from .retention_dashboard import RetentionDashboard


class GrowthDashboard:
    """
    Dashboard executivo do Growth OS da LifeOS.

    Visão unificada de todas as métricas de crescimento:
    - Novos usuários (visitantes, cadastros, ativados)
    - Usuários ativos (DAU, WAU, MAU)
    - Retenção (D1, D7, D30)
    - Churn (taxa mensal, usuários perdidos)
    - Conversão (visitor→signup, signup→activation, activation→subscription)
    - Receita recorrente (MRR, ARR, ARPU, LTV/CAC)
    """

    def __init__(self, growth_engine: Optional[GrowthEngine] = None):
        self._growth_engine = growth_engine or GrowthEngine()
        self._acquisition = AcquisitionDashboard()
        self._retention = RetentionDashboard()

    def load_from_engine(self, engine: GrowthEngine) -> None:
        """Carrega dados diretamente do GrowthEngine."""
        self._growth_engine = engine
        journeys = list(engine._journeys.values())
        events = engine._events

        self._acquisition.load_data(journeys=journeys, events=events)
        self._retention.load_data(journeys=journeys)

    def get_executive_summary(self, period_days: int = 30) -> Dict[str, Any]:
        """
        Resumo executivo do crescimento da LifeOS.

        Retorna as métricas mais importantes em formato
        adequado para apresentação a stakeholders.
        """
        dashboard = self._growth_engine.get_growth_dashboard()
        funnel = dashboard["funnel"]
        growth = dashboard["growth"]
        retention = dashboard["retention"]
        revenue = dashboard["revenue"]

        # Calcula MoM growth
        now = datetime.utcnow()
        journeys = list(self._growth_engine._journeys.values())

        current_month_signups = sum(
            1 for j in journeys
            if j.signed_up_at and j.signed_up_at >= now - timedelta(days=30)
        )
        prev_month_signups = sum(
            1 for j in journeys
            if j.signed_up_at
            and (now - timedelta(days=60)) <= j.signed_up_at < (now - timedelta(days=30))
        )

        mom_growth = 0.0
        if prev_month_signups > 0:
            mom_growth = (current_month_signups - prev_month_signups) / prev_month_signups * 100

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "period_days": period_days,

            # KPIs Principais
            "kpis": {
                "new_users_30d": growth["new_users"]["signups"],
                "active_users_mau": growth["active_users"]["mau"],
                "dau_mau_stickiness": growth["active_users"]["stickiness_dau_mau"],
                "retention_d30_pct": dashboard["retention"]["retention_rates"]["day_30"],
                "monthly_churn_pct": funnel["churn"]["monthly_rate"],
                "mrr": revenue["mrr"]["total"],
                "arr": revenue["arr"],
                "ltv_cac_ratio": revenue["unit_economics"]["ltv_cac_ratio"],
                "mom_growth_pct": round(mom_growth, 2),
            },

            # Funil completo
            "funnel": {
                "visitor_to_signup_pct": funnel["conversion_rates"]["visitor_to_signup"],
                "signup_to_activation_pct": funnel["conversion_rates"]["signup_to_activation"],
                "activation_to_retention_pct": funnel["conversion_rates"]["activation_to_retention"],
                "retention_to_subscription_pct": funnel["conversion_rates"]["retention_to_subscription"],
                "overall_conversion_pct": funnel["conversion_rates"]["overall"],
            },

            # Receita
            "revenue": {
                "mrr": revenue["mrr"]["total"],
                "arr": revenue["arr"],
                "mrr_growth": revenue["mrr"]["net_change"],
                "arpu": revenue["unit_economics"]["arpu"],
                "ltv": revenue["unit_economics"]["ltv"],
                "cac": revenue["unit_economics"]["cac"],
                "payback_months": revenue["unit_economics"]["payback_period_months"],
                "by_plan": revenue["by_plan"],
            },

            # Aquisição por canal
            "acquisition_channels": growth["acquisition_by_channel"],

            # Saúde geral
            "health": self._calculate_overall_health(funnel, revenue),
        }

    def get_full_dashboard(self) -> Dict[str, Any]:
        """
        Dashboard completo com todas as seções.

        Retorna dados estruturados para renderização
        em interface web ou relatório executivo.
        """
        return {
            "executive_summary": self.get_executive_summary(),
            "acquisition": self._acquisition.get_overview(),
            "acquisition_channels": self._acquisition.get_channel_breakdown(),
            "daily_signups": self._acquisition.get_daily_signups(30),
            "retention": self._retention.get_retention_overview(),
            "cohort_analysis": self._retention.get_cohort_analysis(),
            "churn_analysis": self._retention.get_churn_analysis(),
            "at_risk_users": self._retention.get_at_risk_users(limit=10),
            "engagement": self._retention.get_engagement_analysis(),
            "revenue": self._growth_engine.get_revenue_metrics().to_dict(),
        }

    def _calculate_overall_health(
        self, funnel: Dict, revenue: Dict
    ) -> Dict[str, Any]:
        """Calcula score de saúde geral do negócio."""
        scores = []

        # Retenção D30 (benchmark: 25%)
        d30 = funnel.get("retention", {}).get("day30", 0.0)
        scores.append(min(d30 / 25.0, 1.0))

        # LTV/CAC (benchmark: 3.0)
        ltv_cac = revenue["unit_economics"]["ltv_cac_ratio"]
        scores.append(min(ltv_cac / 3.0, 1.0))

        # Churn (benchmark: <5%)
        churn = funnel["churn"]["monthly_rate"]
        scores.append(max(0, 1.0 - churn / 5.0))

        overall = sum(scores) / len(scores) if scores else 0.0

        if overall >= 0.8:
            status = "excellent"
        elif overall >= 0.6:
            status = "good"
        elif overall >= 0.4:
            status = "fair"
        else:
            status = "needs_attention"

        return {
            "overall_score": round(overall * 100, 1),
            "status": status,
            "components": {
                "retention_score": round(scores[0] * 100, 1) if len(scores) > 0 else 0,
                "unit_economics_score": round(scores[1] * 100, 1) if len(scores) > 1 else 0,
                "churn_score": round(scores[2] * 100, 1) if len(scores) > 2 else 0,
            },
        }

    def render_text(self) -> str:
        """Renderiza o dashboard executivo em formato texto."""
        summary = self.get_executive_summary()
        kpis = summary["kpis"]
        funnel = summary["funnel"]
        revenue = summary["revenue"]
        health = summary["health"]

        lines = [
            "=" * 70,
            "  GROWTH DASHBOARD — LifeOS Growth Operating System",
            f"  Gerado em: {summary['generated_at'][:19]}",
            "=" * 70,
            "",
            "── NOVOS USUÁRIOS (30 dias) ─────────────────────────────────────",
            f"  Novos Cadastros:         {kpis['new_users_30d']:>10,}",
            f"  Usuários Ativos (MAU):   {kpis['active_users_mau']:>10,}",
            f"  Stickiness (DAU/MAU):    {kpis['dau_mau_stickiness']:>10.3f}",
            f"  Crescimento MoM:         {kpis['mom_growth_pct']:>9.2f}%",
            "",
            "── FUNIL DE CONVERSÃO ───────────────────────────────────────────",
            f"  Visitante → Cadastro:    {funnel['visitor_to_signup_pct']:>9.2f}%",
            f"  Cadastro → Ativação:     {funnel['signup_to_activation_pct']:>9.2f}%",
            f"  Ativação → Retenção:     {funnel['activation_to_retention_pct']:>9.2f}%",
            f"  Retenção → Assinatura:   {funnel['retention_to_subscription_pct']:>9.2f}%",
            f"  Conversão Geral:         {funnel['overall_conversion_pct']:>9.2f}%",
            "",
            "── RETENÇÃO & CHURN ─────────────────────────────────────────────",
            f"  Retenção D30:            {kpis['retention_d30_pct']:>9.2f}%",
            f"  Churn Mensal:            {kpis['monthly_churn_pct']:>9.2f}%",
            "",
            "── RECEITA RECORRENTE ───────────────────────────────────────────",
            f"  MRR:                     R$ {revenue['mrr']:>10,.2f}",
            f"  ARR:                     R$ {revenue['arr']:>10,.2f}",
            f"  ARPU:                    R$ {revenue['arpu']:>10,.2f}",
            f"  LTV:                     R$ {revenue['ltv']:>10,.2f}",
            f"  CAC:                     R$ {revenue['cac']:>10,.2f}",
            f"  LTV/CAC:                 {kpis['ltv_cac_ratio']:>10.2f}x",
            f"  Payback:                 {revenue['payback_months']:>9.1f} meses",
            "",
            "── SAÚDE DO NEGÓCIO ─────────────────────────────────────────────",
            f"  Score Geral:             {health['overall_score']:>9.1f}/100",
            f"  Status:                  {health['status'].upper():>10}",
            "",
            "=" * 70,
        ]
        return "\n".join(lines)
