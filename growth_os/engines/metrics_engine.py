"""
Metrics Engine
==============
Motor de cálculo e agregação de métricas do Growth OS.

Responsável por calcular todas as métricas de crescimento,
retenção e receita com precisão e rastreabilidade.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict

from ..models.funnel import FunnelStage, FunnelEvent, FunnelEventType
from ..models.user_journey import UserJourney
from ..models.metrics import GrowthMetrics, RetentionMetrics, RevenueMetrics, CohortRetention


class MetricsEngine:
    """
    Calcula e agrega métricas de crescimento da LifeOS.

    Suporta análise por período, por canal de aquisição,
    por coorte e por segmento de usuário.
    """

    def __init__(self):
        self._events: List[FunnelEvent] = []
        self._journeys: List[UserJourney] = []

    def load_data(
        self,
        events: List[FunnelEvent],
        journeys: List[UserJourney],
    ) -> None:
        self._events = events
        self._journeys = journeys

    def calculate_cohort_retention(
        self,
        cohort_date: datetime,
        retention_days: List[int] = None,
    ) -> CohortRetention:
        """
        Calcula a retenção de uma coorte específica.

        Args:
            cohort_date: Data de cadastro da coorte.
            retention_days: Dias para calcular retenção (padrão: 1,3,7,14,30,60,90).
        """
        if retention_days is None:
            retention_days = [1, 3, 7, 14, 30, 60, 90]

        window_start = cohort_date - timedelta(hours=12)
        window_end = cohort_date + timedelta(hours=12)

        cohort_users = [
            j for j in self._journeys
            if j.signed_up_at and window_start <= j.signed_up_at <= window_end
        ]

        cohort = CohortRetention(
            cohort_date=cohort_date,
            cohort_size=len(cohort_users),
        )

        for day in retention_days:
            check_date = cohort_date + timedelta(days=day)
            if check_date > datetime.utcnow():
                continue

            retained = sum(
                1 for j in cohort_users
                if j.last_active_at and j.last_active_at >= check_date
            )

            cohort.retention_by_day[day] = retained / len(cohort_users) if cohort_users else 0.0

        return cohort

    def calculate_nps(self) -> float:
        """
        Calcula o Net Promoter Score aproximado.

        Baseado na proporção de usuários ativos vs churned.
        NPS real requer pesquisa direta com usuários.
        """
        promoters = sum(
            1 for j in self._journeys
            if j.current_stage in (
                FunnelStage.SUBSCRIBER_PRO,
                FunnelStage.SUBSCRIBER_ULTRA,
                FunnelStage.ENTERPRISE,
            ) and j.referrals_sent > 0
        )

        detractors = sum(
            1 for j in self._journeys
            if j.current_stage == FunnelStage.CHURNED
        )

        total = len(self._journeys)
        if total == 0:
            return 0.0

        return ((promoters - detractors) / total) * 100

    def calculate_viral_coefficient(self) -> float:
        """
        Calcula o coeficiente viral (K-factor) da LifeOS.

        K = (convites enviados por usuário) × (taxa de conversão dos convites)
        K > 1 indica crescimento viral.
        """
        users_with_referrals = [j for j in self._journeys if j.referrals_sent > 0]
        if not users_with_referrals:
            return 0.0

        avg_invites = sum(j.referrals_sent for j in users_with_referrals) / len(users_with_referrals)
        total_sent = sum(j.referrals_sent for j in self._journeys)
        total_converted = sum(j.referrals_converted for j in self._journeys)

        conversion_rate = total_converted / total_sent if total_sent > 0 else 0.0
        return avg_invites * conversion_rate

    def get_acquisition_breakdown(
        self,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Breakdown de aquisição por canal, campanha e dispositivo."""
        if not period_end:
            period_end = datetime.utcnow()
        if not period_start:
            period_start = period_end - timedelta(days=30)

        period_journeys = [
            j for j in self._journeys
            if j.signed_up_at and period_start <= j.signed_up_at <= period_end
        ]

        by_source: Dict[str, int] = defaultdict(int)
        by_campaign: Dict[str, int] = defaultdict(int)

        for j in period_journeys:
            by_source[j.acquisition_source or "unknown"] += 1
            if j.acquisition_campaign:
                by_campaign[j.acquisition_campaign] += 1

        return {
            "total_signups": len(period_journeys),
            "by_source": dict(sorted(by_source.items(), key=lambda x: x[1], reverse=True)),
            "by_campaign": dict(sorted(by_campaign.items(), key=lambda x: x[1], reverse=True)),
        }

    def get_feature_adoption(self) -> Dict[str, Any]:
        """Analisa a adoção de funcionalidades pelos usuários."""
        feature_counts: Dict[str, int] = defaultdict(int)

        for journey in self._journeys:
            for feature in journey.features_used:
                feature_counts[feature] += 1

        total_users = len(self._journeys)
        return {
            "features": {
                feature: {
                    "users": count,
                    "adoption_rate_pct": round(count / total_users * 100, 2) if total_users > 0 else 0.0,
                }
                for feature, count in sorted(feature_counts.items(), key=lambda x: x[1], reverse=True)
            },
            "avg_features_per_user": (
                sum(len(j.features_used) for j in self._journeys) / total_users
                if total_users > 0 else 0.0
            ),
        }
