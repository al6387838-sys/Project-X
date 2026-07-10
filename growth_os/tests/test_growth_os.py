"""
Growth OS — Test Suite
======================
Suite de testes automatizados para o Growth Operating System da LifeOS.

Cobre:
    - Modelos de funil e jornada do usuário
    - Growth Engine (registro, eventos, métricas)
    - Funnel Engine (taxas de conversão, gargalos)
    - Acquisition Dashboard
    - Retention Dashboard
    - Referral Engine e sistema de recompensas
    - Activation Engine e checklist
    - Onboarding Engine e detecção de perfil
"""

import pytest
from datetime import datetime, timedelta
from typing import List

# Models
from growth_os.models.funnel import (
    FunnelStage, FunnelEvent, FunnelEventType,
    FunnelConversion, FunnelMetrics
)
from growth_os.models.user_journey import UserJourney, JourneyStatus, UserProfile
from growth_os.models.metrics import GrowthMetrics, RetentionMetrics, RevenueMetrics
from growth_os.models.referral import ReferralCode, Referral, ReferralStatus, RewardType

# Engines
from growth_os.engines.growth_engine import GrowthEngine
from growth_os.engines.funnel_engine import FunnelEngine
from growth_os.engines.metrics_engine import MetricsEngine

# Dashboards
from growth_os.dashboards.acquisition_dashboard import AcquisitionDashboard
from growth_os.dashboards.retention_dashboard import RetentionDashboard
from growth_os.dashboards.growth_dashboard import GrowthDashboard

# Referral
from growth_os.referral.referral_engine import ReferralEngine
from growth_os.referral.reward_engine import RewardEngine

# Activation
from growth_os.activation.activation_engine import ActivationEngine, ActivationStatus
from growth_os.activation.aha_moment import AhaMomentDetector

# Onboarding
from growth_os.onboarding.onboarding_engine import OnboardingEngine
from growth_os.onboarding.profile_detector import ProfileDetector


# ═══════════════════════════════════════════════════════════════
# FIXTURES
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def growth_engine():
    return GrowthEngine()


@pytest.fixture
def populated_engine():
    """GrowthEngine com dados de teste pré-populados."""
    engine = GrowthEngine()

    # Registra visitantes e usuários
    for i in range(10):
        source = ["organic", "paid", "referral", "social"][i % 4]
        journey = engine.register_visitor(
            session_id=f"sess_{i}",
            source=source,
        )

    # Registra cadastros
    for i in range(8):
        journey = engine.register_signup(
            user_id=f"user_{i}",
            session_id=f"sess_{i}",
            source=["organic", "paid", "referral"][i % 3],
        )

    # Registra ativações
    for i in range(5):
        engine.record_event(
            user_id=f"user_{i}",
            event_type=FunnelEventType.ONBOARDING_COMPLETED,
        )

    # Registra assinaturas
    for i in range(2):
        engine.record_event(
            user_id=f"user_{i}",
            event_type=FunnelEventType.SUBSCRIPTION_CREATED,
            properties={"plan": "pro"},
            revenue=29.0,
        )

    return engine


@pytest.fixture
def referral_engine():
    return ReferralEngine()


@pytest.fixture
def activation_engine():
    return ActivationEngine()


@pytest.fixture
def onboarding_engine():
    return OnboardingEngine()


# ═══════════════════════════════════════════════════════════════
# TESTES — MODELOS
# ═══════════════════════════════════════════════════════════════

class TestFunnelStage:
    def test_all_stages_defined(self):
        stages = list(FunnelStage)
        assert FunnelStage.VISITOR in stages
        assert FunnelStage.SIGNUP in stages
        assert FunnelStage.ACTIVATED in stages
        assert FunnelStage.ACTIVE in stages
        assert FunnelStage.SUBSCRIBER_PRO in stages
        assert FunnelStage.SUBSCRIBER_ULTRA in stages
        assert FunnelStage.ENTERPRISE in stages
        assert FunnelStage.CHURNED in stages

    def test_stage_values_are_strings(self):
        for stage in FunnelStage:
            assert isinstance(stage.value, str)


class TestFunnelEvent:
    def test_event_creation(self):
        event = FunnelEvent(
            user_id="user_1",
            event_type=FunnelEventType.SIGNUP_COMPLETED,
            funnel_stage=FunnelStage.SIGNUP,
        )
        assert event.user_id == "user_1"
        assert event.event_id is not None
        assert len(event.event_id) > 0

    def test_event_to_dict(self):
        event = FunnelEvent(
            user_id="user_1",
            event_type=FunnelEventType.PAGE_VIEW,
            funnel_stage=FunnelStage.VISITOR,
            source="organic",
        )
        d = event.to_dict()
        assert d["user_id"] == "user_1"
        assert d["event_type"] == "page_view"
        assert d["funnel_stage"] == "visitor"
        assert d["source"] == "organic"


