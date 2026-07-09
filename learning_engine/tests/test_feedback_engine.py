"""
Testes do Feedback Engine — SPRINT 026
"""
import pytest
import sys
sys.path.insert(0, '/home/ubuntu/Project-X')

from learning_engine.engines.feedback_engine import FeedbackEngine
from learning_engine.models.learning_event import FeedbackType, EventType


class TestFeedbackEngine:
    def setup_method(self):
        self.engine = FeedbackEngine()

    # ------------------------------------------------------------------ #
    #  Feedback Positivo                                                   #
    # ------------------------------------------------------------------ #

    def test_record_positive_returns_event(self):
        event = self.engine.record_positive("morning_exercise", domain="saude")
        assert event is not None
        assert event.feedback_type == FeedbackType.POSITIVE
        assert event.pattern_key == "morning_exercise"
        assert event.domain == "saude"

    def test_positive_event_has_positive_learning_signal(self):
        event = self.engine.record_positive("morning_exercise")
        assert event.learning_signal() > 0

    def test_positive_event_has_correct_weight(self):
        event = self.engine.record_positive("test_pattern")
        assert event.weight == FeedbackEngine.FEEDBACK_WEIGHTS[FeedbackType.POSITIVE]

    def test_positive_event_has_positive_confidence_delta(self):
        event = self.engine.record_positive("test_pattern")
        assert event.confidence_delta > 0

    # ------------------------------------------------------------------ #
    #  Feedback Negativo                                                   #
    # ------------------------------------------------------------------ #

    def test_record_negative_returns_event(self):
        event = self.engine.record_negative("late_meetings", domain="trabalho")
        assert event is not None
        assert event.feedback_type == FeedbackType.NEGATIVE
        assert event.pattern_key == "late_meetings"

    def test_negative_event_has_negative_learning_signal(self):
        event = self.engine.record_negative("late_meetings")
        assert event.learning_signal() < 0

    def test_negative_event_stores_reason(self):
        event = self.engine.record_negative("late_meetings", reason="Muito cansativo")
        assert "rejection_reason" in event.context
        assert event.context["rejection_reason"] == "Muito cansativo"

    def test_negative_event_has_negative_confidence_delta(self):
        event = self.engine.record_negative("test_pattern")
        assert event.confidence_delta < 0

    # ------------------------------------------------------------------ #
    #  Feedback Implícito                                                  #
    # ------------------------------------------------------------------ #

    def test_record_implicit_returns_event(self):
        event = self.engine.record_implicit(
            "morning_routine",
            EventType.ROUTINE_FOLLOWED,
            domain="produtividade",
        )
        assert event is not None
        assert event.feedback_type == FeedbackType.IMPLICIT
        assert event.source == "inferred"

    def test_implicit_event_has_lower_weight(self):
        event = self.engine.record_implicit("test", EventType.ROUTINE_FOLLOWED)
        assert event.weight < FeedbackEngine.FEEDBACK_WEIGHTS[FeedbackType.POSITIVE]

    def test_implicit_event_has_implicit_tag(self):
        event = self.engine.record_implicit("test", EventType.HABIT_COMPLETED)
        assert "implicit" in event.tags

    # ------------------------------------------------------------------ #
    #  Feedback Explícito                                                  #
    # ------------------------------------------------------------------ #

    def test_record_explicit_with_rating(self):
        event = self.engine.record_explicit("suggestion_x", rating=0.9, is_positive=True)
        assert event is not None
        assert event.feedback_type == FeedbackType.EXPLICIT
        assert event.context.get("rating") == 0.9

    def test_record_explicit_with_note(self):
        event = self.engine.record_explicit("suggestion_x", note="Ótima sugestão!")
        assert event.user_note == "Ótima sugestão!"

    def test_explicit_event_has_higher_weight(self):
        event = self.engine.record_explicit("test")
        assert event.weight == FeedbackEngine.FEEDBACK_WEIGHTS[FeedbackType.EXPLICIT]

    def test_explicit_negative_has_negative_delta(self):
        event = self.engine.record_explicit("test", is_positive=False)
        assert event.confidence_delta < 0

    # ------------------------------------------------------------------ #
    #  Análise de Padrões                                                  #
    # ------------------------------------------------------------------ #

    def test_rejection_pattern_detected_after_threshold(self):
        for _ in range(3):
            self.engine.record_negative("late_meetings")
        is_pattern, count = self.engine.analyze_rejection_pattern("late_meetings", threshold=3)
        assert is_pattern is True
        assert count == 3

    def test_rejection_pattern_not_detected_below_threshold(self):
        for _ in range(2):
            self.engine.record_negative("late_meetings")
        is_pattern, count = self.engine.analyze_rejection_pattern("late_meetings", threshold=3)
        assert is_pattern is False

    def test_acceptance_pattern_detected_after_threshold(self):
        for _ in range(3):
            self.engine.record_positive("morning_exercise")
        is_pattern, count = self.engine.analyze_acceptance_pattern("morning_exercise", threshold=3)
        assert is_pattern is True
        assert count == 3

    # ------------------------------------------------------------------ #
    #  Buffer e Sessão                                                     #
    # ------------------------------------------------------------------ #

    def test_events_buffered(self):
        self.engine.record_positive("p1")
        self.engine.record_negative("p2")
        self.engine.record_implicit("p3", EventType.ROUTINE_FOLLOWED)
        events = self.engine.get_buffered_events()
        assert len(events) == 3

    def test_flush_clears_buffer(self):
        self.engine.record_positive("p1")
        self.engine.record_positive("p2")
        events = self.engine.flush_events()
        assert len(events) == 2
        assert len(self.engine.get_buffered_events()) == 0

    def test_feedback_summary(self):
        self.engine.record_positive("p1")
        self.engine.record_negative("p2")
        summary = self.engine.get_feedback_summary()
        assert summary["total_events"] == 2
        assert "positive" in summary["by_feedback_type"]
        assert "negative" in summary["by_feedback_type"]

    # ------------------------------------------------------------------ #
    #  Interações Especializadas                                           #
    # ------------------------------------------------------------------ #

    def test_routine_followed_is_positive(self):
        event = self.engine.record_routine_interaction("morning_routine", followed=True)
        assert event.feedback_type == FeedbackType.POSITIVE
        assert event.event_type == EventType.ROUTINE_FOLLOWED

    def test_routine_skipped_is_negative(self):
        event = self.engine.record_routine_interaction("morning_routine", followed=False)
        assert event.feedback_type == FeedbackType.NEGATIVE
        assert event.event_type == EventType.ROUTINE_SKIPPED

    def test_habit_completed_is_positive(self):
        event = self.engine.record_habit_interaction("exercise", completed=True)
        assert event.feedback_type == FeedbackType.POSITIVE

    def test_communication_style_recorded(self):
        event = self.engine.record_communication_style("style_1", tone="direto")
        assert "tone" in event.context
        assert event.context["tone"] == "direto"
