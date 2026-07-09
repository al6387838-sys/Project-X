from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum
import uuid

class EventPriority(Enum):
    CRITICAL = 0
    HIGH = 1
    MEDIUM = 2
    LOW = 3

class KernelEvent:
    def __init__(
        self,
        event_type: str,
        source: str,
        payload: Dict[str, Any],
        priority: EventPriority = EventPriority.MEDIUM,
        target: Optional[str] = None
    ):
        self.event_id = str(uuid.uuid4())
        self.timestamp = datetime.now()
        self.event_type = event_type
        self.source = source
        self.payload = payload
        self.priority = priority
        self.target = target

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type,
            "source": self.source,
            "payload": self.payload,
            "priority": self.priority.name,
            "target": self.target
        }

class EngineStatus(Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"
    ERROR = "error"
    RECOVERING = "recovering"

class KernelState:
    def __init__(self):
        self.engine_statuses: Dict[str, EngineStatus] = {}
        self.last_update: datetime = datetime.now()
        self.active_events: int = 0
        self.total_events_processed: int = 0
        self.system_load: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "engine_statuses": {k: v.value for k, v in self.engine_statuses.items()},
            "last_update": self.last_update.isoformat(),
            "active_events": self.active_events,
            "total_events_processed": self.total_events_processed,
            "system_load": self.system_load
        }
