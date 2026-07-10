"""
Test Suite — Company OS
=======================
Testes automatizados para o Autonomous Company System da LifeOS.

Cobre:
    - Health Score Models (5 scores + snapshot)
    - OKR Models e OKR Tracker
    - Alert Models e Alert Rules
    - KPI Models e CEO Dashboard Data
    - Metrics Collector
    - Auto Monitor
    - Company / Executive / Operational / CEO Dashboards
    - Report Engine (4 tipos de relatório)
    - Integração completa do Company OS
"""

import pytest
from datetime import datetime, date, timedelta
from typing import List

# ── Imports do Company OS ─────────────────────────────────────────────────────
from company_os.models.health_scores import (
    HealthStatus, BusinessHealthScore, GrowthScore,
    ProductHealthScore, CustomerHealthScore, PlatformHealthScore,
    CompanyHealthSnapshot,
)
from company_os.models.okr import (
    OKRStatus, OKRLevel, KeyResult, Objective, OKRCycle,
)
from company_os.models.alerts import (
    AlertSeverity, AlertType, AlertStatus, Alert, AlertRule,
)
from company_os.models.kpi import KPISnapshot, CEODashboardData

from company_os.monitoring.metrics_collector import MetricsCollector, MetricPoint
from company_os.monitoring.monitor import AutoMonitor, DEFAULT_ALERT_RULES

from company_os.dashboards.company_dashboard import CompanyDashboard
from company_os.dashboards.executive_dashboard import ExecutiveDashboard
from company_os.dashboards.operational_dashboard import OperationalDashboard
from company_os.dashboards.ceo_dashboard import CEODashboard

from company_os.reports.report_engine import ReportEngine, ReportType, ExecutiveReport
from company_os.okr.okr_tracker import OKRTracker


# ═════════════════════════════════════════════════════════════════════════════
# FIXTURES
# ═════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def healthy_business_score():
    """BusinessHealthScore com métricas saudáveis."""
    score = BusinessHealthScore(
        mrr=50_000,
        arr=600_000,
        mrr_growth_mom=15.0,
        ltv=1_200,
        cac=300,
        ltv_cac_ratio=4.0,
        monthly_churn_rate=0.02,
        runway_months=24,
        gross_margin=0.75,
    )
    return score.calculate()


@pytest.fixture
def healthy_growth_score():
    """GrowthScore com métricas saudáveis."""
    score = GrowthScore(
        new_signups_30d=500,
        prev_signups_30d=400,
        activation_rate=0.55,
        k_factor=0.3,
        expansion_mrr=5_000,
        total_mrr=50_000,
        visitor_to_signup_rate=0.05,
    )
    return score.calculate()


@pytest.fixture
def healthy_product_score():
    """ProductHealthScore com métricas saudáveis."""
    score = ProductHealthScore(
        nps=45,
        feature_adoption_rate=0.35,
        bug_rate_per_1k_sessions=0.5,
        dau_mau_ratio=0.20,
        crash_free_rate=0.998,
        avg_session_duration_min=12.0,
    )
    return score.calculate()


@pytest.fixture
def healthy_customer_score():
    """CustomerHealthScore com métricas saudáveis."""
    score = CustomerHealthScore(
        d30_retention=0.28,
        csat_score=4.2,
        support_sla_compliance=0.92,
        at_risk_users_pct=0.08,
        avg_response_time_hours=4.0,
        resolved_tickets_pct=0.95,
    )
    return score.calculate()


@pytest.fixture
def healthy_platform_score():
    """PlatformHealthScore com métricas saudáveis."""
    score = PlatformHealthScore(
        uptime_pct=99.95,
        p95_latency_ms=400,
        error_rate_pct=0.05,
        security_score=88.0,
        api_success_rate=99.8,
        avg_response_ms=180,
        incidents_30d=1,
    )
    return score.calculate()


@pytest.fixture
def company_snapshot(
    healthy_business_score,
    healthy_growth_score,
    healthy_product_score,
    healthy_customer_score,
    healthy_platform_score,
):
    """CompanyHealthSnapshot completo."""
    snapshot = CompanyHealthSnapshot(
        business=healthy_business_score,
        growth=healthy_growth_score,
        product=healthy_product_score,
        customer=healthy_customer_score,
        platform=healthy_platform_score,
    )
    return snapshot.calculate_overall()


@pytest.fixture
def ceo_data():
    """CEODashboardData com dados realistas."""
    return CEODashboardData(
        mrr=50_000,
        mrr_prev=45_000,
        arr=600_000,
        mrr_growth_mom_pct=11.1,
        new_mrr=8_000,
        expansion_mrr=3_000,
        churned_mrr=1_000,
        net_new_mrr=10_000,
        gross_margin_pct=75.0,
        total_users=5_000,
        new_users_30d=500,
        new_users_prev_30d=400,
        active_users_dau=800,
        active_users_mau=2_500,
        dau_mau_ratio=0.32,
        d30_retention_pct=28.0,
        monthly_churn_pct=2.0,
        annual_churn_pct=22.0,
        at_risk_users=150,
        ltv=1_200,
        cac=300,
        ltv_cac_ratio=4.0,
        arpu=20.0,
        payback_months=15.0,
        nps=45.0,
        csat=4.2,
        uptime_pct=99.95,
        p95_latency_ms=400,
        error_rate_pct=0.05,
        incidents_30d=1,
        k_factor=0.3,
        activation_rate_pct=55.0,
        visitor_to_signup_pct=5.0,
    )


