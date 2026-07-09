"""
LearningEvent — Modelo de Evento de Aprendizado
================================================
Toda interação do usuário gera um LearningEvent.
Este é o átomo fundamental do Continuous Learning Engine.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import time
import uuid


class EventType(str, Enum):
    """Tipos de evento que geram aprendizado."""
    SUGGESTION_ACCEPTED   = "suggestion_accepted"
    SUGGESTION_REJECTED   = "suggestion_rejected"
    SUGGESTION_IGNORED    = "suggestion_ignored"
    DECISION_MADE         = "decision_made"
    DECISION_REVERSED     = "decision_reversed"
    ROUTINE_FOLLOWED      = "routine_followed"
    ROUTINE_SKIPPED       = "routine_skipped"
    GOAL_PROGRESSED       = "goal_progressed"
    GOAL_ABANDONED        = "goal_abandoned"
    HABIT_COMPLETED       = "habit_completed"
    HABIT_MISSED          = "habit_missed"
    COMMUNICATION_STYLE   = "communication_style"
    PREFERENCE_EXPRESSED  = "preference_expressed"
    SCHEDULE_INTERACTION  = "schedule_interaction"
    PRIORITY_CHANGED      = "priority_changed"
    EXPLICIT_FEEDBACK     = "explicit_feedback"


class FeedbackType(str, Enum):
    """Tipos de feedback que o sistema reconhece."""
    POSITIVE  = "positive"   # Usuário aceitou / aprovou / seguiu
    NEGATIVE  = "negative"   # Usuário rejeitou / ignorou / reverteu
    IMPLICIT  = "implicit"   # Inferido do comportamento (sem ação explícita)
    EXPLICIT  = "explicit"   # Usuário forneceu feedback direto (rating, texto)
    NEUTRAL   = "neutral"    # Evento sem sinal claro de aprovação/rejeição


@dataclass
class LearningEvent:
    """
    Representa um evento de aprendizado gerado por uma interação do usuário.

    Cada interação com o LifeOS — aceitar uma sugestão, rejeitar uma decisão,
    seguir uma rotina, expressar uma preferência — gera um LearningEvent que
    alimenta o motor de aprendizado contínuo.
    """
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)

    # Classificação do evento
    event_type: EventType = EventType.SUGGESTION_ACCEPTED
    feedback_type: FeedbackType = FeedbackType.NEUTRAL

    # Domínio e contexto
    domain: str = "general"          # saude, financas, produtividade, etc.
    sub_domain: str = ""
    context: Dict[str, Any] = field(default_factory=dict)

    # Dados do evento
    pattern_key: str = ""            # Chave do padrão associado
    suggestion_id: Optional[str] = None
    decision_id: Optional[str] = None

    # Sinais de aprendizado
    confidence_delta: float = 0.0    # Quanto este evento altera a confiança (-1.0 a +1.0)
    weight: float = 1.0              # Peso do evento no aprendizado
    tags: List[str] = field(default_factory=list)

    # Metadados
    source: str = "system"           # system, user, inferred
    session_id: Optional[str] = None
    user_note: Optional[str] = None  # Nota explícita do usuário (feedback explícito)

    # Consentimento
    consent_given: bool = True       # Todo evento requer consentimento implícito de uso

    def is_positive(self) -> bool:
        return self.feedback_type == FeedbackType.POSITIVE

    def is_negative(self) -> bool:
        return self.feedback_type == FeedbackType.NEGATIVE

    def learning_signal(self) -> float:
        """
        Retorna o sinal de aprendizado normalizado.
        Positivo aumenta confiança; negativo reduz.
        """
        signal_map = {
            FeedbackType.POSITIVE: +1.0,
            FeedbackType.NEGATIVE: -1.0,
            FeedbackType.IMPLICIT: +0.3,
            FeedbackType.EXPLICIT: +0.8 if self.confidence_delta >= 0 else -0.8,
            FeedbackType.NEUTRAL:   0.0,
        }
        base = signal_map.get(self.feedback_type, 0.0)
        return base * self.weight

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "event_type": self.event_type.value,
            "feedback_type": self.feedback_type.value,
            "domain": self.domain,
            "sub_domain": self.sub_domain,
            "pattern_key": self.pattern_key,
            "confidence_delta": self.confidence_delta,
            "weight": self.weight,
            "tags": self.tags,
            "source": self.source,
            "user_note": self.user_note,
            "consent_given": self.consent_given,
        }
