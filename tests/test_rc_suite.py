"""
LifeOS V1.0 RC — Advanced Test Suite
=====================================
Sprint 030 — Release Candidate Validation

Tests:
  - Stress Tests
  - Security Tests
  - Recovery Tests
  - Performance Tests
  - Offline Tests
"""
import time
import uuid
import threading
import statistics
from datetime import datetime, timezone, timedelta
from typing import List


# ─────────────────────────────────────────────
# STRESS TESTS
# ─────────────────────────────────────────────

class TestStress:
    """High-volume and concurrency stress tests."""

    def test_decision_engine_bulk_processing(self):
        """Decision Engine must handle 100 batches without degradation."""
        from decision_engine.engines.decision_engine import DecisionEngine
        from decision_engine.models.context import ContextInput

        engine = DecisionEngine()
        ctx = ContextInput(
            life_graph_data={
                "active_goals": [
                    {"name": f"Goal {i}", "domain": "productivity", "progress": 0.5, "confidence": 0.8}
                    for i in range(10)
                ]
            },
            context_engine_data={
                "recent_events": [
                    {"title": f"Event {i}", "category": "work", "impact": 0.7}
                    for i in range(10)
                ]
            },
            memory_engine_data={
                "patterns": [
                    {"name": f"Pattern {i}", "domain": "health", "strength": 0.6, "occurrences": 20}
                    for i in range(5)
                ]
            },
        )

        start = time.perf_counter()
        results = []
        for _ in range(100):
            decisions = engine.process(ctx)
            results.append(len(decisions))
        elapsed = time.perf_counter() - start

        assert all(r > 0 for r in results), "All batches must produce decisions"
        assert elapsed < 10.0, f"100 batches took {elapsed:.2f}s — too slow (limit: 10s)"

    def test_cloud_sync_bulk_operations(self):
        """Cloud sync offline queue must handle 500 operations."""
        from cloud_sync.core.offline_queue import OfflineQueue

        queue = OfflineQueue()
        for i in range(500):
            queue.push(f"entity_{i}", "life_graph", "update", {"value": i})

        assert queue.size() == 500, "Queue must hold 500 operations"

    def test_concurrent_decision_processing(self):
        """Decision Engine must be safe under concurrent access."""
        from decision_engine.engines.decision_engine import DecisionEngine
        from decision_engine.models.context import ContextInput

        results = []
        errors = []

        def worker():
            try:
                engine = DecisionEngine()
                ctx = ContextInput(
                    life_graph_data={"active_goals": [{"name": "Goal", "domain": "work", "progress": 0.5, "confidence": 0.7}]},
                    context_engine_data={},
                    memory_engine_data={},
                )
                decisions = engine.process(ctx)
                results.append(len(decisions))
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=worker) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Concurrent errors: {errors}"
        assert len(results) == 20, "All threads must complete"

    def test_priority_engine_large_batch(self):
        """Priority Engine must rank 500 decisions correctly."""
        from decision_engine.engines.priority_engine import PriorityEngine
        from decision_engine.models.decision import Decision

        engine = PriorityEngine()
        decisions = []
        for i in range(500):
            d = Decision(confidence_score=i / 500)
            engine.calculate_priority(d, urgency=i / 500, impact=i / 500)
            decisions.append(d)

        ranked = engine.rank_decisions(decisions)
        assert ranked[0].priority >= ranked[-1].priority, "Must be sorted descending"

    def test_learning_engine_bulk_feedback(self):
        """Learning Engine FeedbackEngine must process 100 feedback items."""
        from learning_engine.engines.feedback_engine import FeedbackEngine

        engine = FeedbackEngine()
        for i in range(100):
            engine.record_positive(
                pattern_key=f"pattern_{i}",
                domain="productivity",
                context={"decision_id": f"d-{i}"}
            )

        summary = engine.get_feedback_summary()
        assert summary is not None, "Feedback summary must be available"


# ─────────────────────────────────────────────
# SECURITY TESTS
# ─────────────────────────────────────────────

