"""
Pattern Detector — Detector de Padrões Comportamentais
=======================================================
Identifica e rastreia padrões no comportamento do usuário.

O PatternDetector analisa LearningEvents para detectar:
- Padrões temporais (horários, dias da semana)
- Hábitos recorrentes
- Padrões de rejeição/aceitação
- Sequências comportamentais
- Preferências implícitas
"""

from typing import Any, Dict, List, Optional, Set
from collections import defaultdict
import time
import uuid

from ..models.learning_event import LearningEvent, EventType, FeedbackType
from ..models.pattern import Pattern, PatternType, PatternOccurrence
from ..analyzers.behavior_analyzer import BehaviorAnalyzer


class PatternDetector:
    """
    Detecta e mantém padrões comportamentais do usuário.

    Responsabilidades:
    - Detectar padrões a partir de LearningEvents
    - Atualizar confiança dos padrões existentes
    - Identificar padrões de rejeição (reduzir peso)
    - Identificar padrões de aceitação (aumentar confiança)
    - Gerenciar o ciclo de vida dos padrões
    """

    # Limiar mínimo de ocorrências para criar um padrão
    MIN_OCCURRENCES_TO_CREATE = 2
    # Limiar de confiança para ativar um padrão
    ACTIVATION_THRESHOLD = 0.3
    # Limiar de confiança para desativar um padrão
    DEACTIVATION_THRESHOLD = 0.1

    def __init__(self, behavior_analyzer: Optional[BehaviorAnalyzer] = None):
        self._patterns: Dict[str, Pattern] = {}
        self._analyzer = behavior_analyzer or BehaviorAnalyzer()
        self._pending_events: List[LearningEvent] = []

    # ------------------------------------------------------------------ #
    #  API Pública                                                         #
    # ------------------------------------------------------------------ #

    def process_events(self, events: List[LearningEvent]) -> List[Pattern]:
        """
        Processa uma lista de eventos e atualiza/cria padrões.

        Args:
            events: Lista de LearningEvents para processar.

        Returns:
            Lista de padrões novos ou atualizados.
        """
        self._analyzer.ingest(events)
        self._pending_events.extend(events)

        updated_patterns: Set[str] = set()

        for event in events:
            affected = self._process_single_event(event)
            updated_patterns.update(affected)

        # Detecta padrões emergentes a partir da análise comportamental
        self._detect_temporal_patterns()
        self._detect_rejection_patterns()
        self._detect_acceptance_patterns()
        self._detect_habit_patterns()
        self._detect_communication_patterns()

        # Atualiza status dos padrões
        self._update_pattern_statuses()

        return [self._patterns[k] for k in updated_patterns if k in self._patterns]

    def process_single_event(self, event: LearningEvent) -> List[Pattern]:
        """
        Processa um único evento e retorna padrões afetados.
        """
        self._analyzer.ingest_single(event)
        self._pending_events.append(event)
        affected_keys = self._process_single_event(event)
        return [self._patterns[k] for k in affected_keys if k in self._patterns]

    def get_pattern(self, pattern_key: str) -> Optional[Pattern]:
        """Retorna um padrão pelo seu key."""
        return self._patterns.get(pattern_key)

    def get_all_patterns(self, active_only: bool = True) -> List[Pattern]:
        """Retorna todos os padrões detectados."""
        patterns = list(self._patterns.values())
        if active_only:
            patterns = [p for p in patterns if p.is_active]
        return sorted(patterns, key=lambda p: p.confidence, reverse=True)

    def get_patterns_by_domain(self, domain: str) -> List[Pattern]:
        """Retorna padrões de um domínio específico."""
        return [p for p in self._patterns.values() if p.domain == domain and p.is_active]

    def get_patterns_by_type(self, pattern_type: PatternType) -> List[Pattern]:
        """Retorna padrões de um tipo específico."""
        return [p for p in self._patterns.values() if p.pattern_type == pattern_type and p.is_active]

    def get_strong_patterns(self, min_confidence: float = 0.6) -> List[Pattern]:
        """Retorna apenas padrões com alta confiança."""
        return [
            p for p in self._patterns.values()
            if p.confidence >= min_confidence and p.is_active
        ]

    def get_rejection_patterns(self) -> List[Pattern]:
        """Retorna padrões de rejeição (para reduzir peso)."""
        return [
            p for p in self._patterns.values()
            if p.pattern_type == PatternType.REJEICAO and p.is_active
        ]

    def adjust_pattern_weight(self, pattern_key: str, delta: float) -> bool:
        """
        Ajusta o peso de recomendação de um padrão.

        Args:
            pattern_key: Chave do padrão.
            delta: Variação do peso (-1.0 a +1.0).

        Returns:
            True se o padrão foi encontrado e ajustado.
        """
        pattern = self._patterns.get(pattern_key)
        if not pattern:
            return False
        pattern.recommendation_weight = max(0.0, min(1.0, pattern.recommendation_weight + delta))
        pattern.updated_at = time.time()
        return True

    def get_pattern_summary(self) -> Dict[str, Any]:
        """Retorna resumo de todos os padrões detectados."""
        all_patterns = list(self._patterns.values())
        active = [p for p in all_patterns if p.is_active]

        by_type: Dict[str, int] = defaultdict(int)
        for p in active:
            by_type[p.pattern_type.value] += 1

        by_strength: Dict[str, int] = defaultdict(int)
        for p in active:
            by_strength[p.strength.value] += 1

        return {
            "total_patterns": len(all_patterns),
            "active_patterns": len(active),
            "by_type": dict(by_type),
            "by_strength": dict(by_strength),
            "strongest_patterns": [
                {"key": p.key, "confidence": p.confidence, "label": p.label}
                for p in sorted(active, key=lambda x: x.confidence, reverse=True)[:5]
            ],
        }

    # ------------------------------------------------------------------ #
    #  Detecção de Padrões Específicos                                     #
    # ------------------------------------------------------------------ #

    def _process_single_event(self, event: LearningEvent) -> List[str]:
        """Processa um evento e atualiza padrões relevantes."""
        affected = []

        if event.pattern_key:
            pattern = self._get_or_create_pattern(
                key=event.pattern_key,
                domain=event.domain,
                pattern_type=self._infer_pattern_type(event),
            )
            confirmed = event.feedback_type != FeedbackType.NEGATIVE
            pattern.record_occurrence(
                context=event.context,
                confirmed=confirmed,
            )
            if event.event_id not in pattern.source_events:
                pattern.source_events.append(event.event_id)
            affected.append(event.pattern_key)

        return affected

    def _detect_temporal_patterns(self) -> None:
        """Detecta padrões temporais a partir da análise comportamental."""
        temporal = self._analyzer.analyze_temporal_patterns()
        schedule = self._analyzer.analyze_schedule_preferences()

        if temporal.get("most_active_hour") is not None:
            key = f"temporal_peak_hour_{temporal['most_active_hour']}"
            pattern = self._get_or_create_pattern(
                key=key,
                domain="geral",
                pattern_type=PatternType.TEMPORAL,
                label=f"Pico de atividade às {temporal['most_active_hour']}h",
                description=f"Usuário é mais ativo às {temporal['most_active_hour']}h",
            )
            pattern.pattern_data["peak_hour"] = temporal["most_active_hour"]
            pattern.pattern_data["active_days"] = temporal.get("active_days", [])
            # Atualiza confiança baseado na consistência
            if len(self._pending_events) >= 5:
                pattern.record_occurrence(confirmed=True)

        for domain, sched in schedule.items():
            if sched.get("sample_size", 0) >= 3:
                key = f"schedule_{domain}_{sched['time_of_day']}"
                pattern = self._get_or_create_pattern(
                    key=key,
                    domain=domain,
                    pattern_type=PatternType.TEMPORAL,
                    label=f"Atividade de {domain} na {sched['time_of_day']}",
                    description=f"Usuário prefere realizar atividades de {domain} na {sched['time_of_day']}",
                )
                pattern.pattern_data["preferred_time"] = sched["time_of_day"]
                pattern.pattern_data["preferred_hour"] = sched["preferred_hour"]
                pattern.record_occurrence(confirmed=True)

    def _detect_rejection_patterns(self) -> None:
        """Detecta padrões de rejeição repetida."""
        rejections = self._analyzer.analyze_rejection_patterns()

        for rej in rejections:
            key = f"rejection_{rej['pattern_key']}"
            pattern = self._get_or_create_pattern(
                key=key,
                domain=rej["contexts"][0]["domain"] if rej["contexts"] else "geral",
                pattern_type=PatternType.REJEICAO,
                label=f"Rejeição de '{rej['pattern_key']}'",
                description=f"Usuário rejeita consistentemente o padrão '{rej['pattern_key']}'",
            )
            pattern.pattern_data["rejection_count"] = rej["rejection_count"]
            pattern.pattern_data["weight_reduction"] = rej["weight_reduction"]
            pattern.recommendation_weight = max(0.1, 1.0 - rej["weight_reduction"])

            for _ in range(rej["rejection_count"]):
                pattern.record_occurrence(confirmed=True)

    def _detect_acceptance_patterns(self) -> None:
        """Detecta padrões de aceitação consistente."""
        acceptances = self._analyzer.analyze_acceptance_patterns()

        for acc in acceptances:
            key = acc["pattern_key"]
            if key in self._patterns:
                pattern = self._patterns[key]
                # Aumenta o peso de recomendação
                boost = acc["confidence_boost"]
                pattern.recommendation_weight = min(1.0, pattern.recommendation_weight + boost)
                pattern.updated_at = time.time()

    def _detect_habit_patterns(self) -> None:
        """Detecta padrões de hábito a partir de eventos de hábito."""
        habit_events = [
            e for e in self._pending_events
            if e.event_type in (EventType.HABIT_COMPLETED, EventType.HABIT_MISSED)
        ]

        habit_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {"completed": 0, "missed": 0})
        for event in habit_events:
            key = event.pattern_key or "unknown_habit"
            if event.event_type == EventType.HABIT_COMPLETED:
                habit_stats[key]["completed"] += 1
            else:
                habit_stats[key]["missed"] += 1

        for habit_key, stats in habit_stats.items():
            total = stats["completed"] + stats["missed"]
            if total < self.MIN_OCCURRENCES_TO_CREATE:
                continue

            pattern = self._get_or_create_pattern(
                key=f"habit_{habit_key}",
                domain="habitos",
                pattern_type=PatternType.HABITO,
                label=f"Hábito: {habit_key}",
                description=f"Padrão de hábito detectado: {habit_key}",
            )
            pattern.pattern_data["completion_rate"] = stats["completed"] / total
            pattern.pattern_data["total_tracked"] = total

    def _detect_communication_patterns(self) -> None:
        """Detecta padrões de estilo de comunicação."""
        comm_analysis = self._analyzer.analyze_communication_style()

        if comm_analysis.get("sample_size", 0) >= 3:
            tone = comm_analysis["inferred_tone"]
            key = f"communication_tone_{tone}"
            pattern = self._get_or_create_pattern(
                key=key,
                domain="comunicacao",
                pattern_type=PatternType.COMUNICACAO,
                label=f"Tom preferido: {tone}",
                description=f"Usuário prefere comunicação com tom {tone}",
            )
            pattern.pattern_data["tone"] = tone
            pattern.pattern_data["confidence"] = comm_analysis.get("confidence", 0.0)
            pattern.record_occurrence(confirmed=True)

    # ------------------------------------------------------------------ #
    #  Utilitários Privados                                                #
    # ------------------------------------------------------------------ #

    def _get_or_create_pattern(
        self,
        key: str,
        domain: str,
        pattern_type: PatternType,
        label: str = "",
        description: str = "",
    ) -> Pattern:
        """Retorna padrão existente ou cria um novo."""
        if key not in self._patterns:
            self._patterns[key] = Pattern(
                key=key,
                domain=domain,
                pattern_type=pattern_type,
                label=label or key,
                description=description,
            )
        return self._patterns[key]

    def _infer_pattern_type(self, event: LearningEvent) -> PatternType:
        """Infere o tipo de padrão a partir do evento."""
        type_map = {
            EventType.ROUTINE_FOLLOWED: PatternType.SEQUENCIAL,
            EventType.ROUTINE_SKIPPED: PatternType.SEQUENCIAL,
            EventType.HABIT_COMPLETED: PatternType.HABITO,
            EventType.HABIT_MISSED: PatternType.HABITO,
            EventType.SUGGESTION_REJECTED: PatternType.REJEICAO,
            EventType.COMMUNICATION_STYLE: PatternType.COMUNICACAO,
            EventType.PREFERENCE_EXPRESSED: PatternType.PREFERENCIA,
            EventType.PRIORITY_CHANGED: PatternType.PRIORIDADE,
            EventType.SCHEDULE_INTERACTION: PatternType.TEMPORAL,
        }
        return type_map.get(event.event_type, PatternType.PREFERENCIA)

    def _update_pattern_statuses(self) -> None:
        """Atualiza o status ativo/inativo dos padrões."""
        for pattern in self._patterns.values():
            if pattern.confidence < self.DEACTIVATION_THRESHOLD and pattern.occurrences > 5:
                pattern.is_active = False
            elif pattern.confidence >= self.ACTIVATION_THRESHOLD:
                pattern.is_active = True
