"""
Preference Engine — Motor de Preferências do LifeOS
====================================================
Aprende, armazena e evolui as preferências do usuário.

Aprende:
- Preferências explícitas (declaradas pelo usuário)
- Preferências implícitas (inferidas do comportamento)
- Rotinas e horários preferidos
- Prioridades e objetivos
- Hábitos e estilo de comunicação
- Tom preferido

Toda preferência tem histórico de evolução e pode ser revertida.
"""

from typing import Any, Dict, List, Optional, Tuple
import time

from ..models.learning_event import LearningEvent, EventType, FeedbackType
from ..models.preference import Preference, PreferenceCategory, PreferenceHistory
from ..models.learning_profile import LearningProfile, LearningScore
from ..models.pattern import Pattern


class PreferenceEngine:
    """
    Motor de preferências do LifeOS.

    Mantém um modelo atualizado das preferências do usuário,
    aprendendo continuamente a partir de LearningEvents e Patterns.

    Princípios de segurança:
    - Nenhuma preferência é aplicada automaticamente sem autorização.
    - Preferências bloqueadas (is_locked) nunca são alteradas.
    - Todo aprendizado é registrado para auditoria.
    """

    # Limiar de confiança para apresentar preferência ao usuário
    INSIGHT_THRESHOLD = 0.4
    # Limiar para considerar preferência "confirmada" automaticamente
    AUTO_CONFIRM_THRESHOLD = 0.85
    # Número mínimo de evidências para criar uma preferência
    MIN_EVIDENCE_COUNT = 2

    # Mapeamento de domínio para categoria de preferência
    DOMAIN_TO_CATEGORY = {
        "saude": PreferenceCategory.HABITO,
        "financas": PreferenceCategory.PRIORIDADE,
        "produtividade": PreferenceCategory.ROTINA,
        "comunicacao": PreferenceCategory.COMUNICACAO,
        "habitos": PreferenceCategory.HABITO,
        "horarios": PreferenceCategory.HORARIO,
        "objetivos": PreferenceCategory.OBJETIVO,
        "tom": PreferenceCategory.TOM,
    }

    def __init__(self):
        self._preferences: Dict[str, Preference] = {}
        self._profile: Optional[LearningProfile] = None

    def set_profile(self, profile: LearningProfile) -> None:
        """Associa um perfil de aprendizado ao engine."""
        self._profile = profile
        # Carrega preferências existentes do perfil
        for key, pref_dict in profile.preferences.items():
            if isinstance(pref_dict, dict):
                pref = self._dict_to_preference(pref_dict)
                self._preferences[key] = pref

    # ------------------------------------------------------------------ #
    #  Aprendizado de Preferências                                         #
    # ------------------------------------------------------------------ #

    def learn_from_event(self, event: LearningEvent) -> Optional[Preference]:
        """
        Aprende uma preferência a partir de um LearningEvent.

        Args:
            event: Evento de aprendizado para processar.

        Returns:
            Preferência criada ou atualizada, ou None se não aplicável.
        """
        if not event.pattern_key:
            return None

        pref_key = self._event_to_preference_key(event)
        category = self._infer_category(event)

        pref = self._get_or_create_preference(
            key=pref_key,
            category=category,
            domain=event.domain,
            label=self._generate_label(event),
        )

        # Atualiza sinais
        if event.is_positive():
            pref.positive_signals += 1
        elif event.is_negative():
            pref.negative_signals += 1

        pref.evidence_count += 1
        if event.event_id not in pref.source_events:
            pref.source_events.append(event.event_id)

        # Atualiza confiança
        delta = event.confidence_delta * event.weight
        pref.update_confidence(delta, event_id=event.event_id)

        # Atualiza valor da preferência se for evento de preferência explícita
        if event.event_type == EventType.PREFERENCE_EXPRESSED:
            pref.value = event.context.get("value", pref.value)

        # Gera insight se confiança suficiente
        if pref.confidence >= self.INSIGHT_THRESHOLD:
            self._generate_insight(pref)

        # Sincroniza com perfil
        if self._profile:
            self._profile.preferences[pref_key] = pref.to_dict()

        return pref

    def learn_from_events(self, events: List[LearningEvent]) -> List[Preference]:
        """Aprende de múltiplos eventos."""
        updated = []
        for event in events:
            pref = self.learn_from_event(event)
            if pref:
                updated.append(pref)
        return updated

    def learn_from_patterns(self, patterns: List[Pattern]) -> List[Preference]:
        """
        Aprende preferências a partir de padrões detectados.

        Padrões fortes se tornam preferências confirmadas.
        """
        updated = []
        for pattern in patterns:
            if pattern.confidence < 0.3:
                continue

            pref_key = f"pattern_{pattern.key}"
            category = self._pattern_type_to_category(pattern)

            pref = self._get_or_create_preference(
                key=pref_key,
                category=category,
                domain=pattern.domain,
                label=pattern.label,
            )

            pref.value = pattern.pattern_data
            pref.evidence_count = pattern.occurrences
            pref.confidence = pattern.confidence * 0.9  # Ligeiramente menor que o padrão
            pref.tags = pattern.tags

            if pref.confidence >= self.INSIGHT_THRESHOLD:
                self._generate_insight(pref)

            if self._profile:
                self._profile.preferences[pref_key] = pref.to_dict()

            updated.append(pref)

        return updated

    def express_preference(
        self,
        key: str,
        value: Any,
        category: PreferenceCategory,
        domain: str = "general",
        label: str = "",
    ) -> Preference:
        """
        Registra uma preferência expressa explicitamente pelo usuário.

        Esta é a forma mais confiável de aprendizado —
        o usuário declara diretamente o que prefere.

        Args:
            key: Chave da preferência.
            value: Valor da preferência.
            category: Categoria da preferência.
            domain: Domínio.
            label: Descrição legível.

        Returns:
            Preferência criada/atualizada com alta confiança.
        """
        pref = self._get_or_create_preference(
            key=key,
            category=category,
            domain=domain,
            label=label or key,
        )
        pref.previous_value = pref.value
        pref.value = value
        pref.is_confirmed = True
        pref.evidence_count += 1
        pref.positive_signals += 1
        # Preferência explícita recebe alta confiança
        pref.confidence = min(1.0, pref.confidence + 0.25)
        pref.updated_at = time.time()
        pref.history.add_snapshot(value=value, confidence=pref.confidence, evidence_count=pref.evidence_count)
        self._generate_insight(pref)

        if self._profile:
            self._profile.preferences[key] = pref.to_dict()

        return pref

    def lock_preference(self, key: str) -> bool:
        """
        Bloqueia uma preferência para que não seja alterada automaticamente.

        Args:
            key: Chave da preferência a bloquear.

        Returns:
            True se bloqueada com sucesso.
        """
        pref = self._preferences.get(key)
        if not pref:
            return False
        pref.is_locked = True
        return True

    def unlock_preference(self, key: str) -> bool:
        """Desbloqueia uma preferência."""
        pref = self._preferences.get(key)
        if not pref:
            return False
        pref.is_locked = False
        return True

    # ------------------------------------------------------------------ #
    #  Consulta de Preferências                                            #
    # ------------------------------------------------------------------ #

    def get_preference(self, key: str) -> Optional[Preference]:
        """Retorna uma preferência pelo key."""
        return self._preferences.get(key)

    def get_preferences_by_category(self, category: PreferenceCategory) -> List[Preference]:
        """Retorna preferências de uma categoria."""
        return [p for p in self._preferences.values() if p.category == category]

    def get_preferences_by_domain(self, domain: str) -> List[Preference]:
        """Retorna preferências de um domínio."""
        return [p for p in self._preferences.values() if p.domain == domain]

    def get_high_confidence_preferences(self, min_confidence: float = 0.6) -> List[Preference]:
        """Retorna preferências com alta confiança."""
        return [
            p for p in self._preferences.values()
            if p.confidence >= min_confidence
        ]

    def get_all_insights(self) -> List[str]:
        """Retorna todos os insights gerados para o usuário."""
        insights = []
        for pref in self._preferences.values():
            if pref.confidence >= self.INSIGHT_THRESHOLD:
                insights.append(pref.to_insight())
        return insights

    def get_preference_history(self, key: str) -> Optional[PreferenceHistory]:
        """Retorna o histórico de evolução de uma preferência."""
        pref = self._preferences.get(key)
        if not pref:
            return None
        return pref.history

    # ------------------------------------------------------------------ #
    #  Learning Score                                                      #
    # ------------------------------------------------------------------ #

    def compute_learning_score(self, total_events: int = 0) -> LearningScore:
        """
        Computa o Learning Score atual do sistema.

        O Learning Score representa o quanto o LifeOS já aprendeu
        sobre o usuário em cada dimensão.

        Args:
            total_events: Total de eventos processados.

        Returns:
            LearningScore atualizado.
        """
        score = LearningScore()
        score.total_events_processed = total_events
        score.total_preferences_learned = len(self._preferences)

        # Calcula score por dimensão
        score.preferences = self._score_for_category(PreferenceCategory.ROTINA) * 100
        score.routines = self._score_for_category(PreferenceCategory.ROTINA) * 100
        score.schedules = self._score_for_category(PreferenceCategory.HORARIO) * 100
        score.priorities = self._score_for_category(PreferenceCategory.PRIORIDADE) * 100
        score.goals = self._score_for_category(PreferenceCategory.OBJETIVO) * 100
        score.habits = self._score_for_category(PreferenceCategory.HABITO) * 100
        score.communication = self._score_for_category(PreferenceCategory.COMUNICACAO) * 100
        score.tone = self._score_for_category(PreferenceCategory.TOM) * 100

        # Bonus por volume de eventos
        event_bonus = min(10.0, total_events * 0.1)
        score.preferences = min(100.0, score.preferences + event_bonus)

        score.compute_overall()

        if self._profile:
            self._profile.learning_score = score

        return score

    def get_confidence_evolution(self, key: str) -> List[Tuple[float, float]]:
        """
        Retorna a evolução da confiança de uma preferência ao longo do tempo.

        Returns:
            Lista de (timestamp, confidence) ordenada por tempo.
        """
        pref = self._preferences.get(key)
        if not pref:
            return []
        return [
            (snap.timestamp, snap.confidence)
            for snap in pref.history.snapshots
        ]

    # ------------------------------------------------------------------ #
    #  Insights para o Usuário                                             #
    # ------------------------------------------------------------------ #

    def generate_user_insights(self, max_insights: int = 10) -> List[Dict[str, Any]]:
        """
        Gera insights formatados para apresentar ao usuário.

        Formato: "O LifeOS aprendeu isto sobre você."

        Args:
            max_insights: Número máximo de insights a retornar.

        Returns:
            Lista de insights ordenados por confiança.
        """
        insights = []
        for pref in self._preferences.values():
            if pref.confidence < self.INSIGHT_THRESHOLD:
                continue
            insights.append({
                "key": pref.key,
                "category": pref.category.value,
                "domain": pref.domain,
                "insight": pref.to_insight(),
                "confidence": pref.confidence,
                "evidence_count": pref.evidence_count,
                "is_confirmed": pref.is_confirmed,
                "value": pref.value,
            })

        # Ordena por confiança
        insights.sort(key=lambda x: x["confidence"], reverse=True)
        return insights[:max_insights]

    def format_learning_report(self) -> str:
        """
        Formata um relatório de aprendizado para o usuário.

        Returns:
            Texto formatado com o que o LifeOS aprendeu.
        """
        insights = self.generate_user_insights()
        if not insights:
            return "O LifeOS ainda está aprendendo sobre você. Continue usando o sistema!"

        lines = ["=== O LifeOS aprendeu isto sobre você ===\n"]
        for i, insight in enumerate(insights, 1):
            confidence_bar = "█" * int(insight["confidence"] * 10) + "░" * (10 - int(insight["confidence"] * 10))
            lines.append(
                f"{i:02d}. {insight['insight']}\n"
                f"    Confiança: [{confidence_bar}] {insight['confidence']:.0%} "
                f"| Evidências: {insight['evidence_count']}"
                + (" ✓ Confirmado" if insight["is_confirmed"] else "")
                + "\n"
            )

        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    #  Utilitários Privados                                                #
    # ------------------------------------------------------------------ #

    def _get_or_create_preference(
        self,
        key: str,
        category: PreferenceCategory,
        domain: str,
        label: str = "",
    ) -> Preference:
        if key not in self._preferences:
            pref = Preference(
                key=key,
                category=category,
                domain=domain,
                label=label or key,
            )
            pref.history.preference_id = pref.preference_id
            self._preferences[key] = pref
        return self._preferences[key]

    def _event_to_preference_key(self, event: LearningEvent) -> str:
        return f"{event.domain}_{event.pattern_key}"

    def _infer_category(self, event: LearningEvent) -> PreferenceCategory:
        return self.DOMAIN_TO_CATEGORY.get(event.domain, PreferenceCategory.ROTINA)

    def _generate_label(self, event: LearningEvent) -> str:
        labels = {
            EventType.SUGGESTION_ACCEPTED: f"Preferência por '{event.pattern_key}'",
            EventType.SUGGESTION_REJECTED: f"Rejeição de '{event.pattern_key}'",
            EventType.ROUTINE_FOLLOWED: f"Rotina '{event.pattern_key}'",
            EventType.HABIT_COMPLETED: f"Hábito '{event.pattern_key}'",
            EventType.COMMUNICATION_STYLE: f"Estilo de comunicação '{event.pattern_key}'",
            EventType.PREFERENCE_EXPRESSED: f"Preferência declarada: '{event.pattern_key}'",
        }
        return labels.get(event.event_type, f"Preferência: {event.pattern_key}")

    def _generate_insight(self, pref: Preference) -> None:
        """Gera texto de insight legível para o usuário."""
        category_labels = {
            PreferenceCategory.ROTINA: "segue a rotina",
            PreferenceCategory.HORARIO: "prefere o horário",
            PreferenceCategory.PRIORIDADE: "prioriza",
            PreferenceCategory.OBJETIVO: "tem como objetivo",
            PreferenceCategory.HABITO: "tem o hábito de",
            PreferenceCategory.COMUNICACAO: "prefere comunicação",
            PreferenceCategory.TOM: "prefere o tom",
            PreferenceCategory.DOMINIO: "foca no domínio",
            PreferenceCategory.FORMATO: "prefere o formato",
            PreferenceCategory.FREQUENCIA: "prefere a frequência",
            PreferenceCategory.ESTILO_DECISAO: "decide de forma",
            PreferenceCategory.TOPICO: "tem interesse em",
        }
        verb = category_labels.get(pref.category, "prefere")
        value_str = str(pref.value) if pref.value is not None else pref.label
        pref.human_readable = (
            f"O LifeOS aprendeu que você {verb}: {value_str}"
        )

        if self._profile:
            self._profile.add_insight(pref.human_readable)

    def _score_for_category(self, category: PreferenceCategory) -> float:
        """Calcula score de aprendizado para uma categoria."""
        prefs = self.get_preferences_by_category(category)
        if not prefs:
            return 0.0
        avg_confidence = sum(p.confidence for p in prefs) / len(prefs)
        count_bonus = min(0.2, len(prefs) * 0.05)
        return min(1.0, avg_confidence + count_bonus)

    def _pattern_type_to_category(self, pattern: Pattern) -> PreferenceCategory:
        from ..models.pattern import PatternType
        mapping = {
            PatternType.TEMPORAL: PreferenceCategory.HORARIO,
            PatternType.SEQUENCIAL: PreferenceCategory.ROTINA,
            PatternType.PREFERENCIA: PreferenceCategory.ROTINA,
            PatternType.HABITO: PreferenceCategory.HABITO,
            PatternType.REJEICAO: PreferenceCategory.ROTINA,
            PatternType.PRIORIDADE: PreferenceCategory.PRIORIDADE,
            PatternType.COMUNICACAO: PreferenceCategory.COMUNICACAO,
            PatternType.DECISAO: PreferenceCategory.ESTILO_DECISAO,
            PatternType.ENERGIA: PreferenceCategory.HABITO,
            PatternType.SOCIAL: PreferenceCategory.TOPICO,
        }
        return mapping.get(pattern.pattern_type, PreferenceCategory.ROTINA)

    @staticmethod
    def _dict_to_preference(d: Dict[str, Any]) -> Preference:
        """Converte dict para Preference (para carregar do perfil)."""
        pref = Preference(
            preference_id=d.get("preference_id", ""),
            key=d.get("key", ""),
            label=d.get("label", ""),
            domain=d.get("domain", "general"),
            value=d.get("value"),
            confidence=d.get("confidence", 0.0),
            evidence_count=d.get("evidence_count", 0),
            positive_signals=d.get("positive_signals", 0),
            negative_signals=d.get("negative_signals", 0),
            is_confirmed=d.get("is_confirmed", False),
            is_locked=d.get("is_locked", False),
        )
        try:
            pref.category = PreferenceCategory(d.get("category", "rotina"))
        except ValueError:
            pref.category = PreferenceCategory.ROTINA
        return pref
