"""
LifeOS — SIG Health Monitor
==============================================================
Monitora a saúde do SIG — Sistema de Inteligência Global:
inferências, modelos ativos, aprendizado contínuo e precisão.

EXECUTION-005 | PROJECT-X PHASE 5
==============================================================
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from .health_engine import HealthEngine, HealthDomain, HealthScore


@dataclass
class SIGNode:
    """Nó individual do SIG."""
    name: str
    status: str = "active"           # active, standby, degraded, offline
    version: str = ""
    inference_latency_ms: float = 0.0
    inference_count_24h: int = 0
    accuracy: float = 0.0
    last_update: Optional[datetime] = None
    error_count_24h: int = 0
    sync_status: str = "synced"      # synced, syncing, desynced

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "version": self.version,
            "inference_latency_ms": self.inference_latency_ms,
            "inference_count_24h": self.inference_count_24h,
            "accuracy": self.accuracy,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "error_count_24h": self.error_count_24h,
            "sync_status": self.sync_status,
        }


class SIGHealthMonitor:
    """
    Monitor de saúde do SIG — calcula SIG Health Score (0–100)
    e monitora cada nó individual.
    """

    def __init__(self):
        self._engine = HealthEngine(HealthDomain.SIG)
        self._nodes: Dict[str, SIGNode] = {}
        self._total_inferences_24h = 0
        self._sync_failures = 0
        self._learning_cycles_completed = 0
        self._learning_accuracy = 0.0

        # Inicializar nós do SIG
        known_nodes = {
            "SIG Core": SIGNode(name="SIG Core"),
            "Inference Engine": SIGNode(name="Inference Engine"),
            "Model Registry": SIGNode(name="Model Registry"),
            "Learning Pipeline": SIGNode(name="Learning Pipeline"),
            "Data Ingestion": SIGNode(name="Data Ingestion"),
            "Validation Layer": SIGNode(name="Validation Layer"),
            "Distribution Network": SIGNode(name="Distribution Network"),
        }
        self._nodes = known_nodes

    # ── Ingestão ─────────────────────────────────────────────────────────

    def update_node(self, name: str, data: Dict[str, Any]):
        """Atualiza status de um nó do SIG."""
        if name not in self._nodes:
            self._nodes[name] = SIGNode(name=name)

        node = self._nodes[name]

        if "status" in data:
            node.status = data["status"]
        if "version" in data:
            node.version = str(data["version"])
        if "inference_latency_ms" in data:
            node.inference_latency_ms = float(data["inference_latency_ms"])
        if "inference_count_24h" in data:
            node.inference_count_24h = int(data["inference_count_24h"])
        if "accuracy" in data:
            node.accuracy = float(data["accuracy"])
        if "error_count_24h" in data:
            node.error_count_24h = int(data["error_count_24h"])
        if "sync_status" in data:
            node.sync_status = data["sync_status"]

        node.last_update = datetime.now(timezone.utc)

        # Detectar problemas no SIG
        if node.status != "active":
            self._engine.generate_alert(
                severity="critical" if node.status == "offline" else "warning",
                title=f"Nó SIG Degradado: {node.name}",
                message=(
                    f"Nó {node.name} em status {node.status}. "
                    f"Última atualização: {node.last_update.isoformat()}."
                ),
                metric_name="sig_node_status",
                metric_value=node.status,
                threshold="active",
            )

        if node.sync_status == "desynced":
            self._engine.generate_alert(
                severity="warning",
                title=f"Dessincronização SIG: {node.name}",
                message=(
                    f"Nó {node.name} está dessincronizado. "
                    f"Verificar conexão com modelo principal."
                ),
                metric_name="sig_sync_status",
                metric_value="desynced",
                threshold="synced",
            )

    def update_learning_metrics(self, cycles: int, accuracy: float):
        """Atualiza métricas de aprendizado contínuo."""
        self._learning_cycles_completed = cycles
        self._learning_accuracy = accuracy

    def update_sync_failures(self, failures: int):
        """Atualiza contagem de falhas de sincronização."""
        self._sync_failures = failures
        if failures > 5:
            self._engine.generate_alert(
                severity="critical",
                title="Problemas no SIG — Sincronização",
                message=(
                    f"{failures} falhas de sincronização nas últimas 24h. "
                    f"O SIG pode estar operando com dados desatualizados."
                ),
                metric_name="sig_sync_failures",
                metric_value=str(failures),
                threshold="5",
            )

    # ── Cálculo do SIG Health Score ──────────────────────────────────────

    def calculate_score(self) -> HealthScore:
        """Calcula o SIG Health Score (0–100)."""
        active_nodes = sum(1 for n in self._nodes.values() if n.status == "active")
        total_nodes = len(self._nodes)

        metrics = {
            # Node availability
            "node_availability": (active_nodes / max(1, total_nodes)) * 100,

            # Avg accuracy across active nodes
            "avg_accuracy": (
                sum(n.accuracy for n in self._nodes.values() if n.accuracy > 0) /
                max(1, sum(1 for n in self._nodes.values() if n.accuracy > 0))
            ),

            # Avg latency health (inverted: < 300ms = 100, > 1500ms = 0)
            "latency_health": max(0, 100 - (
                (sum(n.inference_latency_ms for n in self._nodes.values()) /
                 max(1, len(self._nodes))) / 15
            )),

            # Learning accuracy
            "learning_accuracy": self._learning_accuracy * 100,

            # Sync health (inverted: 0 failures = 100, 50+ = 0)
            "sync_health": max(0, 100 - (self._sync_failures * 2)),

            # Learning cycle health (inverted: 0 cycles = 50, 50+ = 100)
            "learning_cycle_health": min(100, max(50, self._learning_cycles_completed * 2)),
        }

        weights = {
            "node_availability": 0.20,
            "avg_accuracy": 0.20,
            "latency_health": 0.15,
            "learning_accuracy": 0.15,
            "sync_health": 0.15,
            "learning_cycle_health": 0.15,
        }

        score = self._engine.calculate_score(metrics, weights)
        trend = self._engine.detect_trend(
            [s.score for s in self._engine._scores_history[-7:]]
        )

        health_score = HealthScore(
            domain=HealthDomain.SIG,
            score=score,
            trend=trend,
            components=metrics,
        )
        self._engine.record_score(health_score)
        self._generate_recommendations(metrics)

        return health_score

    # ── Recomendações ────────────────────────────────────────────────────

    def _generate_recommendations(self, metrics: Dict[str, float]):
        """Gera recomendações para o SIG."""
        if metrics["node_availability"] < 70:
            inactive = [
                n.name for n in self._nodes.values()
                if n.status != "active"
            ]
            self._engine.generate_recommendation(
                title="Nós SIG Inativos Detectados",
                description=(
                    f"{len(inactive)} nós inativos: {', '.join(inactive)}. "
                    f"Disponibilidade em {metrics['node_availability']:.0f}/100."
                ),
                suggested_action=(
                    "Reiniciar nós inativos, verificar logs de cada nó "
                    "e restaurar conexão com o SIG Core."
                ),
                module="SIG Core",
                confidence=0.90,
            )

        if metrics["sync_health"] < 70:
            self._engine.generate_recommendation(
                title="Problemas de Sincronização no SIG",
                description=(
                    f"{self._sync_failures} falhas de sync. "
                    f"Saúde de sincronização em {metrics['sync_health']:.0f}/100."
                ),
                suggested_action=(
                    "Verificar rede de distribuição, renovar certificados "
                    "TLS e forçar resync completo dos nós."
                ),
                module="Distribution Network",
                confidence=0.85,
            )

        if metrics["learning_accuracy"] < 80:
            self._engine.generate_recommendation(
                title="Precisão de Aprendizado Baixa",
                description=(
                    f"Precisão de aprendizado: {self._learning_accuracy:.1%}. "
                    f"Saúde em {metrics['learning_accuracy']:.0f}/100."
                ),
                suggested_action=(
                    "Revisar dataset de treinamento, verificar "
                    "qualidade dos dados de ingestão e ajustar hyperparameters."
                ),
                module="Learning Pipeline",
                confidence=0.70,
            )

    # ── Queries ──────────────────────────────────────────────────────────

    def get_all_nodes(self) -> List[Dict[str, Any]]:
        """Retorna status de todos os nós."""
        return [n.to_dict() for n in self._nodes.values()]

    def get_learning_status(self) -> Dict[str, Any]:
        """Retorna status de aprendizado contínuo."""
        return {
            "cycles_completed": self._learning_cycles_completed,
            "accuracy": self._learning_accuracy,
            "sync_failures": self._sync_failures,
            "active_nodes": sum(1 for n in self._nodes.values() if n.status == "active"),
            "total_nodes": len(self._nodes),
        }

    def get_alerts(self) -> List[Dict[str, Any]]:
        """Retorna alertas ativos."""
        return [a.to_dict() for a in self._engine._alerts[-20:]]
