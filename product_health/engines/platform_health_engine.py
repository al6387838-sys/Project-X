"""
LifeOS — Platform Health Engine
==============================================================
Monitora a saúde da infraestrutura: disponibilidade, CPU,
memória, latência, erros e crash rate.

EXECUTION-005 | PROJECT-X PHASE 5
==============================================================
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, List, Any

from .health_engine import HealthEngine, HealthDomain, HealthScore


class PlatformHealthEngine(HealthEngine):
    """
    Engine responsável por calcular o Platform Health Score (0–100).
    Monitora: uptime, CPU, memória, latência, erros, crash rate.
    """

    def __init__(self):
        super().__init__(HealthDomain.PLATFORM)
        self._uptime = 0.0
        self._cpu_usage = 0.0
        self._memory_usage = 0.0
        self._disk_usage = 0.0
        self._latency_p50 = 0.0
        self._latency_p95 = 0.0
        self._latency_p99 = 0.0
        self._error_rate = 0.0
        self._crash_rate = 0.0
        self._requests_per_second = 0.0

    # ── Ingestão de Métricas ─────────────────────────────────────────────

    def ingest(self, metrics: Dict[str, float]):
        """Recebe métricas da plataforma e atualiza estado."""
        for key, value in metrics.items():
            attr = f"_{key}"
            if hasattr(self, attr):
                setattr(self, attr, float(value))

    # ── Normalização ─────────────────────────────────────────────────────

    def _normalize_metrics(self) -> Dict[str, float]:
        normalized = {}

        # Uptime: direto (99.9% = ~99.9, 99.0% = ~99.0)
        normalized["uptime"] = min(100, self._uptime)

        # CPU: inverso (0% = 100, 100% = 0, ideal < 70%)
        normalized["cpu_health"] = max(0, 100 - self._cpu_usage)

        # Memory: inverso (0% = 100, 100% = 0, ideal < 80%)
        normalized["memory_health"] = max(0, 100 - self._memory_usage)

        # Disk: inverso (0% = 100, 100% = 0)
        normalized["disk_health"] = max(0, 100 - self._disk_usage)

        # Latência P95: inverso (< 100ms = 100, > 500ms = 0)
        normalized["latency_health"] = max(0, 100 - (self._latency_p95 / 5))

        # Error rate: inverso (0% = 100, 5%+ = 0)
        normalized["error_health"] = max(0, 100 - (self._error_rate * 20))

        # Crash rate: inverso (0% = 100, 2%+ = 0)
        normalized["crash_health"] = max(0, 100 - (self._crash_rate * 50))

        return normalized

    # ── Cálculo do Score ─────────────────────────────────────────────────

    def calculate(self) -> HealthScore:
        """Calcula o Platform Health Score."""
        metrics = self._normalize_metrics()

        weights = {
            "uptime": 0.25,
            "cpu_health": 0.15,
            "memory_health": 0.15,
            "disk_health": 0.10,
            "latency_health": 0.15,
            "error_health": 0.10,
            "crash_health": 0.10,
        }

        score = self.calculate_score(metrics, weights)
        trend = self.detect_trend([s.score for s in self._scores_history[-7:]])

        health_score = HealthScore(
            domain=HealthDomain.PLATFORM,
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
        """Verifica thresholds e gera alertas."""
        if metrics["cpu_health"] < 30:
            self.generate_alert(
                severity="warning",
                title="Queda de Performance — CPU",
                message=f"CPU em {self._cpu_usage:.1f}%. Saúde em {metrics['cpu_health']:.0f}/100.",
                metric_name="cpu_health",
                metric_value=f"{self._cpu_usage:.1f}%",
                threshold="70%",
            )

        if metrics["memory_health"] < 20:
            self.generate_alert(
                severity="critical",
                title="Queda de Performance — Memória",
                message=f"Memória em {self._memory_usage:.1f}%. Saúde em {metrics['memory_health']:.0f}/100.",
                metric_name="memory_health",
                metric_value=f"{self._memory_usage:.1f}%",
                threshold="80%",
            )

        if metrics["latency_health"] < 50:
            self.generate_alert(
                severity="warning",
                title="Aumento de Latência",
                message=(
                    f"Latência P95: {self._latency_p95:.0f}ms, "
                    f"P99: {self._latency_p99:.0f}ms. "
                    f"Saúde em {metrics['latency_health']:.0f}/100."
                ),
                metric_name="latency_health",
                metric_value=f"{self._latency_p95:.0f}ms",
                threshold="150ms",
            )

        if metrics["error_health"] < 60:
            self.generate_alert(
                severity="critical",
                title="Aumento de Erros",
                message=(
                    f"Taxa de erros: {self._error_rate:.2f}%. "
                    f"Saúde em {metrics['error_health']:.0f}/100."
                ),
                metric_name="error_health",
                metric_value=f"{self._error_rate:.2f}%",
                threshold="2%",
            )

        if metrics["uptime"] < 99:
            self.generate_alert(
                severity="critical",
                title="Disponibilidade Comprometida",
                message=(
                    f"Uptime: {self._uptime:.2f}%. "
                    f"SLA de 99.9% violado."
                ),
                metric_name="uptime",
                metric_value=f"{self._uptime:.2f}%",
                threshold="99.9%",
            )

    # ── Recomendações Automáticas ────────────────────────────────────────

    def _generate_recommendations(self, metrics: Dict[str, float]):
        """Gera recomendações com base nas métricas."""
        if metrics["cpu_health"] < 40:
            self.generate_recommendation(
                title="Performance CPU Degradada",
                description=(
                    f"A performance caiu {100 - metrics['cpu_health']:.0f}% "
                    f"(CPU em {self._cpu_usage:.1f}%)."
                ),
                suggested_action=(
                    "Revisar módulo Decision Engine — otimizar processamento "
                    "batch e implementar auto-scaling horizontal."
                ),
                module="Decision Engine",
                confidence=0.82,
            )

        if metrics["latency_health"] < 60:
            self.generate_recommendation(
                title="Latência Elevada Detectada",
                description=(
                    f"Latência P95: {self._latency_p95:.0f}ms. "
                    f"Saúde de latência em {metrics['latency_health']:.0f}/100."
                ),
                suggested_action=(
                    "Revisar módulo API Gateway — implementar caching "
                    "agressivo e otimizar queries no Life Kernel."
                ),
                module="API Gateway",
                confidence=0.78,
            )
