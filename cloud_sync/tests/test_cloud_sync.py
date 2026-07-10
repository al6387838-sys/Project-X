"""
Cloud Sync — Automated Tests
============================
PROJECT-X | Phase 3 | Sprint 023
"""

import pytest
from datetime import datetime, timedelta, timezone
from cloud_sync.core.models import SyncEntity, SyncStatus
from cloud_sync.core.conflict_resolver import ResolutionStrategy
from cloud_sync.core.sync_manager import SyncManager
from cloud_sync.core.offline_queue import OfflineQueue
from cloud_sync.core.delta_sync import DeltaSyncEngine
from cloud_sync.core.conflict_resolver import ConflictResolver
from cloud_sync.core.cloud_sync_engine import CloudSyncEngine
from cloud_sync.encryption.e2ee_engine import E2EEEngine

def test_sync_manager_session_lifecycle():
    manager = SyncManager(device_id="device_001")
    session = manager.start_session()
    
    assert session.status == SyncStatus.SYNCING
    assert manager.active_session == session
    
    manager.complete_session()
    assert manager.active_session is None
    assert len(manager.history) == 1
    assert manager.history[0].status == SyncStatus.COMPLETED

def test_offline_queue():
    queue = OfflineQueue()
    queue.push("entity_1", "life_graph", "update", {"key": "value"})
    
    assert queue.size() == 1
    assert not queue.is_empty()
    
    ops = queue.pop_all()
    assert len(ops) == 1
    assert queue.is_empty()

def test_e2ee_encryption():
    engine = E2EEEngine(secret_key="my_secret")
    data = {"secret": "data"}
    
    encrypted = engine.encrypt(data)
    assert encrypted.startswith("E2EE:my_secret:")
    
    decrypted = engine.decrypt(encrypted)
    assert decrypted == data

def test_conflict_resolution_lww():
    resolver = ConflictResolver(strategy=ResolutionStrategy.LAST_WRITE_WINS)
    
    now = datetime.now(timezone.utc)
    older = now - timedelta(minutes=10)
    
    local = SyncEntity("1", "type", 1, {"v": "local"}, last_modified=now)
    remote = SyncEntity("1", "type", 1, {"v": "remote"}, last_modified=older)
    
    resolved = resolver.resolve(local, remote)
    assert resolved.data["v"] == "local"

def test_cloud_sync_full_flow():
    engine = CloudSyncEngine(secret_key="user_key")
    
    local_data = {"score": 100}
    entity = SyncEntity("graph_1", "life_graph", 1, local_data)
    
    # First sync (Push to remote)
    synced = engine.sync_entity(entity)
    assert synced.data == local_data
    
    # Verify remote state
    remote_state = engine.get_remote_state("graph_1")
    assert remote_state == local_data

def test_delta_sync_checksum():
    delta_engine = DeltaSyncEngine()
    data = {"a": 1, "b": 2}
    checksum1 = delta_engine.calculate_checksum(data)
    checksum2 = delta_engine.calculate_checksum({"b": 2, "a": 1})
    
    assert checksum1 == checksum2
