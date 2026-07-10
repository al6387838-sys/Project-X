"""
Growth Engine
=============
Motor central do Growth Operating System da LifeOS.

Orquestra todos os subsistemas de crescimento:
- Funil de aquisição e conversão
- Métricas em tempo real
- Referral Engine
- Activation Engine
- Onboarding adaptativo

Toda aquisição, retenção e expansão passa pelo GrowthEngine.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import uuid

from ..models.funnel import (
    FunnelStage, FunnelEvent, FunnelEventType,
    FunnelConversion, FunnelMetrics
)
from ..models.user_journey import UserJourney, JourneyStatus, UserProfile
from ..models.metrics import GrowthMetrics, RetentionMetrics, RevenueMetrics
from ..models.referral import ReferralCode, Referral, ReferralStatus


class GrowthEngine:
    """
    Motor central do Growth Operating System da LifeOS.

    Ponto único de entrada para todos os eventos de crescimento.
    Mantém o estado do funil e calcula métricas em tempo real.
    """

    def __init__(self):
        self._journeys: Dict[str, UserJourney] = {}
        self._events: List[FunnelEvent] = []
        self._conversions: List[FunnelConversion] = []
        self._referral_codes: Dict[str, ReferralCode] = {}
        """user_id → ReferralCode"""
        self._referrals: Dict[str, Referral] = {}
        """referral_id → Referral"""
        self._referral_code_map: Dict[str, str] = {}
        """code → user_id"""

        # Configurações do funil
        self._activation_threshold_events = 3
        """Número mínimo de eventos para considerar usuário ativado."""
        self._active_threshold_sessions = 3
        """Sessões por semana para considerar usuário ativo."""
        self._churn_threshold_days = 30
        """Dias sem atividade para considerar churn."""

    # ─────────────────────────────────────────────
    # Gestão de Jornadas
    # ─────────────────────────────────────────────

    def register_visitor(
        self,
        session_id: str,
        source: str = "organic",
        campaign: str = "",
        device: str = "web",
        country: str = "",
    ) -> UserJourney:
        """
        Registra um novo visitante no funil.

        Cria uma jornada anônima rastreada por session_id.
        """
        journey = UserJourney(
            user_id=f"anon_{session_id}",
            current_stage=FunnelStage.VISITOR,
            acquisition_source=source,
            acquisition_campaign=campaign,
            first_seen_at=datetime.utcnow(),
        )

        event = FunnelEvent(
            user_id=journey.user_id,
            session_id=session_id,
            event_type=FunnelEventType.PAGE_VIEW,
            funnel_stage=FunnelStage.VISITOR,
            source=source,
            campaign=campaign,
            device=device,
            country=country,
        )

        journey.add_event(event)
        self._journeys[journey.user_id] = journey
        self._events.append(event)
        return journey

    def register_signup(
        self,
        user_id: str,
        session_id: str = "",
        source: str = "organic",
        campaign: str = "",
        referral_code: str = "",
        device: str = "web",
        country: str = "",
    ) -> UserJourney:
        """
        Registra o cadastro de um novo usuário.

        Avança o funil de VISITOR para SIGNUP e associa
        o referral code se fornecido.
        """
        # Verifica se já existe jornada anônima para esta sessão
        anon_key = f"anon_{session_id}" if session_id else None
        if anon_key and anon_key in self._journeys:
            journey = self._journeys.pop(anon_key)
            journey.user_id = user_id
        else:
            journey = UserJourney(
                user_id=user_id,
                current_stage=FunnelStage.VISITOR,
                acquisition_source=source,
                acquisition_campaign=campaign,
                first_seen_at=datetime.utcnow(),
            )

        # Associa referral
        if referral_code:
            journey.referral_code_used = referral_code
            referrer_id = self._referral_code_map.get(referral_code)
            if referrer_id:
                journey.referrer_user_id = referrer_id
                self._process_referral_signup(referral_code, user_id)

        # Avança para SIGNUP
        conversion = journey.advance_stage(FunnelStage.SIGNUP, source, campaign)
        self._conversions.append(conversion)

        event = FunnelEvent(
            user_id=user_id,
            session_id=session_id,
            event_type=FunnelEventType.SIGNUP_COMPLETED,
            funnel_stage=FunnelStage.SIGNUP,
            source=source,
            campaign=campaign,
            device=device,
            country=country,
        )
        journey.add_event(event)
        self._events.append(event)

        # Gera código de referral para o novo usuário
        ref_code = ReferralCode.generate(user_id)
        journey.referral_code = ref_code.code
        self._referral_codes[user_id] = ref_code
        self._referral_code_map[ref_code.code] = user_id

        self._journeys[user_id] = journey
        return journey

    def record_event(
        self,
        user_id: str,
        event_type: FunnelEventType,
        session_id: str = "",
        properties: Optional[Dict[str, Any]] = None,
        revenue: float = 0.0,
    ) -> Optional[FunnelEvent]:
        """
        Registra um evento de engajamento para um usuário.

        Avalia automaticamente se o usuário deve avançar de estágio.
        """
        journey = self._journeys.get(user_id)
        if not journey:
            return None

        event = FunnelEvent(
            user_id=user_id,
            session_id=session_id,
            event_type=event_type,
            funnel_stage=journey.current_stage,
            properties=properties or {},
            revenue=revenue,
        )

        journey.add_event(event)
        self._events.append(event)

        # Avalia progressão automática no funil
        self._evaluate_stage_progression(journey, event)

        return event

    def _evaluate_stage_progression(self, journey: UserJourney, event: FunnelEvent) -> None:
        """Avalia se o usuário deve avançar de estágio com base no evento."""

        # SIGNUP → ACTIVATED: completou onboarding ou atingiu aha moment
        if journey.current_stage == FunnelStage.SIGNUP:
            if event.event_type in (
                FunnelEventType.ONBOARDING_COMPLETED,
                FunnelEventType.AHA_MOMENT_REACHED,
                FunnelEventType.FIRST_ACTION_COMPLETED,
            ):
                conversion = journey.advance_stage(FunnelStage.ACTIVATED)
                self._conversions.append(conversion)
                journey.add_milestone(
                    "Ativação Completa",
                    "Completou o onboarding e realizou a primeira ação-chave",
                    points=100,
                )

        # ACTIVATED → ACTIVE: engajamento consistente
        elif journey.current_stage == FunnelStage.ACTIVATED:
            if event.event_type == FunnelEventType.SESSION_STARTED:
                journey.total_sessions += 1
            if journey.total_sessions >= self._active_threshold_sessions:
                conversion = journey.advance_stage(FunnelStage.ACTIVE)
                self._conversions.append(conversion)
                journey.add_milestone(
                    "Usuário Ativo",
                    "Atingiu engajamento consistente com o produto",
                    points=200,
                )

        # Conversão para assinatura
        elif journey.current_stage == FunnelStage.ACTIVE:
            if event.event_type == FunnelEventType.SUBSCRIPTION_CREATED:
                plan = event.properties.get("plan", "pro")
                new_stage = (
                    FunnelStage.SUBSCRIBER_ULTRA if plan == "ultra"
                    else FunnelStage.ENTERPRISE if plan == "enterprise"
                    else FunnelStage.SUBSCRIBER_PRO
                )
                conversion = journey.advance_stage(new_stage)
                self._conversions.append(conversion)
                journey.current_plan = plan
                journey.add_milestone(
                    f"Assinante {plan.capitalize()}",
                    f"Converteu para o plano {plan}",
                    points=500,
                )

    # ─────────────────────────────────────────────
    # Métricas
    # ─────────────────────────────────────────────

    def get_funnel_metrics(
        self,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
        period_type: str = "monthly",
    ) -> FunnelMetrics:
        """
        Calcula as métricas do funil para um período específico.

        Se nenhum período for fornecido, usa os últimos 30 dias.
        """
        if not period_end:
            period_end = datetime.utcnow()
        if not period_start:
            period_start = period_end - timedelta(days=30)

        # Filtra eventos do período
        period_events = [
            e for e in self._events
            if period_start <= e.timestamp <= period_end
        ]

        # Conta usuários por estágio
        stage_counts = self._count_stages_in_period(period_start, period_end)

        metrics = FunnelMetrics(
            period_start=period_start,
            period_end=period_end,
            period_type=period_type,
            visitors=stage_counts.get(FunnelStage.VISITOR, 0),
            signups=stage_counts.get(FunnelStage.SIGNUP, 0),
            activated_users=stage_counts.get(FunnelStage.ACTIVATED, 0),
            active_users=stage_counts.get(FunnelStage.ACTIVE, 0),
            pro_subscribers=stage_counts.get(FunnelStage.SUBSCRIBER_PRO, 0),
            ultra_subscribers=stage_counts.get(FunnelStage.SUBSCRIBER_ULTRA, 0),
            enterprise_accounts=stage_counts.get(FunnelStage.ENTERPRISE, 0),
            churned_users=stage_counts.get(FunnelStage.CHURNED, 0),
        )

        # Calcula retenção por coorte
        metrics.day1_retention = self._calculate_retention(1)
        metrics.day7_retention = self._calculate_retention(7)
        metrics.day30_retention = self._calculate_retention(30)
        metrics.day90_retention = self._calculate_retention(90)

        # Calcula churn
        total_active = metrics.active_users + metrics.pro_subscribers + metrics.ultra_subscribers
        if total_active > 0:
            metrics.monthly_churn_rate = metrics.churned_users / total_active

        # Calcula receita
        revenue_events = [e for e in period_events if e.revenue > 0]
        metrics.mrr = sum(e.revenue for e in revenue_events)

        # Calcula referral rate
        referral_events = [
            e for e in period_events
            if e.event_type == FunnelEventType.REFERRAL_CONVERTED
        ]
        total_subs = metrics.pro_subscribers + metrics.ultra_subscribers + metrics.enterprise_accounts
        if total_subs > 0:
            metrics.referral_rate = len(referral_events) / total_subs
            metrics.subscription_to_referral_rate = metrics.referral_rate

        metrics.compute_derived_metrics()
        return metrics

    def get_growth_metrics(self, period: str = "daily") -> GrowthMetrics:
        """Retorna métricas de crescimento para o período especificado."""
        now = datetime.utcnow()
        days = {"daily": 1, "weekly": 7, "monthly": 30}.get(period, 30)
        since = now - timedelta(days=days)

        metrics = GrowthMetrics(period=period, snapshot_at=now)

        for journey in self._journeys.values():
            if journey.first_seen_at and journey.first_seen_at >= since:
                metrics.new_visitors += 1
                # Conta por canal
                src = journey.acquisition_source
                if src == "organic":
                    metrics.organic_signups += 1
                elif src == "paid":
                    metrics.paid_signups += 1
                elif src == "referral":
                    metrics.referral_signups += 1
                elif src == "social":
                    metrics.social_signups += 1
                elif src == "email":
                    metrics.email_signups += 1

            if journey.signed_up_at and journey.signed_up_at >= since:
                metrics.new_signups += 1

            if journey.activated_at and journey.activated_at >= since:
                metrics.new_activated += 1

            if journey.last_active_at and journey.last_active_at >= since:
                metrics.dau += 1

        metrics.mau = sum(
            1 for j in self._journeys.values()
            if j.last_active_at and j.last_active_at >= now - timedelta(days=30)
        )
        metrics.wau = sum(
            1 for j in self._journeys.values()
            if j.last_active_at and j.last_active_at >= now - timedelta(days=7)
        )
        metrics.compute()
        return metrics

    def get_retention_metrics(self) -> RetentionMetrics:
        """Calcula métricas de retenção e churn."""
        now = datetime.utcnow()
        metrics = RetentionMetrics(snapshot_at=now)

        metrics.day1_retention = self._calculate_retention(1)
        metrics.day3_retention = self._calculate_retention(3)
        metrics.day7_retention = self._calculate_retention(7)
        metrics.day14_retention = self._calculate_retention(14)
        metrics.day30_retention = self._calculate_retention(30)
        metrics.day60_retention = self._calculate_retention(60)
        metrics.day90_retention = self._calculate_retention(90)

        churned = [j for j in self._journeys.values() if j.current_stage == FunnelStage.CHURNED]
        metrics.churned_users_count = len(churned)

        metrics.at_risk_users = sum(
            1 for j in self._journeys.values()
            if j.is_at_risk and j.current_stage not in (FunnelStage.CHURNED, FunnelStage.VISITOR)
        )

        metrics.dormant_users = sum(
            1 for j in self._journeys.values()
            if j.days_since_last_active is not None
            and j.days_since_last_active >= 30
            and j.current_stage not in (FunnelStage.CHURNED, FunnelStage.VISITOR)
        )

        active_journeys = [j for j in self._journeys.values() if j.total_sessions > 0]
        if active_journeys:
            metrics.avg_sessions_per_user = sum(j.total_sessions for j in active_journeys) / len(active_journeys)

        total = len(active_journeys) + metrics.churned_users_count
        if total > 0:
            metrics.monthly_churn_rate = metrics.churned_users_count / total

        return metrics

    def get_revenue_metrics(self) -> RevenueMetrics:
        """Calcula métricas de receita recorrente."""
        metrics = RevenueMetrics(snapshot_at=datetime.utcnow())

        for journey in self._journeys.values():
            if journey.current_stage == FunnelStage.SUBSCRIBER_PRO:
                metrics.subscribers_pro += 1
                metrics.mrr_pro += 29.0  # Preço Pro
            elif journey.current_stage == FunnelStage.SUBSCRIBER_ULTRA:
                metrics.subscribers_ultra += 1
                metrics.mrr_ultra += 79.0  # Preço Ultra
            elif journey.current_stage == FunnelStage.ENTERPRISE:
                metrics.subscribers_enterprise += 1
                metrics.mrr_enterprise += 299.0  # Preço Enterprise

        metrics.mrr_total = metrics.mrr_pro + metrics.mrr_ultra + metrics.mrr_enterprise
        metrics.compute()
        return metrics

    def _count_stages_in_period(
        self, start: datetime, end: datetime
    ) -> Dict[FunnelStage, int]:
        """Conta usuários que atingiram cada estágio no período."""
        counts: Dict[FunnelStage, int] = {stage: 0 for stage in FunnelStage}

        for journey in self._journeys.values():
            if journey.first_seen_at and start <= journey.first_seen_at <= end:
                counts[FunnelStage.VISITOR] += 1
            if journey.signed_up_at and start <= journey.signed_up_at <= end:
                counts[FunnelStage.SIGNUP] += 1
            if journey.activated_at and start <= journey.activated_at <= end:
                counts[FunnelStage.ACTIVATED] += 1
            if journey.first_active_at and start <= journey.first_active_at <= end:
                counts[FunnelStage.ACTIVE] += 1
            if journey.current_stage == FunnelStage.SUBSCRIBER_PRO:
                counts[FunnelStage.SUBSCRIBER_PRO] += 1
            elif journey.current_stage == FunnelStage.SUBSCRIBER_ULTRA:
                counts[FunnelStage.SUBSCRIBER_ULTRA] += 1
            elif journey.current_stage == FunnelStage.ENTERPRISE:
                counts[FunnelStage.ENTERPRISE] += 1
            elif journey.current_stage == FunnelStage.CHURNED:
                counts[FunnelStage.CHURNED] += 1

        return counts

    def _calculate_retention(self, day: int) -> float:
        """
        Calcula a taxa de retenção para um dia específico.

        Usa a coorte de usuários que se cadastraram há exatamente
        `day` dias e verifica quantos ainda estão ativos.
        """
        target_date = datetime.utcnow() - timedelta(days=day)
        window_start = target_date - timedelta(hours=12)
        window_end = target_date + timedelta(hours=12)

        cohort = [
            j for j in self._journeys.values()
            if j.signed_up_at and window_start <= j.signed_up_at <= window_end
        ]

        if not cohort:
            return 0.0

        retained = sum(
            1 for j in cohort
            if j.last_active_at and j.last_active_at >= target_date
        )

        return retained / len(cohort)

    # ─────────────────────────────────────────────
    # Referral
    # ─────────────────────────────────────────────

    def get_referral_code(self, user_id: str) -> Optional[ReferralCode]:
        """Retorna o código de referral de um usuário."""
        return self._referral_codes.get(user_id)

    def _process_referral_signup(self, referral_code: str, referred_user_id: str) -> None:
        """Processa o signup de um usuário via referral."""
        referrer_id = self._referral_code_map.get(referral_code)
        if not referrer_id:
            return

        referral = Referral(
            referrer_user_id=referrer_id,
            referred_user_id=referred_user_id,
            referral_code=referral_code,
            status=ReferralStatus.SIGNED_UP,
            clicked_at=datetime.utcnow(),
            signed_up_at=datetime.utcnow(),
        )

        self._referrals[referral.referral_id] = referral

        # Atualiza stats do código
        if referrer_id in self._referral_codes:
            self._referral_codes[referrer_id].signups_generated += 1

        # Atualiza jornada do referrer
        referrer_journey = self._journeys.get(referrer_id)
        if referrer_journey:
            referrer_journey.referrals_sent += 1

    def get_referral_stats(self, user_id: str) -> Dict[str, Any]:
        """Retorna estatísticas de referral de um usuário."""
        code = self._referral_codes.get(user_id)
        referrals = [r for r in self._referrals.values() if r.referrer_user_id == user_id]

        return {
            "referral_code": code.to_dict() if code else None,
            "total_referrals": len(referrals),
            "by_status": {
                status.value: sum(1 for r in referrals if r.status == status)
                for status in ReferralStatus
            },
            "total_revenue_attributed": sum(r.revenue_attributed for r in referrals),
        }

    # ─────────────────────────────────────────────
    # Dashboard completo
    # ─────────────────────────────────────────────

    def get_metrics_engine_data(self) -> Dict[str, Any]:
        """Retorna dados brutos para análise pelo MetricsEngine."""
        journeys = list(self._journeys.values())
        total_sent = sum(j.referrals_sent for j in journeys)
        total_converted = sum(j.referrals_converted for j in journeys)
        users_with_referrals = sum(1 for j in journeys if j.referrals_sent > 0)
        avg_invites = total_sent / users_with_referrals if users_with_referrals > 0 else 0
        conv_rate = total_converted / total_sent if total_sent > 0 else 0
        k_factor = avg_invites * conv_rate
        return {
            "total_journeys": len(journeys),
            "total_events": len(self._events),
            "k_factor": round(k_factor, 3),
            "viral_growth": k_factor >= 1.0,
        }

    def get_growth_dashboard(self) -> Dict[str, Any]:
        """
        Retorna o dashboard completo do Growth OS.

        Agrega todas as métricas em uma única visão executiva.
        """
        funnel = self.get_funnel_metrics()
        growth = self.get_growth_metrics("daily")
        retention = self.get_retention_metrics()
        revenue = self.get_revenue_metrics()

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "summary": {
                "total_users": len(self._journeys),
                "total_events": len(self._events),
                "total_conversions": len(self._conversions),
                "total_referrals": len(self._referrals),
            },
            "funnel": funnel.to_dict(),
            "growth": growth.to_dict(),
            "retention": retention.to_dict(),
            "revenue": revenue.to_dict(),
        }
