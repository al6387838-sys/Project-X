"""
Metrics Collector
=================
Coleta métricas de todos os sistemas da LifeOS para alimentar
o monitoramento automático e os health scores.

Suporta coleta de:
    - Métricas de receita (MRR, ARR, churn)
    - Métricas de usuários (DAU, MAU, retenção)
    - Métricas de performance (latência, error rate)
    - Métricas de segurança
    - Métricas de disponibilidade
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable


@dataclass
class MetricPoint:
    """Ponto de dado de uma métrica em um instante."""
    metric_name: str
    value: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    labels: Dict[str, str] = field(default_factory=dict)
    unit: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric_name": self.metric_name,
            "value": self.value,
            "timestamp": self.timestamp.isoformat(),
            "labels": self.labels,
            "unit": self.unit,
        }


class MetricsCollector:
    """
    Coletor central de métricas da LifeOS.

    Mantém um buffer de métricas recentes e fornece
    acesso ao valor atual e histórico de cada métrica.
    Suporta registro de provedores customizados (callbacks).
    """

    def __init__(self, buffer_size: int = 1000):
        self._buffer_size = buffer_size
        self._metrics: Dict[str, List[MetricPoint]] = {}
        self._providers: Dict[str, Callable[[], float]] = {}
        self._last_collected: Optional[datetime] = None

    # ─────────────────────────────────────────────
    # Registro de métricas
    # ─────────────────────────────────────────────

    def record(
        self,
        metric_name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
        unit: str = "",
    ) -> MetricPoint:
        """Registra um ponto de dado para uma métrica."""
        point = MetricPoint(
            metric_name=metric_name,
            value=value,
            labels=labels or {},
            unit=unit,
        )
        if metric_name not in self._metrics:
            self._metrics[metric_name] = []

        self._metrics[metric_name].append(point)

        # Mantém o buffer limitado
        if len(self._metrics[metric_name]) > self._buffer_size:
            self._metrics[metric_name] = self._metrics[metric_name][-self._buffer_size:]

        return point

    def register_provider(self, metric_name: str, provider: Callable[[], float]) -> None:
        """Registra um provedor de métrica (callback)."""
        self._providers[metric_name] = provider

    def collect_all(self) -> Dict[str, float]:
        """Coleta todas as métricas registradas via providers."""
        collected = {}
        for name, provider in self._providers.items():
            try:
                value = provider()
                self.record(name, value)
                collected[name] = value
            except Exception as e:
                collected[name] = -1.0  # Indica erro na coleta
        self._last_collected = datetime.utcnow()
        return collected

    # ─────────────────────────────────────────────
    # Consulta de métricas
    # ─────────────────────────────────────────────

    def get_current(self, metric_name: str) -> Optional[float]:
        """Retorna o valor mais recente de uma métrica."""
        points = self._metrics.get(metric_name, [])
        return points[-1].value if points else None

    def get_previous(self, metric_name: str) -> Optional[float]:
        """Retorna o penúltimo valor de uma métrica."""
        points = self._metrics.get(metric_name, [])
        return points[-2].value if len(points) >= 2 else None

    def get_history(
        self,
        metric_name: str,
        limit: int = 30,
    ) -> List[MetricPoint]:
        """Retorna o histórico de uma métrica."""
        points = self._metrics.get(metric_name, [])
        return points[-limit:]

    def get_change_pct(self, metric_name: str) -> Optional[float]:
        """Calcula a variação percentual entre o valor atual e o anterior."""
        current = self.get_current(metric_name)
        previous = self.get_previous(metric_name)
        if current is None or previous is None or previous == 0:
            return None
        return round((current - previous) / abs(previous) * 100, 2)

    def get_all_current(self) -> Dict[str, float]:
        """Retorna o valor atual de todas as métricas."""
        return {
            name: points[-1].value
            for name, points in self._metrics.items()
            if points
        }

    def get_snapshot(self) -> Dict[str, Any]:
        """Retorna um snapshot completo de todas as métricas."""
        return {
            "snapshot_at": datetime.utcnow().isoformat(),
            "last_collected": self._last_collected.isoformat() if self._last_collected else None,
            "total_metrics": len(self._metrics),
            "metrics": {
                name: {
                    "current": points[-1].value if points else None,
                    "previous": points[-2].value if len(points) >= 2 else None,
                    "data_points": len(points),
                    "last_updated": points[-1].timestamp.isoformat() if points else None,
                }
                for name, points in self._metrics.items()
            }
        }
