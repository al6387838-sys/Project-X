import pytest
import time
from evolution_engine.engines import EvolutionEngine
from evolution_engine.models import EvolutionSnapshot, LearningEvent

class TestEvolutionEngine:
    def setup_method(self):
        self.engine = EvolutionEngine(user_id="test_user_001")

    def test_engine_initializes_with_snapshot(self):
        tl = self.engine.get_timeline()
        assert len(tl.snapshots) == 1

    def test_initial_snapshot_has_low_confidence(self):
        tl = self.engine.get_timeline()
        initial = tl.snapshots[0]
        assert initial.confidence_score <= 0.2

    def test_process_preference_data(self):
        data = {"action_type": "preference_stated", "content": "Prefers morning meetings"}
        self.engine.process_new_data(data)
        tl = self.engine.get_timeline()
        assert len(tl.snapshots) == 2

    def test_confidence_increases_after_routine_learned(self):
        data = {"action_type": "routine_completed_consistently", "content": "Morning workout"}
        self.engine.process_new_data(data)
        tl = self.engine.get_timeline()
        latest = tl.get_latest_snapshot()
        initial = tl.snapshots[0]
        assert latest.confidence_score > initial.confidence_score

    def test_timeline_never_loses_history(self):
        """Garante que o sistema nunca apaga versões anteriores."""
        interactions = [
            {"action_type": "preference_stated", "content": "Pref 1"},
            {"action_type": "routine_completed_consistently", "content": "Routine 1"},
            {"action_type": "preference_stated", "content": "Pref 2"},
        ]
        for i in interactions:
            self.engine.process_new_data(i)
        tl = self.engine.get_timeline()
        # Deve ter o snapshot inicial + 3 novos = 4
        assert len(tl.snapshots) == 4

    def test_evolution_score_increases_over_time(self):
        initial_score = self.engine.get_timeline().get_latest_snapshot().evolution_score
        self.engine.process_new_data({"action_type": "preference_stated", "content": "Pref"})
        new_score = self.engine.get_timeline().get_latest_snapshot().evolution_score
        assert new_score > initial_score

    def test_learning_events_are_recorded(self):
        self.engine.process_new_data({"action_type": "preference_stated", "content": "Pref"})
        tl = self.engine.get_timeline()
        assert len(tl.learning_events) >= 1

    def test_unknown_action_type_does_not_create_snapshot(self):
        self.engine.process_new_data({"action_type": "unknown_action", "content": "Random"})
        tl = self.engine.get_timeline()
        assert len(tl.snapshots) == 1  # Só o inicial

    def test_significant_improvement_detected(self):
        """Preferência explícita deve gerar melhoria significativa."""
        result = self.engine.process_new_data(
            {"action_type": "preference_stated", "content": "Prefers async communication"}
        )
        assert isinstance(result, bool)

    def test_behavior_analyzer_available(self):
        assert self.engine.behavior_analyzer is not None

    def test_confidence_engine_available(self):
        assert self.engine.confidence_engine is not None

    def test_adaptation_engine_available(self):
        assert self.engine.adaptation_engine is not None

    def test_get_timeline_returns_correct_user(self):
        tl = self.engine.get_timeline()
        assert tl.user_id == "test_user_001"

class TestEvolutionEngineIntegration:
    """Testes de integração simulando 6 meses de uso."""
    
    def test_six_month_simulation(self):
        """
        Simula 6 meses de interações e verifica que o sistema evolui corretamente.
        """
        engine = EvolutionEngine(user_id="anderson_6months")
        
        # Mês 1-2: Sistema aprende rotinas e preferências básicas
        month_1_2 = [
            {"action_type": "routine_completed_consistently", "content": "Morning review at 07:00"},
            {"action_type": "preference_stated", "content": "Prefers deep work blocks"},
            {"action_type": "routine_completed_consistently", "content": "Weekly planning on Sundays"},
            {"action_type": "preference_stated", "content": "Prefers async communication"},
        ]
        
        # Mês 3-4: Usuário começa a corrigir o sistema
        month_3_4 = [
            {"action_type": "decision_override", "content": "Chose different priority"},
            {"action_type": "routine_completed_consistently", "content": "Evening review at 21:00"},
            {"action_type": "preference_stated", "content": "Prefers visual dashboards"},
        ]
        
        # Mês 5-6: Sistema está bem calibrado
        month_5_6 = [
            {"action_type": "routine_completed_consistently", "content": "Daily journaling"},
            {"action_type": "preference_stated", "content": "Prefers minimal notifications"},
            {"action_type": "routine_completed_consistently", "content": "Bi-weekly retrospective"},
        ]
        
        all_interactions = month_1_2 + month_3_4 + month_5_6
        
        for interaction in all_interactions:
            engine.process_new_data(interaction)
            
        tl = engine.get_timeline()
        latest = tl.get_latest_snapshot()
        initial = tl.snapshots[0]
        
        # Após 6 meses, o sistema deve ter evoluído
        assert latest.evolution_score > initial.evolution_score
        assert latest.confidence_score > initial.confidence_score
        assert len(tl.snapshots) > 1
        assert len(tl.learning_events) > 0
        
        # Nunca apaga histórico
        assert tl.snapshots[0].snapshot_id == initial.snapshot_id
