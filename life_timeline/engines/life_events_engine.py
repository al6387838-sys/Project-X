"""
Life Events Engine
==================
Detecta automaticamente marcos importantes na vida do usuário:
- Mudanças significativas (emprego, rotina, saúde)
- Conquistas e Fracassos
- Padrões de longo prazo
"""

from typing import List, Dict, Any
from ..models.timeline_entry import TimelineEntry

class LifeEventsEngine:
    """Motor de detecção de marcos de vida."""

    def detect_major_change(self, entries: List[TimelineEntry]) -> List[TimelineEntry]:
        """Detecta mudanças significativas baseadas no impacto e categoria."""
        changes = [e for e in entries if e.category == "changes" or e.impact_score > 80]
        return sorted(changes, key=lambda x: x.timestamp, reverse=True)

    def get_achievements(self, entries: List[TimelineEntry]) -> List[TimelineEntry]:
        """Filtra todas as conquistas registradas."""
        return [e for e in entries if e.category == "achievements"]

    def analyze_causality(self, entries: List[TimelineEntry]) -> List[Dict[str, Any]]:
        """
        Analisa a cadeia de causalidade entre eventos.
        Ex: Mudança de emprego -> Mudança de rotina -> Mudança na saúde.
        """
        chains = []
        sorted_entries = sorted(entries, key=lambda x: x.timestamp)
        
        for i, entry in enumerate(sorted_entries):
            if entry.category == "changes":
                chain = [entry]
                # Busca eventos relacionados subsequentes
                for j in range(i + 1, min(i + 5, len(sorted_entries))):
                    next_entry = sorted_entries[j]
                    if next_entry.category == "changes" or next_entry.impact_score > 50:
                        # Verifica se há relação direta (via context ou relationships)
                        if set(chain[-1].relationships).intersection([next_entry.timeline_id]):
                            chain.append(next_entry)
                if len(chain) > 1:
                    chains.append({
                        "root": entry.title,
                        "chain": [e.title for e in chain],
                        "impact_progression": [e.impact_score for e in chain]
                    })
        return chains