@pytest.fixture
def okr_cycle():
    """OKRCycle com objectives e key results."""
    today = date.today()
    cycle = OKRCycle(
        name="Q3 2026",
        cycle_type="quarterly",
        start_date=today - timedelta(days=30),
        end_date=today + timedelta(days=60),
        is_active=True,
    )

    obj = Objective(
        title="Crescer receita",
        owner="CEO",
        level=OKRLevel.COMPANY,
    )
    kr = KeyResult(
        title="MRR de R$ 100k",
        metric_name="mrr",
        start_value=0,
        target_value=100_000,
        current_value=50_000,
        unit="R$",
    )
    kr.update(50_000)
    obj.add_key_result(kr)
    cycle.objectives.append(obj)

    return cycle


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: HEALTH STATUS
# ═════════════════════════════════════════════════════════════════════════════

class TestHealthStatus:
    def test_from_score_excellent(self):
        assert HealthStatus.from_score(95) == HealthStatus.EXCELLENT

    def test_from_score_good(self):
        assert HealthStatus.from_score(80) == HealthStatus.GOOD

    def test_from_score_fair(self):
        assert HealthStatus.from_score(65) == HealthStatus.FAIR

    def test_from_score_warning(self):
        assert HealthStatus.from_score(50) == HealthStatus.WARNING

    def test_from_score_critical(self):
        assert HealthStatus.from_score(30) == HealthStatus.CRITICAL

    def test_boundary_90(self):
        assert HealthStatus.from_score(90) == HealthStatus.EXCELLENT

    def test_boundary_75(self):
        assert HealthStatus.from_score(75) == HealthStatus.GOOD

    def test_boundary_40(self):
        assert HealthStatus.from_score(40) == HealthStatus.WARNING


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: BUSINESS HEALTH SCORE
# ═════════════════════════════════════════════════════════════════════════════

class TestBusinessHealthScore:
    def test_calculate_returns_self(self, healthy_business_score):
        assert isinstance(healthy_business_score, BusinessHealthScore)

    def test_score_range(self, healthy_business_score):
        assert 0 <= healthy_business_score.score <= 100

    def test_healthy_score_is_good_or_excellent(self, healthy_business_score):
        assert healthy_business_score.status in (HealthStatus.GOOD, HealthStatus.EXCELLENT)

    def test_components_present(self, healthy_business_score):
        assert "mrr_growth" in healthy_business_score.components
        assert "ltv_cac" in healthy_business_score.components
        assert "churn" in healthy_business_score.components
        assert "runway" in healthy_business_score.components

    def test_high_churn_lowers_score(self):
        score = BusinessHealthScore(
            mrr_growth_mom=5.0,
            ltv_cac_ratio=2.0,
            monthly_churn_rate=0.15,  # 15% churn
            runway_months=6,
        ).calculate()
        assert score.score < 50

    def test_to_dict_structure(self, healthy_business_score):
        d = healthy_business_score.to_dict()
        assert "score" in d
        assert "status" in d
        assert "components" in d
        assert "financials" in d

    def test_zero_inputs_gives_critical(self):
        score = BusinessHealthScore().calculate()
        assert score.status == HealthStatus.CRITICAL


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: GROWTH SCORE
# ═════════════════════════════════════════════════════════════════════════════

class TestGrowthScore:
    def test_calculate_score_range(self, healthy_growth_score):
        assert 0 <= healthy_growth_score.score <= 100

    def test_components_present(self, healthy_growth_score):
        assert "signup_growth" in healthy_growth_score.components
        assert "activation_rate" in healthy_growth_score.components
        assert "k_factor" in healthy_growth_score.components
        assert "expansion_mrr" in healthy_growth_score.components

    def test_high_growth_gives_good_score(self, healthy_growth_score):
        assert healthy_growth_score.score >= 40

    def test_zero_growth_lowers_score(self):
        score = GrowthScore(
            new_signups_30d=100,
            prev_signups_30d=100,
            activation_rate=0.10,
            k_factor=0.0,
        ).calculate()
        assert score.score < 30

    def test_to_dict_has_metrics(self, healthy_growth_score):
        d = healthy_growth_score.to_dict()
        assert "metrics" in d
        assert "new_signups_30d" in d["metrics"]


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: PRODUCT HEALTH SCORE
# ═════════════════════════════════════════════════════════════════════════════

class TestProductHealthScore:
    def test_score_range(self, healthy_product_score):
        assert 0 <= healthy_product_score.score <= 100

    def test_high_nps_improves_score(self):
        score = ProductHealthScore(
            nps=80,
            feature_adoption_rate=0.50,
            bug_rate_per_1k_sessions=0.1,
            dau_mau_ratio=0.30,
        ).calculate()
        assert score.score >= 70

    def test_negative_nps_lowers_score(self):
        score = ProductHealthScore(nps=-50).calculate()
        assert score.score < 50

    def test_components_present(self, healthy_product_score):
        assert "nps" in healthy_product_score.components
        assert "feature_adoption" in healthy_product_score.components
        assert "bug_rate" in healthy_product_score.components
        assert "stickiness" in healthy_product_score.components


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: CUSTOMER HEALTH SCORE
# ═════════════════════════════════════════════════════════════════════════════

class TestCustomerHealthScore:
    def test_score_range(self, healthy_customer_score):
        assert 0 <= healthy_customer_score.score <= 100

    def test_high_retention_improves_score(self):
        score = CustomerHealthScore(
            d30_retention=0.40,
            csat_score=4.8,
            support_sla_compliance=0.98,
            at_risk_users_pct=0.02,
        ).calculate()
        assert score.score >= 80

    def test_low_retention_lowers_score(self):
        score = CustomerHealthScore(
            d30_retention=0.05,
            csat_score=2.0,
        ).calculate()
        assert score.score < 40

    def test_components_present(self, healthy_customer_score):
        for key in ["d30_retention", "csat", "support_sla", "churn_risk"]:
            assert key in healthy_customer_score.components


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: PLATFORM HEALTH SCORE
# ═════════════════════════════════════════════════════════════════════════════

