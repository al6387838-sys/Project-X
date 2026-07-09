from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import uuid
import time

@dataclass
class TimelineEntry:
    timeline_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    title: str = ""
    description: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    category: str = "general" # projects, goals, achievements, failures, changes, people, locations, events, habits, learnings, decisions
    impact_score: int = 0 # 0 to 100
    relationships: List[str] = field(default_factory=list) # IDs of related entries
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__

    def __str__(self):
        return f"[{self.category.upper()}] {self.title} ({self.timeline_id})"
