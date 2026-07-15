import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest

from connector_platform.connectors.communication import (
    COMMUNICATION_CONNECTORS,
    CommunicationPlatform,
)
from connector_platform.connectors.finance import (
    OPEN_FINANCE_CONNECTORS,
    OpenFinanceManager,
)
from connector_platform.sdk.integration_sdk import IntegrationSDK


@pytest.fixture
def sdk():
    value = IntegrationSDK(tenant_id="enterprise-test")
    value.sync = AsyncMock(return_value=object())
    value.prepare_connection = AsyncMock(return_value={"status": "pending_auth"})
    value.execute = AsyncMock(return_value={"status": "success"})
    return value


def test_open_finance_consent_is_granular_and_read_only(sdk):
    manager = OpenFinanceManager(sdk)
    manager.register(OPEN_FINANCE_CONNECTORS[0])
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    asyncio.run(manager.prepare_connection(
        "user-1",
        ["accounts:read", "balances:read", "transactions:read"],
        "Consentimento Open Finance explícito",
        institution_id="bank-1",
        consent_id="consent-1",
        expires_at=expires_at,
    ))

    assert manager.validate_consent("user-1", "accounts:read")
    assert not manager.validate_consent("user-1", "investments:read")
    with pytest.raises(PermissionError):
        asyncio.run(manager.prepare_connection(
            "user-1",
            ["payments:initiate"],
            "invalid",
            institution_id="bank-1",
            consent_id="consent-2",
        ))
    with pytest.raises(PermissionError):
        manager.reject_payment_initiation()


def test_open_finance_normalizes_deduplicates_and_aggregates(sdk):
    manager = OpenFinanceManager(sdk)
    manager._consents["user-1"] = {
        "consent_id": "consent-1",
        "institution_id": "bank-1",
        "scopes": ["accounts:read"],
        "expires_at": None,
        "active": True,
    }
    payload = {
        "institutions": [{"institution_id": "bank-1", "name": "Banco 1"}],
        "accounts": [{
            "account_id": "account-1",
            "institution_id": "bank-1",
            "name": "Conta principal",
            "account_type": "checking",
        }],
        "balances": [{"account_id": "account-1", "available": "1250.50", "current": "1300.50"}],
        "transactions": [
            {
                "transaction_id": "tx-1",
                "account_id": "account-1",
                "amount": "2500.00",
                "description": "Salário",
                "booked_at": "2026-07-01T12:00:00Z",
            },
            {
                "transaction_id": "tx-2",
                "account_id": "account-1",
                "amount": "-249.50",
                "description": "Mercado",
                "booked_at": "2026-07-02T12:00:00Z",
            },
            {
                "transaction_id": "tx-2",
                "account_id": "account-1",
                "amount": "-249.50",
                "description": "Mercado",
                "booked_at": "2026-07-02T12:00:00Z",
            },
        ],
    }

    snapshot = asyncio.run(manager.synchronize("user-1", payload))
    assert snapshot.total_available == Decimal("1250.50")
    assert len(snapshot.transactions) == 2
    assert manager.aggregate_cash_flow("user-1") == {
        "income": "2500.00",
        "expenses": "249.50",
        "net": "2250.50",
    }


def test_open_finance_revoke_consent_removes_cached_financial_data(sdk):
    manager = OpenFinanceManager(sdk)
    manager._consents["user-1"] = {
        "consent_id": "consent-1",
        "institution_id": "bank-1",
        "scopes": ["accounts:read"],
        "expires_at": None,
        "active": True,
    }
    manager._snapshots["user-1"] = manager.normalize_snapshot("user-1", {})

    assert manager.revoke_consent("user-1")
    assert manager.get_snapshot("user-1") is None
    assert not manager.validate_consent("user-1", "accounts:read")


def test_communication_bundle_is_registered_through_sdk(sdk):
    platform = CommunicationPlatform(sdk)
    result = platform.register_connectors(COMMUNICATION_CONNECTORS)

    assert len(result) == 8
    assert all(result.values())
    assert {item["connector_id"] for item in platform.available_channels()} == set(result)


def test_communication_unifies_inbox_calendar_and_search(sdk):
    platform = CommunicationPlatform(sdk)
    platform.register_connectors(COMMUNICATION_CONNECTORS)
    payload = {
        "messages": [
            {
                "id": "gmail-1",
                "provider": "Google",
                "sender": {"email": "alice@example.com", "name": "Alice"},
                "to": ["lifeos@example.com"],
                "subject": "Planejamento Enterprise",
                "preview": "Revisão do roadmap",
                "timestamp": "2026-07-15T10:00:00Z",
                "unread": True,
            },
            {
                "id": "gmail-2",
                "provider": "Google",
                "sender": "bob@example.com",
                "subject": "Relatório",
                "preview": "Status semanal",
                "timestamp": "2026-07-14T10:00:00Z",
            },
        ],
        "events": [{
            "id": "event-1",
            "title": "Reunião LIFEOS",
            "start": "2026-07-16T13:00:00Z",
            "end": "2026-07-16T14:00:00Z",
            "attendees": [{"email": "alice@example.com", "name": "Alice"}],
            "meeting_url": "https://meet.example.com/lifeos",
        }],
    }

    result = asyncio.run(platform.synchronize("user-1", "gmail", payload))
    assert result == {"messages": 2, "events": 1}
    assert [item.message_id for item in platform.unified_inbox("user-1", unread_only=True)] == ["gmail-1"]
    assert platform.search("user-1", "enterprise")[0].message_id == "gmail-1"
    assert platform.unified_calendar("user-1")[0].event_id == "event-1"


def test_communication_routes_actions_only_through_sdk(sdk):
    platform = CommunicationPlatform(sdk)
    platform.register_connectors(COMMUNICATION_CONNECTORS)

    result = asyncio.run(platform.route_action(
        "user-1",
        "slack",
        "send_message",
        {"channel_id": "C1", "text": "Status"},
        required_scope="chat:write",
    ))

    assert result == {"status": "success"}
    sdk.execute.assert_awaited_once_with(
        "user-1",
        "slack",
        "send_message",
        {"channel_id": "C1", "text": "Status"},
        required_scope="chat:write",
    )


def test_enterprise_foundations_bootstrap_registers_sdk_extensions_once():
    from connector_platform.enterprise_foundations import bootstrap_enterprise_foundations

    integration_sdk = IntegrationSDK(tenant_id="bootstrap-test")
    foundations = bootstrap_enterprise_foundations(integration_sdk)
    bootstrap_enterprise_foundations(integration_sdk)

    assert isinstance(foundations.finance, OpenFinanceManager)
    assert isinstance(foundations.communication, CommunicationPlatform)
    assert integration_sdk.health_check()["extensions"] == [
        "communication.calendar",
        "communication.inbox",
        "communication.route",
        "communication.search",
        "finance.cash_flow",
        "finance.payment",
        "finance.snapshot",
    ]