class TestFunnelMetrics:
    def test_compute_derived_metrics(self):
        metrics = FunnelMetrics(
            visitors=1000,
            signups=50,
            activated_users=30,
            active_users=20,
            pro_subscribers=5,
            monthly_churn_rate=0.05,
            mrr=145.0,
            cac=50.0,
        )
        metrics.compute_derived_metrics()

        assert metrics.visitor_to_signup_rate == pytest.approx(0.05)
        assert metrics.signup_to_activation_rate == pytest.approx(0.60)
        assert metrics.activation_to_retention_rate == pytest.approx(0.667, rel=0.01)
        assert metrics.arr == pytest.approx(1740.0)
        assert metrics.arpu == pytest.approx(29.0)

    def test_metrics_to_dict_structure(self):
        metrics = FunnelMetrics(visitors=100, signups=10)
        metrics.compute_derived_metrics()
        d = metrics.to_dict()

        assert "funnel" in d
        assert "conversion_rates" in d
        assert "retention" in d
        assert "churn" in d
        assert "revenue" in d
        assert "referral" in d


class TestUserJourney:
    def test_journey_creation(self):
        journey = UserJourney(user_id="user_1")
        assert journey.current_stage == FunnelStage.VISITOR
        assert journey.status == JourneyStatus.ACTIVE
        assert journey.total_events == 0

    def test_add_event(self):
        journey = UserJourney(user_id="user_1")
        event = FunnelEvent(user_id="user_1", event_type=FunnelEventType.PAGE_VIEW)
        journey.add_event(event)

        assert journey.total_events == 1
        assert len(journey.events) == 1

    def test_advance_stage(self):
        journey = UserJourney(user_id="user_1", current_stage=FunnelStage.VISITOR)
        journey.first_seen_at = datetime.utcnow() - timedelta(hours=1)
        # Adiciona um evento para que _get_stage_entry_time retorne um valor
        event = FunnelEvent(user_id="user_1", event_type=FunnelEventType.PAGE_VIEW, funnel_stage=FunnelStage.VISITOR)
        journey.add_event(event)

        conversion = journey.advance_stage(FunnelStage.SIGNUP)

        assert journey.current_stage == FunnelStage.SIGNUP
        assert conversion.from_stage == FunnelStage.VISITOR
        assert conversion.to_stage == FunnelStage.SIGNUP
        assert conversion.time_to_convert_seconds >= 0

    def test_is_at_risk(self):
        journey = UserJourney(user_id="user_1")
        journey.last_active_at = datetime.utcnow() - timedelta(days=10)
        assert journey.is_at_risk is True

        journey.last_active_at = datetime.utcnow() - timedelta(days=3)
        assert journey.is_at_risk is False

    def test_add_milestone(self):
        journey = UserJourney(user_id="user_1")
        milestone = journey.add_milestone("Test Milestone", "Description", points=100)

        assert milestone.name == "Test Milestone"
        assert milestone.points_awarded == 100
        assert len(journey.milestones) == 1


class TestReferralCode:
    def test_generate_code(self):
        code = ReferralCode.generate("user_1")
        assert code.user_id == "user_1"
        assert code.code.startswith("LIFE-")
        assert "lifeos.app/join" in code.link
        assert code.code in code.link

    def test_code_uniqueness(self):
        codes = {ReferralCode.generate("user_1").code for _ in range(10)}
        # Códigos devem ser únicos (alta probabilidade)
        assert len(codes) > 1


# ═══════════════════════════════════════════════════════════════
# TESTES — GROWTH ENGINE
# ═══════════════════════════════════════════════════════════════

