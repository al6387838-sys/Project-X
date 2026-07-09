"""
Decision Engine
===============
Núcleo do sistema de tomada de decisão do PROJECT-X.
Transforma contexto e memória em decisões inteligentes, explicáveis e rastreáveis.
NÃO executa ações — apenas gera decisões.
"""

from typing import List, Dict, Any, Optional
import time
import uuid

from ..models.decision import Decision
from ..models.context import ContextInput, Conflict
from ..engines.priority_engine import PriorityEngine
from ..resolvers.conflict_resolver import ConflictResolver


class DecisionEngine:
    """
    Motor central de decisão do PROJECT-X.

    Recebe dados do Life Graph, Context Engine e Memory Engine,
    e produz decisões estruturadas com raciocínio explícito.
    """

    def __init__(
        self,
        priority_engine: Optional[PriorityEngine] = None,
        conflict_resolver: Optional[ConflictResolver] = None,
    ):
        self.priority_engine = priority_engine or PriorityEngine()
        self.conflict_resolver = conflict_resolver or ConflictResolver()
        self._decision_log: List[Decision] = []

    def process(self, context_input: ContextInput) -> List[Decision]:
        """
        Processa um ContextInput e retorna uma lista de decisões priorizadas.

        Args:
            context_input: Dados combinados do Life Graph, Context Engine e Memory Engine.

        Returns:
            Lista de objetos Decision ordenados por prioridade.
        """
        raw_decisions = self._generate_decisions(context_input)
        prioritized = self._prioritize(raw_decisions, context_input)
        conflicts = self.conflict_resolver.detect_conflicts(prioritized)
        if conflicts:
            self.conflict_resolver.resolve_all(conflicts, prioritized)
        self._decision_log.extend(prioritized)
        return self.priority_engine.rank_decisions(prioritized)

    def _generate_decisions(self, ctx: ContextInput) -> List[Decision]:
        """
        Gera decisões brutas a partir dos dados de contexto.

        Args:
            ctx: ContextInput com dados dos três motores.

        Returns:
            Lista de decisões brutas.
        """
        decisions: List[Decision] = []

        life_data = ctx.life_graph_data
        context_data = ctx.context_engine_data
        memory_data = ctx.memory_engine_data

        # Decisão baseada em objetivos do Life Graph
        if life_data.get("active_goals"):
            for goal in life_data["active_goals"]:
                d = Decision(
                    action_type="goal_pursuit",
                    affected_context=[goal.get("domain", "general")],
                    confidence_score=goal.get("confidence", 0.7),
                    reasoning=[
                        f"Objetivo ativo identificado: '{goal.get('name', 'sem nome')}'.",
                        f"Domínio: {goal.get('domain', 'geral')}.",
                        f"Progresso atual: {goal.get('progress', 0) * 100:.1f}%.",
                        "Decisão gerada para avançar em direção ao objetivo.",
                    ],
                    metadata={"source": "life_graph", "goal": goal},
                )
                decisions.append(d)

        # Decisão baseada em eventos de contexto
        if context_data.get("recent_events"):
            for event in context_data["recent_events"]:
                d = Decision(
                    action_type="event_response",
                    affected_context=[event.get("category", "event")],
                    confidence_score=event.get("relevance", 0.6),
                    reasoning=[
                        f"Evento recente detectado: '{event.get('name', 'evento')}'.",
                        f"Categoria: {event.get('category', 'geral')}.",
                        f"Relevância: {event.get('relevance', 0.6):.2f}.",
                        "Decisão gerada em resposta ao evento de contexto.",
                    ],
                    metadata={"source": "context_engine", "event": event},
                )
                decisions.append(d)

        # Decisão baseada em padrões de memória
        if memory_data.get("patterns"):
            for pattern in memory_data["patterns"]:
                d = Decision(
                    action_type="pattern_based",
                    affected_context=[pattern.get("domain", "memory")],
                    confidence_score=pattern.get("strength", 0.5),
                    dependencies=pattern.get("related_decisions", []),
                    reasoning=[
                        f"Padrão de memória identificado: '{pattern.get('name', 'padrão')}'.",
                        f"Força do padrão: {pattern.get('strength', 0.5):.2f}.",
                        f"Ocorrências históricas: {pattern.get('occurrences', 1)}.",
                        "Decisão gerada com base em padrão comportamental recorrente.",
                    ],
                    metadata={"source": "memory_engine", "pattern": pattern},
                )
                decisions.append(d)

        # Fallback: decisão de manutenção se nenhum dado disponível
        if not decisions:
            decisions.append(Decision(
                action_type="maintenance",
                affected_context=["system"],
                confidence_score=0.3,
                reasoning=[
                    "Nenhum dado de contexto, objetivo ou memória disponível.",
                    "Decisão de manutenção gerada como fallback.",
                    "Recomenda-se alimentar o sistema com dados de contexto.",
                ],
            ))

        return decisions

    def _prioritize(
        self, decisions: List[Decision], ctx: ContextInput
    ) -> List[Decision]:
        """
        Aplica o Priority Engine a todas as decisões geradas.

        Args:
            decisions: Lista de decisões brutas.
            ctx: ContextInput para extrair sinais de contexto.

        Returns:
            Lista de decisões com prioridades calculadas.
        """
        context_signals = ctx.context_engine_data.get("signals", {})
        for d in decisions:
            urgency = d.metadata.get("urgency", 0.5)
            impact = d.metadata.get("impact", 0.5)
            self.priority_engine.calculate_priority(d, urgency=urgency, impact=impact)
            if context_signals:
                self.priority_engine.apply_context_boost(d, context_signals)
        return decisions

    def get_decision_log(self) -> List[Decision]:
        """Retorna o log completo de decisões geradas."""
        return list(self._decision_log)

    def get_decision_by_id(self, decision_id: str) -> Optional[Decision]:
        """Busca uma decisão pelo seu ID no log."""
        for d in self._decision_log:
            if d.decision_id == decision_id:
                return d
        return None

    def generate_summary(self) -> Dict[str, Any]:
        """
        Gera um resumo do estado atual do Decision Engine.

        Returns:
            Dicionário com estatísticas e métricas das decisões.
        """
        if not self._decision_log:
            return {"total": 0, "message": "Nenhuma decisão gerada ainda."}

        avg_confidence = sum(d.confidence_score for d in self._decision_log) / len(self._decision_log)
        avg_priority = sum(d.priority for d in self._decision_log) / len(self._decision_log)
        action_types = {}
        for d in self._decision_log:
            action_types[d.action_type] = action_types.get(d.action_type, 0) + 1

        return {
            "total_decisions": len(self._decision_log),
            "average_confidence": round(avg_confidence, 3),
            "average_priority": round(avg_priority, 1),
            "action_type_distribution": action_types,
        }
