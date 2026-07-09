"""
Cloud Sync Models
=================
Data structures for the LifeOS Cloud Sync system.
"""

from enum import Enum
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

class SyncStatus(Enum):
    PENDING = "pending"
    SYNCING = "syncing"
    COMPLETED = "completed"
    FAILED = "failed"
    CONFLICT = "conflict"

class SyncDirection(Enum):
    PUSH = "push"
    PULL = "pull"
    TWO_WAY = "two_way"

@dataclass
class SyncEntity:
    """Represents an entity to be synchronized (Life Graph, Timeline, etc.)"""
    entity_id: str
    entity_type: str
    version: int
    data: Dict[str, Any]
    last_modified: datetime = field(default_factory=datetime.utcnow)
    checksum: Optional[str] = None
    is_deleted: bool = False

@dataclass
class SyncSession:
    """Represents a synchronization session."""
    session_id: str
    device_id: str
    start_time: datetime = field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    status: SyncStatus = SyncStatus.PENDING
    entities_synced: List[str] = field(default_factory=list)
    conflicts_found: List[Dict[str, Any]] = field(default_factory=list)
    error_message: Optional[str] = None

@dataclass
class SyncOperation:
    """Represents a single synchronization operation in the queue."""
    op_id: str
    entity_id: str
    entity_type: str
    action: str  # 'create', 'update', 'delete'
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.utcnow)
    retry_count: int = 0
    max_retries: int = 3
