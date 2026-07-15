"""Canonical Open Finance exports for the LifeOS Integration Framework."""

from connector_platform.connectors.finance.open_finance_manager import (
    CONNECTOR_ID,
    READ_ONLY_SCOPES,
    FinanceSnapshot,
    FinancialAccount,
    FinancialBalance,
    FinancialTransaction,
    OpenFinanceManager,
)
from connector_platform.connectors.future.future_connectors_architecture import (
    OpenFinanceBrazilConnector,
)

OPEN_FINANCE_CONNECTORS = [OpenFinanceBrazilConnector]

__all__ = [
    "CONNECTOR_ID",
    "READ_ONLY_SCOPES",
    "FinanceSnapshot",
    "FinancialAccount",
    "FinancialBalance",
    "FinancialTransaction",
    "OpenFinanceBrazilConnector",
    "OpenFinanceManager",
    "OPEN_FINANCE_CONNECTORS",
]
