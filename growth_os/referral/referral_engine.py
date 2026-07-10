"""
Referral Engine
===============
Motor de referral do Growth OS da LifeOS.

Gerencia todo o ciclo de vida de indicações:
- Geração de códigos únicos por usuário
- Rastreamento de cliques e cadastros via link
- Validação de qualificação para recompensas
- Detecção de fraude
- Cálculo de impacto no crescimento (K-factor)

Programa de Recompensas:
    Indicador recebe: 30 dias grátis por conversão
    Indicado recebe:  14 dias grátis ao se ativar
"""

from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
import uuid

from ..models.referral import (
    ReferralCode, Referral, ReferralReward, ReferralProgram,
    ReferralStatus, RewardType
)
from ..models.user_journey import UserJourney


class ReferralEngine:
    """
    Motor de referral da LifeOS.

    Ponto central para todas as operações de indicação:
    geração de links, rastreamento, validação e recompensas.
    """

    # Configuração padrão do programa
    DEFAULT_PROGRAM = ReferralProgram(
        name="LifeOS Referral Program",
        description="Indique amigos e ganhe dias grátis no LifeOS",
        max_referrals_per_user=50,
        max_reward_per_user=365,  # dias
        referral_expiry_days=30,
        min_days_active_to_qualify=3,
    )

    BASE_URL = "https://lifeos.app/join"

    def __init__(self, program: Optional[ReferralProgram] = None):
        self._program = program or self.DEFAULT_PROGRAM
        self._codes: Dict[str, ReferralCode] = {}
        """user_id → ReferralCode"""
        self._code_map: Dict[str, str] = {}
        """code → user_id"""
        self._referrals: Dict[str, Referral] = {}
        """referral_id → Referral"""
        self._user_referrals: Dict[str, List[str]] = {}
        """user_id → [referral_id, ...]"""
        self._rewards: Dict[str, List[ReferralReward]] = {}
        """user_id → [ReferralReward, ...]"""
        self._fraud_blacklist: set = set()

    # ─────────────────────────────────────────────
    # Geração de Códigos
    # ─────────────────────────────────────────────

    def generate_code(self, user_id: str) -> ReferralCode:
        """
        Gera ou retorna o código de referral de um usuário.

        Cada usuário tem exatamente um código ativo.
        Se já existir, retorna o existente.
        """
        if user_id in self._codes:
            return self._codes[user_id]

        code = ReferralCode.generate(user_id, self.BASE_URL)
        self._codes[user_id] = code
        self._code_map[code.code] = user_id

        return code

    def get_referral_link(self, user_id: str) -> str:
        """Retorna o link de referral do usuário."""
        code = self.generate_code(user_id)
        return code.link

    def get_referral_code(self, user_id: str) -> str:
        """Retorna o código alfanumérico de referral do usuário."""
        code = self.generate_code(user_id)
        return code.code

    # ─────────────────────────────────────────────
    # Rastreamento de Indicações
    # ─────────────────────────────────────────────

    def track_link_click(
        self,
        referral_code: str,
        session_id: str = "",
        source: str = "",
    ) -> Optional[Referral]:
        """
        Rastreia um clique no link de referral.

        Cria um registro de referral pendente para rastreamento.
        """
        referrer_id = self._code_map.get(referral_code)
        if not referrer_id:
            return None

        if referrer_id in self._fraud_blacklist:
            return None

        # Verifica limite de referrals
        user_referrals = self._user_referrals.get(referrer_id, [])
        if len(user_referrals) >= self._program.max_referrals_per_user:
            return None

        referral = Referral(
            referrer_user_id=referrer_id,
            referral_code=referral_code,
            status=ReferralStatus.PENDING,
            clicked_at=datetime.utcnow(),
            source=source,
        )

        self._referrals[referral.referral_id] = referral

        if referrer_id not in self._user_referrals:
            self._user_referrals[referrer_id] = []
        self._user_referrals[referrer_id].append(referral.referral_id)

        # Atualiza stats do código
        if referrer_id in self._codes:
            self._codes[referrer_id].times_clicked += 1

        return referral

    def track_signup(
        self,
        referral_code: str,
        referred_user_id: str,
    ) -> Optional[Referral]:
        """
        Registra o cadastro de um usuário via referral.

        Avança o status do referral para SIGNED_UP e
        concede recompensa de boas-vindas ao indicado.
        """
        referrer_id = self._code_map.get(referral_code)
        if not referrer_id:
            return None

        # Encontra o referral pendente mais recente
        referral = self._find_pending_referral(referrer_id)
        if not referral:
            # Cria novo referral se não houver pendente
            referral = Referral(
                referrer_user_id=referrer_id,
                referral_code=referral_code,
                clicked_at=datetime.utcnow(),
            )
            self._referrals[referral.referral_id] = referral
            if referrer_id not in self._user_referrals:
                self._user_referrals[referrer_id] = []
            self._user_referrals[referrer_id].append(referral.referral_id)

        referral.referred_user_id = referred_user_id
        referral.signed_up_at = datetime.utcnow()
        referral.status = ReferralStatus.SIGNED_UP

        # Recompensa de boas-vindas para o indicado
        referred_reward = ReferralReward(
            user_id=referred_user_id,
            referral_id=referral.referral_id,
            reward_type=RewardType.SUBSCRIPTION_CREDIT,
            value=7,  # 7 dias grátis ao se cadastrar
            description="7 dias grátis por usar um código de convite",
        )
        referral.referred_reward = referred_reward
        self._add_reward(referred_user_id, referred_reward)

        # Atualiza stats
        if referrer_id in self._codes:
            self._codes[referrer_id].signups_generated += 1

        return referral

    def track_activation(
        self,
        referred_user_id: str,
        days_active: int = 0,
    ) -> Optional[Tuple[Referral, Optional[ReferralReward]]]:
        """
        Registra a ativação de um usuário indicado.

        Verifica se o usuário qualifica para recompensas de ativação
        (mínimo de dias ativos conforme regras do programa).
        """
        referral = self._find_referral_by_referred(referred_user_id)
        if not referral or referral.status not in (
            ReferralStatus.SIGNED_UP, ReferralStatus.PENDING
        ):
            return None

        if days_active < self._program.min_days_active_to_qualify:
            return referral, None

        referral.activated_at = datetime.utcnow()
        referral.status = ReferralStatus.ACTIVATED

        # Recompensa de ativação para o indicado
        referred_reward = ReferralReward(
            user_id=referred_user_id,
            referral_id=referral.referral_id,
            reward_type=RewardType.SUBSCRIPTION_CREDIT,
            value=14,  # 14 dias grátis ao ativar
            description="14 dias grátis por completar a ativação",
        )
        self._add_reward(referred_user_id, referred_reward)

        # Recompensa parcial para o indicador
        referrer_reward = ReferralReward(
            user_id=referral.referrer_user_id,
            referral_id=referral.referral_id,
            reward_type=RewardType.SUBSCRIPTION_CREDIT,
            value=7,  # 7 dias por ativação
            description=f"7 dias grátis: seu indicado foi ativado!",
        )
        referral.referrer_reward = referrer_reward
        self._add_reward(referral.referrer_user_id, referrer_reward)

        # Atualiza stats
        if referral.referrer_user_id in self._codes:
            self._codes[referral.referrer_user_id].activations_generated += 1

        return referral, referrer_reward

    def track_conversion(
        self,
        referred_user_id: str,
        plan: str = "pro",
        revenue: float = 0.0,
    ) -> Optional[Tuple[Referral, ReferralReward]]:
        """
        Registra a conversão de um usuário indicado para assinante.

        Concede a recompensa máxima ao indicador.
        """
        referral = self._find_referral_by_referred(referred_user_id)
        if not referral:
            return None

        if referral.status == ReferralStatus.FRAUDULENT:
            return None

        referral.converted_at = datetime.utcnow()
        referral.status = ReferralStatus.CONVERTED
        referral.revenue_attributed = revenue

        # Recompensa máxima para o indicador
        reward_days = {"pro": 30, "ultra": 60, "enterprise": 90}.get(plan, 30)
        referrer_reward = ReferralReward(
            user_id=referral.referrer_user_id,
            referral_id=referral.referral_id,
            reward_type=RewardType.SUBSCRIPTION_CREDIT,
            value=reward_days,
            description=f"{reward_days} dias grátis: seu indicado assinou o plano {plan.capitalize()}!",
        )
        referral.referrer_reward = referrer_reward
        self._add_reward(referral.referrer_user_id, referrer_reward)

        # Atualiza stats
        if referral.referrer_user_id in self._codes:
            code = self._codes[referral.referrer_user_id]
            code.conversions_generated += 1
            code.revenue_generated += revenue

        return referral, referrer_reward

    # ─────────────────────────────────────────────
    # Recompensas
    # ─────────────────────────────────────────────

    def get_user_rewards(self, user_id: str) -> List[ReferralReward]:
        """Retorna todas as recompensas de um usuário."""
        return self._rewards.get(user_id, [])

    def get_pending_rewards(self, user_id: str) -> List[ReferralReward]:
        """Retorna recompensas não resgatadas de um usuário."""
        return [r for r in self._rewards.get(user_id, []) if not r.is_redeemed]

    def redeem_reward(self, user_id: str, reward_id: str) -> Optional[ReferralReward]:
        """Resgata uma recompensa específica."""
        for reward in self._rewards.get(user_id, []):
            if reward.reward_id == reward_id and not reward.is_redeemed:
                reward.redeem()
                return reward
        return None

    def get_total_reward_days(self, user_id: str) -> float:
        """Retorna o total de dias de crédito disponíveis para o usuário."""
        return sum(
            r.value for r in self._rewards.get(user_id, [])
            if not r.is_redeemed and r.reward_type == RewardType.SUBSCRIPTION_CREDIT
        )

    # ─────────────────────────────────────────────
    # Análise e Métricas
    # ─────────────────────────────────────────────

    def get_referral_stats(self, user_id: str) -> Dict[str, Any]:
        """Estatísticas completas de referral de um usuário."""
        code = self._codes.get(user_id)
        referrals = [
            r for r in self._referrals.values()
            if r.referrer_user_id == user_id
        ]
        rewards = self._rewards.get(user_id, [])

        by_status = {status.value: 0 for status in ReferralStatus}
        for r in referrals:
            by_status[r.status.value] += 1

        return {
            "user_id": user_id,
            "referral_code": code.code if code else None,
            "referral_link": code.link if code else None,
            "total_referrals": len(referrals),
            "by_status": by_status,
            "total_revenue_attributed": sum(r.revenue_attributed for r in referrals),
            "rewards": {
                "total": len(rewards),
                "pending": len([r for r in rewards if not r.is_redeemed]),
                "redeemed": len([r for r in rewards if r.is_redeemed]),
                "total_days_earned": sum(r.value for r in rewards if r.reward_type == RewardType.SUBSCRIPTION_CREDIT),
                "total_days_available": self.get_total_reward_days(user_id),
            },
        }

    def get_program_metrics(self) -> Dict[str, Any]:
        """Métricas globais do programa de referral."""
        total_referrals = len(self._referrals)
        converted = sum(1 for r in self._referrals.values() if r.status == ReferralStatus.CONVERTED)
        activated = sum(1 for r in self._referrals.values() if r.status in (
            ReferralStatus.ACTIVATED, ReferralStatus.CONVERTED
        ))
        total_revenue = sum(r.revenue_attributed for r in self._referrals.values())

        # K-factor
        users_with_referrals = len(self._user_referrals)
        avg_referrals_per_user = total_referrals / users_with_referrals if users_with_referrals > 0 else 0
        conversion_rate = converted / total_referrals if total_referrals > 0 else 0
        k_factor = avg_referrals_per_user * conversion_rate

        return {
            "program_name": self._program.name,
            "is_active": self._program.is_active,
            "total_referrals": total_referrals,
            "activated": activated,
            "converted": converted,
            "conversion_rate_pct": round(conversion_rate * 100, 2),
            "total_revenue_attributed": round(total_revenue, 2),
            "users_participating": users_with_referrals,
            "avg_referrals_per_user": round(avg_referrals_per_user, 2),
            "k_factor": round(k_factor, 3),
            "viral_growth": k_factor >= 1.0,
        }

    def detect_fraud(self, user_id: str) -> bool:
        """
        Detecta padrões de fraude no programa de referral.

        Verifica auto-referral, referrals em massa e contas falsas.
        """
        referrals = [
            r for r in self._referrals.values()
            if r.referrer_user_id == user_id
        ]

        # Auto-referral
        if any(r.referred_user_id == user_id for r in referrals):
            self._fraud_blacklist.add(user_id)
            return True

        # Muitos referrals em pouco tempo (>10 em 24h)
        recent_cutoff = datetime.utcnow() - timedelta(hours=24)
        recent_referrals = [
            r for r in referrals
            if r.signed_up_at and r.signed_up_at >= recent_cutoff
        ]
        if len(recent_referrals) > 10:
            self._fraud_blacklist.add(user_id)
            return True

        return False

    # ─────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────

    def _find_pending_referral(self, referrer_id: str) -> Optional[Referral]:
        """Encontra o referral pendente mais recente de um indicador."""
        referral_ids = self._user_referrals.get(referrer_id, [])
        pending = [
            self._referrals[rid]
            for rid in referral_ids
            if rid in self._referrals
            and self._referrals[rid].status == ReferralStatus.PENDING
            and not self._referrals[rid].referred_user_id
        ]
        if not pending:
            return None
        return max(pending, key=lambda r: r.clicked_at or datetime.min)

    def _find_referral_by_referred(self, referred_user_id: str) -> Optional[Referral]:
        """Encontra o referral de um usuário indicado."""
        for referral in self._referrals.values():
            if referral.referred_user_id == referred_user_id:
                return referral
        return None

    def _add_reward(self, user_id: str, reward: ReferralReward) -> None:
        """Adiciona uma recompensa ao usuário."""
        if user_id not in self._rewards:
            self._rewards[user_id] = []
        self._rewards[user_id].append(reward)
