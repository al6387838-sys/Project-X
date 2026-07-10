"""
Retention Dashboard
===================
Dashboard de retenção do Growth OS da LifeOS.

Exibe métricas de retenção por coorte, churn, usuários em risco
e análise de engajamento para identificar padrões de abandono.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict

from ..models.funnel import FunnelStage
from ..models.user_journey import UserJourney
from ..engines.metrics_engine import MetricsEngine


class RetentionDashboard:
    """
    Dashboard de retenção e churn da LifeOS.

    Consolida todas as métricas de retenção:
    - Taxas de retenção D1, D7, D30, D90
    - Análise de coorte
    - Usuários em risco de churn
    - Padrões de engajamento
    - Impacto de funcionalidades na retenção
    """

    def __init__(self, metrics_engine: Optional[MetricsEngine] = None):
        self._metrics_engine = metrics_engine or MetricsEngine()
        self._journeys: List[UserJourney] = []

    def load_data(self, journeys: List[UserJourney]) -> None:
        """Carrega dados para o dashboard."""
        self._journeys = journeys
        self._metrics_engine.load_data(events=[], journeys=journeys)

    def get_retention_overview(self) -> Dict[str, Any]:
        """
        Visão geral de retenção com taxas por período.

        Calcula retenção D1, D3, D7, D14, D30, D60, D90
        para a base total de usuários.
        """
        retention_days = [1, 3, 7, 14, 30, 60, 90]
        rates = {}

        for day in retention_days:
            rates[f"d{day}"] = round(
                self._calculate_retention_rate(day) * 100, 2
            )

        total_users = len(self._journeys)
        churned = sum(1 for j in self._journeys if j.current_stage == FunnelStage.CHURNED)
        at_risk = sum(1 for j in self._journeys if j.is_at_risk and j.current_stage != FunnelStage.CHURNED)
        dormant = sum(
            1 for j in self._journeys
            if j.days_since_last_active is not None
            and j.days_since_last_active >= 30
            and j.current_stage not in (FunnelStage.CHURNED, FunnelStage.VISITOR)
        )

        monthly_churn = churned / total_users if total_users > 0 else 0.0

        return {
            "snapshot_at": datetime.utcnow().isoformat(),
            "retention_rates": rates,
            "churn": {
                "churned_users": churned,
                "monthly_churn_rate_pct": round(monthly_churn * 100, 2),
                "annual_churn_rate_pct": round((1 - (1 - monthly_churn) ** 12) * 100, 2),
            },
            "at_risk": {
                "at_risk_count": at_risk,
                "dormant_count": dormant,
                "at_risk_pct": round(at_risk / total_users * 100, 2) if total_users > 0 else 0.0,
            },
            "health_score": self._calculate_health_score(rates),
        }

    def get_cohort_analysis(
        self,
        num_cohorts: int = 8,
        cohort_interval_days: int = 7,
    ) -> Dict[str, Any]:
        """
        Análise de retenção por coorte semanal.

        Cada coorte representa usuários que se cadastraram
        na mesma semana, permitindo comparar retenção ao longo do tempo.
        """
        now = datetime.utcnow()
        cohorts = []

        for i in range(num_cohorts):
            cohort_start = now - timedelta(days=(i + 1) * cohort_interval_days)
            cohort_end = now - timedelta(days=i * cohort_interval_days)

            cohort_users = [
                j for j in self._journeys
                if j.signed_up_at and cohort_start <= j.signed_up_at <= cohort_end
            ]

            if not cohort_users:
                continue

            cohort_data = {
                "cohort_week": cohort_start.strftime("W%W/%Y"),
                "cohort_date": cohort_start.strftime("%Y-%m-%d"),
                "size": len(cohort_users),
                "retention": {},
            }

            for day in [1, 7, 14, 30, 60, 90]:
                check_date = cohort_start + timedelta(days=day)
                if check_date > now:
                    cohort_data["retention"][f"d{day}"] = None
                    continue

                retained = sum(
                    1 for j in cohort_users
                    if j.last_active_at and j.last_active_at >= check_date
                )
                cohort_data["retention"][f"d{day}"] = round(
                    retained / len(cohort_users) * 100, 2
                )

            cohorts.append(cohort_data)

        return {
            "cohorts": cohorts,
            "num_cohorts": len(cohorts),
            "interval_days": cohort_interval_days,
        }

    def get_churn_analysis(self) -> Dict[str, Any]:
        """
        Análise detalhada de churn.

        Identifica padrões de abandono: quando os usuários
        costumam sair e quais características têm os usuários churned.
        """
        churned_users = [
            j for j in self._journeys
            if j.current_stage == FunnelStage.CHURNED and j.churned_at
        ]

        if not churned_users:
            return {"churned_users": 0, "patterns": {}}

        # Tempo médio até churn
        times_to_churn = []
        for j in churned_users:
            if j.signed_up_at and j.churned_at:
                days = (j.churned_at - j.signed_up_at).days
                times_to_churn.append(days)

        avg_days_to_churn = sum(times_to_churn) / len(times_to_churn) if times_to_churn else 0

        # Distribuição por estágio antes do churn
        stage_before_churn = defaultdict(int)
        for j in churned_users:
            for conv in j.conversions:
                if conv.to_stage == FunnelStage.CHURNED:
                    stage_before_churn[conv.from_stage.value] += 1

        # Usuários que nunca ativaram
        never_activated = sum(
            1 for j in churned_users if not j.activated_at
        )

        return {
            "churned_users": len(churned_users),
            "avg_days_to_churn": round(avg_days_to_churn, 1),
            "never_activated_pct": round(never_activated / len(churned_users) * 100, 2),
            "stage_before_churn": dict(stage_before_churn),
            "avg_sessions_before_churn": round(
                sum(j.total_sessions for j in churned_users) / len(churned_users), 1
            ),
        }

    def get_at_risk_users(
        self,
        inactivity_days_threshold: int = 7,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Lista usuários em risco de churn para intervenção proativa.

        Retorna usuários ordenados por risco decrescente,
        com informações para personalizar a reativação.
        """
        at_risk = []

        for journey in self._journeys:
            days_inactive = journey.days_since_last_active
            if days_inactive is None or days_inactive < inactivity_days_threshold:
                continue
            if journey.current_stage in (FunnelStage.CHURNED, FunnelStage.VISITOR):
                continue

            risk_score = self._calculate_churn_risk_score(journey)

            at_risk.append({
                "user_id": journey.user_id,
                "current_stage": journey.current_stage.value,
                "days_inactive": round(days_inactive, 0),
                "days_since_signup": journey.days_since_signup,
                "total_sessions": journey.total_sessions,
                "streak_days": journey.streak_days,
                "current_plan": journey.current_plan,
                "risk_score": risk_score,
                "recommended_action": self._recommend_reactivation_action(journey, risk_score),
            })

        # Ordena por risco decrescente
        at_risk.sort(key=lambda x: x["risk_score"], reverse=True)
        return at_risk[:limit]

    def get_engagement_analysis(self) -> Dict[str, Any]:
        """
        Análise de engajamento por segmento de usuário.

        Identifica padrões de uso que correlacionam com retenção.
        """
        active_users = [
            j for j in self._journeys
            if j.current_stage not in (FunnelStage.VISITOR, FunnelStage.CHURNED)
            and j.total_sessions > 0
        ]

        if not active_users:
            return {}

        # Segmenta por nível de engajamento
        high_engagement = [j for j in active_users if j.total_sessions >= 20]
        medium_engagement = [j for j in active_users if 5 <= j.total_sessions < 20]
        low_engagement = [j for j in active_users if j.total_sessions < 5]

        def segment_stats(users: List[UserJourney]) -> Dict[str, Any]:
            if not users:
                return {}
            return {
                "count": len(users),
                "avg_sessions": round(sum(j.total_sessions for j in users) / len(users), 1),
                "avg_streak": round(sum(j.streak_days for j in users) / len(users), 1),
                "avg_goals_created": round(sum(j.goals_created for j in users) / len(users), 1),
                "subscription_rate_pct": round(
                    sum(1 for j in users if j.current_plan != "free") / len(users) * 100, 2
                ),
            }

        return {
            "total_active_users": len(active_users),
            "segments": {
                "high_engagement": segment_stats(high_engagement),
                "medium_engagement": segment_stats(medium_engagement),
                "low_engagement": segment_stats(low_engagement),
            },
            "overall": {
                "avg_sessions": round(sum(j.total_sessions for j in active_users) / len(active_users), 1),
                "avg_streak_days": round(sum(j.streak_days for j in active_users) / len(active_users), 1),
                "onboarding_completion_rate_pct": round(
                    sum(1 for j in active_users if j.onboarding_completed) / len(active_users) * 100, 2
                ),
            },
        }

    def _calculate_retention_rate(self, day: int) -> float:
        """Calcula taxa de retenção para um dia específico."""
        target_date = datetime.utcnow() - timedelta(days=day)
        window = timedelta(hours=12)

        cohort = [
            j for j in self._journeys
            if j.signed_up_at
            and (target_date - window) <= j.signed_up_at <= (target_date + window)
        ]

        if not cohort:
            return 0.0

        retained = sum(
            1 for j in cohort
            if j.last_active_at and j.last_active_at >= target_date
        )

        return retained / len(cohort)

    def _calculate_churn_risk_score(self, journey: UserJourney) -> float:
        """
        Calcula score de risco de churn (0.0 a 1.0).

        Fatores: inatividade, engajamento histórico, plano atual.
        """
        score = 0.0
        days_inactive = journey.days_since_last_active or 0

        # Inatividade (peso 40%)
        if days_inactive >= 30:
            score += 0.40
        elif days_inactive >= 14:
            score += 0.30
        elif days_inactive >= 7:
            score += 0.20

        # Baixo engajamento histórico (peso 30%)
        if journey.total_sessions < 3:
            score += 0.30
        elif journey.total_sessions < 10:
            score += 0.15

        # Onboarding incompleto (peso 20%)
        if not journey.onboarding_completed:
            score += 0.20

        # Plano free tem maior risco (peso 10%)
        if journey.current_plan == "free":
            score += 0.10

        return min(score, 1.0)

    def _recommend_reactivation_action(
        self, journey: UserJourney, risk_score: float
    ) -> str:
        """Recomenda ação de reativação baseada no perfil do usuário."""
        if not journey.onboarding_completed:
            return "send_onboarding_reminder"
        if risk_score >= 0.7:
            return "send_win_back_campaign"
        if journey.streak_days > 0:
            return "send_streak_recovery_email"
        if journey.current_plan == "free" and journey.total_sessions >= 5:
            return "send_upgrade_offer"
        return "send_engagement_nudge"

    def _calculate_health_score(self, rates: Dict[str, float]) -> str:
        """Calcula score de saúde da retenção."""
        d30 = rates.get("d30", 0)
        if d30 >= 40:
            return "excellent"
        elif d30 >= 25:
            return "good"
        elif d30 >= 15:
            return "fair"
        else:
            return "needs_attention"

    def render_text(self) -> str:
        """Renderiza o dashboard em formato texto."""
        overview = self.get_retention_overview()
        rates = overview["retention_rates"]
        churn = overview["churn"]
        at_risk = overview["at_risk"]

        lines = [
            "=" * 60,
            "  RETENTION DASHBOARD — LifeOS Growth OS",
            "=" * 60,
            "",
            "TAXAS DE RETENÇÃO",
            f"  D1:   {rates.get('d1', 0):>6.2f}%",
            f"  D3:   {rates.get('d3', 0):>6.2f}%",
            f"  D7:   {rates.get('d7', 0):>6.2f}%",
            f"  D14:  {rates.get('d14', 0):>6.2f}%",
            f"  D30:  {rates.get('d30', 0):>6.2f}%",
            f"  D60:  {rates.get('d60', 0):>6.2f}%",
            f"  D90:  {rates.get('d90', 0):>6.2f}%",
            "",
            "CHURN",
            f"  Usuários Churned:    {churn['churned_users']:>6}",
            f"  Churn Mensal:        {churn['monthly_churn_rate_pct']:>6.2f}%",
            f"  Churn Anual:         {churn['annual_churn_rate_pct']:>6.2f}%",
            "",
            "USUÁRIOS EM RISCO",
            f"  Em Risco (7d):       {at_risk['at_risk_count']:>6}",
            f"  Dormentes (30d):     {at_risk['dormant_count']:>6}",
            f"  % Em Risco:          {at_risk['at_risk_pct']:>6.2f}%",
            "",
            f"  Health Score: {overview['health_score'].upper()}",
            "",
            "=" * 60,
        ]
        return "\n".join(lines)