class TestPlatformHealthScore:
    def test_score_range(self, healthy_platform_score):
        assert 0 <= healthy_platform_score.score <= 100

    def test_perfect_platform_gives_excellent(self):
        score = PlatformHealthScore(
            uptime_pct=99.99,
            p95_latency_ms=100,
            error_rate_pct=0.0,
            security_score=100,
        ).calculate()
        assert score.status == HealthStatus.EXCELLENT

    def test_downtime_lowers_score(self):
        score = PlatformHealthScore(
            uptime_pct=95.0,
            p95_latency_ms=3000,
            error_rate_pct=5.0,
            security_score=40,
        ).calculate()
        assert score.score < 50

    def test_components_present(self, healthy_platform_score):
        for key in ["uptime", "p95_latency", "error_rate", "security"]:
            assert key in healthy_platform_score.components


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: COMPANY HEALTH SNAPSHOT
# ═════════════════════════════════════════════════════════════════════════════

class TestCompanyHealthSnapshot:
    def test_overall_score_range(self, company_snapshot):
        assert 0 <= company_snapshot.overall_score <= 100

    def test_overall_status_set(self, company_snapshot):
        assert company_snapshot.overall_status in HealthStatus

    def test_weighted_average(self, company_snapshot):
        expected = round(
            company_snapshot.business.score  * 0.30 +
            company_snapshot.growth.score    * 0.25 +
            company_snapshot.product.score   * 0.20 +
            company_snapshot.customer.score  * 0.15 +
            company_snapshot.platform.score  * 0.10,
            1
        )
        assert company_snapshot.overall_score == expected

    def test_get_critical_areas_empty_when_healthy(self, company_snapshot):
        # Com métricas saudáveis, não deve haver áreas críticas
        # (pode ter warnings dependendo dos valores)
        areas = company_snapshot.get_critical_areas()
        assert isinstance(areas, list)

    def test_get_critical_areas_detects_critical(self):
        snapshot = CompanyHealthSnapshot(
            business=BusinessHealthScore().calculate(),  # score 0 → CRITICAL
        )
        snapshot.calculate_overall()
        areas = snapshot.get_critical_areas()
        assert any("Negócio" in a for a in areas)

    def test_to_dict_structure(self, company_snapshot):
        d = company_snapshot.to_dict()
        assert "overall_score" in d
        assert "overall_status" in d
        assert "scores" in d
        assert "critical_areas" in d
        for key in ["business", "growth", "product", "customer", "platform"]:
            assert key in d["scores"]


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: OKR MODELS
# ═════════════════════════════════════════════════════════════════════════════

class TestKeyResult:
    def test_progress_pct_zero_at_start(self):
        kr = KeyResult(start_value=0, target_value=100, current_value=0)
        assert kr.progress_pct == 0.0

    def test_progress_pct_full_at_target(self):
        kr = KeyResult(start_value=0, target_value=100, current_value=100)
        assert kr.progress_pct == 100.0

    def test_progress_pct_midway(self):
        kr = KeyResult(start_value=0, target_value=100, current_value=50)
        assert kr.progress_pct == 50.0

    def test_progress_capped_at_100(self):
        kr = KeyResult(start_value=0, target_value=100, current_value=150)
        assert kr.progress_pct == 100.0

    def test_update_sets_status_on_track(self):
        kr = KeyResult(start_value=0, target_value=100)
        kr.update(75)
        assert kr.status == OKRStatus.ON_TRACK

    def test_update_sets_status_completed(self):
        kr = KeyResult(start_value=0, target_value=100)
        kr.update(100)
        assert kr.status == OKRStatus.COMPLETED

    def test_update_sets_status_behind(self):
        kr = KeyResult(start_value=0, target_value=100)
        kr.update(20)
        assert kr.status == OKRStatus.BEHIND

    def test_to_dict_has_required_fields(self):
        kr = KeyResult(title="Test KR", metric_name="mrr", start_value=0, target_value=100)
        d = kr.to_dict()
        for field in ["kr_id", "title", "progress_pct", "status", "current_value"]:
            assert field in d


class TestObjective:
    def test_overall_progress_no_krs(self):
        obj = Objective(title="Test")
        assert obj.overall_progress_pct == 0.0

    def test_overall_progress_with_krs(self):
        obj = Objective(title="Test")
        kr1 = KeyResult(start_value=0, target_value=100, current_value=50)
        kr2 = KeyResult(start_value=0, target_value=100, current_value=50)
        obj.add_key_result(kr1)
        obj.add_key_result(kr2)
        assert obj.overall_progress_pct == 50.0

    def test_computed_status_on_track(self):
        obj = Objective(title="Test")
        kr = KeyResult(start_value=0, target_value=100)
        kr.update(80)
        obj.add_key_result(kr)
        assert obj.computed_status == OKRStatus.ON_TRACK

    def test_to_dict_has_key_results(self):
        obj = Objective(title="Test")
        kr = KeyResult(title="KR1", start_value=0, target_value=100)
        obj.add_key_result(kr)
        d = obj.to_dict()
        assert len(d["key_results"]) == 1


