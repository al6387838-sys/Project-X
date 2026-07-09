"""
Testes unitários para o Recommendation Engine.
"""

import pytest
from decision_engine.models.decision import Decision
from decision_engine.engines.prediction_engine import Prediction
from decision_engine.engines.recommendation_engine import RecommendationEngine, Recommendation


class TestRecommendation:
    def test_recommendation_has_unique_id(self):
        r1 = Recommendation()
        r2 = Recommendation()
        assert r1.recommendation_id != r2.recommendation_id

    def test_recommendation_explain_contains_title(self):
        r = Recommendation(title="Minha Recomendação", confidence=0.8, priority=70)
        text = r.explain()
        assert "Minha Recomendação" in text

    def test_recommendation_explain_contains_confidence(self):
        r = Recommendation(title="Teste", confidence=0.75, priority=60)
        text = r.explain()
        assert "0.75" in text


class TestRecommendationEngine:
    def setup_method(self):
        self.engine = RecommendationEngine()

    def _make_goal_decision(self):
        return Decision(
            action_type="goal_pursuit",
            confidence_score=0.8,
            priority=75,
            reasoning=["Objetivo ativo identificado."],
            metadata={"goal": {"name": "Aprender Python", "domain": "education", "progress": 0.4}},
        )

    def _make_event_decision(self):
        return Decision(
            action_type="event_response",
            confidence_score=0.7,
            priority=60,
            reasoning=["Evento detectado."],
            metadata={"event": {"name": "Reunião", "category": "work", "relevance": 0.9}},
        )

    def _make_pattern_decision(self):
        return Decision(
            action_type="pattern_based",
            confidence_score=0.65,
            priority=55,
            reasoning=["Padrão identificado."],
            metadata={"pattern": {"name": "Estudo matinal", "domain": "education", "strength": 0.75}},
        )

    def test_from_decision_returns_recommendation(self):
        d = self._make_goal_decision()
        r = self.engine.from_decision(d)
        assert isinstance(r, Recommendation)

    def test_from_decision_goal_has_title(self):
        d = self._make_goal_decision()
        r = self.engine.from_decision(d)
        assert "Aprender Python" in r.title

    def test_from_decision_event_has_title(self):
        d = self._make_event_decision()
        r = self.engine.from_decision(d)
        assert "Reunião" in r.title

    def test_from_decision_pattern_has_title(self):
        d = self._make_pattern_decision()
        r = self.engine.from_decision(d)
        assert "Estudo matinal" in r.title

    def test_from_decision_confidence_matches(self):
        d = self._make_goal_decision()
        r = self.engine.from_decision(d)
        assert r.confidence == d.confidence_score

    def test_from_decision_priority_matches(self):
        d = self._make_goal_decision()
        r = self.engine.from_decision(d)
        assert r.priority == d.priority

    def test_from_decision_has_reasoning(self):
        d = self._make_goal_decision()
        r = self.engine.from_decision(d)
        assert len(r.reasoning) > 0

    def test_from_decision_source_decision_tracked(self):
        d = self._make_goal_decision()
        r = self.engine.from_decision(d)
        assert d.decision_id in r.source_decisions

    def test_from_prediction_returns_recommendation(self):
        p = Prediction(target="stress", predicted_value=0.8, confidence=0.75, horizon="short_term")
        r = self.engine.from_prediction(p)
        assert isinstance(r, Recommendation)

    def test_from_prediction_has_target_in_title(self):
        p = Prediction(target="energy_level", predicted_value=0.3, confidence=0.7)
        r = self.engine.from_prediction(p)
        assert "energy_level" in r.title

    def test_from_prediction_source_tracked(self):
        p = Prediction(target="mood", predicted_value=0.6, confidence=0.65)
        r = self.engine.from_prediction(p)
        assert p.prediction_id in r.source_predictions

    def test_generate_batch_returns_sorted_list(self):
        decisions = [self._make_goal_decision(), self._make_event_decision(), self._make_pattern_decision()]
        recs = self.engine.generate_batch(decisions)
        assert len(recs) == 3
        for i in range(len(recs) - 1):
            assert recs[i].priority >= recs[i + 1].priority

    def test_generate_batch_with_predictions(self):
        decisions = [self._make_goal_decision()]
        predictions = [Prediction(target="x", predicted_value=0.5, confidence=0.8)]
        recs = self.engine.generate_batch(decisions, predictions)
        assert len(recs) == 2

    def test_generate_batch_filters_low_confidence_predictions(self):
        decisions = [self._make_goal_decision()]
        predictions = [Prediction(target="y", predicted_value=0.5, confidence=0.2)]
        recs = self.engine.generate_batch(decisions, predictions)
        assert len(recs) == 1

    def test_filter_by_category(self):
        decisions = [self._make_goal_decision(), self._make_event_decision()]
        recs = self.engine.generate_batch(decisions)
        filtered = self.engine.filter_by_category(recs, "goal_pursuit")
        assert all(r.category == "goal_pursuit" for r in filtered)

    def test_filter_by_min_confidence(self):
        decisions = [self._make_goal_decision(), self._make_pattern_decision()]
        recs = self.engine.generate_batch(decisions)
        filtered = self.engine.filter_by_min_confidence(recs, 0.75)
        assert all(r.confidence >= 0.75 for r in filtered)

    def test_summarize_empty(self):
        result = self.engine.summarize([])
        assert result["total"] == 0

    def test_summarize_with_recommendations(self):
        decisions = [self._make_goal_decision(), self._make_event_decision()]
        recs = self.engine.generate_batch(decisions)
        summary = self.engine.summarize(recs)
        assert summary["total"] == 2
        assert "average_confidence" in summary
        assert "category_distribution" in summary
