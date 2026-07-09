import pytest
from datetime import datetime
from trust_engine.models.trust import ConfidenceLevel, DecisionRecord
from trust_engine.engines.trust_engine import TrustEngine
from trust_engine.engines.decision_history import DecisionHistory
from trust_engine.engines.audit_engine import AuditEngine
from trust_engine.engines.reasoning_engine import ReasoningEngine
from trust_engine.engines.transparency_engine import TransparencyEngine

class TestTrustEngine:
    def test_record_and_retrieve_decision(self):
        trust_engine = TrustEngine()
        user_id = "test_user_001"
        engine = "FutureEngine"
        data_used = {"completeness": 0.9, "last_6_months_activity": "high"}
        explanation = "Sugerir aumento de investimentos em 15%."
        alternatives = [{"description": "Manter investimentos atuais", "impact": "0.0"}]
        
        record = trust_engine.record_lifeos_decision(
            user_id=user_id,
            engine_responsible=engine,
            data_used=data_used,
            explanation=explanation,
            alternatives_considered=alternatives
        )
        
        assert record.user_id == user_id
        assert record.engine_responsible == engine
        assert record.confidence_level == ConfidenceLevel.HIGH
        
        # Recuperar explicação
        explanation_response = trust_engine.get_decision_explanation(user_id, record.decision_id)
        assert explanation_response["success"] is True
        assert "FutureEngine" in explanation_response["explanation"]
        assert explanation in explanation_response["explanation"]

    def test_audit_summary(self):
        trust_engine = TrustEngine()
        user_id = "test_user_002"
        
        # Gravar algumas decisões
        trust_engine.record_lifeos_decision(user_id, "Engine1", {"completeness": 1.0}, "Explicação 1", [], {"tags": ["critical_impact"]})
        trust_engine.record_lifeos_decision(user_id, "Engine2", {"completeness": 0.2}, "Explicação 2", [])
        
        summary = trust_engine.get_audit_summary(user_id)
        assert summary["total_decisions"] == 2
        assert summary["decisions_by_engine"]["Engine1"] == 1
        assert summary["decisions_by_engine"]["Engine2"] == 1
        assert summary["confidence_distribution"][ConfidenceLevel.VERY_HIGH.value] == 1
        assert summary["confidence_distribution"][ConfidenceLevel.LOW.value] == 1

    def test_trust_score_update(self):
        trust_engine = TrustEngine()
        user_id = "test_user_003"
        initial_score = trust_engine.get_user_trust_score(user_id)
        assert initial_score == 0.5
        
        # Decisão com confiança muito alta (aumenta score)
        trust_engine.record_lifeos_decision(user_id, "E1", {"completeness": 1.0}, "E1", [], {"tags": ["critical_impact"]})
        score_after_high = trust_engine.get_user_trust_score(user_id)
        assert score_after_high > initial_score
        
        # Decisão com confiança baixa (diminui score)
        trust_engine.record_lifeos_decision(user_id, "E2", {"completeness": 0.1}, "E2", [])
        score_after_low = trust_engine.get_user_trust_score(user_id)
        assert score_after_low < score_after_high

    def test_transparency_answer_why(self):
        trust_engine = TrustEngine()
        user_id = "test_user_004"
        
        # Sem decisões
        response = trust_engine.transparency_engine.answer_why_question(user_id, "Por que?")
        assert response["success"] is False
        
        # Com decisão
        trust_engine.record_lifeos_decision(user_id, "E1", {"completeness": 0.8}, "Explicando...", [])
        response = trust_engine.transparency_engine.answer_why_question(user_id, "Por que?")
        assert response["success"] is True
        assert "Explicando..." in response["explanation"]
