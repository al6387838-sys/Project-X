import pytest
from evolution_engine.models import UserTimeline
from evolution_engine.engines import BehaviorAnalyzer

class TestBehaviorAnalyzer:
    def setup_method(self):
        self.timeline = UserTimeline(user_id="test_user")
        self.analyzer = BehaviorAnalyzer(self.timeline)

    def test_analyze_work_style_empty_history(self):
        style, confidence = self.analyzer.analyze_work_style([])
        assert style == "unknown"
        assert confidence == 0.0

    def test_analyze_work_style_deep_worker(self):
        history = [{"duration": 90, "switches": 1}] * 10
        style, confidence = self.analyzer.analyze_work_style(history)
        assert style == "deep_worker"
        assert 0.0 < confidence <= 1.0

    def test_analyze_work_style_multitasker(self):
        history = [{"duration": 10, "switches": 10}] * 10
        style, confidence = self.analyzer.analyze_work_style(history)
        assert style == "multitasker"
        assert 0.0 < confidence <= 1.0

    def test_analyze_learning_style_returns_tuple(self):
        result = self.analyzer.analyze_learning_style([])
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], str)
        assert isinstance(result[1], float)

    def test_analyze_decision_style_returns_tuple(self):
        result = self.analyzer.analyze_decision_style([])
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_generate_behavior_profile_structure(self):
        profile = self.analyzer.generate_behavior_profile([])
        assert "work_style" in profile
        assert "learning_style" in profile
        assert "decision_style" in profile
        assert "overall_behavior_confidence" in profile

    def test_behavior_profile_confidence_is_average(self):
        profile = self.analyzer.generate_behavior_profile([])
        w = profile["work_style"]["confidence"]
        l = profile["learning_style"]["confidence"]
        d = profile["decision_style"]["confidence"]
        expected = (w + l + d) / 3.0
        assert abs(profile["overall_behavior_confidence"] - expected) < 0.001

    def test_behavior_profile_confidence_in_range(self):
        profile = self.analyzer.generate_behavior_profile([])
        assert 0.0 <= profile["overall_behavior_confidence"] <= 1.0
