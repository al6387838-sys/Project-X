import pytest
from intelligence_hub.intelligence_engine import IntelligenceEngine
from intelligence_hub.briefings.morning_briefing import MorningBriefing
from intelligence_hub.reviews.review_manager import ReviewManager

class TestMagicMoment:
    
    @pytest.fixture
    def setup_hub(self):
        engine = IntelligenceEngine()
        briefing = MorningBriefing(engine)
        review = ReviewManager(engine)
        return engine, briefing, review

    def test_morning_briefing_generation(self, setup_hub):
        _, briefing, _ = setup_hub
        content = briefing.generate()
        
        assert "greeting" in content
        assert "Anderson" in content["greeting"]
        assert len(content["sections"]) == 5
        assert content["sections"][0]["title"] == "Prioridades Reais"

    def test_contextual_greeting(self, setup_hub):
        engine, briefing, _ = setup_hub
        # Simula sono ruim
        content = briefing.generate()
        assert "dormiu menos" in content["greeting"]

    def test_explicability(self, setup_hub):
        _, briefing, _ = setup_hub
        explanation = briefing.explain_item("Conflito de agenda")
        assert "Context Engine" in explanation
        
        explanation_default = briefing.explain_item("Qualquer coisa")
        assert "integração total" in explanation_default

    def test_evening_review(self, setup_hub):
        _, _, review = setup_hub
        content = review.generate_evening_review()
        assert content["title"] == "Evening Review"
        assert "wins" in content

    def test_weekly_review(self, setup_hub):
        _, _, review = setup_hub
        content = review.generate_weekly_review()
        assert "82.0%" in content["progress"]
