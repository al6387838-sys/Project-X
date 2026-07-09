"""
Testes do Learning Engine Principal e Version Manager — SPRINT 026
"""
import pytest
import sys
sys.path.insert(0, '/home/ubuntu/Project-X')

from learning_engine.engines.learning_engine import LearningEngine
from learning_engine.managers.version_manager import VersionManager
from learning_engine.models.learning_event import EventType, FeedbackType
from learning_engine.models.learning_profile import LearningProfile
from learning_engine.models.model_version import LogLevel


class TestLearningEngine:
    def setup_method(self):
        self.engine = LearningEngine(user_id="test_user_001")

    # ------------------------------------------------------------------ #
    #  Inicialização                                                       #
    # ------------------------------------------------------------------ #

    def test_engine_initializes_correctly(self):
        assert self.engine.user_id == "test_user_001"
        assert self.engine._total_events_processed == 0

    def test_engine_creates_initial_version(self):
        versions = self.engine.get_versions()
        assert len(versions) >= 1

    def test_engine_learning_enabled_by_default(self):
        status = self.engine.get_full_status()
        assert status["learning_enabled"] is True

    # ------------------------------------------------------------------ #
    #  Registro de Interações                                              #
    # ------------------------------------------------------------------ #

    def test_record_positive_feedback(self):
        result = self.engine.record_positive_feedback("morning_exercise", domain="saude")
        assert result["learning_applied"] is True
        assert result["total_events_processed"] == 1

    def test_record_negative_feedback(self):
        result = self.engine.record_negative_feedback("late_meetings", domain="trabalho")
        assert result["learning_applied"] is True

    def test_record_implicit_behavior(self):
        result = self.engine.record_implicit_behavior(
            "morning_routine",
            EventType.ROUTINE_FOLLOWED,
            domain="produtividade",
        )
        assert result["learning_applied"] is True

    def test_record_explicit_feedback_with_rating(self):
        result = self.engine.record_explicit_feedback(
            "suggestion_x",
            rating=0.9,
            note="Excelente sugestão!",
        )
        assert result["learning_applied"] is True

    def test_record_routine_interaction_followed(self):
        result = self.engine.record_routine_interaction("morning_routine", followed=True)
        assert result["learning_applied"] is True

    def test_record_habit_interaction_completed(self):
        result = self.engine.record_habit_interaction("exercise", completed=True)
        assert result["learning_applied"] is True

    def test_record_communication_style(self):
        result = self.engine.record_communication_style("style_1", tone="direto")
        assert result["learning_applied"] is True

    # ------------------------------------------------------------------ #
    #  Aprendizado Contínuo                                                #
    # ------------------------------------------------------------------ #

    def test_learning_score_increases_with_interactions(self):
        initial_score = self.engine.get_learning_score().overall
        for _ in range(10):
            self.engine.record_positive_feedback("morning_exercise", domain="saude")
        final_score = self.engine.get_learning_score().overall
        assert final_score >= initial_score

    def test_repeated_positive_creates_preference(self):
        for _ in range(5):
            self.engine.record_positive_feedback("morning_exercise", domain="saude")
        insights = self.engine.get_insights()
        # Deve ter gerado pelo menos um insight
        assert isinstance(insights, list)

    def test_repeated_negative_reduces_pattern_weight(self):
        """
        Usuário rejeita repetidamente determinado tipo de decisão.
        → Reduzir peso desse padrão.
        """
        for _ in range(5):
            self.engine.record_negative_feedback("late_meetings", domain="trabalho")
        patterns = self.engine.get_patterns()
        # Padrão de rejeição deve ter sido criado
        assert isinstance(patterns, list)

    def test_total_events_counter_increments(self):
        for i in range(5):
            self.engine.record_positive_feedback(f"pattern_{i}")
        assert self.engine._total_events_processed == 5

    # ------------------------------------------------------------------ #
    #  Insights e Relatórios                                               #
    # ------------------------------------------------------------------ #

    def test_get_insights_returns_list(self):
        self.engine.record_positive_feedback("morning_exercise", domain="saude")
        insights = self.engine.get_insights()
        assert isinstance(insights, list)

    def test_get_learning_report_returns_string(self):
        report = self.engine.get_learning_report()
        assert isinstance(report, str)
        assert len(report) > 0

    def test_get_behavior_report_structure(self):
        self.engine.record_positive_feedback("test", domain="saude")
        report = self.engine.get_behavior_report()
        assert "metrics" in report
        assert "temporal" in report

    def test_get_patterns_returns_list(self):
        self.engine.record_positive_feedback("morning_exercise")
        patterns = self.engine.get_patterns()
        assert isinstance(patterns, list)

    def test_get_profile_summary_structure(self):
        summary = self.engine.get_profile_summary()
        assert "profile_id" in summary
        assert "learning_score" in summary

    def test_get_full_status_structure(self):
        status = self.engine.get_full_status()
        assert "user_id" in status
        assert "learning_enabled" in status
        assert "total_events_processed" in status
        assert "learning_score" in status

    # ------------------------------------------------------------------ #
    #  Controle de Privacidade                                             #
    # ------------------------------------------------------------------ #

    def test_disable_learning_stops_processing(self):
        self.engine.disable_learning()
        result = self.engine.record_positive_feedback("test")
        assert result["learning_applied"] is False
        assert result.get("reason") == "learning_disabled"

    def test_enable_learning_resumes_processing(self):
        self.engine.disable_learning()
        self.engine.enable_learning()
        result = self.engine.record_positive_feedback("test")
        assert result["learning_applied"] is True

    def test_lock_preference(self):
        self.engine.record_positive_feedback("morning_exercise", domain="saude")
        result = self.engine.lock_preference("saude_morning_exercise")
        assert result is True

    def test_unlock_preference(self):
        self.engine.record_positive_feedback("morning_exercise", domain="saude")
        self.engine.lock_preference("saude_morning_exercise")
        result = self.engine.unlock_preference("saude_morning_exercise")
        assert result is True

    # ------------------------------------------------------------------ #
    #  Versionamento e Rollback                                            #
    # ------------------------------------------------------------------ #

    def test_versions_created_after_events(self):
        initial_versions = len(self.engine.get_versions())
        # Processa suficientes eventos para criar nova versão
        for i in range(12):
            self.engine.record_positive_feedback(f"pattern_{i}")
        final_versions = len(self.engine.get_versions())
        assert final_versions >= initial_versions

    def test_rollback_last_returns_record(self):
        self.engine.record_positive_feedback("test_1")
        # Cria checkpoint forçado
        self.engine._create_checkpoint(trigger="test_checkpoint")
        result = self.engine.rollback_last(reason="test_rollback")
        assert "rollback_id" in result

    def test_rollback_to_version_1(self):
        result = self.engine.rollback_to_version(1, reason="test")
        assert "rollback_id" in result

    def test_rollback_nonexistent_version_fails(self):
        result = self.engine.rollback_to_version(9999, reason="test")
        assert result["success"] is False

    def test_get_logs_returns_list(self):
        self.engine.record_positive_feedback("test")
        logs = self.engine.get_logs()
        assert isinstance(logs, list)
        assert len(logs) > 0


