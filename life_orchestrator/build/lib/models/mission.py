from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time
import uuid

@dataclass
class MissionStep:
    """Uma etapa individual de uma missão."""
    step_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    description: str = ""
    status: str = "pending" # pending, in_progress, completed, blocked
    dependencies: List[str] = field(default_factory=list) # IDs de outros passos
    assigned_engine: Optional[str] = None # Qual motor é responsável (ex: ActionEngine)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Mission:
    """Representa um objetivo real do usuário no LifeOS."""
    mission_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    objective: str = ""
    priority: int = 0 # 0 a 100
    status: str = "draft" # draft, active, paused, completed, cancelled
    progress: float = 0.0 # 0.0 a 100.0
    
    steps: List[MissionStep] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list) # IDs de outras missões
    
    risks: List[Dict[str, Any]] = field(default_factory=list)
    opportunities: List[Dict[str, Any]] = field(default_factory=list)
    
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__

@dataclass
class OrchestrationEvent:
    """Evento capturado pelo orquestrador que dispara atualizações em cascata."""
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    category: str = "general" # mission_update, context_change, user_interaction
    source: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
