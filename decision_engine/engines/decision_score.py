"""
Decision Score System
=====================
Sistema de pontuação que avalia a qualidade de uma decisão com base em:
- Urgência
- Impacto esperado
- Confiança da IA
- Alinhamento com objetivo
- Cobertura de contexto
- Histórico de aprendizagem
"""

from typing import Dict, Any, Optional
from ..models.decision import Decision

SCORE_WEIGHTS = {
    "urgency":          0.20,
    "impact":           0.25,
    "confidence":       0.20,
    "goal_alignment":   0.20,
    "context_coverage": 0.10,
    "learning_boost":   0.05,
}


class DecisionScore:
    """
    Calcula o Decision Score de uma decisão.
    O score é um valor de 0 a 100 que representa a qualidade e confiabilidade
    da recomendação gerada pelo Decision Engine.
    """

    def __init__(self, weights: Dict[str, float] = None):
        self.weights = weights or SCORE_WEIGHTS

    def calculate(
        self,
        decision: Decision,
        urgency: float = 0.5,
        impact: float = 0.5,
        goal_alignment: float = 0.5,
        context_coverage: float = 0.5,
        learning_boost: float = 0.0,
    ) -> float:
        """
        Calcula o Decision Score (0 a 100).

        Args:
            decision:          Objeto Decision a ser avaliado.
            urgency:           Urgência da situação (0.0 a 1.0).
            impact:            Impacto esperado da decisão (0.0 a 1.0).
            goal_alignment:    Alinhamento com o objetivo relacionado (0.0 a 1.0).
            context_coverage:  Quantidade de contexto disponível (0.0 a 1.0).
            learning_boost:    Bônus de aprendizagem histórica (0.0 a 1.0).

        Returns:
            Score entre 0 e 100.
        """
        raw = (
            self.weights["urgency"]          * urgency
            + self.weights["impact"]         * impact
            + self.weights["confidence"]     * decision.confidence_score
            + self.weights["goal_alignment"] * goal_alignment
            + self.weights["context_coverage"] * context_coverage
            + self.weights["learning_boost"] * learning_boost
        )
        score = round(raw * 100, 2)
        decision.decision_score = score
        return score

    def score_breakdown(
        self,
        decision: Decision,
        urgency: float = 0.5,
        impact: float = 0.5,
        goal_alignment: float = 0.5,
        context_coverage: float = 0.5,
        learning_boost: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Retorna o detalhamento completo do score.
        """
        score = self.calculate(
            decision, urgency, impact, goal_alignment, context_coverage, learning_boost
        )
        return {
            "decision_id":       decision.decision_id,
            "total_score":       score,
            "confidence_pct":    round(decision.confidence_score * 100, 1),
            "breakdown": {
                "urgency":          round(urgency * self.weights["urgency"] * 100, 2),
                "impact":           round(impact * self.weights["impact"] * 100, 2),
                "confidence":       round(decision.confidence_score * self.weights["confidence"] * 100, 2),
                "goal_alignment":   round(goal_alignment * self.weights["goal_alignment"] * 100, 2),
                "context_coverage": round(context_coverage * self.weights["context_coverage"] * 100, 2),
                "learning_boost":   round(learning_boost * self.weights["learning_boost"] * 100, 2),
            },
            "weights_used": self.weights,
        }

    def classify(self, score: float) -> str:
        """Classifica o score em uma categoria textual."""
        if score >= 85:
            return "Excelente"
        elif score >= 70:
            return "Bom"
        elif score >= 50:
            return "Moderado"
        elif score >= 30:
            return "Fraco"
        else:
            return "Insuficiente"
