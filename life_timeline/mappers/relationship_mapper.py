"""
Relationship Mapper
===================
Conecta automaticamente eventos da timeline baseando-se em contexto,
entidades (pessoas, locais, projetos) e causalidade.
"""

from typing import List, Dict, Any
from ..models.timeline_entry import TimelineEntry

class RelationshipMapper:
    """Mapeia conexões entre os eventos da vida."""

    def connect_entries(self, entry_a: TimelineEntry, entry_b: TimelineEntry, relation_type: str = "related"):
        """Cria uma conexão bidirecional entre duas entradas."""
        if entry_b.timeline_id not in entry_a.relationships:
            entry_a.relationships.append(entry_b.timeline_id)
        if entry_a.timeline_id not in entry_b.relationships:
            entry_b.relationships.append(entry_a.timeline_id)

    def auto_map_relationships(self, new_entry: TimelineEntry, existing_entries: List[TimelineEntry]):
        """
        Analisa e conecta automaticamente a nova entrada com as existentes.
        """
        for existing in existing_entries:
            # Conectar por projeto
            if "project" in new_entry.context and "project" in existing.context:
                if new_entry.context["project"] == existing.context["project"]:
                    self.connect_entries(new_entry, existing)
            
            # Conectar por pessoas
            new_people = set(new_entry.context.get("people", []))
            existing_people = set(existing.context.get("people", []))
            if new_people.intersection(existing_people):
                self.connect_entries(new_entry, existing)

            # Conectar por local
            if "location" in new_entry.context and "location" in existing.context:
                if new_entry.context["location"] == existing.context["location"]:
                    self.connect_entries(new_entry, existing)

    def get_relationship_graph(self, entry: TimelineEntry, all_entries: Dict[str, TimelineEntry]) -> List[Dict[str, Any]]:
        """Retorna o grafo de relacionamentos de uma entrada."""
        graph = []
        for rel_id in entry.relationships:
            if rel_id in all_entries:
                rel_entry = all_entries[rel_id]
                graph.append({
                    "id": rel_id,
                    "title": rel_entry.title,
                    "category": rel_entry.category,
                    "timestamp": rel_entry.timestamp
                })
        return graph
