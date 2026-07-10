"""
Memory Timeline — Linha do Tempo de Memórias
=============================================
Organiza e visualiza as memórias em ordem cronológica,
permitindo navegação temporal pelo histórico do usuário.

Funcionalidades:
- Timeline por data de criação
- Timeline por último acesso
- Agrupamento por período (dia, semana, mês)
- Detecção de eventos recorrentes
- Exportação para visualização
"""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from ..models.memory_node import MemoryNode, MemoryType
from ..models.memory_event import MemoryEvent
from ..stores.memory_store import MemoryStore


class TimelineEntry:
    """Entrada na linha do tempo."""

    def __init__(
        self,
        timestamp: float,
        node: Optional[MemoryNode] = None,
        event: Optional[MemoryEvent] = None,
        label: str = "",
    ):
        self.timestamp = timestamp
        self.node = node
        self.event = event
        self.label = label
        self.dt = datetime.fromtimestamp(timestamp)

    @property
    def date_str(self) -> str:
        return self.dt.strftime("%Y-%m-%d")

    @property
    def time_str(self) -> str:
        return self.dt.strftime("%H:%M")

    @property
    def datetime_str(self) -> str:
        return self.dt.strftime("%Y-%m-%d %H:%M")

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "timestamp": self.timestamp,
            "datetime": self.datetime_str,
            "date": self.date_str,
            "time": self.time_str,
            "label": self.label,
        }
        if self.node:
            d["node"] = {
                "id": self.node.id,
                "title": self.node.title,
                "type": self.node.memory_type.value,
                "priority": self.node.priority.value,
                "domain": self.node.domain,
                "strength": round(self.node.strength, 3),
            }
        if self.event:
            d["event"] = self.event.to_dict()
        return d


class MemoryTimeline:
    """
    Linha do tempo das memórias do Companion.

    Permite navegar pelo histórico de memórias do usuário
    de forma cronológica e contextual.
    """

    def __init__(self, store: MemoryStore):
        self.store = store

    def get_full_timeline(
        self,
        include_archived: bool = False,
        limit: int = 200,
    ) -> List[TimelineEntry]:
        """Retorna a linha do tempo completa ordenada cronologicamente."""
        nodes = self.store.all(include_archived=include_archived)
        entries = [
            TimelineEntry(
                timestamp=node.created_at,
                node=node,
                label=f"Memória criada: {node.title}",
            )
            for node in nodes
        ]
        entries.sort(key=lambda e: e.timestamp, reverse=True)
        return entries[:limit]

    def get_timeline_by_period(
        self,
        period: str = "week",
        include_archived: bool = False,
    ) -> Dict[str, List[TimelineEntry]]:
        """
        Agrupa a timeline por período.
        period: "day", "week", "month", "year"
        """
        entries = self.get_full_timeline(include_archived=include_archived, limit=500)
        grouped: Dict[str, List[TimelineEntry]] = defaultdict(list)

        for entry in entries:
            if period == "day":
                key = entry.date_str
            elif period == "week":
                # ISO week
                key = entry.dt.strftime("%Y-W%W")
            elif period == "month":
                key = entry.dt.strftime("%Y-%m")
            elif period == "year":
                key = entry.dt.strftime("%Y")
            else:
                key = entry.date_str
            grouped[key].append(entry)

        return dict(grouped)

    def get_recent_timeline(self, days: int = 7) -> List[TimelineEntry]:
        """Retorna a timeline dos últimos N dias."""
        cutoff = time.time() - (days * 86400)
        entries = self.get_full_timeline(limit=500)
        return [e for e in entries if e.timestamp >= cutoff]

    def get_event_timeline(self, limit: int = 100) -> List[TimelineEntry]:
        """Retorna a timeline de eventos do sistema."""
        events = self.store.get_events(limit=limit)
        entries = [
            TimelineEntry(
                timestamp=event.timestamp,
                event=event,
                label=event.description or event.category.value,
            )
            for event in events
        ]
        entries.sort(key=lambda e: e.timestamp, reverse=True)
        return entries

    def get_domain_timeline(self, domain: str) -> List[TimelineEntry]:
        """Retorna a timeline de um domínio específico."""
        nodes = self.store.get_by_domain(domain)
        entries = [
            TimelineEntry(
                timestamp=node.created_at,
                node=node,
                label=f"{node.domain}: {node.title}",
            )
            for node in nodes
        ]
        entries.sort(key=lambda e: e.timestamp, reverse=True)
        return entries

    def get_recurrent_events(self) -> List[MemoryNode]:
        """Detecta e retorna eventos recorrentes."""
        return self.store.filter(tags=["recorrente"])

    def get_memory_density(self, days: int = 30) -> Dict[str, int]:
        """
        Retorna a densidade de memórias por dia nos últimos N dias.
        Útil para visualização de atividade.
        """
        cutoff = time.time() - (days * 86400)
        nodes = self.store.all()
        density: Dict[str, int] = {}

        # Inicializa todos os dias com 0
        for i in range(days):
            day = datetime.fromtimestamp(time.time() - (i * 86400))
            density[day.strftime("%Y-%m-%d")] = 0

        for node in nodes:
            if node.created_at >= cutoff:
                day_str = datetime.fromtimestamp(node.created_at).strftime("%Y-%m-%d")
                if day_str in density:
                    density[day_str] = density.get(day_str, 0) + 1

        return dict(sorted(density.items()))

    def to_dict(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Serializa a timeline para JSON."""
        return [e.to_dict() for e in self.get_full_timeline(limit=limit)]