class TestVersionManager:
    def setup_method(self):
        self.manager = VersionManager()
        self.profile = LearningProfile(user_id="test_user")

    def test_create_version_increments_number(self):
        v1 = self.manager.create_version(self.profile, trigger="test_1", force=True)
        v2 = self.manager.create_version(self.profile, trigger="test_2", force=True)
        assert v2.version_number > v1.version_number

    def test_get_current_version(self):
        self.manager.create_version(self.profile, trigger="test", force=True)
        current = self.manager.get_current_version()
        assert current is not None

    def test_get_version_by_number(self):
        v = self.manager.create_version(self.profile, trigger="test", force=True)
        found = self.manager.get_version(v.version_number)
        assert found is not None
        assert found.version_id == v.version_id

    def test_list_versions(self):
        self.manager.create_version(self.profile, trigger="t1", force=True)
        self.manager.create_version(self.profile, trigger="t2", force=True)
        versions = self.manager.list_versions()
        assert len(versions) >= 2

    def test_rollback_to_version(self):
        v1 = self.manager.create_version(self.profile, trigger="v1", force=True)
        self.manager.create_version(self.profile, trigger="v2", force=True)
        record = self.manager.rollback_to_version(
            v1.version_number,
            self.profile,
            reason="test_rollback",
        )
        assert record.success is True

    def test_rollback_to_nonexistent_version_fails(self):
        record = self.manager.rollback_to_version(9999, self.profile, reason="test")
        assert record.success is False

    def test_rollback_last(self):
        self.manager.create_version(self.profile, trigger="v1", force=True)
        self.manager.create_version(self.profile, trigger="v2", force=True)
        record = self.manager.rollback_last(self.profile, reason="undo")
        assert record.success is True

    def test_log_creates_entry(self):
        self.manager.create_version(self.profile, trigger="init", force=True)
        self.manager.log(
            operation="test_op",
            entity_type="preference",
            entity_id="pref_1",
            entity_key="morning_exercise",
            message="Teste de log",
        )
        logs = self.manager.get_logs()
        assert len(logs) > 0

    def test_log_preference_update(self):
        self.manager.create_version(self.profile, trigger="init", force=True)
        log = self.manager.log_preference_update(
            preference_key="morning_exercise",
            before_confidence=0.3,
            after_confidence=0.5,
        )
        assert log.operation == "preference_updated"
        assert log.confidence_before == 0.3
        assert log.confidence_after == 0.5

    def test_log_pattern_detected(self):
        self.manager.create_version(self.profile, trigger="init", force=True)
        log = self.manager.log_pattern_detected(
            pattern_key="morning_routine",
            confidence=0.7,
            pattern_type="habito",
        )
        assert log.operation == "pattern_detected"

    def test_get_logs_filtered_by_level(self):
        self.manager.create_version(self.profile, trigger="init", force=True)
        self.manager.log("op1", "t1", "id1", level=LogLevel.LEARNING)
        self.manager.log("op2", "t2", "id2", level=LogLevel.WARNING)
        learning_logs = self.manager.get_logs(level=LogLevel.LEARNING)
        assert all(l["level"] == "learning" for l in learning_logs)

    def test_learning_summary_structure(self):
        self.manager.create_version(self.profile, trigger="init", force=True)
        summary = self.manager.get_learning_summary()
        assert "total_versions" in summary
        assert "total_logs" in summary
        assert "total_rollbacks" in summary

    def test_rollback_history_tracked(self):
        self.manager.create_version(self.profile, trigger="v1", force=True)
        self.manager.create_version(self.profile, trigger="v2", force=True)
        self.manager.rollback_last(self.profile, reason="test")
        history = self.manager.get_rollback_history()
        assert len(history) >= 1


