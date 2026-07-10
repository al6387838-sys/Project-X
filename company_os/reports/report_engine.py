"""
Report Engine
=============
Motor de geração automática de Executive Reports da LifeOS.

Gera relatórios em quatro frequências:
    DAILY     — Relatório diário operacional
    WEEKLY    — Relatório semanal de crescimento
    MONTHLY   — Relatório mensal executivo
    QUARTERLY — Relatório trimestral para o board

Cada relatório inclui:
    - Resumo executivo em linguagem natural
    - KPIs do período
    - Variações vs período anterior
    - Alertas e incidentes
    - OKR progress
    - Ações recomendadas
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from enum import Enum
import uuid

from ..models.health_scores import CompanyHealthSnapshot, HealthStatus
from ..models.kpi import CEODashboardData
from ..models.alerts import Alert, AlertSeverity
from ..models.okr import OKRCycle


class ReportType(str, Enum):
    """Tipo/frequência do relatório."""
    DAILY     = "daily"
    WEEKLY    = "weekly"
    MONTHLY   = "monthly"
    QUARTERLY = "quarterly"


@dataclass
class ExecutiveReport:
    """
    Relatório executivo gerado automaticamente.

    Contém todos os dados do período em formato
    estruturado e narrativa em linguagem natural.
    """
    report_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    report_type: ReportType = ReportType.DAILY
    period_start: datetime = field(default_factory=datetime.utcnow)
    period_end: datetime = field(default_factory=datetime.utcnow)
    generated_at: datetime = field(default_factory=datetime.utcnow)

    # Conteúdo
    title: str = ""
    executive_summary: str = ""
    kpis: Dict[str, Any] = field(default_factory=dict)
    highlights: List[str] = field(default_factory=list)
    concerns: List[str] = field(default_factory=list)
    recommended_actions: List[str] = field(default_factory=list)
    alerts_summary: Dict[str, Any] = field(default_factory=dict)
    okr_progress: Dict[str, Any] = field(default_factory=dict)
    health_scores: Dict[str, Any] = field(default_factory=dict)
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "report_type": self.report_type.value,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "generated_at": self.generated_at.isoformat(),
            "title": self.title,
            "executive_summary": self.executive_summary,
            "kpis": self.kpis,
            "highlights": self.highlights,
            "concerns": self.concerns,
            "recommended_actions": self.recommended_actions,
            "alerts_summary": self.alerts_summary,
            "okr_progress": self.okr_progress,
            "health_scores": self.health_scores,
        }

    def render_text(self) -> str:
        """Renderiza o relatório em formato texto."""
        sep = "=" * 72
        thin = "─" * 72

        lines = [
            sep,
            f"  {self.title}",
            f"  Período: {self.period_start.strftime('%Y-%m-%d')} → {self.period_end.strftime('%Y-%m-%d')}",
            f"  Gerado em: {self.generated_at.strftime('%Y-%m-%d %H:%M UTC')}",
            sep,
            "",
            "── RESUMO EXECUTIVO " + "─" * 52,
            self.executive_summary,
            "",
        ]

        if self.kpis:
            lines += ["── KPIs DO PERÍODO " + "─" * 53]
            for key, val in self.kpis.items():
                if isinstance(val, float):
                    lines.append(f"  {key:<35} {val:>12,.2f}")
                elif isinstance(val, int):
                    lines.append(f"  {key:<35} {val:>12,}")
                else:
                    lines.append(f"  {key:<35} {str(val):>12}")
            lines.append("")

        if self.highlights:
            lines += ["── DESTAQUES POSITIVOS " + "─" * 49]
            for h in self.highlights:
                lines.append(f"  ✓ {h}")
            lines.append("")

        if self.concerns:
            lines += ["── PONTOS DE ATENÇÃO " + "─" * 51]
            for c in self.concerns:
                lines.append(f"  ⚠ {c}")
            lines.append("")

        if self.recommended_actions:
            lines += ["── AÇÕES RECOMENDADAS " + "─" * 50]
            for i, action in enumerate(self.recommended_actions, 1):
                lines.append(f"  {i}. {action}")
            lines.append("")

        lines.append(sep)
        return "\n".join(lines)


class ReportEngine:
    """
    Motor de geração de Executive Reports da LifeOS.

    Gera relatórios automáticos em quatro frequências,
    com narrativa em linguagem natural e dados estruturados.
    """

    def __init__(self):
        self._report_history: List[ExecutiveReport] = []

    def generate(
        self,
        report_type: ReportType,
        health_snapshot: CompanyHealthSnapshot,
        ceo_data: CEODashboardData,
        active_alerts: Optional[List[Alert]] = None,
        okr_cycle: Optional[OKRCycle] = None,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> ExecutiveReport:
        """
        Gera um Executive Report completo.

        Combina todos os dados disponíveis em um relatório
        estruturado com narrativa executiva.
        """
        now = datetime.utcnow()
        period_end = period_end or now

        if period_start is None:
            period_map = {
                ReportType.DAILY:     timedelta(days=1),
                ReportType.WEEKLY:    timedelta(weeks=1),
                ReportType.MONTHLY:   timedelta(days=30),
                ReportType.QUARTERLY: timedelta(days=90),
            }
            period_start = period_end - period_map[report_type]

        report = ExecutiveReport(
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
        )

        # Título
        type_labels = {
            ReportType.DAILY:     "Relatório Diário",
            ReportType.WEEKLY:    "Relatório Semanal",
            ReportType.MONTHLY:   "Relatório Mensal",
            ReportType.QUARTERLY: "Relatório Trimestral",
        }
        report.title = f"LifeOS — {type_labels[report_type]} — {period_end.strftime('%Y-%m-%d')}"

        # KPIs
        report.kpis = self._build_kpis(ceo_data, report_type)

        # Health Scores
        report.health_scores = {
            "overall": health_snapshot.overall_score,
            "overall_status": health_snapshot.overall_status.value,
            "business": health_snapshot.business.score,
            "growth": health_snapshot.growth.score,
            "product": health_snapshot.product.score,
            "customer": health_snapshot.customer.score,
            "platform": health_snapshot.platform.score,
        }

        # Alertas
        alerts = active_alerts or []
        report.alerts_summary = {
            "total": len(alerts),
            "critical": sum(1 for a in alerts if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)),
            "warning": sum(1 for a in alerts if a.severity == AlertSeverity.WARNING),
        }

        # OKRs
        if okr_cycle:
            summary = okr_cycle.get_summary()
            report.okr_progress = {
                "cycle": okr_cycle.name,
                "progress_pct": summary["overall_progress_pct"],
                "elapsed_pct": summary["elapsed_pct"],
                "days_remaining": summary["days_remaining"],
            }

        # Destaques e preocupações
        report.highlights, report.concerns = self._analyze_performance(
            health_snapshot, ceo_data, report_type
        )

        # Ações recomendadas
        report.recommended_actions = self._generate_recommendations(
            health_snapshot, ceo_data, alerts
        )

        # Resumo executivo
        report.executive_summary = self._generate_executive_summary(
            report_type, health_snapshot, ceo_data, report
        )

        self._report_history.append(report)
        return report

    def _build_kpis(self, ceo: CEODashboardData, report_type: ReportType) -> Dict[str, Any]:
        """Constrói o dicionário de KPIs do relatório."""
        base = {
            "MRR (R$)": ceo.mrr,
            "ARR (R$)": ceo.arr,
            "Crescimento MoM (%)": round(ceo.mrr_growth_mom_pct, 2),
            "Novos Usuários (30d)": ceo.new_users_30d,
            "Usuários Ativos (MAU)": ceo.active_users_mau,
            "Retenção D30 (%)": round(ceo.d30_retention_pct, 1),
            "Churn Mensal (%)": round(ceo.monthly_churn_pct, 2),
            "LTV (R$)": ceo.ltv,
            "CAC (R$)": ceo.cac,
            "LTV/CAC (x)": round(ceo.ltv_cac_ratio, 2),
            "NPS": ceo.nps,
            "Uptime (%)": round(ceo.uptime_pct, 3),
        }

        if report_type in (ReportType.MONTHLY, ReportType.QUARTERLY):
            base.update({
                "ARPU (R$)": round(ceo.arpu, 2),
                "Payback (meses)": round(ceo.payback_months, 1),
                "K-Factor": round(ceo.k_factor, 3),
                "Ativação (%)": round(ceo.activation_rate_pct, 1),
                "Latência P95 (ms)": ceo.p95_latency_ms,
                "Incidentes (30d)": ceo.incidents_30d,
            })

        return base

    def _analyze_performance(
        self,
        hs: CompanyHealthSnapshot,
        ceo: CEODashboardData,
        report_type: ReportType,
    ):
        """Identifica destaques positivos e preocupações."""
        highlights = []
        concerns = []

        # Receita
        if ceo.mrr_growth_mom_pct >= 15:
            highlights.append(f"Crescimento de MRR excepcional: {ceo.mrr_growth_mom_pct:.1f}% MoM.")
        elif ceo.mrr_growth_mom_pct >= 5:
            highlights.append(f"MRR crescendo saudavelmente: {ceo.mrr_growth_mom_pct:.1f}% MoM.")
        elif ceo.mrr_growth_mom_pct < 0:
            concerns.append(f"MRR em queda: {ceo.mrr_growth_mom_pct:.1f}% MoM.")

        # Churn
        if ceo.monthly_churn_pct <= 2.0:
            highlights.append(f"Churn mensal excelente: {ceo.monthly_churn_pct:.2f}%.")
        elif ceo.monthly_churn_pct > 5.0:
            concerns.append(f"Churn mensal elevado: {ceo.monthly_churn_pct:.2f}% (benchmark: <5%).")

        # Retenção
        if ceo.d30_retention_pct >= 30:
            highlights.append(f"Retenção D30 acima do benchmark: {ceo.d30_retention_pct:.1f}%.")
        elif ceo.d30_retention_pct < 15:
            concerns.append(f"Retenção D30 crítica: {ceo.d30_retention_pct:.1f}% (benchmark: >20%).")

        # LTV/CAC
        if ceo.ltv_cac_ratio >= 3.0:
            highlights.append(f"LTV/CAC saudável: {ceo.ltv_cac_ratio:.1f}x.")
        elif ceo.ltv_cac_ratio < 1.5:
            concerns.append(f"LTV/CAC abaixo do mínimo: {ceo.ltv_cac_ratio:.1f}x (mínimo: 1.5x).")

        # NPS
        if ceo.nps >= 50:
            highlights.append(f"NPS excelente: {ceo.nps:.0f}.")
        elif ceo.nps < 0:
            concerns.append(f"NPS negativo: {ceo.nps:.0f}. Clientes insatisfeitos.")

        # Plataforma
        if ceo.uptime_pct >= 99.9:
            highlights.append(f"SLA de disponibilidade atingido: {ceo.uptime_pct:.3f}%.")
        elif ceo.uptime_pct < 99.5:
            concerns.append(f"Disponibilidade abaixo do SLA: {ceo.uptime_pct:.3f}%.")

        # Health Scores críticos
        for area in hs.get_critical_areas():
            concerns.append(f"Área crítica detectada: {area}.")

        return highlights, concerns

    def _generate_recommendations(
        self,
        hs: CompanyHealthSnapshot,
        ceo: CEODashboardData,
        alerts: List[Alert],
    ) -> List[str]:
        """Gera lista de ações recomendadas com base nos dados."""
        actions = []

        if ceo.monthly_churn_pct > 5.0:
            actions.append("Ativar campanhas de retenção para usuários em risco de churn.")

        if ceo.d30_retention_pct < 20.0:
            actions.append("Revisar o fluxo de onboarding e o Aha Moment para melhorar ativação.")

        if ceo.ltv_cac_ratio < 2.5:
            actions.append("Otimizar canais de aquisição com menor CAC. Revisar mix de marketing.")

        if ceo.uptime_pct < 99.9:
            actions.append("Revisar infraestrutura e implementar melhorias de resiliência.")

        if ceo.nps < 20:
            actions.append("Lançar pesquisa de satisfação para identificar causas do NPS baixo.")

        if ceo.mrr_growth_mom_pct < 5.0:
            actions.append("Revisar estratégia de crescimento. Avaliar novos canais de aquisição.")

        critical_alerts = [
            a for a in alerts
            if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY)
        ]
        for alert in critical_alerts[:3]:
            if alert.recommended_action:
                actions.append(f"[CRÍTICO] {alert.recommended_action}")

        return actions[:8]  # Máximo de 8 ações

    def _generate_executive_summary(
        self,
        report_type: ReportType,
        hs: CompanyHealthSnapshot,
        ceo: CEODashboardData,
        report: ExecutiveReport,
    ) -> str:
        """Gera o resumo executivo em linguagem natural."""
        status_map = {
            "excellent": "excelente",
            "good": "boa",
            "fair": "razoável",
            "warning": "preocupante",
            "critical": "crítica",
        }
        status_pt = status_map.get(hs.overall_status.value, hs.overall_status.value)

        period_label = {
            ReportType.DAILY:     "nas últimas 24 horas",
            ReportType.WEEKLY:    "na última semana",
            ReportType.MONTHLY:   "no último mês",
            ReportType.QUARTERLY: "no último trimestre",
        }[report_type]

        summary_parts = [
            f"A LifeOS apresenta saúde {status_pt} (score: {hs.overall_score:.0f}/100) {period_label}.",
            f"MRR de R$ {ceo.mrr:,.2f} com crescimento de {ceo.mrr_growth_mom_pct:.1f}% MoM.",
            f"Base de {ceo.total_users:,} usuários, com {ceo.active_users_mau:,} ativos mensalmente.",
            f"Retenção D30: {ceo.d30_retention_pct:.1f}% | Churn: {ceo.monthly_churn_pct:.2f}% | LTV/CAC: {ceo.ltv_cac_ratio:.1f}x.",
        ]

        if report.concerns:
            summary_parts.append(
                f"Pontos de atenção: {len(report.concerns)} área(s) requerem monitoramento."
            )

        if report.alerts_summary.get("critical", 0) > 0:
            summary_parts.append(
                f"ATENÇÃO: {report.alerts_summary['critical']} alerta(s) crítico(s) ativo(s)."
            )

        return " ".join(summary_parts)

    def get_report_history(self, report_type: Optional[ReportType] = None) -> List[ExecutiveReport]:
        """Retorna o histórico de relatórios gerados."""
        if report_type:
            return [r for r in self._report_history if r.report_type == report_type]
        return list(self._report_history)
