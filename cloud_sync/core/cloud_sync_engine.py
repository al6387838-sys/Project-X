"""
Cloud Sync Engine
=================
The main engine that performs the actual synchronization process.
Integrates Delta Sync, Encryption, and Conflict Resolution.
"""

from typing import Dict, List, Any, Optional
from .models import SyncEntity, SyncStatus
from .delta_sync import DeltaSyncEngine
from .conflict_resolver import ConflictResolver
from ..encryption.e2ee_engine import E2EEEngine

class CloudSyncEngine:
    """
    Orchestrates the sync process between local and remote data.
    """

    def __init__(self, secret_key: str):
        self.delta_engine = DeltaSyncEngine()
        self.resolver = ConflictResolver()
        self.encryption = E2EEEngine(secret_key)
        self.remote_storage: Dict[str, str] = {}  # Simulated remote storage (encrypted)

    def sync_entity(self, local_entity: SyncEntity) -> SyncEntity:
        """
        Syncs a single entity with the remote storage.
        1. Fetch remote (encrypted)
        2. Decrypt
        3. Detect conflict
        4. Resolve conflict
        5. Calculate delta
        6. Encrypt and push
        """
        entity_id = local_entity.entity_id
        encrypted_remote = self.remote_storage.get(entity_id)
        
        if not encrypted_remote:
            # First time sync for this entity
            self.remote_storage[entity_id] = self.encryption.encrypt(local_entity.data)
            return local_entity

        # Existing remote entity
        remote_data = self.encryption.decrypt(encrypted_remote)
        remote_entity = SyncEntity(
            entity_id=entity_id,
            entity_type=local_entity.entity_type,
            version=local_entity.version, # In a real system, remote would track version
            data=remote_data
        )

        if self.resolver.detect_conflict(local_entity, remote_entity):
            resolved = self.resolver.resolve(local_entity, remote_entity)
            # Push resolved back to remote
            self.remote_storage[entity_id] = self.encryption.encrypt(resolved.data)
            return resolved

        # No conflict, check for deltas
        delta = self.delta_engine.get_delta(local_entity, remote_entity)
        if delta:
            # Push local to remote
            self.remote_storage[entity_id] = self.encryption.encrypt(local_entity.data)
        
        return local_entity

    def get_remote_state(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Returns the decrypted remote state of an entity."""
        encrypted = self.remote_storage.get(entity_id)
        if encrypted:
            return self.encryption.decrypt(encrypted)
        return None
