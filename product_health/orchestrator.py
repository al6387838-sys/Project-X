"""
LifeOS — Product Health Orchestrator
==============================================================
Orquestrador principal: inicializa todas as engines,
coleta métricas, calcula scores e gera dados históricos.

EXECUTION-005 | PROJECT-X PHASE 5
==============================================================
"""

from __future__ import annotations
import json
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, Any

from engines.health_engine import HealthSnapshot, HealthDomain
from engines.product_health_engine import ProductHealthEngine
from engines.platform_health_engine import PlatformHealthEngine
from engines.service_monitor import ServiceMonitor
from engines.ai_health_monitor import AIHealthMonitor
from engines.sig_health_monitor import SIGHealthMonitor
from engines.business_security_score import BusinessHealthScore, SecurityHealthScore


class ProductHealthOrchestrator:
    """Orquestrador central de todas as engines de saúde."""

    def __init__(self):
        self.product_engine = ProductHealthEngine()
        self.platform_engine = PlatformHealthEngine()
        self.service_monitor = ServiceMonitor()
        self.ai_monitor = AIHealthMonitor()
        self.sig_monitor = SIGHealthMonitor()
        self.business_score = BusinessHealthScore()
        self.security_score = SecurityHealthScore()

        self._history: list[HealthSnapshot] = []
        self._data_dir = os.path.join(os.path.dirname(__file__), "data")

    # ── Geração de Dados Simulados (Realistas) ─────────────────────────

    def generate_realistic_metrics(self) -> Dict[str, Any]:
        """Gera métricas realistas para o LifeOS atual."""
        now = datetime.now(timezone.utc)

        # ── Produto ──
        product_metrics = {
            "bug_count": 7,
            "test_pass_rate": 1.0,       # 544/544
            "code_coverage": 0.942,
            "crash_rate": 0.002,
            "adoption_rate": 0.67,
            "churn_rate": 0.024,
            "response_time": 187,
            "feature_completion": 0.71,   # 12/17 features
        }

        # ── Plataforma ──
        platform_metrics = {
            "uptime": 99.94,
            "cpu_usage": 34,
            "memory_usage": 61,
            "disk_usage": 28,
            "latency_p50": 48,
            "latency_p95": 187,
            "latency_p99": 412,
            "error_rate": 0.08,
            "crash_rate": 0.002,
            "requests_per_second": 70,
        }

        # ── Serviços ──
        services_data = {
            "API Gateway": {"status": "online", "uptime_percent": 100, "latency_avg_ms": 12, "error_rate_percent": 0.01, "crash_count_24h": 0},
            "Life Kernel": {"status": "online", "uptime_percent": 99.9, "latency_avg_ms": 35, "error_rate_percent": 0.05, "crash_count_24h": 0},
            "Intelligence Hub": {"status": "online", "uptime_percent": 99.9, "latency_avg_ms": 312, "error_rate_percent": 0.03, "crash_count_24h": 0},
            "Action Engine": {"status": "online", "uptime_percent": 100, "latency_avg_ms": 89, "error_rate_percent": 0.02, "crash_count_24h": 0},
            "Database (Primary)": {"status": "online", "uptime_percent": 100, "latency_avg_ms": 8, "error_rate_percent": 0.01, "crash_count_24h": 0},
            "Database (Replica)": {"status": "online", "uptime_percent": 100, "latency_avg_ms": 11, "error_rate_percent": 0.02, "crash_count_24h": 0},
            "Redis Cache": {"status": "online", "uptime_percent": 100, "latency_avg_ms": 3, "error_rate_percent": 0.00, "crash_count_24h": 0},
            "Object Storage": {"status": "online", "uptime_percent": 100, "latency_avg_ms": 45, "error_rate_percent": 0.01, "crash_count_24h": 0},
        }

        # ── IA ──
        ai_models = {
            "Companion Core": {"status": "online", "model_version": "v2.4.1", "latency_avg_ms": 312, "requests_per_day": 4200, "success_rate": 97.8, "error_count_24h": 93, "training_epoch": 1247, "accuracy": 0.946},
            "Decision Engine": {"status": "online", "model_version": "v3.1.0", "latency_avg_ms": 89, "requests_per_day": 2100, "success_rate": 99.2, "error_count_24h": 17, "training_epoch": 892, "accuracy": 0.972},
            "Learning Engine": {"status": "online", "model_version": "v2.8.3", "latency_avg_ms": 445, "requests_per_day": 890, "success_rate": 96.5, "error_count_24h": 31, "training_epoch": 2104, "accuracy": 0.931},
            "Pattern Recognizer": {"status": "online", "model_version": "v1.9.0", "latency_avg_ms": 156, "requests_per_day": 3400, "success_rate": 98.1, "error_count_24h": 65, "training_epoch": 567, "accuracy": 0.958},
            "Emotion Analyzer": {"status": "standby", "model_version": "v0.5.0", "latency_avg_ms": 0, "requests_per_day": 0, "success_rate": 0, "error_count_24h": 0, "training_epoch": 0, "accuracy": 0},
            "Voice Interface": {"status": "degraded", "model_version": "v0.3.2", "latency_avg_ms": 890, "requests_per_day": 120, "success_rate": 82.3, "error_count_24h": 21, "training_epoch": 45, "accuracy": 0.823},
            "Predictive Engine": {"status": "degraded", "model_version": "v0.2.1", "latency_avg_ms": 1200, "requests_per_day": 50, "success_rate": 78.5, "error_count_24h": 11, "training_epoch": 12, "accuracy": 0.785},
        }

        # ── SIG ──
        sig_nodes = {
            "SIG Core": {"status": "active", "version": "v3.2.0", "inference_latency_ms": 145, "inference_count_24h": 12400, "accuracy": 0.962, "error_count_24h": 47, "sync_status": "synced"},
            "Inference Engine": {"status": "active", "version": "v2.8.1", "inference_latency_ms": 89, "inference_count_24h": 8900, "accuracy": 0.951, "error_count_24h": 32, "sync_status": "synced"},
            "Model Registry": {"status": "active", "version": "v3.0.0", "inference_latency_ms": 23, "inference_count_24h": 2100, "accuracy": 0.998, "error_count_24h": 0, "sync_status": "synced"},
            "Learning Pipeline": {"status": "active", "version": "v2.5.0", "inference_latency_ms": 445, "inference_count_24h": 1200, "accuracy": 0.946, "error_count_24h": 18, "sync_status": "synced"},
            "Data Ingestion": {"status": "active", "version": "v2.1.0", "inference_latency_ms": 67, "inference_count_24h": 5600, "accuracy": 0.985, "error_count_24h": 12, "sync_status": "synced"},
            "Validation Layer": {"status": "active", "version": "v1.8.0", "inference_latency_ms": 34, "inference_count_24h": 3400, "accuracy": 0.992, "error_count_24h": 3, "sync_status": "synced"},
            "Distribution Network": {"status": "active", "version": "v2.3.0", "inference_latency_ms": 156, "inference_count_24h": 2800, "accuracy": 0.940, "error_count_24h": 8, "sync_status": "synced"},
        }

        # ── Business ──
        business_metrics = {
            "mrr": 4890,
            "mrr_growth": 24.7,
            "churn_rate": 2.4,
            "ltv_cac": 4.2,
            "nps": 72,
            "activation_rate": 0.67,
            "k_factor": 0.34,
            "arr": 58680,
        }

        # ── Security ──
        security_metrics = {
            "security_score": 94,
            "vuln_critical": 0,
            "vuln_medium": 2,
            "events_blocked": 1834,
            "mfa_enabled": True,
            "encryption_active": True,
            "certificates_valid": 4,
            "audit_pass": True,
            "suspicious_logins": 2,
        }

        return {
            "product": product_metrics,
            "platform": platform_metrics,
            "services": services_data,
            "ai": ai_models,
            "sig": sig_nodes,
            "business": business_metrics,
            "security": security_metrics,
        }

    # ── Cálculo Completo ───────────────────────────────────────────────

    def calculate_all_scores(self) -> HealthSnapshot:
        """Calcula todos os Health Scores e retorna snapshot completo."""
        metrics = self.generate_realistic_metrics()

        # Ingerir métricas
        self.product_engine.ingest(metrics["product"])
        self.platform_engine.ingest(metrics["platform"])
        self.service_monitor.update_all(metrics["services"])
        self.ai_monitor._companion_available = True
        self.ai_monitor._sync_failures = 0
        for name, data in metrics["ai"].items():
            self.ai_monitor.update_model(name, data)
        self.sig_monitor._learning_cycles_completed = 1247
        self.sig_monitor._learning_accuracy = 0.946
        self.sig_monitor._sync_failures = 2
        for name, data in metrics["sig"].items():
            self.sig_monitor.update_node(name, data)
        self.business_score.ingest(metrics["business"])
        self.security_score.ingest(metrics["security"])

        # Calcular scores
        product_score = self.product_engine.calculate()
        platform_score = self.platform_engine.calculate()
        ai_score = self.ai_monitor.calculate_score()
        sig_score = self.sig_monitor.calculate_score()
        business_score = self.business_score.calculate()
        security_score = self.security_score.calculate()

        # Snapshot
        snapshot = HealthSnapshot(
            product_score=product_score,
            platform_score=platform_score,
            ai_score=ai_score,
            sig_score=sig_score,
            security_score=security_score,
            business_score=business_score,
        )

        # Coletar alertas de todas as fontes
        snapshot.alerts = (
            self.product_engine._alerts[-10:] +
            self.platform_engine._alerts[-10:] +
            self.ai_monitor.get_alerts() +
            self.sig_monitor.get_alerts() +
            self.business_score._engine._alerts[-5:] +
            self.security_score._engine._alerts[-5:] +
            self.service_monitor.get_alerts()
        )[-30:]

        # Coletar recomendações
        snapshot.recommendations = (
            self.product_engine._recommendations[-5:] +
            self.platform_engine._recommendations[-5:] +
            self.ai_monitor._engine._recommendations[-5:] +
            self.sig_monitor._engine._recommendations[-5:]
        )[-20:]

        # Registrar no histórico
        self._history.append(snapshot)
        self._save_history()

        return snapshot

    # ── Histórico ────────────────────────────────────────────────────────

    def generate_history(self, days: int = 90):
        """Gera histórico simulado para os últimos N dias."""
        print(f"[ORCHESTRATOR] Gerando histórico de {days} dias...")

        base_metrics = self.generate_realistic_metrics()
        daily_scores = {
            "product": [], "platform": [], "ai": [],
            "sig": [], "business": [], "security": [],
        }

        for day_offset in range(days - 1, -1, -1):
            day = datetime.now(timezone.utc) - timedelta(days=day_offset)

            # Simular variação diária realista
            noise = lambda base, variance: max(0, base + random.uniform(-variance, variance))

            # Product
            product_metrics = {
                "bug_count": max(1, int(noise(7, 3))),
                "test_pass_rate": min(1.0, noise(1.0, 0.02)),
                "code_coverage": min(1.0, noise(0.942, 0.01)),
                "crash_rate": max(0, noise(0.002, 0.003)),
                "adoption_rate": min(1.0, noise(0.67, 0.05)),
                "churn_rate": max(0, noise(0.024, 0.008)),
                "response_time": max(50, noise(187, 80)),
                "feature_completion": min(1.0, noise(0.71, 0.05)),
            }
            self.product_engine.ingest(product_metrics)
            daily_scores["product"].append(self.product_engine.calculate().score)

            # Platform
            platform_metrics = {
                "uptime": min(100, noise(99.94, 0.1)),
                "cpu_usage": max(5, noise(34, 15)),
                "memory_usage": max(20, noise(61, 10)),
                "disk_usage": max(10, noise(28, 5)),
                "latency_p50": max(20, noise(48, 20)),
                "latency_p95": max(50, noise(187, 60)),
                "latency_p99": max(100, noise(412, 120)),
                "error_rate": max(0, noise(0.08, 0.05)),
                "crash_rate": max(0, noise(0.002, 0.003)),
                "requests_per_second": max(20, noise(70, 20)),
            }
            self.platform_engine.ingest(platform_metrics)
            daily_scores["platform"].append(self.platform_engine.calculate().score)

            # AI
            self.ai_monitor._companion_available = random.random() > 0.01
            self.ai_monitor._sync_failures = random.randint(0, 5)
            for name in self.ai_monitor._models:
                model_data = {
                    "status": "online" if random.random() > 0.02 else "standby",
                    "latency_avg_ms": max(50, noise(312, 150)),
                    "success_rate": max(80, noise(97.8, 5)),
                    "accuracy": max(0.75, noise(0.946, 0.05)),
                }
                self.ai_monitor.update_model(name, model_data)
            daily_scores["ai"].append(self.ai_monitor.calculate_score().score)

            # SIG
            self.sig_monitor._learning_cycles_completed = max(500, int(noise(1247, 200)))
            self.sig_monitor._learning_accuracy = max(0.85, noise(0.946, 0.04))
            self.sig_monitor._sync_failures = random.randint(0, 8)
            for name in self.sig_monitor._nodes:
                node_data = {
                    "status": "active" if random.random() > 0.02 else "standby",
                    "accuracy": max(0.80, noise(0.95, 0.05)),
                    "inference_latency_ms": max(20, noise(150, 60)),
                    "sync_status": "synced" if random.random() > 0.03 else "desynced",
                }
                self.sig_monitor.update_node(name, node_data)
            daily_scores["sig"].append(self.sig_monitor.calculate_score().score)

            # Business
            business_metrics = {
                "mrr": max(1000, noise(4890, 500)),
                "mrr_growth": max(-5, noise(24.7, 10)),
                "churn_rate": max(0.5, noise(2.4, 1.5)),
                "ltv_cac": max(1, noise(4.2, 1.0)),
                "nps": max(20, noise(72, 15)),
                "activation_rate": max(0.4, noise(0.67, 0.1)),
                "k_factor": max(0.1, noise(0.34, 0.1)),
                "arr": max(12000, noise(58680, 6000)),
            }
            self.business_score.ingest(business_metrics)
            daily_scores["business"].append(self.business_score.calculate().score)

            # Security
            security_metrics = {
                "security_score": min(100, max(60, noise(94, 5))),
                "vuln_critical": 0 if random.random() > 0.05 else 1,
                "vuln_medium": max(0, int(noise(2, 2))),
                "events_blocked": max(500, int(noise(1834, 500))),
                "mfa_enabled": True,
                "encryption_active": True,
                "certificates_valid": 4,
                "audit_pass": random.random() > 0.05,
                "suspicious_logins": random.randint(0, 15),
            }
            self.security_score.ingest(security_metrics)
            daily_scores["security"].append(self.security_score.calculate().score)

        return daily_scores

    # ── Persistência ─────────────────────────────────────────────────────

    def _save_history(self):
        """Salva histórico em arquivo JSON."""
        os.makedirs(self._data_dir, exist_ok=True)
        filepath = os.path.join(self._data_dir, "health_history.json")
        with open(filepath, "w") as f:
            json.dump({
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_entries": len(self._history),
                "entries": [s.to_dict() for s in self._history],
            }, f, indent=2, default=str)

    def get_history_data(self) -> Dict[str, Any]:
        """Retorna dados de histórico para o dashboard."""
        os.makedirs(self._data_dir, exist_ok=True)
        filepath = os.path.join(self._data_dir, "health_history.json")
        if os.path.exists(filepath):
            with open(filepath) as f:
                return json.load(f)
        return {"total_entries": 0, "entries": []}

    def get_summary(self) -> Dict[str, Any]:
        """Retorna resumo consolidado para o dashboard."""
        snapshot = self.calculate_all_scores()

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "overall_score": round(snapshot.overall_score, 1),
            "scores": {
                "product": snapshot.product_score.to_dict() if snapshot.product_score else None,
                "platform": snapshot.platform_score.to_dict() if snapshot.platform_score else None,
                "ai": snapshot.ai_score.to_dict() if snapshot.ai_score else None,
                "sig": snapshot.sig_score.to_dict() if snapshot.sig_score else None,
                "business": snapshot.business_score.to_dict() if snapshot.business_score else None,
                "security": snapshot.security_score.to_dict() if snapshot.security_score else None,
            },
            "services": self.service_monitor.get_all_services(),
            "ai_models": self.ai_monitor.get_all_models(),
            "sig_nodes": self.sig_monitor.get_all_nodes(),
            "alerts": [a.to_dict() if hasattr(a, 'to_dict') else a for a in snapshot.alerts],
            "recommendations": [r.to_dict() if hasattr(r, 'to_dict') else r for r in snapshot.recommendations],
        }


