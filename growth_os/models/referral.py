"""
Referral Models
===============
Modelos para o sistema de referral e programa de recompensas da LifeOS.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid
import hashlib
import random
import string


class RewardType(str, Enum):
    """Tipos de recompensa disponíveis no programa de referral."""

    SUBSCRIPTION_CREDIT = "subscription_credit"
    """Crédito na assinatura (dias grátis ou desconto)."""

    FEATURE_UNLOCK = "feature_unlock"
    """Desbloqueio de funcionalidade premium."""

    CASH_BACK = "cash_back"
    """Cashback em dinheiro."""

    UPGRADE = "upgrade"
    """Upgrade temporário de plano."""

    BADGE = "badge"
    """Badge exclusivo de reconhecimento."""

    POINTS = "points"
    """Pontos no programa de fidelidade."""


class ReferralStatus(str, Enum):
    """Status de um referral."""

    PENDING = "pending"
    """Link compartilhado mas destinatário ainda não se cadastrou."""

    SIGNED_UP = "signed_up"
    """Destinatário se cadastrou mas ainda não foi ativado."""

    ACTIVATED = "activated"
    """Destinatário foi ativado (qualificado para recompensa)."""

    CONVERTED = "converted"
    """Destinatário se tornou assinante pago (recompensa máxima)."""

    EXPIRED = "expired"
    """Referral expirou sem conversão."""

    FRAUDULENT = "fraudulent"
    """Referral identificado como fraudulento."""


@dataclass
class ReferralCode:
    """
    Código de referral único de um usuário.

    Cada usuário recebe um código único ao se cadastrar,
    que pode ser compartilhado por link ou código direto.
    """

    code_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    code: str = ""
    """Código alfanumérico curto (ex: LIFEOS-ABC123)."""
    link: str = ""
    """URL completa de referral."""
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    is_active: bool = True

    # Estatísticas
    times_shared: int = 0
    times_clicked: int = 0
    signups_generated: int = 0
    activations_generated: int = 0
    conversions_generated: int = 0
    revenue_generated: float = 0.0

    @classmethod
    def generate(cls, user_id: str, base_url: str = "https://lifeos.app/join") -> "ReferralCode":
        """Gera um novo código de referral para o usuário."""
        # Gera código único baseado no user_id + salt aleatório
        salt = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        hash_input = f"{user_id}{salt}"
        code_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:6].upper()
        code = f"LIFE-{code_hash}"
        link = f"{base_url}?ref={code}"

        return cls(
            user_id=user_id,
            code=code,
            link=link,
        )

    @property
    def conversion_rate(self) -> float:
        if self.times_clicked == 0:
            return 0.0
        return self.conversions_generated / self.times_clicked

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code_id": self.code_id,
            "user_id": self.user_id,
            "code": self.code,
            "link": self.link,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "stats": {
                "times_shared": self.times_shared,
                "times_clicked": self.times_clicked,
                "signups": self.signups_generated,
                "activations": self.activations_generated,
                "conversions": self.conversions_generated,
                "revenue": round(self.revenue_generated, 2),
                "conversion_rate_pct": round(self.conversion_rate * 100, 2),
            },
        }


@dataclass
class ReferralReward:
    """
    Recompensa concedida por uma indicação bem-sucedida.

    Tanto o indicador quanto o indicado podem receber recompensas,
    conforme as regras do programa ativo.
    """

    reward_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    """Usuário que recebe a recompensa."""
    referral_id: str = ""
    reward_type: RewardType = RewardType.SUBSCRIPTION_CREDIT
    value: float = 0.0
    """Valor da recompensa (dias, R$, pontos, etc.)."""
    description: str = ""
    earned_at: datetime = field(default_factory=datetime.utcnow)
    redeemed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_redeemed: bool = False

    def redeem(self) -> None:
        """Marca a recompensa como resgatada."""
        self.is_redeemed = True
        self.redeemed_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reward_id": self.reward_id,
            "user_id": self.user_id,
            "referral_id": self.referral_id,
            "type": self.reward_type.value,
            "value": self.value,
            "description": self.description,
            "earned_at": self.earned_at.isoformat(),
            "redeemed_at": self.redeemed_at.isoformat() if self.redeemed_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_redeemed": self.is_redeemed,
        }


@dataclass
class Referral:
    """
    Registro de uma indicação específica.

    Rastreia a jornada de um usuário indicado desde o clique
    no link até a conversão em assinante.
    """

    referral_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    referrer_user_id: str = ""
    """Usuário que fez a indicação."""
    referred_user_id: str = ""
    """Usuário indicado (preenchido após cadastro)."""
    referral_code: str = ""
    status: ReferralStatus = ReferralStatus.PENDING

    clicked_at: Optional[datetime] = None
    signed_up_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    converted_at: Optional[datetime] = None

    referrer_reward: Optional[ReferralReward] = None
    referred_reward: Optional[ReferralReward] = None

    revenue_attributed: float = 0.0
    source: str = ""
    """Canal pelo qual o link foi compartilhado."""

    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "referral_id": self.referral_id,
            "referrer_user_id": self.referrer_user_id,
            "referred_user_id": self.referred_user_id,
            "referral_code": self.referral_code,
            "status": self.status.value,
            "timeline": {
                "clicked_at": self.clicked_at.isoformat() if self.clicked_at else None,
                "signed_up_at": self.signed_up_at.isoformat() if self.signed_up_at else None,
                "activated_at": self.activated_at.isoformat() if self.activated_at else None,
                "converted_at": self.converted_at.isoformat() if self.converted_at else None,
            },
            "rewards": {
                "referrer": self.referrer_reward.to_dict() if self.referrer_reward else None,
                "referred": self.referred_reward.to_dict() if self.referred_reward else None,
            },
            "revenue_attributed": round(self.revenue_attributed, 2),
            "source": self.source,
        }


@dataclass
class ReferralProgram:
    """
    Configuração do programa de referral ativo.

    Define as regras, recompensas e limites do programa
    de indicação da LifeOS.
    """

    program_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "LifeOS Referral Program"
    description: str = "Indique amigos e ganhe recompensas exclusivas"
    is_active: bool = True

    # Recompensas para o indicador
    referrer_reward_on_signup: Optional[ReferralReward] = None
    referrer_reward_on_activation: Optional[ReferralReward] = None
    referrer_reward_on_conversion: Optional[ReferralReward] = None

    # Recompensas para o indicado
    referred_reward_on_signup: Optional[ReferralReward] = None
    referred_reward_on_activation: Optional[ReferralReward] = None

    # Limites
    max_referrals_per_user: int = 50
    max_reward_per_user: float = 500.0
    referral_expiry_days: int = 30

    # Regras de qualificação
    min_days_active_to_qualify: int = 3
    """Número mínimo de dias ativos para o indicado qualificar."""
    require_subscription_for_max_reward: bool = True

    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "program_id": self.program_id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "rewards": {
                "referrer": {
                    "on_signup": self.referrer_reward_on_signup.to_dict() if self.referrer_reward_on_signup else None,
                    "on_activation": self.referrer_reward_on_activation.to_dict() if self.referrer_reward_on_activation else None,
                    "on_conversion": self.referrer_reward_on_conversion.to_dict() if self.referrer_reward_on_conversion else None,
                },
                "referred": {
                    "on_signup": self.referred_reward_on_signup.to_dict() if self.referred_reward_on_signup else None,
                    "on_activation": self.referred_reward_on_activation.to_dict() if self.referred_reward_on_activation else None,
                },
            },
            "limits": {
                "max_referrals_per_user": self.max_referrals_per_user,
                "max_reward_per_user": self.max_reward_per_user,
                "referral_expiry_days": self.referral_expiry_days,
                "min_days_active_to_qualify": self.min_days_active_to_qualify,
            },
        }
