"""
Priority Engine
===============
Responsável por calcular e ordenar prioridades de decisões com base em
urgência, impacto, dependências e dados de contexto.
"""

from typing import List, Dict, Any
from ..models.decision import Decision


PRIORITY_WEIGHTS = {
    "urgency": 0.40,
    "impact": 0.35,
    "dependency_count": 0.15,
    "confidence": 0.10,
}


class PriorityEngine:
    """Calcula prioridades para decisões geradas pelo Decision Engine."""

    def __init__(self, weights: Dict[str, float] = None):
        self.weights = weights or PRIORITY_WEIGHTS

    def calculate_priority(
        self,
        decision: Decision,
        urgency: float = 0.5,
        impact: float = 0.5,
    ) -> int:
        """
        Calcula a prioridade de uma decisão em escala 0-100.

        Args:
            decision: Objeto Decision a ser avaliado.
            urgency: Valor de urgência (0.0 a 1.0).
            impact: Valor de impacto esperado (0.0 a 1.0).

        Returns:
            Prioridade calculada (0-100).
        """
        dep_score = min(len(decision.dependencies) / 10.0, 1.0)
        conf_score = decision.confidence_score

        raw = (
            self.weights["urgency"] * urgency
            + self.weights["impact"] * impact
            + self.weights["dependency_count"] * dep_score
            + self.weights["confidence"] * conf_score
        )

        priority = int(round(raw * 100))
        decision.priority = priority
        decision.reasoning.append(
            f"Prioridade calculada: {priority}/100 "
            f"(urgência={urgency:.2f}, impacto={impact:.2f}, "
            f"dependências={len(decision.dependencies)}, "
            f"confiança={conf_score:.2f})"
        )
        return priority

    def rank_decisions(self, decisions: List[Decision]) -> List[Decision]:
        """
        Ordena uma lista de decisões por prioridade (maior primeiro).

        Args:
            decisions: Lista de objetos Decision.

        Returns:
            Lista ordenada por prioridade decrescente.
        """
        return sorted(decisions, key=lambda d: d.priority, reverse=True)

    def apply_context_boost(
        self, decision: Decision, context_signals: Dict[str, Any]
    ) -> int:
        """
        Aplica ajuste de prioridade baseado em sinais de contexto externos.

        Args:
            decision: Objeto Decision.
            context_signals: Dicionário com sinais do Context Engine.

        Returns:
            Prioridade ajustada.
        """
        boost = 0
        if context_signals.get("is_deadline_near", False):
            boost += 10
            decision.reasoning.append("Boost de prioridade: prazo próximo (+10).")
        if context_signals.get("high_user_stress", False):
            boost += 5
            decision.reasoning.append("Boost de prioridade: alto nível de estresse do usuário (+5).")
        if context_signals.get("critical_resource_low", False):
            boost += 8
            decision.reasoning.append("Boost de prioridade: recurso crítico baixo (+8).")

        decision.priority = min(decision.priority + boost, 100)
        return decision.priority
