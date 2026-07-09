"""
Testes unitários para o Priority Engine.
"""

import pytest
from decision_engine.models.decision import Decision
from decision_engine.engines.priority_engine import PriorityEngine


class TestPriorityEngine:
    def setup_method(self):
        self.engine = PriorityEngine()

    def test_calculate_priority_returns_int(self):
        d = Decision(confidence_score=0.8)
        priority = self.engine.calculate_priority(d, urgency=0.7, impact=0.8)
        assert isinstance(priority, int)

    def test_calculate_priority_range(self):
        d = Decision(confidence_score=1.0)
        priority = self.engine.calculate_priority(d, urgency=1.0, impact=1.0)
        assert 0 <= priority <= 100

    def test_high_urgency_high_impact_gives_high_priority(self):
        d = Decision(confidence_score=0.9)
        priority = self.engine.calculate_priority(d, urgency=1.0, impact=1.0)
        assert priority >= 70

    def test_low_urgency_low_impact_gives_low_priority(self):
        d = Decision(confidence_score=0.1)
        priority = self.engine.calculate_priority(d, urgency=0.0, impact=0.0)
        assert priority <= 15

    def test_priority_stored_in_decision(self):
        d = Decision(confidence_score=0.5)
        self.engine.calculate_priority(d, urgency=0.5, impact=0.5)
        assert d.priority > 0

    def test_reasoning_appended(self):
        d = Decision(confidence_score=0.5)
        self.engine.calculate_priority(d, urgency=0.5, impact=0.5)
        assert len(d.reasoning) > 0
        assert "Prioridade calculada" in d.reasoning[0]

    def test_rank_decisions_sorted_descending(self):
        d1 = Decision(confidence_score=0.3)
        d2 = Decision(confidence_score=0.9)
        d3 = Decision(confidence_score=0.6)
        self.engine.calculate_priority(d1, urgency=0.2, impact=0.2)
        self.engine.calculate_priority(d2, urgency=0.9, impact=0.9)
        self.engine.calculate_priority(d3, urgency=0.5, impact=0.5)
        ranked = self.engine.rank_decisions([d1, d2, d3])
        assert ranked[0].priority >= ranked[1].priority >= ranked[2].priority

    def test_context_boost_deadline(self):
        d = Decision(confidence_score=0.5)
        self.engine.calculate_priority(d, urgency=0.5, impact=0.5)
        base_priority = d.priority
        self.engine.apply_context_boost(d, {"is_deadline_near": True})
        assert d.priority >= base_priority

    def test_context_boost_multiple_signals(self):
        d = Decision(confidence_score=0.5)
        self.engine.calculate_priority(d, urgency=0.5, impact=0.5)
        base_priority = d.priority
        signals = {
            "is_deadline_near": True,
            "high_user_stress": True,
            "critical_resource_low": True,
        }
        self.engine.apply_context_boost(d, signals)
        assert d.priority >= base_priority + 20

    def test_context_boost_does_not_exceed_100(self):
        d = Decision(confidence_score=1.0)
        self.engine.calculate_priority(d, urgency=1.0, impact=1.0)
        signals = {
            "is_deadline_near": True,
            "high_user_stress": True,
            "critical_resource_low": True,
        }
        self.engine.apply_context_boost(d, signals)
        assert d.priority <= 100

    def test_custom_weights(self):
        custom_weights = {"urgency": 1.0, "impact": 0.0, "dependency_count": 0.0, "confidence": 0.0}
        engine = PriorityEngine(weights=custom_weights)
        d = Decision(confidence_score=0.0)
        priority = engine.calculate_priority(d, urgency=0.5, impact=0.0)
        assert priority == 50
