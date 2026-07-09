"""
Testes unitários para os modelos de dados do Decision Engine.
"""

import pytest
import time
from decision_engine.models.decision import Decision
from decision_engine.models.context import ContextInput, Conflict


class TestDecision:
    def test_decision_has_unique_id(self):
        d1 = Decision()
        d2 = Decision()
        assert d1.decision_id != d2.decision_id

    def test_decision_timestamp_is_recent(self):
        before = time.time()
        d = Decision()
        after = time.time()
        assert before <= d.timestamp <= after

    def test_decision_default_values(self):
        d = Decision()
        assert d.confidence_score == 0.0
        assert d.priority == 0
        assert d.reasoning == []
        assert d.affected_context == []
        assert d.dependencies == []
        assert d.alternative_decisions == []
        assert d.action_type == "general"

    def test_decision_explain_no_reasoning(self):
        d = Decision()
        result = d.explain()
        assert "Nenhum raciocínio fornecido" in result

    def test_decision_explain_with_reasoning(self):
        d = Decision(reasoning=["Motivo A", "Motivo B"])
        result = d.explain()
        assert "Motivo A" in result
        assert "Motivo B" in result

    def test_decision_custom_fields(self):
        d = Decision(
            confidence_score=0.85,
            priority=75,
            action_type="goal_pursuit",
            affected_context=["health", "finance"],
        )
        assert d.confidence_score == 0.85
        assert d.priority == 75
        assert d.action_type == "goal_pursuit"
        assert "health" in d.affected_context


class TestContextInput:
    def test_context_input_default_empty(self):
        ctx = ContextInput()
        assert ctx.life_graph_data == {}
        assert ctx.context_engine_data == {}
        assert ctx.memory_engine_data == {}

    def test_context_input_with_data(self):
        ctx = ContextInput(
            life_graph_data={"active_goals": []},
            context_engine_data={"recent_events": []},
            memory_engine_data={"patterns": []},
        )
        assert "active_goals" in ctx.life_graph_data
        assert "recent_events" in ctx.context_engine_data
        assert "patterns" in ctx.memory_engine_data


class TestConflict:
    def test_conflict_creation(self):
        c = Conflict(
            conflict_id="c-001",
            description="Conflito de teste",
            involved_decisions=["d-001", "d-002"],
            severity=5,
        )
        assert c.conflict_id == "c-001"
        assert not c.resolved
        assert c.severity == 5

    def test_conflict_default_not_resolved(self):
        c = Conflict(
            conflict_id="c-002",
            description="Outro conflito",
            involved_decisions=["d-003"],
        )
        assert c.resolved is False
        assert c.resolution_strategy == ""