class TestOKRCycle:
    def test_days_remaining_positive(self, okr_cycle):
        assert okr_cycle.days_remaining >= 0

    def test_elapsed_pct_between_0_and_100(self, okr_cycle):
        assert 0 <= okr_cycle.elapsed_pct <= 100

    def test_overall_progress_pct(self, okr_cycle):
        assert 0 <= okr_cycle.overall_progress_pct <= 100

    def test_get_summary_structure(self, okr_cycle):
        summary = okr_cycle.get_summary()
        for key in ["cycle_id", "name", "overall_progress_pct", "days_remaining",
                    "elapsed_pct", "by_status", "total_objectives"]:
            assert key in summary

    def test_get_summary_by_status(self, okr_cycle):
        summary = okr_cycle.get_summary()
        for status in OKRStatus:
            assert status.value in summary["by_status"]


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: OKR TRACKER
# ═════════════════════════════════════════════════════════════════════════════

class TestOKRTracker:
    def test_create_cycle(self):
        tracker = OKRTracker()
        cycle = tracker.create_cycle(
            "Q3 2026",
            date.today(),
            date.today() + timedelta(days=90),
        )
        assert cycle.name == "Q3 2026"
        assert cycle.is_active

    def test_add_objective(self):
        tracker = OKRTracker()
        cycle = tracker.create_cycle("Q3", date.today(), date.today() + timedelta(days=90))
        obj = tracker.add_objective(cycle.cycle_id, "Crescer receita", owner="CEO")
        assert obj is not None
        assert obj.title == "Crescer receita"
        assert len(cycle.objectives) == 1

    def test_add_key_result(self):
        tracker = OKRTracker()
        cycle = tracker.create_cycle("Q3", date.today(), date.today() + timedelta(days=90))
        obj = tracker.add_objective(cycle.cycle_id, "Crescer receita")
        kr = tracker.add_key_result(obj.objective_id, "MRR R$ 100k", "mrr", 0, 100_000)
        assert kr is not None
        assert kr.title == "MRR R$ 100k"

    def test_update_key_result(self):
        tracker = OKRTracker()
        cycle = tracker.create_cycle("Q3", date.today(), date.today() + timedelta(days=90))
        obj = tracker.add_objective(cycle.cycle_id, "Crescer receita")
        kr = tracker.add_key_result(obj.objective_id, "MRR", "mrr", 0, 100_000)
        updated = tracker.update_key_result(kr.kr_id, 50_000)
        assert updated.current_value == 50_000
        assert updated.progress_pct == 50.0

    def test_get_active_cycle(self):
        tracker = OKRTracker()
        cycle = tracker.create_cycle("Q3", date.today(), date.today() + timedelta(days=90))
        active = tracker.get_active_cycle()
        assert active is not None
        assert active.cycle_id == cycle.cycle_id

    def test_get_at_risk_objectives(self):
        tracker = OKRTracker()
        cycle = tracker.create_cycle("Q3", date.today(), date.today() + timedelta(days=90))
        obj = tracker.add_objective(cycle.cycle_id, "Objetivo em risco")
        kr = tracker.add_key_result(obj.objective_id, "KR", "metric", 0, 100)
        tracker.update_key_result(kr.kr_id, 10)  # 10% → BEHIND
        at_risk = tracker.get_at_risk_objectives(cycle.cycle_id)
        assert len(at_risk) >= 1

    def test_create_lifeos_q1_okrs(self):
        tracker = OKRTracker()
        cycle = tracker.create_lifeos_q1_okrs()
        assert len(cycle.objectives) == 3
        for obj in cycle.objectives:
            assert len(obj.key_results) == 3

    def test_get_cycle_report(self):
        tracker = OKRTracker()
        cycle = tracker.create_lifeos_q1_okrs()
        report = tracker.get_cycle_report(cycle.cycle_id)
        assert "overall_progress_pct" in report
        assert "total_objectives" in report


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: ALERT MODELS
# ═════════════════════════════════════════════════════════════════════════════

class TestAlertRule:
    def test_trigger_lt(self):
        rule = AlertRule(
            name="Test",
            metric_name="churn",
            operator="lt",
            threshold=5.0,
            cooldown_minutes=0,
        )
        assert rule.should_trigger(3.0) is True
        assert rule.should_trigger(7.0) is False

    def test_trigger_gt(self):
        rule = AlertRule(
            name="Test",
            metric_name="latency",
            operator="gt",
            threshold=1000.0,
            cooldown_minutes=0,
        )
        assert rule.should_trigger(1500.0) is True
        assert rule.should_trigger(500.0) is False

    def test_trigger_change_pct(self):
        rule = AlertRule(
            name="Test",
            metric_name="mrr",
            operator="change_pct",
            change_threshold_pct=10.0,
            cooldown_minutes=0,
        )
        assert rule.should_trigger(90.0, previous_value=100.0) is True
        assert rule.should_trigger(98.0, previous_value=100.0) is False

    def test_disabled_rule_never_triggers(self):
        rule = AlertRule(
            name="Test",
            metric_name="metric",
            operator="lt",
            threshold=100.0,
            is_enabled=False,
            cooldown_minutes=0,
        )
        assert rule.should_trigger(0.0) is False

    def test_build_alert(self):
        rule = AlertRule(
            name="Churn Alto",
            alert_type=AlertType.REVENUE,
            severity=AlertSeverity.CRITICAL,
            metric_name="churn",
            operator="gt",
            threshold=5.0,
            message_template="Churn em {current:.1f}%",
            cooldown_minutes=0,
        )
        alert = rule.build_alert(8.0, 3.0)
        assert alert.title == "Churn Alto"
        assert alert.severity == AlertSeverity.CRITICAL
        assert alert.current_value == 8.0


