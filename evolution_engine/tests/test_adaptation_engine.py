import pytest
from evolution_engine.models import EvolutionSnapshot, LearningEvent
from evolution_engine.engines import AdaptationEngine

class TestAdaptationEngine:
    def setup_method(self):
        self.engine = AdaptationEngine()

    def test_register_system(self):
        mock_system = object()
        self.engine.register_system("personal_dna", mock_system)
        assert "personal_dna" in self.engine.system_registry

    def test_trigger_adaptation_returns_dict(self):
        snap = EvolutionSnapshot(confidence_score=0.7)
        event = LearningEvent(category="preference", description="Prefers dark mode")
        result = self.engine.trigger_adaptation(snap, event)
        assert isinstance(result, dict)

    def test_trigger_adaptation_has_all_systems(self):
        snap = EvolutionSnapshot(confidence_score=0.7)
        event = LearningEvent(category="preference", description="Prefers dark mode")
        result = self.engine.trigger_adaptation(snap, event)
        expected_keys = ["personal_dna", "context_engine", "decision_engine", "action_engine", "companion"]
        for key in expected_keys:
            assert key in result

    def test_preference_event_updates_personal_dna(self):
        snap = EvolutionSnapshot(confidence_score=0.7)
        event = LearningEvent(category="preference", description="Prefers short meetings")
        result = self.engine.trigger_adaptation(snap, event)
        assert result["personal_dna"] is True

    def test_routine_event_updates_context_engine(self):
        snap = EvolutionSnapshot(confidence_score=0.7)
        event = LearningEvent(category="routine", description="Morning routine detected")
        result = self.engine.trigger_adaptation(snap, event)
        assert result["context_engine"] is True

    def test_decision_style_event_updates_decision_engine(self):
        snap = EvolutionSnapshot(confidence_score=0.7)
        event = LearningEvent(category="decision_style", description="User overrides system")
        result = self.engine.trigger_adaptation(snap, event)
        assert result["decision_engine"] is True

    def test_action_engine_always_updated(self):
        snap = EvolutionSnapshot(confidence_score=0.5)
        event = LearningEvent(category="general", description="Generic event")
        result = self.engine.trigger_adaptation(snap, event)
        assert result["action_engine"] is True

    def test_companion_always_updated(self):
        snap = EvolutionSnapshot(confidence_score=0.5)
        event = LearningEvent(category="general", description="Generic event")
        result = self.engine.trigger_adaptation(snap, event)
        assert result["companion"] is True

    def test_habit_event_does_not_update_personal_dna(self):
        snap = EvolutionSnapshot(confidence_score=0.7)
        event = LearningEvent(category="habit", description="Daily habit detected")
        result = self.engine.trigger_adaptation(snap, event)
        assert result["personal_dna"] is False
