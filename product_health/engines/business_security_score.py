"""
LifeOS — Business & Security Health Scores
==============================================================
Cálculo do Business Health Score e Security Health Score.
Não são engines completas, mas calculadores de score compostos.

EXECUTION-005 | PROJECT-X PHASE 5
==============================================================
"""

from __future__ import annotations
from typing import Dict, List, Any

from .health_engine import HealthEngine, HealthDomain, HealthScore


class BusinessHealthScore:
    """
    Calcula o Business Health Score (0–100).
    Baseado em: MRR growth, churn, LTV/CAC, NPS, ativação, K-Factor.
    """

    def __init__(self):
        self._engine = HealthEngine(HealthDomain.BUSINESS)
        self._mrr = 0.0
        self._mrr_growth = 0.0
        self._churn_rate = 0.0
        self._ltv_cac = 0.0
        self._nps = 0.0
        self._activation_rate = 0.0
        self._k_factor = 0.0
        self._arr = 0.0

    def ingest(self, metrics: Dict[str, float]):
        for key, value in metrics.items():
            attr = f"_{key}"
            if hasattr(self, attr):
                setattr(self, attr, float(value))

    def calculate(self) -> HealthScore:
        metrics = {
            "mrr_growth": min(100, max(0, (self._mrr_growth + 20) * 2.5)),
            "churn_health": max(0, 100 - (self._churn_rate * 5)),
            "ltv_cac_health": min(100, max(0, (self._ltv_cac / 5) * 100)),
            "nps_health": min(100, max(0, self._nps + 30)),
            "activation_health": min(100, self._activation_rate * 100),
            "k_factor_health": min(100, max(0, (self._k_factor / 1) * 100)),
        }

        weights = {
            "mrr_growth": 0.25,
            "churn_health": 0.20,
            "ltv_cac_health": 0.20,
            "nps_health": 0.15,
            "activation_health": 0.10,
            "k_factor_health": 0.10,
        }

        score = self._engine.calculate_score(metrics, weights)
        trend = self._engine.detect_trend(
            [s.score for s in self._engine._scores_history[-7:]]
        )

        health_score = HealthScore(
            domain=HealthDomain.BUSINESS,
            score=score,
            trend=trend,
            components=metrics,
        )
        self._engine.record_score(health_score)

        # Alertas de negócio
        if metrics["churn_health"] < 60:
            self._engine.generate_alert(
                severity="warning",
                title="Churn Rate Elevado",
                message=f"Churn: {self._churn_rate:.1f}%. Saúde em {metrics['churn_health']:.0f}/100.",
                metric_name="churn_health",
                metric_value=f"{self._churn_rate:.1f}%",
                threshold="5%",
            )

        if metrics["ltv_cac_health"] < 50:
            self._engine.generate_alert(
                severity="warning",
                title="LTV/CAC Insustentável",
                message=f"LTV/CAC: {self._ltv_cac:.1f}x. Saúde em {metrics['ltv_cac_health']:.0f}/100.",
                metric_name="ltv_cac_health",
                metric_value=f"{self._ltv_cac:.1f}x",
                threshold="3.0x",
            )

        return health_score


class SecurityHealthScore:
    """
    Calcula o Security Health Score (0–100).
    Baseado em: score de segurança, vulnerabilidades,
    eventos bloqueados, MFA, certificação.
    """

    def __init__(self):
        self._engine = HealthEngine(HealthDomain.SECURITY)
        self._security_score = 0.0
        self._vuln_critical = 0
        self._vuln_medium = 0
        self._events_blocked = 0
        self._mfa_enabled = False
        self._encryption_active = False
        self._certificates_valid = 0
        self._audit_pass = True
        self._suspicious_logins = 0

    def ingest(self, metrics: Dict[str, Any]):
        for key, value in metrics.items():
            attr = f"_{key}"
            if hasattr(self, attr):
                setattr(self, attr, value)

    def calculate(self) -> HealthScore:
        metrics = {
            "security_score": min(100, self._security_score),
            "vuln_health": max(0, 100 - (self._vuln_critical * 25) - (self._vuln_medium * 5)),
            "certificates_health": min(100, (self._certificates_valid / max(1, 4)) * 100),
            "mfa_health": 100 if self._mfa_enabled else 30,
            "encryption_health": 100 if self._encryption_active else 30,
            "audit_health": 100 if self._audit_pass else 50,
        }

        weights = {
            "security_score": 0.25,
            "vuln_health": 0.20,
            "certificates_health": 0.15,
            "mfa_health": 0.15,
            "encryption_health": 0.15,
            "audit_health": 0.10,
        }

        score = self._engine.calculate_score(metrics, weights)
        trend = self._engine.detect_trend(
            [s.score for s in self._engine._scores_history[-7:]]
        )

        health_score = HealthScore(
            domain=HealthDomain.SECURITY,
            score=score,
            trend=trend,
            components=metrics,
        )
        self._engine.record_score(health_score)

        # Alertas de segurança
        if self._vuln_critical > 0:
            self._engine.generate_alert(
                severity="critical",
                title="Vulnerabilidades Críticas Detectadas",
                message=f"{self._vuln_critical} vulnerabilidades críticas abertas.",
                metric_name="vuln_critical",
                metric_value=str(self._vuln_critical),
                threshold="0",
            )

        if self._suspicious_logins > 10:
            self._engine.generate_alert(
                severity="warning",
                title="Login Suspeito Detectado",
                message=f"{self._suspicious_logins} logins suspeitos nas últimas 24h.",
                metric_name="suspicious_logins",
                metric_value=str(self._suspicious_logins),
                threshold="10",
            )

        return health_score
