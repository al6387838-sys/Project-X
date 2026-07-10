"""
User Journey Model
==================
Rastreia a jornada completa de cada usuário pelo funil da LifeOS,
desde o primeiro contato até o estado atual.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid

from .funnel import FunnelStage, FunnelEvent, FunnelConversion


class JourneyStatus(str, Enum):
    """Status atual da jornada do usuário."""

    ACTIVE = "active"
    """Usuário em progressão ativa no funil."""

    STALLED = "stalled"
    """Usuário parado em um estágio há mais de 7 dias."""

    CHURNED = "churned"
    """Usuário que abandonou o produto."""

    REACTIVATED = "reactivated"
    """Usuário que voltou após período de inatividade."""

    CONVERTED = "converted"
    """Usuário que atingiu o estágio de assinatura."""


class UserProfile(str, Enum):
    """Perfil do usuário para onboarding adaptativo."""

    PROFESSIONAL = "professional"
    """Profissional focado em produtividade e carreira."""

    STUDENT = "student"
    """Estudante focado em aprendizado e organização."""

    ENTREPRENEUR = "entrepreneur"
    """Empreendedor focado em projetos e metas de negócio."""

    WELLNESS = "wellness"
    """Usuário focado em saúde, bem-estar e hábitos."""

    CREATIVE = "creative"
    """Criativo focado em projetos artísticos e expressão."""

    UNKNOWN = "unknown"
    """Perfil ainda não identificado."""


@dataclass
class JourneyMilestone:
    """Marco importante na jornada do usuário."""

    milestone_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    achieved_at: datetime = field(default_factory=datetime.utcnow)
    stage: FunnelStage = FunnelStage.VISITOR
    points_awarded: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "milestone_id": self.milestone_id,
            "name": self.name,
            "description": self.description,
            "achieved_at": self.achieved_at.isoformat(),
            "stage": self.stage.value,
            "points_awarded": self.points_awarded,
        }


@dataclass
class UserJourney:
    """
    Jornada completa de um usuário pelo funil da LifeOS.

    Registra cada evento, conversão e marco atingido,
    permitindo análise granular da progressão individual.
    """

    journey_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    current_stage: FunnelStage = FunnelStage.VISITOR
    status: JourneyStatus = JourneyStatus.ACTIVE
    profile: UserProfile = UserProfile.UNKNOWN

    # Timestamps de progressão
    first_seen_at: Optional[datetime] = None
    signed_up_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    first_active_at: Optional[datetime] = None
    subscribed_at: Optional[datetime] = None
    churned_at: Optional[datetime] = None
    reactivated_at: Optional[datetime] = None

    # Atributos de aquisição
    acquisition_source: str = ""
    acquisition_campaign: str = ""
    acquisition_channel: str = ""
    referral_code_used: str = ""
    referrer_user_id: str = ""

    # Engajamento
    total_sessions: int = 0
    total_events: int = 0
    last_active_at: Optional[datetime] = None
    streak_days: int = 0
    longest_streak_days: int = 0
    goals_created: int = 0
    goals_completed: int = 0
    features_used: List[str] = field(default_factory=list)

    # Onboarding
    onboarding_completed: bool = False
    onboarding_step: int = 0
    onboarding_profile_set: bool = False

    # Referral
    referral_code: str = ""
    referrals_sent: int = 0
    referrals_converted: int = 0
    referral_revenue_generated: float = 0.0

    # Receita
    total_revenue: float = 0.0
    current_plan: str = "free"
    subscription_started_at: Optional[datetime] = None

    # Histórico
    events: List[FunnelEvent] = field(default_factory=list)
    conversions: List[FunnelConversion] = field(default_factory=list)
    milestones: List[JourneyMilestone] = field(default_factory=list)

    # Metadados
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def add_event(self, event: FunnelEvent) -> None:
        """Registra um novo evento na jornada."""
        self.events.append(event)
        self.total_events += 1
        self.last_active_at = event.timestamp
        self.updated_at = datetime.utcnow()

    def advance_stage(self, new_stage: FunnelStage, source: str = "", campaign: str = "") -> FunnelConversion:
        """
        Avança o usuário para o próximo estágio do funil.

        Cria automaticamente um registro de conversão com o tempo
        decorrido desde o estágio anterior.
        """
        time_elapsed = 0.0
        if self.events:
            stage_entry_time = self._get_stage_entry_time(self.current_stage)
            if stage_entry_time:
                time_elapsed = (datetime.utcnow() - stage_entry_time).total_seconds()

        conversion = FunnelConversion(
            user_id=self.user_id,
            from_stage=self.current_stage,
            to_stage=new_stage,
            time_to_convert_seconds=time_elapsed,
            source=source or self.acquisition_source,
            campaign=campaign or self.acquisition_campaign,
            referral_code=self.referral_code_used,
        )

        self.conversions.append(conversion)
        self.current_stage = new_stage
        self.updated_at = datetime.utcnow()

        # Atualiza timestamps de estágio
        now = datetime.utcnow()
        if new_stage == FunnelStage.SIGNUP:
            self.signed_up_at = now
        elif new_stage == FunnelStage.ACTIVATED:
            self.activated_at = now
        elif new_stage == FunnelStage.ACTIVE:
            self.first_active_at = now
        elif new_stage in (FunnelStage.SUBSCRIBER_PRO, FunnelStage.SUBSCRIBER_ULTRA, FunnelStage.ENTERPRISE):
            self.subscribed_at = now
        elif new_stage == FunnelStage.CHURNED:
            self.churned_at = now
            self.status = JourneyStatus.CHURNED

        return conversion

    def add_milestone(self, name: str, description: str, points: int = 0) -> JourneyMilestone:
        """Registra um marco atingido na jornada."""
        milestone = JourneyMilestone(
            name=name,
            description=description,
            achieved_at=datetime.utcnow(),
            stage=self.current_stage,
            points_awarded=points,
        )
        self.milestones.append(milestone)
        return milestone

    def _get_stage_entry_time(self, stage: FunnelStage) -> Optional[datetime]:
        """Retorna o timestamp de entrada em um estágio."""
        stage_times = {
            FunnelStage.VISITOR: self.first_seen_at,
            FunnelStage.SIGNUP: self.signed_up_at,
            FunnelStage.ACTIVATED: self.activated_at,
            FunnelStage.ACTIVE: self.first_active_at,
        }
        return stage_times.get(stage)

    @property
    def days_since_signup(self) -> Optional[float]:
        if self.signed_up_at:
            return (datetime.utcnow() - self.signed_up_at).days
        return None

    @property
    def days_since_last_active(self) -> Optional[float]:
        if self.last_active_at:
            return (datetime.utcnow() - self.last_active_at).days
        return None

    @property
    def is_at_risk(self) -> bool:
        """Usuário em risco de churn (inativo há 7+ dias)."""
        days = self.days_since_last_active
        return days is not None and days >= 7

    def to_dict(self) -> Dict[str, Any]:
        return {
            "journey_id": self.journey_id,
            "user_id": self.user_id,
            "current_stage": self.current_stage.value,
            "status": self.status.value,
            "profile": self.profile.value,
            "acquisition": {
                "source": self.acquisition_source,
                "campaign": self.acquisition_campaign,
                "channel": self.acquisition_channel,
                "referral_code_used": self.referral_code_used,
            },
            "engagement": {
                "total_sessions": self.total_sessions,
                "total_events": self.total_events,
                "streak_days": self.streak_days,
                "goals_created": self.goals_created,
                "goals_completed": self.goals_completed,
                "features_used": self.features_used,
                "is_at_risk": self.is_at_risk,
            },
            "onboarding": {
                "completed": self.onboarding_completed,
                "step": self.onboarding_step,
                "profile_set": self.onboarding_profile_set,
            },
            "referral": {
                "code": self.referral_code,
                "sent": self.referrals_sent,
                "converted": self.referrals_converted,
                "revenue_generated": self.referral_revenue_generated,
            },
            "revenue": {
                "total": self.total_revenue,
                "current_plan": self.current_plan,
            },
            "timestamps": {
                "first_seen": self.first_seen_at.isoformat() if self.first_seen_at else None,
                "signed_up": self.signed_up_at.isoformat() if self.signed_up_at else None,
                "activated": self.activated_at.isoformat() if self.activated_at else None,
                "first_active": self.first_active_at.isoformat() if self.first_active_at else None,
                "subscribed": self.subscribed_at.isoformat() if self.subscribed_at else None,
                "last_active": self.last_active_at.isoformat() if self.last_active_at else None,
                "days_since_signup": self.days_since_signup,
                "days_since_last_active": self.days_since_last_active,
            },
            "milestones": [m.to_dict() for m in self.milestones],
        }
