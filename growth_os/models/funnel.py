"""
Funnel Model
============
Modelos de dados para o funil completo de crescimento da LifeOS.

Funil:
    Visitante → Cadastro → Usuário Ativado → Usuário Ativo
    → Assinante Pro → Assinante Ultra → Enterprise

Métricas:
    Visitor→Signup | Signup→Activation | Activation→Retention
    Retention→Subscription | Subscription→Referral
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
import uuid


class FunnelStage(str, Enum):
    """Estágios do funil de crescimento da LifeOS."""

    VISITOR = "visitor"
    """Visitante: chegou ao site/app mas ainda não se cadastrou."""

    SIGNUP = "signup"
    """Cadastro: criou conta mas ainda não completou onboarding."""

    ACTIVATED = "activated"
    """Usuário Ativado: completou onboarding e realizou ação-chave."""

    ACTIVE = "active"
    """Usuário Ativo: usa o produto regularmente (≥3 sessões/semana)."""

    SUBSCRIBER_PRO = "subscriber_pro"
    """Assinante Pro: converteu para plano pago Pro."""

    SUBSCRIBER_ULTRA = "subscriber_ultra"
    """Assinante Ultra: converteu para plano pago Ultra."""

    ENTERPRISE = "enterprise"
    """Enterprise: cliente corporativo com contrato enterprise."""

    CHURNED = "churned"
    """Churned: usuário que abandonou o produto."""

    DORMANT = "dormant"
    """Dormant: usuário inativo há mais de 30 dias."""


class FunnelEventType(str, Enum):
    """Tipos de eventos rastreados no funil."""

    # Aquisição
    PAGE_VIEW = "page_view"
    LANDING_PAGE_VIEW = "landing_page_view"
    SIGNUP_STARTED = "signup_started"
    SIGNUP_COMPLETED = "signup_completed"
    EMAIL_VERIFIED = "email_verified"

    # Ativação
    ONBOARDING_STARTED = "onboarding_started"
    ONBOARDING_STEP_COMPLETED = "onboarding_step_completed"
    ONBOARDING_COMPLETED = "onboarding_completed"
    FIRST_ACTION_COMPLETED = "first_action_completed"
    AHA_MOMENT_REACHED = "aha_moment_reached"

    # Retenção
    SESSION_STARTED = "session_started"
    FEATURE_USED = "feature_used"
    GOAL_CREATED = "goal_created"
    GOAL_COMPLETED = "goal_completed"
    STREAK_ACHIEVED = "streak_achieved"

    # Conversão
    UPGRADE_VIEWED = "upgrade_viewed"
    TRIAL_STARTED = "trial_started"
    SUBSCRIPTION_CREATED = "subscription_created"
    SUBSCRIPTION_UPGRADED = "subscription_upgraded"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"

    # Referral
    REFERRAL_LINK_GENERATED = "referral_link_generated"
    REFERRAL_LINK_SHARED = "referral_link_shared"
    REFERRAL_SIGNUP = "referral_signup"
    REFERRAL_CONVERTED = "referral_converted"
    REWARD_EARNED = "reward_earned"
    REWARD_REDEEMED = "reward_redeemed"

    # Churn
    CANCELLATION_STARTED = "cancellation_started"
    CANCELLATION_COMPLETED = "cancellation_completed"
    REACTIVATION = "reactivation"


@dataclass
class FunnelEvent:
    """
    Evento rastreado no funil de crescimento.

    Cada interação do usuário gera um FunnelEvent que alimenta
    as métricas de conversão e retenção.
    """

    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    session_id: str = ""
    event_type: FunnelEventType = FunnelEventType.PAGE_VIEW
    funnel_stage: FunnelStage = FunnelStage.VISITOR
    timestamp: datetime = field(default_factory=datetime.utcnow)
    properties: Dict[str, Any] = field(default_factory=dict)
    source: str = ""
    """Canal de aquisição: organic, paid, referral, email, social."""
    campaign: str = ""
    """Campanha de marketing associada ao evento."""
    device: str = ""
    """Dispositivo: web, ios, android."""
    country: str = ""
    revenue: float = 0.0
    """Receita associada ao evento (para eventos de conversão)."""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "event_type": self.event_type.value,
            "funnel_stage": self.funnel_stage.value,
            "timestamp": self.timestamp.isoformat(),
            "properties": self.properties,
            "source": self.source,
            "campaign": self.campaign,
            "device": self.device,
            "country": self.country,
            "revenue": self.revenue,
        }


@dataclass
class FunnelConversion:
    """
    Conversão entre dois estágios do funil.

    Rastreia a transição de um usuário de um estágio para o próximo,
    incluindo o tempo levado e o canal responsável.
    """

    conversion_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    from_stage: FunnelStage = FunnelStage.VISITOR
    to_stage: FunnelStage = FunnelStage.SIGNUP
    converted_at: datetime = field(default_factory=datetime.utcnow)
    time_to_convert_seconds: float = 0.0
    """Tempo em segundos desde o estágio anterior até a conversão."""
    source: str = ""
    campaign: str = ""
    referral_code: str = ""

    @property
    def time_to_convert_hours(self) -> float:
        return self.time_to_convert_seconds / 3600

    @property
    def time_to_convert_days(self) -> float:
        return self.time_to_convert_seconds / 86400

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conversion_id": self.conversion_id,
            "user_id": self.user_id,
            "from_stage": self.from_stage.value,
            "to_stage": self.to_stage.value,
            "converted_at": self.converted_at.isoformat(),
            "time_to_convert_hours": round(self.time_to_convert_hours, 2),
            "time_to_convert_days": round(self.time_to_convert_days, 2),
            "source": self.source,
            "campaign": self.campaign,
            "referral_code": self.referral_code,
        }


@dataclass
class FunnelMetrics:
    """
    Métricas agregadas do funil de crescimento.

    Calculadas em janelas de tempo (diário, semanal, mensal).
    """

    period_start: datetime = field(default_factory=datetime.utcnow)
    period_end: datetime = field(default_factory=datetime.utcnow)
    period_type: str = "daily"
    """Tipo de período: daily, weekly, monthly."""

    # Volumes por estágio
    visitors: int = 0
    signups: int = 0
    activated_users: int = 0
    active_users: int = 0
    pro_subscribers: int = 0
    ultra_subscribers: int = 0
    enterprise_accounts: int = 0
    churned_users: int = 0

    # Taxas de conversão (0.0 a 1.0)
    visitor_to_signup_rate: float = 0.0
    signup_to_activation_rate: float = 0.0
    activation_to_retention_rate: float = 0.0
    retention_to_subscription_rate: float = 0.0
    subscription_to_referral_rate: float = 0.0
    overall_conversion_rate: float = 0.0

    # Retenção
    day1_retention: float = 0.0
    day7_retention: float = 0.0
    day30_retention: float = 0.0
    day90_retention: float = 0.0

    # Churn
    monthly_churn_rate: float = 0.0
    annual_churn_rate: float = 0.0

    # Receita
    mrr: float = 0.0
    """Monthly Recurring Revenue."""
    arr: float = 0.0
    """Annual Recurring Revenue."""
    arpu: float = 0.0
    """Average Revenue Per User."""
    ltv: float = 0.0
    """Lifetime Value."""
    cac: float = 0.0
    """Customer Acquisition Cost."""
    ltv_cac_ratio: float = 0.0

    # Referral
    referral_rate: float = 0.0
    viral_coefficient: float = 0.0
    """K-factor: número médio de novos usuários gerados por cada usuário."""

    # NPS
    nps_score: float = 0.0

    def compute_derived_metrics(self) -> None:
        """Recalcula métricas derivadas a partir dos dados brutos."""
        if self.visitors > 0:
            self.visitor_to_signup_rate = self.signups / self.visitors

        if self.signups > 0:
            self.signup_to_activation_rate = self.activated_users / self.signups

        if self.activated_users > 0:
            self.activation_to_retention_rate = self.active_users / self.activated_users

        total_subscribers = self.pro_subscribers + self.ultra_subscribers + self.enterprise_accounts
        if self.active_users > 0:
            self.retention_to_subscription_rate = total_subscribers / self.active_users

        if self.visitors > 0:
            self.overall_conversion_rate = total_subscribers / self.visitors

        if self.mrr > 0:
            self.arr = self.mrr * 12

        if total_subscribers > 0:
            self.arpu = self.mrr / total_subscribers

        if self.monthly_churn_rate > 0 and self.arpu > 0:
            self.ltv = self.arpu / self.monthly_churn_rate

        if self.cac > 0 and self.ltv > 0:
            self.ltv_cac_ratio = self.ltv / self.cac

        if self.annual_churn_rate == 0 and self.monthly_churn_rate > 0:
            self.annual_churn_rate = 1 - (1 - self.monthly_churn_rate) ** 12

    def to_dict(self) -> Dict[str, Any]:
        return {
            "period": {
                "start": self.period_start.isoformat(),
                "end": self.period_end.isoformat(),
                "type": self.period_type,
            },
            "funnel": {
                "visitors": self.visitors,
                "signups": self.signups,
                "activated_users": self.activated_users,
                "active_users": self.active_users,
                "pro_subscribers": self.pro_subscribers,
                "ultra_subscribers": self.ultra_subscribers,
                "enterprise_accounts": self.enterprise_accounts,
                "churned_users": self.churned_users,
            },
            "conversion_rates": {
                "visitor_to_signup": round(self.visitor_to_signup_rate * 100, 2),
                "signup_to_activation": round(self.signup_to_activation_rate * 100, 2),
                "activation_to_retention": round(self.activation_to_retention_rate * 100, 2),
                "retention_to_subscription": round(self.retention_to_subscription_rate * 100, 2),
                "subscription_to_referral": round(self.subscription_to_referral_rate * 100, 2),
                "overall": round(self.overall_conversion_rate * 100, 2),
            },
            "retention": {
                "day1": round(self.day1_retention * 100, 2),
                "day7": round(self.day7_retention * 100, 2),
                "day30": round(self.day30_retention * 100, 2),
                "day90": round(self.day90_retention * 100, 2),
            },
            "churn": {
                "monthly_rate": round(self.monthly_churn_rate * 100, 2),
                "annual_rate": round(self.annual_churn_rate * 100, 2),
            },
            "revenue": {
                "mrr": round(self.mrr, 2),
                "arr": round(self.arr, 2),
                "arpu": round(self.arpu, 2),
                "ltv": round(self.ltv, 2),
                "cac": round(self.cac, 2),
                "ltv_cac_ratio": round(self.ltv_cac_ratio, 2),
            },
            "referral": {
                "referral_rate": round(self.referral_rate * 100, 2),
                "viral_coefficient": round(self.viral_coefficient, 3),
            },
            "nps": round(self.nps_score, 1),
        }
