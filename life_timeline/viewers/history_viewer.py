"""
History Viewer
==============
Fornece interfaces para navegar na linha do tempo por períodos
e realizar buscas complexas.
"""

from typing import List, Dict, Any
from ..engines.timeline_engine import TimelineEngine
from datetime import datetime, timedelta

class HistoryViewer:
    """Interface de navegação e visualização da história do usuário."""

    def __init__(self, engine: TimelineEngine):
        self.engine = engine

    def get_today(self) -> List[Any]:
        start = datetime.now().replace(hour=0, minute=0, second=0).timestamp()
        return self.engine.search(start_time=start)

    def get_this_week(self) -> List[Any]:
        start = (datetime.now() - timedelta(days=7)).timestamp()
        return self.engine.search(start_time=start)

    def get_this_month(self) -> List[Any]:
        start = (datetime.now() - timedelta(days=30)).timestamp()
        return self.engine.search(start_time=start)

    def get_this_year(self) -> List[Any]:
        start = (datetime.now() - timedelta(days=365)).timestamp()
        return self.engine.search(start_time=start)

    def search_by_entity(self, entity_type: str, entity_name: str) -> List[Any]:
        """Busca eventos relacionados a uma pessoa, projeto, lugar, etc."""
        all_entries = self.engine.search()
        results = []
        for entry in all_entries:
            if entity_type in entry.context:
                entities = entry.context[entity_type]
                if isinstance(entities, list):
                    if entity_name in entities:
                        results.append(entry)
                elif entities == entity_name:
                    results.append(entry)
        return results

    def get_life_milestones(self) -> List[Any]:
        """Retorna os momentos de maior impacto na vida."""
        all_entries = self.engine.search()
        milestones = [e for e in all_entries if e.impact_score >= 90]
        return sorted(milestones, key=lambda x: x.timestamp, reverse=True)
