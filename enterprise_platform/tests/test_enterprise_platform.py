"""
LifeOS Enterprise Platform — Test Suite
EXECUTION-010: Enterprise Platform

Suite de testes completa cobrindo todos os componentes:
- Organization Manager
- Workspace Manager
- Multi-Tenant Engine
- Team Manager
- RBAC Engine
- ABAC Engine
- SSO Manager
- Audit Center
- Compliance Center
- Billing Center
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from enterprise_platform.organization.organization_manager import (
    OrganizationManager, OrganizationPlan, OrganizationStatus, ComplianceFramework
)
from enterprise_platform.workspace.workspace_manager import (
    WorkspaceManager, WorkspaceType, WorkspaceStatus, WorkspaceVisibility
)
from enterprise_platform.multi_tenant.tenant_engine import (
    MultiTenantEngine, TenantIsolationError, TenantNotFoundError
)
from enterprise_platform.team.team_manager import TeamManager, MemberRole, MemberStatus
from enterprise_platform.rbac.rbac_engine import RBACEngine, Resource, Action
from enterprise_platform.abac.abac_engine import (
    ABACEngine, ABACPolicy, PolicyEffect, PolicyCondition, ConditionOperator
)
from enterprise_platform.sso.sso_manager import (
    SSOManager, SSOProvider, SSOStatus
)
from enterprise_platform.audit.audit_center import (
    AuditCenter, AuditEventCategory, AuditEventOutcome, AuditEventSeverity
)
from enterprise_platform.compliance.compliance_center import (
    ComplianceCenter, ComplianceFramework as CF, ControlStatus,
    DataSubjectRequestType, DataSubjectRequestStatus
)
from enterprise_platform.billing.billing_center import (
    BillingCenter, BillingPlan, BillingCycle
)


# ══════════════════════════════════════════════════════════════════
# Organization Manager Tests
# ══════════════════════════════════════════════════════════════════

class TestOrganizationManager:
    def setup_method(self):
        self.mgr = OrganizationManager()

    def test_create_organization(self):
        org = self.mgr.create_organization("ACME Corp", "user_01", OrganizationPlan.ENTERPRISE)
        assert org.name == "ACME Corp"
        assert org.plan == OrganizationPlan.ENTERPRISE
        assert org.status == OrganizationStatus.TRIAL
        assert org.org_id.startswith("org_")

    def test_slug_uniqueness(self):
        self.mgr.create_organization("ACME Corp", "user_01", slug="acme")
        with pytest.raises(ValueError, match="already in use"):
            self.mgr.create_organization("ACME Corp 2", "user_02", slug="acme")

    def test_get_by_slug(self):
        org = self.mgr.create_organization("TechNova", "user_02", slug="technova")
        found = self.mgr.get_by_slug("technova")
        assert found is not None
        assert found.org_id == org.org_id

    def test_plan_limits(self):
        org = self.mgr.create_organization("Starter Co", "user_03", OrganizationPlan.STARTER)
        assert org.max_members == 10
        assert org.max_workspaces == 3

    def test_enterprise_plan_limits(self):
        org = self.mgr.create_organization("Big Corp", "user_04", OrganizationPlan.ENTERPRISE)
        assert org.max_members == 1000
        assert org.max_workspaces == 100

    def test_update_plan(self):
        org = self.mgr.create_organization("Growing Co", "user_05", OrganizationPlan.STARTER)
        updated = self.mgr.update_plan(org.org_id, OrganizationPlan.PROFESSIONAL)
        assert updated.plan == OrganizationPlan.PROFESSIONAL
        assert updated.max_members == 100

    def test_suspend_and_activate(self):
        org = self.mgr.create_organization("Test Co", "user_06")
        self.mgr.suspend_organization(org.org_id, "Policy violation")
        assert org.status == OrganizationStatus.SUSPENDED
        self.mgr.activate_organization(org.org_id)
        assert org.status == OrganizationStatus.ACTIVE

    def test_add_compliance_framework(self):
        org = self.mgr.create_organization("Compliant Co", "user_07", OrganizationPlan.ENTERPRISE)
        result = self.mgr.add_compliance_framework(org.org_id, ComplianceFramework.ISO_27001)
        assert result is True
        assert "iso_27001" in org.settings.compliance_frameworks

    def test_list_organizations_by_plan(self):
        self.mgr.create_organization("E1", "u1", OrganizationPlan.ENTERPRISE)
        self.mgr.create_organization("E2", "u2", OrganizationPlan.ENTERPRISE)
        self.mgr.create_organization("S1", "u3", OrganizationPlan.STARTER)
        enterprise_orgs = self.mgr.list_organizations(plan=OrganizationPlan.ENTERPRISE)
        assert len(enterprise_orgs) == 2

    def test_org_to_dict(self):
        org = self.mgr.create_organization("Dict Co", "user_08")
        d = org.to_dict()
        assert "org_id" in d
        assert "name" in d
        assert "plan" in d
        assert "settings" in d

    def test_get_stats(self):
        self.mgr.create_organization("Stats Co 1", "u1", OrganizationPlan.ENTERPRISE)
        self.mgr.create_organization("Stats Co 2", "u2", OrganizationPlan.PROFESSIONAL)
        stats = self.mgr.get_stats()
        assert stats["total_organizations"] >= 2


# ══════════════════════════════════════════════════════════════════
# Workspace Manager Tests
# ══════════════════════════════════════════════════════════════════

class TestWorkspaceManager:
    def setup_method(self):
        self.mgr = WorkspaceManager()

    def test_create_workspace(self):
        ws = self.mgr.create_workspace("org_01", "Engineering", WorkspaceType.DEPARTMENT)
        assert ws.name == "Engineering"
        assert ws.org_id == "org_01"
        assert ws.workspace_id.startswith("ws_")

    def test_list_by_org(self):
        self.mgr.create_workspace("org_01", "Engineering", WorkspaceType.DEPARTMENT)
        self.mgr.create_workspace("org_01", "Marketing", WorkspaceType.DEPARTMENT)
        self.mgr.create_workspace("org_02", "Sales", WorkspaceType.DEPARTMENT)
        ws = self.mgr.list_workspaces("org_01")
        assert len(ws) == 2

    def test_workspace_hierarchy(self):
        parent = self.mgr.create_workspace("org_01", "Engineering", WorkspaceType.DEPARTMENT)
        child = self.mgr.create_workspace(
            "org_01", "Backend Team", WorkspaceType.TEAM,
            parent_workspace_id=parent.workspace_id
        )
        hierarchy = self.mgr.get_workspace_hierarchy("org_01")
        assert hierarchy["total_workspaces"] == 2
        root = hierarchy["hierarchy"][0]
        assert len(root["children"]) == 1

    def test_archive_workspace(self):
        ws = self.mgr.create_workspace("org_01", "Old Project", WorkspaceType.PROJECT)
        result = self.mgr.archive_workspace(ws.workspace_id)
        assert result is True
        assert ws.status == WorkspaceStatus.ARCHIVED

    def test_workspace_types(self):
        for wtype in WorkspaceType:
            ws = self.mgr.create_workspace("org_01", f"WS {wtype.value}", wtype)
            assert ws.type == wtype


# ══════════════════════════════════════════════════════════════════
# Multi-Tenant Engine Tests
# ══════════════════════════════════════════════════════════════════

class TestMultiTenantEngine:
    def setup_method(self):
        self.engine = MultiTenantEngine()
        self.engine.register_tenant("org_acme", "lk_live_acme_key", data_region="us-east-1")
        self.engine.register_tenant("org_technova", "lk_live_tn_key", data_region="eu-west-1")

    def test_register_tenant(self):
        stats = self.engine.get_stats()
        assert stats["registered_tenants"] == 2
        assert stats["active_tenants"] == 2

    def test_resolve_from_api_key(self):
        org_id = self.engine.resolve_tenant_from_api_key("lk_live_acme_key")
        assert org_id == "org_acme"

    def test_resolve_unknown_key(self):
        org_id = self.engine.resolve_tenant_from_api_key("invalid_key")
        assert org_id is None

    def test_tenant_context_manager(self):
        with self.engine.tenant_context("org_acme", user_id="user_01") as ctx:
            assert ctx.org_id == "org_acme"
            assert ctx.user_id == "user_01"
            current = self.engine.get_current_context()
            assert current is not None
            assert current.org_id == "org_acme"

    def test_context_cleanup_after_exit(self):
        with self.engine.tenant_context("org_acme"):
            pass
        ctx = self.engine.get_current_context()
        assert ctx is None

    def test_cross_tenant_isolation(self):
        with self.engine.tenant_context("org_acme") as ctx:
            with pytest.raises(TenantIsolationError):
                self.engine.assert_tenant_access("org_technova")

    def test_tenant_not_found(self):
        with pytest.raises(TenantNotFoundError):
            with self.engine.tenant_context("org_unknown"):
                pass

    def test_suspend_tenant(self):
        self.engine.suspend_tenant("org_acme")
        with pytest.raises(TenantIsolationError):
            with self.engine.tenant_context("org_acme"):
                pass

    def test_isolate_query(self):
        with self.engine.tenant_context("org_acme", workspace_id="ws_01"):
            params = self.engine.isolate_query({"status": "active"})
            assert params["org_id"] == "org_acme"
            assert params["workspace_id"] == "ws_01"

    def test_access_log(self):
        with self.engine.tenant_context("org_technova", user_id="user_02"):
            pass
        log = self.engine.get_access_log("org_technova")
        assert len(log) >= 1


# ══════════════════════════════════════════════════════════════════
# Team Manager Tests
# ══════════════════════════════════════════════════════════════════

class TestTeamManager:
    def setup_method(self):
        self.mgr = TeamManager()

    def test_create_team(self):
        team = self.mgr.create_team("org_01", "ws_01", "Platform Team", owner_id="user_01")
        assert team.name == "Platform Team"
        assert team.team_id.startswith("team_")
        assert team.member_count == 1  # Owner added automatically

    def test_add_member(self):
        team = self.mgr.create_team("org_01", "ws_01", "Dev Team", owner_id="user_01")
        member = self.mgr.add_member(team.team_id, "user_02", "dev@acme.com", MemberRole.MEMBER)
        assert member.role == MemberRole.MEMBER
        assert team.member_count == 2

    def test_duplicate_member_raises(self):
        team = self.mgr.create_team("org_01", "ws_01", "QA Team", owner_id="user_01")
        self.mgr.add_member(team.team_id, "user_02", "qa@acme.com")
        with pytest.raises(ValueError, match="already a member"):
            self.mgr.add_member(team.team_id, "user_02", "qa@acme.com")

    def test_remove_member(self):
        team = self.mgr.create_team("org_01", "ws_01", "Ops Team", owner_id="user_01")
        self.mgr.add_member(team.team_id, "user_02", "ops@acme.com")
        result = self.mgr.remove_member(team.team_id, "user_02")
        assert result is True
        assert team.member_count == 1

    def test_update_member_role(self):
        team = self.mgr.create_team("org_01", "ws_01", "Security Team", owner_id="user_01")
        self.mgr.add_member(team.team_id, "user_02", "sec@acme.com", MemberRole.MEMBER)
        result = self.mgr.update_member_role(team.team_id, "user_02", MemberRole.MANAGER)
        assert result is True
        member = team.get_member("user_02")
        assert member.role == MemberRole.MANAGER

    def test_get_user_teams(self):
        team1 = self.mgr.create_team("org_01", "ws_01", "Team A", owner_id="user_01")
        team2 = self.mgr.create_team("org_01", "ws_01", "Team B", owner_id="user_01")
        self.mgr.add_member(team1.team_id, "user_99", "u99@acme.com")
        self.mgr.add_member(team2.team_id, "user_99", "u99@acme.com")
        teams = self.mgr.get_user_teams("user_99", org_id="org_01")
        assert len(teams) == 2


# ══════════════════════════════════════════════════════════════════
# RBAC Engine Tests
# ══════════════════════════════════════════════════════════════════

class TestRBACEngine:
    def setup_method(self):
        self.rbac = RBACEngine()

    def test_system_roles_loaded(self):
        roles = self.rbac.list_roles(include_system=True)
        role_names = [r.name for r in roles]
        assert "Super Admin" in role_names
        assert "Member" in role_names
        assert "Viewer" in role_names

    def test_assign_role(self):
        assignment = self.rbac.assign_role("user_01", "role_member", "org_01")
        assert assignment.user_id == "user_01"
        assert assignment.role_id == "role_member"

    def test_check_permission_member(self):
        self.rbac.assign_role("user_01", "role_member", "org_01")
        assert self.rbac.check_permission("user_01", Resource.MEMORY, Action.READ, "org_01")
        assert self.rbac.check_permission("user_01", Resource.MEMORY, Action.CREATE, "org_01")
        assert not self.rbac.check_permission("user_01", Resource.BILLING, Action.READ, "org_01")

    def test_check_permission_super_admin(self):
        self.rbac.assign_role("admin_01", "role_super_admin", "org_01")
        assert self.rbac.check_permission("admin_01", Resource.BILLING, Action.MANAGE, "org_01")
        assert self.rbac.check_permission("admin_01", Resource.SSO, Action.CONFIGURE, "org_01")
        assert self.rbac.check_permission("admin_01", Resource.COMPLIANCE, Action.AUDIT, "org_01")

    def test_viewer_cannot_write(self):
        self.rbac.assign_role("viewer_01", "role_viewer", "org_01")
        assert self.rbac.check_permission("viewer_01", Resource.MEMORY, Action.READ, "org_01")
        assert not self.rbac.check_permission("viewer_01", Resource.MEMORY, Action.CREATE, "org_01")
        assert not self.rbac.check_permission("viewer_01", Resource.MEMORY, Action.DELETE, "org_01")

    def test_revoke_role(self):
        self.rbac.assign_role("user_02", "role_member", "org_01")
        assert self.rbac.check_permission("user_02", Resource.MEMORY, Action.READ, "org_01")
        self.rbac.revoke_role("user_02", "role_member", "org_01")
        assert not self.rbac.check_permission("user_02", Resource.MEMORY, Action.READ, "org_01")

    def test_create_custom_role(self):
        custom = self.rbac.create_custom_role(
            org_id="org_01",
            name="Data Analyst",
            permissions=["memory:read", "insight:read", "report:export"],
            description="Read-only access with export capability",
        )
        assert custom.is_custom is True
        assert "memory:read" in custom.permissions
        assert "report:export" in custom.permissions

    def test_custom_role_inherits_from_parent(self):
        custom = self.rbac.create_custom_role(
            org_id="org_01",
            name="Senior Member",
            permissions=["report:export"],
            parent_role_id="role_member",
        )
        # Should inherit all member permissions + export
        assert "memory:read" in custom.permissions
        assert "report:export" in custom.permissions

    def test_require_permission_raises(self):
        self.rbac.assign_role("guest_01", "role_guest", "org_01")
        with pytest.raises(PermissionError):
            self.rbac.require_permission("guest_01", Resource.BILLING, Action.READ, "org_01")

    def test_permission_matrix(self):
        matrix = self.rbac.get_permission_matrix("org_01")
        assert "Super Admin" in matrix
        assert "Member" in matrix
        assert "memory" in matrix["Member"]


# ══════════════════════════════════════════════════════════════════
# ABAC Engine Tests
# ══════════════════════════════════════════════════════════════════

class TestABACEngine:
    def setup_method(self):
        self.abac = ABACEngine()

    def test_default_policies_loaded(self):
        policies = self.abac.list_policies()
        assert len(policies) >= 2

    def test_allow_by_default(self):
        result = self.abac.evaluate(
            user_id="user_01",
            resource="memory",
            action="read",
            context={"user": {"role": "member"}, "environment": {"business_hours": True, "ip_authorized": True}},
        )
        assert result["decision"] == "allow"

    def test_deny_outside_business_hours(self):
        result = self.abac.evaluate(
            user_id="user_01",
            resource="billing",
            action="read",
            context={
                "user": {"role": "member"},
                "environment": {"business_hours": False, "ip_authorized": True},
                "organization": {"ip_restriction_enabled": False},
            },
        )
        assert result["decision"] == "deny"

    def test_admin_allowed_outside_hours(self):
        result = self.abac.evaluate(
            user_id="admin_01",
            resource="billing",
            action="read",
            context={
                "user": {"role": "super_admin"},
                "environment": {"business_hours": False, "ip_authorized": True},
                "organization": {"ip_restriction_enabled": False},
            },
        )
        assert result["decision"] == "allow"

    def test_ip_block_policy(self):
        result = self.abac.evaluate(
            user_id="user_01",
            resource="memory",
            action="read",
            context={
                "user": {"role": "member"},
                "environment": {"business_hours": True, "ip_authorized": False},
                "organization": {"ip_restriction_enabled": True},
            },
        )
        assert result["decision"] == "deny"

    def test_create_custom_policy(self):
        policy = self.abac.create_policy(
            name="Block export for contractors",
            effect=PolicyEffect.DENY,
            resources=["report"],
            actions=["export"],
            conditions=[
                PolicyCondition("user.employment_type", ConditionOperator.EQUALS, "contractor")
            ],
            org_id="org_01",
        )
        assert policy.effect == PolicyEffect.DENY
        result = self.abac.evaluate(
            "contractor_01", "report", "export",
            context={"user": {"employment_type": "contractor"}},
            org_id="org_01",
        )
        assert result["decision"] == "deny"

    def test_condition_operators(self):
        cond_eq = PolicyCondition("user.role", ConditionOperator.EQUALS, "admin")
        assert cond_eq.evaluate({"user": {"role": "admin"}}) is True
        assert cond_eq.evaluate({"user": {"role": "member"}}) is False

        cond_in = PolicyCondition("user.role", ConditionOperator.IN, ["admin", "manager"])
        assert cond_in.evaluate({"user": {"role": "manager"}}) is True
        assert cond_in.evaluate({"user": {"role": "guest"}}) is False


# ══════════════════════════════════════════════════════════════════
# SSO Manager Tests
# ══════════════════════════════════════════════════════════════════

class TestSSOManager:
    def setup_method(self):
        self.sso = SSOManager()

    def test_configure_saml(self):
        config = self.sso.configure_saml(
            org_id="org_01",
            entity_id="https://idp.acme.com",
            sso_url="https://idp.acme.com/sso",
            certificate="MIIC...",
            provider=SSOProvider.OKTA,
        )
        assert config.provider == SSOProvider.OKTA
        assert config.saml_config is not None
        assert config.status == SSOStatus.INACTIVE

    def test_configure_oidc(self):
        config = self.sso.configure_oidc(
            org_id="org_02",
            client_id="google_client_id",
            client_secret="google_secret",
            discovery_url="https://accounts.google.com",
            provider=SSOProvider.GOOGLE_WORKSPACE,
        )
        assert config.oidc_config is not None
        assert config.oidc_config.client_id == "google_client_id"

    def test_activate_config(self):
        config = self.sso.configure_saml("org_03", "https://idp.test.com", "https://idp.test.com/sso", "CERT")
        result = self.sso.activate_config(config.config_id)
        assert result is True
        assert config.status == SSOStatus.ACTIVE

    def test_enable_scim(self):
        self.sso.configure_saml("org_04", "https://idp.test.com", "https://idp.test.com/sso", "CERT")
        scim = self.sso.enable_scim("org_04")
        assert scim is not None
        assert "scim/v2/org_04" in scim.scim_endpoint
        assert scim.bearer_token.startswith("scim_")

    def test_initiate_saml_login(self):
        config = self.sso.configure_saml("org_05", "https://idp.acme.com", "https://idp.acme.com/sso", "CERT")
        self.sso.activate_config(config.config_id)
        result = self.sso.initiate_saml_login("org_05", relay_state="dashboard")
        assert "redirect_url" in result
        assert "SAMLRequest" in result["redirect_url"]
        assert result["request_id"].startswith("_lifeos_")

    def test_initiate_oidc_login(self):
        config = self.sso.configure_oidc("org_06", "client_id", "secret", "https://auth.example.com")
        self.sso.activate_config(config.config_id)
        result = self.sso.initiate_oidc_login("org_06")
        assert "redirect_url" in result
        assert "code_challenge" in result["redirect_url"]
        assert "state" in result

    def test_configure_ldap(self):
        config = self.sso.configure_ldap(
            org_id="org_07",
            host="ldap.acme.com",
            base_dn="dc=acme,dc=com",
            bind_dn="cn=admin,dc=acme,dc=com",
            bind_password="secret",
        )
        assert config.ldap_config is not None
        assert config.ldap_config.host == "ldap.acme.com"
        assert config.ldap_config.use_ssl is True

    def test_sp_metadata(self):
        metadata = self.sso.get_sp_metadata()
        assert "entity_id" in metadata
        assert "acs_url" in metadata
        assert "lifeos" in metadata["entity_id"]

    def test_create_and_validate_session(self):
        session = self.sso.create_session(
            org_id="org_01",
            user_id="user_01",
            email="user@acme.com",
            provider="saml",
            attributes={"groups": ["engineering"]},
        )
        validated = self.sso.validate_session(session.session_id)
        assert validated is not None
        assert validated.email == "user@acme.com"

    def test_revoke_session(self):
        session = self.sso.create_session("org_01", "user_02", "u2@acme.com", "oidc")
        self.sso.revoke_session(session.session_id)
        validated = self.sso.validate_session(session.session_id)
        assert validated is None


# ══════════════════════════════════════════════════════════════════
# Audit Center Tests
# ══════════════════════════════════════════════════════════════════

class TestAuditCenter:
    def setup_method(self):
        self.audit = AuditCenter()

    def test_log_event(self):
        event = self.audit.log(
            org_id="org_01",
            category=AuditEventCategory.AUTHENTICATION,
            action="user.login",
            actor_id="user_01",
            actor_email="user@acme.com",
            actor_ip="192.168.1.1",
        )
        assert event.event_id.startswith("evt_")
        assert event.severity == AuditEventSeverity.INFO

    def test_auto_severity_high(self):
        event = self.audit.log(
            org_id="org_01",
            category=AuditEventCategory.SECURITY,
            action="role.assign",
            actor_id="admin_01",
        )
        assert event.severity == AuditEventSeverity.HIGH

    def test_auto_severity_critical(self):
        event = self.audit.log(
            org_id="org_01",
            category=AuditEventCategory.ADMIN,
            action="data.bulk_delete",
            actor_id="admin_01",
        )
        assert event.severity == AuditEventSeverity.CRITICAL

    def test_security_alert_generated(self):
        self.audit.log(
            org_id="org_01",
            category=AuditEventCategory.SECURITY,
            action="user.login_failed",
            actor_id="unknown",
            actor_ip="203.0.113.1",
        )
        alerts = self.audit.get_security_alerts("org_01")
        assert len(alerts) >= 1

    def test_query_events(self):
        for i in range(5):
            self.audit.log("org_01", AuditEventCategory.DATA_ACCESS, "memory.read", f"user_{i}")
        result = self.audit.query("org_01", limit=3)
        assert result["total"] == 5
        assert len(result["events"]) == 3

    def test_query_by_actor(self):
        self.audit.log("org_01", AuditEventCategory.DATA_MODIFICATION, "memory.create", "user_special")
        self.audit.log("org_01", AuditEventCategory.DATA_MODIFICATION, "memory.create", "user_other")
        result = self.audit.query("org_01", actor_id="user_special")
        assert result["total"] == 1

    def test_record_change(self):
        record = self.audit.record_change(
            org_id="org_01",
            resource_type="organization",
            resource_id="org_01",
            changed_by="admin_01",
            changes={"plan": {"before": "starter", "after": "enterprise"}},
            reason="Upgrade request",
        )
        assert record.change_id.startswith("chg_")
        history = self.audit.get_change_history("org_01", resource_type="organization")
        assert len(history) == 1

    def test_log_integrity(self):
        self.audit.log("org_01", AuditEventCategory.SYSTEM, "system.startup", "system")
        result = self.audit.verify_log_integrity("org_01")
        assert result["integrity_ok"] is True
        assert result["tampered"] == 0

    def test_export_to_siem_json(self):
        self.audit.log("org_01", AuditEventCategory.API, "api.request", "user_01")
        export = self.audit.export_to_siem("org_01", format="json")
        assert export.startswith("[")

    def test_get_stats(self):
        self.audit.log("org_01", AuditEventCategory.AUTHENTICATION, "user.login", "u1")
        stats = self.audit.get_stats("org_01")
        assert stats["total_events"] >= 1


# ══════════════════════════════════════════════════════════════════
# Compliance Center Tests
# ══════════════════════════════════════════════════════════════════

class TestComplianceCenter:
    def setup_method(self):
        self.cc = ComplianceCenter()

    def test_enable_iso27001(self):
        controls = self.cc.enable_framework("org_01", CF.ISO_27001)
        assert len(controls) == 12
        assert all(c.framework == CF.ISO_27001 for c in controls)

    def test_enable_lgpd(self):
        controls = self.cc.enable_framework("org_01", CF.LGPD)
        assert len(controls) == 8

    def test_enable_gdpr(self):
        controls = self.cc.enable_framework("org_01", CF.GDPR)
        assert len(controls) == 11

    def test_enable_soc2(self):
        controls = self.cc.enable_framework("org_01", CF.SOC2)
        assert len(controls) == 10

    def test_update_control_status(self):
        self.cc.enable_framework("org_01", CF.ISO_27001)
        result = self.cc.update_control_status(
            "org_01", "ISO-A.9.1.1", ControlStatus.COMPLIANT,
            evidence=["policy_doc.pdf"], owner="security_team"
        )
        assert result is True
        controls = self.cc.get_controls("org_01", status=ControlStatus.COMPLIANT)
        assert len(controls) == 1

    def test_compliance_score_calculation(self):
        self.cc.enable_framework("org_01", CF.ISO_27001)
        # Mark 6 of 12 as compliant
        controls = self.cc.get_controls("org_01", CF.ISO_27001)
        for c in controls[:6]:
            self.cc.update_control_status("org_01", c.control_id, ControlStatus.COMPLIANT)
        score = self.cc.get_compliance_score("org_01")
        assert score["frameworks"]["iso_27001"]["score"] == 50.0

    def test_dsr_submission(self):
        request = self.cc.submit_dsr(
            org_id="org_01",
            request_type=DataSubjectRequestType.ERASURE,
            subject_email="user@example.com",
            subject_name="John Doe",
        )
        assert request.request_id.startswith("dsr_")
        assert request.status == DataSubjectRequestStatus.PENDING
        assert request.due_at is not None

    def test_dsr_processing(self):
        req = self.cc.submit_dsr("org_01", DataSubjectRequestType.ACCESS, "test@example.com")
        result = self.cc.process_dsr(
            req.request_id,
            DataSubjectRequestStatus.COMPLETED,
            response="Data exported and sent.",
        )
        assert result is True
        assert req.status == DataSubjectRequestStatus.COMPLETED
        assert req.completed_at is not None

    def test_breach_reporting(self):
        incident = self.cc.report_breach(
            org_id="org_01",
            title="Database exposure",
            description="Misconfigured S3 bucket exposed user emails",
            severity="high",
            affected_users_count=1500,
            data_types_affected=["email", "name"],
        )
        assert incident.incident_id.startswith("breach_")
        assert incident.notification_deadline_hours == 72

    def test_compliance_dashboard(self):
        self.cc.enable_framework("org_01", CF.ISO_27001)
        self.cc.submit_dsr("org_01", DataSubjectRequestType.ACCESS, "u@example.com")
        dashboard = self.cc.get_dashboard("org_01")
        assert "overall_score" in dashboard
        assert dashboard["pending_dsr_requests"] == 1


# ══════════════════════════════════════════════════════════════════
# Billing Center Tests
# ══════════════════════════════════════════════════════════════════

class TestBillingCenter:
    def setup_method(self):
        self.billing = BillingCenter()

    def test_create_subscription(self):
        sub = self.billing.create_subscription("org_01", BillingPlan.ENTERPRISE)
        assert sub.plan == BillingPlan.ENTERPRISE
        assert sub.is_trial is True

    def test_upgrade_plan(self):
        self.billing.create_subscription("org_01", BillingPlan.STARTER)
        updated = self.billing.upgrade_plan("org_01", BillingPlan.ENTERPRISE)
        assert updated.plan == BillingPlan.ENTERPRISE

    def test_generate_invoice(self):
        self.billing.create_subscription("org_01", BillingPlan.PROFESSIONAL, trial_days=0)
        invoice = self.billing.generate_invoice("org_01")
        assert invoice.amount_cents == 4900  # $49.00
        assert invoice.invoice_id.startswith("inv_")

    def test_usage_summary(self):
        self.billing.create_subscription("org_01", BillingPlan.ENTERPRISE)
        summary = self.billing.get_usage_summary("org_01")
        assert summary["limits"]["max_members"] == 1000
        assert "advanced_rbac" in summary["features"]

    def test_list_invoices(self):
        self.billing.create_subscription("org_01", BillingPlan.PROFESSIONAL, trial_days=0)
        self.billing.generate_invoice("org_01")
        self.billing.generate_invoice("org_01")
        invoices = self.billing.list_invoices("org_01")
        assert len(invoices) == 2


# ══════════════════════════════════════════════════════════════════
# Integration Test: Multi-Company Scenario
# ══════════════════════════════════════════════════════════════════

class TestMultiCompanyScenario:
    """
    Cenário integrado com múltiplas empresas, equipes e permissões funcionando
    simultaneamente — demonstração completa da EXECUTION-010.
    """

    def test_full_enterprise_scenario(self):
        # ── Setup ─────────────────────────────────────────────────
        org_mgr = OrganizationManager()
        ws_mgr = WorkspaceManager()
        team_mgr = TeamManager()
        tenant_engine = MultiTenantEngine()
        rbac = RBACEngine()
        audit = AuditCenter()
        compliance = ComplianceCenter()
        billing = BillingCenter()

        # ── Criar 3 organizações ──────────────────────────────────
        acme = org_mgr.create_organization("ACME Corp", "admin_acme", OrganizationPlan.ENTERPRISE, slug="acme")
        technova = org_mgr.create_organization("TechNova Labs", "admin_tn", OrganizationPlan.PROFESSIONAL, slug="technova")
        globalfin = org_mgr.create_organization("GlobalFinance SA", "admin_gf", OrganizationPlan.ENTERPRISE, slug="globalfinance")

        assert len(org_mgr.list_organizations()) == 3

        # ── Registrar tenants ─────────────────────────────────────
        tenant_engine.register_tenant(acme.org_id, "lk_live_acme", data_region="us-east-1")
        tenant_engine.register_tenant(technova.org_id, "lk_live_tn", data_region="eu-west-1")
        tenant_engine.register_tenant(globalfin.org_id, "lk_live_gf", data_region="us-east-1")

        # ── Criar workspaces por organização ─────────────────────
        acme_eng = ws_mgr.create_workspace(acme.org_id, "Engineering", WorkspaceType.DEPARTMENT)
        acme_mkt = ws_mgr.create_workspace(acme.org_id, "Marketing", WorkspaceType.DEPARTMENT)
        tn_product = ws_mgr.create_workspace(technova.org_id, "Product", WorkspaceType.DEPARTMENT)
        gf_risk = ws_mgr.create_workspace(globalfin.org_id, "Risk Management", WorkspaceType.DEPARTMENT)

        acme_workspaces = ws_mgr.list_workspaces(acme.org_id)
        assert len(acme_workspaces) == 2

        # ── Criar equipes ─────────────────────────────────────────
        acme_platform = team_mgr.create_team(acme.org_id, acme_eng.workspace_id, "Platform Team", owner_id="admin_acme")
        team_mgr.add_member(acme_platform.team_id, "dev_01", "dev1@acme.com", MemberRole.MEMBER)
        team_mgr.add_member(acme_platform.team_id, "dev_02", "dev2@acme.com", MemberRole.MEMBER)
        team_mgr.add_member(acme_platform.team_id, "lead_01", "lead@acme.com", MemberRole.MANAGER)

        tn_team = team_mgr.create_team(technova.org_id, tn_product.workspace_id, "Core Team", owner_id="admin_tn")
        team_mgr.add_member(tn_team.team_id, "tn_dev_01", "dev@technova.io", MemberRole.MEMBER)

        assert acme_platform.member_count == 4  # owner + 3
        assert tn_team.member_count == 2

        # ── Atribuir roles RBAC ───────────────────────────────────
        rbac.assign_role("admin_acme", "role_org_admin", acme.org_id)
        rbac.assign_role("lead_01", "role_manager", acme.org_id, workspace_id=acme_eng.workspace_id)
        rbac.assign_role("dev_01", "role_member", acme.org_id)
        rbac.assign_role("dev_02", "role_viewer", acme.org_id)
        rbac.assign_role("admin_tn", "role_org_admin", technova.org_id)
        rbac.assign_role("tn_dev_01", "role_member", technova.org_id)

        # ── Verificar permissões ──────────────────────────────────
        assert rbac.check_permission("admin_acme", Resource.ORGANIZATION, Action.CONFIGURE, acme.org_id)
        assert rbac.check_permission("lead_01", Resource.TEAM, Action.UPDATE, acme.org_id)
        assert rbac.check_permission("dev_01", Resource.MEMORY, Action.CREATE, acme.org_id)
        assert not rbac.check_permission("dev_02", Resource.MEMORY, Action.CREATE, acme.org_id)  # Viewer
        assert not rbac.check_permission("dev_01", Resource.BILLING, Action.READ, acme.org_id)

        # ── Isolamento multi-tenant ───────────────────────────────
        with tenant_engine.tenant_context(acme.org_id, user_id="dev_01") as ctx:
            assert ctx.org_id == acme.org_id
            # Tentar acessar dados de outro tenant deve falhar
            with pytest.raises(TenantIsolationError):
                tenant_engine.assert_tenant_access(technova.org_id)

        # ── Audit logging ─────────────────────────────────────────
        audit.log(acme.org_id, AuditEventCategory.AUTHENTICATION, "user.login", "dev_01", actor_email="dev1@acme.com")
        audit.log(acme.org_id, AuditEventCategory.DATA_MODIFICATION, "memory.create", "dev_01")
        audit.log(acme.org_id, AuditEventCategory.SECURITY, "role.assign", "admin_acme")
        audit.log(technova.org_id, AuditEventCategory.AUTHENTICATION, "user.login", "tn_dev_01")

        acme_events = audit.query(acme.org_id)
        tn_events = audit.query(technova.org_id)
        assert acme_events["total"] == 3
        assert tn_events["total"] == 1  # Isolamento: TechNova só vê seus próprios logs

        # ── Compliance ────────────────────────────────────────────
        compliance.enable_framework(acme.org_id, CF.ISO_27001)
        compliance.enable_framework(acme.org_id, CF.LGPD)
        compliance.enable_framework(globalfin.org_id, CF.GDPR)
        compliance.enable_framework(globalfin.org_id, CF.SOC2)

        # Marcar alguns controles como compliant
        acme_controls = compliance.get_controls(acme.org_id, CF.ISO_27001)
        for c in acme_controls[:8]:
            compliance.update_control_status(acme.org_id, c.control_id, ControlStatus.COMPLIANT)

        acme_score = compliance.get_compliance_score(acme.org_id)
        assert acme_score["overall_score"] > 0
        assert "iso_27001" in acme_score["frameworks"]

        # ── Billing ───────────────────────────────────────────────
        billing.create_subscription(acme.org_id, BillingPlan.ENTERPRISE)
        billing.create_subscription(technova.org_id, BillingPlan.PROFESSIONAL)
        billing.create_subscription(globalfin.org_id, BillingPlan.ENTERPRISE_PLUS)

        acme_sub = billing.get_subscription(acme.org_id)
        gf_sub = billing.get_subscription(globalfin.org_id)
        assert acme_sub.plan == BillingPlan.ENTERPRISE
        assert gf_sub.plan == BillingPlan.ENTERPRISE_PLUS

        # ── Verificação final ─────────────────────────────────────
        stats = tenant_engine.get_stats()
        assert stats["registered_tenants"] == 3
        assert stats["active_tenants"] == 3
        assert stats["cross_tenant_blocks"] >= 1  # O teste de isolamento registrou 1 bloqueio

        org_stats = org_mgr.get_stats()
        assert org_stats["total_organizations"] == 3
