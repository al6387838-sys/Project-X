"""
Testes unitários para o Decision Engine principal.
"""

import pytest
from decision_engine.models.context import ContextInput
from decision_engine.engines.decision_engine import DecisionEngine


class TestDecisionEngine:
    def setup_method(self):
        self.engine = DecisionEngine()

    def _make_full_context(self):
        return ContextInput(
            life_graph_data={
                "active_goals": [
                    {"name": "Aprender Python", "domain": "education", "progress": 0.4, "confidence": 0.8},
                    {"name": "Melhorar saúde", "domain": "health", "progress": 0.2, "confidence": 0.7},
                ]
            },
            context_engine_data={
                "recent_events": [
                    {"name": "Reunião importante", "category": "work", "relevance": 0.9},
                    {"name": "Consulta médica", "category": "health", "relevance": 0.8},
                ],
                "signals": {"is_deadline_near": True},
            },
            memory_engine_data={
                "patterns": [
                    {"name": "Estudo matinal", "domain": "education", "strength": 0.75, "occurrences": 30},
                ]
            },
        )

    def test_process_returns_list(self):
        ctx = self._make_full_context()
        decisions = self.engine.process(ctx)
        assert isinstance(decisions, list)

    def test_process_generates_decisions(self):
        ctx = self._make_full_context()
        decisions = self.engine.process(ctx)
        assert len(decisions) > 0

    def test_process_empty_context_returns_fallback(self):
        ctx = ContextInput()
        decisions = self.engine.process(ctx)
        assert len(decisions) == 1
        assert decisions[0].action_type == "maintenance"

    def test_decisions_have_reasoning(self):
        ctx = self._make_full_context()
        decisions = self.engine.process(ctx)
        for d in decisions:
            assert len(d.reasoning) > 0

    def test_decisions_have_priority(self):
        ctx = self._make_full_context()
        decisions = self.engine.process(ctx)
        for d in decisions:
            assert isinstance(d.priority, int)
            assert 0 <= d.priority <= 100

    def test_decisions_sorted_by_priority(self):
        ctx = self._make_full_context()
        decisions = self.engine.process(ctx)
        for i in range(len(decisions) - 1):
            assert decisions[i].priority >= decisions[i + 1].priority

    def test_decisions_have_confidence_score(self):
        ctx = self._make_full_context()
        decisions = self.engine.process(ctx)
        for d in decisions:
            assert 0.0 <= d.confidence_score <= 1.0

    def test_decision_log_populated(self):
        ctx = self._make_full_context()
        self.engine.process(ctx)
        log = self.engine.get_decision_log()
        assert len(log) > 0

    def test_get_decision_by_id_found(self):
        ctx = self._make_full_context()
        decisions = self.engine.process(ctx)
        target_id = decisions[0].decision_id
        found = self.engine.get_decision_by_id(target_id)
        assert found is not None
        assert found.decision_id == target_id

    def test_get_decision_by_id_not_found(self):
        result = self.engine.get_decision_by_id("nonexistent-id")
        assert result is None

    def test_generate_summary_empty(self):
        engine = DecisionEngine()
        summary = engine.generate_summary()
        assert summary["total"] == 0

    def test_generate_summary_with_decisions(self):
        ctx = self._make_full_context()
        self.engine.process(ctx)
        summary = self.engine.generate_summary()
        assert summary["total_decisions"] > 0
        assert "average_confidence" in summary
        assert "average_priority" in summary
        assert "action_type_distribution" in summary

    def test_goal_decisions_generated(self):
        ctx = ContextInput(
            life_graph_data={
                "active_goals": [{"name": "Meta A", "domain": "work", "progress": 0.5, "confidence": 0.8}]
            }
        )
        decisions = self.engine.process(ctx)
        types = [d.action_type for d in decisions]
        assert "goal_pursuit" in types

    def test_event_decisions_generated(self):
        ctx = ContextInput(
            context_engine_data={
                "recent_events": [{"name": "Evento B", "category": "social", "relevance": 0.7}]
            }
        )
        decisions = self.engine.process(ctx)
        types = [d.action_type for d in decisions]
        assert "event_response" in types

    def test_pattern_decisions_generated(self):
        ctx = ContextInput(
            memory_engine_data={
                "patterns": [{"name": "Padrão C", "domain": "health", "strength": 0.6, "occurrences": 10}]
            }
        )
        decisions = self.engine.process(ctx)
        types = [d.action_type for d in decisions]
        assert "pattern_based" in types
