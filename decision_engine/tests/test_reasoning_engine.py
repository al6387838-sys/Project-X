"""
Testes unitários para o Reasoning Engine.
"""

import pytest
from decision_engine.models.decision import Decision
from decision_engine.engines.reasoning_engine import ReasoningEngine, ReasoningChain, ReasoningStep


class TestReasoningStep:
    def test_step_creation(self):
        step = ReasoningStep(1, "Análise inicial", ["evidência A"], 0.9)
        assert step.step_id == 1
        assert step.description == "Análise inicial"
        assert "evidência A" in step.evidence
        assert step.weight == 0.9

    def test_step_to_text_contains_description(self):
        step = ReasoningStep(1, "Análise inicial", ["evidência A"], 0.9)
        text = step.to_text()
        assert "Análise inicial" in text
        assert "evidência A" in text

    def test_step_to_text_no_evidence(self):
        step = ReasoningStep(2, "Sem evidência")
        text = step.to_text()
        assert "sem evidência adicional" in text


class TestReasoningChain:
    def test_chain_creation(self):
        chain = ReasoningChain("d-001")
        assert chain.decision_id == "d-001"
        assert chain.steps == []
        assert not chain.is_valid

    def test_add_step(self):
        chain = ReasoningChain("d-001")
        chain.add_step("Passo 1", ["ev1"], 0.8)
        assert len(chain.steps) == 1

    def test_conclude_makes_valid(self):
        chain = ReasoningChain("d-001")
        chain.add_step("Passo 1")
        chain.conclude("Conclusão final.")
        assert chain.is_valid is True
        assert chain.conclusion == "Conclusão final."

    def test_conclude_without_steps_invalid(self):
        chain = ReasoningChain("d-001")
        chain.conclude("Conclusão sem passos.")
        assert chain.is_valid is False

    def test_to_text_contains_all_steps(self):
        chain = ReasoningChain("d-001")
        chain.add_step("Passo A")
        chain.add_step("Passo B")
        chain.conclude("Conclusão.")
        text = chain.to_text()
        assert "Passo A" in text
        assert "Passo B" in text
        assert "Conclusão." in text


class TestReasoningEngine:
    def setup_method(self):
        self.engine = ReasoningEngine()

    def test_build_chain_returns_chain(self):
        d = Decision(action_type="goal_pursuit", confidence_score=0.8, priority=70)
        chain = self.engine.build_chain(d)
        assert isinstance(chain, ReasoningChain)

    def test_build_chain_has_steps(self):
        d = Decision(action_type="goal_pursuit", confidence_score=0.8, priority=70)
        chain = self.engine.build_chain(d)
        assert len(chain.steps) > 0

    def test_build_chain_is_valid(self):
        d = Decision(action_type="goal_pursuit", confidence_score=0.8, priority=70)
        chain = self.engine.build_chain(d)
        assert chain.is_valid is True

    def test_build_chain_all_action_types(self):
        for action_type in ["goal_pursuit", "event_response", "pattern_based", "maintenance", "general"]:
            d = Decision(action_type=action_type, confidence_score=0.6, priority=50)
            chain = self.engine.build_chain(d)
            assert len(chain.steps) > 0

    def test_build_chain_appends_to_reasoning(self):
        d = Decision(action_type="goal_pursuit", confidence_score=0.8, priority=70)
        initial_reasoning_count = len(d.reasoning)
        self.engine.build_chain(d)
        assert len(d.reasoning) > initial_reasoning_count

    def test_validate_valid_decision(self):
        d = Decision(
            action_type="goal_pursuit",
            confidence_score=0.8,
            priority=70,
            reasoning=["Motivo A", "Motivo B"],
            affected_context=["health"],
        )
        result = self.engine.validate(d)
        assert result["is_valid"] is True
        assert result["issues"] == []

    def test_validate_no_reasoning_is_invalid(self):
        d = Decision(confidence_score=0.8, priority=70, affected_context=["health"])
        result = self.engine.validate(d)
        assert result["is_valid"] is False
        assert any("raciocínio" in issue.lower() for issue in result["issues"])

    def test_validate_zero_confidence_warns(self):
        d = Decision(confidence_score=0.0, reasoning=["Motivo"], affected_context=["health"])
        result = self.engine.validate(d)
        assert any("confiança" in issue.lower() for issue in result["issues"])

    def test_validate_all_returns_list(self):
        decisions = [
            Decision(reasoning=["R1"], confidence_score=0.7, affected_context=["a"]),
            Decision(reasoning=["R2"], confidence_score=0.8, affected_context=["b"]),
        ]
        results = self.engine.validate_all(decisions)
        assert len(results) == 2

    def test_explain_contains_decision_info(self):
        d = Decision(
            action_type="goal_pursuit",
            confidence_score=0.85,
            priority=80,
            reasoning=["Motivo principal"],
            affected_context=["health"],
        )
        explanation = self.engine.explain(d)
        assert "goal_pursuit" in explanation
        assert "0.85" in explanation
        assert "Motivo principal" in explanation

    def test_explain_no_reasoning_shows_empty(self):
        d = Decision(action_type="general", confidence_score=0.5, priority=50)
        explanation = self.engine.explain(d)
        assert "RACIOCÍNIO" in explanation
