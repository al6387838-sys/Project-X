from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time
import uuid

@dataclass
class Action:
    action_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    priority: int = 0
    execution_status: str = "pending"  # pending, approved, rejected, scheduled, executing, completed, failed, rolled_back
    approval_required: bool = False
    origin_decision_id: Optional[str] = None
    expected_result: str = ""
    rollback_strategy: str = "none"  # none, automatic, manual
    
    # Campos obrigatórios para explicabilidade
    justification: str = ""
    origin: str = ""
    objective: str = ""
    
    # Campos para futuras integrações
    action_type: str = "general" # e.g., email, calendar, iot, financial
    parameters: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__

    def __str__(self):
        return f"Action ID: {self.action_id}\n" \
               f"  Status: {self.execution_status}\n" \
               f"  Priority: {self.priority}\n" \
               f"  Approval Required: {self.approval_required}\n" \
               f"  Justification: {self.justification}\n" \
               f"  Objective: {self.objective}\n" \
               f"  Expected Result: {self.expected_result}"
