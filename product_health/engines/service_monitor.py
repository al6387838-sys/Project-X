"""
LifeOS — Service Monitor
==============================================================
Monitora individualmente cada serviço/microsserviço da plataforma,
rastreando disponibilidade, latência, erros e crash rate.

EXECUTION-005 | PROJECT-X PHASE 5
==============================================================
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from .health_engine import HealthEngine, HealthDomain, HealthScore, HealthAlert


@dataclass
class ServiceStatus:
    """Status de um serviço individual."""
    name: str
    status: str = "online"           # online, degraded, offline, maintenance
    uptime_percent: float = 100.0
    latency_avg_ms: float = 0.0
    error_rate_percent: float = 0.0
    crash_count_24h: int = 0
    last_healthcheck: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_crash: Optional[datetime] = None
    incidents_count_30d: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "uptime_percent": self.uptime_percent,
            "latency_avg_ms": self.latency_avg_ms,
            "error_rate_percent": self.error_rate_percent,
            "crash_count_24h": self.crash_count_24h,
            "last_healthcheck": self.last_healthcheck.isoformat(),
            "last_crash": self.last_crash.isoformat() if self.last_crash else None,
            "incidents_count_30d": self.incidents_count_30d,
        }


class ServiceMonitor:
    """
    Monitor de serviços — acompanha cada microsserviço do LifeOS.
    Detecta falhas de sincronização, indisponibilidade e anomalias.
    """

    # Serviços conhecidos do LifeOS
    KNOWN_SERVICES = [
        "Life Kernel",
        "Intelligence Hub",
        "Action Engine",
        "Decision Engine",
        "Learning Engine",
        "Connector Platform",
        "Security Center",
        "API Gateway",
        "Database (Primary)",
        "Database (Replica)",
        "Redis Cache",
        "Object Storage",
    ]

    def __init__(self):
        self._services: Dict[str, ServiceStatus] = {}
        self._alerts: List[HealthAlert] = []
        self._alerts_engine = HealthEngine(HealthDomain.PLATFORM)

        # Inicializar serviços conhecidos
        for svc_name in self.KNOWN_SERVICES:
            self._services[svc_name] = ServiceStatus(name=svc_name)

    # ── Ingestão ─────────────────────────────────────────────────────────

    def update_service(self, name: str, data: Dict[str, Any]):
        """Atualiza o status de um serviço com novos dados."""
        if name not in self._services:
            self._services[name] = ServiceStatus(name=name)

        svc = self._services[name]

        if "status" in data:
            svc.status = data["status"]
        if "uptime_percent" in data:
            svc.uptime_percent = float(data["uptime_percent"])
        if "latency_avg_ms" in data:
            svc.latency_avg_ms = float(data["latency_avg_ms"])
        if "error_rate_percent" in data:
            svc.error_rate_percent = float(data["error_rate_percent"])
        if "crash_count_24h" in data:
            svc.crash_count_24h = int(data["crash_count_24h"])
            if svc.crash_count_24h > 0:
                svc.last_crash = datetime.now(timezone.utc)
        if "incidents_count_30d" in data:
            svc.incidents_count_30d = int(data["incidents_count_30d"])

        svc.last_healthcheck = datetime.now(timezone.utc)

        # Verificar alertas
        self._check_service_health(svc)

    def update_all(self, services_data: Dict[str, Dict[str, Any]]):
        """Atualiza todos os serviços de uma vez."""
        for name, data in services_data.items():
            self.update_service(name, data)

    # ── Verificação de Saúde ─────────────────────────────────────────────

    def _check_service_health(self, svc: ServiceStatus):
        """Verifica a saúde de um serviço individual e gera alertas se necessário."""
        # Offline
        if svc.status == "offline":
            self._alerts_engine.generate_alert(
                severity="critical",
                title=f"Serviço Offline: {svc.name}",
                message=f"O serviço {svc.name} está indisponível. {svc.crash_count_24h} crashes nas últimas 24h.",
                metric_name="service_status",
                metric_value="offline",
                threshold="online",
            )

        # Degraded
        elif svc.status == "degraded":
            self._alerts_engine.generate_alert(
                severity="warning",
                title=f"Serviço Degradado: {svc.name}",
                message=(
                    f"O serviço {svc.name} está degradado. "
                    f"Latência: {svc.latency_avg_ms:.0f}ms, "
                    f"Erros: {svc.error_rate_percent:.2f}%."
                ),
                metric_name="service_status",
                metric_value="degraded",
                threshold="online",
            )

        # Falha de sincronização (para serviços de data/sync)
        sync_services = ["Database (Primary)", "Database (Replica)", "Redis Cache"]
        if svc.name in sync_services and svc.error_rate_percent > 1.0:
            self._alerts_engine.generate_alert(
                severity="critical",
                title=f"Falha de Sincronização: {svc.name}",
                message=(
                    f"Taxa de erros de sincronização: {svc.error_rate_percent:.2f}%. "
                    f"Verificar replicação e consistência de dados."
                ),
                metric_name="sync_error_rate",
                metric_value=f"{svc.error_rate_percent:.2f}%",
                threshold="1.0%",
            )

    # ── Queries ──────────────────────────────────────────────────────────

    def get_all_services(self) -> List[Dict[str, Any]]:
        """Retorna status de todos os serviços."""
        return [svc.to_dict() for svc in self._services.values()]

    def get_healthy_count(self) -> int:
        """Retorna quantidade de serviços saudáveis."""
        return sum(
            1 for svc in self._services.values()
            if svc.status == "online" and svc.error_rate_percent < 1.0
        )

    def get_degraded_count(self) -> int:
        """Retorna quantidade de serviços degradados."""
        return sum(1 for svc in self._services.values() if svc.status == "degraded")

    def get_offline_count(self) -> int:
        """Retorna quantidade de serviços offline."""
        return sum(1 for svc in self._services.values() if svc.status == "offline")

    def get_critical_services(self) -> List[Dict[str, Any]]:
        """Retorna serviços com problemas críticos."""
        critical = []
        for svc in self._services.values():
            if svc.status in ("offline", "degraded") or svc.crash_count_24h > 3:
                critical.append(svc.to_dict())
        return critical

    def get_alerts(self) -> List[Dict[str, Any]]:
        """Retorna todos os alertas ativos."""
        return [a.to_dict() for a in self._alerts_engine._alerts[-20:]]
