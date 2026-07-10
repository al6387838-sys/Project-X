"""
KPI Models
==========
Modelos para os KPIs do CEO Dashboard da LifeOS.

Consolida todas as métricas críticas em uma única estrutura
otimizada para apresentação executiva.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional


@dataclass
class KPISnapshot:
    """
    Snapshot de um KPI com valor atual, anterior e tendência.
    """
    name: str = ""
    value: float = 0.0
    previous_value: float = 0.0
    unit: str = ""
    format: str = "number"            # number | currency | percent | ratio
    trend: str = "stable"             # up | down | stable
    trend_pct: float = 0.0
    is_good_when: str = "up"          # up | down (para colorir o trend)
    benchmark: Optional[float] = None
    description: str = ""

    def compute_trend(self) -> "KPISnapshot":
        if self.previous_value == 0:
            self.trend = "stable"
            self.trend_pct = 0.0
        else:
            self.trend_pct = round(
                (self.value - self.previous_value) / abs(self.previous_value) * 100, 2
            )
            if self.trend_pct > 1.0:
                self.trend = "up"
            elif self.trend_pct < -1.0:
                self.trend = "down"
            else:
                self.trend = "stable"
        return self

    @property
    def is_positive(self) -> bool:
        """True se a tendência é positiva para o negócio."""
        if self.trend == "stable":
            return True
        return (self.trend == "up") == (self.is_good_when == "up")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "previous_value": self.previous_value,
            "unit": self.unit,
            "format": self.format,
            "trend": self.trend,
            "trend_pct": self.trend_pct,
            "is_positive": self.is_positive,
            "benchmark": self.benchmark,
            "description": self.description,
        }


@dataclass
class CEODashboardData:
    """
    Dados completos do CEO Dashboard.

    Consolida todos os KPIs críticos para visão executiva:
    receita, usuários, retenção, performance e disponibilidade.
    """
    generated_at: datetime = field(default_factory=datetime.utcnow)
    period: str = "last_30_days"

    # ── Receita ──────────────────────────────────────────────────
    mrr: float = 0.0
    mrr_prev: float = 0.0
    arr: float = 0.0
    mrr_growth_mom_pct: float = 0.0
    new_mrr: float = 0.0
    expansion_mrr: float = 0.0
    churned_mrr: float = 0.0
    net_new_mrr: float = 0.0
    gross_margin_pct: float = 0.0

    # ── Usuários ─────────────────────────────────────────────────
    total_users: int = 0
    new_users_30d: int = 0
    new_users_prev_30d: int = 0
    active_users_dau: int = 0
    active_users_mau: int = 0
    dau_mau_ratio: float = 0.0

    # ── Retenção & Churn ─────────────────────────────────────────
    d30_retention_pct: float = 0.0
    monthly_churn_pct: float = 0.0
    annual_churn_pct: float = 0.0
    at_risk_users: int = 0

    # ── Receita por Usuário ───────────────────────────────────────
    ltv: float = 0.0
    cac: float = 0.0
    ltv_cac_ratio: float = 0.0
    arpu: float = 0.0
    payback_months: float = 0.0

    # ── NPS & Satisfação ─────────────────────────────────────────
    nps: float = 0.0
    csat: float = 0.0

    # ── Plataforma ───────────────────────────────────────────────
    uptime_pct: float = 100.0
    p95_latency_ms: float = 0.0
    error_rate_pct: float = 0.0
    incidents_30d: int = 0

    # ── Crescimento ───────────────────────────────────────────────
    k_factor: float = 0.0
    activation_rate_pct: float = 0.0
    visitor_to_signup_pct: float = 0.0

    def build_kpi_list(self) -> List[KPISnapshot]:
        """Constrói lista de KPIs formatados para o dashboard."""
        kpis = [
            KPISnapshot("MRR", self.mrr, self.mrr_prev, "R$", "currency", is_good_when="up",
                        description="Receita Mensal Recorrente"),
            KPISnapshot("ARR", self.arr, self.arr * (1 - self.mrr_growth_mom_pct / 100),
                        "R$", "currency", is_good_when="up", description="Receita Anual Recorrente"),
            KPISnapshot("Novos Usuários (30d)", self.new_users_30d, self.new_users_prev_30d,
                        "", "number", is_good_when="up"),
            KPISnapshot("Usuários Ativos (MAU)", self.active_users_mau, 0, "", "number", is_good_when="up"),
            KPISnapshot("Retenção D30", self.d30_retention_pct, 0, "%", "percent",
                        is_good_when="up", benchmark=25.0),
            KPISnapshot("Churn Mensal", self.monthly_churn_pct, 0, "%", "percent",
                        is_good_when="down", benchmark=5.0),
            KPISnapshot("LTV", self.ltv, 0, "R$", "currency", is_good_when="up"),
            KPISnapshot("CAC", self.cac, 0, "R$", "currency", is_good_when="down"),
            KPISnapshot("LTV/CAC", self.ltv_cac_ratio, 0, "x", "ratio",
                        is_good_when="up", benchmark=3.0),
            KPISnapshot("NPS", self.nps, 0, "", "number",
                        is_good_when="up", benchmark=50.0),
            KPISnapshot("Disponibilidade", self.uptime_pct, 0, "%", "percent",
                        is_good_when="up", benchmark=99.9),
            KPISnapshot("Latência P95", self.p95_latency_ms, 0, "ms", "number",
                        is_good_when="down", benchmark=500.0),
        ]
        for kpi in kpis:
            kpi.compute_trend()
        return kpis

    def to_dict(self) -> Dict[str, Any]:
        kpis = self.build_kpi_list()
        return {
            "generated_at": self.generated_at.isoformat(),
            "period": self.period,
            "revenue": {
                "mrr": self.mrr,
                "arr": self.arr,
                "mrr_growth_mom_pct": round(self.mrr_growth_mom_pct, 2),
                "new_mrr": self.new_mrr,
                "expansion_mrr": self.expansion_mrr,
                "churned_mrr": self.churned_mrr,
                "net_new_mrr": self.net_new_mrr,
                "gross_margin_pct": round(self.gross_margin_pct, 1),
            },
            "users": {
                "total": self.total_users,
                "new_30d": self.new_users_30d,
                "dau": self.active_users_dau,
                "mau": self.active_users_mau,
                "dau_mau_ratio": round(self.dau_mau_ratio, 3),
            },
            "retention": {
                "d30_pct": round(self.d30_retention_pct, 1),
                "monthly_churn_pct": round(self.monthly_churn_pct, 2),
                "annual_churn_pct": round(self.annual_churn_pct, 1),
                "at_risk_users": self.at_risk_users,
            },
            "unit_economics": {
                "ltv": self.ltv,
                "cac": self.cac,
                "ltv_cac_ratio": round(self.ltv_cac_ratio, 2),
                "arpu": round(self.arpu, 2),
                "payback_months": round(self.payback_months, 1),
            },
            "satisfaction": {
                "nps": self.nps,
                "csat": round(self.csat, 2),
            },
            "platform": {
                "uptime_pct": round(self.uptime_pct, 3),
                "p95_latency_ms": self.p95_latency_ms,
                "error_rate_pct": round(self.error_rate_pct, 3),
                "incidents_30d": self.incidents_30d,
            },
            "growth": {
                "k_factor": round(self.k_factor, 3),
                "activation_rate_pct": round(self.activation_rate_pct, 1),
                "visitor_to_signup_pct": round(self.visitor_to_signup_pct, 2),
            },
            "kpis": [k.to_dict() for k in kpis],
        }