class TestGrowthEngine:
    def test_register_visitor(self, growth_engine):
        journey = growth_engine.register_visitor(
            session_id="sess_1",
            source="organic",
        )
        assert journey.current_stage == FunnelStage.VISITOR
        assert journey.acquisition_source == "organic"
        assert journey.first_seen_at is not None

    def test_register_signup(self, growth_engine):
        journey = growth_engine.register_signup(
            user_id="user_1",
            source="paid",
            campaign="google_ads",
        )
        assert journey.current_stage == FunnelStage.SIGNUP
        assert journey.signed_up_at is not None
        assert journey.referral_code is not None
        assert journey.referral_code.startswith("LIFE-")

    def test_signup_with_referral(self, growth_engine):
        # Registra usuário referenciador
        referrer = growth_engine.register_signup(user_id="referrer_1")
        referral_code = referrer.referral_code

        # Registra usuário indicado
        referred = growth_engine.register_signup(
            user_id="referred_1",
            referral_code=referral_code,
        )

        assert referred.referral_code_used == referral_code
        assert referred.referrer_user_id == "referrer_1"

    def test_record_event_advances_funnel(self, growth_engine):
        growth_engine.register_signup(user_id="user_1")

        growth_engine.record_event(
            user_id="user_1",
            event_type=FunnelEventType.ONBOARDING_COMPLETED,
        )

        journey = growth_engine._journeys.get("user_1")
        assert journey.current_stage == FunnelStage.ACTIVATED

    def test_subscription_event(self, growth_engine):
        growth_engine.register_signup(user_id="user_1")
        growth_engine.record_event(user_id="user_1", event_type=FunnelEventType.ONBOARDING_COMPLETED)

        # Simula sessões para tornar ativo
        journey = growth_engine._journeys["user_1"]
        journey.total_sessions = 5
        growth_engine.record_event(user_id="user_1", event_type=FunnelEventType.SESSION_STARTED)

        growth_engine.record_event(
            user_id="user_1",
            event_type=FunnelEventType.SUBSCRIPTION_CREATED,
            properties={"plan": "pro"},
            revenue=29.0,
        )

        journey = growth_engine._journeys.get("user_1")
        assert journey.current_stage == FunnelStage.SUBSCRIBER_PRO

    def test_get_funnel_metrics(self, populated_engine):
        metrics = populated_engine.get_funnel_metrics()
        assert metrics.signups > 0
        assert metrics.activated_users >= 0

    def test_get_growth_metrics(self, populated_engine):
        metrics = populated_engine.get_growth_metrics("daily")
        assert metrics.new_signups >= 0
        assert metrics.dau >= 0

    def test_get_revenue_metrics(self, populated_engine):
        metrics = populated_engine.get_revenue_metrics()
        assert metrics.mrr_total >= 0
        assert metrics.arr >= 0

    def test_growth_dashboard(self, populated_engine):
        dashboard = populated_engine.get_growth_dashboard()
        assert "funnel" in dashboard
        assert "growth" in dashboard
        assert "retention" in dashboard
        assert "revenue" in dashboard
        assert "summary" in dashboard

    def test_referral_code_generation(self, growth_engine):
        growth_engine.register_signup(user_id="user_1")
        code = growth_engine.get_referral_code("user_1")
        assert code is not None
        assert code.code.startswith("LIFE-")

    def test_referral_stats(self, growth_engine):
        growth_engine.register_signup(user_id="user_1")
        stats = growth_engine.get_referral_stats("user_1")
        assert "referral_code" in stats
        assert "total_referrals" in stats


# ═══════════════════════════════════════════════════════════════
# TESTES — FUNNEL ENGINE
# ═══════════════════════════════════════════════════════════════

class TestFunnelEngine:
    def test_funnel_visualization(self):
        engine = FunnelEngine()
        journeys = []

        for i in range(100):
            j = UserJourney(user_id=f"user_{i}")
            j.first_seen_at = datetime.utcnow() - timedelta(days=1)
            journeys.append(j)

        for i in range(20):
            journeys[i].signed_up_at = datetime.utcnow() - timedelta(hours=20)
            journeys[i].current_stage = FunnelStage.SIGNUP

        engine.load_data(conversions=[], journeys=journeys)
        viz = engine.get_funnel_visualization()

        assert "stages" in viz
        assert len(viz["stages"]) > 0

    def test_stage_labels(self):
        assert FunnelEngine._stage_label(FunnelStage.VISITOR) == "Visitante"
        assert FunnelEngine._stage_label(FunnelStage.SIGNUP) == "Cadastro"
        assert FunnelEngine._stage_label(FunnelStage.ACTIVATED) == "Usuário Ativado"
        assert FunnelEngine._stage_label(FunnelStage.SUBSCRIBER_PRO) == "Assinante Pro"
        assert FunnelEngine._stage_label(FunnelStage.ENTERPRISE) == "Enterprise"


# ═══════════════════════════════════════════════════════════════
# TESTES — DASHBOARDS
# ═══════════════════════════════════════════════════════════════

