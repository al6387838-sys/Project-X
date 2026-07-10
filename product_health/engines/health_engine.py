"""
LifeOS — Health Engine Core
==============================================================
Motor base para cálculo de Health Scores (0–100),
geração de alertas automáticos e recomendações inteligentes.

EXECUTION-005 | PROJECT-X PHASE 5
==============================================================
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import List, Dict, Any, Optional


class Severity(Enum):
    """Nível de severidade de um alerta."""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"
    OK = "ok"


class HealthDomain(Enum):
    """Domínios de saúde do LifeOS."""
    PRODUCT = "product"
    PLATFORM = "platform"
    AI = "ai"
    SIG = "sig"
    SECURITY = "security"
    BUSINESS = "business"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class HealthScore:
    """Representa um Health Score calculado (0–100)."""
    domain: HealthDomain
    score: int = 0
    label: str = "Desconhecido"
    trend: str = "—"           # "up", "down", "stable"
    components: Dict[str, float] = field(default_factory=dict)
    calculated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        self.score = max(0, min(100, int(self.score)))
        self.label = self._resolve_label()

    def _resolve_label(self) -> str:
        if self.score >= 90:
            return "EXCELENTE"
        elif self.score >= 75:
            return "BOM"
        elif self.score >= 60:
            return "REGULAR"
        elif self.score >= 40:
            return "ATENÇÃO"
        else:
            return "CRÍTICO"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain.value,
            "score": self.score,
            "label": self.label,
            "trend": self.trend,
            "components": self.components,
            "calculated_at": self.calculated_at.isoformat(),
        }


@dataclass
class HealthAlert:
    """Alerta automático gerado pelo Health Engine."""
    alert_id: str
    domain: HealthDomain
    severity: Severity
    title: str
    message: str
    metric_name: str = ""
    metric_value: str = ""
    threshold: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    acknowledged: bool = False

    def to_dict(self) -> Dict[str, Any]:
        sev = self.severity.value if isinstance(self.severity, Severity) else str(self.severity)
        return {
            "alert_id": self.alert_id,
            "domain": self.domain.value,
            "severity": sev,
            "title": self.title,
            "message": self.message,
            "metric_name": self.metric_name,
            "metric_value": self.metric_value,
            "threshold": self.threshold,
            "timestamp": self.timestamp.isoformat(),
            "acknowledged": self.acknowledged,
        }


@dataclass
class HealthRecommendation:
    """Recomendação automática gerada com base em anomalias detectadas."""
    rec_id: str
    domain: HealthDomain
    priority: int  # 1 = mais urgente
    title: str
    description: str
    suggested_action: str
    module: str = ""
    confidence: float = 0.0  # 0–1
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rec_id": self.rec_id,
            "domain": self.domain.value,
            "priority": self.priority,
            "title": self.title,
            "description": self.description,
            "suggested_action": self.suggested_action,
            "module": self.module,
            "confidence": self.confidence,
            "generated_at": self.generated_at.isoformat(),
        }


@dataclass
class HealthSnapshot:
    """Snapshot completo de saúde em um ponto no tempo."""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    product_score: Optional[HealthScore] = None
    platform_score: Optional[HealthScore] = None
    ai_score: Optional[HealthScore] = None
    sig_score: Optional[HealthScore] = None
    security_score: Optional[HealthScore] = None
    business_score: Optional[HealthScore] = None
    alerts: List[HealthAlert] = field(default_factory=list)
    recommendations: List[HealthRecommendation] = field(default_factory=list)

    @property
    def overall_score(self) -> float:
        scores = []
        for s in [self.product_score, self.platform_score, self.ai_score,
                   self.sig_score, self.security_score, self.business_score]:
            if s is not None:
                scores.append(s.score)
        return sum(scores) / len(scores) if scores else 0

    def to_dict(self) -> Dict[str, Any]:
        alerts_list = []
        for a in self.alerts:
            if isinstance(a, HealthAlert):
                alerts_list.append(a.to_dict())
            elif isinstance(a, dict):
                alerts_list.append(a)
            else:
                alerts_list.append(str(a))

        recs_list = []
        for r in self.recommendations:
            if isinstance(r, HealthRecommendation):
                recs_list.append(r.to_dict())
            elif isinstance(r, dict):
                recs_list.append(r)
            else:
                recs_list.append(str(r))

        return {
            "timestamp": self.timestamp.isoformat(),
            "overall_score": round(self.overall_score, 1),
            "product_score": self.product_score.to_dict() if self.product_score else None,
            "platform_score": self.platform_score.to_dict() if self.platform_score else None,
            "ai_score": self.ai_score.to_dict() if self.ai_score else None,
            "sig_score": self.sig_score.to_dict() if self.sig_score else None,
            "security_score": self.security_score.to_dict() if self.security_score else None,
            "business_score": self.business_score.to_dict() if self.business_score else None,
            "alerts": alerts_list,
            "recommendations": recs_list,
        }


# ─── Base Health Engine ─────────────────────────────────────────────────────

class HealthEngine:
    """
    Motor base para cálculo de Health Scores.
    Todas as engines específicas herdam desta classe.
    """

    def __init__(self, domain: HealthDomain):
        self.domain = domain
        self._scores_history: List[HealthScore] = []
        self._alerts: List[HealthAlert] = []
        self._recommendations: List[HealthRecommendation] = []

    # ── Cálculo de Score ─────────────────────────────────────────────────

    def calculate_score(self, metrics: Dict[str, float], weights: Dict[str, float]) -> int:
        """
        Calcula Health Score ponderado.

        Args:
            metrics: Dicionário {nome_metrica: valor_atual}
            weights: Dicionário {nome_metrica: peso} (soma deve ser 1.0)

        Returns:
            Score normalizado 0–100
        """
        total_weight = sum(weights.values())
        if total_weight == 0:
            return 0

        weighted_sum = 0.0
        for key, weight in weights.items():
            value = metrics.get(key, 0)
            weighted_sum += value * weight

        return max(0, min(100, int(weighted_sum / total_weight)))

    # ── Anomalia Detection ───────────────────────────────────────────────

    def detect_anomaly(self, current: float, baseline: float,
                       threshold_pct: float = 15.0) -> Optional[float]:
        """
        Detecta se o valor atual representa uma anomalia em relação à baseline.

        Returns:
            Percentual de variação se for anomalia, None se normal.
        """
        if baseline == 0:
            return None
        variation = ((current - baseline) / baseline) * 100
        if abs(variation) >= threshold_pct:
            return variation
        return None

    # ── Alert Generation ─────────────────────────────────────────────────

    def generate_alert(self, severity: Severity, title: str,
                       message: str, metric_name: str = "",
                       metric_value: str = "", threshold: str = "") -> HealthAlert:
        """Gera um novo alerta e o armazena."""
        import hashlib
        alert_id = hashlib.md5(
            f"{title}{message}{datetime.now(timezone.utc).isoformat()}".encode()
        ).hexdigest()[:8]

        alert = HealthAlert(
            alert_id=f"{self.domain.value}_{alert_id}",
            domain=self.domain,
            severity=severity,
            title=title,
            message=message,
            metric_name=metric_name,
            metric_value=metric_value,
            threshold=threshold,
        )
        self._alerts.append(alert)
        return alert

    # ── Recommendation Generation ────────────────────────────────────────

    def generate_recommendation(self, title: str, description: str,
                                suggested_action: str, module: str = "",
                                confidence: float = 0.8) -> HealthRecommendation:
        """Gera uma recomendação automática."""
        import hashlib
        rec_id = hashlib.md5(
            f"{title}{module}{datetime.now(timezone.utc).isoformat()}".encode()
        ).hexdigest()[:8]

        rec = HealthRecommendation(
            rec_id=f"{self.domain.value}_{rec_id}",
            domain=self.domain,
            priority=1 if confidence > 0.7 else 2,
            title=title,
            description=description,
            suggested_action=suggested_action,
            module=module,
            confidence=confidence,
        )
        self._recommendations.append(rec)
        return rec

    # ── Trend Detection ──────────────────────────────────────────────────

    def detect_trend(self, history: List[float], window: int = 7) -> str:
        """
        Detecta tendência (up/down/stable) com base no histórico recente.

        Args:
            history: Lista de valores históricos
            window: Tamanho da janela para análise

        Returns:
            "up", "down" ou "stable"
        """
        if len(history) < 2:
            return "stable"
        recent = history[-min(window, len(history)):]
        if len(recent) < 2:
            return "stable"
        avg_first = sum(recent[:len(recent)//2]) / max(1, len(recent)//2)
        avg_last = sum(recent[len(recent)//2:]) / max(1, len(recent) - len(recent)//2)
        if avg_first == 0:
            return "stable"
        change = ((avg_last - avg_first) / avg_first) * 100
        if change > 5:
            return "up"
        elif change < -5:
            return "down"
        return "stable"

    # ── History ──────────────────────────────────────────────────────────

    def record_score(self, score: HealthScore):
        """Registra um score no histórico."""
        self._scores_history.append(score)

    def get_history(self, period: str = "daily") -> List[Dict[str, Any]]:
        """
        Retorna histórico de scores.

        Args:
            period: "daily", "weekly" ou "monthly"
        """
        return [s.to_dict() for s in self._scores_history[-90:]]  # últimos 90 registros

    # ── Snapshot ─────────────────────────────────────────────────────────

    def create_snapshot(self) -> HealthSnapshot:
        """Cria um snapshot completo com scores, alertas e recomendações."""
        return HealthSnapshot(
            alerts=list(self._alerts[-20:]),
            recommendations=list(self._recommendations[-10:]),
        )
