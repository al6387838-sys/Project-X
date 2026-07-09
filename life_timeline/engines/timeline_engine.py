"""
Timeline Engine
===============
Gerencia o registro e a recuperação de eventos da linha do tempo.
Implementa indexação para busca eficiente em décadas de dados.
"""

from typing import List, Dict, Any, Optional
from ..models.timeline_entry import TimelineEntry
import bisect
import time

class TimelineIndex:
    """Indexação para busca rápida por categoria, tempo e metadados."""
    def __init__(self):
        self.by_category: Dict[str, List[str]] = {}
        self.by_timestamp: List[tuple] = [] # List of (timestamp, id)
        self.by_id: Dict[str, TimelineEntry] = {}

    def add(self, entry: TimelineEntry):
        self.by_id[entry.timeline_id] = entry
        
        # Index by category
        if entry.category not in self.by_category:
            self.by_category[entry.category] = []
        self.by_category[entry.category].append(entry.timeline_id)
        
        # Index by timestamp (sorted)
        bisect.insort(self.by_timestamp, (entry.timestamp, entry.timeline_id))

class TimelineEngine:
    """Motor principal da Timeline Inteligente."""
    def __init__(self):
        self.index = TimelineIndex()

    def record_event(self, 
                     title: str, 
                     category: str, 
                     description: str = "", 
                     context: Dict[str, Any] = None,
                     impact: int = 0,
                     timestamp: float = None) -> TimelineEntry:
        """Registra um novo evento na linha do tempo."""
        entry = TimelineEntry(
            title=title,
            category=category,
            description=description,
            context=context or {},
            impact_score=impact,
            timestamp=timestamp if timestamp is not None else time.time()
        )
        self.index.add(entry)
        return entry

    def get_entry(self, entry_id: str) -> Optional[TimelineEntry]:
        return self.index.by_id.get(entry_id)

    def search(self, 
               category: str = None, 
               start_time: float = None, 
               end_time: float = None,
               query: str = None) -> List[TimelineEntry]:
        """Busca eventos baseada em múltiplos critérios."""
        results = []
        
        # Filtro inicial por categoria ou todos
        ids = self.index.by_category.get(category, []) if category else self.index.by_id.keys()
        
        for entry_id in ids:
            entry = self.index.by_id[entry_id]
            
            # Filtro por tempo
            if start_time and entry.timestamp < start_time: continue
            if end_time and entry.timestamp > end_time: continue
            
            # Filtro por texto
            if query:
                if query.lower() not in entry.title.lower() and \
                   query.lower() not in entry.description.lower():
                    continue
            
            results.append(entry)
            
        return sorted(results, key=lambda x: x.timestamp)
