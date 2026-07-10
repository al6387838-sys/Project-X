"""
Profile Detector
================
Detecta o perfil do usuário a partir de suas respostas no onboarding.

Usa um sistema de pontuação baseado em regras para classificar
o usuário em um dos perfis suportados pela LifeOS.
"""

from typing import Dict, Optional
from ..models.user_journey import UserProfile


class ProfileDetector:
    """
    Detecta o perfil do usuário a partir de respostas de qualificação.

    Usa um sistema de scoring baseado em regras:
    cada resposta contribui com pontos para um ou mais perfis.
    O perfil com maior pontuação é selecionado.
    """

    # Mapeamento: (question_id, answer_value) → {profile: score}
    SCORING_RULES: Dict[tuple, Dict[str, float]] = {
        ("main_goal", "career"):   {UserProfile.PROFESSIONAL: 1.0},
        ("main_goal", "study"):    {UserProfile.STUDENT: 1.0},
        ("main_goal", "business"): {UserProfile.ENTREPRENEUR: 1.0},
        ("main_goal", "health"):   {UserProfile.WELLNESS: 1.0},
        ("main_goal", "creative"): {UserProfile.CREATIVE: 1.0},

        ("biggest_challenge", "focus"):       {UserProfile.PROFESSIONAL: 0.5, UserProfile.STUDENT: 0.3},
        ("biggest_challenge", "time"):        {UserProfile.STUDENT: 0.5, UserProfile.PROFESSIONAL: 0.3},
        ("biggest_challenge", "priorities"):  {UserProfile.ENTREPRENEUR: 0.5, UserProfile.PROFESSIONAL: 0.3},
        ("biggest_challenge", "consistency"): {UserProfile.WELLNESS: 0.5, UserProfile.CREATIVE: 0.3},
        ("biggest_challenge", "motivation"):  {UserProfile.CREATIVE: 0.5, UserProfile.WELLNESS: 0.3},

        ("occupation", "employee"):    {UserProfile.PROFESSIONAL: 0.8},
        ("occupation", "student"):     {UserProfile.STUDENT: 0.8},
        ("occupation", "founder"):     {UserProfile.ENTREPRENEUR: 0.8},
        ("occupation", "freelancer"):  {UserProfile.CREATIVE: 0.6, UserProfile.ENTREPRENEUR: 0.4},
        ("occupation", "other"):       {},

        ("age_group", "18-24"): {UserProfile.STUDENT: 0.3},
        ("age_group", "25-34"): {UserProfile.PROFESSIONAL: 0.2, UserProfile.ENTREPRENEUR: 0.2},
        ("age_group", "35-44"): {UserProfile.PROFESSIONAL: 0.3, UserProfile.ENTREPRENEUR: 0.3},
        ("age_group", "45+"):   {UserProfile.WELLNESS: 0.3},
    }

    def detect(self, answers: Dict[str, str]) -> UserProfile:
        """
        Detecta o perfil do usuário a partir de suas respostas.

        Args:
            answers: Dicionário {question_id: answer_value}

        Returns:
            UserProfile detectado ou UNKNOWN se não houver dados suficientes.
        """
        scores: Dict[UserProfile, float] = {p: 0.0 for p in UserProfile}

        for question_id, answer_value in answers.items():
            rule_key = (question_id, answer_value)
            rule = self.SCORING_RULES.get(rule_key, {})

            for profile, score in rule.items():
                scores[profile] = scores.get(profile, 0.0) + score

        # Remove UNKNOWN da competição
        scores.pop(UserProfile.UNKNOWN, None)

        if not scores or max(scores.values()) == 0:
            return UserProfile.UNKNOWN

        best_profile = max(scores, key=lambda p: scores[p])
        return best_profile

    def get_confidence(
        self, answers: Dict[str, str], profile: UserProfile
    ) -> float:
        """
        Retorna a confiança na detecção do perfil (0.0 a 1.0).

        Confiança alta significa que o perfil foi claramente identificado.
        """
        if profile == UserProfile.UNKNOWN:
            return 0.0

        scores: Dict[UserProfile, float] = {p: 0.0 for p in UserProfile}

        for question_id, answer_value in answers.items():
            rule_key = (question_id, answer_value)
            rule = self.SCORING_RULES.get(rule_key, {})
            for p, score in rule.items():
                scores[p] = scores.get(p, 0.0) + score

        scores.pop(UserProfile.UNKNOWN, None)
        total_score = sum(scores.values())

        if total_score == 0:
            return 0.0

        profile_score = scores.get(profile, 0.0)
        return min(profile_score / total_score, 1.0)

    def get_all_scores(self, answers: Dict[str, str]) -> Dict[str, float]:
        """Retorna os scores de todos os perfis para debug."""
        scores: Dict[UserProfile, float] = {p: 0.0 for p in UserProfile}

        for question_id, answer_value in answers.items():
            rule_key = (question_id, answer_value)
            rule = self.SCORING_RULES.get(rule_key, {})
            for p, score in rule.items():
                scores[p] = scores.get(p, 0.0) + score

        return {p.value: round(s, 3) for p, s in scores.items()}