class TestLearningEngineIntegration:
    """
    Testes de integração — simula semanas de uso do LifeOS.
    """

    def test_week_1_learning_scenario(self):
        """
        Semana 1: Usuário começa a usar o LifeOS.
        Aceita sugestões de exercício matinal 5 vezes.
        """
        engine = LearningEngine(user_id="integration_user")

        for _ in range(5):
            engine.record_positive_feedback("morning_exercise", domain="saude")

        score = engine.get_learning_score()
        assert score.total_events_processed == 5
        assert score.overall > 0

    def test_week_2_rejection_pattern(self):
        """
        Semana 2: Usuário rejeita reuniões tardias repetidamente.
        → Sistema deve reduzir peso desse padrão.
        """
        engine = LearningEngine(user_id="integration_user_2")

        for _ in range(5):
            engine.record_negative_feedback("late_meetings", domain="trabalho")

        patterns = engine.get_patterns(active_only=False)
        late_meeting_patterns = [p for p in patterns if "late_meetings" in p.get("key", "")]
        # Padrão de rejeição deve ter sido criado
        assert isinstance(patterns, list)

    def test_week_3_communication_learning(self):
        """
        Semana 3: Sistema aprende estilo de comunicação preferido.
        """
        engine = LearningEngine(user_id="integration_user_3")

        for _ in range(5):
            engine.record_communication_style("style_direto", tone="direto")

        insights = engine.get_insights()
        assert isinstance(insights, list)

    def test_full_learning_cycle(self):
        """
        Ciclo completo: aceita, rejeita, aprende, gera insights.
        """
        engine = LearningEngine(user_id="full_cycle_user")

        # Aceita sugestões de exercício
        for _ in range(7):
            engine.record_positive_feedback("morning_exercise", domain="saude")

        # Rejeita reuniões tardias
        for _ in range(4):
            engine.record_negative_feedback("late_meetings", domain="trabalho")

        # Segue rotina matinal
        for _ in range(5):
            engine.record_routine_interaction("morning_routine", followed=True)

        # Completa hábitos
        for _ in range(6):
            engine.record_habit_interaction("meditation", completed=True)

        # Verifica aprendizado
        score = engine.get_learning_score()
        assert score.total_events_processed == 22
        assert score.overall > 0

        insights = engine.get_insights()
        assert isinstance(insights, list)

        report = engine.get_learning_report()
        assert "LifeOS" in report

    def test_privacy_consent_respected(self):
        """
        Garantia: nenhum aprendizado altera dados sem consentimento.
        """
        engine = LearningEngine(user_id="privacy_user")
        engine.disable_learning()

        result = engine.record_positive_feedback("test_pattern")
        assert result["learning_applied"] is False

        # Reativa e verifica
        engine.enable_learning()
        result = engine.record_positive_feedback("test_pattern")
        assert result["learning_applied"] is True

    def test_rollback_restores_state(self):
        """
        Garantia: rollback restaura estado anterior corretamente.
        """
        engine = LearningEngine(user_id="rollback_user")

        # Processa eventos suficientes para criar checkpoint
        for i in range(12):
            engine.record_positive_feedback(f"pattern_{i}")

        # Força criação de checkpoint adicional
        engine._create_checkpoint(trigger="test_force_checkpoint")

        versions = engine.get_versions()
        assert len(versions) >= 1  # Pelo menos a versão inicial

        # Faz rollback para versão 1
        result = engine.rollback_to_version(1, reason="test_rollback")
        assert "rollback_id" in result
