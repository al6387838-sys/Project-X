"""
Conflict Resolver
=================
Detecta e resolve conflitos entre decisões geradas pelo Decision Engine.
Cada resolução é documentada com raciocínio explícito.
"""

from typing import List, Dict, Tuple
import uuid
from ..models.decision import Decision
from ..models.context import Conflict


class ConflictResolver:
    """Detecta e resolve conflitos entre decisões."""

    RESOLUTION_STRATEGIES = {
        "priority_wins": "A decisão com maior prioridade prevalece.",
        "merge": "As decisões conflitantes são mescladas em uma única decisão.",
        "defer": "Uma das decisões é adiada para reavaliação posterior.",
        "user_arbitration": "O conflito requer arbitragem humana.",
    }

    def detect_conflicts(self, decisions: List[Decision]) -> List[Conflict]:
        """
        Detecta conflitos entre decisões com base em contextos afetados sobrepostos.

        Args:
            decisions: Lista de objetos Decision.

        Returns:
            Lista de objetos Conflict detectados.
        """
        conflicts: List[Conflict] = []
        n = len(decisions)

        for i in range(n):
            for j in range(i + 1, n):
                d1, d2 = decisions[i], decisions[j]
                overlap = set(d1.affected_context) & set(d2.affected_context)
                if overlap:
                    conflict = Conflict(
                        conflict_id=str(uuid.uuid4()),
                        description=(
                            f"Conflito detectado entre decisão '{d1.decision_id}' e "
                            f"'{d2.decision_id}' nos contextos: {', '.join(overlap)}."
                        ),
                        involved_decisions=[d1.decision_id, d2.decision_id],
                        severity=self._calculate_severity(d1, d2, overlap),
                    )
                    conflicts.append(conflict)

        return conflicts

    def resolve(
        self,
        conflict: Conflict,
        decisions: List[Decision],
        strategy: str = "priority_wins",
    ) -> Tuple[Conflict, Decision]:
        """
        Resolve um conflito usando a estratégia especificada.

        Args:
            conflict: Objeto Conflict a ser resolvido.
            decisions: Lista de decisões envolvidas.
            strategy: Estratégia de resolução.

        Returns:
            Tupla (Conflict resolvido, Decision vencedora).
        """
        if strategy not in self.RESOLUTION_STRATEGIES:
            raise ValueError(f"Estratégia inválida: {strategy}. "
                             f"Opções: {list(self.RESOLUTION_STRATEGIES.keys())}")

        involved = [d for d in decisions if d.decision_id in conflict.involved_decisions]

        if strategy == "priority_wins":
            winner = max(involved, key=lambda d: d.priority)
            loser = min(involved, key=lambda d: d.priority)
            conflict.resolution_strategy = (
                f"priority_wins: Decisão '{winner.decision_id}' (prioridade={winner.priority}) "
                f"prevalece sobre '{loser.decision_id}' (prioridade={loser.priority}). "
                f"Razão: {self.RESOLUTION_STRATEGIES['priority_wins']}"
            )
            winner.reasoning.append(
                f"Conflito resolvido por prioridade: esta decisão prevaleceu sobre '{loser.decision_id}'."
            )

        elif strategy == "merge":
            winner = involved[0]
            for d in involved[1:]:
                winner.affected_context = list(set(winner.affected_context + d.affected_context))
                winner.reasoning.extend(d.reasoning)
                winner.alternative_decisions.append(d.decision_id)
            winner.reasoning.append(
                f"Conflito resolvido por mesclagem: decisões {[d.decision_id for d in involved]} combinadas."
            )
            conflict.resolution_strategy = f"merge: Decisões mescladas em '{winner.decision_id}'."

        elif strategy == "defer":
            winner = max(involved, key=lambda d: d.priority)
            deferred = [d for d in involved if d.decision_id != winner.decision_id]
            conflict.resolution_strategy = (
                f"defer: Decisões {[d.decision_id for d in deferred]} adiadas. "
                f"'{winner.decision_id}' prossegue."
            )
            winner.reasoning.append(
                f"Conflito resolvido por adiamento: decisões {[d.decision_id for d in deferred]} adiadas."
            )

        elif strategy == "user_arbitration":
            winner = involved[0]
            conflict.resolution_strategy = (
                "user_arbitration: Conflito escalado para arbitragem humana. "
                "Nenhuma decisão automática tomada."
            )
            winner.reasoning.append("Conflito requer arbitragem humana.")

        conflict.resolved = True
        return conflict, winner

    def resolve_all(
        self,
        conflicts: List[Conflict],
        decisions: List[Decision],
    ) -> List[Tuple[Conflict, Decision]]:
        """
        Resolve todos os conflitos detectados automaticamente.

        Args:
            conflicts: Lista de conflitos.
            decisions: Lista de todas as decisões.

        Returns:
            Lista de tuplas (Conflict, Decision vencedora).
        """
        results = []
        for conflict in conflicts:
            strategy = self._choose_strategy(conflict)
            result = self.resolve(conflict, decisions, strategy)
            results.append(result)
        return results

    def _calculate_severity(
        self, d1: Decision, d2: Decision, overlap: set
    ) -> int:
        """Calcula severidade do conflito (1-10)."""
        base = len(overlap)
        priority_diff = abs(d1.priority - d2.priority)
        severity = min(base + (10 - priority_diff // 10), 10)
        return max(severity, 1)

    def _choose_strategy(self, conflict: Conflict) -> str:
        """Escolhe automaticamente a estratégia de resolução com base na severidade."""
        if conflict.severity >= 8:
            return "user_arbitration"
        elif conflict.severity >= 5:
            return "defer"
        else:
            return "priority_wins"
