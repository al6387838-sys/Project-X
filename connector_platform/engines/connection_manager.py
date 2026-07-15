"""Connection lifecycle orchestration for the LifeOS Integration Framework."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type

from connector_platform.core.connector_engine import BaseConnector, ConnectorEngine
from connector_platform.engines.integration_manager import IntegrationManager
from connector_platform.engines.oauth_manager import OAuthManager
from connector_platform.engines.sync_manager import SyncManager
from connector_platform.engines.webhook_manager import WebhookManager
from connector_platform.models.connector_models import (
    ConnectorStatus,
    IntegrationConfig,
    SyncDirection,
    SyncFrequency,
    SyncJob,
    WebhookEvent,
    WebhookRegistration,
)
from connector_platform.security.secrets_manager import SecretsManager

logger = logging.getLogger("lifeos.connector_platform.connection_manager")


class ConnectionManager:
    """
    Definitive lifecycle boundary for external connections.

    Future integrations must enter through this manager (or IntegrationSDK),
    ensuring that consent, secrets, OAuth, webhooks and sync state are cleaned
    up consistently on every transition.
    """

    def __init__(
        self,
        connector_engine: Optional[ConnectorEngine] = None,
        integration_manager: Optional[IntegrationManager] = None,
        oauth_manager: Optional[OAuthManager] = None,
        secrets_manager: Optional[SecretsManager] = None,
        webhook_manager: Optional[WebhookManager] = None,
        sync_manager: Optional[SyncManager] = None,
        *,
        tenant_id: str = "default",
    ):
        self.connector_engine = connector_engine or ConnectorEngine()
        self.integrations = integration_manager or IntegrationManager()
        self.secrets = secrets_manager or SecretsManager()
        self.oauth = oauth_manager or OAuthManager(self.secrets, tenant_id)
        self.webhooks = webhook_manager or WebhookManager()
        self.sync = sync_manager or SyncManager()
        self.tenant_id = tenant_id
        self._events: List[Dict[str, Any]] = []

    def _record(self, event: str, config: IntegrationConfig, **details: Any) -> None:
        self._events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event,
            "integration_id": config.integration_id,
            "user_id": config.user_id,
            "connector_id": config.connector_id,
            "details": details,
        })
        if len(self._events) > 5000:
            self._events = self._events[-5000:]

    def register_connector(self, connector_class: Type[BaseConnector]) -> bool:
        """Register a connector implementation in the canonical engine."""
        return self.connector_engine.register_connector(connector_class)

    async def prepare_connection(
        self,
        user_id: str,
        connector_id: str,
        consent_scopes: List[str],
        consent_text: str,
        *,
        settings: Optional[Dict[str, Any]] = None,
        sync_direction: SyncDirection = SyncDirection.BIDIRECTIONAL,
        sync_frequency: SyncFrequency = SyncFrequency.HOURLY,
    ) -> IntegrationConfig:
        """Create or reactivate a connection with explicit scoped consent."""
        if not consent_scopes:
            raise ValueError("At least one explicit consent scope is required")
        if not self.connector_engine.get_connector_manifest(connector_id):
            raise ValueError(f"Connector is not registered: {connector_id}")

        config = self.integrations.get_integration(user_id, connector_id)
        if config is None:
            config = self.integrations.create_integration(
                user_id=user_id,
                connector_id=connector_id,
                sync_direction=sync_direction,
                sync_frequency=sync_frequency,
                settings=settings or {},
            )
        else:
            config.settings.update(settings or {})
            config.sync_direction = sync_direction
            config.sync_frequency = sync_frequency

        config = await self.connector_engine.activate_integration(
            user_id,
            connector_id,
            config,
            consent_scopes,
            consent_text,
        )
        self._record("connection.prepared", config, scopes=list(consent_scopes))
        return config

    def complete_connection(self, user_id: str, connector_id: str) -> IntegrationConfig:
        """Mark a prepared connection active after authentication succeeds."""
        config = self.integrations.get_integration(user_id, connector_id)
        if config is None:
            raise ValueError(f"Integration not found: {user_id}/{connector_id}")
        token = self.oauth.get_valid_token(user_id, connector_id)
        manifest = self.connector_engine.get_connector_manifest(connector_id)
        auth_type = getattr(getattr(manifest, "auth_type", None), "value", "") if manifest else ""
        if "oauth" in auth_type.lower() and token is None:
            raise PermissionError("A valid OAuth token is required to complete this connection")
        self.integrations.mark_connected(user_id, connector_id)
        config.status = ConnectorStatus.CONNECTED
        self._record("connection.connected", config)
        return config

    async def test_connection(self, user_id: str, connector_id: str) -> bool:
        """Run the connector's native health probe and update connection state."""
        config = self.integrations.get_integration(user_id, connector_id)
        if config is None:
            raise ValueError(f"Integration not found: {user_id}/{connector_id}")
        connector = self.connector_engine.create_connector(connector_id, config)
        try:
            healthy = bool(await connector.test_connection())
        except Exception as exc:
            self.integrations.mark_error(user_id, connector_id, str(exc))
            self._record("connection.health_failed", config, error=str(exc))
            return False
        if healthy:
            self.integrations.mark_connected(user_id, connector_id)
            config.status = ConnectorStatus.CONNECTED
            self._record("connection.health_passed", config)
        else:
            self.integrations.mark_error(user_id, connector_id, "Connector health probe failed")
            self._record("connection.health_failed", config, error="probe_returned_false")
        return healthy

    async def synchronize(
        self,
        user_id: str,
        connector_id: str,
        *,
        resource_types: Optional[List[str]] = None,
        priority: int = 5,
        force_full: bool = False,
    ) -> SyncJob:
        """Schedule and execute sync using the canonical Sync Manager."""
        config = self.integrations.get_integration(user_id, connector_id)
        if config is None:
            raise ValueError(f"Integration not found: {user_id}/{connector_id}")
        if config.status != ConnectorStatus.CONNECTED:
            raise RuntimeError(f"Integration is not connected: {config.status.value}")
        job = self.sync.schedule_sync(
            config,
            resource_types=resource_types,
            priority=priority,
            force_full=force_full,
        )
        result = await self.sync.execute_sync(job)
        self.integrations.record_sync(result)
        self._record(
            "connection.sync_completed" if result.status == "completed" else "connection.sync_failed",
            config,
            job_id=result.job_id,
            records_synced=result.records_synced,
            error=result.error,
        )
        return result

    def register_webhook(
        self,
        user_id: str,
        connector_id: str,
        endpoint_url: str,
        events: List[WebhookEvent],
        *,
        secret: Optional[str] = None,
    ) -> WebhookRegistration:
        """Register a webhook bound to an existing connection."""
        config = self.integrations.get_integration(user_id, connector_id)
        if config is None:
            raise ValueError(f"Integration not found: {user_id}/{connector_id}")
        registration = self.webhooks.register_webhook(
            user_id,
            connector_id,
            config.integration_id,
            endpoint_url,
            events,
            secret,
        )
        self.secrets.put_secret(
            self.tenant_id,
            user_id,
            connector_id,
            f"webhook.{registration.webhook_id}.secret",
            registration.secret,
            metadata={"kind": "webhook_hmac"},
            actor_id=user_id,
        )
        self._record("connection.webhook_registered", config, webhook_id=registration.webhook_id)
        return registration

    async def disconnect(
        self,
        user_id: str,
        connector_id: str,
        *,
        revoke_remote_token: bool = True,
    ) -> bool:
        """Revoke credentials and atomically clean all connection resources."""
        config = self.integrations.get_integration(user_id, connector_id)
        if config is None:
            return False

        if revoke_remote_token:
            try:
                await self.oauth.revoke_token(user_id, connector_id)
            except Exception as exc:
                logger.warning("Remote token revocation failed for %s: %s", connector_id, exc)

        for registration in list(self.webhooks.list_user_webhooks(user_id)):
            if registration.connector_id == connector_id:
                self.webhooks.unregister_webhook(registration.webhook_id)

        self.secrets.delete_connector_secrets(
            self.tenant_id,
            user_id,
            connector_id,
            actor_id=user_id,
        )
        await self.connector_engine.deactivate_integration(user_id, connector_id)
        self.integrations.set_status(user_id, connector_id, ConnectorStatus.DISCONNECTED)
        config.status = ConnectorStatus.DISCONNECTED
        self._record("connection.disconnected", config)
        return True

    def get_connection(self, user_id: str, connector_id: str) -> Optional[IntegrationConfig]:
        return self.integrations.get_integration(user_id, connector_id)

    def list_connections(self, user_id: str) -> List[IntegrationConfig]:
        return self.integrations.list_user_integrations(user_id)

    def get_audit_log(
        self,
        *,
        user_id: Optional[str] = None,
        connector_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        entries = self._events
        if user_id:
            entries = [entry for entry in entries if entry["user_id"] == user_id]
        if connector_id:
            entries = [entry for entry in entries if entry["connector_id"] == connector_id]
        return [entry.copy() for entry in entries]

    def health_check(self) -> Dict[str, Any]:
        connected = 0
        disconnected = 0
        for config in self.integrations._integrations.values():
            if config.status == ConnectorStatus.CONNECTED:
                connected += 1
            elif config.status == ConnectorStatus.DISCONNECTED:
                disconnected += 1
        return {
            "status": "healthy",
            "framework": "lifeos-integration-framework",
            "connected": connected,
            "disconnected": disconnected,
            "registered_connectors": len(self.connector_engine.get_registered_connectors()),
            "webhooks": self.webhooks.get_stats(),
            "sync": self.sync.get_stats(),
        }
