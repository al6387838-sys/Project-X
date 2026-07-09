from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import uuid
from .action import Action

@dataclass
class ActionGroup:
    group_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    actions: List[Action] = field(default_factory=list)
    status: str = "pending" # pending, executing, completed, failed, cancelled
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_action(self, action: Action):
        self.actions.append(action)

    def remove_action(self, action_id: str):
        self.actions = [a for a in self.actions if a.action_id != action_id]

    def get_action(self, action_id: str) -> Optional[Action]:
        for action in self.actions:
            if action.action_id == action_id:
                return action
        return None

    def __str__(self):
        return f"Action Group ID: {self.group_id}\n" \
               f"  Name: {self.name}\n" \
               f"  Status: {self.status}\n" \
               f"  Actions: {len(self.actions)}"
