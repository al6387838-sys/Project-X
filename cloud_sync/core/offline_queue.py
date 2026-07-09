"""
Offline Queue
=============
Manages a queue of operations performed while the device is offline.
Ensures that all changes are captured and ready to be synced when
the connection is restored.
"""

import uuid
from datetime import datetime
from typing import List, Optional
from .models import SyncOperation

class OfflineQueue:
    """
    A persistent (in-memory for now) queue for offline operations.
    """

    def __init__(self):
        self.queue: List[SyncOperation] = []

    def push(self, entity_id: str, entity_type: str, action: str, data: dict):
        """Adds a new operation to the offline queue."""
        op = SyncOperation(
            op_id=str(uuid.uuid4()),
            entity_id=entity_id,
            entity_type=entity_type,
            action=action,
            data=data,
            timestamp=datetime.utcnow()
        )
        self.queue.append(op)
        return op

    def pop_all(self) -> List[SyncOperation]:
        """Returns and clears all operations in the queue."""
        ops = self.queue[:]
        self.queue = []
        return ops

    def peek_all(self) -> List[SyncOperation]:
        """Returns all operations without clearing the queue."""
        return self.queue

    def clear(self):
        """Clears the queue."""
        self.queue = []

    def is_empty(self) -> bool:
        """Checks if the queue is empty."""
        return len(self.queue) == 0

    def size(self) -> int:
        """Returns the number of operations in the queue."""
        return len(self.queue)
