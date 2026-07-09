import pytest
from evolution_engine.models import UserTimeline, EvolutionSnapshot
from evolution_engine.engines import ConfidenceEngine

class TestConfidenceEngine:
    def setup_method(self):
        self.timeline = UserTimeline(user_id="test_user")
        self.engine = ConfidenceEngine(self.timeline)

    def test_confidence_zero_interactions(self):
        score = self.engine.calculate_confidence(0, 0, 0)
        assert score == 0.1  # Base mínima

    def test_confidence_all_successes(self):
        score = self.engine.calculate_confidence(100, 0, 30)
        assert score > 0.7

    def test_confidence_all_failures(self):
        score = self.engine.calculate_confidence(0, 100, 30)
        assert score < 0.2

    def test_confidence_more_failures_than_successes_penalized(self):
        score_balanced = self.engine.calculate_confidence(50, 50, 30)
        score_failing = self.engine.calculate_confidence(10, 90, 30)
        assert score_failing < score_balanced

    def test_confidence_bounded_0_to_1(self):
        for s, f, d in [(1000, 0, 365), (0, 1000, 365), (50, 50, 15)]:
            score = self.engine.calculate_confidence(s, f, d)
            assert 0.0 <= score <= 1.0

    def test_confidence_increases_with_time(self):
        score_early = self.engine.calculate_confidence(50, 0, 1)
        score_later = self.engine.calculate_confidence(50, 0, 30)
        assert score_later > score_early

    def test_autonomy_level_observation_only(self):
        level = self.engine.get_autonomy_level(0.1)
        assert level == "observation_only"

    def test_autonomy_level_suggestive(self):
        level = self.engine.get_autonomy_level(0.45)
        assert level == "suggestive"

    def test_autonomy_level_semi_autonomous(self):
        level = self.engine.get_autonomy_level(0.7)
        assert level == "semi_autonomous"

    def test_autonomy_level_autonomous(self):
        level = self.engine.get_autonomy_level(0.9)
        assert level == "autonomous"

    def test_evaluate_snapshot_structure(self):
        snap = EvolutionSnapshot(confidence_score=0.75)
        result = self.engine.evaluate_snapshot(snap)
        assert "current_confidence" in result
        assert "recommended_autonomy" in result
        assert "is_ready_for_automation" in result

    def test_evaluate_snapshot_ready_for_automation(self):
        snap = EvolutionSnapshot(confidence_score=0.65)
        result = self.engine.evaluate_snapshot(snap)
        assert result["is_ready_for_automation"] is True

    def test_evaluate_snapshot_not_ready_for_automation(self):
        snap = EvolutionSnapshot(confidence_score=0.3)
        result = self.engine.evaluate_snapshot(snap)
        assert result["is_ready_for_automation"] is False
