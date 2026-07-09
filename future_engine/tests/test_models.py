import pytest
import time
from future_engine.models import Scenario, Prediction, Risk, Opportunity

class TestFutureModels:
    def test_scenario_creation(self):
        scenario = Scenario(title="Test Scenario", time_horizon="1_year")
        assert scenario.title == "Test Scenario"
        assert scenario.time_horizon == "1_year"
        assert scenario.scenario_id is not None
        assert isinstance(scenario.risks, list)

    def test_prediction_creation(self):
        prediction = Prediction(category="health", outcome="healthy", probability=0.9)
        assert prediction.category == "health"
        assert prediction.outcome == "healthy"
        assert prediction.probability == 0.9

    def test_risk_creation(self):
        risk = Risk(title="High Stress", severity=0.8, likelihood=0.6)
        assert risk.title == "High Stress"
        assert risk.severity == 0.8
        assert risk.likelihood == 0.6

    def test_opportunity_creation(self):
        opportunity = Opportunity(title="Investment", potential_gain=0.7, feasibility=0.5)
        assert opportunity.title == "Investment"
        assert opportunity.potential_gain == 0.7
        assert opportunity.feasibility == 0.5
