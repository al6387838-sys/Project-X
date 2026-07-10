"""
LifeOS — AI Health Monitor
==============================================================
Monitora a saúde do motor de Inteligência Artificial:
Companion AI, Decision Engine, Learning Engine, Pattern Recognizer.

EXECUTION-005 | PROJECT-X PHASE 5
==============================================================
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from .health_engine import HealthEngine, HealthDomain, HealthScore


@dataclass
class AIModelStatus:
    """Status de um modelo de IA individual."""
    name: str
    status: str = "online"           # online, standby, degraded, offline
    model_version: str = ""
    latency_avg_ms: float = 0.0
    requests_per_day: int = 0
    success_rate: float = 100.0
    error_count_24h: int = 0
    last_inference: Optional[datetime] = None
    training_epoch: int = 0
    accuracy: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "model_version": self.model_version,
            "latency_avg_ms": self.latency_avg_ms,
            "requests_per_day": self.requests_per_day,
            "success_rate": self.success_rate,
            "error_count_24h": self.error_count_24h,
            "last_inference": self.last_inference.isoformat() if self.last_inference else None,
            "training_epoch": self.training_epoch,
            "accuracy": self.accuracy,
        }


class AIHealthMonitor:
    """
    Monitor de saúde da IA — calcula AI Health Score (0–100)
    e monitora cada modelo individual.
    """

    def __init__(self):
        self._engine = HealthEngine(HealthDomain.AI)
        self._models: Dict[str, AIModelStatus] = {}
        self._companion_available = True
        self._sync_failures = 0
        self._last_sync_time = datetime.now(timezone.utc)

        # Inicializar modelos conhecidos
        known_models = {
            "Companion Core": AIModelStatus(name="Companion Core"),
            "Decision Engine": AIModelStatus(name="Decision Engine"),
            "Learning Engine": AIModelStatus(name="Learning Engine"),
            "Pattern Recognizer": AIModelStatus(name="Pattern Recognizer"),
            "Emotion Analyzer": AIModelStatus(name="Emotion Analyzer", status="standby"),
            "Voice Interface": AIModelStatus(name="Voice Interface", status="degraded"),
            "Predictive Engine": AIModelStatus(name="Predictive Engine", status="degraded"),
        }
        self._models = known_models

    # ── Ingestão ─────────────────────────────────────────────────────────

    def update_model(self, name: str, data: Dict[str, Any]):
        """Atualiza status de um modelo de IA."""
        if name not in self._models:
            self._models[name] = AIModelStatus(name=name)

        model = self._models[name]

        if "status" in data:
            model.status = data["status"]
        if "model_version" in data:
            model.model_version = str(data["model_version"])
        if "latency_avg_ms" in data:
            model.latency_avg_ms = float(data["latency_avg_ms"])
        if "requests_per_day" in data:
            model.requests_per_day = int(data["requests_per_day"])
        if "success_rate" in data:
            model.success_rate = float(data["success_rate"])
        if "error_count_24h" in data:
            model.error_count_24h = int(data["error_count_24h"])
        if "training_epoch" in data:
            model.training_epoch = int(data["training_epoch"])
        if "accuracy" in data:
            model.accuracy = float(data["accuracy"])

        model.last_inference = datetime.now(timezone.utc)

        # Verificar se Companion está indisponível
        if name == "Companion Core" and model.status != "online":
            self._companion_available = False
            self._engine.generate_alert(
                severity="critical",
                title="Companion Indisponível",
                message="O LifeOS Companion AI está indisponível. Missões não serão processadas.",
                metric_name="companion_status",
                metric_value=model.status,
                threshold="online",
            )

    def update_sync_status(self, failures: int = 0):
        """Atualiza status de sincronização da IA."""
        if failures > 0:
            self._sync_failures = failures
            self._engine.generate_alert(
                severity="warning",
                title="Falhas de Sincronização IA",
                message=(
                    f"{failures} falhas de sincronização detectadas nas últimas 24h. "
                    f"Verificar conexão com SIG e modelos remotos."
                ),
                metric_name="sync_failures",
                metric_value=str(failures),
                threshold="0",
            )

    # ── Cálculo do AI Health Score ───────────────────────────────────────

    def calculate_score(self) -> HealthScore:
        """Calcula o AI Health Score (0–100)."""
        online_count = sum(1 for m in self._models.values() if m.status == "online")
        total_models = len(self._models)

        # Métricas normalizadas
        metrics = {
            # Availability: % de modelos online
            "model_availability": (online_count / max(1, total_models)) * 100,

            # Companion: 100 se disponível, 0 se indisponível
            "companion_available": 100 if self._companion_available else 0,

            # Avg success rate across all models
            "avg_success_rate": (
                sum(m.success_rate for m in self._models.values()) /
                max(1, len(self._models))
            ),

            # Avg accuracy
            "avg_accuracy": (
                sum(m.accuracy for m in self._models.values() if m.accuracy > 0) /
                max(1, sum(1 for m in self._models.values() if m.accuracy > 0))
            ),

            # Avg latency health (inverted: < 500ms = 100, > 2000ms = 0)
            "latency_health": max(0, 100 - (
                (sum(m.latency_avg_ms for m in self._models.values()) /
                 max(1, len(self._models))) / 20
            )),

            # Sync health (inverted: 0 failures = 100, 50+ = 0)
            "sync_health": max(0, 100 - (self._sync_failures * 2)),
        }

        weights = {
            "model_availability": 0.20,
            "companion_available": 0.20,
            "avg_success_rate": 0.20,
            "avg_accuracy": 0.15,
            "latency_health": 0.15,
            "sync_health": 0.10,
        }

        score = self._engine.calculate_score(metrics, weights)
        trend = self._engine.detect_trend(
            [s.score for s in self._engine._scores_history[-7:]]
        )

        health_score = HealthScore(
            domain=HealthDomain.AI,
            score=score,
            trend=trend,
            components=metrics,
        )
        self._engine.record_score(health_score)
        self._generate_recommendations(metrics)

        return health_score

    # ── Recomendações ────────────────────────────────────────────────────

    def _generate_recommendations(self, metrics: Dict[str, float]):
        """Gera recomendações para a IA."""
        if metrics["companion_available"] == 0:
            self._engine.generate_recommendation(
                title="Companion Indisponível — Ação Imediata",
                description="O Companion AI está offline. Nenhuma missão está sendo processada.",
                suggested_action=(
                    "Verificar API Key do GPT-4o, reiniciar o serviço "
                    "Life Kernel e verificar logs do Intelligence Hub."
                ),
                module="Life Kernel",
                confidence=0.95,
            )

        if metrics["latency_health"] < 60:
            self._engine.generate_recommendation(
                title="Latência IA Elevada",
                description=(
                    f"Latência média dos modelos elevada. "
                    f"Saúde de latência em {metrics['latency_health']:.0f}/100."
                ),
                suggested_action=(
                    "Revisar módulo Intelligence Hub — otimizar pipeline "
                    "de inferência e considerar batch processing."
                ),
                module="Intelligence Hub",
                confidence=0.80,
            )

        if metrics["sync_health"] < 70:
            self._engine.generate_recommendation(
                title="Falhas de Sincronização Detectadas",
                description=(
                    f"{self._sync_failures} falhas de sincronização. "
                    f"Saúde de sync em {metrics['sync_health']:.0f}/100."
                ),
                suggested_action=(
                    "Verificar conexão com SIG, renovar tokens "
                    "e sincronizar modelos remotos."
                ),
                module="SIG",
                confidence=0.75,
            )

    # ── Queries ──────────────────────────────────────────────────────────

    def get_all_models(self) -> List[Dict[str, Any]]:
        """Retorna status de todos os modelos."""
        return [m.to_dict() for m in self._models.values()]

    def get_companion_status(self) -> Dict[str, Any]:
        """Retorna status específico do Companion."""
        companion = self._models.get("Companion Core")
        result = {"available": self._companion_available}
        if companion:
            result.update(companion.to_dict())
        return result

    def get_alerts(self) -> List[Dict[str, Any]]:
        """Retorna alertas ativos."""
        return [a.to_dict() for a in self._engine._alerts[-20:]]