class TestAcquisitionDashboard:
    def test_overview_structure(self, populated_engine):
        dashboard = AcquisitionDashboard()
        journeys = list(populated_engine._journeys.values())
        dashboard.load_data(journeys=journeys, events=populated_engine._events)

        overview = dashboard.get_overview(period_days=30)
        assert "period" in overview
        assert "metrics" in overview
        m = overview["metrics"]
        assert "visitors" in m
        assert "signups" in m
        assert "visitor_to_signup_pct" in m

    def test_channel_breakdown(self, populated_engine):
        dashboard = AcquisitionDashboard()
        journeys = list(populated_engine._journeys.values())
        dashboard.load_data(journeys=journeys, events=populated_engine._events)

        breakdown = dashboard.get_channel_breakdown()
        assert "channels" in breakdown
        assert "period_days" in breakdown

    def test_daily_signups(self, populated_engine):
        dashboard = AcquisitionDashboard()
        journeys = list(populated_engine._journeys.values())
        dashboard.load_data(journeys=journeys, events=populated_engine._events)

        daily = dashboard.get_daily_signups(days=7)
        assert len(daily) == 7
        for day_data in daily:
            assert "date" in day_data
            assert "signups" in day_data
            assert "conversion_rate_pct" in day_data

    def test_render_text(self, populated_engine):
        dashboard = AcquisitionDashboard()
        journeys = list(populated_engine._journeys.values())
        dashboard.load_data(journeys=journeys, events=populated_engine._events)

        text = dashboard.render_text()
        assert "ACQUISITION DASHBOARD" in text
        assert "Visitantes" in text


class TestRetentionDashboard:
    def test_retention_overview(self, populated_engine):
        dashboard = RetentionDashboard()
        journeys = list(populated_engine._journeys.values())
        dashboard.load_data(journeys=journeys)

        overview = dashboard.get_retention_overview()
        assert "retention_rates" in overview
        assert "churn" in overview
        assert "at_risk" in overview
        assert "health_score" in overview

    def test_churn_analysis(self, populated_engine):
        dashboard = RetentionDashboard()
        journeys = list(populated_engine._journeys.values())
        dashboard.load_data(journeys=journeys)

        analysis = dashboard.get_churn_analysis()
        assert "churned_users" in analysis

    def test_at_risk_users(self, populated_engine):
        # Adiciona usuário em risco
        engine = populated_engine
        journey = engine._journeys.get("user_5")
        if journey:
            journey.last_active_at = datetime.utcnow() - timedelta(days=10)
            journey.current_stage = FunnelStage.ACTIVE

        dashboard = RetentionDashboard()
        journeys = list(engine._journeys.values())
        dashboard.load_data(journeys=journeys)

        at_risk = dashboard.get_at_risk_users()
        assert isinstance(at_risk, list)

    def test_health_score_values(self):
        dashboard = RetentionDashboard()
        assert dashboard._calculate_health_score({"d30": 50}) == "excellent"
        assert dashboard._calculate_health_score({"d30": 26}) == "good"
        assert dashboard._calculate_health_score({"d30": 20}) == "fair"
        assert dashboard._calculate_health_score({"d30": 5}) == "needs_attention"

    def test_render_text(self, populated_engine):
        dashboard = RetentionDashboard()
        journeys = list(populated_engine._journeys.values())
        dashboard.load_data(journeys=journeys)

        text = dashboard.render_text()
        assert "RETENTION DASHBOARD" in text
        assert "Churn" in text


class TestGrowthDashboard:
    def test_executive_summary(self, populated_engine):
        dashboard = GrowthDashboard(populated_engine)
        dashboard.load_from_engine(populated_engine)

        summary = dashboard.get_executive_summary()
        assert "kpis" in summary
        assert "funnel" in summary
        assert "revenue" in summary
        assert "health" in summary

    def test_render_text(self, populated_engine):
        dashboard = GrowthDashboard(populated_engine)
        dashboard.load_from_engine(populated_engine)

        text = dashboard.render_text()
        assert "GROWTH DASHBOARD" in text
        assert "MRR" in text
        assert "Funil" in text.upper() or "FUNIL" in text


# ═══════════════════════════════════════════════════════════════
# TESTES — REFERRAL ENGINE
# ═══════════════════════════════════════════════════════════════

