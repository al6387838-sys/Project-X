"""
MemoryRelation — Relação entre Memórias
=========================================
Define as arestas do Memory Graph — como as memórias
se conectam semanticamente, temporalmente e causalmente.
"""
from __future__ import annotations

import uuid
import time
from enum import Enum
from typing import Any, Dict
from dataclasses import dataclass, field


class RelationType(str, Enum):
    """Tipos de relação entre nós de memória."""
    CAUSES          = "causes"          # A causou B
    CAUSED_BY       = "caused_by"       # A foi causado por B
    RELATED_TO      = "related_to"      # Relação semântica genérica
    PART_OF         = "part_of"         # A é parte de B
    CONTAINS        = "contains"        # A contém B
    PRECEDES        = "precedes"        # A ocorreu antes de B
    FOLLOWS         = "follows"         # A ocorreu depois de B
    CONTRADICTS     = "contradicts"     # A contradiz B
    CONFIRMS        = "confirms"        # A confirma B
    SIMILAR_TO      = "similar_to"      # A é semanticamente similar a B
    DUPLICATE_OF    = "duplicate_of"    # A é duplicata de B
    EVOLVED_FROM    = "evolved_from"    # A evoluiu de B
    INVOLVES_PERSON = "involves_person" # A envolve a pessoa B
    INVOLVES_PROJECT = "involves_project" # A envolve o projeto B
    RECURRING       = "recurring"       # A é recorrência de B


@dataclass
class MemoryRelation:
    """Aresta no Memory Graph conectando dois nós de memória."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str = ""
    target_id: str = ""
    relation_type: RelationType = RelationType.RELATED_TO
    weight: float = 1.0            # Força da relação (0.0 a 1.0)
    confidence: float = 1.0        # Confiança na relação detectada
    created_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    auto_detected: bool = False    # True se detectada automaticamente

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "relation_type": self.relation_type.value,
            "weight": self.weight,
            "confidence": self.confidence,
            "created_at": self.created_at,
            "metadata": self.metadata,
            "auto_detected": self.auto_detected,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryRelation":
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            source_id=data.get("source_id", ""),
            target_id=data.get("target_id", ""),
            relation_type=RelationType(data.get("relation_type", "related_to")),
            weight=data.get("weight", 1.0),
            confidence=data.get("confidence", 1.0),
            created_at=data.get("created_at", time.time()),
            metadata=data.get("metadata", {}),
            auto_detected=data.get("auto_detected", False),
        )
