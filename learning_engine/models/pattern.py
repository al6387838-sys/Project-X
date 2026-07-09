"""
Pattern — Modelo de Padrão Comportamental
==========================================
Representa um padrão detectado no comportamento do usuário.
Padrões são a base para recomendações inteligentes do LifeOS.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import time
import uuid


class PatternType(str, Enum):
    """Tipos de padrão comportamental detectáveis."""
    TEMPORAL        = "temporal"       # Padrões de horário/dia/semana
    SEQUENCIAL      = "sequencial"     # Sequência de ações recorrentes
    PREFERENCIA     = "preferencia"    # Preferências consistentes
    HABITO          = "habito"         # Hábitos regulares
    REJEICAO        = "rejeicao"       # Padrões de rejeição/evitação
    PRIORIDADE      = "prioridade"     # Como o usuário prioriza tarefas
    COMUNICACAO     = "comunicacao"    # Estilo de comunicação preferido
    DECISAO         = "decisao"        # Estilo de tomada de decisão
    ENERGIA         = "energia"        # Padrões de energia/produtividade
    SOCIAL          = "social"         # Padrões de interação social


class PatternStrength(str, Enum):
    """Força de um padrão detectado."""
    FRACO      = "fraco"       # < 0.3 confiança
    MODERADO   = "moderado"    # 0.3 - 0.6 confiança
    FORTE      = "forte"       # 0.6 - 0.8 confiança
    MUITO_FORTE = "muito_forte" # > 0.8 confiança


@dataclass
class PatternOccurrence:
    """Registro de uma ocorrência do padrão."""
    occurrence_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    context: Dict[str, Any] = field(default_factory=dict)
    confirmed: bool = True           # True = ocorreu, False = não ocorreu (quebra)


@dataclass
class Pattern:
    """
    Um padrão comportamental detectado no usuário.

    Padrões são identificados pelo PatternDetector a partir de múltiplos
    LearningEvents. Quanto mais evidências, maior a confiança.
    Padrões fortes influenciam diretamente as recomendações do LifeOS.
    """
    pattern_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    # Identificação
    pattern_type: PatternType = PatternType.HABITO
    key: str = ""                    # Ex: "morning_exercise", "reject_late_meetings"
    label: str = ""                  # Ex: "Exercício matinal"
    description: str = ""
    domain: str = "general"

    # Confiança e força
    confidence: float = 0.0          # 0.0 a 1.0
    occurrences: int = 0             # Total de ocorrências confirmadas
    breaks: int = 0                  # Vezes que o padrão foi quebrado
    consecutive_streak: int = 0      # Sequência atual sem quebra

    # Histórico de ocorrências
    occurrence_log: List[PatternOccurrence] = field(default_factory=list)

    # Dados do padrão
    pattern_data: Dict[str, Any] = field(default_factory=dict)
    # Ex: {"time_of_day": "morning", "days": ["mon","tue","wed","thu","fri"]}

    # Impacto nas recomendações
    recommendation_weight: float = 0.5  # Peso nas recomendações (0.0 a 1.0)
    is_active: bool = True

    # Metadados
    tags: List[str] = field(default_factory=list)
    source_events: List[str] = field(default_factory=list)

    @property
    def strength(self) -> PatternStrength:
        if self.confidence >= 0.8:
            return PatternStrength.MUITO_FORTE
        elif self.confidence >= 0.6:
            return PatternStrength.FORTE
        elif self.confidence >= 0.3:
            return PatternStrength.MODERADO
        return PatternStrength.FRACO

    @property
    def reliability(self) -> float:
        """Taxa de confiabilidade: ocorrências / (ocorrências + quebras)."""
        total = self.occurrences + self.breaks
        if total == 0:
            return 0.0
        return self.occurrences / total

    def record_occurrence(self, context: Optional[Dict[str, Any]] = None,
                          confirmed: bool = True) -> None:
        """Registra uma nova ocorrência do padrão."""
        occ = PatternOccurrence(context=context or {}, confirmed=confirmed)
        self.occurrence_log.append(occ)
        if confirmed:
            self.occurrences += 1
            self.consecutive_streak += 1
        else:
            self.breaks += 1
            self.consecutive_streak = 0
        self.updated_at = time.time()
        self._recalculate_confidence()

    def _recalculate_confidence(self) -> None:
        """Recalcula a confiança com base nas ocorrências e quebras."""
        reliability = self.reliability
        streak_bonus = min(0.1, self.consecutive_streak * 0.01)
        self.confidence = min(1.0, reliability * 0.8 + streak_bonus + min(0.1, self.occurrences * 0.005))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pattern_id": self.pattern_id,
            "pattern_type": self.pattern_type.value,
            "key": self.key,
            "label": self.label,
            "description": self.description,
            "domain": self.domain,
            "confidence": self.confidence,
            "strength": self.strength.value,
            "occurrences": self.occurrences,
            "breaks": self.breaks,
            "reliability": self.reliability,
            "consecutive_streak": self.consecutive_streak,
            "recommendation_weight": self.recommendation_weight,
            "is_active": self.is_active,
            "pattern_data": self.pattern_data,
        }