class TestReferralEngine:
    def test_generate_code(self, referral_engine):
        code = referral_engine.generate_code("user_1")
        assert code.user_id == "user_1"
        assert code.code.startswith("LIFE-")
        assert "lifeos.app" in code.link

    def test_idempotent_code_generation(self, referral_engine):
        code1 = referral_engine.generate_code("user_1")
        code2 = referral_engine.generate_code("user_1")
        assert code1.code == code2.code

    def test_track_link_click(self, referral_engine):
        referral_engine.generate_code("user_1")
        code = referral_engine.get_referral_code("user_1")

        referral = referral_engine.track_link_click(code, source="whatsapp")
        assert referral is not None
        assert referral.referrer_user_id == "user_1"
        assert referral.source == "whatsapp"

    def test_track_signup(self, referral_engine):
        referral_engine.generate_code("user_1")
        code = referral_engine.get_referral_code("user_1")

        referral = referral_engine.track_signup(code, "user_2")
        assert referral is not None
        assert referral.referred_user_id == "user_2"
        assert referral.status == ReferralStatus.SIGNED_UP

    def test_track_activation(self, referral_engine):
        referral_engine.generate_code("user_1")
        code = referral_engine.get_referral_code("user_1")
        referral_engine.track_signup(code, "user_2")

        result = referral_engine.track_activation("user_2", days_active=5)
        assert result is not None
        referral, reward = result
        assert referral.status == ReferralStatus.ACTIVATED
        assert reward is not None

    def test_track_conversion(self, referral_engine):
        referral_engine.generate_code("user_1")
        code = referral_engine.get_referral_code("user_1")
        referral_engine.track_signup(code, "user_2")
        referral_engine.track_activation("user_2", days_active=5)

        result = referral_engine.track_conversion("user_2", plan="pro", revenue=29.0)
        assert result is not None
        referral, reward = result
        assert referral.status == ReferralStatus.CONVERTED
        assert reward.value == 30  # 30 dias por conversão Pro

    def test_program_metrics(self, referral_engine):
        referral_engine.generate_code("user_1")
        code = referral_engine.get_referral_code("user_1")
        referral_engine.track_signup(code, "user_2")

        metrics = referral_engine.get_program_metrics()
        assert metrics["total_referrals"] >= 1
        assert "k_factor" in metrics

    def test_fraud_detection_self_referral(self, referral_engine):
        referral_engine.generate_code("user_1")
        code = referral_engine.get_referral_code("user_1")

        # Cria referral onde referred == referrer
        referral = referral_engine.track_signup(code, "user_2")
        if referral:
            referral.referred_user_id = "user_1"  # auto-referral

        is_fraud = referral_engine.detect_fraud("user_1")
        assert is_fraud is True

    def test_referral_stats(self, referral_engine):
        referral_engine.generate_code("user_1")
        stats = referral_engine.get_referral_stats("user_1")
        assert "referral_code" in stats
        assert "total_referrals" in stats
        assert "rewards" in stats


# ═══════════════════════════════════════════════════════════════
# TESTES — REWARD ENGINE
# ═══════════════════════════════════════════════════════════════

class TestRewardEngine:
    def test_create_reward(self):
        engine = RewardEngine()
        reward = engine.create_reward(
            user_id="user_1",
            reward_type=RewardType.SUBSCRIPTION_CREDIT,
            value=30,
            description="30 dias grátis",
        )
        assert reward.user_id == "user_1"
        assert reward.value == 30
        assert not reward.is_redeemed

    def test_grant_signup_reward(self):
        engine = RewardEngine()
        reward = engine.grant_signup_reward("user_1", "ref_1")
        assert reward.value == 7
        assert reward.reward_type == RewardType.SUBSCRIPTION_CREDIT

    def test_grant_conversion_reward(self):
        engine = RewardEngine()
        reward = engine.grant_conversion_reward("user_1", "ultra")
        assert reward.value == 60

        reward_enterprise = engine.grant_conversion_reward("user_1", "enterprise")
        assert reward_enterprise.value == 90

    def test_user_rewards_summary(self):
        engine = RewardEngine()
        engine.grant_signup_reward("user_1")
        engine.grant_conversion_reward("user_1", "pro")

        summary = engine.get_user_rewards_summary("user_1")
        assert summary["total_rewards"] == 2
        assert summary["available_credit_days"] == 37  # 7 + 30

    def test_leaderboard(self):
        engine = RewardEngine()
        for i in range(5):
            for _ in range(i + 1):
                engine.grant_conversion_reward(f"user_{i}", "pro")

        leaderboard = engine.get_leaderboard(limit=3)
        assert len(leaderboard) == 3
        assert leaderboard[0]["rank"] == 1
        assert leaderboard[0]["conversions"] >= leaderboard[1]["conversions"]


# ═══════════════════════════════════════════════════════════════
# TESTES — ACTIVATION ENGINE
# ═══════════════════════════════════════════════════════════════

