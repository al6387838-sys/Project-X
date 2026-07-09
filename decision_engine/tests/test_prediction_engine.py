"""
Testes unitários para o Prediction Engine.
"""

import pytest
from decision_engine.engines.prediction_engine import PredictionEngine, Prediction


class TestPrediction:
    def test_prediction_has_unique_id(self):
        p1 = Prediction()
        p2 = Prediction()
        assert p1.prediction_id != p2.prediction_id

    def test_prediction_explain_contains_target(self):
        p = Prediction(target="stress_level", predicted_value=0.7, confidence=0.8, horizon="short_term")
        text = p.explain()
        assert "stress_level" in text
        assert "0.7" in text

    def test_prediction_explain_with_risk_factors(self):
        p = Prediction(
            target="energy",
            predicted_value=0.5,
            confidence=0.6,
            risk_factors=["Fator de risco A"],
        )
        text = p.explain()
        assert "Fator de risco A" in text


class TestPredictionEngine:
    def setup_method(self):
        self.engine = PredictionEngine()

    def _make_context(self, **kwargs):
        return {"signals": {}, **kwargs}

    def _make_memory(self, **kwargs):
        return {"patterns": [], **kwargs}

    def test_predict_returns_prediction(self):
        p = self.engine.predict("stress_level", self._make_context(), self._make_memory())
        assert isinstance(p, Prediction)

    def test_predict_has_target(self):
        p = self.engine.predict("energy", self._make_context(), self._make_memory())
        assert p.target == "energy"

    def test_predict_confidence_in_range(self):
        p = self.engine.predict("focus", self._make_context(), self._make_memory())
        assert 0.0 <= p.confidence <= 1.0

    def test_predict_has_reasoning(self):
        p = self.engine.predict("mood", self._make_context(), self._make_memory())
        assert len(p.reasoning) > 0

    def test_predict_with_historical_data(self):
        memory = self._make_memory(historical_values={"productivity": [0.5, 0.6, 0.7, 0.8]})
        p = self.engine.predict("productivity", self._make_context(), memory)
        assert p.predicted_value is not None
        assert any("histórico" in r.lower() or "históric" in r.lower() for r in p.reasoning)

    def test_predict_short_term_higher_confidence(self):
        ctx = self._make_context()
        mem = self._make_memory()
        p_short = self.engine.predict("x", ctx, mem, horizon="short_term")
        p_long = self.engine.predict("x", ctx, mem, horizon="long_term")
        assert p_short.confidence >= p_long.confidence

    def test_predict_volatility_reduces_confidence(self):
        ctx_normal = self._make_context()
        ctx_volatile = self._make_context(signals={"volatility_high": True})
        mem = self._make_memory()
        p_normal = self.engine.predict("x", ctx_normal, mem)
        p_volatile = self.engine.predict("x", ctx_volatile, mem)
        assert p_volatile.confidence <= p_normal.confidence

    def test_predict_invalid_horizon_defaults_to_short_term(self):
        p = self.engine.predict("x", self._make_context(), self._make_memory(), horizon="invalid")
        assert p.horizon == "short_term"

    def test_predict_batch_returns_list(self):
        targets = ["stress", "energy", "focus"]
        predictions = self.engine.predict_batch(targets, self._make_context(), self._make_memory())
        assert len(predictions) == 3
        assert all(isinstance(p, Prediction) for p in predictions)

    def test_predict_batch_targets_match(self):
        targets = ["a", "b", "c"]
        predictions = self.engine.predict_batch(targets, self._make_context(), self._make_memory())
        pred_targets = [p.target for p in predictions]
        assert set(pred_targets) == set(targets)

    def test_assess_risk_empty(self):
        result = self.engine.assess_risk([])
        assert result["risk_level"] == "unknown"

    def test_assess_risk_low(self):
        predictions = [Prediction(confidence=0.9), Prediction(confidence=0.85)]
        result = self.engine.assess_risk(predictions)
        assert result["risk_level"] == "low"

    def test_assess_risk_high(self):
        predictions = [
            Prediction(confidence=0.2, risk_factors=["R1", "R2", "R3"]),
            Prediction(confidence=0.25, risk_factors=["R4", "R5"]),
        ]
        result = self.engine.assess_risk(predictions)
        assert result["risk_level"] in ["high", "medium"]

    def test_calculate_trend_positive(self):
        values = [1.0, 2.0, 3.0, 4.0, 5.0]
        trend = self.engine._calculate_trend(values)
        assert trend > 0

    def test_calculate_trend_negative(self):
        values = [5.0, 4.0, 3.0, 2.0, 1.0]
        trend = self.engine._calculate_trend(values)
        assert trend < 0

    def test_calculate_trend_flat(self):
        values = [3.0, 3.0, 3.0, 3.0]
        trend = self.engine._calculate_trend(values)
        assert abs(trend) < 0.001

    def test_calculate_trend_single_value(self):
        trend = self.engine._calculate_trend([5.0])
        assert trend == 0.0
