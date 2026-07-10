"""
Sovereign Memory — Memória Soberana Evolutiva
=============================================
Sistema completo de memória para o Companion do PROJECT-X.

Uso básico:
    from sovereign_memory import SovereignMemory

    memory = SovereignMemory()
    memory.learn_preference("tema", "dark mode")
    memory.learn_goal("Lançar o produto em Q3 2026")
    memory.learn_person("Ana", "esposa", "aniversário em 15/08")

    context = memory.get_context_for_companion("preferências visuais")
    memories = memory.recall("objetivos do projeto")

Versão: 1.0.0
Phase: EXECUTION-006
"""
from .core.sovereign_memory import SovereignMemory
from .models.memory_node import MemoryNode, MemoryType, MemoryPriority, MemoryStatus
from .models.memory_event import MemoryEvent, EventCategory
from .models.memory_relation import MemoryRelation, RelationType
from .stores.memory_store import MemoryStore
from .engines.memory_evolution_engine import MemoryEvolutionEngine
from .engines.memory_graph import MemoryGraph
from .engines.memory_timeline import MemoryTimeline
from .engines.memory_consolidation import MemoryConsolidation

__version__ = "1.0.0"
__all__ = [
    "SovereignMemory",
    "MemoryNode",
    "MemoryType",
    "MemoryPriority",
    "MemoryStatus",
    "MemoryEvent",
    "EventCategory",
    "MemoryRelation",
    "RelationType",
    "MemoryStore",
    "MemoryEvolutionEngine",
    "MemoryGraph",
    "MemoryTimeline",
    "MemoryConsolidation",
]
