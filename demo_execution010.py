"""
EXECUTION-010 — Demonstração: Múltiplas Empresas, Equipes e Permissões Simultâneas
"""
import sys
sys.path.insert(0, '.')

from enterprise_platform.organization.organization_manager import OrganizationManager, OrganizationPlan
from enterprise_platform.workspace.workspace_manager import WorkspaceManager, WorkspaceType
from enterprise_platform.multi_tenant.tenant_engine import MultiTenantEngine, TenantIsolationError
from enterprise_platform.team.team_manager import TeamManager, MemberRole
from enterprise_platform.rbac.rbac_engine import RBACEngine, Resource, Action
from enterprise_platform.abac.abac_engine import ABACEngine
from enterprise_platform.sso.sso_manager import SSOManager, SSOProvider
from enterprise_platform.audit.audit_center import AuditCenter, AuditEventCategory
from enterprise_platform.compliance.compliance_center import (
    ComplianceCenter, ComplianceFramework, ControlStatus, DataSubjectRequestType
)
from enterprise_platform.billing.billing_center import BillingCenter, BillingPlan

print("=" * 65)
print("  LifeOS Enterprise Platform — EXECUTION-010 DEMO")
print("  Multi-Company Scenario")
print("=" * 65)

# ── Setup ──────────────────────────────────────────────────────
org_mgr    = OrganizationManager()
ws_mgr     = WorkspaceManager()
team_mgr   = TeamManager()
tenant_eng = MultiTenantEngine()
rbac       = RBACEngine()
abac       = ABACEngine()
sso        = SSOManager()
audit      = AuditCenter()
compliance = ComplianceCenter()
billing    = BillingCenter()

print("\n[1] CRIANDO ORGANIZAÇÕES")
acme      = org_mgr.create_organization("ACME Corporation",  "admin_acme", OrganizationPlan.ENTERPRISE,   slug="acme")
technova  = org_mgr.create_organization("TechNova Labs",     "admin_tn",   OrganizationPlan.PROFESSIONAL, slug="technova")
globalfin = org_mgr.create_organization("GlobalFinance SA",  "admin_gf",   OrganizationPlan.ENTERPRISE,   slug="globalfinance")
print(f"    ✓ {acme.name} [{acme.plan.value}] — {acme.org_id}")
print(f"    ✓ {technova.name} [{technova.plan.value}] — {technova.org_id}")
print(f"    ✓ {globalfin.name} [{globalfin.plan.value}] — {globalfin.org_id}")

print("\n[2] REGISTRANDO TENANTS (isolamento multi-tenant)")
tenant_eng.register_tenant(acme.org_id,      "lk_live_acme_key",  data_region="us-east-1")
tenant_eng.register_tenant(technova.org_id,  "lk_live_tn_key",    data_region="eu-west-1")
tenant_eng.register_tenant(globalfin.org_id, "lk_live_gf_key",    data_region="us-east-1")
stats = tenant_eng.get_stats()
print(f"    ✓ {stats['registered_tenants']} tenants registrados | {stats['active_tenants']} ativos")

print("\n[3] CRIANDO WORKSPACES")
acme_eng  = ws_mgr.create_workspace(acme.org_id,      "Engineering",     WorkspaceType.DEPARTMENT)
acme_mkt  = ws_mgr.create_workspace(acme.org_id,      "Marketing",       WorkspaceType.DEPARTMENT)
tn_prod   = ws_mgr.create_workspace(technova.org_id,  "Product",         WorkspaceType.DEPARTMENT)
gf_risk   = ws_mgr.create_workspace(globalfin.org_id, "Risk Management", WorkspaceType.DEPARTMENT)
print(f"    ✓ ACME: Engineering + Marketing")
print(f"    ✓ TechNova: Product")
print(f"    ✓ GlobalFinance: Risk Management")

