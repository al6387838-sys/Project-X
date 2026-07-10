"""
CEO Dashboard
=============
Painel único do CEO da LifeOS.

Consolida em uma única visão:
    - Receita (MRR, ARR, crescimento)
    - Usuários (novos, ativos, DAU/MAU)
    - Retenção e Churn
    - Unit Economics (LTV, CAC, ARPU)
    - NPS e satisfação
    - Disponibilidade e performance
    - Health Scores
    - OKR progress
    - Alertas críticos
"""

from typing import Dict, List, Any, Optional
from datetime import datetime

from ..models.health_scores import CompanyHealthSnapshot, HealthStatus
from ..models.kpi import CEODashboardData, KPISnapshot
from ..models.alerts import Alert, AlertSeverity
from ..models.okr import OKRCycle
from ..monitoring.monitor import AutoMonitor, DEFAULT_ALERT_RULES
from ..reports.report_engine import ReportEngine, ReportType


class CEODashboard:
    """
    Painel único do CEO da LifeOS.

    Ponto central de comando para o CEO, consolidando
    todas as métricas críticas do negócio em tempo real.

    Uso:
        dashboard = CEODashboard()
        dashboard.load(health_snapshot, ceo_data, okr_cycle)
        print(dashboard.render_text())
    """

    def __init__(self):
        self._health_snapshot: Optional[CompanyHealthSnapshot] = None
        self._ceo_data: Optional[CEODashboardData] = None
        self._okr_cycle: Optional[OKRCycle] = None
        self._active_alerts: List[Alert] = []
        self._monitor = AutoMonitor()
        self._monitor.load_default_rules()
        self._report_engine = ReportEngine()
        self._last_updated: Optional[datetime] = None

    def load(
        self,
        health_snapshot: CompanyHealthSnapshot,
        ceo_data: CEODashboardData,
        okr_cycle: Optional[OKRCycle] = None,
        active_alerts: Optional[List[Alert]] = None,
    ) -> None:
        """Carrega todos os dados no painel do CEO."""
        self._health_snapshot = health_snapshot
        self._ceo_data = ceo_data
        self._okr_cycle = okr_cycle
        self._last_updated = datetime.utcnow()

        # Avalia alertas automaticamente
        if active_alerts is not None:
            self._active_alerts = active_alerts
        else:
            # Avalia métricas automaticamente
            metrics = self._extract_metrics_dict(ceo_data)
            new_alerts = self._monitor.evaluate(metrics)
            health_alerts = self._monitor.evaluate_health_snapshot(health_snapshot)
            self._active_alerts = new_alerts + health_alerts

    def _extract_metrics_dict(self, ceo: CEODashboardData) -> Dict[str, float]:
        """Extrai dicionário de métricas para o monitor."""
        return {
            "mrr": ceo.mrr,
            "monthly_churn_pct": ceo.monthly_churn_pct,
            "d30_retention_pct": ceo.d30_retention_pct,
            "new_signups_30d": float(ceo.new_users_30d),
            "p95_latency_ms": ceo.p95_latency_ms,
            "error_rate_pct": ceo.error_rate_pct,
            "uptime_pct": ceo.uptime_pct,
            "security_score": self._health_snapshot.platform.security_score if self._health_snapshot else 100.0,
            "ltv_cac_ratio": ceo.ltv_cac_ratio,
        }

    def get_full_view(self) -> Dict[str, Any]:
        """
        Visão completa do painel do CEO.

        Retorna todos os dados estruturados para
        renderização em interface web ou relatório.
        """
        if not self._health_snapshot or not self._ceo_data:
            return {"error": "Dados não carregados. Chame load() primeiro."}

        hs = self._health_snapshot
        ceo = self._ceo_data

        # KPIs formatados
        kpi_list = ceo.build_kpi_list()

        # Alertas críticos
        critical_alerts = [
            a for a in self._active_alerts
            if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)
        ]

        # OKR summary
        okr_summary = {}
        if self._okr_cycle:
            s = self._okr_cycle.get_summary()
            okr_summary = {
                "cycle": s["name"],
                "progress_pct": s["overall_progress_pct"],
                "elapsed_pct": s["elapsed_pct"],
                "days_remaining": s["days_remaining"],
                "by_status": s["by_status"],
            }

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "last_data_update": self._last_updated.isoformat() if self._last_updated else None,

            # ── Company Health ───────────────────────────────────────
            "company_health": {
                "overall_score": hs.overall_score,
                "overall_status": hs.overall_status.value,
                "business_score": hs.business.score,
                "growth_score": hs.growth.score,
                "product_score": hs.product.score,
                "customer_score": hs.customer.score,
                "platform_score": hs.platform.score,
                "critical_areas": hs.get_critical_areas(),
            },

            # ── Receita ──────────────────────────────────────────────
            "revenue": {
                "mrr": ceo.mrr,
                "arr": ceo.arr,
                "mrr_growth_mom_pct": round(ceo.mrr_growth_mom_pct, 2),
                "new_mrr": ceo.new_mrr,
                "expansion_mrr": ceo.expansion_mrr,
                "churned_mrr": ceo.churned_mrr,
                "net_new_mrr": ceo.net_new_mrr,
                "gross_margin_pct": round(ceo.gross_margin_pct, 1),
            },

            # ── Usuários ─────────────────────────────────────────────
            "users": {
                "total": ceo.total_users,
                "new_30d": ceo.new_users_30d,
                "dau": ceo.active_users_dau,
                "mau": ceo.active_users_mau,
                "dau_mau_ratio": round(ceo.dau_mau_ratio, 3),
            },

            # ── Retenção & Churn ─────────────────────────────────────
            "retention": {
                "d30_pct": round(ceo.d30_retention_pct, 1),
                "monthly_churn_pct": round(ceo.monthly_churn_pct, 2),
                "annual_churn_pct": round(ceo.annual_churn_pct, 1),
                "at_risk_users": ceo.at_risk_users,
            },

            # ── Unit Economics ───────────────────────────────────────
            "unit_economics": {
                "ltv": ceo.ltv,
                "cac": ceo.cac,
                "ltv_cac_ratio": round(ceo.ltv_cac_ratio, 2),
                "arpu": round(ceo.arpu, 2),
                "payback_months": round(ceo.payback_months, 1),
            },

            # ── Satisfação ───────────────────────────────────────────
            "satisfaction": {
                "nps": ceo.nps,
                "csat": round(ceo.csat, 2),
            },

            # ── Plataforma ───────────────────────────────────────────
            "platform": {
                "uptime_pct": round(ceo.uptime_pct, 3),
                "p95_latency_ms": ceo.p95_latency_ms,
                "error_rate_pct": round(ceo.error_rate_pct, 3),
                "incidents_30d": ceo.incidents_30d,
            },

            # ── Crescimento ───────────────────────────────────────────
            "growth": {
                "k_factor": round(ceo.k_factor, 3),
                "activation_rate_pct": round(ceo.activation_rate_pct, 1),
                "visitor_to_signup_pct": round(ceo.visitor_to_signup_pct, 2),
            },

            # ── Alertas ──────────────────────────────────────────────
            "alerts": {
                "total_active": len(self._active_alerts),
                "critical": len(critical_alerts),
                "critical_alerts": [a.to_dict() for a in critical_alerts[:5]],
            },

            # ── OKRs ─────────────────────────────────────────────────
            "okr": okr_summary,

            # ── KPIs Formatados ───────────────────────────────────────
            "kpis": [k.to_dict() for k in kpi_list],
        }

    def generate_report(self, report_type: ReportType = ReportType.DAILY) -> str:
        """Gera um Executive Report e retorna o texto formatado."""
        if not self._health_snapshot or not self._ceo_data:
            return "Dados não carregados."

        report = self._report_engine.generate(
            report_type=report_type,
            health_snapshot=self._health_snapshot,
            ceo_data=self._ceo_data,
            active_alerts=self._active_alerts,
            okr_cycle=self._okr_cycle,
        )
        return report.render_text()

    def render_text(self) -> str:
        """Renderiza o CEO Dashboard completo em formato texto."""
        if not self._health_snapshot or not self._ceo_data:
            return "Dados não carregados."

        hs = self._health_snapshot
        ceo = self._ceo_data
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

        critical_count = sum(
            1 for a in self._active_alerts
            if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)
        )

        alert_indicator = f"🔴 {critical_count} CRÍTICO(S)" if critical_count > 0 else "🟢 SEM CRÍTICOS"

        lines = [
            "=" * 72,
            "  CEO DASHBOARD — LifeOS Command Center",
            f"  Gerado em: {now}",
            f"  Alertas: {alert_indicator}",
            "=" * 72,
            "",
            "── COMPANY HEALTH ───────────────────────────────────────────────────",
            f"  Score Geral:     {hs.overall_score:>6.1f}/100  [{hs.overall_status.value.upper():^12}]",
            f"  Negócio:         {hs.business.score:>6.1f}  |  Crescimento: {hs.growth.score:>6.1f}  |  Produto: {hs.product.score:>6.1f}",
            f"  Clientes:        {hs.customer.score:>6.1f}  |  Plataforma:  {hs.platform.score:>6.1f}",
            "",
            "── RECEITA ──────────────────────────────────────────────────────────",
            f"  MRR:             R$ {ceo.mrr:>12,.2f}",
            f"  ARR:             R$ {ceo.arr:>12,.2f}",
            f"  Crescimento MoM:    {ceo.mrr_growth_mom_pct:>9.2f}%",
            f"  Net New MRR:     R$ {ceo.net_new_mrr:>12,.2f}",
            f"  Margem Bruta:       {ceo.gross_margin_pct:>9.1f}%",
            "",
            "── USUÁRIOS ─────────────────────────────────────────────────────────",
            f"  Total:              {ceo.total_users:>9,}",
            f"  Novos (30d):        {ceo.new_users_30d:>9,}",
            f"  DAU:                {ceo.active_users_dau:>9,}",
            f"  MAU:                {ceo.active_users_mau:>9,}",
            f"  DAU/MAU:            {ceo.dau_mau_ratio:>9.3f}",
            "",
            "── RETENÇÃO & CHURN ─────────────────────────────────────────────────",
            f"  Retenção D30:       {ceo.d30_retention_pct:>9.1f}%",
            f"  Churn Mensal:       {ceo.monthly_churn_pct:>9.2f}%",
            f"  Churn Anual:        {ceo.annual_churn_pct:>9.1f}%",
            f"  Em Risco:           {ceo.at_risk_users:>9,} usuários",
            "",
            "── UNIT ECONOMICS ───────────────────────────────────────────────────",
            f"  LTV:             R$ {ceo.ltv:>12,.2f}",
            f"  CAC:             R$ {ceo.cac:>12,.2f}",
            f"  LTV/CAC:            {ceo.ltv_cac_ratio:>9.2f}x",
            f"  ARPU:            R$ {ceo.arpu:>12,.2f}",
            f"  Payback:            {ceo.payback_months:>9.1f} meses",
            "",
            "── NPS & SATISFAÇÃO ─────────────────────────────────────────────────",
            f"  NPS:                {ceo.nps:>9.0f}",
            f"  CSAT:               {ceo.csat:>9.2f}/5.0",
            "",
            "── PLATAFORMA ───────────────────────────────────────────────────────",
            f"  Disponibilidade:    {ceo.uptime_pct:>9.3f}%",
            f"  Latência P95:       {ceo.p95_latency_ms:>9.0f} ms",
            f"  Taxa de Erros:      {ceo.error_rate_pct:>9.3f}%",
            f"  Incidentes (30d):   {ceo.incidents_30d:>9}",
        ]

        if self._okr_cycle:
            s = self._okr_cycle.get_summary()
            lines += [
                "",
                "── OKRs ─────────────────────────────────────────────────────────────",
                f"  Ciclo:           {s['name']}",
                f"  Progresso:          {s['overall_progress_pct']:>9.1f}%",
                f"  Tempo Decorrido:    {s['elapsed_pct']:>9.1f}%",
                f"  Dias Restantes:     {s['days_remaining']:>9}",
            ]

        if critical_count > 0:
            lines += [
                "",
                "── ALERTAS CRÍTICOS ─────────────────────────────────────────────────",
            ]
            for alert in self._active_alerts:
                if alert.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY):
                    lines.append(f"  ⚠  [{alert.severity.value.upper()}] {alert.title}")
                    lines.append(f"     {alert.message}")

        lines += ["", "=" * 72]
        return "\n".join(lines)
