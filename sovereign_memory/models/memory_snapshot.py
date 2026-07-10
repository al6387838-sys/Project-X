"""
MemorySnapshot — Snapshot do Estado da Memória
================================================
Captura o estado completo do sistema de memória em um
ponto no tempo — útil para backup, auditoria e rollback.
"""
from __future__ import annotations

import uuid
import time
from typing import Any, Dict, List
from dataclasses import dataclass, field


@dataclass
class MemorySnapshot:
    """Snapshot completo do sistema de memória em um momento."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: float = field(default_factory=time.time)
    description: str = ""
    total_nodes: int = 0
    total_relations: int = 0
    nodes_by_type: Dict[str, int] = field(default_factory=dict)
    nodes_by_priority: Dict[str, int] = field(default_factory=dict)
    nodes_by_status: Dict[str, int] = field(default_factory=dict)
    avg_strength: float = 0.0
    avg_confidence: float = 0.0
    top_domains: List[str] = field(default_factory=list)
    top_entities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at,
            "description": self.description,
            "total_nodes": self.total_nodes,
            "total_relations": self.total_relations,
            "nodes_by_type": self.nodes_by_type,
            "nodes_by_priority": self.nodes_by_priority,
            "nodes_by_status": self.nodes_by_status,
            "avg_strength": self.avg_strength,
            "avg_confidence": self.avg_confidence,
            "top_domains": self.top_domains,
            "top_entities": self.top_entities,
            "metadata": self.metadata,
        }