class TestActivationEngine:
    def test_create_checklist(self, activation_engine):
        checklist = activation_engine.create_checklist(
            "user_1", UserProfile.PROFESSIONAL
        )
        assert checklist.user_id == "user_1"
        assert checklist.profile == UserProfile.PROFESSIONAL
        assert len(checklist.steps) > 0
        assert checklist.aha_moment_step_id == "three_checkins"

    def test_checklist_for_each_profile(self, activation_engine):
        for profile in UserProfile:
            checklist = activation_engine.create_checklist(f"user_{profile.value}", profile)
            assert len(checklist.steps) > 0

    def test_record_action_completes_step(self, activation_engine):
        activation_engine.create_checklist("user_1", UserProfile.PROFESSIONAL)

        result = activation_engine.record_action("user_1", "profile_completed")
        assert result["step_completed"] is True
        assert result["step_id"] == "profile_setup"

    def test_aha_moment_detection(self, activation_engine):
        activation_engine.create_checklist("user_1", UserProfile.WELLNESS)

        activation_engine.record_action("user_1", "profile_completed")
        activation_engine.record_action("user_1", "habit_created")
        activation_engine.record_action("user_1", "checkin_completed")
        activation_engine.record_action("user_1", "streak_3_achieved")

        checklist = activation_engine.get_checklist("user_1")
        assert checklist.is_aha_moment_reached is True

    def test_activation_status_progression(self, activation_engine):
        activation_engine.create_checklist("user_1", UserProfile.STUDENT)

        status = activation_engine.get_activation_status("user_1")
        assert status == ActivationStatus.NOT_STARTED

        activation_engine.record_action("user_1", "profile_completed")
        status = activation_engine.get_activation_status("user_1")
        assert status == ActivationStatus.IN_PROGRESS

    def test_completion_score(self, activation_engine):
        activation_engine.create_checklist("user_1", UserProfile.PROFESSIONAL)

        checklist = activation_engine.get_checklist("user_1")
        initial_score = checklist.completion_score
        assert initial_score == 0.0

        activation_engine.record_action("user_1", "profile_completed")
        assert checklist.completion_score > 0.0

    def test_activation_metrics(self, activation_engine):
        for i in range(5):
            activation_engine.create_checklist(f"user_{i}", UserProfile.PROFESSIONAL)
            activation_engine.record_action(f"user_{i}", "profile_completed")

        metrics = activation_engine.get_activation_metrics()
        assert metrics["total_users"] == 5
        assert "by_status" in metrics
        assert "aha_moment_rate_pct" in metrics

    def test_stalled_users_detection(self, activation_engine):
        activation_engine.create_checklist("user_1", UserProfile.PROFESSIONAL)
        activation_engine.record_action("user_1", "profile_completed")

        # Simula inatividade
        checklist = activation_engine._checklists["user_1"]
        for step in checklist.steps:
            if step.is_completed:
                step.completed_at = datetime.utcnow() - timedelta(days=5)

        stalled = activation_engine.get_stalled_users(stall_days=3)
        assert "user_1" in stalled


# ═══════════════════════════════════════════════════════════════
# TESTES — AHA MOMENT DETECTOR
# ═══════════════════════════════════════════════════════════════

class TestAhaMomentDetector:
    def test_detect_aha_moment(self):
        detector = AhaMomentDetector()
        journey = UserJourney(user_id="user_1", profile=UserProfile.PROFESSIONAL)
        journey.signed_up_at = datetime.utcnow() - timedelta(days=5)
        journey.goals_created = 2

        reached = detector.check_aha_moment(
            journey,
            user_data={"goals_created": 2, "checkins_7d": 4},
        )
        assert reached is True

    def test_no_aha_without_criteria(self):
        detector = AhaMomentDetector()
        journey = UserJourney(user_id="user_1")

        reached = detector.check_aha_moment(
            journey,
            user_data={"goals_created": 0, "checkins_7d": 1},
        )
        assert reached is False

    def test_time_to_aha(self):
        detector = AhaMomentDetector()
        journey = UserJourney(user_id="user_1")
        journey.signed_up_at = datetime.utcnow() - timedelta(hours=24)

        detector.check_aha_moment(
            journey,
            user_data={"goals_created": 1, "checkins_7d": 3},
        )

        time_to_aha = detector.get_time_to_aha("user_1")
        assert time_to_aha is not None
        assert time_to_aha >= 24.0

    def test_aha_stats(self):
        detector = AhaMomentDetector()
        for i in range(3):
            journey = UserJourney(user_id=f"user_{i}")
            journey.signed_up_at = datetime.utcnow() - timedelta(hours=i * 10 + 5)
            detector.check_aha_moment(
                journey,
                user_data={"goals_created": 1, "checkins_7d": 3},
            )

        stats = detector.get_aha_stats()
        assert stats["total_users_reached_aha"] == 3
        assert stats["avg_time_to_aha_hours"] > 0


# ═══════════════════════════════════════════════════════════════
# TESTES — ONBOARDING ENGINE
# ═══════════════════════════════════════════════════════════════

