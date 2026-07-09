"""
Behavior Analyzer — Analisador de Comportamento do Usuário
===========================================================
Analisa o comportamento do usuário ao longo do tempo para
identificar tendências, rotinas, horários e estilos de decisão.

O BehaviorAnalyzer transforma eventos brutos em insights comportamentais
que alimentam o PatternDetector e o PreferenceEngine.
"""

from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
import time
import math

from ..models.learning_event import LearningEvent, EventType, FeedbackType


class BehaviorAnalyzer:
    """
    Analisa o comportamento do usuário a partir de LearningEvents.

    Responsabilidades:
    - Identificar horários de maior atividade
    - Detectar sequências de ações recorrentes
    - Analisar padrões de aceitação/rejeição por domínio
    - Inferir estilo de comunicação preferido
    - Calcular métricas de engajamento
    """

    # Janelas de tempo para análise
    HOUR_BUCKETS = 24
    DAY_BUCKETS = 7
    WEEK_DAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]

    def __init__(self):
        self._events: List[LearningEvent] = []
        self._analysis_cache: Dict[str, Any] = {}
        self._cache_ttl: float = 300.0  # 5 minutos

    def ingest(self, events: List[LearningEvent]) -> None:
        """Ingere novos eventos para análise."""
        self._events.extend(events)
        self._analysis_cache.clear()  # Invalida cache

    def ingest_single(self, event: LearningEvent) -> None:
        """Ingere um único evento."""
        self._events.append(event)
        self._analysis_cache.clear()

    # ------------------------------------------------------------------ #
    #  Análise Temporal                                                    #
    # ------------------------------------------------------------------ #

    def analyze_temporal_patterns(self) -> Dict[str, Any]:
        """
        Analisa padrões temporais no comportamento.

        Retorna:
        - Horários de pico de atividade
        - Dias da semana mais ativos
        - Distribuição de atividade ao longo do dia
        """
        if not self._events:
            return {"peak_hours": [], "active_days": [], "hourly_distribution": {}}

        hour_counts: Dict[int, int] = defaultdict(int)
        day_counts: Dict[int, int] = defaultdict(int)

        for event in self._events:
            import datetime
            dt = datetime.datetime.fromtimestamp(event.timestamp)
            hour_counts[dt.hour] += 1
            day_counts[dt.weekday()] += 1

        # Normaliza distribuições
        total_events = len(self._events)
        hourly_dist = {
            h: count / total_events
            for h, count in hour_counts.items()
        }

        # Identifica picos (acima da média)
        if hourly_dist:
            avg = sum(hourly_dist.values()) / len(hourly_dist)
            peak_hours = sorted(
                [h for h, v in hourly_dist.items() if v > avg * 1.5],
                key=lambda h: hourly_dist[h],
                reverse=True,
            )[:3]
        else:
            peak_hours = []

        active_days = sorted(
            day_counts.keys(),
            key=lambda d: day_counts[d],
            reverse=True,
        )[:3]

        return {
            "peak_hours": peak_hours,
            "active_days": [self.WEEK_DAYS[d] for d in active_days if d < 7],
            "hourly_distribution": hourly_dist,
            "day_distribution": {
                self.WEEK_DAYS[d]: c for d, c in day_counts.items() if d < 7
            },
            "most_active_hour": max(hour_counts, key=hour_counts.get) if hour_counts else None,
            "most_active_day": self.WEEK_DAYS[max(day_counts, key=day_counts.get)] if day_counts else None,
        }

    def analyze_schedule_preferences(self) -> Dict[str, Any]:
        """
        Infere preferências de horário do usuário.

        Analisa quando o usuário realiza diferentes tipos de atividades
        para inferir seu cronograma preferido.
        """
        domain_hours: Dict[str, List[int]] = defaultdict(list)

        for event in self._events:
            import datetime
            dt = datetime.datetime.fromtimestamp(event.timestamp)
            domain_hours[event.domain].append(dt.hour)

        schedule = {}
        for domain, hours in domain_hours.items():
            if not hours:
                continue
            avg_hour = sum(hours) / len(hours)
            schedule[domain] = {
                "preferred_hour": round(avg_hour),
                "time_of_day": self._hour_to_period(round(avg_hour)),
                "sample_size": len(hours),
            }

        return schedule

    # ------------------------------------------------------------------ #
    #  Análise de Domínio                                                  #
    # ------------------------------------------------------------------ #

    def analyze_domain_engagement(self) -> Dict[str, Any]:
        """
        Analisa o engajamento do usuário por domínio.

        Retorna métricas de aceitação, rejeição e engajamento
        para cada domínio de vida (saúde, finanças, etc.).
        """
        domain_stats: Dict[str, Dict[str, int]] = defaultdict(
            lambda: {"positive": 0, "negative": 0, "implicit": 0, "explicit": 0, "total": 0}
        )

        for event in self._events:
            stats = domain_stats[event.domain]
            stats["total"] += 1
            stats[event.feedback_type.value] = stats.get(event.feedback_type.value, 0) + 1

        result = {}
        for domain, stats in domain_stats.items():
            total = stats["total"]
            positive = stats.get("positive", 0)
            negative = stats.get("negative", 0)

            result[domain] = {
                "total_events": total,
                "positive_ratio": positive / total if total > 0 else 0.0,
                "negative_ratio": negative / total if total > 0 else 0.0,
                "engagement_score": self._compute_engagement(stats),
                "dominant_feedback": self._dominant_feedback(stats),
            }

        return result

    def analyze_rejection_patterns(self) -> List[Dict[str, Any]]:
        """
        Identifica padrões de rejeição repetida.

        Quando o usuário rejeita o mesmo tipo de sugestão repetidamente,
        isso é um sinal forte para reduzir o peso desse padrão.
        """
        rejection_counts: Dict[str, int] = defaultdict(int)
        rejection_contexts: Dict[str, List[Dict]] = defaultdict(list)

        for event in self._events:
            if event.feedback_type == FeedbackType.NEGATIVE:
                rejection_counts[event.pattern_key] += 1
                rejection_contexts[event.pattern_key].append({
                    "domain": event.domain,
                    "timestamp": event.timestamp,
                    "context": event.context,
                })

        patterns = []
        for key, count in rejection_counts.items():
            if count >= 2:  # Mínimo 2 rejeições para ser padrão
                patterns.append({
                    "pattern_key": key,
                    "rejection_count": count,
                    "severity": "high" if count >= 5 else "medium" if count >= 3 else "low",
                    "recommendation": "reduce_weight",
                    "weight_reduction": min(0.5, count * 0.08),
                    "contexts": rejection_contexts[key][-3:],  # Últimas 3
                })

        return sorted(patterns, key=lambda p: p["rejection_count"], reverse=True)

    def analyze_acceptance_patterns(self) -> List[Dict[str, Any]]:
        """
        Identifica padrões de aceitação consistente.

        Quando o usuário aceita o mesmo tipo de sugestão repetidamente,
        isso é um sinal forte para aumentar a confiança desse padrão.
        """
        acceptance_counts: Dict[str, int] = defaultdict(int)

        for event in self._events:
            if event.feedback_type in (FeedbackType.POSITIVE, FeedbackType.EXPLICIT):
                acceptance_counts[event.pattern_key] += 1

        patterns = []
        for key, count in acceptance_counts.items():
            if count >= 2:
                patterns.append({
                    "pattern_key": key,
                    "acceptance_count": count,
                    "strength": "very_strong" if count >= 10 else "strong" if count >= 5 else "moderate",
                    "recommendation": "increase_confidence",
                    "confidence_boost": min(0.4, count * 0.04),
                })

        return sorted(patterns, key=lambda p: p["acceptance_count"], reverse=True)

    # ------------------------------------------------------------------ #
    #  Análise de Estilo de Comunicação                                    #
    # ------------------------------------------------------------------ #

    def analyze_communication_style(self) -> Dict[str, Any]:
        """
        Infere o estilo de comunicação preferido do usuário.

        Analisa eventos de comunicação para determinar:
        - Tom preferido (formal, casual, direto, detalhado)
        - Frequência de interação preferida
        - Formato de resposta preferido
        """
        comm_events = [
            e for e in self._events
            if e.event_type == EventType.COMMUNICATION_STYLE
            or "communication" in e.tags
            or "tone" in e.tags
        ]

        if not comm_events:
            return {
                "inferred_tone": "neutro",
                "confidence": 0.0,
                "sample_size": 0,
            }

        tone_counts: Dict[str, int] = defaultdict(int)
        for event in comm_events:
            tone = event.context.get("tone", "neutro")
            tone_counts[tone] += 1

        dominant_tone = max(tone_counts, key=tone_counts.get)
        total = len(comm_events)

        return {
            "inferred_tone": dominant_tone,
            "tone_distribution": dict(tone_counts),
            "confidence": tone_counts[dominant_tone] / total,
            "sample_size": total,
            "preferred_tones": sorted(tone_counts.keys(), key=lambda t: tone_counts[t], reverse=True),
        }

    # ------------------------------------------------------------------ #
    #  Análise de Prioridades e Objetivos                                  #
    # ------------------------------------------------------------------ #

    def analyze_priority_behavior(self) -> Dict[str, Any]:
        """
        Analisa como o usuário prioriza diferentes domínios e tarefas.
        """
        priority_events = [
            e for e in self._events
            if e.event_type == EventType.PRIORITY_CHANGED
            or e.feedback_type == FeedbackType.POSITIVE
        ]

        domain_priority: Dict[str, float] = defaultdict(float)
        domain_count: Dict[str, int] = defaultdict(int)

        for event in priority_events:
            domain_priority[event.domain] += event.weight
            domain_count[event.domain] += 1

        # Normaliza
        result = {}
        if domain_priority:
            max_priority = max(domain_priority.values())
            for domain in domain_priority:
                result[domain] = {
                    "priority_score": domain_priority[domain] / max_priority,
                    "interaction_count": domain_count[domain],
                }

        return {
            "domain_priorities": result,
            "top_priority_domain": max(result.keys(), key=lambda d: result[d]["priority_score"]) if result else None,
        }

    # ------------------------------------------------------------------ #
    #  Métricas Gerais                                                     #
    # ------------------------------------------------------------------ #

    def compute_behavior_metrics(self) -> Dict[str, Any]:
        """Computa métricas gerais de comportamento."""
        if not self._events:
            return {"total_events": 0}

        total = len(self._events)
        positive = sum(1 for e in self._events if e.is_positive())
        negative = sum(1 for e in self._events if e.is_negative())
        implicit = sum(1 for e in self._events if e.feedback_type == FeedbackType.IMPLICIT)
        explicit = sum(1 for e in self._events if e.feedback_type == FeedbackType.EXPLICIT)

        domains = set(e.domain for e in self._events)
        pattern_keys = set(e.pattern_key for e in self._events if e.pattern_key)

        # Calcula span de tempo
        if len(self._events) > 1:
            timestamps = [e.timestamp for e in self._events]
            time_span_days = (max(timestamps) - min(timestamps)) / 86400
        else:
            time_span_days = 0.0

        return {
            "total_events": total,
            "positive_events": positive,
            "negative_events": negative,
            "implicit_events": implicit,
            "explicit_events": explicit,
            "positive_ratio": positive / total,
            "negative_ratio": negative / total,
            "unique_domains": len(domains),
            "unique_patterns": len(pattern_keys),
            "time_span_days": round(time_span_days, 1),
            "events_per_day": round(total / max(time_span_days, 1), 1),
        }

    def generate_behavior_report(self) -> Dict[str, Any]:
        """
        Gera relatório completo de comportamento.
        Agrega todas as análises em um único documento.
        """
        return {
            "generated_at": time.time(),
            "metrics": self.compute_behavior_metrics(),
            "temporal": self.analyze_temporal_patterns(),
            "schedule": self.analyze_schedule_preferences(),
            "domain_engagement": self.analyze_domain_engagement(),
            "rejection_patterns": self.analyze_rejection_patterns(),
            "acceptance_patterns": self.analyze_acceptance_patterns(),
            "communication_style": self.analyze_communication_style(),
            "priorities": self.analyze_priority_behavior(),
        }

    # ------------------------------------------------------------------ #
    #  Utilitários Privados                                                #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _hour_to_period(hour: int) -> str:
        if 5 <= hour < 12:
            return "manhã"
        elif 12 <= hour < 18:
            return "tarde"
        elif 18 <= hour < 22:
            return "noite"
        return "madrugada"

    @staticmethod
    def _compute_engagement(stats: Dict[str, int]) -> float:
        total = stats.get("total", 0)
        if total == 0:
            return 0.0
        positive = stats.get("positive", 0)
        explicit = stats.get("explicit", 0)
        return min(1.0, (positive + explicit * 1.5) / total)

    @staticmethod
    def _dominant_feedback(stats: Dict[str, int]) -> str:
        candidates = {
            k: v for k, v in stats.items()
            if k in ("positive", "negative", "implicit", "explicit")
        }
        if not candidates:
            return "neutral"
        return max(candidates, key=candidates.get)
