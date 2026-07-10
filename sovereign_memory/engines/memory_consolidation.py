"""
Memory Consolidation Engine — Consolidação de Memórias
=======================================================
Implementa o processo de consolidação da memória, análogo
ao processo de consolidação durante o sono na neurociência.

O processo de consolidação:
1. Identifica memórias de curto prazo candidatas
2. Verifica critérios de consolidação
3. Promove para longo prazo com ajuste de parâmetros
4. Cria relações semânticas entre memórias consolidadas
5. Comprime contexto redundante
6. Detecta e remove duplicatas
7. Detecta padrões e relacionamentos

Baseado em:
- Teoria da Consolidação Sistêmica (McClelland et al., 1995)
- Complementary Learning Systems (Kumaran et al., 2016)
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from ..models.memory_node import MemoryNode, MemoryType, MemoryPriority, MemoryStatus
from ..models.memory_relation import MemoryRelation, RelationType
from ..stores.memory_store import MemoryStore
from .memory_graph import MemoryGraph


class ConsolidationResult:
    """Resultado de um ciclo de consolidação."""

    def __init__(self):
        self.consolidated: List[str] = []
        self.duplicates_removed: List[str] = []
        self.relations_created: List[str] = []
        self.compressed: List[str] = []
        self.promoted: List[str] = []
        self.errors: List[str] = []
        self.duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "consolidated": len(self.consolidated),
            "duplicates_removed": len(self.duplicates_removed),
            "relations_created": len(self.relations_created),
            "compressed": len(self.compressed),
            "promoted": len(self.promoted),
            "errors": len(self.errors),
            "duration_ms": round(self.duration_ms, 2),
            "consolidated_ids": self.consolidated,
            "duplicate_ids": self.duplicates_removed,
        }


class MemoryConsolidation:
    """
    Motor de consolidação de memórias.

    Executa periodicamente para:
    - Promover memórias de curto para longo prazo
    - Detectar e mesclar duplicatas
    - Criar relações entre memórias relacionadas
    - Comprimir contexto redundante
    """

    # Critérios de consolidação
    MIN_ACCESSES_FOR_CONSOLIDATION = 2
    MIN_AGE_HOURS = 0.5
    MIN_STRENGTH_FOR_CONSOLIDATION = 0.5

    # Similaridade para detecção de duplicatas
    DUPLICATE_SIMILARITY_THRESHOLD = 0.85

    def __init__(self, store: MemoryStore, graph: MemoryGraph):
        self.store = store
        self.graph = graph
        self._last_consolidation: float = 0.0

    # ------------------------------------------------------------------ #
    #  CONSOLIDAÇÃO PRINCIPAL                                              #
    # ------------------------------------------------------------------ #

    def run(self, force: bool = False) -> ConsolidationResult:
        """
        Executa o ciclo completo de consolidação.
        """
        start_time = time.time()
        result = ConsolidationResult()

        # 1. Consolidar memórias de curto prazo
        self._consolidate_short_term(result)

        # 2. Detectar e remover duplicatas
        self._detect_duplicates(result)

        # 3. Detectar relacionamentos
        self._detect_relationships(result)

        # 4. Comprimir contexto
        self._compress_context(result)

        result.duration_ms = (time.time() - start_time) * 1000
        self._last_consolidation = time.time()
        return result

    def _consolidate_short_term(self, result: ConsolidationResult) -> None:
        """Promove memórias de curto prazo para longo prazo."""
        candidates = self.store.filter(memory_type=MemoryType.SHORT_TERM)
        now = time.time()

        for node in candidates:
            age_hours = (now - node.created_at) / 3600
            meets_age = age_hours >= self.MIN_AGE_HOURS
            meets_accesses = node.access_count >= self.MIN_ACCESSES_FOR_CONSOLIDATION
            meets_strength = node.strength >= self.MIN_STRENGTH_FOR_CONSOLIDATION

            if meets_age and (meets_accesses or meets_strength):
                node.promote_to_long_term()
                self.store.save(node, actor="consolidation_engine")
                result.consolidated.append(node.id)
                result.promoted.append(node.id)

    def _detect_duplicates(self, result: ConsolidationResult) -> None:
        """
        Detecta memórias duplicadas ou muito similares.
        Usa similaridade de texto simples (Jaccard).
        """
        nodes = self.store.all()
        processed: set = set()

        for i, node_a in enumerate(nodes):
            if node_a.id in processed:
                continue
            for node_b in nodes[i + 1:]:
                if node_b.id in processed:
                    continue
                similarity = self._jaccard_similarity(
                    node_a.content, node_b.content
                )
                if similarity >= self.DUPLICATE_SIMILARITY_THRESHOLD:
                    # Mantém o mais forte, arquiva o mais fraco
                    keep = node_a if node_a.strength >= node_b.strength else node_b
                    discard = node_b if keep == node_a else node_a

                    # Cria relação de duplicata
                    self.graph.add_relation(
                        source_id=keep.id,
                        target_id=discard.id,
                        relation_type=RelationType.DUPLICATE_OF,
                        weight=similarity,
                        confidence=similarity,
                        auto_detected=True,
                    )

                    # Transfere metadados relevantes
                    for tag in discard.tags:
                        if tag not in keep.tags:
                            keep.tags.append(tag)
                    for entity in discard.entities:
                        if entity not in keep.entities:
                            keep.entities.append(entity)
                    keep.reinforcement_count += 1
                    keep.strength = min(1.0, keep.strength + 0.05)
                    self.store.save(keep, actor="consolidation_engine")

                    # Arquiva a duplicata
                    if not discard.user_protected:
                        self.store.delete(discard.id, actor="consolidation_engine")
                        result.duplicates_removed.append(discard.id)
                        processed.add(discard.id)

    def _detect_relationships(self, result: ConsolidationResult) -> None:
        """
        Detecta relacionamentos entre memórias.
        Analisa entidades, tags e domínios compartilhados.
        """
        nodes = self.store.all()
        existing_relations = {
            (r.source_id, r.target_id)
            for r in self.store.all_relations()
        }

        for i, node_a in enumerate(nodes):
            for node_b in nodes[i + 1:]:
                if (node_a.id, node_b.id) in existing_relations:
                    continue

                relation_type, confidence = self._infer_relation(node_a, node_b)
                if relation_type and confidence > 0.4:
                    self.graph.add_relation(
                        source_id=node_a.id,
                        target_id=node_b.id,
                        relation_type=relation_type,
                        weight=confidence,
                        confidence=confidence,
                        auto_detected=True,
                    )
                    result.relations_created.append(
                        f"{node_a.id[:8]}→{node_b.id[:8]}"
                    )

    def _compress_context(self, result: ConsolidationResult) -> None:
        """
        Comprime memórias de contexto expiradas ou redundantes.
        """
        context_nodes = self.store.filter(memory_type=MemoryType.CONTEXT)
        now = time.time()

        for node in context_nodes:
            # Comprime contexto expirado
            if node.is_expired():
                self.store.delete(node.id, actor="consolidation_engine", permanent=True)
                result.compressed.append(node.id)
                continue

            # Comprime contexto muito fraco
            if node.strength < 0.1 and not node.user_protected:
                self.store.delete(node.id, actor="consolidation_engine", permanent=True)
                result.compressed.append(node.id)

    # ------------------------------------------------------------------ #
    #  UTILITÁRIOS DE SIMILARIDADE                                         #
    # ------------------------------------------------------------------ #

    def _jaccard_similarity(self, text_a: str, text_b: str) -> float:
        """Calcula similaridade de Jaccard entre dois textos."""
        if not text_a or not text_b:
            return 0.0
        words_a = set(text_a.lower().split())
        words_b = set(text_b.lower().split())
        if not words_a and not words_b:
            return 1.0
        intersection = words_a & words_b
        union = words_a | words_b
        return len(intersection) / len(union) if union else 0.0

    def _infer_relation(
        self,
        node_a: MemoryNode,
        node_b: MemoryNode,
    ) -> Tuple[Optional[RelationType], float]:
        """
        Infere o tipo de relação entre dois nós.
        Retorna (tipo, confiança) ou (None, 0.0).
        """
        # Mesmas entidades → relacionados
        shared_entities = set(node_a.entities) & set(node_b.entities)
        if shared_entities:
            return RelationType.INVOLVES_PERSON, 0.8

        # Mesmo projeto
        if node_a.domain == "projetos" and node_b.domain == "projetos":
            if node_a.metadata.get("project_name") == node_b.metadata.get("project_name"):
                return RelationType.INVOLVES_PROJECT, 0.9

        # Tags compartilhadas
        shared_tags = set(node_a.tags) & set(node_b.tags)
        tag_similarity = len(shared_tags) / max(
            len(set(node_a.tags) | set(node_b.tags)) if node_a.tags or node_b.tags else 1, 1
        )
        if tag_similarity > 0.5:
            return RelationType.RELATED_TO, tag_similarity

        # Mesmo domínio com conteúdo similar
        if node_a.domain == node_b.domain:
            content_sim = self._jaccard_similarity(node_a.content, node_b.content)
            if content_sim > 0.3:
                return RelationType.SIMILAR_TO, content_sim

        # Relação temporal
        time_diff = abs(node_a.created_at - node_b.created_at)
        if time_diff < 3600:  # Criadas na mesma hora
            return RelationType.RELATED_TO, 0.5

        return None, 0.0

    # ------------------------------------------------------------------ #
    #  PRIORIZAÇÃO DINÂMICA                                                #
    # ------------------------------------------------------------------ #

    def reprioritize(self) -> int:
        """
        Recalcula prioridades dinamicamente baseado em:
        - Frequência de acesso
        - Força atual
        - Centralidade no grafo
        - Idade da memória
        Retorna número de memórias repriorizadas.
        """
        centrality = self.graph.centrality()
        nodes = self.store.all()
        reprioritized = 0

        for node in nodes:
            if node.user_protected:
                continue

            old_priority = node.priority
            score = self._calculate_priority_score(node, centrality.get(node.id, 0))
            new_priority = self._score_to_priority(score)

            if new_priority != old_priority:
                node.priority = new_priority
                self.store.save(node, actor="consolidation_engine")
                reprioritized += 1

        return reprioritized

    def _calculate_priority_score(
        self, node: MemoryNode, centrality_score: float
    ) -> float:
        """Calcula score de prioridade composto."""
        # Frequência de acesso (normalizada)
        access_score = min(1.0, node.access_count / 20)

        # Força atual
        strength_score = node.strength

        # Centralidade no grafo (normalizada)
        centrality_normalized = min(1.0, centrality_score / 10)

        # Reforço pelo usuário
        reinforcement_score = min(1.0, node.reinforcement_count / 5)

        # Score composto ponderado
        return (
            0.30 * access_score
            + 0.30 * strength_score
            + 0.20 * centrality_normalized
            + 0.20 * reinforcement_score
        )

    def _score_to_priority(self, score: float) -> MemoryPriority:
        """Converte score numérico em prioridade."""
        if score >= 0.8:
            return MemoryPriority.CRITICAL
        elif score >= 0.6:
            return MemoryPriority.HIGH
        elif score >= 0.4:
            return MemoryPriority.MEDIUM
        elif score >= 0.2:
            return MemoryPriority.LOW
        else:
            return MemoryPriority.EPHEMERAL
