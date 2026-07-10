"""
LifeOS Enterprise Platform — Organization Manager
EXECUTION-010: Enterprise Platform

Gerencia organizações (empresas) no sistema multi-tenant do LifeOS.
Cada organização é completamente isolada das demais.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class OrganizationPlan(str, Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    ENTERPRISE_PLUS = "enterprise_plus"


class OrganizationStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    CANCELLED = "cancelled"


class ComplianceFramework(str, Enum):
    ISO_27001 = "iso_27001"
    SOC2 = "soc2"
    LGPD = "lgpd"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"


@dataclass
class OrganizationSettings:
    """Configurações de segurança e compliance da organização."""
    enforce_mfa: bool = False
    allowed_ip_ranges: List[str] = field(default_factory=list)
    session_timeout_minutes: int = 480
    password_min_length: int = 12
    password_require_uppercase: bool = True
    password_require_numbers: bool = True
    password_require_symbols: bool = True
    max_failed_login_attempts: int = 5
    lockout_duration_minutes: int = 30
    data_residency_region: str = "us-east-1"
    audit_log_retention_days: int = 365
    compliance_frameworks: List[str] = field(default_factory=list)
    sso_enabled: bool = False
    sso_provider: Optional[str] = None
    scim_enabled: bool = False
    custom_domain: Optional[str] = None
    allow_member_invites: bool = True
    require_email_domain: Optional[str] = None


@dataclass
class Organization:
    """Representa uma organização (empresa) no LifeOS Enterprise."""
    name: str
    slug: str
    plan: OrganizationPlan = OrganizationPlan.STARTER
    org_id: str = field(default_factory=lambda: f"org_{secrets.token_hex(8)}")
    status: OrganizationStatus = OrganizationStatus.TRIAL
    owner_id: str = ""
    settings: OrganizationSettings = field(default_factory=OrganizationSettings)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    member_count: int = 0
    workspace_count: int = 0
    max_members: int = 10
    max_workspaces: int = 3
    billing_email: str = ""
    tax_id: Optional[str] = None
    address: Optional[Dict] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_active(self) -> bool:
        return self.status in (OrganizationStatus.ACTIVE, OrganizationStatus.TRIAL)

    def can_add_member(self) -> bool:
        return self.member_count < self.max_members

    def can_add_workspace(self) -> bool:
        return self.workspace_count < self.max_workspaces

    def to_dict(self) -> dict:
        return {
            "org_id": self.org_id,
            "name": self.name,
            "slug": self.slug,
            "plan": self.plan.value,
            "status": self.status.value,
            "owner_id": self.owner_id,
            "member_count": self.member_count,
            "workspace_count": self.workspace_count,
            "max_members": self.max_members,
            "max_workspaces": self.max_workspaces,
            "created_at": self.created_at.isoformat(),
            "settings": {
                "enforce_mfa": self.settings.enforce_mfa,
                "sso_enabled": self.settings.sso_enabled,
                "compliance_frameworks": self.settings.compliance_frameworks,
                "data_residency_region": self.settings.data_residency_region,
            },
        }


# Plan limits
PLAN_LIMITS = {
    OrganizationPlan.STARTER: {"max_members": 10, "max_workspaces": 3},
    OrganizationPlan.PROFESSIONAL: {"max_members": 100, "max_workspaces": 25},
    OrganizationPlan.ENTERPRISE: {"max_members": 1000, "max_workspaces": 100},
    OrganizationPlan.ENTERPRISE_PLUS: {"max_members": 99999, "max_workspaces": 99999},
}


class OrganizationManager:
    """
    Gerenciador central de organizações do LifeOS Enterprise.

    Responsável por:
    - Criação e configuração de organizações
    - Gerenciamento de planos e limites
    - Configurações de segurança e compliance
    - Isolamento multi-tenant
    """

    def __init__(self):
        self._organizations: Dict[str, Organization] = {}
        self._slug_index: Dict[str, str] = {}  # slug -> org_id

    def create_organization(
        self,
        name: str,
        owner_id: str,
        plan: OrganizationPlan = OrganizationPlan.STARTER,
        billing_email: str = "",
        slug: Optional[str] = None,
    ) -> Organization:
        """Cria uma nova organização."""
        if not slug:
            slug = name.lower().replace(" ", "-").replace("_", "-")
            slug = "".join(c for c in slug if c.isalnum() or c == "-")

        if slug in self._slug_index:
            raise ValueError(f"Slug '{slug}' already in use.")

        limits = PLAN_LIMITS[plan]
        org = Organization(
            name=name,
            slug=slug,
            plan=plan,
            owner_id=owner_id,
            billing_email=billing_email,
            max_members=limits["max_members"],
            max_workspaces=limits["max_workspaces"],
            status=OrganizationStatus.TRIAL,
        )
        self._organizations[org.org_id] = org
        self._slug_index[slug] = org.org_id
        return org

    def get_organization(self, org_id: str) -> Optional[Organization]:
        return self._organizations.get(org_id)

    def get_by_slug(self, slug: str) -> Optional[Organization]:
        org_id = self._slug_index.get(slug)
        return self._organizations.get(org_id) if org_id else None

    def update_plan(self, org_id: str, new_plan: OrganizationPlan) -> Organization:
        """Atualiza o plano da organização."""
        org = self._organizations.get(org_id)
        if not org:
            raise ValueError(f"Organization '{org_id}' not found.")
        limits = PLAN_LIMITS[new_plan]
        org.plan = new_plan
        org.max_members = limits["max_members"]
        org.max_workspaces = limits["max_workspaces"]
        org.updated_at = datetime.now(timezone.utc)
        return org

    def update_settings(self, org_id: str, settings: Dict[str, Any]) -> Organization:
        """Atualiza configurações de segurança da organização."""
        org = self._organizations.get(org_id)
        if not org:
            raise ValueError(f"Organization '{org_id}' not found.")
        for key, value in settings.items():
            if hasattr(org.settings, key):
                setattr(org.settings, key, value)
        org.updated_at = datetime.now(timezone.utc)
        return org

    def suspend_organization(self, org_id: str, reason: str = "") -> bool:
        org = self._organizations.get(org_id)
        if not org:
            return False
        org.status = OrganizationStatus.SUSPENDED
        org.metadata["suspension_reason"] = reason
        org.updated_at = datetime.now(timezone.utc)
        return True

    def activate_organization(self, org_id: str) -> bool:
        org = self._organizations.get(org_id)
        if not org:
            return False
        org.status = OrganizationStatus.ACTIVE
        org.updated_at = datetime.now(timezone.utc)
        return True

    def add_compliance_framework(
        self, org_id: str, framework: ComplianceFramework
    ) -> bool:
        org = self._organizations.get(org_id)
        if not org:
            return False
        if framework.value not in org.settings.compliance_frameworks:
            org.settings.compliance_frameworks.append(framework.value)
        return True

    def list_organizations(
        self,
        status: Optional[OrganizationStatus] = None,
        plan: Optional[OrganizationPlan] = None,
    ) -> List[Organization]:
        orgs = list(self._organizations.values())
        if status:
            orgs = [o for o in orgs if o.status == status]
        if plan:
            orgs = [o for o in orgs if o.plan == plan]
        return orgs

    def get_stats(self) -> Dict[str, Any]:
        orgs = list(self._organizations.values())
        return {
            "total_organizations": len(orgs),
            "active": sum(1 for o in orgs if o.status == OrganizationStatus.ACTIVE),
            "trial": sum(1 for o in orgs if o.status == OrganizationStatus.TRIAL),
            "suspended": sum(1 for o in orgs if o.status == OrganizationStatus.SUSPENDED),
            "by_plan": {
                plan.value: sum(1 for o in orgs if o.plan == plan)
                for plan in OrganizationPlan
            },
            "total_members": sum(o.member_count for o in orgs),
        }
