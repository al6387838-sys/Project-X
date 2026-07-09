"""
Testes unitários para o Conflict Resolver.
"""

import pytest
from decision_engine.models.decision import Decision
from decision_engine.models.context import Conflict
from decision_engine.resolvers.conflict_resolver import ConflictResolver


class TestConflictResolver:
    def setup_method(self):
        self.resolver = ConflictResolver()

    def _make_decision(self, contexts, priority=50, confidence=0.7):
        d = Decision(
            affected_context=contexts,
            priority=priority,
            confidence_score=confidence,
        )
        return d

    def test_detect_no_conflicts_when_no_overlap(self):
        d1 = self._make_decision(["health"])
        d2 = self._make_decision(["finance"])
        conflicts = self.resolver.detect_conflicts([d1, d2])
        assert len(conflicts) == 0

    def test_detect_conflict_on_overlap(self):
        d1 = self._make_decision(["health", "work"])
        d2 = self._make_decision(["health", "family"])
        conflicts = self.resolver.detect_conflicts([d1, d2])
        assert len(conflicts) == 1
        assert "health" in conflicts[0].description

    def test_detect_multiple_conflicts(self):
        d1 = self._make_decision(["health", "work"])
        d2 = self._make_decision(["health", "finance"])
        d3 = self._make_decision(["work", "finance"])
        conflicts = self.resolver.detect_conflicts([d1, d2, d3])
        assert len(conflicts) == 3

    def test_conflict_has_involved_decisions(self):
        d1 = self._make_decision(["health"])
        d2 = self._make_decision(["health"])
        conflicts = self.resolver.detect_conflicts([d1, d2])
        assert d1.decision_id in conflicts[0].involved_decisions
        assert d2.decision_id in conflicts[0].involved_decisions

    def test_resolve_priority_wins(self):
        d1 = self._make_decision(["health"], priority=80)
        d2 = self._make_decision(["health"], priority=40)
        conflicts = self.resolver.detect_conflicts([d1, d2])
        resolved_conflict, winner = self.resolver.resolve(conflicts[0], [d1, d2], "priority_wins")
        assert winner.decision_id == d1.decision_id
        assert resolved_conflict.resolved is True

    def test_resolve_merge(self):
        d1 = self._make_decision(["health"], priority=60)
        d2 = self._make_decision(["health", "work"], priority=50)
        conflicts = self.resolver.detect_conflicts([d1, d2])
        resolved_conflict, winner = self.resolver.resolve(conflicts[0], [d1, d2], "merge")
        assert resolved_conflict.resolved is True
        assert "work" in winner.affected_context or "health" in winner.affected_context

    def test_resolve_defer(self):
        d1 = self._make_decision(["health"], priority=70)
        d2 = self._make_decision(["health"], priority=30)
        conflicts = self.resolver.detect_conflicts([d1, d2])
        resolved_conflict, winner = self.resolver.resolve(conflicts[0], [d1, d2], "defer")
        assert resolved_conflict.resolved is True
        assert "defer" in resolved_conflict.resolution_strategy

    def test_resolve_user_arbitration(self):
        d1 = self._make_decision(["health"], priority=50)
        d2 = self._make_decision(["health"], priority=50)
        conflicts = self.resolver.detect_conflicts([d1, d2])
        resolved_conflict, winner = self.resolver.resolve(conflicts[0], [d1, d2], "user_arbitration")
        assert "user_arbitration" in resolved_conflict.resolution_strategy

    def test_resolve_invalid_strategy_raises(self):
        d1 = self._make_decision(["health"])
        d2 = self._make_decision(["health"])
        conflicts = self.resolver.detect_conflicts([d1, d2])
        with pytest.raises(ValueError):
            self.resolver.resolve(conflicts[0], [d1, d2], "invalid_strategy")

    def test_resolve_all_resolves_all_conflicts(self):
        d1 = self._make_decision(["health", "work"], priority=80)
        d2 = self._make_decision(["health", "finance"], priority=50)
        d3 = self._make_decision(["work", "finance"], priority=60)
        conflicts = self.resolver.detect_conflicts([d1, d2, d3])
        results = self.resolver.resolve_all(conflicts, [d1, d2, d3])
        assert len(results) == len(conflicts)
        for conflict, winner in results:
            assert conflict.resolved is True

    def test_conflict_severity_calculated(self):
        d1 = self._make_decision(["health", "work", "finance"], priority=90)
        d2 = self._make_decision(["health", "work", "finance"], priority=10)
        conflicts = self.resolver.detect_conflicts([d1, d2])
        assert conflicts[0].severity >= 1
        assert conflicts[0].severity <= 10

    def test_reasoning_appended_after_resolution(self):
        d1 = self._make_decision(["health"], priority=80)
        d2 = self._make_decision(["health"], priority=40)
        conflicts = self.resolver.detect_conflicts([d1, d2])
        _, winner = self.resolver.resolve(conflicts[0], [d1, d2], "priority_wins")
        assert len(winner.reasoning) > 0
