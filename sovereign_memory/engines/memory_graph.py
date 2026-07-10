"""
Memory Graph — Grafo de Memórias Soberanas
==========================================
Implementa o grafo de conhecimento do Companion, onde cada
nó é uma memória e cada aresta é uma relação detectada.

O Memory Graph permite:
- Navegação por associação (como a memória humana)
- Descoberta de padrões e conexões
- Visualização da rede de conhecimento
- Detecção de clusters temáticos
- Cálculo de centralidade e importância
"""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple

from ..models.memory_node import MemoryNode, MemoryType, MemoryPriority
from ..models.memory_relation import MemoryRelation, RelationType
from ..stores.memory_store import MemoryStore


class MemoryGraph:
    """
    Grafo de memórias — estrutura de conhecimento do Companion.

    Implementa um grafo dirigido ponderado onde:
    - Vértices = MemoryNodes
    - Arestas = MemoryRelations com pesos
    """

    def __init__(self, store: MemoryStore):
        self.store = store
        self._adjacency: Dict[str, List[Tuple[str, MemoryRelation]]] = defaultdict(list)
        self._reverse_adjacency: Dict[str, List[Tuple[str, MemoryRelation]]] = defaultdict(list)
        self._rebuild()

    def _rebuild(self) -> None:
        """Reconstrói o grafo a partir do store."""
        self._adjacency.clear()
        self._reverse_adjacency.clear()
        for relation in self.store.all_relations():
            self._adjacency[relation.source_id].append(
                (relation.target_id, relation)
            )
            self._reverse_adjacency[relation.target_id].append(
                (relation.source_id, relation)
            )

    def add_relation(
        self,
        source_id: str,
        target_id: str,
        relation_type: RelationType = RelationType.RELATED_TO,
        weight: float = 1.0,
        confidence: float = 1.0,
        auto_detected: bool = False,
    ) -> MemoryRelation:
        """Adiciona uma relação ao grafo."""
        relation = MemoryRelation(
            source_id=source_id,
            target_id=target_id,
            relation_type=relation_type,
            weight=weight,
            confidence=confidence,
            auto_detected=auto_detected,
        )
        self.store.add_relation(relation)
        self._adjacency[source_id].append((target_id, relation))
        self._reverse_adjacency[target_id].append((source_id, relation))
        return relation

    def neighbors(
        self,
        memory_id: str,
        min_weight: float = 0.0,
    ) -> List[Tuple[MemoryNode, MemoryRelation]]:
        """Retorna vizinhos diretos de um nó."""
        result = []
        for target_id, relation in self._adjacency.get(memory_id, []):
            if relation.weight >= min_weight:
                node = self.store.get(target_id)
                if node:
                    result.append((node, relation))
        return result

    def bfs(
        self,
        start_id: str,
        max_depth: int = 3,
        min_weight: float = 0.3,
    ) -> List[Tuple[MemoryNode, int, MemoryRelation]]:
        """
        Busca em largura a partir de um nó.
        Retorna (nó, profundidade, relação).
        """
        visited: Set[str] = {start_id}
        queue = deque([(start_id, 0, None)])
        result = []

        while queue:
            current_id, depth, rel = queue.popleft()
            if depth > 0:
                node = self.store.get(current_id)
                if node:
                    result.append((node, depth, rel))

            if depth < max_depth:
                for target_id, relation in self._adjacency.get(current_id, []):
                    if target_id not in visited and relation.weight >= min_weight:
                        visited.add(target_id)
                        queue.append((target_id, depth + 1, relation))

        return result

    def find_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 5,
    ) -> Optional[List[Tuple[str, MemoryRelation]]]:
        """Encontra o caminho mais curto entre dois nós."""
        if source_id == target_id:
            return []

        visited: Set[str] = {source_id}
        queue = deque([(source_id, [])])

        while queue:
            current_id, path = queue.popleft()
            for next_id, relation in self._adjacency.get(current_id, []):
                if next_id == target_id:
                    return path + [(next_id, relation)]
                if next_id not in visited and len(path) < max_depth:
                    visited.add(next_id)
                    queue.append((next_id, path + [(next_id, relation)]))

        return None

    def get_clusters(self) -> Dict[str, List[str]]:
        """
        Detecta clusters temáticos no grafo.
        Retorna dicionário {cluster_id: [memory_ids]}.
        """
        all_ids = set(self.store._nodes.keys())
        visited: Set[str] = set()
        clusters: Dict[str, List[str]] = {}
        cluster_idx = 0

        for start_id in all_ids:
            if start_id in visited:
                continue
            # BFS para encontrar componente conectado
            component = []
            queue = deque([start_id])
            while queue:
                nid = queue.popleft()
                if nid in visited:
                    continue
                visited.add(nid)
                component.append(nid)
                for neighbor_id, _ in self._adjacency.get(nid, []):
                    if neighbor_id not in visited:
                        queue.append(neighbor_id)
                for neighbor_id, _ in self._reverse_adjacency.get(nid, []):
                    if neighbor_id not in visited:
                        queue.append(neighbor_id)

            if component:
                clusters[f"cluster_{cluster_idx}"] = component
                cluster_idx += 1

        return clusters

    def centrality(self) -> Dict[str, float]:
        """
        Calcula centralidade de grau para cada nó.
        Nós mais centrais são mais importantes no grafo.
        """
        scores: Dict[str, float] = {}
        all_nodes = self.store.all()

        for node in all_nodes:
            out_degree = len(self._adjacency.get(node.id, []))
            in_degree = len(self._reverse_adjacency.get(node.id, []))
            # Centralidade ponderada por força e prioridade
            priority_weight = {
                "critical": 2.0, "high": 1.5, "medium": 1.0,
                "low": 0.5, "ephemeral": 0.1,
            }.get(node.priority.value, 1.0)
            scores[node.id] = (out_degree + in_degree) * node.strength * priority_weight

        return scores

    def most_connected(self, limit: int = 10) -> List[Tuple[MemoryNode, float]]:
        """Retorna os nós mais conectados (mais centrais)."""
        scores = self.centrality()
        sorted_ids = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        result = []
        for nid, score in sorted_ids[:limit]:
            node = self.store.get(nid)
            if node:
                result.append((node, score))
        return result

    def get_graph_data(self) -> Dict[str, Any]:
        """
        Retorna dados do grafo para visualização.
        Formato compatível com D3.js / vis.js.
        """
        nodes_data = []
        edges_data = []

        for node in self.store.all():
            nodes_data.append({
                "id": node.id,
                "label": node.title[:40],
                "type": node.memory_type.value,
                "priority": node.priority.value,
                "strength": round(node.strength, 3),
                "domain": node.domain,
                "tags": node.tags[:3],
            })

        for relation in self.store.all_relations():
            edges_data.append({
                "id": relation.id,
                "source": relation.source_id,
                "target": relation.target_id,
                "type": relation.relation_type.value,
                "weight": round(relation.weight, 3),
                "confidence": round(relation.confidence, 3),
                "auto_detected": relation.auto_detected,
            })

        return {
            "nodes": nodes_data,
            "edges": edges_data,
            "stats": {
                "total_nodes": len(nodes_data),
                "total_edges": len(edges_data),
                "clusters": len(self.get_clusters()),
            },
        }

    def to_mermaid(self, limit: int = 20) -> str:
        """Gera representação Mermaid do grafo (para documentação)."""
        lines = ["graph LR"]
        nodes = self.store.get_strongest(limit)
        node_ids = {n.id for n in nodes}

        for node in nodes:
            safe_id = node.id[:8].replace("-", "_")
            label = node.title[:30].replace('"', "'")
            lines.append(f'    {safe_id}["{label}"]')

        for relation in self.store.all_relations():
            if relation.source_id in node_ids and relation.target_id in node_ids:
                src = relation.source_id[:8].replace("-", "_")
                tgt = relation.target_id[:8].replace("-", "_")
                rel_label = relation.relation_type.value.replace("_", " ")
                lines.append(f"    {src} -->|{rel_label}| {tgt}")

        return "\n".join(lines)