# ── Main ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  LifeOS — Product Health Intelligence")
    print("  EXECUTION-005 | PROJECT-X PHASE 5")
    print("=" * 60)

    orchestrator = ProductHealthOrchestrator()

    # Gerar histórico
    print("\n[Geração de histórico...]")
    history = orchestrator.generate_history(days=90)

    # Calcular scores atuais
    print("\n[Calculando Health Scores atuais...]")
    summary = orchestrator.get_summary()

    print("\n" + "=" * 60)
    print("  HEALTH SCORES ATUAIS")
    print("=" * 60)

    for domain, score_data in summary["scores"].items():
        if score_data:
            print(f"\n  {domain.upper():12s}  {score_data['score']:3d}/100  [{score_data['label']}]  ({score_data['trend']})")

    print(f"\n  OVERALL:       {summary['overall_score']}/100")
    print(f"\n  Alerts:        {len(summary['alerts'])}")
    print(f"  Recommendations: {len(summary['recommendations'])}")

    # Salvar dados para o dashboard
    os.makedirs(orchestrator._data_dir, exist_ok=True)
    data_file = os.path.join(orchestrator._data_dir, "dashboard_data.json")
    with open(data_file, "w") as f:
        json.dump(summary, f, indent=2, default=str)

    # Salvar histórico
    hist_file = os.path.join(orchestrator._data_dir, "history_data.json")
    with open(hist_file, "w") as f:
        json.dump(history, f, indent=2)

    print(f"\n[Dados salvos em {data_file}]")
    print(f"[Histórico salvo em {hist_file}]")
    print("\n" + "=" * 60)
    print("  PRODUCT HEALTH INTELLIGENCE COMPLETED")
    print("=" * 60)