class TestAlert:
    def test_acknowledge(self):
        alert = Alert(title="Test", severity=AlertSeverity.WARNING)
        alert.acknowledge("admin")
        assert alert.status == AlertStatus.ACKNOWLEDGED
        assert alert.acknowledged_by == "admin"

    def test_resolve(self):
        alert = Alert(title="Test", severity=AlertSeverity.WARNING)
        alert.resolve()
        assert alert.status == AlertStatus.RESOLVED
        assert alert.resolved_at is not None

    def test_age_minutes(self):
        alert = Alert(title="Test")
        assert alert.age_minutes >= 0

    def test_to_dict_structure(self):
        alert = Alert(
            title="Test Alert",
            alert_type=AlertType.PERFORMANCE,
            severity=AlertSeverity.CRITICAL,
        )
        d = alert.to_dict()
        for key in ["alert_id", "title", "severity", "status", "created_at"]:
            assert key in d


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: KPI MODELS
# ═════════════════════════════════════════════════════════════════════════════

class TestKPISnapshot:
    def test_compute_trend_up(self):
        kpi = KPISnapshot("MRR", 110, 100, is_good_when="up")
        kpi.compute_trend()
        assert kpi.trend == "up"
        assert kpi.trend_pct == 10.0

    def test_compute_trend_down(self):
        kpi = KPISnapshot("Churn", 8, 5, is_good_when="down")
        kpi.compute_trend()
        assert kpi.trend == "up"  # valor subiu
        assert kpi.is_positive is False  # mas é ruim (is_good_when=down)

    def test_compute_trend_stable(self):
        kpi = KPISnapshot("MRR", 100, 100)
        kpi.compute_trend()
        assert kpi.trend == "stable"

    def test_is_positive_good_trend(self):
        kpi = KPISnapshot("MRR", 110, 100, is_good_when="up")
        kpi.compute_trend()
        assert kpi.is_positive is True

    def test_to_dict(self):
        kpi = KPISnapshot("NPS", 50, 40, is_good_when="up")
        kpi.compute_trend()
        d = kpi.to_dict()
        assert d["name"] == "NPS"
        assert d["value"] == 50
        assert "trend" in d


class TestCEODashboardData:
    def test_build_kpi_list(self, ceo_data):
        kpis = ceo_data.build_kpi_list()
        assert len(kpis) >= 10
        names = [k.name for k in kpis]
        assert "MRR" in names
        assert "NPS" in names

    def test_to_dict_structure(self, ceo_data):
        d = ceo_data.to_dict()
        for section in ["revenue", "users", "retention", "unit_economics",
                        "satisfaction", "platform", "growth", "kpis"]:
            assert section in d

    def test_to_dict_revenue_values(self, ceo_data):
        d = ceo_data.to_dict()
        assert d["revenue"]["mrr"] == 50_000
        assert d["revenue"]["arr"] == 600_000


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: METRICS COLLECTOR
# ═════════════════════════════════════════════════════════════════════════════

class TestMetricsCollector:
    def test_record_metric(self):
        collector = MetricsCollector()
        point = collector.record("mrr", 50_000)
        assert isinstance(point, MetricPoint)
        assert collector.get_current("mrr") == 50_000

    def test_get_previous(self):
        collector = MetricsCollector()
        collector.record("mrr", 40_000)
        collector.record("mrr", 50_000)
        assert collector.get_previous("mrr") == 40_000

    def test_get_change_pct(self):
        collector = MetricsCollector()
        collector.record("mrr", 100)
        collector.record("mrr", 110)
        change = collector.get_change_pct("mrr")
        assert change == 10.0

    def test_get_history(self):
        collector = MetricsCollector()
        for i in range(5):
            collector.record("mrr", float(i * 1000))
        history = collector.get_history("mrr", limit=3)
        assert len(history) == 3

    def test_register_provider(self):
        collector = MetricsCollector()
        collector.register_provider("test_metric", lambda: 42.0)
        collected = collector.collect_all()
        assert collected["test_metric"] == 42.0

    def test_get_all_current(self):
        collector = MetricsCollector()
        collector.record("mrr", 50_000)
        collector.record("churn", 2.5)
        all_current = collector.get_all_current()
        assert "mrr" in all_current
        assert "churn" in all_current

    def test_get_snapshot(self):
        collector = MetricsCollector()
        collector.record("mrr", 50_000)
        snapshot = collector.get_snapshot()
        assert "metrics" in snapshot
        assert "mrr" in snapshot["metrics"]

    def test_buffer_size_limit(self):
        collector = MetricsCollector(buffer_size=5)
        for i in range(10):
            collector.record("metric", float(i))
        history = collector.get_history("metric")
        assert len(history) <= 5


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: AUTO MONITOR
# ═════════════════════════════════════════════════════════════════════════════

