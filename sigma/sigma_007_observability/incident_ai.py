"""
Incident AI Detector — AI-Powered Incident Detection for LifeOS.
SIGMA-007: Observability Pro
"""

import time
import math
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class IncidentSeverity(Enum):
    P1 = "p1_critical"
    P2 = "p2_major"
    P3 = "p3_minor"
    P4 = "p4_low"


class IncidentStatus(Enum):
    DETECTED = "detected"
    INVESTIGATING = "investigating"
    IDENTIFIED = "identified"
    MONITORING = "monitoring"
    RESOLVED = "resolved"


@dataclass
class Anomaly:
    """A detected anomaly."""
    metric_name: str
    value: float
    expected_value: float
    deviation_pct: float
    timestamp: float = 0.0
    severity: IncidentSeverity = IncidentSeverity.P4
    description: str = ""


@dataclass
class Incident:
    """A detected incident."""
    incident_id: str
    title: str
    severity: IncidentSeverity
    status: IncidentStatus = IncidentStatus.DETECTED
    anomalies: List[Anomaly] = field(default_factory=list)
    detected_at: float = 0.0
    resolved_at: float = 0.0
    root_cause: str = ""
    resolution: str = ""
    affected_services: List[str] = field(default_factory=list)
    timeline: List[Dict[str, str]] = field(default_factory=list)


class IncidentAIDetector:
    """
    World-Class AI-Powered Incident Detection for LifeOS.

    SIGMA-007: Implements:
    - Anomaly detection via statistical analysis (Z-score)
    - Trend analysis for predictive detection
    - Correlation analysis between metrics
    - Automatic incident creation
    - Root cause hypothesis generation
    - Incident severity classification
    """

    def __init__(self, name: str = "incident_ai_detector") -> None:
        self.name = name
        self._history: Dict[str, List[float]] = {}
        self._incidents: List[Incident] = []
        self._anomaly_threshold = 2.5  # Z-score threshold
        self._trend_window = 20
        self._correlation_threshold = 0.8
        self._stats = {
            "total_anomalies": 0,
            "total_incidents": 0,
            "resolved": 0,
            "false_positives": 0,
        }

    def record_metric(self, metric_name: str, value: float) -> List[Anomaly]:
        """Record a metric value and detect anomalies."""
        if metric_name not in self._history:
            self._history[metric_name] = []
        self._history[metric_name].append(value)

        anomalies = []

        # Keep only last N values for analysis
        if len(self._history[metric_name]) > self._trend_window:
            self._history[metric_name] = self._history[metric_name][-self._trend_window:]

        # Detect anomalies if we have enough data
        if len(self._history[metric_name]) >= 5:
            anomaly = self._detect_anomaly(metric_name, value)
            if anomaly:
                anomalies.append(anomaly)

        return anomalies

    def _detect_anomaly(self, metric_name: str, value: float) -> Optional[Anomaly]:
        """Detect anomaly using Z-score method."""
        values = self._history[metric_name]
        n = len(values)
        if n < 3:
            return None

        mean = sum(values) / n
        variance = sum((x - mean) ** 2 for x in values) / n
        std_dev = math.sqrt(variance) if variance > 0 else 0

        if std_dev == 0:
            return None

        z_score = (value - mean) / std_dev

        if abs(z_score) > self._anomaly_threshold:
            deviation = abs(value - mean) / mean * 100 if mean != 0 else 100

            # Classify severity
            if abs(z_score) > 4.0:
                severity = IncidentSeverity.P1
            elif abs(z_score) > 3.5:
                severity = IncidentSeverity.P2
            elif abs(z_score) > 3.0:
                severity = IncidentSeverity.P3
            else:
                severity = IncidentSeverity.P4

            self._stats["total_anomalies"] += 1

            return Anomaly(
                metric_name=metric_name,
                value=value,
                expected_value=mean,
                deviation_pct=round(deviation, 2),
                timestamp=time.time(),
                severity=severity,
                description=f"Z-score: {z_score:.2f}, deviation: {deviation:.1f}%",
            )

        return None

    def analyze_correlations(self) -> Dict[str, Any]:
        """Analyze correlations between metrics to find root causes."""
        results = {}
        metric_names = list(self._history.keys())

        for i, m1 in enumerate(metric_names):
            for j, m2 in enumerate(metric_names):
                if i >= j:
                    continue
                corr = self._pearson_correlation(m1, m2)
                if abs(corr) > self._correlation_threshold:
                    results[f"{m1} <-> {m2}"] = {
                        "correlation": round(corr, 4),
                        "relationship": "positive" if corr > 0 else "negative",
                    }

        return results

    def _pearson_correlation(self, m1: str, m2: str) -> float:
        """Calculate Pearson correlation between two metrics."""
        vals1 = self._history[m1]
        vals2 = self._history[m2]
        min_len = min(len(vals1), len(vals2))
        if min_len < 3:
            return 0.0

        x = vals1[-min_len:]
        y = vals2[-min_len:]

        mean_x = sum(x) / len(x)
        mean_y = sum(y) / len(y)

        numerator = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
        denom_x = math.sqrt(sum((xi - mean_x) ** 2 for xi in x))
        denom_y = math.sqrt(sum((yi - mean_y) ** 2 for yi in y))

        if denom_x == 0 or denom_y == 0:
            return 0.0

        return numerator / (denom_x * denom_y)

    def create_incident(self, anomalies: List[Anomaly]) -> Incident:
        """Create an incident from detected anomalies."""
        import hashlib
        incident_id = hashlib.md5(f"incident-{time.time()}".encode()).hexdigest()[:12]

        # Determine overall severity
        severities = [a.severity.value for a in anomalies]
        if IncidentSeverity.P1.value in severities:
            severity = IncidentSeverity.P1
        elif IncidentSeverity.P2.value in severities:
            severity = IncidentSeverity.P2
        elif IncidentSeverity.P3.value in severities:
            severity = IncidentSeverity.P3
        else:
            severity = IncidentSeverity.P4

        incident = Incident(
            incident_id=incident_id,
            title=f"Incident: {', '.join(a.metric_name for a in anomalies)}",
            severity=severity,
            anomalies=anomalies,
            detected_at=time.time(),
            affected_services=[a.metric_name for a in anomalies],
            timeline=[{"time": time.time(), "event": "Anomaly detected"}],
        )

        self._incidents.append(incident)
        self._stats["total_incidents"] += 1

        logger.warning(f"[IncidentAI] Incident created: {incident.title} ({severity.value})")
        return incident

    def resolve_incident(self, incident_id: str, root_cause: str = "", resolution: str = "") -> bool:
        """Resolve an incident."""
        for incident in self._incidents:
            if incident.incident_id == incident_id:
                incident.status = IncidentStatus.RESOLVED
                incident.resolved_at = time.time()
                incident.root_cause = root_cause
                incident.resolution = resolution
                incident.timeline.append({"time": time.time(), "event": "Resolved"})
                self._stats["resolved"] += 1
                return True
        return False

    def get_incidents(self) -> List[Incident]:
        return list(self._incidents)

    def get_active_incidents(self) -> List[Incident]:
        return [i for i in self._incidents if i.status != IncidentStatus.RESOLVED]

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "metrics_tracked": len(self._history),
            "total_anomalies": self._stats["total_anomalies"],
            "active_incidents": len(self.get_active_incidents()),
        }

    def __repr__(self) -> str:
        return (
            f"IncidentAIDetector(name={self.name!r}, "
            f"anomalies={self._stats['total_anomalies']}, "
            f"incidents={self._stats['total_incidents']})"
        )
