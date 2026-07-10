"""
LifeOS Enterprise Platform — Billing Center
EXECUTION-010: Enterprise Platform

Gerenciamento de planos, assinaturas e faturamento enterprise.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class BillingPlan(str, Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    ENTERPRISE_PLUS = "enterprise_plus"


class BillingCycle(str, Enum):
    MONTHLY = "monthly"
    ANNUAL = "annual"


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    PAID = "paid"
    VOID = "void"
    UNCOLLECTIBLE = "uncollectible"


PLAN_PRICING = {
    BillingPlan.STARTER: {
        "monthly": 0,
        "annual": 0,
        "max_members": 10,
        "max_workspaces": 3,
        "api_calls_per_month": 10_000,
        "storage_gb": 5,
        "features": ["basic_rbac", "audit_log_30d", "email_support"],
    },
    BillingPlan.PROFESSIONAL: {
        "monthly": 49,
        "annual": 39,
        "max_members": 100,
        "max_workspaces": 25,
        "api_calls_per_month": 500_000,
        "storage_gb": 100,
        "features": ["advanced_rbac", "abac", "sso_oidc", "audit_log_1y", "webhooks", "priority_support"],
    },
    BillingPlan.ENTERPRISE: {
        "monthly": 199,
        "annual": 159,
        "max_members": 1000,
        "max_workspaces": 100,
        "api_calls_per_month": 5_000_000,
        "storage_gb": 1000,
        "features": [
            "advanced_rbac", "abac", "sso_saml", "sso_oidc", "ldap_ready", "scim_ready",
            "audit_log_3y", "compliance_iso27001", "compliance_soc2", "compliance_lgpd",
            "compliance_gdpr", "custom_roles", "dedicated_support", "sla_99_9",
        ],
    },
    BillingPlan.ENTERPRISE_PLUS: {
        "monthly": 0,  # Preço sob consulta
        "annual": 0,
        "max_members": 99999,
        "max_workspaces": 99999,
        "api_calls_per_month": 999_999_999,
        "storage_gb": 99999,
        "features": [
            "all_enterprise_features", "custom_contract", "dedicated_infrastructure",
            "on_premise_option", "custom_sla", "white_glove_support",
        ],
    },
}


@dataclass
class Subscription:
    """Assinatura de uma organização."""
    org_id: str
    plan: BillingPlan
    cycle: BillingCycle = BillingCycle.MONTHLY
    subscription_id: str = field(default_factory=lambda: f"sub_{secrets.token_hex(10)}")
    status: str = "active"
    current_period_start: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    current_period_end: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=30)
    )
    cancel_at_period_end: bool = False
    trial_end: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_trial(self) -> bool:
        if not self.trial_end:
            return False
        return datetime.now(timezone.utc) < self.trial_end

    def to_dict(self) -> dict:
        pricing = PLAN_PRICING.get(self.plan, {})
        price = pricing.get(self.cycle.value, 0)
        return {
            "subscription_id": self.subscription_id,
            "org_id": self.org_id,
            "plan": self.plan.value,
            "cycle": self.cycle.value,
            "status": self.status,
            "price_per_cycle": price,
            "currency": "USD",
            "current_period_end": self.current_period_end.isoformat(),
            "is_trial": self.is_trial,
            "features": pricing.get("features", []),
        }


@dataclass
class Invoice:
    """Fatura de uma organização."""
    org_id: str
    subscription_id: str
    amount_cents: int
    currency: str = "USD"
    invoice_id: str = field(default_factory=lambda: f"inv_{secrets.token_hex(10)}")
    status: InvoiceStatus = InvoiceStatus.DRAFT
    period_start: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    period_end: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=30)
    )
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    line_items: List[Dict] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "invoice_id": self.invoice_id,
            "org_id": self.org_id,
            "amount": self.amount_cents / 100,
            "currency": self.currency,
            "status": self.status.value,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "created_at": self.created_at.isoformat(),
        }


class BillingCenter:
    """Gerenciador de faturamento do LifeOS Enterprise."""

    def __init__(self):
        self._subscriptions: Dict[str, Subscription] = {}  # org_id -> subscription
        self._invoices: List[Invoice] = []

    def create_subscription(
        self,
        org_id: str,
        plan: BillingPlan,
        cycle: BillingCycle = BillingCycle.MONTHLY,
        trial_days: int = 14,
    ) -> Subscription:
        now = datetime.now(timezone.utc)
        sub = Subscription(
            org_id=org_id,
            plan=plan,
            cycle=cycle,
            trial_end=now + timedelta(days=trial_days) if trial_days > 0 else None,
            current_period_end=now + timedelta(days=30 if cycle == BillingCycle.MONTHLY else 365),
        )
        self._subscriptions[org_id] = sub
        return sub

    def upgrade_plan(
        self, org_id: str, new_plan: BillingPlan, cycle: Optional[BillingCycle] = None
    ) -> Subscription:
        sub = self._subscriptions.get(org_id)
        if not sub:
            raise ValueError(f"No subscription found for org '{org_id}'.")
        sub.plan = new_plan
        if cycle:
            sub.cycle = cycle
        return sub

    def get_subscription(self, org_id: str) -> Optional[Subscription]:
        return self._subscriptions.get(org_id)

    def generate_invoice(self, org_id: str) -> Invoice:
        sub = self._subscriptions.get(org_id)
        if not sub:
            raise ValueError(f"No subscription for org '{org_id}'.")
        pricing = PLAN_PRICING.get(sub.plan, {})
        price = pricing.get(sub.cycle.value, 0)
        invoice = Invoice(
            org_id=org_id,
            subscription_id=sub.subscription_id,
            amount_cents=int(price * 100),
            status=InvoiceStatus.OPEN,
            due_date=datetime.now(timezone.utc) + timedelta(days=30),
            line_items=[{
                "description": f"LifeOS {sub.plan.value.title()} Plan ({sub.cycle.value})",
                "quantity": 1,
                "unit_price": price,
                "total": price,
            }],
        )
        self._invoices.append(invoice)
        return invoice

    def get_usage_summary(self, org_id: str) -> Dict[str, Any]:
        sub = self._subscriptions.get(org_id)
        if not sub:
            return {}
        pricing = PLAN_PRICING.get(sub.plan, {})
        return {
            "org_id": org_id,
            "plan": sub.plan.value,
            "limits": {
                "max_members": pricing.get("max_members", 0),
                "max_workspaces": pricing.get("max_workspaces", 0),
                "api_calls_per_month": pricing.get("api_calls_per_month", 0),
                "storage_gb": pricing.get("storage_gb", 0),
            },
            "features": pricing.get("features", []),
        }

    def list_invoices(self, org_id: str) -> List[Invoice]:
        return [inv for inv in self._invoices if inv.org_id == org_id]