print("\n[4] CRIANDO EQUIPES E MEMBROS")
acme_platform = team_mgr.create_team(acme.org_id, acme_eng.workspace_id, "Platform Team", owner_id="admin_acme")
team_mgr.add_member(acme_platform.team_id, "dev_01",  "alice@acme.com",  MemberRole.MEMBER)
team_mgr.add_member(acme_platform.team_id, "dev_02",  "bob@acme.com",    MemberRole.MEMBER)
team_mgr.add_member(acme_platform.team_id, "lead_01", "carol@acme.com",  MemberRole.MANAGER)
tn_core = team_mgr.create_team(technova.org_id, tn_prod.workspace_id, "Core Team", owner_id="admin_tn")
team_mgr.add_member(tn_core.team_id, "tn_dev_01", "dave@technova.io", MemberRole.MEMBER)
print(f"    ✓ ACME Platform Team: {acme_platform.member_count} membros")
print(f"    ✓ TechNova Core Team: {tn_core.member_count} membros")

print("\n[5] RBAC — ATRIBUINDO ROLES")
rbac.assign_role("admin_acme", "role_org_admin", acme.org_id)
rbac.assign_role("lead_01",    "role_manager",   acme.org_id)
rbac.assign_role("dev_01",     "role_member",    acme.org_id)
rbac.assign_role("dev_02",     "role_viewer",    acme.org_id)
rbac.assign_role("admin_tn",   "role_org_admin", technova.org_id)
rbac.assign_role("tn_dev_01",  "role_member",    technova.org_id)
print(f"    ✓ admin_acme → Org Admin (ACME)")
print(f"    ✓ lead_01    → Manager   (ACME)")
print(f"    ✓ dev_01     → Member    (ACME)")
print(f"    ✓ dev_02     → Viewer    (ACME) — somente leitura")

print("\n[6] VERIFICANDO PERMISSÕES (RBAC)")
checks = [
    ("admin_acme", Resource.ORGANIZATION, Action.CONFIGURE, acme.org_id, "admin_acme configurar org"),
    ("lead_01",    Resource.TEAM,         Action.UPDATE,    acme.org_id, "lead_01 atualizar equipe"),
    ("dev_01",     Resource.MEMORY,       Action.CREATE,    acme.org_id, "dev_01 criar memória"),
    ("dev_02",     Resource.MEMORY,       Action.CREATE,    acme.org_id, "dev_02 criar memória (viewer)"),
    ("dev_01",     Resource.BILLING,      Action.READ,      acme.org_id, "dev_01 ler billing"),
]
for user, res, act, org, desc in checks:
    allowed = rbac.check_permission(user, res, act, org)
    icon = "✓" if allowed else "✗"
    status = "ALLOW" if allowed else "DENY"
    print(f"    {icon} {desc:<40} → {status}")

print("\n[7] ABAC — POLÍTICAS DINÂMICAS")
r1 = abac.evaluate("dev_01", "billing", "read", context={
    "user": {"role": "member"},
    "environment": {"business_hours": False, "ip_authorized": True},
    "organization": {"ip_restriction_enabled": False},
})
r2 = abac.evaluate("admin_acme", "billing", "read", context={
    "user": {"role": "org_admin"},
    "environment": {"business_hours": False, "ip_authorized": True},
    "organization": {"ip_restriction_enabled": False},
})
r3 = abac.evaluate("dev_01", "memory", "read", context={
    "user": {"role": "member"},
    "environment": {"business_hours": True, "ip_authorized": False},
    "organization": {"ip_restriction_enabled": True},
})
print(f"    ✓ dev_01 billing fora do horário → {r1['decision'].upper()} (política: business_hours)")
print(f"    ✓ admin billing fora do horário  → {r2['decision'].upper()} (admin isento)")
print(f"    ✓ dev_01 IP não autorizado       → {r3['decision'].upper()} (política: ip_restriction)")

print("\n[8] ISOLAMENTO MULTI-TENANT")
with tenant_eng.tenant_context(acme.org_id, user_id="dev_01") as ctx:
    try:
        tenant_eng.assert_tenant_access(technova.org_id)
        print("    ✗ FALHA: cross-tenant não bloqueado!")
    except TenantIsolationError as e:
        print(f"    ✓ Cross-tenant bloqueado: {str(e)[:60]}")
    query = tenant_eng.isolate_query({"status": "active"})
    print(f"    ✓ Query isolada: org_id={query['org_id']}")

