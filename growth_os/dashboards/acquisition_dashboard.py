"""
Acquisition Dashboard
=====================
Dashboard de aquisição do Growth OS da LifeOS.

Exibe métricas de novos usuários, canais de aquisição,
taxas de conversão do topo do funil e eficiência de campanhas.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict

from ..models.funnel import FunnelStage, FunnelEvent, FunnelEventType
from ..models.user_journey import UserJourney
from ..engines.funnel_engine import FunnelEngine
from ..engines.metrics_engine import MetricsEngine


class AcquisitionDashboard:
    """
    Dashboard de aquisição da LifeOS.

    Consolida todas as métricas relacionadas à aquisição de novos usuários:
    - Novos visitantes e cadastros por período
    - Breakdown por canal de aquisição
    - Eficiência de campanhas pagas
    - Taxa Visitor→Signup
    - CAC por canal
    - Impacto do programa de referral na aquisição
    """

    def __init__(
        self,
        funnel_engine: Optional[FunnelEngine] = None,
        metrics_engine: Optional[MetricsEngine] = None,
    ):
        self._funnel_engine = funnel_engine or FunnelEngine()
        self._metrics_engine = metrics_engine or MetricsEngine()
        self._journeys: List[UserJourney] = []
        self._events: List[FunnelEvent] = []

    def load_data(self, journeys: List[UserJourney], events: List[FunnelEvent]) -> None:
        """Carrega dados para o dashboard."""
        self._journeys = journeys
        self._events = events
        self._funnel_engine.load_data(
            conversions=[c for j in journeys for c in j.conversions],
            journeys=journeys,
        )
        self._metrics_engine.load_data(events=events, journeys=journeys)

    def get_overview(
        self,
        period_days: int = 30,
        compare_previous: bool = True,
    ) -> Dict[str, Any]:
        """
        Visão geral de aquisição para o período especificado.

        Args:
            period_days: Número de dias do período de análise.
            compare_previous: Se True, compara com o período anterior.
        """
        now = datetime.utcnow()
        period_end = now
        period_start = now - timedelta(days=period_days)
        prev_start = period_start - timedelta(days=period_days)
        prev_end = period_start

        current = self._calculate_acquisition_metrics(period_start, period_end)

        result = {
            "period": {
                "start": period_start.isoformat(),
                "end": period_end.isoformat(),
                "days": period_days,
            },
            "metrics": current,
        }

        if compare_previous:
            previous = self._calculate_acquisition_metrics(prev_start, prev_end)
            result["comparison"] = {
                "previous_period": previous,
                "changes": self._calculate_changes(current, previous),
            }

        return result

    def get_channel_breakdown(
        self,
        period_days: int = 30,
    ) -> Dict[str, Any]:
        """
        Breakdown detalhado por canal de aquisição.

        Mostra volume, taxa de conversão e CAC estimado por canal.
        """
        now = datetime.utcnow()
        period_start = now - timedelta(days=period_days)

        channels = defaultdict(lambda: {
            "visitors": 0,
            "signups": 0,
            "activated": 0,
            "subscribers": 0,
            "conversion_rate": 0.0,
            "activation_rate": 0.0,
        })

        for journey in self._journeys:
            if not journey.first_seen_at or journey.first_seen_at < period_start:
                continue

            src = journey.acquisition_source or "unknown"
            channels[src]["visitors"] += 1

            if journey.signed_up_at and journey.signed_up_at >= period_start:
                channels[src]["signups"] += 1

            if journey.activated_at and journey.activated_at >= period_start:
                channels[src]["activated"] += 1

            if journey.current_stage in (
                FunnelStage.SUBSCRIBER_PRO,
                FunnelStage.SUBSCRIBER_ULTRA,
                FunnelStage.ENTERPRISE,
            ):
                channels[src]["subscribers"] += 1

        # Calcula taxas
        for src, data in channels.items():
            if data["visitors"] > 0:
                data["conversion_rate"] = round(data["signups"] / data["visitors"] * 100, 2)
            if data["signups"] > 0:
                data["activation_rate"] = round(data["activated"] / data["signups"] * 100, 2)

        return {
            "period_days": period_days,
            "channels": dict(sorted(
                channels.items(),
                key=lambda x: x[1]["signups"],
                reverse=True,
            )),
            "top_channel": max(channels.items(), key=lambda x: x[1]["signups"])[0] if channels else None,
        }

    def get_daily_signups(
        self,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Série temporal de novos cadastros por dia.

        Retorna dados prontos para renderização em gráfico de linha.
        """
        now = datetime.utcnow()
        result = []

        for i in range(days - 1, -1, -1):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)

            signups = sum(
                1 for j in self._journeys
                if j.signed_up_at and day_start <= j.signed_up_at <= day_end
            )

            visitors = sum(
                1 for j in self._journeys
                if j.first_seen_at and day_start <= j.first_seen_at <= day_end
            )

            result.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "visitors": visitors,
                "signups": signups,
                "conversion_rate_pct": round(signups / visitors * 100, 2) if visitors > 0 else 0.0,
            })

        return result

    def get_campaign_performance(
        self,
        period_days: int = 30,
    ) -> Dict[str, Any]:
        """
        Performance de campanhas de marketing.

        Mostra quais campanhas geraram mais cadastros e conversões.
        """
        now = datetime.utcnow()
        period_start = now - timedelta(days=period_days)

        campaigns = defaultdict(lambda: {
            "signups": 0,
            "activated": 0,
            "subscribers": 0,
            "revenue": 0.0,
        })

        for journey in self._journeys:
            if not journey.signed_up_at or journey.signed_up_at < period_start:
                continue

            campaign = journey.acquisition_campaign or "direct"
            campaigns[campaign]["signups"] += 1

            if journey.activated_at:
                campaigns[campaign]["activated"] += 1

            if journey.current_stage in (
                FunnelStage.SUBSCRIBER_PRO,
                FunnelStage.SUBSCRIBER_ULTRA,
                FunnelStage.ENTERPRISE,
            ):
                campaigns[campaign]["subscribers"] += 1
                campaigns[campaign]["revenue"] += journey.total_revenue

        return {
            "period_days": period_days,
            "campaigns": dict(sorted(
                campaigns.items(),
                key=lambda x: x[1]["revenue"],
                reverse=True,
            )),
        }

    def _calculate_acquisition_metrics(
        self, start: datetime, end: datetime
    ) -> Dict[str, Any]:
        """Calcula métricas de aquisição para um período."""
        visitors = sum(
            1 for j in self._journeys
            if j.first_seen_at and start <= j.first_seen_at <= end
        )
        signups = sum(
            1 for j in self._journeys
            if j.signed_up_at and start <= j.signed_up_at <= end
        )
        activated = sum(
            1 for j in self._journeys
            if j.activated_at and start <= j.activated_at <= end
        )
        referral_signups = sum(
            1 for j in self._journeys
            if j.signed_up_at
            and start <= j.signed_up_at <= end
            and j.referral_code_used
        )

        return {
            "visitors": visitors,
            "signups": signups,
            "activated": activated,
            "referral_signups": referral_signups,
            "visitor_to_signup_pct": round(signups / visitors * 100, 2) if visitors > 0 else 0.0,
            "signup_to_activation_pct": round(activated / signups * 100, 2) if signups > 0 else 0.0,
            "referral_share_pct": round(referral_signups / signups * 100, 2) if signups > 0 else 0.0,
        }

    @staticmethod
    def _calculate_changes(
        current: Dict[str, Any], previous: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calcula variações percentuais entre dois períodos."""
        changes = {}
        for key in ("visitors", "signups", "activated"):
            curr_val = current.get(key, 0)
            prev_val = previous.get(key, 0)
            if prev_val > 0:
                changes[f"{key}_change_pct"] = round((curr_val - prev_val) / prev_val * 100, 2)
            else:
                changes[f"{key}_change_pct"] = 100.0 if curr_val > 0 else 0.0
        return changes

    def render_text(self, period_days: int = 30) -> str:
        """
        Renderiza o dashboard em formato texto para console/logs.
        """
        overview = self.get_overview(period_days, compare_previous=False)
        channels = self.get_channel_breakdown(period_days)
        m = overview["metrics"]

        lines = [
            "=" * 60,
            "  ACQUISITION DASHBOARD — LifeOS Growth OS",
            f"  Período: últimos {period_days} dias",
            "=" * 60,
            "",
            "TOPO DO FUNIL",
            f"  Visitantes:          {m['visitors']:>8,}",
            f"  Cadastros:           {m['signups']:>8,}",
            f"  Usuários Ativados:   {m['activated']:>8,}",
            f"  Via Referral:        {m['referral_signups']:>8,}",
            "",
            "TAXAS DE CONVERSÃO",
            f"  Visitor → Signup:    {m['visitor_to_signup_pct']:>7.2f}%",
            f"  Signup → Activation: {m['signup_to_activation_pct']:>7.2f}%",
            f"  Share de Referral:   {m['referral_share_pct']:>7.2f}%",
            "",
            "CANAIS DE AQUISIÇÃO",
        ]

        for channel, data in channels["channels"].items():
            lines.append(
                f"  {channel:<15} {data['signups']:>6} cadastros  "
                f"({data['conversion_rate']:.1f}% conv.)"
            )

        lines += ["", "=" * 60]
        return "\n".join(lines)
