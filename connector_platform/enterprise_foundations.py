"""Enterprise domain foundations composed through the Integration SDK."""

from __future__ import annotations

from dataclasses import dataclass

from connector_platform.connectors.communication import (
    COMMUNICATION_CONNECTORS,
    CommunicationPlatform,
)
from connector_platform.connectors.finance import (
    OPEN_FINANCE_CONNECTORS,
    OpenFinanceManager,
)
from connector_platform.sdk.integration_sdk import IntegrationSDK


@dataclass(frozen=True)
class EnterpriseFoundations:
    finance: OpenFinanceManager
    communication: CommunicationPlatform


def bootstrap_enterprise_foundations(sdk: IntegrationSDK) -> EnterpriseFoundations:
    """Register enterprise connectors and stable SDK extensions once at startup."""
    finance = OpenFinanceManager(sdk)
    communication = CommunicationPlatform(sdk)

    for connector_class in OPEN_FINANCE_CONNECTORS:
        finance.register(connector_class)
    communication.register_connectors(COMMUNICATION_CONNECTORS)

    extensions = {
        "finance.snapshot": finance.get_snapshot,
        "finance.cash_flow": finance.aggregate_cash_flow,
        "finance.payment": finance.reject_payment_initiation,
        "communication.inbox": communication.unified_inbox,
        "communication.calendar": communication.unified_calendar,
        "communication.search": communication.search,
        "communication.route": communication.route_action,
    }
    for name, handler in extensions.items():
        if name not in sdk.health_check()["extensions"]:
            sdk.register_extension(name, handler)

    return EnterpriseFoundations(finance=finance, communication=communication)


__all__ = ["EnterpriseFoundations", "bootstrap_enterprise_foundations"]