class TestSecurity:
    """Security validation tests."""

    def test_encryption_roundtrip(self):
        """Data encrypted must be decryptable and match original."""
        from security_center.encryption.encryption_manager import EncryptionManager

        manager = EncryptionManager()
        original = {"sensitive": "LifeOS user data", "value": 42}
        encrypted = manager.encrypt_at_rest(original)
        decrypted = manager.decrypt_at_rest(encrypted)

        assert encrypted != str(original), "Encrypted data must differ from original"
        assert decrypted == original, "Decrypted data must match original"

    def test_passkey_registration_and_auth(self):
        """Passkey registration and authentication must succeed."""
        from security_center.identity.passkey_manager import PasskeyManager

        pm = PasskeyManager()
        user_id = f"user_{uuid.uuid4().hex[:8]}"
        cred = pm.register_passkey(user_id, "Test Device")

        assert "credential_id" in cred
        assert cred["device_name"] == "Test Device"

        auth_result = pm.authenticate(user_id, cred["credential_id"])
        assert auth_result is True, "Authentication must succeed with valid credential"

    def test_threat_monitor_detects_anomaly(self):
        """Threat monitor must flag suspicious login patterns."""
        from security_center.monitor.threat_monitor import ThreatMonitor

        monitor = ThreatMonitor()
        user_id = f"user_{uuid.uuid4().hex[:8]}"

        # Simulate brute force via failed_attempts metadata
        alert = monitor.analyze_event("login", user_id, {
            "location": "Unknown",
            "failed_attempts": 5
        })

        assert alert is not None, "Must detect brute force attack"
        assert alert["type"] == "BRUTE_FORCE_ATTEMPT"

    def test_audit_log_integrity(self):
        """Audit log must record all events with timestamps."""
        from security_center.audit.audit_manager import AuditManager

        manager = AuditManager()
        user_id = f"user_{uuid.uuid4().hex[:8]}"

        manager.log_access(user_id, "life_graph", "read", "success", {"resource": "goals"})
        manager.log_access(user_id, "life_graph", "write", "success", {"resource": "events"})

        logs = manager.get_user_security_timeline(user_id)
        assert len(logs) >= 2, "Must have at least 2 audit entries"
        assert all("timestamp" in log for log in logs), "All logs must have timestamps"

    def test_session_lifecycle(self):
        """Sessions must be created and validated correctly."""
        from security_center.core.session_manager import SessionManager

        manager = SessionManager()
        user_id = f"user_{uuid.uuid4().hex[:8]}"
        token = manager.create_session(user_id, "device_001")

        assert isinstance(token, str), "Session token must be a string"
        assert manager.validate_session(token) is True, "New session must be valid"

        manager.revoke_session(token)
        assert manager.validate_session(token) is False, "Revoked session must be invalid"

    def test_no_plaintext_secrets_in_models(self):
        """Model fields must not expose raw secrets."""
        from security_center.identity.passkey_manager import PasskeyManager

        pm = PasskeyManager()
        cred = pm.register_passkey("user_test", "Device")

        # Public key should be a placeholder/encoded value, not a raw private key
        assert "PRIVATE" not in str(cred.get("public_key", "")).upper()

    def test_key_rotation(self):
        """Encryption key rotation must work without data loss."""
        from security_center.encryption.encryption_manager import EncryptionManager

        manager = EncryptionManager()
        original = {"data": "important user data"}
        encrypted = manager.encrypt_at_rest(original)

        new_key_id = manager.rotate_key()
        assert new_key_id is not None, "Key rotation must return new key ID"

        # Data encrypted before rotation must still be decryptable
        decrypted = manager.decrypt_at_rest(encrypted)
        assert decrypted == original, "Data must survive key rotation"


# ─────────────────────────────────────────────
# RECOVERY TESTS
# ─────────────────────────────────────────────

