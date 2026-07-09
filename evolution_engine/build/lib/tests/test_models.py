import pytest
import time
from evolution_engine.models import EvolutionSnapshot, LearningEvent, UserTimeline

class TestEvolutionSnapshot:
    def test_default_values(self):
        snap = EvolutionSnapshot()
        assert snap.confidence_score == 0.0
        assert snap.evolution_score == 0.0
        assert snap.adaptation_score == 0.0
        assert snap.learning_velocity == 0.0
        assert snap.routines_learned == []
        assert snap.preferences_learned == []
        assert snap.habits_learned == []
        assert snap.goals_updated == []
        assert snap.work_style == "unknown"
        assert snap.learning_style == "unknown"
        assert snap.decision_style == "unknown"
        assert snap.significant_changes == []

    def test_snapshot_has_unique_id(self):
        s1 = EvolutionSnapshot()
        s2 = EvolutionSnapshot()
        assert s1.snapshot_id != s2.snapshot_id

    def test_snapshot_has_timestamp(self):
        before = time.time()
        snap = EvolutionSnapshot()
        after = time.time()
        assert before <= snap.timestamp <= after

    def test_to_dict(self):
        snap = EvolutionSnapshot(confidence_score=0.5, evolution_score=25.0)
        d = snap.to_dict()
        assert d["confidence_score"] == 0.5
        assert d["evolution_score"] == 25.0

class TestLearningEvent:
    def test_default_values(self):
        event = LearningEvent()
        assert event.category == "general"
        assert event.description == ""
        assert event.confidence_delta == 0.0
        assert event.why_changed == ""
        assert event.what_learned == ""
        assert event.how_improves_experience == ""

    def test_event_has_unique_id(self):
        e1 = LearningEvent()
        e2 = LearningEvent()
        assert e1.event_id != e2.event_id

    def test_event_categories(self):
        categories = ["routine", "preference", "habit", "goal", "work_style", "learning_style", "decision_style"]
        for cat in categories:
            event = LearningEvent(category=cat)
            assert event.category == cat

class TestUserTimeline:
    def test_timeline_starts_empty(self):
        tl = UserTimeline(user_id="user_001")
        assert tl.snapshots == []
        assert tl.learning_events == []

    def test_add_snapshot(self):
        tl = UserTimeline(user_id="user_001")
        snap = EvolutionSnapshot(confidence_score=0.5)
        tl.add_snapshot(snap)
        assert len(tl.snapshots) == 1
        assert tl.snapshots[0].confidence_score == 0.5

    def test_add_multiple_snapshots_preserves_history(self):
        tl = UserTimeline(user_id="user_001")
        for i in range(5):
            tl.add_snapshot(EvolutionSnapshot(confidence_score=i * 0.1))
        assert len(tl.snapshots) == 5

    def test_get_latest_snapshot_returns_most_recent(self):
        tl = UserTimeline(user_id="user_001")
        snap1 = EvolutionSnapshot(confidence_score=0.1)
        snap1.timestamp = 1000.0
        snap2 = EvolutionSnapshot(confidence_score=0.9)
        snap2.timestamp = 9999.0
        tl.add_snapshot(snap1)
        tl.add_snapshot(snap2)
        latest = tl.get_latest_snapshot()
        assert latest.confidence_score == 0.9

    def test_get_latest_snapshot_empty_returns_none(self):
        tl = UserTimeline(user_id="user_001")
        assert tl.get_latest_snapshot() is None

    def test_add_learning_event(self):
        tl = UserTimeline(user_id="user_001")
        event = LearningEvent(category="routine", description="Morning routine detected")
        tl.add_learning_event(event)
        assert len(tl.learning_events) == 1

    def test_timeline_never_deletes_snapshots(self):
        """Garante que versões antigas nunca são apagadas."""
        tl = UserTimeline(user_id="user_001")
        snapshots = [EvolutionSnapshot(confidence_score=i * 0.1) for i in range(10)]
        for s in snapshots:
            tl.add_snapshot(s)
        # Adicionar mais não apaga os antigos
        tl.add_snapshot(EvolutionSnapshot(confidence_score=0.99))
        assert len(tl.snapshots) == 11
