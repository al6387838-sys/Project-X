"""
Sync Manager
============
The central orchestrator for LifeOS Cloud Sync.
Handles the lifecycle of synchronization sessions and coordinates between
the Cloud Sync Engine, Offline Queue, and Conflict Resolver.
"""

import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from .models import SyncStatus, SyncSession, SyncEntity, SyncOperation

class SyncManager:
    """
    Manages synchronization sessions and ensures data consistency
    across devices.
    """

    def __init__(self, device_id: str):
        self.device_id = device_id
        self.active_session: Optional[SyncSession] = None
        self.history: List[SyncSession] = []
        self.logger = logging.getLogger("SyncManager")

    def start_session(self) -> SyncSession:
        """Starts a new synchronization session."""
        session_id = str(uuid.uuid4())
        self.active_session = SyncSession(
            session_id=session_id,
            device_id=self.device_id
        )
        self.active_session.status = SyncStatus.SYNCING
        self.logger.info(f"Started sync session {session_id} for device {self.device_id}")
        return self.active_session

    def complete_session(self, status: SyncStatus = SyncStatus.COMPLETED, error: str = None):
        """Finalizes the active synchronization session."""
        if not self.active_session:
            return

        self.active_session.end_time = datetime.utcnow()
        self.active_session.status = status
        self.active_session.error_message = error
        
        self.history.append(self.active_session)
        self.logger.info(f"Completed sync session {self.active_session.session_id} with status {status.value}")
        self.active_session = None

    def get_sync_summary(self) -> Dict[str, Any]:
        """Returns a summary of the synchronization history."""
        return {
            "device_id": self.device_id,
            "total_sessions": len(self.history),
            "last_sync": self.history[-1].end_time if self.history else None,
            "status": self.history[-1].status.value if self.history else "none"
        }