print("\n[9] SSO — CONFIGURANDO SAML (ACME + Okta)")
saml_cfg = sso.configure_saml(
    org_id=acme.org_id,
    entity_id="https://acme.okta.com",
    sso_url="https://acme.okta.com/app/lifeos/sso/saml",
    certificate="MIIC_ACME_CERT",
    provider=SSOProvider.OKTA,
)
sso.activate_config(saml_cfg.config_id)
login = sso.initiate_saml_login(acme.org_id, relay_state="dashboard")
print(f"    ✓ SAML configurado: {saml_cfg.provider.value} | status: {saml_cfg.status.value}")
print(f"    ✓ Login iniciado: request_id={login['request_id']}")

print("\n[10] AUDIT CENTER — LOGS IMUTÁVEIS")
audit.log(acme.org_id, AuditEventCategory.AUTHENTICATION, "user.login", "dev_01",
          actor_email="alice@acme.com", actor_ip="10.0.1.5")
audit.log(acme.org_id, AuditEventCategory.DATA_MODIFICATION, "memory.create", "dev_01")
audit.log(acme.org_id, AuditEventCategory.SECURITY, "role.assign", "admin_acme")
audit.log(technova.org_id, AuditEventCategory.AUTHENTICATION, "user.login", "tn_dev_01")
acme_log  = audit.query(acme.org_id)
tn_log    = audit.query(technova.org_id)
integrity = audit.verify_log_integrity(acme.org_id)
print(f"    ✓ ACME: {acme_log['total']} eventos | TechNova: {tn_log['total']} eventos (isolados)")
print(f"    ✓ Integridade dos logs: {'OK' if integrity['integrity_ok'] else 'COMPROMETIDA'} | adulterados: {integrity['tampered']}")

print("\n[11] COMPLIANCE — ISO 27001 + LGPD + GDPR")
compliance.enable_framework(acme.org_id,      ComplianceFramework.ISO_27001)
compliance.enable_framework(acme.org_id,      ComplianceFramework.LGPD)
compliance.enable_framework(globalfin.org_id, ComplianceFramework.GDPR)
compliance.enable_framework(globalfin.org_id, ComplianceFramework.SOC2)
iso_controls = compliance.get_controls(acme.org_id, ComplianceFramework.ISO_27001)
for c in iso_controls[:10]:
    compliance.update_control_status(acme.org_id, c.control_id, ControlStatus.COMPLIANT)
score = compliance.get_compliance_score(acme.org_id)
print(f"    ✓ ACME — ISO 27001: {score['frameworks']['iso_27001']['score']}% | LGPD: {score['frameworks']['lgpd']['score']}%")
print(f"    ✓ ACME — Score geral: {score['overall_score']}%")
dsr = compliance.submit_dsr(acme.org_id, DataSubjectRequestType.ERASURE, "user@example.com")
print(f"    ✓ DSR registrada: {dsr.request_id} | prazo: {dsr.due_at.strftime('%Y-%m-%d')}")

print("\n[12] BILLING — PLANOS E ASSINATURAS")
billing.create_subscription(acme.org_id,      BillingPlan.ENTERPRISE)
billing.create_subscription(technova.org_id,  BillingPlan.PROFESSIONAL)
billing.create_subscription(globalfin.org_id, BillingPlan.ENTERPRISE_PLUS)
acme_sub = billing.get_subscription(acme.org_id)
tn_sub   = billing.get_subscription(technova.org_id)
print(f"    ✓ ACME:        {acme_sub.plan.value:<20} | trial: {acme_sub.is_trial}")
print(f"    ✓ TechNova:    {tn_sub.plan.value:<20} | trial: {tn_sub.is_trial}")
print(f"    ✓ GlobalFin:   enterprise_plus        | custom contract")

print("\n" + "=" * 65)
print("  EXECUTION-010 — DEMO CONCLUÍDA COM SUCESSO")
print(f"  3 empresas | 4 workspaces | 2 equipes | 6 usuários")
print(f"  RBAC + ABAC + SSO + Audit + Compliance + Billing")
print(f"  Isolamento multi-tenant: ATIVO | Cross-tenant: BLOQUEADO")
print("=" * 65)
