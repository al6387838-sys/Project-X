"""Public SDK for all current and future LifeOS integrations."""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Type

from connector_platform.core.connector_engine import BaseConnector
from connector_platform.engines.connection_manager import ConnectionManager
from connector_platform.models.connector_models import (
    IntegrationConfig,
    OAuthConfig,
    OAuthToken,
    SyncDirection,
    SyncFrequency,
    SyncJob,
    WebhookEvent,
    WebhookRegistration,
)
from connector_platform.security.secrets_manager import SecretRef


class IntegrationSDK:
    """
    Stable application-facing API for the LifeOS Integration Framework.

    Product modules must depend on this façade instead of directly coupling to
    provider implementations. Managers remain accessible as read-only
    properties for diagnostics and advanced adapters.
    """

    VERSION = "2.0.0"

    def __init__(
        self,
        connection_manager: Optional[ConnectionManager] = None,
        *,
        tenant_id: str = "default",
    ):
        self.connections = connection_manager or ConnectionManager(tenant_id=tenant_id)
        self.tenant_id = self.connections.tenant_id
        self._extensions: Dict[str, Callable[..., Any]] = {}

    @property
    def oauth(self):
        return self.connections.oauth

    @property
    def secrets(self):
        return self.connections.secrets

    @property
    def webhooks(self):
        return self.connections.webhooks

    @property
    def sync_engine(self):
        return self.connections.sync

    @property
    def connector_engine(self):
        return self.connections.connector_engine

    def register_connector(self, connector_class: Type[BaseConnector]) -> bool:
        """Register a connector implementation and its manifest."""
        return self.connections.register_connector(connector_class)

    def register_oauth(self, connector_id: str, config: OAuthConfig) -> None:
        """Register OAuth provider configuration for a connector."""
        self.oauth.register_config(connector_id, config)

    def register_sync_handler(self, connector_id: str, handler: Callable) -> None:
        self.sync_engine.register_sync_handler(connector_id, handler)

    def register_transformer(
        self,
        connector_id: str,
        resource_type: str,
        inbound: Callable,
        outbound: Callable,
    ) -> None:
        self.sync_engine.register_transformer(connector_id, resource_type, inbound, outbound)

    def register_extension(self, name: str, handler: Callable[..., Any]) -> None:
        """Register a namespaced SDK extension without changing the core API."""
        if not name or "." not in name:
            raise ValueError("Extension names must be namespaced, e.g. 'finance.reconcile'")
        if name in self._extensions:
            raise ValueError(f"Extension already registered: {name}")
        self._extensions[name] = handler

    async def invoke_extension(self, name: str, **payload: Any) -> Any:
        handler = self._extensions.get(name)
        if handler is None:
            raise KeyError(f"Unknown Integration SDK extension: {name}")
        result = handler(**payload)
        if hasattr(result, "__await__"):
            return await result
        return result

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
        return await self.connections.prepare_connection(
            user_id,
            connector_id,
            consent_scopes,
            consent_text,
            settings=settings,
            sync_direction=sync_direction,
            sync_frequency=sync_frequency,
        )

    def begin_oauth(
        self,
        user_id: str,
        connector_id: str,
        scopes: List[str],
        redirect_uri: str,
        *,
        extra_params: Optional[Dict[str, str]] = None,
    ) -> Dict[str, str]:
        return self.oauth.get_authorization_url(
            user_id,
            connector_id,
            scopes,
            redirect_uri,
            extra_params,
        )

    async def complete_oauth(
        self,
        connector_id: str,
        code: str,
        state: str,
        redirect_uri: str,
    ) -> OAuthToken:
        token = await self.oauth.exchange_code(connector_id, code, state, redirect_uri)
        self.connections.complete_connection(token.user_id, connector_id)
        return token

    def store_secret(
        self,
        user_id: str,
        connector_id: str,
        name: str,
        value: str,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SecretRef:
        return self.secrets.put_secret(
            self.tenant_id,
            user_id,
            connector_id,
            name,
            value,
            metadata=metadata,
            actor_id=user_id,
        )

    def get_secret(self, user_id: str, connector_id: str, name: str) -> Optional[str]:
        return self.secrets.get_secret(
            self.tenant_id,
            user_id,
            connector_id,
            name,
            actor_id=user_id,
        )

    async def test_connection(self, user_id: str, connector_id: str) -> bool:
        return await self.connections.test_connection(user_id, connector_id)

    async def sync(
        self,
        user_id: str,
        connector_id: str,
        *,
        resource_types: Optional[List[str]] = None,
        priority: int = 5,
        force_full: bool = False,
    ) -> SyncJob:
        return await self.connections.synchronize(
            user_id,
            connector_id,
            resource_types=resource_types,
            priority=priority,
            force_full=force_full,
        )

    def register_webhook(
        self,
        user_id: str,
        connector_id: str,
        endpoint_url: str,
        events: List[WebhookEvent],
        *,
        secret: Optional[str] = None,
    ) -> WebhookRegistration:
        return self.connections.register_webhook(
            user_id,
            connector_id,
            endpoint_url,
            events,
            secret=secret,
        )

    async def execute(
        self,
        user_id: str,
        connector_id: str,
        operation: str,
        payload: Dict[str, Any],
        *,
        required_scope: str = "read",
    ) -> Dict[str, Any]:
        return await self.connector_engine.execute(
            user_id,
            connector_id,
            operation,
            payload,
            required_scope,
        )

    async def disconnect(
        self,
        user_id: str,
        connector_id: str,
        *,
        revoke_remote_token: bool = True,
    ) -> bool:
        return await self.connections.disconnect(
            user_id,
            connector_id,
            revoke_remote_token=revoke_remote_token,
        )

    def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "sdk_version": self.VERSION,
            "tenant_id": self.tenant_id,
            "connection_manager": self.connections.health_check(),
            "oauth": self.oauth.get_stats(),
            "webhooks": self.webhooks.get_stats(),
            "sync": self.sync_engine.get_stats(),
            "extensions": sorted(self._extensions),
        }
