"""
Testes do Preference Engine — SPRINT 026
"""
import pytest
import sys
sys.path.insert(0, '/home/ubuntu/Project-X')

from learning_engine.engines.preference_engine import PreferenceEngine
from learning_engine.models.learning_event import LearningEvent, EventType, FeedbackType
from learning_engine.models.preference import Preference, PreferenceCategory
from learning_engine.models.learning_profile import LearningProfile


def make_positive_event(pattern_key: str, domain: str = "saude") -> LearningEvent:
    return LearningEvent(
        event_type=EventType.SUGGESTION_ACCEPTED,
        feedback_type=FeedbackType.POSITIVE,
        domain=domain,
        pattern_key=pattern_key,
        confidence_delta=0.08,
        weight=1.0,
    )


def make_negative_event(pattern_key: str, domain: str = "saude") -> LearningEvent:
    return LearningEvent(
        event_type=EventType.SUGGESTION_REJECTED,
        feedback_type=FeedbackType.NEGATIVE,
        domain=domain,
        pattern_key=pattern_key,
        confidence_delta=-0.10,
        weight=1.0,
    )


class TestPreferenceEngine:
    def setup_method(self):
        self.engine = PreferenceEngine()
        self.profile = LearningProfile(user_id="test_user")
        self.engine.set_profile(self.profile)

    # ------------------------------------------------------------------ #
    #  Aprendizado de Preferências                                         #
    # ------------------------------------------------------------------ #

    def test_learn_from_positive_event_creates_preference(self):
        event = make_positive_event("morning_exercise")
        pref = self.engine.learn_from_event(event)
        assert pref is not None
        assert pref.positive_signals == 1
        assert pref.evidence_count == 1

    def test_learn_from_negative_event_creates_preference(self):
        event = make_negative_event("late_meetings")
        pref = self.engine.learn_from_event(event)
        assert pref is not None
        assert pref.negative_signals == 1

    def test_multiple_positive_events_increase_confidence(self):
        for _ in range(5):
            self.engine.learn_from_event(make_positive_event("morning_exercise"))
        pref = self.engine.get_preference("saude_morning_exercise")
        assert pref is not None
        assert pref.confidence > 0.0
        assert pref.evidence_count == 5

    def test_multiple_negative_events_keep_confidence_low(self):
        for _ in range(5):
            self.engine.learn_from_event(make_negative_event("late_meetings"))
        pref = self.engine.get_preference("saude_late_meetings")
        assert pref is not None
        # Confiança deve ser baixa ou zero após muitas rejeições
        assert pref.confidence <= 0.5

    def test_learn_from_events_batch(self):
        events = [make_positive_event(f"pattern_{i}") for i in range(3)]
        prefs = self.engine.learn_from_events(events)
        assert len(prefs) == 3

    # ------------------------------------------------------------------ #
    #  Preferências Explícitas                                             #
    # ------------------------------------------------------------------ #

    def test_express_preference_creates_confirmed(self):
        pref = self.engine.express_preference(
            key="wake_up_time",
            value="06:30",
            category=PreferenceCategory.HORARIO,
            domain="horarios",
            label="Horário de despertar",
        )
        assert pref is not None
        assert pref.is_confirmed is True
        assert pref.value == "06:30"
        assert pref.confidence >= 0.25

    def test_express_preference_has_high_confidence(self):
        pref = self.engine.express_preference(
            key="preferred_tone",
            value="direto",
            category=PreferenceCategory.TOM,
        )
        assert pref.confidence > 0.2

    # ------------------------------------------------------------------ #
    #  Lock/Unlock de Preferências                                         #
    # ------------------------------------------------------------------ #

    def test_lock_preference_prevents_update(self):
        # Cria preferência
        pref = self.engine.express_preference(
            key="wake_up_time",
            value="06:30",
            category=PreferenceCategory.HORARIO,
        )
        original_confidence = pref.confidence
        # Bloqueia
        self.engine.lock_preference("wake_up_time")
        # Tenta atualizar via evento
        event = make_positive_event("wake_up_time", domain="horarios")
        event.confidence_delta = 0.5
        # A preferência bloqueada não deve ser alterada pelo update_confidence
        pref.update_confidence(0.5)  # Deve ser ignorado
        assert pref.confidence == original_confidence

    def test_unlock_preference_allows_update(self):
        pref = self.engine.express_preference(
            key="test_pref",
            value="value",
            category=PreferenceCategory.ROTINA,
        )
        self.engine.lock_preference("test_pref")
        self.engine.unlock_preference("test_pref")
        assert pref.is_locked is False

    def test_lock_nonexistent_preference_returns_false(self):
        result = self.engine.lock_preference("nonexistent_key")
        assert result is False

    # ------------------------------------------------------------------ #
    #  Consultas                                                           #
    # ------------------------------------------------------------------ #

    def test_get_preferences_by_category(self):
        self.engine.express_preference("wake_up", "06:30", PreferenceCategory.HORARIO)
        self.engine.express_preference("sleep_time", "22:00", PreferenceCategory.HORARIO)
        self.engine.express_preference("exercise", "daily", PreferenceCategory.HABITO)
        horarios = self.engine.get_preferences_by_category(PreferenceCategory.HORARIO)
        assert len(horarios) == 2
        assert all(p.category == PreferenceCategory.HORARIO for p in horarios)

    def test_get_preferences_by_domain(self):
        self.engine.express_preference("p1", "v1", PreferenceCategory.ROTINA, domain="saude")
        self.engine.express_preference("p2", "v2", PreferenceCategory.ROTINA, domain="financas")
        saude_prefs = self.engine.get_preferences_by_domain("saude")
        assert all(p.domain == "saude" for p in saude_prefs)

    def test_get_high_confidence_preferences(self):
        # Cria preferência com alta confiança
        pref = self.engine.express_preference("high_conf", "value", PreferenceCategory.ROTINA)
        # Aumenta confiança manualmente para teste
        pref.confidence = 0.8
        high_conf = self.engine.get_high_confidence_preferences(min_confidence=0.7)
        assert any(p.key == "high_conf" for p in high_conf)

    # ------------------------------------------------------------------ #
    #  Learning Score                                                      #
    # ------------------------------------------------------------------ #

    def test_compute_learning_score_returns_score(self):
        score = self.engine.compute_learning_score(total_events=10)
        assert score is not None
        assert 0.0 <= score.overall <= 100.0

    def test_learning_score_increases_with_more_events(self):
        score_1 = self.engine.compute_learning_score(total_events=5)
        # Adiciona mais preferências
        for i in range(10):
            self.engine.express_preference(f"pref_{i}", f"val_{i}", PreferenceCategory.ROTINA)
        score_2 = self.engine.compute_learning_score(total_events=50)
        assert score_2.overall >= score_1.overall

    def test_learning_score_level_labels(self):
        from learning_engine.models.learning_profile import LearningScore
        score = LearningScore()
        score.overall = 85.0
        assert "Especialista" in score.level()
        score.overall = 65.0
        assert "Avançado" in score.level()
        score.overall = 45.0
        assert "Intermediário" in score.level()
        score.overall = 25.0
        assert "Iniciante" in score.level()
        score.overall = 5.0
        assert "Novo" in score.level()

    # ------------------------------------------------------------------ #
    #  Confidence Evolution                                                #
    # ------------------------------------------------------------------ #

    def test_confidence_evolution_tracked(self):
        pref = self.engine.express_preference("test", "v1", PreferenceCategory.ROTINA)
        pref.update_confidence(0.1)
        pref.update_confidence(0.1)
        evolution = self.engine.get_confidence_evolution("test")
        assert len(evolution) >= 1  # Pelo menos um snapshot

    # ------------------------------------------------------------------ #
    #  Insights para o Usuário                                             #
    # ------------------------------------------------------------------ #

    def test_generate_user_insights_returns_list(self):
        # Cria preferência com confiança suficiente
        pref = self.engine.express_preference("morning_routine", "7h", PreferenceCategory.ROTINA)
        pref.confidence = 0.6  # Acima do threshold
        insights = self.engine.generate_user_insights()
        assert isinstance(insights, list)

    def test_insight_contains_lifeos_message(self):
        pref = self.engine.express_preference("wake_up", "06:30", PreferenceCategory.HORARIO)
        pref.confidence = 0.7
        insights = self.engine.generate_user_insights()
        if insights:
            assert "LifeOS" in insights[0]["insight"]

    def test_format_learning_report_returns_string(self):
        report = self.engine.format_learning_report()
        assert isinstance(report, str)
        assert len(report) > 0

    def test_format_learning_report_with_preferences(self):
        pref = self.engine.express_preference("morning_exercise", "diário", PreferenceCategory.HABITO)
        pref.confidence = 0.7
        report = self.engine.format_learning_report()
        assert "LifeOS" in report

    # ------------------------------------------------------------------ #
    #  Preferência History                                                 #
    # ------------------------------------------------------------------ #

    def test_preference_history_tracks_changes(self):
        pref = self.engine.express_preference("test", "v1", PreferenceCategory.ROTINA)
        pref.update_confidence(0.1, event_id="evt_1")
        pref.update_confidence(0.1, event_id="evt_2")
        history = self.engine.get_preference_history("test")
        assert history is not None
        assert len(history.snapshots) >= 1

    def test_preference_history_confidence_trend(self):
        pref = self.engine.express_preference("test", "v1", PreferenceCategory.ROTINA)
        pref.update_confidence(0.1)
        pref.update_confidence(0.1)
        history = pref.history
        trend = history.confidence_trend()
        assert isinstance(trend, list)
