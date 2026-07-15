"""Phase 061 contract tests for the definitive LifeOS Integration Framework."""

import asyncio
from datetime import datetime, timedelta, timezone

from connector_platform import (
    ConnectionManager,
    IntegrationSDK,
    OAuthManager,
    SecretsManager,
)
from connector_platform.connectors.google.google_connectors import GoogleCalendarConnector
from connector_platform.models.connector_models import ConnectorStatus, WebhookEvent


def test_public_framework_surface():
    manager = ConnectionManager(tenant_id="enterprise")
    sdk = IntegrationSDK(manager)

    assert sdk.connections is manager
    assert sdk.secrets is manager.secrets
    assert sdk.oauth is manager.oauth
    assert sdk.webhooks is manager.webhooks
    assert sdk.sync_engine is manager.sync
    assert sdk.connector_engine is manager.connector_engine
    assert sdk.VERSION == "2.0.0"


def test_secrets_manager_isolation_rotation_expiration_and_audit():
    manager = SecretsManager(master_key="phase-061-deterministic-master-key")

    first = manager.put_secret("tenant-a", "user-a", "calendar", "api-key", "alpha")
    second = manager.rotate_secret("tenant-a", "user-a", "calendar", "api-key", "beta")
    manager.put_secret("tenant-a", "user-b", "calendar", "api-key", "isolated")
    manager.put_secret(
        "tenant-a",
        "user-a",
        "calendar",
        "expired",
        "unavailable",
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )

    assert first.version == 1
    assert second.version == 2
    assert manager.get_secret("tenant-a", "user-a", "calendar", "api-key") == "beta"
    assert manager.get_secret("tenant-a", "user-a", "calendar", "api-key", version=1) == "alpha"
    assert manager.get_secret("tenant-a", "user-b", "calendar", "api-key") == "isolated"
    assert manager.get_secret("tenant-a", "user-a", "calendar", "expired") is None
    assert {ref.name for ref in manager.list_metadata("tenant-a", "user-a", "calendar")} == {
        "api-key",
        "expired",
    }
    assert any(entry["action"] == "secret.expired" for entry in manager.get_audit_log())


def test_oauth_token_material_is_managed_by_secrets_manager():
    secrets = SecretsManager(master_key="phase-061-oauth-master-key")
    oauth = OAuthManager(secrets, tenant_id="enterprise")
    auth = oauth.get_authorization_url(
        "user-1",
        "google_calendar",
        ["calendar.readonly"],
        "https://lifeos.app/oauth/callback",
    )
    token = asyncio.run(oauth.exchange_code(
        "google_calendar",
        "authorization-code",
        auth["state"],
        "https://lifeos.app/oauth/callback",
    ))

    assert token.access_token.startswith("access_")
    assert secrets.exists("enterprise", "user-1", "google_calendar", "oauth.access_token")
    assert secrets.exists("enterprise", "user-1", "google_calendar", "oauth.refresh_token")
    assert oauth.get_valid_token("user-1", "google_calendar").access_token == token.access_token

    assert asyncio.run(oauth.revoke_token("user-1", "google_calendar")) is True
    assert not secrets.exists("enterprise", "user-1", "google_calendar", "oauth.access_token")
    assert oauth.get_valid_token("user-1", "google_calendar") is None


def test_integration_sdk_end_to_end_lifecycle():
    async def scenario():
        sdk = IntegrationSDK(tenant_id="enterprise")
        assert sdk.register_connector(GoogleCalendarConnector) is True

        config = await sdk.prepare_connection(
            "user-1",
            "google_calendar",
            ["calendar.readonly", "read"],
            "I consent to calendar synchronization in LifeOS.",
        )
        assert config.status != ConnectorStatus.CONNECTED

        auth = sdk.begin_oauth(
            "user-1",
            "google_calendar",
            ["calendar.readonly"],
            "https://lifeos.app/oauth/callback",
        )
        token = await sdk.complete_oauth(
            "google_calendar",
            "authorization-code",
            auth["state"],
            "https://lifeos.app/oauth/callback",
        )
        assert token.user_id == "user-1"
        assert sdk.connections.get_connection("user-1", "google_calendar").status == ConnectorStatus.CONNECTED

        secret_ref = sdk.store_secret("user-1", "google_calendar", "provider-key", "secret-value")
        assert secret_ref.version == 1
        assert sdk.get_secret("user-1", "google_calendar", "provider-key") == "secret-value"

        registration = sdk.register_webhook(
            "user-1",
            "google_calendar",
            "https://lifeos.app/webhooks/google-calendar",
            [WebhookEvent.CREATED, WebhookEvent.UPDATED],
        )
        assert registration.is_active is True
        assert sdk.secrets.exists(
            "enterprise",
            "user-1",
            "google_calendar",
            f"webhook.{registration.webhook_id}.secret",
        )

        assert await sdk.test_connection("user-1", "google_calendar") is True
        job = await sdk.sync("user-1", "google_calendar", resource_types=["events"])
        assert job.status == "completed"
        assert job.records_synced >= 0

        async def extension(value):
            return {"value": value, "framework": "phase061"}

        sdk.register_extension("calendar.normalize", extension)
        assert await sdk.invoke_extension("calendar.normalize", value=3) == {
            "value": 3,
            "framework": "phase061",
        }
        health = sdk.health_check()
        assert health["status"] == "healthy"
        assert health["connection_manager"]["connected"] == 1

        assert await sdk.disconnect("user-1", "google_calendar") is True
        disconnected = sdk.connections.get_connection("user-1", "google_calendar")
        assert disconnected.status == ConnectorStatus.DISCONNECTED
        assert sdk.oauth.get_valid_token("user-1", "google_calendar") is None
        assert sdk.secrets.list_metadata("enterprise", "user-1", "google_calendar") == []
        assert sdk.webhooks.get_webhook(registration.webhook_id) is None

    asyncio.run(scenario())