class TestRecovery:
    """System recovery and resilience tests."""

    def test_decision_engine_empty_context_fallback(self):
        """Decision Engine must return fallback decisions on empty context."""
        from decision_engine.engines.decision_engine import DecisionEngine
        from decision_engine.models.context import ContextInput

        engine = DecisionEngine()
        ctx = ContextInput()
        decisions = engine.process(ctx)

        assert isinstance(decisions, list), "Must return a list even on empty context"
        assert len(decisions) > 0, "Must return at least one fallback decision"

    def test_cloud_sync_offline_queue_recovery(self):
        """Offline queue must allow replay of pending operations."""
        from cloud_sync.core.offline_queue import OfflineQueue

        queue = OfflineQueue()
        queue.push("entity_1", "life_graph", "update", {"key": "value"})
        queue.push("entity_2", "life_graph", "create", {"key": "new"})

        pending = queue.peek_all()
        assert len(pending) >= 2, "Must have pending operations"

        # Simulate replay by popping all
        replayed = queue.pop_all()
        assert len(replayed) >= 2, "Must replay all operations"
        assert queue.is_empty(), "Queue must be empty after replay"

    def test_sync_manager_session_recovery(self):
        """Sync manager must recover from failed session."""
        from cloud_sync.core.sync_manager import SyncManager, SyncStatus

        manager = SyncManager(device_id="device_recovery_test")
        session = manager.start_session()
        assert session.status == SyncStatus.SYNCING

        manager.complete_session(status=SyncStatus.FAILED, error="Network timeout")
        assert manager.active_session is None

        # Should be able to start a new session
        new_session = manager.start_session()
        assert new_session.status == SyncStatus.SYNCING
        manager.complete_session()

    def test_conflict_resolver_recovery(self):
        """Conflict resolver must handle all resolution strategies."""
        from cloud_sync.core.conflict_resolver import ConflictResolver, ResolutionStrategy
        from cloud_sync.core.models import SyncEntity

        for strategy in [ResolutionStrategy.LAST_WRITE_WINS, ResolutionStrategy.LOCAL_WINS, ResolutionStrategy.REMOTE_WINS]:
            resolver = ConflictResolver(strategy=strategy)
            now = datetime.now(timezone.utc)
            local = SyncEntity("1", "type", 1, {"v": "local"}, last_modified=now)
            remote = SyncEntity("1", "type", 1, {"v": "remote"}, last_modified=now - timedelta(minutes=5))
            result = resolver.resolve(local, remote)
            assert result is not None, f"Strategy {strategy} must return a resolved entity"

    def test_action_engine_rollback(self):
        """Action Engine must rollback completed actions."""
        from action_engine.managers.rollback_manager import RollbackManager
        from action_engine.models.action import Action

        manager = RollbackManager()
        action = Action(
            rollback_strategy="automatic",
            execution_status="completed",
            justification="Test rollback",
            objective="Validate rollback mechanism"
        )

        can_rollback = manager.can_rollback(action)
        assert can_rollback is True, "Completed action with rollback_strategy must be rollbackable"

        result = manager.perform_rollback(action)
        assert result is True, "Rollback must succeed"
        assert action.execution_status == "rolled_back"

        history = manager.get_rollback_history()
        assert len(history) >= 1, "Rollback history must be recorded"


# ─────────────────────────────────────────────
# PERFORMANCE TESTS
# ─────────────────────────────────────────────

class TestPerformance:
    """Performance benchmarks for critical paths."""

    def test_decision_engine_latency(self):
        """Single decision cycle must complete in < 50ms average."""
        from decision_engine.engines.decision_engine import DecisionEngine
        from decision_engine.models.context import ContextInput

        engine = DecisionEngine()
        ctx = ContextInput(
            life_graph_data={"active_goals": [{"name": "Goal", "domain": "work", "progress": 0.5, "confidence": 0.8}]},
            context_engine_data={"recent_events": [{"title": "Event", "category": "work", "impact": 0.7}]},
            memory_engine_data={"patterns": [{"name": "Pattern", "domain": "health", "strength": 0.6, "occurrences": 10}]},
        )

        # Warm up
        engine.process(ctx)

        # Measure
        timings = []
        for _ in range(50):
            start = time.perf_counter()
            engine.process(ctx)
            timings.append((time.perf_counter() - start) * 1000)

        avg_ms = statistics.mean(timings)
        p95_ms = sorted(timings)[int(len(timings) * 0.95)]

        assert avg_ms < 50, f"Average latency {avg_ms:.2f}ms exceeds 50ms limit"
        assert p95_ms < 100, f"P95 latency {p95_ms:.2f}ms exceeds 100ms limit"

    def test_priority_engine_throughput(self):
        """Priority Engine must rank 1000 decisions in < 1 second."""
        from decision_engine.engines.priority_engine import PriorityEngine
        from decision_engine.models.decision import Decision

        engine = PriorityEngine()
        decisions = [Decision(confidence_score=i / 1000) for i in range(1000)]
        for d in decisions:
            engine.calculate_priority(d, urgency=0.5, impact=0.5)

        start = time.perf_counter()
        ranked = engine.rank_decisions(decisions)
        elapsed = (time.perf_counter() - start) * 1000

        assert len(ranked) == 1000
        assert elapsed < 1000, f"Ranking 1000 decisions took {elapsed:.2f}ms (limit: 1000ms)"

    def test_encryption_performance(self):
        """Encryption must process 100 items in < 2 seconds."""
        from security_center.encryption.encryption_manager import EncryptionManager

        manager = EncryptionManager()
        data_items = [{"sensitive": f"data_{i}", "id": str(uuid.uuid4())} for i in range(100)]

        start = time.perf_counter()
        for item in data_items:
            encrypted = manager.encrypt_at_rest(item)
            manager.decrypt_at_rest(encrypted)
        elapsed = time.perf_counter() - start

        assert elapsed < 2.0, f"100 encrypt/decrypt cycles took {elapsed:.2f}s (limit: 2s)"

    def test_cloud_sync_queue_performance(self):
        """Offline queue must handle 1000 push+peek in < 500ms."""
        from cloud_sync.core.offline_queue import OfflineQueue

        queue = OfflineQueue()
        start = time.perf_counter()
        for i in range(1000):
            queue.push(f"entity_{i}", "life_graph", "update", {"value": i})
        _ = queue.peek_all()
        elapsed = (time.perf_counter() - start) * 1000

        assert elapsed < 500, f"1000 queue operations took {elapsed:.2f}ms (limit: 500ms)"

    def test_globalization_formatting_performance(self):
        """Locale formatter must format 500 dates in < 2 seconds."""
        from globalization_layer.formatters.locale_formatter import LocaleFormatter
        from globalization_layer.core.models import SupportedLocale

        formatter = LocaleFormatter(SupportedLocale.PT_BR)
        now = datetime.now(timezone.utc)

        start = time.perf_counter()
        for _ in range(500):
            formatter.format_date(now)
        elapsed = time.perf_counter() - start

        assert elapsed < 2.0, f"500 date formats took {elapsed:.2f}s (limit: 2s)"


