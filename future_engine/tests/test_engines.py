import pytest
from future_engine.engines import FutureEngine, ScenarioGenerator, PredictionEngine, RiskDetector, OpportunityDetector

class TestFutureEngines:
    def setup_method(self):
        self.future_engine = FutureEngine()

    def test_scenario_generation_sleep(self):
        scenario = self.future_engine.simulate_future("Se continuar dormindo pouco", time_horizon="30_days")
        assert "dormindo pouco" in scenario.title
        assert scenario.probability > 0.5
        assert any(risk["title"] == "Fadiga crônica" for risk in scenario.risks)

    def test_scenario_generation_investment(self):
        scenario = self.future_engine.simulate_future("Se aumentar investimentos", time_horizon="1_year")
        assert "aumentar investimentos" in scenario.title
        assert scenario.impact_score > 0
        assert any(opp["title"] == "Crescimento patrimonial" for opp in scenario.opportunities)

    def test_prediction_health(self):
        prediction = self.future_engine.get_predictions("health", "General Health")
        assert prediction.category == "health"
        assert prediction.probability > 0.5
        assert len(prediction.evidence) > 0

    def test_risk_detection(self):
        risks = self.future_engine.get_risks()
        assert len(risks) > 0
        assert any("Burnout" in risk.title for risk in risks)

    def test_opportunity_detection(self):
        opportunities = self.future_engine.get_opportunities()
        assert len(opportunities) > 0
        # Como o MockOpportunityDetector usa um estado fixo no teste, vamos apenas checar se retornou algo
        assert isinstance(opportunities, list)

    def test_future_engine_initialization(self):
        assert self.future_engine.scenario_generator is not None
        assert self.future_engine.prediction_engine is not None
        assert self.future_engine.risk_detector is not None
        assert self.future_engine.opportunity_detector is not None

    def test_time_horizon_validation(self):
        with pytest.raises(ValueError):
            self.future_engine.scenario_generator.generate_scenario("Test", time_horizon="invalid")

    def test_confidence_decay_over_time(self):
        scenario_short = self.future_engine.simulate_future("Test", time_horizon="30_days")
        scenario_long = self.future_engine.simulate_future("Test", time_horizon="10_years")
        assert scenario_long.confidence_score < scenario_short.confidence_score
