"""
Growth Metrics Models
=====================
Modelos para métricas de crescimento, retenção e receita da LifeOS.

Todas as métricas são calculadas com precisão e rastreabilidade completa.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional


@dataclass
class GrowthMetrics:
    """
    Métricas de crescimento agregadas para o dashboard principal.

    Captura o estado do funil em um determinado período,
    incluindo novos usuários, usuários ativos e taxas de conversão.
    """

    period: str = "daily"
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    # Novos usuários
    new_visitors: int = 0
    new_signups: int = 0
    new_activated: int = 0

    # Usuários ativos
    dau: int = 0
    """Daily Active Users."""
    wau: int = 0
    """Weekly Active Users."""
    mau: int = 0
    """Monthly Active Users."""

    # Taxas de engajamento
    dau_mau_ratio: float = 0.0
    """Stickiness: DAU/MAU. Ideal > 0.20."""

    # Crescimento
    user_growth_rate: float = 0.0
    """Taxa de crescimento de usuários no período (%)."""
    revenue_growth_rate: float = 0.0
    """Taxa de crescimento de receita no período (%)."""

    # Aquisição por canal
    organic_signups: int = 0
    paid_signups: int = 0
    referral_signups: int = 0
    social_signups: int = 0
    email_signups: int = 0

    def compute(self) -> None:
        """Calcula métricas derivadas."""
        if self.mau > 0:
            self.dau_mau_ratio = self.dau / self.mau

    def to_dict(self) -> Dict[str, Any]:
        return {
            "period": self.period,
            "snapshot_at": self.snapshot_at.isoformat(),
            "new_users": {
                "visitors": self.new_visitors,
                "signups": self.new_signups,
                "activated": self.new_activated,
            },
            "active_users": {
                "dau": self.dau,
                "wau": self.wau,
                "mau": self.mau,
                "stickiness_dau_mau": round(self.dau_mau_ratio, 3),
            },
            "growth_rates": {
                "users_pct": round(self.user_growth_rate, 2),
                "revenue_pct": round(self.revenue_growth_rate, 2),
            },
            "acquisition_by_channel": {
                "organic": self.organic_signups,
                "paid": self.paid_signups,
                "referral": self.referral_signups,
                "social": self.social_signups,
                "email": self.email_signups,
            },
        }


@dataclass
class CohortRetention:
    """Retenção de uma coorte específica ao longo do tempo."""

    cohort_date: datetime = field(default_factory=datetime.utcnow)
    cohort_size: int = 0
    retention_by_day: Dict[int, float] = field(default_factory=dict)
    """Mapa de dia → taxa de retenção (0.0 a 1.0)."""

    def get_retention(self, day: int) -> float:
        return self.retention_by_day.get(day, 0.0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cohort_date": self.cohort_date.isoformat(),
            "cohort_size": self.cohort_size,
            "retention": {
                f"day_{day}": round(rate * 100, 2)
                for day, rate in sorted(self.retention_by_day.items())
            },
        }


@dataclass
class RetentionMetrics:
    """
    Métricas de retenção e churn da LifeOS.

    Inclui análise por coorte, taxas de retenção por período
    e indicadores de risco de churn.
    """

    period: str = "monthly"
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    # Retenção por período
    day1_retention: float = 0.0
    day3_retention: float = 0.0
    day7_retention: float = 0.0
    day14_retention: float = 0.0
    day30_retention: float = 0.0
    day60_retention: float = 0.0
    day90_retention: float = 0.0

    # Churn
    monthly_churn_rate: float = 0.0
    weekly_churn_rate: float = 0.0
    churned_users_count: int = 0
    recovered_users_count: int = 0
    """Usuários que retornaram após churn."""

    # Usuários em risco
    at_risk_users: int = 0
    """Usuários inativos há 7-14 dias."""
    dormant_users: int = 0
    """Usuários inativos há 30+ dias."""

    # Coortes
    cohorts: List[CohortRetention] = field(default_factory=list)

    # Engajamento
    avg_sessions_per_user: float = 0.0
    avg_session_duration_minutes: float = 0.0
    avg_features_used_per_user: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "period": self.period,
            "snapshot_at": self.snapshot_at.isoformat(),
            "retention_rates": {
                "day_1": round(self.day1_retention * 100, 2),
                "day_3": round(self.day3_retention * 100, 2),
                "day_7": round(self.day7_retention * 100, 2),
                "day_14": round(self.day14_retention * 100, 2),
                "day_30": round(self.day30_retention * 100, 2),
                "day_60": round(self.day60_retention * 100, 2),
                "day_90": round(self.day90_retention * 100, 2),
            },
            "churn": {
                "monthly_rate_pct": round(self.monthly_churn_rate * 100, 2),
                "weekly_rate_pct": round(self.weekly_churn_rate * 100, 2),
                "churned_users": self.churned_users_count,
                "recovered_users": self.recovered_users_count,
            },
            "at_risk": {
                "at_risk_users": self.at_risk_users,
                "dormant_users": self.dormant_users,
            },
            "engagement": {
                "avg_sessions_per_user": round(self.avg_sessions_per_user, 2),
                "avg_session_duration_min": round(self.avg_session_duration_minutes, 2),
                "avg_features_used": round(self.avg_features_used_per_user, 2),
            },
            "cohorts": [c.to_dict() for c in self.cohorts],
        }


@dataclass
class RevenueMetrics:
    """
    Métricas de receita recorrente da LifeOS.

    Rastreia MRR, ARR, ARPU, LTV e CAC com granularidade
    por plano e canal de aquisição.
    """

    period: str = "monthly"
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    # MRR breakdown
    mrr_total: float = 0.0
    mrr_new: float = 0.0
    """MRR de novos assinantes."""
    mrr_expansion: float = 0.0
    """MRR de upgrades (Pro → Ultra, etc.)."""
    mrr_contraction: float = 0.0
    """MRR perdido por downgrades."""
    mrr_churn: float = 0.0
    """MRR perdido por cancelamentos."""
    mrr_reactivation: float = 0.0
    """MRR recuperado de reativações."""

    # ARR
    arr: float = 0.0

    # Por plano
    mrr_pro: float = 0.0
    mrr_ultra: float = 0.0
    mrr_enterprise: float = 0.0

    # Assinantes por plano
    subscribers_pro: int = 0
    subscribers_ultra: int = 0
    subscribers_enterprise: int = 0

    # Unit economics
    arpu: float = 0.0
    ltv: float = 0.0
    cac: float = 0.0
    ltv_cac_ratio: float = 0.0
    payback_period_months: float = 0.0

    # Receita total
    total_revenue: float = 0.0
    revenue_growth_mom: float = 0.0
    """Month-over-Month growth rate."""

    def compute(self) -> None:
        """Calcula métricas derivadas."""
        self.arr = self.mrr_total * 12
        total_subscribers = self.subscribers_pro + self.subscribers_ultra + self.subscribers_enterprise
        if total_subscribers > 0:
            self.arpu = self.mrr_total / total_subscribers
        if self.cac > 0 and self.arpu > 0:
            self.payback_period_months = self.cac / self.arpu
        if self.cac > 0 and self.ltv > 0:
            self.ltv_cac_ratio = self.ltv / self.cac

    @property
    def net_mrr_change(self) -> float:
        """Variação líquida do MRR no período."""
        return (
            self.mrr_new
            + self.mrr_expansion
            + self.mrr_reactivation
            - self.mrr_contraction
            - self.mrr_churn
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "period": self.period,
            "snapshot_at": self.snapshot_at.isoformat(),
            "mrr": {
                "total": round(self.mrr_total, 2),
                "new": round(self.mrr_new, 2),
                "expansion": round(self.mrr_expansion, 2),
                "contraction": round(self.mrr_contraction, 2),
                "churn": round(self.mrr_churn, 2),
                "reactivation": round(self.mrr_reactivation, 2),
                "net_change": round(self.net_mrr_change, 2),
            },
            "arr": round(self.arr, 2),
            "by_plan": {
                "pro": {"mrr": round(self.mrr_pro, 2), "subscribers": self.subscribers_pro},
                "ultra": {"mrr": round(self.mrr_ultra, 2), "subscribers": self.subscribers_ultra},
                "enterprise": {"mrr": round(self.mrr_enterprise, 2), "subscribers": self.subscribers_enterprise},
            },
            "unit_economics": {
                "arpu": round(self.arpu, 2),
                "ltv": round(self.ltv, 2),
                "cac": round(self.cac, 2),
                "ltv_cac_ratio": round(self.ltv_cac_ratio, 2),
                "payback_period_months": round(self.payback_period_months, 1),
            },
            "total_revenue": round(self.total_revenue, 2),
            "growth_mom_pct": round(self.revenue_growth_mom * 100, 2),
        }
