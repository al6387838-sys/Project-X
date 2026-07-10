"""
LifeOS — Product Health Engine
==============================================================
Avalia continuamente a saúde operacional do produto LifeOS,
monitorando indicadores de qualidade, adoção e estabilidade.

EXECUTION-005 | PROJECT-X PHASE 5
==============================================================
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, List, Any

from .health_engine import HealthEngine, HealthDomain, HealthScore


class ProductHealthEngine(HealthEngine):
    """
    Engine responsável por calcular o Product Health Score (0–100).
    Monitora: bugs, testes, cobertura, adoção, churn, satisfação.
    """

    def __init__(self):
        super().__init__(HealthDomain.PRODUCT)
        self._bug_count = 0
        self._test_pass_rate = 0.0
        self._code_coverage = 0.0
        self._crash_rate = 0.0
        self._adoption_rate = 0.0
        self._churn_rate = 0.0
        self._response_time = 0.0
        self._feature_completion = 0.0

    # ── Ingestão de Métricas ─────────────────────────────────────────────

    def ingest(self, metrics: Dict[str, float]):
        """Recebe métricas do produto e atualiza estado interno."""
        if "bug_count" in metrics:
            self._bug_count = int(metrics["bug_count"])
        if "test_pass_rate" in metrics:
            self._test_pass_rate = metrics["test_pass_rate"]
        if "code_coverage" in metrics:
            self._code_coverage = metrics["code_coverage"]
        if "crash_rate" in metrics:
            self._crash_rate = metrics["crash_rate"]
        if "adoption_rate" in metrics:
            self._adoption_rate = metrics["adoption_rate"]
        if "churn_rate" in metrics:
            self._churn_rate = metrics["churn_rate"]
        if "response_time" in metrics:
            self._response_time = metrics["response_time"]
        if "feature_completion" in metrics:
            self._feature_completion = metrics["feature_completion"]

    # ── Normalização de Métricas ─────────────────────────────────────────

    def _normalize_metrics(self) -> Dict[str, float]:
        """
        Normaliza todas as métricas para escala 0–100.
        Métricas inversas (bugs, churn) são invertidas.
        """
        normalized = {}

        # Test pass rate: direto 0–100
        normalized["test_pass_rate"] = min(100, self._test_pass_rate * 100)

        # Code coverage: direto 0–100
        normalized["code_coverage"] = min(100, self._code_coverage * 100)

        # Bug count: inverso (0 bugs = 100, 50+ bugs = 0)
        normalized["bug_health"] = max(0, 100 - (self._bug_count * 2))

        # Crash rate: inverso (0% = 100, 5%+ = 0)
        normalized["crash_health"] = max(0, 100 - (self._crash_rate * 20))

        # Adoption rate: direto 0–100
        normalized["adoption_rate"] = min(100, self._adoption_rate * 100)

        # Churn rate: inverso (0% = 100, 10%+ = 0)
        normalized["churn_health"] = max(0, 100 - (self._churn_rate * 10))

        # Response time: inverso (< 100ms = 100, > 2000ms = 0)
        normalized["response_health"] = max(0, 100 - ((self._response_time / 2000) * 100))

        # Feature completion: direto 0–100
        normalized["feature_completion"] = min(100, self._feature_completion * 100)

        return normalized

    # ── Cálculo do Score ─────────────────────────────────────────────────

    def calculate(self) -> HealthScore:
        """Calcula o Product Health Score completo."""
        metrics = self._normalize_metrics()

        weights = {
            "test_pass_rate": 0.20,
            "code_coverage": 0.15,
            "bug_health": 0.15,
            "crash_health": 0.10,
            "adoption_rate": 0.10,
            "churn_health": 0.10,
            "response_health": 0.10,
            "feature_completion": 0.10,
        }

        score = self.calculate_score(metrics, weights)
        trend = self.detect_trend([s.score for s in self._scores_history[-7:]])

        health_score = HealthScore(
            domain=HealthDomain.PRODUCT,
            score=score,
            trend=trend,
            components=metrics,
        )
        self.record_score(health_score)
        self._check_alerts(metrics)
        self._generate_recommendations(metrics)

        return health_score

    # ── Alertas Automáticos ──────────────────────────────────────────────

    def _check_alerts(self, metrics: Dict[str, float]):
        """Verifica thresholds e gera alertas quando necessário."""
        if metrics["bug_health"] < 50:
            self.generate_alert(
                severity="warning",
                title="Alta Quantidade de Bugs",
                message=f"Bugs abertos: {self._bug_count}. Saúde de bugs em {metrics['bug_health']:.0f}/100.",
                metric_name="bug_health",
                metric_value=str(metrics["bug_health"]),
                threshold="50",
            )

        if metrics["crash_health"] < 60:
            self.generate_alert(
                severity="critical",
                title="Crash Rate Elevado",
                message=f"Taxa de crash: {self._crash_rate}%. Saúde de crashes em {metrics['crash_health']:.0f}/100.",
                metric_name="crash_health",
                metric_value=str(metrics["crash_health"]),
                threshold="60",
            )

        if metrics["response_health"] < 60:
            self.generate_alert(
                severity="warning",
                title="Tempo de Resposta Degradado",
                message=f"Tempo de resposta: {self._response_time}ms. Saúde em {metrics['response_health']:.0f}/100.",
                metric_name="response_health",
                metric_value=f"{self._response_time}ms",
                threshold="60",
            )

    # ── Recomendações Automáticas ────────────────────────────────────────

    def _generate_recommendations(self, metrics: Dict[str, float]):
        """Gera recomendações com base nas métricas."""
        if metrics["response_health"] < 70:
            self.generate_recommendation(
                title="Performance Degradada Detectada",
                description=(
                    f"A performance caiu {100 - metrics['response_health']:.0f}% "
                    f"(tempo de resposta: {self._response_time}ms)."
                ),
                suggested_action=(
                    "Revisar módulo Life Kernel — otimizar queries e "
                    "implementar cache Redis para endpoints críticos."
                ),
                module="Life Kernel",
                confidence=0.85,
            )

        if metrics["bug_health"] < 70:
            self.generate_recommendation(
                title="Acúmulo de Bugs Detectado",
                description=(
                    f"{self._bug_count} bugs abertos. Saúde de bugs em "
                    f"{metrics['bug_health']:.0f}/100."
                ),
                suggested_action=(
                    "Priorizar sprint de bugfixes. Revisar Action Engine "
                    "e Connector Platform para resolver erros de integração."
                ),
                module="Action Engine",
                confidence=0.75,
            )