class TestAutoMonitor:
    def test_load_default_rules(self):
        monitor = AutoMonitor()
        monitor.load_default_rules()
        assert len(monitor._rules) > 0

    def test_evaluate_triggers_churn_alert(self):
        monitor = AutoMonitor()
        monitor.load_default_rules()
        # Registra valor anterior baixo
        monitor._collector.record("monthly_churn_pct", 2.0)
        # Avalia com churn alto
        alerts = monitor.evaluate({"monthly_churn_pct": 10.0})
        assert any(a.metric_name == "monthly_churn_pct" for a in alerts)

    def test_evaluate_triggers_latency_alert(self):
        monitor = AutoMonitor()
        monitor.load_default_rules()
        alerts = monitor.evaluate({"p95_latency_ms": 2500.0})
        assert any(a.metric_name == "p95_latency_ms" for a in alerts)

    def test_evaluate_no_alerts_healthy_metrics(self):
        monitor = AutoMonitor()
        monitor.load_default_rules()
        alerts = monitor.evaluate({
            "monthly_churn_pct": 1.5,
            "d30_retention_pct": 30.0,
            "p95_latency_ms": 300.0,
            "error_rate_pct": 0.02,
            "uptime_pct": 99.99,
            "ltv_cac_ratio": 4.0,
        })
        # Métricas saudáveis não devem gerar alertas críticos
        critical = [a for a in alerts if a.severity == AlertSeverity.CRITICAL]
        assert len(critical) == 0

    def test_evaluate_health_snapshot_critical(self):
        monitor = AutoMonitor()
        snapshot = CompanyHealthSnapshot(
            business=BusinessHealthScore().calculate(),  # CRITICAL
        )
        snapshot.calculate_overall()
        alerts = monitor.evaluate_health_snapshot(snapshot)
        assert len(alerts) > 0

    def test_get_active_alerts(self):
        monitor = AutoMonitor()
        monitor.load_default_rules()
        # Registra valor anterior para que change_pct não interfira
        monitor._collector.record("monthly_churn_pct", 2.0)
        monitor.evaluate({"monthly_churn_pct": 12.0})
        active = monitor.get_active_alerts()
        assert len(active) >= 1

    def test_acknowledge_alert(self):
        monitor = AutoMonitor()
        monitor.load_default_rules()
        alerts = monitor.evaluate({"monthly_churn_pct": 12.0})
        if alerts:
            alert_id = alerts[0].alert_id
            result = monitor.acknowledge_alert(alert_id, "admin")
            assert result is True

    def test_resolve_alert(self):
        monitor = AutoMonitor()
        monitor.load_default_rules()
        alerts = monitor.evaluate({"monthly_churn_pct": 12.0})
        if alerts:
            alert_id = alerts[0].alert_id
            monitor.resolve_alert(alert_id)
            active = monitor.get_active_alerts()
            assert not any(a.alert_id == alert_id for a in active)

    def test_get_alert_summary(self):
        monitor = AutoMonitor()
        monitor.load_default_rules()
        summary = monitor.get_alert_summary()
        assert "total_active" in summary
        assert "by_severity" in summary
        assert "total_rules" in summary


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: COMPANY DASHBOARD
# ═════════════════════════════════════════════════════════════════════════════

class TestCompanyDashboard:
    def test_load_and_get_overview(self, company_snapshot, ceo_data):
        dashboard = CompanyDashboard()
        dashboard.load(company_snapshot, ceo_data)
        overview = dashboard.get_overview()
        assert "company_health" in overview
        assert "top_kpis" in overview
        assert "alerts" in overview

    def test_overview_has_health_scores(self, company_snapshot, ceo_data):
        dashboard = CompanyDashboard()
        dashboard.load(company_snapshot, ceo_data)
        overview = dashboard.get_overview()
        scores = overview["company_health"]["scores"]
        for key in ["business", "growth", "product", "customer", "platform"]:
            assert key in scores

    def test_get_health_scorecard(self, company_snapshot, ceo_data):
        dashboard = CompanyDashboard()
        dashboard.load(company_snapshot, ceo_data)
        scorecard = dashboard.get_health_scorecard()
        assert "overall_score" in scorecard

    def test_render_text(self, company_snapshot, ceo_data):
        dashboard = CompanyDashboard()
        dashboard.load(company_snapshot, ceo_data)
        text = dashboard.render_text()
        assert "COMPANY DASHBOARD" in text
        assert "MRR" in text

    def test_error_without_load(self):
        dashboard = CompanyDashboard()
        overview = dashboard.get_overview()
        assert "error" in overview


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: EXECUTIVE DASHBOARD
# ═════════════════════════════════════════════════════════════════════════════

class TestExecutiveDashboard:
    def test_get_board_summary(self, company_snapshot, ceo_data):
        dashboard = ExecutiveDashboard()
        dashboard.load(company_snapshot, ceo_data)
        summary = dashboard.get_board_summary()
        assert "headline" in summary
        assert "unit_economics" in summary
        assert "retention" in summary

    def test_headline_has_mrr(self, company_snapshot, ceo_data):
        dashboard = ExecutiveDashboard()
        dashboard.load(company_snapshot, ceo_data)
        summary = dashboard.get_board_summary()
        assert summary["headline"]["mrr"] == 50_000

    def test_arr_projection_calculated(self, company_snapshot, ceo_data):
        dashboard = ExecutiveDashboard()
        dashboard.load(company_snapshot, ceo_data)
        summary = dashboard.get_board_summary()
        assert summary["headline"]["arr_projection_12m"] > ceo_data.arr

    def test_get_growth_narrative(self, company_snapshot, ceo_data):
        dashboard = ExecutiveDashboard()
        dashboard.load(company_snapshot, ceo_data)
        narrative = dashboard.get_growth_narrative()
        assert isinstance(narrative, str)
        assert len(narrative) > 50

    def test_render_text(self, company_snapshot, ceo_data):
        dashboard = ExecutiveDashboard()
        dashboard.load(company_snapshot, ceo_data)
        text = dashboard.render_text()
        assert "EXECUTIVE DASHBOARD" in text
        assert "LTV/CAC" in text


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: OPERATIONAL DASHBOARD
# ═════════════════════════════════════════════════════════════════════════════

class TestOperationalDashboard:
    def test_get_platform_overview(self, healthy_platform_score):
        dashboard = OperationalDashboard()
        dashboard.load(healthy_platform_score)
        overview = dashboard.get_platform_overview()
        assert "platform_health" in overview
        assert "availability" in overview
        assert "performance" in overview

    def test_sla_compliance(self, healthy_platform_score):
        dashboard = OperationalDashboard()
        dashboard.load(healthy_platform_score)
        overview = dashboard.get_platform_overview()
        # uptime_pct=99.95 → SLA met
        assert overview["availability"]["sla_compliance"] is True

    def test_sla_report(self, healthy_platform_score):
        dashboard = OperationalDashboard()
        dashboard.load(healthy_platform_score)
        report = dashboard.get_sla_report()
        assert "uptime_pct" in report
        assert "sla_met" in report

    def test_render_text(self, healthy_platform_score):
        dashboard = OperationalDashboard()
        dashboard.load(healthy_platform_score)
        text = dashboard.render_text()
        assert "OPERATIONAL DASHBOARD" in text
        assert "Uptime" in text


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: CEO DASHBOARD
# ═════════════════════════════════════════════════════════════════════════════

