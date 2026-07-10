"""
BETA-003: Offline First Architecture
LifeOS Mobile Ecosystem — Program Beta

Architecture: Local-First with CRDTs and conflict resolution
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable
from enum import Enum
from datetime import datetime
import json
import hashlib
import uuid


class SyncStatus(Enum):
    SYNCED     = "synced"
    PENDING    = "pending"
    CONFLICT   = "conflict"
    OFFLINE    = "offline"
    SYNCING    = "syncing"


class StorageLayer(Enum):
    MEMORY     = "memory"     # Hot: in-memory cache
    LOCAL_DB   = "local_db"   # Warm: SQLite/IndexedDB
    REMOTE     = "remote"     # Cold: cloud storage


@dataclass
class OfflineRecord:
    """A record that can exist offline and sync later."""
    id:           str
    entity_type:  str
    data:         Dict[str, Any]
    version:      int
    lamport_clock: int
    device_id:    str
    created_at:   datetime
    updated_at:   datetime
    sync_status:  SyncStatus = SyncStatus.PENDING
    checksum:     str = ""
    vector_clock: Dict[str, int] = field(default_factory=dict)

    def __post_init__(self):
        self.checksum = self._compute_checksum()

    def _compute_checksum(self) -> str:
        payload = json.dumps(self.data, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "entity_type": self.entity_type,
            "data": self.data,
            "version": self.version,
            "lamport_clock": self.lamport_clock,
            "device_id": self.device_id,
            "sync_status": self.sync_status.value,
            "checksum": self.checksum,
            "vector_clock": self.vector_clock,
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class ConflictResolution:
    """Result of a conflict resolution."""
    record_id:   str
    winner:      OfflineRecord
    loser:       OfflineRecord
    strategy:    str
    resolved_at: datetime = field(default_factory=datetime.now)
    merged_data: Optional[Dict] = None


class ConflictResolver:
    """
    CRDT-based conflict resolution strategies.
    Implements Last-Write-Wins (LWW) and custom merge strategies.
    """

    def resolve(self, local: OfflineRecord, remote: OfflineRecord) -> ConflictResolution:
        """Resolve conflict between local and remote versions."""

        # Strategy 1: Vector clock comparison
        if self._vector_clock_dominates(local.vector_clock, remote.vector_clock):
            return ConflictResolution(
                record_id=local.id,
                winner=local,
                loser=remote,
                strategy="vector_clock_local_wins"
            )

        if self._vector_clock_dominates(remote.vector_clock, local.vector_clock):
            return ConflictResolution(
                record_id=local.id,
                winner=remote,
                loser=local,
                strategy="vector_clock_remote_wins"
            )

        # Strategy 2: Lamport clock (LWW)
        if local.lamport_clock > remote.lamport_clock:
            return ConflictResolution(
                record_id=local.id,
                winner=local,
                loser=remote,
                strategy="lamport_lww_local"
            )

        if remote.lamport_clock > local.lamport_clock:
            return ConflictResolution(
                record_id=local.id,
                winner=remote,
                loser=local,
                strategy="lamport_lww_remote"
            )

        # Strategy 3: Semantic merge for specific entity types
        merged = self._semantic_merge(local, remote)
        return ConflictResolution(
            record_id=local.id,
            winner=local,
            loser=remote,
            strategy="semantic_merge",
            merged_data=merged
        )

    def _vector_clock_dominates(self, a: Dict[str, int], b: Dict[str, int]) -> bool:
        """Returns True if vector clock A dominates B."""
        all_keys = set(a.keys()) | set(b.keys())
        a_ge_b = all(a.get(k, 0) >= b.get(k, 0) for k in all_keys)
        a_gt_b = any(a.get(k, 0) > b.get(k, 0) for k in all_keys)
        return a_ge_b and a_gt_b

    def _semantic_merge(self, local: OfflineRecord, remote: OfflineRecord) -> Dict:
        """Merge records semantically based on entity type."""
        merged = dict(remote.data)

        if local.entity_type == "habit":
            # For habits: take max streak, merge completion dates
            merged["streak"] = max(
                local.data.get("streak", 0),
                remote.data.get("streak", 0)
            )
            local_dates = set(local.data.get("completion_dates", []))
            remote_dates = set(remote.data.get("completion_dates", []))
            merged["completion_dates"] = sorted(local_dates | remote_dates)

        elif local.entity_type == "memory_node":
            # For memory: merge connections, take highest strength
            merged["strength"] = max(
                local.data.get("strength", 0),
                remote.data.get("strength", 0)
            )
            local_connections = set(local.data.get("connections", []))
            remote_connections = set(remote.data.get("connections", []))
            merged["connections"] = list(local_connections | remote_connections)

        elif local.entity_type == "task":
            # For tasks: if either marks as done, it's done
            if local.data.get("done") or remote.data.get("done"):
                merged["done"] = True

        return merged


class OfflineStore:
    """
    Local-first data store with offline support.
    Implements a three-tier storage architecture.
    """

    def __init__(self, device_id: str):
        self.device_id = device_id
        self._memory_cache:  Dict[str, OfflineRecord] = {}
        self._pending_sync:  List[OfflineRecord] = []
        self._conflict_log:  List[ConflictResolution] = []
        self._lamport_clock: int = 0
        self._vector_clock:  Dict[str, int] = {device_id: 0}
        self._resolver = ConflictResolver()
        self._is_online: bool = False
        self._sync_callbacks: List[Callable] = []

    # ── WRITE ──────────────────────────────────────────────

    def write(self, entity_type: str, data: Dict, record_id: Optional[str] = None) -> OfflineRecord:
        """Write a record. Works offline — queues for sync."""
        self._lamport_clock += 1
        self._vector_clock[self.device_id] = self._lamport_clock

        record = OfflineRecord(
            id=record_id or str(uuid.uuid4()),
            entity_type=entity_type,
            data=data,
            version=1,
            lamport_clock=self._lamport_clock,
            device_id=self.device_id,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            sync_status=SyncStatus.SYNCED if self._is_online else SyncStatus.PENDING,
            vector_clock=dict(self._vector_clock),
        )

        self._memory_cache[record.id] = record

        if not self._is_online:
            self._pending_sync.append(record)

        return record

    def update(self, record_id: str, data: Dict) -> Optional[OfflineRecord]:
        """Update an existing record."""
        existing = self._memory_cache.get(record_id)
        if not existing:
            return None

        self._lamport_clock += 1
        self._vector_clock[self.device_id] = self._lamport_clock

        existing.data.update(data)
        existing.version += 1
        existing.lamport_clock = self._lamport_clock
        existing.updated_at = datetime.now()
        existing.sync_status = SyncStatus.SYNCED if self._is_online else SyncStatus.PENDING
        existing.vector_clock = dict(self._vector_clock)
        existing.checksum = existing._compute_checksum()

        if not self._is_online:
            self._pending_sync.append(existing)

        return existing

    # ── READ ───────────────────────────────────────────────

    def read(self, record_id: str) -> Optional[OfflineRecord]:
        """Read from memory cache (always available offline)."""
        return self._memory_cache.get(record_id)

    def query(self, entity_type: str, filters: Optional[Dict] = None) -> List[OfflineRecord]:
        """Query records by entity type and optional filters."""
        results = [r for r in self._memory_cache.values() if r.entity_type == entity_type]
        if filters:
            for key, value in filters.items():
                results = [r for r in results if r.data.get(key) == value]
        return sorted(results, key=lambda r: r.updated_at, reverse=True)

    # ── SYNC ───────────────────────────────────────────────

    def go_online(self) -> Dict:
        """Called when network becomes available."""
        self._is_online = True
        pending_count = len(self._pending_sync)
        return {
            "status": "online",
            "pending_records": pending_count,
            "ready_to_sync": True,
        }

    def go_offline(self) -> Dict:
        """Called when network is lost."""
        self._is_online = False
        return {
            "status": "offline",
            "cached_records": len(self._memory_cache),
            "message": "Operating in offline mode. Changes will sync when reconnected.",
        }

    def sync(self, remote_records: List[Dict]) -> Dict:
        """Sync pending records with remote. Returns sync result."""
        synced = 0
        conflicts = 0
        errors = 0

        for remote_dict in remote_records:
            try:
                remote = OfflineRecord(
                    id=remote_dict["id"],
                    entity_type=remote_dict["entity_type"],
                    data=remote_dict["data"],
                    version=remote_dict["version"],
                    lamport_clock=remote_dict["lamport_clock"],
                    device_id=remote_dict["device_id"],
                    created_at=datetime.now(),
                    updated_at=datetime.fromisoformat(remote_dict["updated_at"]),
                    sync_status=SyncStatus.SYNCED,
                    vector_clock=remote_dict.get("vector_clock", {}),
                )

                local = self._memory_cache.get(remote.id)

                if local is None:
                    # New record from remote
                    self._memory_cache[remote.id] = remote
                    synced += 1

                elif local.checksum == remote.checksum:
                    # No conflict
                    local.sync_status = SyncStatus.SYNCED
                    synced += 1

                else:
                    # Conflict detected
                    resolution = self._resolver.resolve(local, remote)
                    self._conflict_log.append(resolution)

                    winner = resolution.winner
                    if resolution.merged_data:
                        winner.data = resolution.merged_data

                    self._memory_cache[winner.id] = winner
                    winner.sync_status = SyncStatus.SYNCED
                    conflicts += 1

            except Exception:
                errors += 1

        # Clear synced pending records
        self._pending_sync = [r for r in self._pending_sync if r.sync_status == SyncStatus.PENDING]

        return {
            "synced": synced,
            "conflicts_resolved": conflicts,
            "errors": errors,
            "pending_remaining": len(self._pending_sync),
            "total_cached": len(self._memory_cache),
        }

    def get_status(self) -> Dict:
        """Get current offline/sync status."""
        return {
            "device_id": self.device_id,
            "is_online": self._is_online,
            "cached_records": len(self._memory_cache),
            "pending_sync": len(self._pending_sync),
            "conflicts_resolved": len(self._conflict_log),
            "lamport_clock": self._lamport_clock,
            "vector_clock": self._vector_clock,
        }


# ── DEMO ───────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("BETA-003: Offline First Architecture — Demo")
    print("=" * 60)

    store = OfflineStore(device_id="iphone-15-pro-alex")

    # Simulate offline operation
    offline_status = store.go_offline()
    print(f"\n[OFFLINE] {offline_status['message']}")

    # Write while offline
    habit = store.write("habit", {
        "name": "Exercício Físico",
        "streak": 12,
        "completion_dates": ["2026-07-08", "2026-07-09", "2026-07-10"],
        "target_per_week": 4,
    })
    print(f"[WRITE] Habit created offline: {habit.id[:8]}... | status: {habit.sync_status.value}")

    memory = store.write("memory_node", {
        "content": "PROJECT-X — Lançamento 30/09/2026",
        "strength": 92,
        "type": "long_term",
        "connections": ["goal-001", "project-001"],
    })
    print(f"[WRITE] Memory node created offline: {memory.id[:8]}... | status: {memory.sync_status.value}")

    task = store.write("task", {
        "title": "Decisão: Arquitetura Mobile",
        "priority": "high",
        "done": False,
        "due": "2026-07-10T17:00:00",
    })
    print(f"[WRITE] Task created offline: {task.id[:8]}... | status: {task.sync_status.value}")

    status = store.get_status()
    print(f"\n[STATUS] Cached: {status['cached_records']} | Pending: {status['pending_sync']}")

    # Go online and sync
    online_status = store.go_online()
    print(f"\n[ONLINE] Pending records to sync: {online_status['pending_records']}")

    # Simulate remote records (with a conflict on the habit)
    remote_records = [
        {
            "id": habit.id,
            "entity_type": "habit",
            "data": {
                "name": "Exercício Físico",
                "streak": 11,  # Conflict: remote has lower streak
                "completion_dates": ["2026-07-08", "2026-07-09"],
                "target_per_week": 4,
            },
            "version": 2,
            "lamport_clock": habit.lamport_clock - 1,
            "device_id": "server",
            "updated_at": datetime.now().isoformat(),
            "vector_clock": {"server": 5},
        }
    ]

    sync_result = store.sync(remote_records)
    print(f"\n[SYNC] Synced: {sync_result['synced']} | Conflicts resolved: {sync_result['conflicts_resolved']}")
    print(f"[SYNC] Pending remaining: {sync_result['pending_remaining']}")

    # Verify conflict resolution (local habit with streak=12 should win)
    resolved_habit = store.read(habit.id)
    print(f"\n[CONFLICT RESOLVED] Habit streak after merge: {resolved_habit.data['streak']} (expected: 12)")
    print(f"[CONFLICT RESOLVED] Completion dates merged: {len(resolved_habit.data['completion_dates'])} dates")

    final_status = store.get_status()
    print(f"\n[FINAL STATUS]")
    print(f"  Online: {final_status['is_online']}")
    print(f"  Cached: {final_status['cached_records']}")
    print(f"  Pending: {final_status['pending_sync']}")
    print(f"  Conflicts resolved: {final_status['conflicts_resolved']}")
    print(f"  Lamport clock: {final_status['lamport_clock']}")
    print("\n✅ BETA-003: Offline First Architecture — COMPLETE")
