"""
MemoryNode — Unidade Fundamental de Memória Soberana
=====================================================
Cada memória é um nó com tipo, prioridade, status e metadados
que permitem evolução, consolidação e envelhecimento.

Princípios de Soberania:
- O usuário controla cada nó individualmente.
- Nenhuma memória é criada sem consentimento.
- Qualquer memória pode ser apagada permanentemente.
- Memórias protegidas requerem confirmação dupla para exclusão.
"""
from __future__ import annotations

import uuid
import time
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field


class MemoryType(str, Enum):
    """Tipos de memória no sistema cognitivo do Companion."""
    LONG_TERM   = "long_term"    # Memórias consolidadas e duradouras
    SHORT_TERM  = "short_term"   # Memórias recentes ainda não consolidadas
    WORKING     = "working"      # Memória ativa da sessão atual
    CONTEXT     = "context"      # Contexto situacional e ambiental
    SEMANTIC    = "semantic"     # Conhecimento factual e conceitual
    EPISODIC    = "episodic"     # Eventos e experiências específicas


class MemoryPriority(str, Enum):
    """Prioridade de uma memória — determina retenção e acesso."""
    CRITICAL    = "critical"     # Nunca esquecida automaticamente
    HIGH        = "high"         # Retida por muito tempo
    MEDIUM      = "medium"       # Retida por tempo moderado
    LOW         = "low"          # Candidata a arquivamento
    EPHEMERAL   = "ephemeral"    # Descartada após uso


class MemoryStatus(str, Enum):
    """Status de ciclo de vida de uma memória."""
    ACTIVE      = "active"       # Em uso ativo
    ARCHIVED    = "archived"     # Arquivada mas recuperável
    PROTECTED   = "protected"    # Protegida pelo usuário
    FORGOTTEN   = "forgotten"    # Marcada para esquecimento
    CONSOLIDATED = "consolidated" # Consolidada em memória de longo prazo
    PENDING     = "pending"      # Aguardando consentimento do usuário


@dataclass
class MemoryNode:
    """
    Nó de memória — unidade atômica do sistema de Memória Soberana.

    Cada nó representa uma unidade de conhecimento ou experiência
    que o Companion mantém sobre o usuário, com controle total
    de privacidade e soberania.
    """
    # Identidade
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    content: str = ""
    summary: str = ""

    # Classificação
    memory_type: MemoryType = MemoryType.SHORT_TERM
    priority: MemoryPriority = MemoryPriority.MEDIUM
    status: MemoryStatus = MemoryStatus.PENDING

    # Domínio e categorias
    domain: str = "general"
    tags: List[str] = field(default_factory=list)
    entities: List[str] = field(default_factory=list)   # Pessoas, lugares, projetos

    # Metadados temporais
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    expires_at: Optional[float] = None

    # Métricas de qualidade
    confidence: float = 1.0        # 0.0 a 1.0
    relevance: float = 1.0         # 0.0 a 1.0 — calculado dinamicamente
    access_count: int = 0
    reinforcement_count: int = 0

    # Aging (envelhecimento)
    decay_rate: float = 0.01       # Taxa de decaimento por dia
    strength: float = 1.0          # Força atual da memória (afetada pelo aging)

    # Relacionamentos
    related_ids: List[str] = field(default_factory=list)
    parent_id: Optional[str] = None
    source_ids: List[str] = field(default_factory=list)  # Memórias que geraram esta

    # Soberania
    user_consented: bool = False
    user_protected: bool = False
    user_notes: str = ""
    consent_timestamp: Optional[float] = None

    # Metadados extras
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding_vector: Optional[List[float]] = None

    def touch(self) -> None:
        """Registra acesso e reforça a memória."""
        self.last_accessed = time.time()
        self.access_count += 1
        self.strength = min(1.0, self.strength + 0.05)

    def reinforce(self, delta: float = 0.1) -> None:
        """Reforça a memória (repetição, confirmação)."""
        self.reinforcement_count += 1
        self.strength = min(1.0, self.strength + delta)
        self.updated_at = time.time()

    def decay(self, days_elapsed: float = 1.0) -> None:
        """Aplica envelhecimento natural à memória."""
        if self.status == MemoryStatus.PROTECTED:
            return
        if self.priority == MemoryPriority.CRITICAL:
            return
        decay_amount = self.decay_rate * days_elapsed
        self.strength = max(0.0, self.strength - decay_amount)

    def is_expired(self) -> bool:
        """Verifica se a memória expirou."""
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at

    def is_weak(self, threshold: float = 0.2) -> bool:
        """Verifica se a memória está fraca o suficiente para arquivamento."""
        return self.strength < threshold

    def promote_to_long_term(self) -> None:
        """Promove a memória para longo prazo."""
        self.memory_type = MemoryType.LONG_TERM
        self.status = MemoryStatus.CONSOLIDATED
        self.decay_rate = 0.002  # Decaimento muito mais lento
        self.updated_at = time.time()

    def to_dict(self) -> Dict[str, Any]:
        """Serializa o nó para dicionário."""
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "summary": self.summary,
            "memory_type": self.memory_type.value,
            "priority": self.priority.value,
            "status": self.status.value,
            "domain": self.domain,
            "tags": self.tags,
            "entities": self.entities,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_accessed": self.last_accessed,
            "expires_at": self.expires_at,
            "confidence": self.confidence,
            "relevance": self.relevance,
            "access_count": self.access_count,
            "reinforcement_count": self.reinforcement_count,
            "decay_rate": self.decay_rate,
            "strength": self.strength,
            "related_ids": self.related_ids,
            "parent_id": self.parent_id,
            "source_ids": self.source_ids,
            "user_consented": self.user_consented,
            "user_protected": self.user_protected,
            "user_notes": self.user_notes,
            "consent_timestamp": self.consent_timestamp,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryNode":
        """Desserializa um nó a partir de dicionário."""
        node = cls(
            id=data.get("id", str(uuid.uuid4())),
            title=data.get("title", ""),
            content=data.get("content", ""),
            summary=data.get("summary", ""),
            memory_type=MemoryType(data.get("memory_type", "short_term")),
            priority=MemoryPriority(data.get("priority", "medium")),
            status=MemoryStatus(data.get("status", "pending")),
            domain=data.get("domain", "general"),
            tags=data.get("tags", []),
            entities=data.get("entities", []),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
            last_accessed=data.get("last_accessed", time.time()),
            expires_at=data.get("expires_at"),
            confidence=data.get("confidence", 1.0),
            relevance=data.get("relevance", 1.0),
            access_count=data.get("access_count", 0),
            reinforcement_count=data.get("reinforcement_count", 0),
            decay_rate=data.get("decay_rate", 0.01),
            strength=data.get("strength", 1.0),
            related_ids=data.get("related_ids", []),
            parent_id=data.get("parent_id"),
            source_ids=data.get("source_ids", []),
            user_consented=data.get("user_consented", False),
            user_protected=data.get("user_protected", False),
            user_notes=data.get("user_notes", ""),
            consent_timestamp=data.get("consent_timestamp"),
            metadata=data.get("metadata", {}),
        )
        return node

    def __repr__(self) -> str:
        return (
            f"MemoryNode(id={self.id[:8]}..., type={self.memory_type.value}, "
            f"priority={self.priority.value}, strength={self.strength:.2f}, "
            f"title='{self.title[:40]}')"
        )