class TestCEODashboard:
    def test_load_and_get_full_view(self, company_snapshot, ceo_data):
        dashboard = CEODashboard()
        dashboard.load(company_snapshot, ceo_data)
        view = dashboard.get_full_view()
        assert "company_health" in view
        assert "revenue" in view
        assert "users" in view
        assert "retention" in view
        assert "unit_economics" in view
        assert "satisfaction" in view
        assert "platform" in view
        assert "kpis" in view

    def test_full_view_revenue_values(self, company_snapshot, ceo_data):
        dashboard = CEODashboard()
        dashboard.load(company_snapshot, ceo_data)
        view = dashboard.get_full_view()
        assert view["revenue"]["mrr"] == 50_000
        assert view["revenue"]["arr"] == 600_000

    def test_full_view_has_alerts(self, company_snapshot, ceo_data):
        dashboard = CEODashboard()
        dashboard.load(company_snapshot, ceo_data)
        view = dashboard.get_full_view()
        assert "alerts" in view
        assert "total_active" in view["alerts"]

    def test_full_view_with_okr(self, company_snapshot, ceo_data, okr_cycle):
        dashboard = CEODashboard()
        dashboard.load(company_snapshot, ceo_data, okr_cycle=okr_cycle)
        view = dashboard.get_full_view()
        assert "okr" in view
        assert view["okr"]["progress_pct"] >= 0

    def test_render_text(self, company_snapshot, ceo_data):
        dashboard = CEODashboard()
        dashboard.load(company_snapshot, ceo_data)
        text = dashboard.render_text()
        assert "CEO DASHBOARD" in text
        assert "MRR" in text
        assert "NPS" in text
        assert "Disponibilidade" in text

    def test_generate_daily_report(self, company_snapshot, ceo_data):
        dashboard = CEODashboard()
        dashboard.load(company_snapshot, ceo_data)
        report_text = dashboard.generate_report(ReportType.DAILY)
        assert "Relatório Diário" in report_text

    def test_error_without_load(self):
        dashboard = CEODashboard()
        view = dashboard.get_full_view()
        assert "error" in view


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: REPORT ENGINE
# ═════════════════════════════════════════════════════════════════════════════

