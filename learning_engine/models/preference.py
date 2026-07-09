"""
Preference — Modelo de Preferência do Usuário
==============================================
Representa uma preferência aprendida pelo sistema.
Inclui histórico de evolução e rastreabilidade completa.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import time
import uuid


class PreferenceCategory(str, Enum):
    """Categorias de preferências que o LifeOS aprende."""
    ROTINA           = "rotina"
    HORARIO          = "horario"
    PRIORIDADE       = "prioridade"
    OBJETIVO         = "objetivo"
    HABITO           = "habito"
    COMUNICACAO      = "comunicacao"
    TOM              = "tom"
    DOMINIO          = "dominio"
    FORMATO          = "formato"
    FREQUENCIA       = "frequencia"
    ESTILO_DECISAO   = "estilo_decisao"
    TOPICO           = "topico"


@dataclass
class PreferenceSnapshot:
    """Fotografia de uma preferência em um momento específico."""
    snapshot_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    value: Any = None
    confidence: float = 0.0
    evidence_count: int = 0
    trigger_event_id: Optional[str] = None


@dataclass
class PreferenceHistory:
    """
    Histórico completo de evolução de uma preferência.
    Permite rastrear como o sistema aprendeu ao longo do tempo.
    """
    preference_id: str = ""
    snapshots: List[PreferenceSnapshot] = field(default_factory=list)

    def add_snapshot(self, value: Any, confidence: float, evidence_count: int,
                     trigger_event_id: Optional[str] = None) -> PreferenceSnapshot:
        snap = PreferenceSnapshot(
            value=value,
            confidence=confidence,
            evidence_count=evidence_count,
            trigger_event_id=trigger_event_id,
        )
        self.snapshots.append(snap)
        return snap

    def confidence_trend(self) -> List[float]:
        """Retorna a evolução da confiança ao longo do tempo."""
        return [s.confidence for s in self.snapshots]

    def latest_value(self) -> Any:
        if not self.snapshots:
            return None
        return self.snapshots[-1].value

    def latest_confidence(self) -> float:
        if not self.snapshots:
            return 0.0
        return self.snapshots[-1].confidence


@dataclass
class Preference:
    """
    Uma preferência aprendida do usuário.

    Representa algo que o LifeOS aprendeu sobre o usuário —
    desde horários preferidos até estilo de comunicação.
    Toda preferência tem confiança, histórico e pode ser revertida.
    """
    preference_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    # Identificação
    category: PreferenceCategory = PreferenceCategory.ROTINA
    key: str = ""                    # Ex: "wake_up_time", "preferred_tone"
    label: str = ""                  # Ex: "Horário de despertar preferido"
    domain: str = "general"

    # Valor aprendido
    value: Any = None                # Pode ser str, int, float, list, dict
    previous_value: Any = None

    # Confiança e evidências
    confidence: float = 0.0          # 0.0 a 1.0
    evidence_count: int = 0          # Quantas interações sustentam esta preferência
    positive_signals: int = 0
    negative_signals: int = 0

    # Histórico
    history: PreferenceHistory = field(default_factory=PreferenceHistory)

    # Metadados
    is_confirmed: bool = False       # Usuário confirmou explicitamente
    is_locked: bool = False          # Usuário bloqueou alterações automáticas
    tags: List[str] = field(default_factory=list)
    source_events: List[str] = field(default_factory=list)  # IDs dos eventos que geraram

    # Apresentação ao usuário
    human_readable: str = ""         # "O LifeOS aprendeu que você prefere..."

    def update_confidence(self, delta: float, event_id: Optional[str] = None) -> None:
        """Atualiza a confiança com base em um novo sinal de aprendizado."""
        if self.is_locked:
            return
        self.previous_value = self.value
        self.confidence = max(0.0, min(1.0, self.confidence + delta))
        self.updated_at = time.time()
        self.history.add_snapshot(
            value=self.value,
            confidence=self.confidence,
            evidence_count=self.evidence_count,
            trigger_event_id=event_id,
        )

    def signal_strength(self) -> float:
        """Razão entre sinais positivos e total de sinais."""
        total = self.positive_signals + self.negative_signals
        if total == 0:
            return 0.0
        return self.positive_signals / total

    def to_insight(self) -> str:
        """Retorna a frase de insight para o usuário."""
        if self.human_readable:
            return self.human_readable
        return f"O LifeOS aprendeu que você prefere: {self.key} = {self.value} (confiança: {self.confidence:.0%})"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "preference_id": self.preference_id,
            "category": self.category.value,
            "key": self.key,
            "label": self.label,
            "domain": self.domain,
            "value": self.value,
            "confidence": self.confidence,
            "evidence_count": self.evidence_count,
            "positive_signals": self.positive_signals,
            "negative_signals": self.negative_signals,
            "is_confirmed": self.is_confirmed,
            "is_locked": self.is_locked,
            "human_readable": self.to_insight(),
        }
