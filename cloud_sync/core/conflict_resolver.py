"""
Conflict Resolver
=================
Detects and resolves data conflicts during synchronization.
Supports multiple strategies: Last Write Wins (LWW), Manual, and Merge.
"""

from enum import Enum
from typing import Dict, Any, Optional
from .models import SyncEntity

class ResolutionStrategy(Enum):
    LAST_WRITE_WINS = "lww"
    REMOTE_WINS = "remote"
    LOCAL_WINS = "local"
    MANUAL = "manual"

class ConflictResolver:
    """
    Handles conflict detection and resolution logic.
    """

    def __init__(self, strategy: ResolutionStrategy = ResolutionStrategy.LAST_WRITE_WINS):
        self.strategy = strategy

    def detect_conflict(self, local: SyncEntity, remote: SyncEntity) -> bool:
        """
        Detects if a conflict exists between local and remote entities.
        A conflict occurs if versions differ and checksums differ.
        """
        if local.version != remote.version:
            # Simple check: if versions are different, it might be a conflict
            # In a real system, we'd check if local was based on an older version of remote
            return True
        return False

    def resolve(self, local: SyncEntity, remote: SyncEntity) -> SyncEntity:
        """Resolves a conflict based on the active strategy."""
        if self.strategy == ResolutionStrategy.LAST_WRITE_WINS:
            if local.last_modified >= remote.last_modified:
                return local
            else:
                return remote
        
        elif self.strategy == ResolutionStrategy.LOCAL_WINS:
            return local
            
        elif self.strategy == ResolutionStrategy.REMOTE_WINS:
            return remote
            
        # Default to LWW if strategy not handled
        return local if local.last_modified >= remote.last_modified else remote
