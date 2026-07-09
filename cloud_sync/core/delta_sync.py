"""
Delta Sync Engine
=================
Implements incremental synchronization by only transmitting changes (deltas)
since the last successful sync. This minimizes bandwidth usage and
improves performance.
"""

import hashlib
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from .models import SyncEntity

class DeltaSyncEngine:
    """
    Handles calculation and application of data deltas.
    """

    @staticmethod
    def calculate_checksum(data: Dict[str, Any]) -> str:
        """Calculates a MD5 checksum for the given data dictionary."""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(data_str.encode('utf-8')).hexdigest()

    def get_delta(self, local_entity: SyncEntity, remote_entity: Optional[SyncEntity]) -> Optional[Dict[str, Any]]:
        """
        Calculates the delta between a local and remote entity.
        Returns the data if they differ, or None if they are identical.
        """
        if not remote_entity:
            return local_entity.data

        local_checksum = self.calculate_checksum(local_entity.data)
        remote_checksum = remote_entity.checksum or self.calculate_checksum(remote_entity.data)

        if local_checksum == remote_checksum:
            return None

        # Simple implementation: return full data if different
        # In a more advanced version, we could return only changed fields
        return local_entity.data

    def apply_delta(self, target_entity: SyncEntity, delta: Dict[str, Any]) -> SyncEntity:
        """Applies a delta to a target entity and updates its version."""
        target_entity.data.update(delta)
        target_entity.version += 1
        target_entity.last_modified = datetime.utcnow()
        target_entity.checksum = self.calculate_checksum(target_entity.data)
        return target_entity
