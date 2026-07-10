"""
MemoryStore — Armazenamento Persistente de Memórias Soberanas
=============================================================
Responsável por persistir, recuperar e gerenciar todos os nós
de memória com suporte a busca, filtragem e soberania do usuário.

Arquitetura de armazenamento:
- Arquivo JSON principal (memórias ativas)
- Arquivo JSON de arquivo (memórias arquivadas)
- Arquivo JSON de eventos (auditoria completa)
- Arquivo JSON de relações (grafo de memórias)
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from ..models.memory_node import MemoryNode, MemoryType, MemoryPriority, MemoryStatus
from ..models.memory_event import MemoryEvent, EventCategory
from ..models.memory_relation import MemoryRelation


class MemoryStore:
    """
    Armazenamento soberano de memórias com persistência JSON.

    Princípios de soberania:
    - Nenhuma memória é salva sem user_consented=True.
    - Exclusão permanente é sempre possível.
    - Auditoria completa de todos os eventos.
    - Dados nunca saem do controle do usuário.
    """

    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.join(
                os.path.dirname(__file__), "..", "data"
            )
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self._nodes_file = self.data_dir / "memory_nodes.json"
        self._archive_file = self.data_dir / "memory_archive.json"
        self._events_file = self.data_dir / "memory_events.json"
        self._relations_file = self.data_dir / "memory_relations.json"

        # Cache em memória
        self._nodes: Dict[str, MemoryNode] = {}
        self._archive: Dict[str, MemoryNode] = {}
        self._events: List[MemoryEvent] = []
        self._relations: Dict[str, MemoryRelation] = {}

        self._load_all()

    # ------------------------------------------------------------------ #
    #  CARREGAMENTO E PERSISTÊNCIA                                         #
    # ------------------------------------------------------------------ #

    def _load_all(self) -> None:
        """Carrega todos os dados do disco."""
        self._nodes = self._load_nodes(self._nodes_file)
        self._archive = self._load_nodes(self._archive_file)
        self._events = self._load_events()
        self._relations = self._load_relations()

    def _load_nodes(self, path: Path) -> Dict[str, MemoryNode]:
        if not path.exists():
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {k: MemoryNode.from_dict(v) for k, v in data.items()}
        except Exception:
            return {}

    def _load_events(self) -> List[MemoryEvent]:
        if not self._events_file.exists():
            return []
        try:
            with open(self._events_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return [MemoryEvent.from_dict(e) for e in data]
        except Exception:
            return []

    def _load_relations(self) -> Dict[str, MemoryRelation]:
        if not self._relations_file.exists():
            return {}
        try:
            with open(self._relations_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {k: MemoryRelation.from_dict(v) for k, v in data.items()}
        except Exception:
            return {}

    def _save_nodes(self) -> None:
        with open(self._nodes_file, "w", encoding="utf-8") as f:
            json.dump(
                {k: v.to_dict() for k, v in self._nodes.items()},
                f, ensure_ascii=False, indent=2
            )

    def _save_archive(self) -> None:
        with open(self._archive_file, "w", encoding="utf-8") as f:
            json.dump(
                {k: v.to_dict() for k, v in self._archive.items()},
                f, ensure_ascii=False, indent=2
            )

    def _save_events(self) -> None:
        with open(self._events_file, "w", encoding="utf-8") as f:
            json.dump(
                [e.to_dict() for e in self._events[-5000:]],  # Mantém últimos 5000
                f, ensure_ascii=False, indent=2
            )

    def _save_relations(self) -> None:
        with open(self._relations_file, "w", encoding="utf-8") as f:
            json.dump(
                {k: v.to_dict() for k, v in self._relations.items()},
                f, ensure_ascii=False, indent=2
            )

    def _log_event(
        self,
        memory_id: str,
        category: EventCategory,
        actor: str = "system",
        description: str = "",
        metadata: Optional[Dict] = None,
    ) -> None:
        event = MemoryEvent(
            memory_id=memory_id,
            category=category,
            actor=actor,
            description=description,
            metadata=metadata or {},
        )
        self._events.append(event)
        self._save_events()

    # ------------------------------------------------------------------ #
    #  OPERAÇÕES CRUD                                                      #
    # ------------------------------------------------------------------ #

    def save(self, node: MemoryNode, actor: str = "system") -> MemoryNode:
        """
        Salva um nó de memória.
        Somente memórias com user_consented=True são persistidas.
        """
        if not node.user_consented:
            raise PermissionError(
                f"Memória '{node.id}' não pode ser salva sem consentimento do usuário."
            )
        is_new = node.id not in self._nodes
        node.updated_at = time.time()
        self._nodes[node.id] = node
        self._save_nodes()
        self._log_event(
            node.id,
            EventCategory.CREATED if is_new else EventCategory.UPDATED,
            actor=actor,
            description=f"{'Criada' if is_new else 'Atualizada'}: {node.title}",
        )
        return node

    def get(self, memory_id: str) -> Optional[MemoryNode]:
        """Recupera uma memória pelo ID."""
        node = self._nodes.get(memory_id)
        if node:
            node.touch()
            self._save_nodes()
            self._log_event(
                memory_id, EventCategory.ACCESSED,
                description=f"Acessada: {node.title}"
            )
        return node

    def get_from_archive(self, memory_id: str) -> Optional[MemoryNode]:
        """Recupera uma memória arquivada pelo ID."""
        return self._archive.get(memory_id)

    def delete(self, memory_id: str, actor: str = "user", permanent: bool = False) -> bool:
        """
        Exclui uma memória.
        - permanent=False: move para arquivo.
        - permanent=True: exclusão permanente (requer confirmação).
        """
        node = self._nodes.get(memory_id)
        if not node:
            node = self._archive.get(memory_id)
            if not node:
                return False

        if node.user_protected and actor != "user":
            raise PermissionError(
                f"Memória '{memory_id}' está protegida. Apenas o usuário pode excluí-la."
            )

        if permanent:
            self._nodes.pop(memory_id, None)
            self._archive.pop(memory_id, None)
            # Remove relações associadas
            to_remove = [
                rid for rid, r in self._relations.items()
                if r.source_id == memory_id or r.target_id == memory_id
            ]
            for rid in to_remove:
                del self._relations[rid]
            self._save_nodes()
            self._save_archive()
            self._save_relations()
            self._log_event(
                memory_id, EventCategory.DELETED,
                actor=actor,
                description=f"Excluída permanentemente: {node.title}"
            )
        else:
            node.status = MemoryStatus.ARCHIVED
            self._nodes.pop(memory_id, None)
            self._archive[memory_id] = node
            self._save_nodes()
            self._save_archive()
            self._log_event(
                memory_id, EventCategory.ARCHIVED,
                actor=actor,
                description=f"Arquivada: {node.title}"
            )
        return True

    def restore(self, memory_id: str, actor: str = "user") -> Optional[MemoryNode]:
        """Restaura uma memória arquivada para ativa."""
        node = self._archive.get(memory_id)
        if not node:
            return None
        node.status = MemoryStatus.ACTIVE
        self._archive.pop(memory_id)
        self._nodes[memory_id] = node
        self._save_nodes()
        self._save_archive()
        self._log_event(
            memory_id, EventCategory.UPDATED,
            actor=actor,
            description=f"Restaurada do arquivo: {node.title}"
        )
        return node

    # ------------------------------------------------------------------ #
    #  CONSULTAS E FILTRAGEM                                               #
    # ------------------------------------------------------------------ #

    def all(self, include_archived: bool = False) -> List[MemoryNode]:
        """Retorna todas as memórias ativas (e opcionalmente arquivadas)."""
        nodes = list(self._nodes.values())
        if include_archived:
            nodes += list(self._archive.values())
        return nodes

    def filter(
        self,
        memory_type: Optional[MemoryType] = None,
        priority: Optional[MemoryPriority] = None,
        status: Optional[MemoryStatus] = None,
        domain: Optional[str] = None,
        tags: Optional[List[str]] = None,
        min_strength: float = 0.0,
        min_confidence: float = 0.0,
        include_archived: bool = False,
    ) -> List[MemoryNode]:
        """Filtra memórias por múltiplos critérios."""
        nodes = self.all(include_archived=include_archived)
        result = []
        for node in nodes:
            if memory_type and node.memory_type != memory_type:
                continue
            if priority and node.priority != priority:
                continue
            if status and node.status != status:
                continue
            if domain and node.domain != domain:
                continue
            if tags and not any(t in node.tags for t in tags):
                continue
            if node.strength < min_strength:
                continue
            if node.confidence < min_confidence:
                continue
            result.append(node)
        return result

    def search(self, query: str, limit: int = 20) -> List[MemoryNode]:
        """Busca textual simples em título, conteúdo, tags e entidades."""
        query_lower = query.lower()
        results = []
        for node in self._nodes.values():
            score = 0.0
            if query_lower in node.title.lower():
                score += 3.0
            if query_lower in node.content.lower():
                score += 2.0
            if query_lower in node.summary.lower():
                score += 1.5
            if any(query_lower in t.lower() for t in node.tags):
                score += 1.0
            if any(query_lower in e.lower() for e in node.entities):
                score += 1.0
            if score > 0:
                results.append((score * node.strength * node.confidence, node))

        results.sort(key=lambda x: x[0], reverse=True)
        return [n for _, n in results[:limit]]

    def get_by_entity(self, entity: str) -> List[MemoryNode]:
        """Retorna todas as memórias que envolvem uma entidade."""
        entity_lower = entity.lower()
        return [
            n for n in self._nodes.values()
            if any(entity_lower in e.lower() for e in n.entities)
        ]

    def get_by_domain(self, domain: str) -> List[MemoryNode]:
        """Retorna todas as memórias de um domínio."""
        return [n for n in self._nodes.values() if n.domain == domain]

    def get_recent(self, limit: int = 10) -> List[MemoryNode]:
        """Retorna as memórias mais recentemente acessadas."""
        nodes = list(self._nodes.values())
        nodes.sort(key=lambda n: n.last_accessed, reverse=True)
        return nodes[:limit]

    def get_strongest(self, limit: int = 10) -> List[MemoryNode]:
        """Retorna as memórias mais fortes."""
        nodes = list(self._nodes.values())
        nodes.sort(key=lambda n: n.strength * n.confidence, reverse=True)
        return nodes[:limit]

    def get_protected(self) -> List[MemoryNode]:
        """Retorna todas as memórias protegidas pelo usuário."""
        return [n for n in self._nodes.values() if n.user_protected]

    def get_weak(self, threshold: float = 0.2) -> List[MemoryNode]:
        """Retorna memórias fracas candidatas a arquivamento."""
        return [n for n in self._nodes.values() if n.is_weak(threshold)]

    # ------------------------------------------------------------------ #
    #  RELAÇÕES (GRAFO)                                                    #
    # ------------------------------------------------------------------ #

    def add_relation(self, relation: MemoryRelation) -> MemoryRelation:
        """Adiciona uma relação entre dois nós."""
        self._relations[relation.id] = relation
        # Atualiza related_ids nos nós
        src = self._nodes.get(relation.source_id)
        tgt = self._nodes.get(relation.target_id)
        if src and relation.target_id not in src.related_ids:
            src.related_ids.append(relation.target_id)
        if tgt and relation.source_id not in tgt.related_ids:
            tgt.related_ids.append(relation.source_id)
        self._save_nodes()
        self._save_relations()
        return relation

    def get_relations(self, memory_id: str) -> List[MemoryRelation]:
        """Retorna todas as relações de um nó."""
        return [
            r for r in self._relations.values()
            if r.source_id == memory_id or r.target_id == memory_id
        ]

    def all_relations(self) -> List[MemoryRelation]:
        """Retorna todas as relações."""
        return list(self._relations.values())

    # ------------------------------------------------------------------ #
    #  EVENTOS (AUDITORIA)                                                 #
    # ------------------------------------------------------------------ #

    def get_events(
        self,
        memory_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[MemoryEvent]:
        """Retorna eventos de auditoria."""
        events = self._events
        if memory_id:
            events = [e for e in events if e.memory_id == memory_id]
        return sorted(events, key=lambda e: e.timestamp, reverse=True)[:limit]

    # ------------------------------------------------------------------ #
    #  ESTATÍSTICAS                                                        #
    # ------------------------------------------------------------------ #

    def stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do armazenamento."""
        nodes = list(self._nodes.values())
        archived = list(self._archive.values())

        by_type = {}
        by_priority = {}
        by_status = {}
        by_domain = {}

        for n in nodes:
            by_type[n.memory_type.value] = by_type.get(n.memory_type.value, 0) + 1
            by_priority[n.priority.value] = by_priority.get(n.priority.value, 0) + 1
            by_status[n.status.value] = by_status.get(n.status.value, 0) + 1
            by_domain[n.domain] = by_domain.get(n.domain, 0) + 1

        avg_strength = sum(n.strength for n in nodes) / len(nodes) if nodes else 0
        avg_confidence = sum(n.confidence for n in nodes) / len(nodes) if nodes else 0

        return {
            "total_active": len(nodes),
            "total_archived": len(archived),
            "total_relations": len(self._relations),
            "total_events": len(self._events),
            "by_type": by_type,
            "by_priority": by_priority,
            "by_status": by_status,
            "by_domain": by_domain,
            "avg_strength": round(avg_strength, 3),
            "avg_confidence": round(avg_confidence, 3),
        }
