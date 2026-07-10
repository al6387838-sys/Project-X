"""
Funnel Engine
=============
Motor de análise e visualização do funil de crescimento da LifeOS.

Responsável por calcular taxas de conversão entre estágios,
identificar gargalos e gerar relatórios de funil.
"""

from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from collections import defaultdict

from ..models.funnel import FunnelStage, FunnelConversion, FunnelMetrics
from ..models.user_journey import UserJourney


class FunnelEngine:
    """
    Analisa o funil de crescimento e identifica oportunidades de otimização.

    Calcula taxas de conversão entre cada par de estágios consecutivos,
    tempo médio de conversão e gargalos críticos.
    """

    # Sequência ordenada do funil
    FUNNEL_SEQUENCE = [
        FunnelStage.VISITOR,
        FunnelStage.SIGNUP,
        FunnelStage.ACTIVATED,
        FunnelStage.ACTIVE,
        FunnelStage.SUBSCRIBER_PRO,
        FunnelStage.SUBSCRIBER_ULTRA,
        FunnelStage.ENTERPRISE,
    ]

    # Benchmarks de mercado para SaaS (taxas de conversão típicas)
    BENCHMARKS = {
        (FunnelStage.VISITOR, FunnelStage.SIGNUP): 0.025,       # 2.5%
        (FunnelStage.SIGNUP, FunnelStage.ACTIVATED): 0.40,      # 40%
        (FunnelStage.ACTIVATED, FunnelStage.ACTIVE): 0.60,      # 60%
        (FunnelStage.ACTIVE, FunnelStage.SUBSCRIBER_PRO): 0.05, # 5%
        (FunnelStage.SUBSCRIBER_PRO, FunnelStage.SUBSCRIBER_ULTRA): 0.15,  # 15%
    }

    def __init__(self):
        self._conversions: List[FunnelConversion] = []
        self._journeys: List[UserJourney] = []

    def load_data(
        self,
        conversions: List[FunnelConversion],
        journeys: List[UserJourney],
    ) -> None:
        """Carrega dados de conversões e jornadas para análise."""
        self._conversions = conversions
        self._journeys = journeys

    def calculate_conversion_rates(
        self,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Calcula taxas de conversão entre cada par de estágios consecutivos.

        Returns:
            Dicionário com métricas por transição de estágio.
        """
        if not period_end:
            period_end = datetime.utcnow()
        if not period_start:
            period_start = period_end - timedelta(days=30)

        period_conversions = [
            c for c in self._conversions
            if period_start <= c.converted_at <= period_end
        ]

        # Agrupa por transição
        transition_map: Dict[Tuple, List[FunnelConversion]] = defaultdict(list)
        for conv in period_conversions:
            key = (conv.from_stage, conv.to_stage)
            transition_map[key].append(conv)

        # Conta usuários por estágio de origem
        stage_counts: Dict[FunnelStage, int] = defaultdict(int)
        for journey in self._journeys:
            if journey.first_seen_at and period_start <= journey.first_seen_at <= period_end:
                stage_counts[FunnelStage.VISITOR] += 1
            if journey.signed_up_at and period_start <= journey.signed_up_at <= period_end:
                stage_counts[FunnelStage.SIGNUP] += 1
            if journey.activated_at and period_start <= journey.activated_at <= period_end:
                stage_counts[FunnelStage.ACTIVATED] += 1
            if journey.first_active_at and period_start <= journey.first_active_at <= period_end:
                stage_counts[FunnelStage.ACTIVE] += 1

        results = {}
        for i in range(len(self.FUNNEL_SEQUENCE) - 1):
            from_stage = self.FUNNEL_SEQUENCE[i]
            to_stage = self.FUNNEL_SEQUENCE[i + 1]
            key = (from_stage, to_stage)
            label = f"{from_stage.value}_to_{to_stage.value}"

            conversions_in_step = transition_map.get(key, [])
            from_count = stage_counts.get(from_stage, 0)
            to_count = len(conversions_in_step)

            rate = to_count / from_count if from_count > 0 else 0.0
            benchmark = self.BENCHMARKS.get(key, 0.0)

            avg_time_hours = 0.0
            if conversions_in_step:
                avg_time_hours = (
                    sum(c.time_to_convert_seconds for c in conversions_in_step)
                    / len(conversions_in_step)
                    / 3600
                )

            results[label] = {
                "from_stage": from_stage.value,
                "to_stage": to_stage.value,
                "from_count": from_count,
                "to_count": to_count,
                "conversion_rate_pct": round(rate * 100, 2),
                "benchmark_pct": round(benchmark * 100, 2),
                "vs_benchmark": round((rate - benchmark) * 100, 2),
                "avg_time_to_convert_hours": round(avg_time_hours, 2),
                "is_bottleneck": rate < benchmark * 0.7,
            }

        return results

    def identify_bottlenecks(
        self,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Identifica gargalos críticos no funil.

        Um gargalo é identificado quando a taxa de conversão está
        abaixo de 70% do benchmark de mercado.
        """
        rates = self.calculate_conversion_rates(period_start, period_end)
        bottlenecks = [
            {**data, "transition": label}
            for label, data in rates.items()
            if data["is_bottleneck"]
        ]
        return sorted(bottlenecks, key=lambda x: x["vs_benchmark"])

    def get_funnel_visualization(
        self,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Gera dados para visualização do funil em formato de cascata.

        Retorna contagens absolutas e relativas para cada estágio,
        adequado para renderização em gráficos de funil.
        """
        if not period_end:
            period_end = datetime.utcnow()
        if not period_start:
            period_start = period_end - timedelta(days=30)

        stage_data = []
        top_count = None

        for stage in self.FUNNEL_SEQUENCE:
            count = self._count_stage(stage, period_start, period_end)
            if top_count is None:
                top_count = count

            relative_pct = (count / top_count * 100) if top_count and top_count > 0 else 0.0

            stage_data.append({
                "stage": stage.value,
                "label": self._stage_label(stage),
                "count": count,
                "relative_pct": round(relative_pct, 2),
            })

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "stages": stage_data,
            "conversion_rates": self.calculate_conversion_rates(period_start, period_end),
            "bottlenecks": self.identify_bottlenecks(period_start, period_end),
        }

    def _count_stage(
        self, stage: FunnelStage, start: datetime, end: datetime
    ) -> int:
        """Conta usuários que atingiram um estágio no período."""
        count = 0
        for journey in self._journeys:
            ts = {
                FunnelStage.VISITOR: journey.first_seen_at,
                FunnelStage.SIGNUP: journey.signed_up_at,
                FunnelStage.ACTIVATED: journey.activated_at,
                FunnelStage.ACTIVE: journey.first_active_at,
                FunnelStage.SUBSCRIBER_PRO: journey.subscribed_at if journey.current_stage == FunnelStage.SUBSCRIBER_PRO else None,
                FunnelStage.SUBSCRIBER_ULTRA: journey.subscribed_at if journey.current_stage == FunnelStage.SUBSCRIBER_ULTRA else None,
                FunnelStage.ENTERPRISE: journey.subscribed_at if journey.current_stage == FunnelStage.ENTERPRISE else None,
            }.get(stage)

            if ts and start <= ts <= end:
                count += 1

        return count

    @staticmethod
    def _stage_label(stage: FunnelStage) -> str:
        labels = {
            FunnelStage.VISITOR: "Visitante",
            FunnelStage.SIGNUP: "Cadastro",
            FunnelStage.ACTIVATED: "Usuário Ativado",
            FunnelStage.ACTIVE: "Usuário Ativo",
            FunnelStage.SUBSCRIBER_PRO: "Assinante Pro",
            FunnelStage.SUBSCRIBER_ULTRA: "Assinante Ultra",
            FunnelStage.ENTERPRISE: "Enterprise",
            FunnelStage.CHURNED: "Churned",
            FunnelStage.DORMANT: "Dormant",
        }
        return labels.get(stage, stage.value)
