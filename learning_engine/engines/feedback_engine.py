"""
Feedback Engine — Motor de Feedback do LifeOS
==============================================
Processa todos os tipos de feedback do usuário:
- Positivo: usuário aceitou / aprovou / seguiu
- Negativo: usuário rejeitou / ignorou / reverteu
- Implícito: inferido do comportamento sem ação explícita
- Explícito: usuário forneceu feedback direto (rating, texto)

Toda interação gera aprendizado.
"""

from typing import Any, Dict, List, Optional, Tuple
import time
import uuid

from ..models.learning_event import LearningEvent, EventType, FeedbackType
from ..models.preference import Preference, PreferenceCategory
from ..models.pattern import Pattern


class FeedbackEngine:
    """
    Motor de feedback do LifeOS.

    Recebe sinais de interação do usuário e os converte em
    LearningEvents estruturados para alimentar o aprendizado contínuo.

    Princípios:
    - Nenhum aprendizado altera dados sem consentimento.
    - Nenhuma decisão crítica é automatizada sem autorização.
    - Toda interação gera aprendizado, mesmo que mínimo.
    """

    # Pesos dos diferentes tipos de feedback
    FEEDBACK_WEIGHTS = {
        FeedbackType.POSITIVE: 1.0,
        FeedbackType.NEGATIVE: 1.0,
        FeedbackType.EXPLICIT: 1.5,   # Feedback explícito tem maior peso
        FeedbackType.IMPLICIT: 0.4,   # Feedback implícito tem menor peso
        FeedbackType.NEUTRAL:  0.1,
    }

    # Deltas de confiança por tipo de feedback
    CONFIDENCE_DELTAS = {
        FeedbackType.POSITIVE: +0.08,
        FeedbackType.NEGATIVE: -0.10,
        FeedbackType.EXPLICIT: +0.15,  # Pode ser positivo ou negativo
        FeedbackType.IMPLICIT: +0.03,
        FeedbackType.NEUTRAL:   0.00,
    }

    def __init__(self):
        self._event_buffer: List[LearningEvent] = []
        self._session_id: str = str(uuid.uuid4())

    # ------------------------------------------------------------------ #
    #  API PÚBLICA — Registro de Feedback                                  #
    # ------------------------------------------------------------------ #

    def record_positive(
        self,
        pattern_key: str,
        domain: str = "general",
        context: Optional[Dict[str, Any]] = None,
        suggestion_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> LearningEvent:
        """
        Registra feedback positivo.

        Exemplos de uso:
        - Usuário aceitou uma sugestão
        - Usuário seguiu uma rotina recomendada
        - Usuário completou um hábito sugerido

        Args:
            pattern_key: Chave do padrão ou sugestão associada.
            domain: Domínio da interação (saude, financas, etc.).
            context: Dados de contexto adicionais.
            suggestion_id: ID da sugestão aceita.
            tags: Tags para categorização.

        Returns:
            LearningEvent registrado.
        """
        event = LearningEvent(
            event_type=EventType.SUGGESTION_ACCEPTED,
            feedback_type=FeedbackType.POSITIVE,
            domain=domain,
            pattern_key=pattern_key,
            suggestion_id=suggestion_id,
            context=context or {},
            confidence_delta=self.CONFIDENCE_DELTAS[FeedbackType.POSITIVE],
            weight=self.FEEDBACK_WEIGHTS[FeedbackType.POSITIVE],
            tags=tags or [],
            source="user",
            session_id=self._session_id,
        )
        self._buffer_event(event)
        return event

    def record_negative(
        self,
        pattern_key: str,
        domain: str = "general",
        context: Optional[Dict[str, Any]] = None,
        suggestion_id: Optional[str] = None,
        reason: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> LearningEvent:
        """
        Registra feedback negativo.

        Exemplos de uso:
        - Usuário rejeitou uma sugestão repetidamente
        - Usuário reverteu uma decisão
        - Usuário ignorou uma rotina recomendada

        Args:
            pattern_key: Chave do padrão ou sugestão rejeitada.
            domain: Domínio da interação.
            context: Dados de contexto adicionais.
            suggestion_id: ID da sugestão rejeitada.
            reason: Motivo da rejeição (se fornecido).
            tags: Tags para categorização.

        Returns:
            LearningEvent registrado.
        """
        ctx = context or {}
        if reason:
            ctx["rejection_reason"] = reason

        event = LearningEvent(
            event_type=EventType.SUGGESTION_REJECTED,
            feedback_type=FeedbackType.NEGATIVE,
            domain=domain,
            pattern_key=pattern_key,
            suggestion_id=suggestion_id,
            context=ctx,
            confidence_delta=self.CONFIDENCE_DELTAS[FeedbackType.NEGATIVE],
            weight=self.FEEDBACK_WEIGHTS[FeedbackType.NEGATIVE],
            tags=tags or [],
            source="user",
            session_id=self._session_id,
        )
        self._buffer_event(event)
        return event

    def record_implicit(
        self,
        pattern_key: str,
        event_type: EventType,
        domain: str = "general",
        context: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
    ) -> LearningEvent:
        """
        Registra feedback implícito inferido do comportamento.

        Exemplos de uso:
        - Usuário sempre acessa o app às 7h (padrão temporal)
        - Usuário nunca usa determinada funcionalidade (evitação)
        - Usuário completa tarefas em sequência específica

        Args:
            pattern_key: Chave do padrão inferido.
            event_type: Tipo de evento comportamental.
            domain: Domínio da interação.
            context: Dados de contexto adicionais.
            tags: Tags para categorização.

        Returns:
            LearningEvent registrado.
        """
        event = LearningEvent(
            event_type=event_type,
            feedback_type=FeedbackType.IMPLICIT,
            domain=domain,
            pattern_key=pattern_key,
            context=context or {},
            confidence_delta=self.CONFIDENCE_DELTAS[FeedbackType.IMPLICIT],
            weight=self.FEEDBACK_WEIGHTS[FeedbackType.IMPLICIT],
            tags=tags or ["implicit"],
            source="inferred",
            session_id=self._session_id,
        )
        self._buffer_event(event)
        return event

    def record_explicit(
        self,
        pattern_key: str,
        domain: str = "general",
        rating: Optional[float] = None,   # 0.0 a 1.0
        note: Optional[str] = None,
        is_positive: bool = True,
        context: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
    ) -> LearningEvent:
        """
        Registra feedback explícito fornecido diretamente pelo usuário.

        Exemplos de uso:
        - Usuário deu 5 estrelas para uma recomendação
        - Usuário escreveu "Isso não funciona para mim"
        - Usuário clicou em "Gostei" / "Não gostei"

        Args:
            pattern_key: Chave do padrão avaliado.
            domain: Domínio da interação.
            rating: Nota de 0.0 a 1.0 (opcional).
            note: Texto do feedback (opcional).
            is_positive: Se o feedback é positivo ou negativo.
            context: Dados de contexto adicionais.
            tags: Tags para categorização.

        Returns:
            LearningEvent registrado.
        """
        # Calcula delta baseado no rating ou na polaridade
        if rating is not None:
            delta = (rating - 0.5) * 2 * abs(self.CONFIDENCE_DELTAS[FeedbackType.EXPLICIT])
        else:
            delta = self.CONFIDENCE_DELTAS[FeedbackType.EXPLICIT] if is_positive else -abs(self.CONFIDENCE_DELTAS[FeedbackType.EXPLICIT])

        ctx = context or {}
        if rating is not None:
            ctx["rating"] = rating

        event = LearningEvent(
            event_type=EventType.EXPLICIT_FEEDBACK,
            feedback_type=FeedbackType.EXPLICIT,
            domain=domain,
            pattern_key=pattern_key,
            context=ctx,
            confidence_delta=delta,
            weight=self.FEEDBACK_WEIGHTS[FeedbackType.EXPLICIT],
            tags=tags or ["explicit"],
            source="user",
            user_note=note,
            session_id=self._session_id,
        )
        self._buffer_event(event)
        return event

    def record_routine_interaction(
        self,
        routine_key: str,
        followed: bool,
        domain: str = "produtividade",
        context: Optional[Dict[str, Any]] = None,
    ) -> LearningEvent:
        """Registra interação com uma rotina (seguiu ou pulou)."""
        event_type = EventType.ROUTINE_FOLLOWED if followed else EventType.ROUTINE_SKIPPED
        feedback_type = FeedbackType.POSITIVE if followed else FeedbackType.NEGATIVE
        delta = self.CONFIDENCE_DELTAS[feedback_type]

        event = LearningEvent(
            event_type=event_type,
            feedback_type=feedback_type,
            domain=domain,
            pattern_key=routine_key,
            context=context or {},
            confidence_delta=delta,
            weight=0.8,
            tags=["routine"],
            source="system",
            session_id=self._session_id,
        )
        self._buffer_event(event)
        return event

    def record_habit_interaction(
        self,
        habit_key: str,
        completed: bool,
        domain: str = "habitos",
        context: Optional[Dict[str, Any]] = None,
    ) -> LearningEvent:
        """Registra interação com um hábito (completou ou não)."""
        event_type = EventType.HABIT_COMPLETED if completed else EventType.HABIT_MISSED
        feedback_type = FeedbackType.POSITIVE if completed else FeedbackType.IMPLICIT

        event = LearningEvent(
            event_type=event_type,
            feedback_type=feedback_type,
            domain=domain,
            pattern_key=habit_key,
            context=context or {},
            confidence_delta=self.CONFIDENCE_DELTAS[feedback_type],
            weight=0.9,
            tags=["habit"],
            source="system",
            session_id=self._session_id,
        )
        self._buffer_event(event)
        return event

    def record_communication_style(
        self,
        style_key: str,
        tone: str,
        domain: str = "comunicacao",
        context: Optional[Dict[str, Any]] = None,
    ) -> LearningEvent:
        """Registra preferência de estilo de comunicação."""
        event = LearningEvent(
            event_type=EventType.COMMUNICATION_STYLE,
            feedback_type=FeedbackType.IMPLICIT,
            domain=domain,
            pattern_key=style_key,
            context={**(context or {}), "tone": tone},
            confidence_delta=self.CONFIDENCE_DELTAS[FeedbackType.IMPLICIT],
            weight=0.6,
            tags=["communication", "tone", tone],
            source="inferred",
            session_id=self._session_id,
        )
        self._buffer_event(event)
        return event

    # ------------------------------------------------------------------ #
    #  Análise de Padrões de Feedback                                      #
    # ------------------------------------------------------------------ #

    def analyze_rejection_pattern(
        self,
        pattern_key: str,
        threshold: int = 3,
    ) -> Tuple[bool, int]:
        """
        Verifica se há padrão de rejeição repetida.

        Se o usuário rejeita o mesmo padrão N vezes consecutivas,
        o sistema deve reduzir o peso desse padrão.

        Args:
            pattern_key: Chave do padrão a verificar.
            threshold: Número de rejeições para considerar padrão.

        Returns:
            Tuple (is_rejection_pattern, rejection_count)
        """
        rejections = [
            e for e in self._event_buffer
            if e.pattern_key == pattern_key
            and e.feedback_type == FeedbackType.NEGATIVE
        ]
        count = len(rejections)
        return count >= threshold, count

    def analyze_acceptance_pattern(
        self,
        pattern_key: str,
        threshold: int = 3,
    ) -> Tuple[bool, int]:
        """
        Verifica se há padrão de aceitação consistente.

        Se o usuário aceita o mesmo padrão N vezes,
        o sistema deve aumentar a confiança desse padrão.

        Args:
            pattern_key: Chave do padrão a verificar.
            threshold: Número de aceitações para considerar padrão.

        Returns:
            Tuple (is_acceptance_pattern, acceptance_count)
        """
        acceptances = [
            e for e in self._event_buffer
            if e.pattern_key == pattern_key
            and e.feedback_type in (FeedbackType.POSITIVE, FeedbackType.EXPLICIT)
        ]
        count = len(acceptances)
        return count >= threshold, count

    def get_feedback_summary(self) -> Dict[str, Any]:
        """Retorna resumo do feedback coletado na sessão."""
        total = len(self._event_buffer)
        if total == 0:
            return {"total": 0, "session_id": self._session_id}

        by_type = {}
        for ft in FeedbackType:
            count = sum(1 for e in self._event_buffer if e.feedback_type == ft)
            if count > 0:
                by_type[ft.value] = count

        by_domain = {}
        for e in self._event_buffer:
            by_domain[e.domain] = by_domain.get(e.domain, 0) + 1

        return {
            "session_id": self._session_id,
            "total_events": total,
            "by_feedback_type": by_type,
            "by_domain": by_domain,
            "positive_ratio": by_type.get("positive", 0) / total,
            "negative_ratio": by_type.get("negative", 0) / total,
        }

    def flush_events(self) -> List[LearningEvent]:
        """Retorna e limpa o buffer de eventos."""
        events = list(self._event_buffer)
        self._event_buffer.clear()
        return events

    def get_buffered_events(self) -> List[LearningEvent]:
        """Retorna os eventos no buffer sem limpar."""
        return list(self._event_buffer)

    # ------------------------------------------------------------------ #
    #  Privado                                                             #
    # ------------------------------------------------------------------ #

    def _buffer_event(self, event: LearningEvent) -> None:
        """Adiciona evento ao buffer interno."""
        self._event_buffer.append(event)