class TestOnboardingEngine:
    def test_start_onboarding(self, onboarding_engine):
        flow = onboarding_engine.start_onboarding("user_1")
        assert flow.user_id == "user_1"
        assert len(flow.steps) > 0
        assert flow.current_step is not None
        assert flow.progress_pct == 0.0

    def test_answer_question_detects_profile(self, onboarding_engine):
        onboarding_engine.start_onboarding("user_1")

        result = onboarding_engine.answer_question(
            "user_1", "main_goal", "career"
        )
        assert result["detected_profile"] == "professional"
        assert result["profile_confidence"] > 0

    def test_flow_personalization(self, onboarding_engine):
        onboarding_engine.start_onboarding("user_1")
        onboarding_engine.answer_question("user_1", "main_goal", "health")
        result = onboarding_engine.answer_question("user_1", "biggest_challenge", "consistency")

        flow = onboarding_engine.get_flow("user_1")
        # Após respostas suficientes, o fluxo deve ser personalizado
        assert flow is not None

    def test_advance_step(self, onboarding_engine):
        onboarding_engine.start_onboarding("user_1")
        flow = onboarding_engine.get_flow("user_1")
        initial_step = flow.current_step_index

        result = onboarding_engine.advance_step("user_1")
        assert result["progress_pct"] > 0 or result["next_step"] is not None

    def test_complete_onboarding(self, onboarding_engine):
        onboarding_engine.start_onboarding("user_1")
        flow = onboarding_engine.get_flow("user_1")

        # Avança por todos os passos
        for _ in range(len(flow.steps)):
            onboarding_engine.advance_step("user_1")

        assert flow.is_completed is True

    def test_onboarding_metrics(self, onboarding_engine):
        for i in range(3):
            onboarding_engine.start_onboarding(f"user_{i}")

        metrics = onboarding_engine.get_onboarding_metrics()
        assert metrics["total_users"] == 3
        assert "completion_rate_pct" in metrics


# ═══════════════════════════════════════════════════════════════
# TESTES — PROFILE DETECTOR
# ═══════════════════════════════════════════════════════════════

class TestProfileDetector:
    def test_detect_professional(self):
        detector = ProfileDetector()
        answers = {"main_goal": "career", "biggest_challenge": "focus"}
        profile = detector.detect(answers)
        assert profile == UserProfile.PROFESSIONAL

    def test_detect_student(self):
        detector = ProfileDetector()
        answers = {"main_goal": "study", "biggest_challenge": "time"}
        profile = detector.detect(answers)
        assert profile == UserProfile.STUDENT

    def test_detect_entrepreneur(self):
        detector = ProfileDetector()
        answers = {"main_goal": "business", "biggest_challenge": "priorities"}
        profile = detector.detect(answers)
        assert profile == UserProfile.ENTREPRENEUR

    def test_detect_wellness(self):
        detector = ProfileDetector()
        answers = {"main_goal": "health", "biggest_challenge": "consistency"}
        profile = detector.detect(answers)
        assert profile == UserProfile.WELLNESS

    def test_detect_creative(self):
        detector = ProfileDetector()
        answers = {"main_goal": "creative", "biggest_challenge": "motivation"}
        profile = detector.detect(answers)
        assert profile == UserProfile.CREATIVE

    def test_unknown_with_no_answers(self):
        detector = ProfileDetector()
        profile = detector.detect({})
        assert profile == UserProfile.UNKNOWN

    def test_confidence_score(self):
        detector = ProfileDetector()
        answers = {"main_goal": "career"}
        confidence = detector.get_confidence(answers, UserProfile.PROFESSIONAL)
        assert confidence > 0.5

    def test_all_scores(self):
        detector = ProfileDetector()
        answers = {"main_goal": "career"}
        scores = detector.get_all_scores(answers)
        assert "professional" in scores
        assert scores["professional"] > 0


# ═══════════════════════════════════════════════════════════════
# TESTES — INTEGRAÇÃO DO FUNIL COMPLETO
# ═══════════════════════════════════════════════════════════════

