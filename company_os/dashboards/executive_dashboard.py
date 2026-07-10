"""
Executive Dashboard
===================
Dashboard executivo da LifeOS para C-Level e board.

Foca em tendências estratégicas, crescimento de receita,
posição competitiva e projeções futuras.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from ..models.health_scores import CompanyHealthSnapshot, HealthStatus
from ..models.kpi import CEODashboardData
from ..models.okr import OKRCycle, OKRStatus


class ExecutiveDashboard:
    """
    Dashboard executivo da LifeOS.

    Projetado para apresentações ao board e reuniões de C-Level.
    Foca em narrativa de crescimento, tendências e projeções.
    """

    def __init__(self):
        self._health_snapshot: Optional[CompanyHealthSnapshot] = None
        self._ceo_data: Optional[CEODashboardData] = None
        self._okr_cycles: List[OKRCycle] = []
        self._historical_mrr: List[Dict[str, Any]] = []   # [{month, mrr}]
        self._historical_users: List[Dict[str, Any]] = [] # [{month, users}]

    def load(
        self,
        health_snapshot: CompanyHealthSnapshot,
        ceo_data: CEODashboardData,
        okr_cycles: Optional[List[OKRCycle]] = None,
        historical_mrr: Optional[List[Dict[str, Any]]] = None,
        historical_users: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self._health_snapshot = health_snapshot
        self._ceo_data = ceo_data
        self._okr_cycles = okr_cycles or []
        self._historical_mrr = historical_mrr or []
        self._historical_users = historical_users or []

    def get_board_summary(self) -> Dict[str, Any]:
        """
        Resumo executivo para o board.

        Apresenta o estado do negócio em formato de narrativa
        estruturada para reuniões de diretoria.
        """
        if not self._health_snapshot or not self._ceo_data:
            return {"error": "Dados não carregados."}

        hs = self._health_snapshot
        ceo = self._ceo_data

        # Projeção de ARR (12 meses com crescimento atual)
        arr_projection_12m = ceo.arr * (1 + ceo.mrr_growth_mom_pct / 100) ** 12

        # Projeção de usuários
        user_growth_mom = 0.0
        if ceo.new_users_prev_30d > 0:
            user_growth_mom = (ceo.new_users_30d - ceo.new_users_prev_30d) / ceo.new_users_prev_30d * 100

        return {
            "generated_at": datetime.utcnow().isoformat(),

            # ── Headline Numbers ─────────────────────────────────────
            "headline": {
                "company_health_score": hs.overall_score,
                "company_health_status": hs.overall_status.value,
                "mrr": ceo.mrr,
                "arr": ceo.arr,
                "mrr_growth_mom_pct": round(ceo.mrr_growth_mom_pct, 2),
                "arr_projection_12m": round(arr_projection_12m, 2),
                "total_users": ceo.total_users,
                "user_growth_mom_pct": round(user_growth_mom, 2),
            },

            # ── Saúde do Negócio ─────────────────────────────────────
            "business_health": {
                "scores": {
                    "business":  hs.business.score,
                    "growth":    hs.growth.score,
                    "product":   hs.product.score,
                    "customer":  hs.customer.score,
                    "platform":  hs.platform.score,
                },
                "critical_areas": hs.get_critical_areas(),
            },

            # ── Unit Economics ───────────────────────────────────────
            "unit_economics": {
                "ltv": ceo.ltv,
                "cac": ceo.cac,
                "ltv_cac_ratio": round(ceo.ltv_cac_ratio, 2),
                "arpu": round(ceo.arpu, 2),
                "payback_months": round(ceo.payback_months, 1),
                "gross_margin_pct": round(ceo.gross_margin_pct, 1),
            },

            # ── Retenção ─────────────────────────────────────────────
            "retention": {
                "d30_pct": ceo.d30_retention_pct,
                "monthly_churn_pct": ceo.monthly_churn_pct,
                "annual_churn_pct": ceo.annual_churn_pct,
                "nps": ceo.nps,
                "csat": ceo.csat,
            },

            # ── Plataforma ───────────────────────────────────────────
            "platform": {
                "uptime_pct": ceo.uptime_pct,
                "p95_latency_ms": ceo.p95_latency_ms,
                "incidents_30d": ceo.incidents_30d,
            },

            # ── OKRs ─────────────────────────────────────────────────
            "okr_progress": self._get_okr_progress(),

            # ── Histórico ────────────────────────────────────────────
            "historical_mrr": self._historical_mrr[-12:],
            "historical_users": self._historical_users[-12:],
        }

    def _get_okr_progress(self) -> Dict[str, Any]:
        """Calcula o progresso dos OKRs ativos."""
        active_cycles = [c for c in self._okr_cycles if c.is_active]
        if not active_cycles:
            return {"message": "Nenhum ciclo de OKR ativo."}

        cycle = active_cycles[0]
        summary = cycle.get_summary()

        return {
            "cycle_name": cycle.name,
            "overall_progress_pct": summary["overall_progress_pct"],
            "elapsed_pct": summary["elapsed_pct"],
            "days_remaining": summary["days_remaining"],
            "by_status": summary["by_status"],
            "total_objectives": summary["total_objectives"],
        }

    def get_growth_narrative(self) -> str:
        """
        Gera narrativa de crescimento para apresentação ao board.

        Descreve o estado atual do negócio em linguagem executiva.
        """
        if not self._ceo_data or not self._health_snapshot:
            return "Dados insuficientes para gerar narrativa."

        ceo = self._ceo_data
        hs = self._health_snapshot

        status_map = {
            "excellent": "excelente",
            "good": "boa",
            "fair": "razoável",
            "warning": "preocupante",
            "critical": "crítica",
        }

        status_pt = status_map.get(hs.overall_status.value, hs.overall_status.value)

        lines = [
            f"A LifeOS está em saúde {status_pt} (score: {hs.overall_score:.0f}/100).",
            "",
            f"Receita: MRR de R$ {ceo.mrr:,.2f} com crescimento de {ceo.mrr_growth_mom_pct:.1f}% MoM.",
            f"ARR projetado: R$ {ceo.arr:,.2f}.",
            "",
            f"Base de usuários: {ceo.total_users:,} usuários totais, {ceo.active_users_mau:,} ativos (MAU).",
            f"Retenção D30: {ceo.d30_retention_pct:.1f}% | Churn mensal: {ceo.monthly_churn_pct:.2f}%.",
            "",
            f"Unit Economics: LTV/CAC de {ceo.ltv_cac_ratio:.1f}x | Payback em {ceo.payback_months:.0f} meses.",
            f"NPS: {ceo.nps:.0f} | Disponibilidade: {ceo.uptime_pct:.2f}%.",
        ]

        critical = hs.get_critical_areas()
        if critical:
            lines += ["", f"Áreas que requerem atenção: {', '.join(critical)}."]

        return "\n".join(lines)

    def render_text(self) -> str:
        """Renderiza o Executive Dashboard em formato texto."""
        if not self._health_snapshot or not self._ceo_data:
            return "Dados não carregados."

        summary = self.get_board_summary()
        headline = summary["headline"]
        ue = summary["unit_economics"]
        ret = summary["retention"]
        okr = summary["okr_progress"]
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

        lines = [
            "=" * 72,
            "  EXECUTIVE DASHBOARD — LifeOS Board Report",
            f"  Gerado em: {now}",
            "=" * 72,
            "",
            "── HEADLINE NUMBERS ─────────────────────────────────────────────────",
            f"  Company Health:  {headline['company_health_score']:>6.1f}/100  [{headline['company_health_status'].upper():^12}]",
            f"  MRR:             R$ {headline['mrr']:>12,.2f}",
            f"  ARR:             R$ {headline['arr']:>12,.2f}",
            f"  ARR Projetado:   R$ {headline['arr_projection_12m']:>12,.2f}  (12 meses)",
            f"  Crescimento MoM:    {headline['mrr_growth_mom_pct']:>9.2f}%",
            f"  Total Usuários:     {headline['total_users']:>9,}",
            "",
            "── UNIT ECONOMICS ───────────────────────────────────────────────────",
            f"  LTV:             R$ {ue['ltv']:>12,.2f}",
            f"  CAC:             R$ {ue['cac']:>12,.2f}",
            f"  LTV/CAC:            {ue['ltv_cac_ratio']:>9.2f}x",
            f"  ARPU:            R$ {ue['arpu']:>12,.2f}",
            f"  Payback:            {ue['payback_months']:>9.1f} meses",
            f"  Margem Bruta:       {ue['gross_margin_pct']:>9.1f}%",
            "",
            "── RETENÇÃO & NPS ───────────────────────────────────────────────────",
            f"  Retenção D30:       {ret['d30_pct']:>9.1f}%",
            f"  Churn Mensal:       {ret['monthly_churn_pct']:>9.2f}%",
            f"  Churn Anual:        {ret['annual_churn_pct']:>9.1f}%",
            f"  NPS:                {ret['nps']:>9.0f}",
            f"  CSAT:               {ret['csat']:>9.2f}/5.0",
        ]

        if isinstance(okr, dict) and "overall_progress_pct" in okr:
            lines += [
                "",
                "── OKRs ─────────────────────────────────────────────────────────────",
                f"  Ciclo:           {okr.get('cycle_name', 'N/A')}",
                f"  Progresso:          {okr['overall_progress_pct']:>9.1f}%",
                f"  Tempo Decorrido:    {okr['elapsed_pct']:>9.1f}%",
                f"  Dias Restantes:     {okr['days_remaining']:>9}",
            ]

        lines += ["", "=" * 72]
        return "\n".join(lines)
