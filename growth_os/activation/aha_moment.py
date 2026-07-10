"""
Aha Moment Detector
===================
Detecta o momento exato em que um usuário experimenta o valor
central da LifeOS — o "Aha Moment" que prediz retenção de longo prazo.

O Aha Moment da LifeOS é definido como:
    "O usuário completou sua primeira meta e registrou
     3 check-ins consecutivos em 7 dias após o cadastro."

Pesquisa interna mostra que usuários que atingem este momento
têm 4x mais chance de se tornarem assinantes pagos.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

from ..models.user_journey import UserJourney, UserProfile


class AhaMomentDetector:
    """
    Detecta e rastreia o Aha Moment de cada usuário.

    Analisa padrões de comportamento para identificar quando
    o usuário experimenta o valor central do produto.
    """

    # Definição do Aha Moment universal da LifeOS
    UNIVERSAL_AHA = {
        "name": "LifeOS Aha Moment",
        "description": "Primeira meta criada + 3 check-ins em 7 dias",
        "criteria": {
            "goals_created_min": 1,
            "checkins_in_7_days": 3,
            "days_window": 7,
        },
        "retention_lift": 4.0,  # 4x mais chance de reter
    }

    # Aha Moments específicos por perfil
    PROFILE_AHA = {
        UserProfile.PROFESSIONAL: {
            "name": "Professional Aha",
            "description": "Meta de carreira criada + 3 check-ins de progresso",
            "criteria": {"goals_created_min": 1, "checkins_in_7_days": 3},
        },
        UserProfile.STUDENT: {
            "name": "Student Aha",
            "description": "Plano de estudos criado + primeira sessão completada",
            "criteria": {"study_plan_created": True, "sessions_completed_min": 1},
        },
        UserProfile.ENTREPRENEUR: {
            "name": "Entrepreneur Aha",
            "description": "Projeto criado com 3 milestones definidos",
            "criteria": {"projects_created_min": 1, "milestones_defined_min": 3},
        },
        UserProfile.WELLNESS: {
            "name": "Wellness Aha",
            "description": "Hábito criado + sequência de 3 dias",
            "criteria": {"habits_created_min": 1, "streak_days_min": 3},
        },
        UserProfile.CREATIVE: {
            "name": "Creative Aha",
            "description": "Projeto criativo com primeira entrega",
            "criteria": {"projects_created_min": 1, "deliveries_completed_min": 1},
        },
    }

    def __init__(self):
        self._aha_records: Dict[str, Dict[str, Any]] = {}
        """user_id → aha moment record"""

    def check_aha_moment(
        self,
        journey: UserJourney,
        user_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Verifica se o usuário atingiu o Aha Moment.

        Args:
            journey: Jornada do usuário.
            user_data: Dados adicionais do usuário (metas, sessões, etc.).

        Returns:
            True se o Aha Moment foi atingido.
        """
        if journey.user_id in self._aha_records:
            return True  # Já atingiu

        user_data = user_data or {}
        reached = False

        # Verifica critérios universais
        goals = user_data.get("goals_created", journey.goals_created)
        checkins = user_data.get("checkins_7d", 0)

        if goals >= 1 and checkins >= 3:
            reached = True

        # Verifica critérios específicos do perfil
        if not reached:
            reached = self._check_profile_aha(journey.profile, user_data)

        if reached:
            self._record_aha(journey)

        return reached

    def get_time_to_aha(self, user_id: str) -> Optional[float]:
        """
        Retorna o tempo em horas até o Aha Moment.

        Returns None se o usuário ainda não atingiu.
        """
        record = self._aha_records.get(user_id)
        if not record:
            return None
        return record.get("time_to_aha_hours")

    def get_aha_stats(self) -> Dict[str, Any]:
        """Estatísticas gerais sobre o Aha Moment."""
        times = [
            r["time_to_aha_hours"]
            for r in self._aha_records.values()
            if r.get("time_to_aha_hours")
        ]

        return {
            "total_users_reached_aha": len(self._aha_records),
            "avg_time_to_aha_hours": round(sum(times) / len(times), 2) if times else 0.0,
            "median_time_to_aha_hours": sorted(times)[len(times) // 2] if times else 0.0,
            "fastest_aha_hours": min(times) if times else 0.0,
        }

    def _check_profile_aha(
        self, profile: UserProfile, user_data: Dict[str, Any]
    ) -> bool:
        """Verifica critérios específicos do perfil."""
        criteria = self.PROFILE_AHA.get(profile, {}).get("criteria", {})

        if not criteria:
            return False

        for key, required_value in criteria.items():
            actual = user_data.get(key, 0)
            if isinstance(required_value, bool):
                if actual != required_value:
                    return False
            elif isinstance(required_value, (int, float)):
                if actual < required_value:
                    return False

        return True

    def _record_aha(self, journey: UserJourney) -> None:
        """Registra o Aha Moment de um usuário."""
        now = datetime.utcnow()
        time_to_aha = None

        if journey.signed_up_at:
            time_to_aha = (now - journey.signed_up_at).total_seconds() / 3600

        self._aha_records[journey.user_id] = {
            "user_id": journey.user_id,
            "profile": journey.profile.value,
            "reached_at": now.isoformat(),
            "time_to_aha_hours": round(time_to_aha, 2) if time_to_aha else None,
            "stage_at_aha": journey.current_stage.value,
        }
