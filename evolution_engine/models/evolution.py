from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time
import uuid

@dataclass
class EvolutionSnapshot:
    """Registra um snapshot do estado evolutivo do usuário em um momento."""
    snapshot_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    
    # Métricas calculadas
    confidence_score: float = 0.0     # 0.0 a 1.0 - O quanto o sistema confia nas suas próprias predições
    evolution_score: float = 0.0      # 0.0 a 100.0 - O quanto o usuário evoluiu desde o início
    adaptation_score: float = 0.0     # 0.0 a 100.0 - O quanto o sistema se adaptou ao usuário
    learning_velocity: float = 0.0    # Taxa de aprendizado atual
    
    # Aprendizados
    routines_learned: List[str] = field(default_factory=list)
    preferences_learned: List[str] = field(default_factory=list)
    habits_learned: List[str] = field(default_factory=list)
    goals_updated: List[str] = field(default_factory=list)
    
    # Formas identificadas
    work_style: str = "unknown"
    learning_style: str = "unknown"
    decision_style: str = "unknown"
    
    # Mudanças significativas
    significant_changes: List[str] = field(default_factory=list)
    
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__

@dataclass
class LearningEvent:
    """Registra um evento específico de aprendizado do sistema."""
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    category: str = "general" # routine, preference, habit, goal, work_style, learning_style, decision_style
    description: str = ""
    confidence_delta: float = 0.0 # Quanto isso aumentou ou diminuiu a confiança do sistema
    
    # Explicação do aprendizado
    why_changed: str = ""
    what_learned: str = ""
    how_improves_experience: str = ""
    
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class UserTimeline:
    """Mantém a timeline de evolução do usuário sem nunca apagar versões."""
    user_id: str
    snapshots: List[EvolutionSnapshot] = field(default_factory=list)
    learning_events: List[LearningEvent] = field(default_factory=list)
    
    def add_snapshot(self, snapshot: EvolutionSnapshot):
        self.snapshots.append(snapshot)
        
    def add_learning_event(self, event: LearningEvent):
        self.learning_events.append(event)
        
    def get_latest_snapshot(self) -> Optional[EvolutionSnapshot]:
        if not self.snapshots:
            return None
        return max(self.snapshots, key=lambda s: s.timestamp)
