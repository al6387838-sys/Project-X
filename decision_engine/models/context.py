from dataclasses import dataclass, field
from typing import List, Dict, Any

@dataclass
class ContextInput:
    life_graph_data: Dict[str, Any] = field(default_factory=dict)
    context_engine_data: Dict[str, Any] = field(default_factory=dict)
    memory_engine_data: Dict[str, Any] = field(default_factory=dict)
    
@dataclass
class Conflict:
    conflict_id: str
    description: str
    involved_decisions: List[str]
    severity: int = 1
    resolution_strategy: str = ""
    resolved: bool = False
