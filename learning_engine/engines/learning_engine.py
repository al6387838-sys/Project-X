"""
Learning Engine — Núcleo do Sistema de Aprendizado Contínuo
============================================================
O motor central do Continuous Learning Engine do LifeOS.

Orquestra todos os componentes:
- FeedbackEngine: Coleta e processa feedback
- BehaviorAnalyzer: Analisa comportamento
- PatternDetector: Detecta padrões
- PreferenceEngine: Aprende preferências
- VersionManager: Versiona e permite rollback

Toda interação gera aprendizado.
O sistema aprende sem necessidade de treinamento manual.
"""

from typing import Any, Dict, List, Optional
import time

from .feedback_engine import FeedbackEngine
from .pattern_detector import PatternDetector
from .preference_engine import PreferenceEngine
from ..analyzers.behavior_analyzer import BehaviorAnalyzer
from ..managers.version_manager import VersionManager
from ..models.learning_event import LearningEvent, EventType, FeedbackType
from ..models.learning_profile import LearningProfile, LearningScore
from ..models.model_version import LogLevel


class LearningEngine:
    """
    Motor central de aprendizado contínuo do LifeOS.

    O LearningEngine é o ponto de entrada único para todo o aprendizado.
    Ele recebe interações do usuário, as processa através de todos os
    componentes especializados, e mantém o modelo de aprendizado atualizado.

    Uso básico:
        engine = LearningEngine(user_id="user_123")
        engine.record_positive_feedback(
            pattern_key="morning_exercise",
            domain="saude",
        )
        insights = engine.get_insights()

    Princípios de segurança:
    - Nenhum aprendizado altera dados sem consentimento.
    - Nenhuma decisão crítica é automatizada sem autorização.
    - Todo aprendizado é auditável e reversível.
    """

    # Número de eventos para acionar criação de nova versão
    VERSION_TRIGGER_EVENTS = 10

    def __init__(
        self,
        user_id: str = "default",
        profile: Optional[LearningProfile] = None,
    ):
        self.user_id = user_id

        # Inicializa ou carrega o perfil
        self._profile = profile or LearningProfile(user_id=user_id)

        # Inicializa todos os componentes
        self._feedback_engine = FeedbackEngine()
        self._behavior_analyzer = BehaviorAnalyzer()
        self._pattern_detector = PatternDetector(behavior_analyzer=self._behavior_analyzer)
        self._preference_engine = PreferenceEngine()
        self._version_manager = VersionManager()

        # Associa perfil ao preference engine
        self._preference_engine.set_profile(self._profile)

        # Contadores internos
        self._total_events_processed: int = 0
        self._events_since_last_version: int = 0
        self._session_start: float = time.time()

        # Cria versão inicial
        self._version_manager.create_version(
            profile=self._profile,
            trigger="initialization",
            changes=["Inicialização do Learning Engine"],
            force=True,
        )

    # ------------------------------------------------------------------ #
    #  API Principal — Registro de Interações                              #
    # ------------------------------------------------------------------ #

    def record_interaction(
        self,
        event_type: EventType,
        feedback_type: FeedbackType,
        pattern_key: str,
        domain: str = "general",
        context: Optional[Dict[str, Any]] = None,
        suggestion_id: Optional[str] = None,
        user_note: Optional[str] = None,
        tags: Optional[List[str]] = None,
        weight: float = 1.0,
    ) -> Dict[str, Any]:
        """
        Registra uma interação do usuário e gera aprendizado.

        Este é o método principal do Learning Engine.
        Toda interação com o LifeOS deve passar por aqui.

        Args:
            event_type: Tipo do evento.
            feedback_type: Tipo de feedback.
            pattern_key: Chave do padrão/sugestão.
            domain: Domínio da interação.
            context: Dados de contexto adicionais.
            suggestion_id: ID da sugestão relacionada.
            user_note: Nota do usuário (feedback explícito).
            tags: Tags para categorização.
            weight: Peso do evento no aprendizado.

        Returns:
            Dicionário com resultado do aprendizado.
        """
        event = LearningEvent(
            event_type=event_type,
            feedback_type=feedback_type,
            domain=domain,
            pattern_key=pattern_key,
            suggestion_id=suggestion_id,
            context=context or {},
            weight=weight,
            tags=tags or [],
            source="user",
            user_note=user_note,
        )
        return self._process_event(event)

    def record_positive_feedback(
        self,
        pattern_key: str,
        domain: str = "general",
        context: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Atalho para registrar feedback positivo."""
        event = self._feedback_engine.record_positive(
            pattern_key=pattern_key,
            domain=domain,
            context=context,
            **kwargs,
        )
        return self._process_event(event)

    def record_negative_feedback(
        self,
        pattern_key: str,
        domain: str = "general",
        context: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Atalho para registrar feedback negativo."""
        event = self._feedback_engine.record_negative(
            pattern_key=pattern_key,
            domain=domain,
            context=context,
            reason=reason,
            **kwargs,
        )
        return self._process_event(event)

    def record_implicit_behavior(
        self,
        pattern_key: str,
        event_type: EventType,
        domain: str = "general",
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Atalho para registrar comportamento implícito."""
        event = self._feedback_engine.record_implicit(
            pattern_key=pattern_key,
            event_type=event_type,
            domain=domain,
            context=context,
        )
        return self._process_event(event)

    def record_explicit_feedback(
        self,
        pattern_key: str,
        domain: str = "general",
        rating: Optional[float] = None,
        note: Optional[str] = None,
        is_positive: bool = True,
    ) -> Dict[str, Any]:
        """Atalho para registrar feedback explícito."""
        event = self._feedback_engine.record_explicit(
            pattern_key=pattern_key,
            domain=domain,
            rating=rating,
            note=note,
            is_positive=is_positive,
        )
        return self._process_event(event)

    def record_routine_interaction(
        self,
        routine_key: str,
        followed: bool,
        domain: str = "produtividade",
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Registra interação com rotina."""
        event = self._feedback_engine.record_routine_interaction(
            routine_key=routine_key,
            followed=followed,
            domain=domain,
            context=context,
        )
        return self._process_event(event)

    def record_habit_interaction(
        self,
        habit_key: str,
        completed: bool,
        domain: str = "habitos",
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Registra interação com hábito."""
        event = self._feedback_engine.record_habit_interaction(
            habit_key=habit_key,
            completed=completed,
            domain=domain,
            context=context,
        )
        return self._process_event(event)

    def record_communication_style(
        self,
        style_key: str,
        tone: str,
        domain: str = "comunicacao",
    ) -> Dict[str, Any]:
        """Registra preferência de estilo de comunicação."""
        event = self._feedback_engine.record_communication_style(
            style_key=style_key,
            tone=tone,
            domain=domain,
        )
        return self._process_event(event)

    # ------------------------------------------------------------------ #
    #  Processamento de Eventos                                            #
    # ------------------------------------------------------------------ #

    def _process_event(self, event: LearningEvent) -> Dict[str, Any]:
        """
        Processa um evento através de todos os componentes.

        Pipeline de aprendizado:
        1. Ingere no BehaviorAnalyzer
        2. Detecta padrões via PatternDetector
        3. Aprende preferências via PreferenceEngine
        4. Atualiza logs via VersionManager
        5. Cria nova versão se necessário
        """
        if not self._profile.learning_enabled:
            return {
                "event_id": event.event_id,
                "learning_applied": False,
                "reason": "learning_disabled",
            }

        self._total_events_processed += 1
        self._events_since_last_version += 1

        if self._profile.first_event_at is None:
            self._profile.first_event_at = event.timestamp
        self._profile.last_event_at = event.timestamp
        self._profile.total_events += 1

        # 1. Analisa comportamento
        self._behavior_analyzer.ingest_single(event)

        # 2. Detecta padrões
        updated_patterns = self._pattern_detector.process_single_event(event)

        # 3. Aprende preferências
        preference = self._preference_engine.learn_from_event(event)

        # 4. Aprende com padrões detectados
        if updated_patterns:
            self._preference_engine.learn_from_patterns(updated_patterns)

        # 5. Registra no log
        self._version_manager.log(
            operation=f"event_{event.event_type.value}",
            entity_type="learning_event",
            entity_id=event.event_id,
            entity_key=event.pattern_key,
            after_value=event.to_dict(),
            confidence_after=event.confidence_delta,
            trigger_event_id=event.event_id,
            message=(
                f"Evento processado: {event.event_type.value} | "
                f"{event.feedback_type.value} | {event.domain}"
            ),
            level=LogLevel.LEARNING,
        )

        # 6. Cria nova versão se necessário
        if self._events_since_last_version >= self.VERSION_TRIGGER_EVENTS:
            self._create_checkpoint(
                trigger=f"auto_checkpoint_{self._total_events_processed}_events"
            )
            self._events_since_last_version = 0

        # 7. Atualiza Learning Score
        score = self._preference_engine.compute_learning_score(
            total_events=self._total_events_processed
        )

        return {
            "event_id": event.event_id,
            "learning_applied": True,
            "preference_updated": preference.key if preference else None,
            "patterns_updated": [p.key for p in updated_patterns] if updated_patterns else [],
            "learning_score": score.overall,
            "total_events_processed": self._total_events_processed,
        }

    def _create_checkpoint(self, trigger: str = "auto_checkpoint") -> None:
        """Cria um checkpoint de versão."""
        score = self._preference_engine.compute_learning_score(self._total_events_processed)
        changes = [
            f"Processados {self._total_events_processed} eventos no total",
            f"Learning Score: {score.overall:.1f}",
            f"Preferências aprendidas: {len(self._profile.preferences)}",
        ]
        self._version_manager.create_version(
            profile=self._profile,
            trigger=trigger,
            changes=changes,
        )

    # ------------------------------------------------------------------ #
    #  Consultas e Insights                                                #
    # ------------------------------------------------------------------ #

    def get_insights(self, max_insights: int = 10) -> List[Dict[str, Any]]:
        """
        Retorna insights sobre o que o LifeOS aprendeu.
        Formato: "O LifeOS aprendeu isto sobre você."
        """
        return self._preference_engine.generate_user_insights(max_insights)

    def get_learning_report(self) -> str:
        """Retorna relatório de aprendizado formatado para o usuário."""
        return self._preference_engine.format_learning_report()

    def get_learning_score(self) -> LearningScore:
        """Retorna o Learning Score atual."""
        return self._preference_engine.compute_learning_score(self._total_events_processed)

    def get_behavior_report(self) -> Dict[str, Any]:
        """Retorna relatório completo de comportamento."""
        return self._behavior_analyzer.generate_behavior_report()

    def get_patterns(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Retorna todos os padrões detectados."""
        patterns = self._pattern_detector.get_all_patterns(active_only=active_only)
        return [p.to_dict() for p in patterns]

    def get_strong_patterns(self, min_confidence: float = 0.6) -> List[Dict[str, Any]]:
        """Retorna padrões com alta confiança."""
        patterns = self._pattern_detector.get_strong_patterns(min_confidence)
        return [p.to_dict() for p in patterns]

    def get_profile_summary(self) -> Dict[str, Any]:
        """Retorna resumo do perfil de aprendizado."""
        return self._profile.summary()

    def get_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retorna logs de aprendizado."""
        return self._version_manager.get_logs(limit=limit)

    def get_versions(self) -> List[Dict[str, Any]]:
        """Retorna histórico de versões do modelo."""
        return self._version_manager.list_versions()

    # ------------------------------------------------------------------ #
    #  Rollback                                                            #
    # ------------------------------------------------------------------ #

    def rollback_to_version(
        self,
        version_number: int,
        reason: str = "user_request",
    ) -> Dict[str, Any]:
        """
        Reverte o modelo para uma versão anterior.
        REQUER iniciativa do usuário. Nunca automático.
        """
        record = self._version_manager.rollback_to_version(
            version_number=version_number,
            profile=self._profile,
            reason=reason,
            initiated_by="user",
        )
        self._preference_engine.set_profile(self._profile)
        return record.to_dict()

    def rollback_last(self, reason: str = "undo_last_learning") -> Dict[str, Any]:
        """Desfaz o último aprendizado."""
        record = self._version_manager.rollback_last(
            profile=self._profile,
            reason=reason,
        )
        self._preference_engine.set_profile(self._profile)
        return record.to_dict()

    # ------------------------------------------------------------------ #
    #  Controle de Privacidade e Consentimento                             #
    # ------------------------------------------------------------------ #

    def disable_learning(self) -> None:
        """Desativa o aprendizado automático."""
        self._profile.learning_enabled = False
        self._version_manager.log(
            operation="learning_disabled",
            entity_type="profile",
            entity_id=self._profile.profile_id,
            entity_key="learning_enabled",
            before_value=True,
            after_value=False,
            message="Aprendizado automático desativado pelo usuário.",
            level=LogLevel.CONSENT,
        )

    def enable_learning(self) -> None:
        """Reativa o aprendizado automático."""
        self._profile.learning_enabled = True
        self._version_manager.log(
            operation="learning_enabled",
            entity_type="profile",
            entity_id=self._profile.profile_id,
            entity_key="learning_enabled",
            before_value=False,
            after_value=True,
            message="Aprendizado automático reativado pelo usuário.",
            level=LogLevel.CONSENT,
        )

    def lock_preference(self, preference_key: str) -> bool:
        """Bloqueia uma preferência."""
        return self._preference_engine.lock_preference(preference_key)

    def unlock_preference(self, preference_key: str) -> bool:
        """Desbloqueia uma preferência."""
        return self._preference_engine.unlock_preference(preference_key)

    def get_full_status(self) -> Dict[str, Any]:
        """Retorna status completo do Learning Engine."""
        score = self.get_learning_score()
        return {
            "user_id": self.user_id,
            "learning_enabled": self._profile.learning_enabled,
            "total_events_processed": self._total_events_processed,
            "learning_score": score.to_dict(),
            "pattern_summary": self._pattern_detector.get_pattern_summary(),
            "version_summary": self._version_manager.get_learning_summary(),
            "feedback_summary": self._feedback_engine.get_feedback_summary(),
            "session_duration_minutes": round((time.time() - self._session_start) / 60, 1),
        }
