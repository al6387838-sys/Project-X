import pytest
from evolution_engine.models import UserTimeline
from evolution_engine.engines import LearningLoop

class TestLearningLoop:
    def setup_method(self):
        self.timeline = UserTimeline(user_id="test_user")
        self.loop = LearningLoop(self.timeline)

    def test_process_decision_override_creates_event(self):
        data = {"action_type": "decision_override", "content": "Chose manual task over AI suggestion"}
        event = self.loop.process_interaction(data)
        assert event is not None
        assert event.category == "decision_style"

    def test_decision_override_decreases_confidence(self):
        data = {"action_type": "decision_override", "content": "Override"}
        event = self.loop.process_interaction(data)
        assert event.confidence_delta < 0

    def test_routine_completed_creates_event(self):
        data = {"action_type": "routine_completed_consistently", "content": "Morning workout at 06:00"}
        event = self.loop.process_interaction(data)
        assert event is not None
        assert event.category == "routine"

    def test_routine_increases_confidence(self):
        data = {"action_type": "routine_completed_consistently", "content": "Morning workout"}
        event = self.loop.process_interaction(data)
        assert event.confidence_delta > 0

    def test_preference_stated_creates_event(self):
        data = {"action_type": "preference_stated", "content": "Prefers dark mode"}
        event = self.loop.process_interaction(data)
        assert event is not None
        assert event.category == "preference"

    def test_preference_has_high_confidence_delta(self):
        data = {"action_type": "preference_stated", "content": "Prefers short meetings"}
        event = self.loop.process_interaction(data)
        assert event.confidence_delta >= 0.15

    def test_unknown_action_type_returns_none(self):
        data = {"action_type": "unknown_action", "content": "Something random"}
        event = self.loop.process_interaction(data)
        assert event is None

    def test_event_is_added_to_timeline(self):
        data = {"action_type": "preference_stated", "content": "Likes morning briefings"}
        self.loop.process_interaction(data)
        assert len(self.timeline.learning_events) == 1

    def test_multiple_events_accumulate(self):
        interactions = [
            {"action_type": "preference_stated", "content": "Pref 1"},
            {"action_type": "routine_completed_consistently", "content": "Routine 1"},
            {"action_type": "decision_override", "content": "Override 1"},
        ]
        for i in interactions:
            self.loop.process_interaction(i)
        assert len(self.timeline.learning_events) == 3

    def test_event_has_explanation_fields(self):
        data = {"action_type": "preference_stated", "content": "Prefers bullet points"}
        event = self.loop.process_interaction(data)
        assert event.why_changed != ""
        assert event.what_learned != ""
        assert event.how_improves_experience != ""

    def test_analyze_historical_patterns_returns_events(self):
        events = self.loop.analyze_historical_patterns(past_days=7)
        assert len(events) > 0
        assert events[0].category == "work_style"

    def test_historical_analysis_adds_to_timeline(self):
        self.loop.analyze_historical_patterns(past_days=7)
        assert len(self.timeline.learning_events) > 0
