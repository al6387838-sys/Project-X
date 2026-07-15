"""Open Finance Foundation for LifeOS Enterprise.

This module coordinates Brazilian Open Finance data through IntegrationSDK.  It
never persists provider credentials and intentionally rejects payment-initiation
operations: the LifeOS finance surface is read-only until regulatory approval.
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional

from connector_platform.models.connector_models import SyncDirection, SyncFrequency
from connector_platform.sdk.integration_sdk import IntegrationSDK


CONNECTOR_ID = "open_finance_brazil"
READ_ONLY_SCOPES = (
    "accounts:read",
    "balances:read",
    "transactions:read",
    "investments:read",
    "credit:read",
    "insurance:read",
)


@dataclass(frozen=True)
class FinancialAccount:
    account_id: str
    institution_id: str
    name: str
    account_type: str
    currency: str = "BRL"
    status: str = "active"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FinancialBalance:
    account_id: str
    available: Decimal
    current: Decimal
    currency: str = "BRL"
    captured_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True)
class FinancialTransaction:
    transaction_id: str
    account_id: str
    amount: Decimal
    description: str
    booked_at: datetime
    category: str = "uncategorized"
    currency: str = "BRL"
    transaction_type: str = "other"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FinanceSnapshot:
    user_id: str
    accounts: List[FinancialAccount] = field(default_factory=list)
    balances: List[FinancialBalance] = field(default_factory=list)
    transactions: List[FinancialTransaction] = field(default_factory=list)
    institutions: List[Dict[str, Any]] = field(default_factory=list)
    synced_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def total_available(self) -> Decimal:
        return sum((item.available for item in self.balances), Decimal("0"))

    def to_dict(self) -> Dict[str, Any]:
        def serialize(value: Any) -> Any:
            if isinstance(value, Decimal):
                return str(value)
            if isinstance(value, datetime):
                return value.isoformat()
            if isinstance(value, list):
                return [serialize(item) for item in value]
            if isinstance(value, dict):
                return {key: serialize(item) for key, item in value.items()}
            return value

        return serialize(asdict(self)) | {"total_available": str(self.total_available)}


class OpenFinanceManager:
    """Canonical read-only Open Finance application service."""

    def __init__(self, sdk: IntegrationSDK):
        self.sdk = sdk
        self._snapshots: Dict[str, FinanceSnapshot] = {}
        self._consents: Dict[str, Dict[str, Any]] = {}

    def register(self, connector_class: type) -> bool:
        """Register the existing Open Finance connector through IntegrationSDK."""
        return self.sdk.register_connector(connector_class)

    async def prepare_connection(
        self,
        user_id: str,
        consent_scopes: Iterable[str],
        consent_text: str,
        *,
        institution_id: str,
        consent_id: str,
        expires_at: Optional[datetime] = None,
    ):
        scopes = list(dict.fromkeys(consent_scopes))
        unsupported = sorted(set(scopes) - set(READ_ONLY_SCOPES))
        if unsupported:
            raise PermissionError(f"Open Finance scope is not allowed in read-only mode: {unsupported}")
        if not scopes:
            raise ValueError("At least one Open Finance read scope is required")
        if not institution_id or not consent_id:
            raise ValueError("institution_id and consent_id are required")

        config = await self.sdk.prepare_connection(
            user_id,
            CONNECTOR_ID,
            scopes,
            consent_text,
            settings={
                "institution_id": institution_id,
                "consent_id": consent_id,
                "consent_expires_at": expires_at.isoformat() if expires_at else None,
                "read_only": True,
                "data_residency": "Brazil",
            },
            sync_direction=SyncDirection.READ_ONLY,
            sync_frequency=SyncFrequency.HOURLY,
        )
        self._consents[user_id] = {
            "consent_id": consent_id,
            "institution_id": institution_id,
            "scopes": scopes,
            "expires_at": expires_at,
            "active": True,
        }
        return config

    def validate_consent(self, user_id: str, required_scope: str) -> bool:
        consent = self._consents.get(user_id)
        if not consent or not consent["active"] or required_scope not in consent["scopes"]:
            return False
        expires_at = consent.get("expires_at")
        return expires_at is None or expires_at > datetime.now(timezone.utc)

    def revoke_consent(self, user_id: str) -> bool:
        consent = self._consents.get(user_id)
        if consent is None:
            return False
        consent["active"] = False
        self._snapshots.pop(user_id, None)
        return True

    async def synchronize(self, user_id: str, provider_payload: Dict[str, Any]) -> FinanceSnapshot:
        if not self.validate_consent(user_id, "accounts:read"):
            raise PermissionError("Active consent for accounts:read is required")

        await self.sdk.sync(
            user_id,
            CONNECTOR_ID,
            resource_types=["accounts", "balances", "transactions"],
        )
        snapshot = self.normalize_snapshot(user_id, provider_payload)
        self._snapshots[user_id] = snapshot
        return snapshot

    def normalize_snapshot(self, user_id: str, payload: Dict[str, Any]) -> FinanceSnapshot:
        accounts = [self._normalize_account(item) for item in payload.get("accounts", [])]
        balances = [self._normalize_balance(item) for item in payload.get("balances", [])]
        transactions = self._deduplicate_transactions(
            self._normalize_transaction(item) for item in payload.get("transactions", [])
        )
        institutions = [dict(item) for item in payload.get("institutions", [])]
        return FinanceSnapshot(
            user_id=user_id,
            accounts=accounts,
            balances=balances,
            transactions=transactions,
            institutions=institutions,
        )

    def get_snapshot(self, user_id: str) -> Optional[FinanceSnapshot]:
        return self._snapshots.get(user_id)

    def aggregate_cash_flow(self, user_id: str) -> Dict[str, str]:
        snapshot = self._snapshots.get(user_id)
        if snapshot is None:
            return {"income": "0", "expenses": "0", "net": "0"}
        income = sum((tx.amount for tx in snapshot.transactions if tx.amount > 0), Decimal("0"))
        expenses = sum((-tx.amount for tx in snapshot.transactions if tx.amount < 0), Decimal("0"))
        return {"income": str(income), "expenses": str(expenses), "net": str(income - expenses)}

    @staticmethod
    def reject_payment_initiation(*_: Any, **__: Any) -> None:
        raise PermissionError("Payment initiation is disabled: Open Finance foundation operates in read-only mode")

    @staticmethod
    def _normalize_account(item: Dict[str, Any]) -> FinancialAccount:
        return FinancialAccount(
            account_id=str(item["account_id"]),
            institution_id=str(item["institution_id"]),
            name=str(item.get("name", "Conta")),
            account_type=str(item.get("account_type", "checking")),
            currency=str(item.get("currency", "BRL")),
            status=str(item.get("status", "active")),
            metadata=dict(item.get("metadata", {})),
        )

    @staticmethod
    def _normalize_balance(item: Dict[str, Any]) -> FinancialBalance:
        captured_at = item.get("captured_at") or datetime.now(timezone.utc)
        if isinstance(captured_at, str):
            captured_at = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
        return FinancialBalance(
            account_id=str(item["account_id"]),
            available=Decimal(str(item.get("available", "0"))),
            current=Decimal(str(item.get("current", item.get("available", "0")))),
            currency=str(item.get("currency", "BRL")),
            captured_at=captured_at,
        )

    @staticmethod
    def _normalize_transaction(item: Dict[str, Any]) -> FinancialTransaction:
        booked_at = item.get("booked_at") or datetime.now(timezone.utc)
        if isinstance(booked_at, str):
            booked_at = datetime.fromisoformat(booked_at.replace("Z", "+00:00"))
        account_id = str(item["account_id"])
        amount = Decimal(str(item.get("amount", "0")))
        description = str(item.get("description", ""))
        transaction_id = str(item.get("transaction_id") or hashlib.sha256(
            f"{account_id}|{amount}|{description}|{booked_at.isoformat()}".encode()
        ).hexdigest()[:24])
        return FinancialTransaction(
            transaction_id=transaction_id,
            account_id=account_id,
            amount=amount,
            description=description,
            booked_at=booked_at,
            category=str(item.get("category", "uncategorized")),
            currency=str(item.get("currency", "BRL")),
            transaction_type=str(item.get("transaction_type", "other")),
            metadata=dict(item.get("metadata", {})),
        )

    @staticmethod
    def _deduplicate_transactions(items: Iterable[FinancialTransaction]) -> List[FinancialTransaction]:
        unique: Dict[str, FinancialTransaction] = {}
        for item in items:
            unique[item.transaction_id] = item
        return sorted(unique.values(), key=lambda item: item.booked_at, reverse=True)
