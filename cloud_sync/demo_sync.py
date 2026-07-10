"""
LifeOS Cloud Sync — Live Demo
=============================
PROJECT-X | Phase 3 | Sprint 023

Demonstrates a complete synchronization flow between two devices:
  1. Device A (Mobile) creates data while offline.
  2. Device A goes online and syncs with Cloud (E2EE).
  3. Device B (Desktop) pulls the data from Cloud.
  4. Device B modifies the same data (Conflict Scenario).
  5. Conflict is detected and resolved via LWW (Last Write Wins).
"""

import time
from datetime import datetime, timedelta, timezone
from cloud_sync import CloudSyncEngine, SyncManager, OfflineQueue, SyncEntity, SyncStatus, ResolutionStrategy

def run_demo():
    print("\n" + "█"*60)
    print("  PROJECT-X | PHASE 3 | SPRINT 023")
    print("  LIFEOS CLOUD SYNC — LIVE DEMO")
    print("█"*60)

    # Configuration
    USER_SECRET = "user_private_encryption_key_123"
    cloud_engine = CloudSyncEngine(secret_key=USER_SECRET)

    # ---------------------------------------------------------
    # STEP 1: DEVICE A (MOBILE) — OFFLINE MODE
    # ---------------------------------------------------------
    print("\n[STEP 1] Device A (Mobile) is OFFLINE")
    manager_a = SyncManager(device_id="MOBILE_A")
    queue_a = OfflineQueue()

    # User creates a new Mission while offline
    mission_data = {"title": "Sprint 023 Delivery", "status": "in_progress", "priority": "high"}
    print(f"  > User creates mission: {mission_data['title']}")
    queue_a.push("mission_001", "mission", "create", mission_data)
    print(f"  > Offline Queue size: {queue_a.size()}")

    # ---------------------------------------------------------
    # STEP 2: DEVICE A GOES ONLINE AND SYNCS
    # ---------------------------------------------------------
    print("\n[STEP 2] Device A goes ONLINE and synchronizes")
    session_a = manager_a.start_session()
    
    # Process offline queue
    ops = queue_a.pop_all()
    for op in ops:
        entity = SyncEntity(op.entity_id, op.entity_type, 1, op.data)
        synced_entity = cloud_engine.sync_entity(entity)
        session_a.entities_synced.append(synced_entity.entity_id)
        print(f"  > Synced {op.entity_id} to Cloud (Encrypted with E2EE)")

    manager_a.complete_session()
    print(f"  > Sync Session A status: {session_a.status.value}")

    # ---------------------------------------------------------
    # STEP 3: DEVICE B (DESKTOP) PULLS DATA
    # ---------------------------------------------------------
    print("\n[STEP 3] Device B (Desktop) synchronizes and pulls data")
    manager_b = SyncManager(device_id="DESKTOP_B")
    session_b = manager_b.start_session()

    # Pull mission from cloud
    remote_data = cloud_engine.get_remote_state("mission_001")
    if remote_data:
        print(f"  > Pulled mission from Cloud: {remote_data['title']}")
        print(f"  > Status: {remote_data['status']}")
    
    manager_b.complete_session()

    # ---------------------------------------------------------
    # STEP 4: CONFLICT SCENARIO (DEVICE A vs DEVICE B)
    # ---------------------------------------------------------
    print("\n[STEP 4] Conflict Scenario: Simultaneous updates")
    
    # Device B updates mission status to 'completed'
    print("  > Device B updates mission to 'completed'")
    data_b = remote_data.copy()
    data_b["status"] = "completed"
    entity_b = SyncEntity("mission_001", "mission", 1, data_b, last_modified=datetime.now(timezone.utc))
    
    # Device A (meanwhile) updates title to 'Sprint 023 COMPLETED'
    print("  > Device A updates mission title to 'Sprint 023 COMPLETED'")
    data_a = mission_data.copy()
    data_a["title"] = "Sprint 023 COMPLETED"
    # Set Device A timestamp slightly earlier than Device B for LWW demo
    entity_a = SyncEntity("mission_001", "mission", 1, data_a, last_modified=datetime.now(timezone.utc) - timedelta(seconds=5))

    # Sync Device A first
    print("\n  > Syncing Device A...")
    cloud_engine.sync_entity(entity_a)
    
    # Sync Device B (Conflict occurs)
    print("  > Syncing Device B (Conflict detected)...")
    resolved_entity = cloud_engine.sync_entity(entity_b)
    
    print(f"\n[RESULT] Conflict resolved via LWW (Last Write Wins)")
    print(f"  > Final Mission Title: {resolved_entity.data['title']}")
    print(f"  > Final Mission Status: {resolved_entity.data['status']}")
    print(f"  > (Device B's update won because it was newer)")

    print("\n" + "█"*60)
    print("  SPRINT 023 — LIFEOS CLOUD SYNC COMPLETED ✓")
    print("█"*60 + "\n")

if __name__ == "__main__":
    run_demo()