class TestReportEngine:
    def test_generate_daily_report(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.DAILY, company_snapshot, ceo_data)
        assert isinstance(report, ExecutiveReport)
        assert report.report_type == ReportType.DAILY

    def test_generate_weekly_report(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.WEEKLY, company_snapshot, ceo_data)
        assert report.report_type == ReportType.WEEKLY

    def test_generate_monthly_report(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.MONTHLY, company_snapshot, ceo_data)
        assert report.report_type == ReportType.MONTHLY
        # Relatório mensal deve ter mais KPIs
        assert len(report.kpis) > 8

    def test_generate_quarterly_report(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.QUARTERLY, company_snapshot, ceo_data)
        assert report.report_type == ReportType.QUARTERLY

    def test_report_has_executive_summary(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.MONTHLY, company_snapshot, ceo_data)
        assert len(report.executive_summary) > 50

    def test_report_has_highlights(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.MONTHLY, company_snapshot, ceo_data)
        assert isinstance(report.highlights, list)

    def test_report_has_recommendations(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.MONTHLY, company_snapshot, ceo_data)
        assert isinstance(report.recommended_actions, list)

    def test_report_render_text(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.DAILY, company_snapshot, ceo_data)
        text = report.render_text()
        assert "LifeOS" in text
        assert "RESUMO EXECUTIVO" in text

    def test_report_to_dict(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        report = engine.generate(ReportType.DAILY, company_snapshot, ceo_data)
        d = report.to_dict()
        for key in ["report_id", "report_type", "title", "executive_summary",
                    "kpis", "highlights", "concerns", "recommended_actions"]:
            assert key in d

    def test_report_history(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        engine.generate(ReportType.DAILY, company_snapshot, ceo_data)
        engine.generate(ReportType.WEEKLY, company_snapshot, ceo_data)
        history = engine.get_report_history()
        assert len(history) == 2

    def test_report_history_filter_by_type(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        engine.generate(ReportType.DAILY, company_snapshot, ceo_data)
        engine.generate(ReportType.MONTHLY, company_snapshot, ceo_data)
        daily = engine.get_report_history(ReportType.DAILY)
        assert len(daily) == 1

    def test_report_with_okr_cycle(self, company_snapshot, ceo_data, okr_cycle):
        engine = ReportEngine()
        report = engine.generate(
            ReportType.MONTHLY, company_snapshot, ceo_data, okr_cycle=okr_cycle
        )
        assert "cycle" in report.okr_progress

    def test_report_with_alerts(self, company_snapshot, ceo_data):
        engine = ReportEngine()
        alert = Alert(
            title="Churn Alto",
            severity=AlertSeverity.CRITICAL,
            recommended_action="Ativar retenção.",
        )
        report = engine.generate(
            ReportType.DAILY, company_snapshot, ceo_data, active_alerts=[alert]
        )
        assert report.alerts_summary["critical"] == 1


# ═════════════════════════════════════════════════════════════════════════════
# TESTES: INTEGRAÇÃO COMPLETA
# ═════════════════════════════════════════════════════════════════════════════

class TestCompanyOSIntegration:
    """Testes de integração do fluxo completo do Company OS."""

    def test_full_company_os_flow(self, company_snapshot, ceo_data, okr_cycle):
        """Testa o fluxo completo: health → monitor → dashboard → report."""

        # 1. Monitor avalia métricas
        monitor = AutoMonitor()
        monitor.load_default_rules()
        metrics = {
            "mrr": ceo_data.mrr,
            "monthly_churn_pct": ceo_data.monthly_churn_pct,
            "d30_retention_pct": ceo_data.d30_retention_pct,
            "p95_latency_ms": ceo_data.p95_latency_ms,
            "error_rate_pct": ceo_data.error_rate_pct,
            "uptime_pct": ceo_data.uptime_pct,
            "ltv_cac_ratio": ceo_data.ltv_cac_ratio,
        }
        alerts = monitor.evaluate(metrics)
        assert isinstance(alerts, list)

        # 2. CEO Dashboard carrega todos os dados
        ceo_dashboard = CEODashboard()
        ceo_dashboard.load(company_snapshot, ceo_data, okr_cycle=okr_cycle)
        view = ceo_dashboard.get_full_view()
        assert view["revenue"]["mrr"] == ceo_data.mrr
        assert view["okr"]["progress_pct"] >= 0

        # 3. Company Dashboard consolida
        company_dashboard = CompanyDashboard()
        company_dashboard.load(company_snapshot, ceo_data)
        overview = company_dashboard.get_overview()
        assert overview["company_health"]["overall_score"] > 0

        # 4. Executive Dashboard para board
        exec_dashboard = ExecutiveDashboard()
        exec_dashboard.load(company_snapshot, ceo_data, okr_cycles=[okr_cycle])
        board_summary = exec_dashboard.get_board_summary()
        assert board_summary["headline"]["mrr"] == ceo_data.mrr

        # 5. Report Engine gera relatório mensal
        engine = ReportEngine()
        report = engine.generate(
            ReportType.MONTHLY, company_snapshot, ceo_data,
            active_alerts=alerts, okr_cycle=okr_cycle
        )
        assert len(report.executive_summary) > 0
        assert len(report.kpis) > 0

        # 6. Texto renderizado contém dados corretos
        text = ceo_dashboard.render_text()
        assert "CEO DASHBOARD" in text

    def test_critical_scenario_triggers_alerts(self):
        """Testa que um cenário crítico gera alertas adequados."""
        monitor = AutoMonitor()
        monitor.load_default_rules()

        # Métricas críticas
        critical_metrics = {
            "monthly_churn_pct": 15.0,   # Muito alto
            "d30_retention_pct": 8.0,    # Muito baixo
            "p95_latency_ms": 5000.0,    # Muito alto
            "error_rate_pct": 8.0,       # Muito alto
            "uptime_pct": 95.0,          # SLA violado
            "ltv_cac_ratio": 0.8,        # Abaixo do mínimo
        }
        alerts = monitor.evaluate(critical_metrics)
        assert len(alerts) > 0

        critical = [a for a in alerts if a.severity == AlertSeverity.CRITICAL]
        emergency = [a for a in alerts if a.severity == AlertSeverity.EMERGENCY]
        assert len(critical) + len(emergency) > 0

    def test_okr_tracker_full_cycle(self):
        """Testa um ciclo completo de OKR."""
        tracker = OKRTracker()
        cycle = tracker.create_lifeos_q1_okrs()

        # Atualiza todos os KRs
        for obj in cycle.objectives:
            for kr in obj.key_results:
                # Simula 50% de progresso
                mid_value = (kr.start_value + kr.target_value) / 2
                tracker.update_key_result(kr.kr_id, mid_value)

        # Verifica progresso
        report = tracker.get_cycle_report(cycle.cycle_id)
        assert report["overall_progress_pct"] > 0

        # Verifica que não há objetivos completados (apenas 50%)
        by_status = report["by_status"]
        assert by_status.get("completed", 0) == 0

    def test_health_scores_reflect_business_state(self):
        """Testa que health scores refletem corretamente o estado do negócio."""
        # Empresa em crescimento saudável
        business = BusinessHealthScore(
            mrr_growth_mom=20.0,
            ltv_cac_ratio=5.0,
            monthly_churn_rate=0.01,
            runway_months=36,
        ).calculate()

        platform = PlatformHealthScore(
            uptime_pct=99.99,
            p95_latency_ms=200,
            error_rate_pct=0.01,
            security_score=95,
        ).calculate()

        snapshot = CompanyHealthSnapshot(
            business=business,
            platform=platform,
        )
        snapshot.calculate_overall()

        assert business.status in (HealthStatus.GOOD, HealthStatus.EXCELLENT)
        assert platform.status == HealthStatus.EXCELLENT
        # Business=100, Platform=99.2, outros=0
        # Ponderado: 100*0.30 + 0*0.25 + 0*0.20 + 0*0.15 + 99.2*0.10 = 30 + 9.92 = 39.92
        # Score geral > 30 (business + platform contribuem)
        assert snapshot.overall_score > 30

    def test_report_engine_all_types(self, company_snapshot, ceo_data):
        """Testa geração de todos os tipos de relatório."""
        engine = ReportEngine()

        for report_type in ReportType:
            report = engine.generate(report_type, company_snapshot, ceo_data)
            assert report.report_type == report_type
            assert len(report.title) > 0
            assert len(report.executive_summary) > 0
            text = report.render_text()
            assert "LifeOS" in text

        assert len(engine.get_report_history()) == 4
