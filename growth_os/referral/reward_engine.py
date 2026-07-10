"""
Reward Engine
=============
Motor de recompensas do programa de referral da LifeOS.

Gerencia o catálogo de recompensas, regras de concessão,
expiração e resgate de benefícios.

Tipos de Recompensa:
    - Crédito de assinatura (dias grátis)
    - Desbloqueio de funcionalidades premium
    - Badges de reconhecimento
    - Pontos de fidelidade
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

from ..models.referral import ReferralReward, RewardType


class RewardCatalog:
    """Catálogo de recompensas disponíveis no programa."""

    SIGNUP_REWARD = {
        "type": RewardType.SUBSCRIPTION_CREDIT,
        "value": 7,
        "description": "7 dias grátis por usar um código de convite",
        "expires_days": 30,
    }

    ACTIVATION_REWARD_REFERRED = {
        "type": RewardType.SUBSCRIPTION_CREDIT,
        "value": 14,
        "description": "14 dias grátis por completar a ativação",
        "expires_days": 60,
    }

    ACTIVATION_REWARD_REFERRER = {
        "type": RewardType.SUBSCRIPTION_CREDIT,
        "value": 7,
        "description": "7 dias grátis: seu indicado foi ativado!",
        "expires_days": 60,
    }

    CONVERSION_REWARDS = {
        "pro": {
            "type": RewardType.SUBSCRIPTION_CREDIT,
            "value": 30,
            "description": "30 dias grátis: seu indicado assinou o Pro!",
            "expires_days": 90,
        },
        "ultra": {
            "type": RewardType.SUBSCRIPTION_CREDIT,
            "value": 60,
            "description": "60 dias grátis: seu indicado assinou o Ultra!",
            "expires_days": 90,
        },
        "enterprise": {
            "type": RewardType.SUBSCRIPTION_CREDIT,
            "value": 90,
            "description": "90 dias grátis: seu indicado assinou o Enterprise!",
            "expires_days": 180,
        },
    }

    MILESTONE_REWARDS = {
        5: {
            "type": RewardType.BADGE,
            "value": 1,
            "description": "Badge 'Conector': 5 indicações convertidas",
        },
        10: {
            "type": RewardType.FEATURE_UNLOCK,
            "value": 1,
            "description": "Desbloqueio: Analytics Avançado por 6 meses",
        },
        25: {
            "type": RewardType.UPGRADE,
            "value": 90,
            "description": "Upgrade gratuito para Ultra por 3 meses",
        },
        50: {
            "type": RewardType.CASH_BACK,
            "value": 500,
            "description": "R$ 500 de cashback por 50 conversões",
        },
    }


class RewardEngine:
    """
    Motor de recompensas da LifeOS.

    Gerencia concessão, expiração e resgate de recompensas
    do programa de referral e fidelidade.
    """

    def __init__(self):
        self._catalog = RewardCatalog()
        self._rewards: Dict[str, List[ReferralReward]] = {}
        self._conversion_counts: Dict[str, int] = {}
        """user_id → número de conversões geradas."""

    def create_reward(
        self,
        user_id: str,
        reward_type: RewardType,
        value: float,
        description: str,
        referral_id: str = "",
        expires_days: Optional[int] = None,
    ) -> ReferralReward:
        """Cria e registra uma nova recompensa para o usuário."""
        expires_at = None
        if expires_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_days)

        reward = ReferralReward(
            user_id=user_id,
            referral_id=referral_id,
            reward_type=reward_type,
            value=value,
            description=description,
            expires_at=expires_at,
        )

        if user_id not in self._rewards:
            self._rewards[user_id] = []
        self._rewards[user_id].append(reward)

        return reward

    def grant_signup_reward(self, referred_user_id: str, referral_id: str = "") -> ReferralReward:
        """Concede recompensa de boas-vindas ao usuário indicado."""
        cfg = self._catalog.SIGNUP_REWARD
        return self.create_reward(
            user_id=referred_user_id,
            reward_type=cfg["type"],
            value=cfg["value"],
            description=cfg["description"],
            referral_id=referral_id,
            expires_days=cfg["expires_days"],
        )

    def grant_activation_rewards(
        self,
        referrer_id: str,
        referred_id: str,
        referral_id: str = "",
    ) -> tuple:
        """Concede recompensas de ativação para ambos os lados."""
        cfg_referred = self._catalog.ACTIVATION_REWARD_REFERRED
        cfg_referrer = self._catalog.ACTIVATION_REWARD_REFERRER

        referred_reward = self.create_reward(
            user_id=referred_id,
            reward_type=cfg_referred["type"],
            value=cfg_referred["value"],
            description=cfg_referred["description"],
            referral_id=referral_id,
            expires_days=cfg_referred["expires_days"],
        )

        referrer_reward = self.create_reward(
            user_id=referrer_id,
            reward_type=cfg_referrer["type"],
            value=cfg_referrer["value"],
            description=cfg_referrer["description"],
            referral_id=referral_id,
            expires_days=cfg_referrer["expires_days"],
        )

        return referrer_reward, referred_reward

    def grant_conversion_reward(
        self,
        referrer_id: str,
        plan: str,
        referral_id: str = "",
    ) -> ReferralReward:
        """Concede recompensa máxima ao indicador por conversão."""
        cfg = self._catalog.CONVERSION_REWARDS.get(
            plan, self._catalog.CONVERSION_REWARDS["pro"]
        )

        reward = self.create_reward(
            user_id=referrer_id,
            reward_type=cfg["type"],
            value=cfg["value"],
            description=cfg["description"],
            referral_id=referral_id,
            expires_days=cfg["expires_days"],
        )

        # Atualiza contador de conversões para milestone rewards
        self._conversion_counts[referrer_id] = self._conversion_counts.get(referrer_id, 0) + 1
        milestone_reward = self._check_milestone_reward(referrer_id)

        return reward

    def _check_milestone_reward(self, user_id: str) -> Optional[ReferralReward]:
        """Verifica se o usuário atingiu um marco de recompensa."""
        count = self._conversion_counts.get(user_id, 0)
        milestone_cfg = self._catalog.MILESTONE_REWARDS.get(count)

        if not milestone_cfg:
            return None

        return self.create_reward(
            user_id=user_id,
            reward_type=milestone_cfg["type"],
            value=milestone_cfg["value"],
            description=milestone_cfg["description"],
        )

    def expire_old_rewards(self) -> int:
        """Expira recompensas vencidas. Retorna o número de recompensas expiradas."""
        now = datetime.utcnow()
        expired_count = 0

        for rewards in self._rewards.values():
            for reward in rewards:
                if (
                    not reward.is_redeemed
                    and reward.expires_at
                    and reward.expires_at < now
                ):
                    reward.is_redeemed = True
                    reward.redeemed_at = now
                    expired_count += 1

        return expired_count

    def get_user_rewards_summary(self, user_id: str) -> Dict[str, Any]:
        """Resumo de recompensas de um usuário."""
        rewards = self._rewards.get(user_id, [])
        now = datetime.utcnow()

        active = [r for r in rewards if not r.is_redeemed and (not r.expires_at or r.expires_at > now)]
        redeemed = [r for r in rewards if r.is_redeemed]
        expired = [r for r in rewards if r.expires_at and r.expires_at <= now and not r.is_redeemed]

        total_days = sum(r.value for r in active if r.reward_type == RewardType.SUBSCRIPTION_CREDIT)

        return {
            "user_id": user_id,
            "total_rewards": len(rewards),
            "active_rewards": len(active),
            "redeemed_rewards": len(redeemed),
            "expired_rewards": len(expired),
            "available_credit_days": total_days,
            "conversions_generated": self._conversion_counts.get(user_id, 0),
            "rewards": [r.to_dict() for r in active],
        }

    def get_leaderboard(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Ranking dos maiores indicadores da LifeOS.

        Ordenado por número de conversões geradas.
        """
        leaderboard = [
            {
                "user_id": user_id,
                "conversions": count,
                "rank": 0,
            }
            for user_id, count in self._conversion_counts.items()
        ]

        leaderboard.sort(key=lambda x: x["conversions"], reverse=True)

        for i, entry in enumerate(leaderboard[:limit]):
            entry["rank"] = i + 1

        return leaderboard[:limit]