# ─────────────────────────────────────────────
# OFFLINE TESTS
# ─────────────────────────────────────────────

class TestOffline:
    """Offline mode and data persistence tests."""

    def test_offline_queue_operations(self):
        """Operations queued offline must be retrievable."""
        from cloud_sync.core.offline_queue import OfflineQueue

        queue = OfflineQueue()
        queue.push("entity_offline_1", "life_graph", "update", {"key": "value1"})
        queue.push("entity_offline_2", "life_graph", "create", {"key": "value2"})

        pending = queue.peek_all()
        assert len(pending) >= 2, "Must have at least 2 pending operations"

    def test_offline_queue_ordering(self):
        """Offline operations must maintain FIFO order."""
        from cloud_sync.core.offline_queue import OfflineQueue

        queue = OfflineQueue()
        for i in range(5):
            queue.push(f"entity_{i}", "life_graph", "update", {"order": i})

        pending = queue.peek_all()
        orders = [op.data.get("order", -1) for op in pending[:5]]
        assert orders == sorted(orders), "Operations must be in FIFO order"

    def test_offline_conflict_detection(self):
        """Conflict resolver must detect version conflicts."""
        from cloud_sync.core.conflict_resolver import ConflictResolver, ResolutionStrategy
        from cloud_sync.core.models import SyncEntity

        resolver = ConflictResolver(strategy=ResolutionStrategy.LAST_WRITE_WINS)
        now = datetime.now(timezone.utc)

        local = SyncEntity("entity_1", "life_graph", version=2, data={"v": "local_v2"}, last_modified=now)
        remote = SyncEntity("entity_1", "life_graph", version=3, data={"v": "remote_v3"}, last_modified=now - timedelta(seconds=5))

        resolved = resolver.resolve(local, remote)
        assert resolved is not None, "Must resolve conflict"

    def test_e2ee_offline_encryption(self):
        """E2EE must work without network access."""
        from cloud_sync.encryption.e2ee_engine import E2EEEngine

        engine = E2EEEngine(secret_key="lifeos_test_key_v1")
        data = {"life_graph": {"goals": ["Learn Python", "Exercise daily"]}}
        encrypted = engine.encrypt(data)
        decrypted = engine.decrypt(encrypted)

        assert decrypted == data, "E2EE roundtrip must preserve data integrity"

    def test_delta_sync_incremental(self):
        """Delta sync must compute deltas for changed entities."""
        from cloud_sync.core.delta_sync import DeltaSyncEngine
        from cloud_sync.core.models import SyncEntity

        sync = DeltaSyncEngine()
        now = datetime.now(timezone.utc)

        local_entity = SyncEntity("entity_1", "life_graph", version=1,
                                  data={"value": "original"}, last_modified=now)
        remote_entity = SyncEntity("entity_1", "life_graph", version=2,
                                   data={"value": "modified"}, last_modified=now + timedelta(seconds=10))

        delta = sync.get_delta(local_entity, remote_entity)
        assert delta is not None, "Delta must be computed for changed entities"

    def test_offline_mode_decision_engine(self):
        """Decision Engine must function without external dependencies."""
        from decision_engine.engines.decision_engine import DecisionEngine
        from decision_engine.models.context import ContextInput

        # Simulate offline: no external calls, pure in-memory
        engine = DecisionEngine()
        ctx = ContextInput(
            life_graph_data={"active_goals": [{"name": "Offline Goal", "domain": "health", "progress": 0.3, "confidence": 0.9}]},
            context_engine_data={},
            memory_engine_data={},
        )
        decisions = engine.process(ctx)
        assert len(decisions) > 0, "Decision Engine must work offline"
