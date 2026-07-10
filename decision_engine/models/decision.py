"""
Decision Model
==============
Modelo central de decisão do LifeOS.
Representa uma decisão gerada pelo Decision Engine com raciocínio explícito,
prioridade calculada e rastreabilidade completa.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time
import uuid
from enum import Enum


class DecisionCategory(str, Enum):
    SAUDE = "Saúde"
    FINANCAS = "Finanças"
    PRODUTIVIDADE = "Produtividade"
    RELACIONAMENTOS = "Relacionamentos"
    PROJETOS = "Projetos"
    CARREIRA = "Carreira"
    CONHECIMENTO = "Conhecimento"


@dataclass
class Alternative:
    alternative_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    description: str = ""
    pros: List[str] = field(default_factory=list)
    cons: List[str] = field(default_factory=list)
    estimated_impact: float = 0.0


@dataclass
class Decision:
    """
    Representa uma decisão gerada pelo Decision Engine.

    Campos principais:
        decision_id: Identificador único da decisão.
        timestamp: Momento de criação (Unix timestamp).
        action_type: Tipo da ação (goal_pursuit, event_response, pattern_based, maintenance, general).
        affected_context: Lista de contextos/domínios afetados pela decisão.
        dependencies: Lista de IDs de decisões das quais esta depende.
        alternative_decisions: Lista de decisões alternativas consideradas.
        confidence_score: Confiança da IA na decisão (0.0 a 1.0).
        priority: Prioridade calculada (0 a 100).
        reasoning: Lista de justificativas textuais.
        metadata: Dados adicionais de contexto (source, urgency, impact, etc.).
        status: Estado atual (pending, accepted, rejected).
    """
    # Identificação
    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)

    # Tipo e escopo
    action_type: str = "general"
    affected_context: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    alternative_decisions: List[str] = field(default_factory=list)

    # Avaliação
    confidence_score: float = 0.0  # 0.0 to 1.0
    priority: int = 0              # 0 to 100

    # Raciocínio e justificativa
    reasoning: List[str] = field(default_factory=list)
    justification: str = ""
    recommendation: str = ""

    # Metadados adicionais (source, urgency, impact, goal, event, pattern, etc.)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Campos legados mantidos para compatibilidade retroativa
    related_goal: str = ""
    category: str = DecisionCategory.PRODUTIVIDADE.value
    context_used: Dict[str, Any] = field(default_factory=dict)
    factor_weights: Dict[str, float] = field(default_factory=dict)
    alternatives: List[Alternative] = field(default_factory=list)
    decision_score: float = 0.0
    possible_risks: List[str] = field(default_factory=list)
    possible_benefits: List[str] = field(default_factory=list)
    status: str = "pending"  # pending, accepted, rejected

    def explain(self) -> str:
        """Retorna uma explicação compreensível do raciocínio da decisão."""
        if not self.reasoning and not self.justification:
            return "Nenhum raciocínio fornecido."
        parts = []
        if self.justification:
            parts.append(f"Justificativa: {self.justification}")
        if self.reasoning:
            parts.extend([f"- {r}" for r in self.reasoning])
        return "\n".join(parts)
