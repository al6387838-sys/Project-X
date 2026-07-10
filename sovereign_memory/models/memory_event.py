"""
MemoryEvent — Evento de Memória
================================
Representa um evento que ocorreu no sistema de memória:
criação, acesso, consolidação, esquecimento, etc.
"""
from __future__ import annotations

import uuid
import time
from enum import Enum
from typing import Any, Dict, Optional
from dataclasses import dataclass, field


class EventCategory(str, Enum):
    """Categorias de eventos de memória."""
    CREATED         = "created"
    ACCESSED        = "accessed"
    UPDATED         = "updated"
    REINFORCED      = "reinforced"
    CONSOLIDATED    = "consolidated"
    ARCHIVED        = "archived"
    FORGOTTEN       = "forgotten"
    PROTECTED       = "protected"
    UNPROTECTED     = "unprotected"
    DELETED         = "deleted"
    RELATED         = "related"
    COMPRESSED      = "compressed"
    DUPLICATE_FOUND = "duplicate_found"
    CONSENT_GIVEN   = "consent_given"
    CONSENT_REVOKED = "consent_revoked"


@dataclass
class MemoryEvent:
    """Evento auditável no ciclo de vida de uma memória."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    memory_id: str = ""
    category: EventCategory = EventCategory.CREATED
    timestamp: float = field(default_factory=time.time)
    actor: str = "system"          # "system", "user", "companion"
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    session_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "memory_id": self.memory_id,
            "category": self.category.value,
            "timestamp": self.timestamp,
            "actor": self.actor,
            "description": self.description,
            "metadata": self.metadata,
            "session_id": self.session_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryEvent":
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            memory_id=data.get("memory_id", ""),
            category=EventCategory(data.get("category", "created")),
            timestamp=data.get("timestamp", time.time()),
            actor=data.get("actor", "system"),
            description=data.get("description", ""),
            metadata=data.get("metadata", {}),
            session_id=data.get("session_id"),
        )
