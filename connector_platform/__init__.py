"""
LifeOS Universal Connector Platform
Sprint 025 — Universal Connector Platform

The central hub for all external service integrations in LifeOS.
Implements Zero Trust, End-to-End Encryption, explicit consent,
and granular permissions across all connectors.
"""

__version__ = "2.0.0"
__sprint__ = "061"
__module__ = "connector_platform"

from connector_platform.core.connector_engine import ConnectorEngine
from connector_platform.engines.integration_manager import IntegrationManager
from connector_platform.engines.connection_manager import ConnectionManager
from connector_platform.engines.oauth_manager import OAuthManager
from connector_platform.engines.sync_manager import SyncManager
from connector_platform.engines.webhook_manager import WebhookManager
from connector_platform.registry.connector_registry import ConnectorRegistry
from connector_platform.marketplace.connector_marketplace import ConnectorMarketplace
from connector_platform.security.permission_manager import PermissionManager
from connector_platform.security.secrets_manager import SecretsManager
from connector_platform.monitoring.integration_monitor import IntegrationMonitor
from connector_platform.sdk.integration_sdk import IntegrationSDK

__all__ = [
    "ConnectorEngine",
    "IntegrationManager",
    "IntegrationSDK",
    "ConnectionManager",
    "OAuthManager",
    "SecretsManager",
    "SyncManager",
    "WebhookManager",
    "ConnectorRegistry",
    "ConnectorMarketplace",
    "PermissionManager",
    "IntegrationMonitor",
]