class TestFullFunnelIntegration:
    """
    Testes de integração que simulam o funil completo:
    Visitante → Cadastro → Ativação → Assinatura → Referral
    """

    def test_complete_funnel_journey(self):
        """Simula a jornada completa de um usuário pelo funil."""
        engine = GrowthEngine()
        onboarding = OnboardingEngine()
        activation = ActivationEngine()
        referral = ReferralEngine()

        # 1. Visitante chega ao site
        visitor = engine.register_visitor(
            session_id="sess_complete",
            source="organic",
        )
        assert visitor.current_stage == FunnelStage.VISITOR

        # 2. Visitante se cadastra
        journey = engine.register_signup(
            user_id="complete_user",
            session_id="sess_complete",
            source="organic",
        )
        assert journey.current_stage == FunnelStage.SIGNUP

        # 3. Onboarding
        flow = onboarding.start_onboarding("complete_user")
        onboarding.answer_question("complete_user", "main_goal", "career")
        assert flow.current_step is not None

        # 4. Ativação
        checklist = activation.create_checklist("complete_user", UserProfile.PROFESSIONAL)
        activation.record_action("complete_user", "profile_completed")
        activation.record_action("complete_user", "first_goal")
        activation.record_action("complete_user", "checkin_completed")
        activation.record_action("complete_user", "three_checkins")

        # 5. Evento de ativação no engine
        engine.record_event(
            user_id="complete_user",
            event_type=FunnelEventType.ONBOARDING_COMPLETED,
        )
        journey = engine._journeys["complete_user"]
        assert journey.current_stage == FunnelStage.ACTIVATED

        # 6. Assinatura — avança ACTIVATED -> ACTIVE via SESSION_STARTED
        engine._active_threshold_sessions = 1
        engine.record_event(
            user_id="complete_user",
            event_type=FunnelEventType.SESSION_STARTED,
        )
        engine.record_event(
            user_id="complete_user",
            event_type=FunnelEventType.SUBSCRIPTION_CREATED,
            properties={"plan": "pro"},
            revenue=29.0,
        )
        assert journey.current_stage == FunnelStage.SUBSCRIBER_PRO

        # 7. Referral
        ref_code = referral.generate_code("complete_user")
        referral.track_signup(ref_code.code, "referred_user")
        result = referral.track_activation("referred_user", days_active=5)
        assert result is not None
        ref, reward = result
        assert ref.status == ReferralStatus.ACTIVATED

    def test_funnel_metrics_consistency(self):
        """Verifica consistência das métricas do funil."""
        engine = GrowthEngine()

        # Popula com dados conhecidos: 100 visitantes
        for i in range(100):
            engine.register_visitor(session_id=f"s_{i}", source="organic")

        # 30 cadastros (sem session_id para não criar novos visitantes)
        for i in range(30):
            engine.register_signup(user_id=f"u_{i}", source="organic")

        for i in range(15):
            engine.record_event(f"u_{i}", FunnelEventType.ONBOARDING_COMPLETED)

        metrics = engine.get_funnel_metrics()
        # Visitantes = 100 (register_visitor) + 30 (register_signup sem session)
        # register_signup cria journey se não existir
        assert metrics.signups == 30
        assert metrics.activated_users == 15

        metrics.compute_derived_metrics()
        assert metrics.signup_to_activation_rate == pytest.approx(0.50)

    def test_referral_viral_coefficient(self):
        """Testa o cálculo do coeficiente viral."""
        engine = GrowthEngine()

        # Cria usuários com referrals
        for i in range(10):
            j = engine.register_signup(user_id=f"u_{i}")
            j.referrals_sent = 5
            j.referrals_converted = 2

        metrics = engine.get_metrics_engine_data()
        # K-factor = avg_invites * conversion_rate = 5 * 0.4 = 2.0
        # Indica crescimento viral

    def test_revenue_metrics_by_plan(self):
        """Testa métricas de receita por plano."""
        engine = GrowthEngine()
        engine._active_threshold_sessions = 1  # Reduz threshold para testes

        for i in range(3):
            j = engine.register_signup(user_id=f"pro_{i}")
            engine.record_event(f"pro_{i}", FunnelEventType.ONBOARDING_COMPLETED)
            # ACTIVATED -> ACTIVE via SESSION_STARTED
            engine.record_event(f"pro_{i}", FunnelEventType.SESSION_STARTED)
            engine.record_event(
                f"pro_{i}",
                FunnelEventType.SUBSCRIPTION_CREATED,
                properties={"plan": "pro"},
                revenue=29.0,
            )

        for i in range(2):
            j = engine.register_signup(user_id=f"ultra_{i}")
            engine.record_event(f"ultra_{i}", FunnelEventType.ONBOARDING_COMPLETED)
            engine.record_event(f"ultra_{i}", FunnelEventType.SESSION_STARTED)
            engine.record_event(
                f"ultra_{i}",
                FunnelEventType.SUBSCRIPTION_CREATED,
                properties={"plan": "ultra"},
                revenue=79.0,
            )

        revenue = engine.get_revenue_metrics()
        assert revenue.subscribers_pro == 3
        assert revenue.subscribers_ultra == 2
        assert revenue.mrr_pro == pytest.approx(87.0)
        assert revenue.mrr_ultra == pytest.approx(158.0)
        assert revenue.mrr_total == pytest.approx(245.0)
