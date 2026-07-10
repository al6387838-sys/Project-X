"""
Health Score Models
===================
Modelos para os cinco Health Scores da LifeOS:

    BusinessHealthScore  — Saúde financeira e de crescimento
    GrowthScore          — Aquisição, ativação e expansão
    ProductHealthScore   — Qualidade, adoção e NPS
    CustomerHealthScore  — Retenção, satisfação e suporte
    PlatformHealthScore  — Disponibilidade, performance e segurança

Cada score é calculado de 0 a 100 com status:
    CRITICAL (0-39) | WARNING (40-59) | FAIR (60-74) | GOOD (75-89) | EXCELLENT (90-100)
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional
from enum import Enum


class HealthStatus(str, Enum):
    """Status de saúde baseado no score numérico."""
    CRITICAL  = "critical"    # 0–39
    WARNING   = "warning"     # 40–59
    FAIR      = "fair"        # 60–74
    GOOD      = "good"        # 75–89
    EXCELLENT = "excellent"   # 90–100

    @classmethod
    def from_score(cls, score: float) -> "HealthStatus":
        if score >= 90:
            return cls.EXCELLENT
        elif score >= 75:
            return cls.GOOD
        elif score >= 60:
            return cls.FAIR
        elif score >= 40:
            return cls.WARNING
        else:
            return cls.CRITICAL


@dataclass
class BusinessHealthScore:
    """
    Score de saúde financeira e de crescimento do negócio.

    Composto por:
        MRR Growth (30%), LTV/CAC (25%), Churn (25%), Runway (20%)
    """
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    # Inputs financeiros
    mrr: float = 0.0
    arr: float = 0.0
    mrr_growth_mom: float = 0.0       # % crescimento MoM
    ltv: float = 0.0
    cac: float = 0.0
    ltv_cac_ratio: float = 0.0
    monthly_churn_rate: float = 0.0   # 0.0 a 1.0
    runway_months: float = 0.0
    gross_margin: float = 0.0         # 0.0 a 1.0

    # Score calculado
    score: float = 0.0
    status: HealthStatus = HealthStatus.CRITICAL
    components: Dict[str, float] = field(default_factory=dict)

    def calculate(self) -> "BusinessHealthScore":
        """Calcula o score de saúde do negócio."""
        scores = {}

        # MRR Growth (30%) — benchmark: 15% MoM = 100pts
        growth_score = min(self.mrr_growth_mom / 15.0, 1.0) * 100
        scores["mrr_growth"] = round(growth_score, 1)

        # LTV/CAC (25%) — benchmark: 3.0 = 100pts
        ltv_cac = self.ltv_cac_ratio if self.ltv_cac_ratio > 0 else (
            self.ltv / self.cac if self.cac > 0 else 0
        )
        ltv_cac_score = min(ltv_cac / 3.0, 1.0) * 100
        scores["ltv_cac"] = round(ltv_cac_score, 1)

        # Churn (25%) — benchmark: <2% = 100pts, >10% = 0pts
        churn_pct = self.monthly_churn_rate * 100
        churn_score = max(0, min((10.0 - churn_pct) / 8.0, 1.0)) * 100
        scores["churn"] = round(churn_score, 1)

        # Runway (20%) — benchmark: 18+ meses = 100pts
        runway_score = min(self.runway_months / 18.0, 1.0) * 100
        scores["runway"] = round(runway_score, 1)

        # Score ponderado
        self.score = round(
            scores["mrr_growth"] * 0.30 +
            scores["ltv_cac"]    * 0.25 +
            scores["churn"]      * 0.25 +
            scores["runway"]     * 0.20,
            1
        )
        self.status = HealthStatus.from_score(self.score)
        self.components = scores
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "snapshot_at": self.snapshot_at.isoformat(),
            "score": self.score,
            "status": self.status.value,
            "components": self.components,
            "financials": {
                "mrr": self.mrr,
                "arr": self.arr,
                "mrr_growth_mom_pct": self.mrr_growth_mom,
                "ltv_cac_ratio": round(self.ltv_cac_ratio, 2),
                "monthly_churn_pct": round(self.monthly_churn_rate * 100, 2),
                "runway_months": self.runway_months,
                "gross_margin_pct": round(self.gross_margin * 100, 1),
            },
        }


@dataclass
class GrowthScore:
    """
    Score de crescimento: aquisição, ativação e expansão.

    Composto por:
        Signup Growth (25%), Activation Rate (25%), K-Factor (25%), Expansion MRR (25%)
    """
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    new_signups_30d: int = 0
    prev_signups_30d: int = 0
    activation_rate: float = 0.0      # 0.0 a 1.0
    k_factor: float = 0.0
    expansion_mrr: float = 0.0
    total_mrr: float = 0.0
    visitor_to_signup_rate: float = 0.0

    score: float = 0.0
    status: HealthStatus = HealthStatus.CRITICAL
    components: Dict[str, float] = field(default_factory=dict)

    def calculate(self) -> "GrowthScore":
        scores = {}

        # Signup Growth (25%) — benchmark: 20% MoM = 100pts
        signup_growth = 0.0
        if self.prev_signups_30d > 0:
            signup_growth = (self.new_signups_30d - self.prev_signups_30d) / self.prev_signups_30d * 100
        growth_score = min(max(signup_growth, 0) / 20.0, 1.0) * 100
        scores["signup_growth"] = round(growth_score, 1)

        # Activation Rate (25%) — benchmark: 60% = 100pts
        activation_score = min(self.activation_rate / 0.60, 1.0) * 100
        scores["activation_rate"] = round(activation_score, 1)

        # K-Factor (25%) — benchmark: 0.5 = 100pts (viral)
        k_score = min(self.k_factor / 0.5, 1.0) * 100
        scores["k_factor"] = round(k_score, 1)

        # Expansion MRR (25%) — benchmark: 10% do MRR total = 100pts
        expansion_rate = self.expansion_mrr / self.total_mrr if self.total_mrr > 0 else 0
        expansion_score = min(expansion_rate / 0.10, 1.0) * 100
        scores["expansion_mrr"] = round(expansion_score, 1)

        self.score = round(
            scores["signup_growth"]  * 0.25 +
            scores["activation_rate"]* 0.25 +
            scores["k_factor"]       * 0.25 +
            scores["expansion_mrr"]  * 0.25,
            1
        )
        self.status = HealthStatus.from_score(self.score)
        self.components = scores
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "snapshot_at": self.snapshot_at.isoformat(),
            "score": self.score,
            "status": self.status.value,
            "components": self.components,
            "metrics": {
                "new_signups_30d": self.new_signups_30d,
                "activation_rate_pct": round(self.activation_rate * 100, 1),
                "k_factor": round(self.k_factor, 3),
                "expansion_mrr": self.expansion_mrr,
                "visitor_to_signup_pct": round(self.visitor_to_signup_rate * 100, 2),
            },
        }


@dataclass
class ProductHealthScore:
    """
    Score de saúde do produto: qualidade, adoção e NPS.

    Composto por:
        NPS (30%), Feature Adoption (25%), Bug Rate (25%), DAU/MAU (20%)
    """
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    nps: float = 0.0                  # -100 a 100
    feature_adoption_rate: float = 0.0  # 0.0 a 1.0
    bug_rate_per_1k_sessions: float = 0.0
    dau_mau_ratio: float = 0.0
    crash_free_rate: float = 1.0      # 0.0 a 1.0
    avg_session_duration_min: float = 0.0

    score: float = 0.0
    status: HealthStatus = HealthStatus.CRITICAL
    components: Dict[str, float] = field(default_factory=dict)

    def calculate(self) -> "ProductHealthScore":
        scores = {}

        # NPS (30%) — benchmark: 50 = 100pts
        nps_score = min(max(self.nps + 100, 0) / 150.0, 1.0) * 100
        scores["nps"] = round(nps_score, 1)

        # Feature Adoption (25%) — benchmark: 40% = 100pts
        adoption_score = min(self.feature_adoption_rate / 0.40, 1.0) * 100
        scores["feature_adoption"] = round(adoption_score, 1)

        # Bug Rate (25%) — benchmark: <1 bug/1k sessions = 100pts
        bug_score = max(0, min((5.0 - self.bug_rate_per_1k_sessions) / 5.0, 1.0)) * 100
        scores["bug_rate"] = round(bug_score, 1)

        # DAU/MAU (20%) — benchmark: 0.25 = 100pts
        stickiness_score = min(self.dau_mau_ratio / 0.25, 1.0) * 100
        scores["stickiness"] = round(stickiness_score, 1)

        self.score = round(
            scores["nps"]            * 0.30 +
            scores["feature_adoption"]* 0.25 +
            scores["bug_rate"]       * 0.25 +
            scores["stickiness"]     * 0.20,
            1
        )
        self.status = HealthStatus.from_score(self.score)
        self.components = scores
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "snapshot_at": self.snapshot_at.isoformat(),
            "score": self.score,
            "status": self.status.value,
            "components": self.components,
            "metrics": {
                "nps": self.nps,
                "feature_adoption_pct": round(self.feature_adoption_rate * 100, 1),
                "bug_rate_per_1k": self.bug_rate_per_1k_sessions,
                "dau_mau_ratio": round(self.dau_mau_ratio, 3),
                "crash_free_pct": round(self.crash_free_rate * 100, 2),
                "avg_session_min": round(self.avg_session_duration_min, 1),
            },
        }


@dataclass
class CustomerHealthScore:
    """
    Score de saúde do cliente: retenção, satisfação e suporte.

    Composto por:
        D30 Retention (35%), CSAT (25%), Support SLA (20%), Churn Risk (20%)
    """
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    d30_retention: float = 0.0        # 0.0 a 1.0
    csat_score: float = 0.0           # 0 a 5
    support_sla_compliance: float = 0.0  # 0.0 a 1.0
    at_risk_users_pct: float = 0.0    # 0.0 a 1.0
    avg_response_time_hours: float = 0.0
    resolved_tickets_pct: float = 0.0

    score: float = 0.0
    status: HealthStatus = HealthStatus.CRITICAL
    components: Dict[str, float] = field(default_factory=dict)

    def calculate(self) -> "CustomerHealthScore":
        scores = {}

        # D30 Retention (35%) — benchmark: 30% = 100pts
        retention_score = min(self.d30_retention / 0.30, 1.0) * 100
        scores["d30_retention"] = round(retention_score, 1)

        # CSAT (25%) — benchmark: 4.5/5 = 100pts
        csat_score = min(self.csat_score / 4.5, 1.0) * 100
        scores["csat"] = round(csat_score, 1)

        # Support SLA (20%) — benchmark: 95% = 100pts
        sla_score = min(self.support_sla_compliance / 0.95, 1.0) * 100
        scores["support_sla"] = round(sla_score, 1)

        # Churn Risk (20%) — benchmark: <5% at risk = 100pts
        risk_score = max(0, min((0.20 - self.at_risk_users_pct) / 0.20, 1.0)) * 100
        scores["churn_risk"] = round(risk_score, 1)

        self.score = round(
            scores["d30_retention"] * 0.35 +
            scores["csat"]          * 0.25 +
            scores["support_sla"]   * 0.20 +
            scores["churn_risk"]    * 0.20,
            1
        )
        self.status = HealthStatus.from_score(self.score)
        self.components = scores
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "snapshot_at": self.snapshot_at.isoformat(),
            "score": self.score,
            "status": self.status.value,
            "components": self.components,
            "metrics": {
                "d30_retention_pct": round(self.d30_retention * 100, 1),
                "csat_score": self.csat_score,
                "support_sla_pct": round(self.support_sla_compliance * 100, 1),
                "at_risk_users_pct": round(self.at_risk_users_pct * 100, 1),
                "avg_response_hours": self.avg_response_time_hours,
                "resolved_tickets_pct": round(self.resolved_tickets_pct * 100, 1),
            },
        }


@dataclass
class PlatformHealthScore:
    """
    Score de saúde da plataforma: disponibilidade, performance e segurança.

    Composto por:
        Uptime (35%), P95 Latency (25%), Error Rate (25%), Security (15%)
    """
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    uptime_pct: float = 100.0         # 0.0 a 100.0
    p95_latency_ms: float = 0.0
    error_rate_pct: float = 0.0       # 0.0 a 100.0
    security_score: float = 100.0     # 0 a 100
    api_success_rate: float = 100.0   # 0.0 a 100.0
    avg_response_ms: float = 0.0
    incidents_30d: int = 0

    score: float = 0.0
    status: HealthStatus = HealthStatus.CRITICAL
    components: Dict[str, float] = field(default_factory=dict)

    def calculate(self) -> "PlatformHealthScore":
        scores = {}

        # Uptime (35%) — benchmark: 99.9% = 100pts
        uptime_score = min(self.uptime_pct / 99.9, 1.0) * 100
        scores["uptime"] = round(uptime_score, 1)

        # P95 Latency (25%) — benchmark: <500ms = 100pts, >3000ms = 0pts
        latency_score = max(0, min((3000 - self.p95_latency_ms) / 2500, 1.0)) * 100
        scores["p95_latency"] = round(latency_score, 1)

        # Error Rate (25%) — benchmark: <0.1% = 100pts, >5% = 0pts
        error_score = max(0, min((5.0 - self.error_rate_pct) / 5.0, 1.0)) * 100
        scores["error_rate"] = round(error_score, 1)

        # Security (15%) — direto 0-100
        scores["security"] = round(min(self.security_score, 100), 1)

        self.score = round(
            scores["uptime"]     * 0.35 +
            scores["p95_latency"]* 0.25 +
            scores["error_rate"] * 0.25 +
            scores["security"]   * 0.15,
            1
        )
        self.status = HealthStatus.from_score(self.score)
        self.components = scores
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "snapshot_at": self.snapshot_at.isoformat(),
            "score": self.score,
            "status": self.status.value,
            "components": self.components,
            "metrics": {
                "uptime_pct": self.uptime_pct,
                "p95_latency_ms": self.p95_latency_ms,
                "error_rate_pct": self.error_rate_pct,
                "security_score": self.security_score,
                "api_success_rate_pct": self.api_success_rate,
                "avg_response_ms": self.avg_response_ms,
                "incidents_30d": self.incidents_30d,
            },
        }


@dataclass
class CompanyHealthSnapshot:
    """
    Snapshot consolidado de saúde da empresa.

    Agrega os 5 health scores em uma visão única
    para o CEO e o board.
    """
    snapshot_at: datetime = field(default_factory=datetime.utcnow)

    business: BusinessHealthScore = field(default_factory=BusinessHealthScore)
    growth: GrowthScore = field(default_factory=GrowthScore)
    product: ProductHealthScore = field(default_factory=ProductHealthScore)
    customer: CustomerHealthScore = field(default_factory=CustomerHealthScore)
    platform: PlatformHealthScore = field(default_factory=PlatformHealthScore)

    overall_score: float = 0.0
    overall_status: HealthStatus = HealthStatus.CRITICAL

    def calculate_overall(self) -> "CompanyHealthSnapshot":
        """Calcula o score geral ponderado."""
        self.overall_score = round(
            self.business.score * 0.30 +
            self.growth.score   * 0.25 +
            self.product.score  * 0.20 +
            self.customer.score * 0.15 +
            self.platform.score * 0.10,
            1
        )
        self.overall_status = HealthStatus.from_score(self.overall_score)
        return self

    def get_critical_areas(self) -> List[str]:
        """Retorna áreas com status CRITICAL ou WARNING."""
        areas = []
        checks = [
            ("Negócio", self.business.status),
            ("Crescimento", self.growth.status),
            ("Produto", self.product.status),
            ("Clientes", self.customer.status),
            ("Plataforma", self.platform.status),
        ]
        for name, status in checks:
            if status in (HealthStatus.CRITICAL, HealthStatus.WARNING):
                areas.append(f"{name} ({status.value})")
        return areas

    def to_dict(self) -> Dict[str, Any]:
        return {
            "snapshot_at": self.snapshot_at.isoformat(),
            "overall_score": self.overall_score,
            "overall_status": self.overall_status.value,
            "scores": {
                "business": self.business.to_dict(),
                "growth": self.growth.to_dict(),
                "product": self.product.to_dict(),
                "customer": self.customer.to_dict(),
                "platform": self.platform.to_dict(),
            },
            "critical_areas": self.get_critical_areas(),
        }
