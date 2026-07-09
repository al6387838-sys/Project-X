from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time
import uuid

@dataclass
class Decision:
    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    confidence_score: float = 0.0
    reasoning: List[str] = field(default_factory=list)
    priority: int = 0
    affected_context: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    alternative_decisions: List[str] = field(default_factory=list)
    
    # Extra fields for tracking and explanations
    action_type: str = "general"
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def explain(self) -> str:
        """Retorna uma explicação compreensível do raciocínio da decisão."""
        if not self.reasoning:
            return "Nenhum raciocínio fornecido."
        return "\n".join([f"- {r}" for r in self.reasoning])
