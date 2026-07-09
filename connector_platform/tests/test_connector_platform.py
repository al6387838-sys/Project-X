"""
Automated Test Suite — Universal Connector Platform
Sprint 025

Tests:
  - ConnectorEngine: registration, instantiation, lifecycle
  - OAuthManager: token flow, refresh, revocation, PKCE
  - SyncManager: job scheduling, delta sync, conflict resolution
  - WebhookManager: subscription, delivery, HMAC validation
  - PermissionManager: grant, revoke, Zero Trust checks
  - IntegrationManager: full integration lifecycle
  - ConnectorRegistry: registration, search, filtering
  - ConnectorMarketplace: browse, install, review
  - IntegrationMonitor: metrics, alerts, health checks
  - Individual connectors: Google Calendar, Microsoft Outlook
  - Security: encryption, consent, permission boundaries
  - End-to-End: simultaneous Google + Microsoft sync
"""

import asyncio
import sys
import os
import time
import traceback
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

# ─────────────────────────────────────────────
# Test Framework (lightweight, no external deps)
# ─────────────────────────────────────────────

class TestResult:
    def __init__(self, name: str, passed: bool, duration_ms: float,
                 error: str = None, details: str = None):
        self.name = name
        self.passed = passed
        self.duration_ms = duration_ms
        self.error = error
        self.details = details

    def __str__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        line = f"  {status} [{self.duration_ms:.1f}ms] {self.name}"
        if self.error:
            line += f"\n         ERROR: {self.error}"
        return line


class TestSuite:
    def __init__(self, name: str):
        self.name = name
        self.results: List[TestResult] = []

    def run(self, test_name: str, test_fn, *args, **kwargs) -> TestResult:
        start = time.monotonic()
        try:
            if asyncio.iscoroutinefunction(test_fn):
                asyncio.get_event_loop().run_until_complete(test_fn(*args, **kwargs))
            else:
                test_fn(*args, **kwargs)
            duration = (time.monotonic() - start) * 1000
            result = TestResult(test_name, True, duration)
        except AssertionError as e:
            duration = (time.monotonic() - start) * 1000
            result = TestResult(test_name, False, duration, error=str(e))
        except Exception as e:
            duration = (time.monotonic() - start) * 1000
            result = TestResult(test_name, False, duration, error=f"{type(e).__name__}: {e}")
        self.results.append(result)
        return result

    def summary(self) -> Tuple[int, int]:
        passed = sum(1 for r in self.results if r.passed)
        return passed, len(self.results)


def assert_equal(a, b, msg=""):
    assert a == b, f"{msg} Expected {b!r}, got {a!r}"

def assert_true(val, msg=""):
    assert val, f"{msg} Expected truthy, got {val!r}"

def assert_false(val, msg=""):
    assert not val, f"{msg} Expected falsy, got {val!r}"

def assert_not_none(val, msg=""):
    assert val is not None, f"{msg} Expected non-None"

def assert_in(item, container, msg=""):
    assert item in container, f"{msg} {item!r} not in {container!r}"

def assert_greater(a, b, msg=""):
    assert a > b, f"{msg} Expected {a} > {b}"

def assert_isinstance(obj, cls, msg=""):
    assert isinstance(obj, cls), f"{msg} Expected {cls.__name__}, got {type(obj).__name__}"


# ─────────────────────────────────────────────
# Import Platform Modules
# ─────────────────────────────────────────────

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from connector_platform.models.connector_models import (
    AuthType, ConnectorCategory, ConnectorManifest, ConnectorStatus,
    IntegrationConfig, OAuthToken, SyncDirection, SyncFrequency, SyncJob,
    IntegrationHealth, WebhookEvent, PermissionScope,
)
from connector_platform.core.connector_engine import ConnectorEngine, CredentialVault
from connector_platform.engines.oauth_manager import OAuthManager, PKCEHelper
from connector_platform.engines.sync_manager import SyncManager
from connector_platform.engines.webhook_manager import WebhookManager
from connector_platform.engines.integration_manager import IntegrationManager
from connector_platform.security.permission_manager import PermissionManager
from connector_platform.registry.connector_registry import ConnectorRegistry
from connector_platform.marketplace.connector_marketplace import ConnectorMarketplace
from connector_platform.monitoring.integration_monitor import IntegrationMonitor, AlertSeverity
from connector_platform.connectors.google.google_connectors import (
    GoogleCalendarConnector, GoogleDriveConnector, GmailConnector,
    GoogleTasksConnector, GoogleMeetConnector, GOOGLE_CONNECTORS,
)
from connector_platform.connectors.microsoft.microsoft_connectors import (
    MicrosoftOutlookConnector, Microsoft365Connector,
    MicrosoftTeamsConnector, OneDriveConnector, MICROSOFT_CONNECTORS,
)
from connector_platform.connectors.apple.apple_connectors import (
    AppleCalendarConnector, AppleHealthConnector, AppleRemindersConnector,
    APPLE_CONNECTORS,
)
from connector_platform.connectors.productivity.productivity_connectors import (
    NotionConnector, SlackConnector, DiscordConnector,
    GitHubConnector, GitLabConnector, ZoomConnector, DropboxConnector,
    PRODUCTIVITY_CONNECTORS,
)
from connector_platform.connectors.future.future_connectors_architecture import (
    OpenFinanceBrazilConnector, OuraConnector, GarminConnector,
    FitbitConnector, SamsungHealthConnector, FHIRHealthcareConnector,
    SalesforceConnector, TotvsConnector, FUTURE_CONNECTORS,
)


# ─────────────────────────────────────────────
# Test Suite 1: Models
# ─────────────────────────────────────────────

def test_models():
    suite = TestSuite("Models")

    def test_oauth_token():
        token = OAuthToken(
            user_id="user_1",
            connector_id="google_calendar",
            access_token="at_test",
            refresh_token="rt_test",
            token_type="Bearer",
            expires_at=datetime.utcnow() + timedelta(hours=1),
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        assert_equal(token.user_id, "user_1")
        assert_equal(token.connector_id, "google_calendar")
        # Token not expired (expires in 1 hour)
        assert_true(token.expires_at > datetime.utcnow())

    def test_expired_token():
        token = OAuthToken(
            user_id="user_1",
            connector_id="test",
            access_token="at_expired",
            refresh_token=None,
            token_type="Bearer",
            expires_at=datetime.utcnow() - timedelta(hours=1),
            scopes=[],
        )
        assert_true(token.expires_at < datetime.utcnow())

    def test_sync_job():
        job = SyncJob(
            job_id="job_001",
            integration_id="int_001",
            connector_id="google_calendar",
            user_id="user_1",
        )
        assert_equal(job.status, "pending")
        assert_not_none(job.job_id)

    def test_integration_config():
        config = IntegrationConfig(
            integration_id="int_001",
            user_id="user_1",
            connector_id="google_calendar",
            sync_direction=SyncDirection.BIDIRECTIONAL,
            sync_frequency=SyncFrequency.EVERY_15_MINUTES,
        )
        assert_not_none(config.integration_id)
        assert_equal(config.health, IntegrationHealth.UNKNOWN)

    suite.run("OAuthToken creation and expiry", test_oauth_token)
    suite.run("Expired token detection", test_expired_token)
    suite.run("SyncJob creation", test_sync_job)
    suite.run("IntegrationConfig creation", test_integration_config)
    return suite


# ─────────────────────────────────────────────
# Test Suite 2: Connector Registry
# ─────────────────────────────────────────────

def test_registry():
    suite = TestSuite("ConnectorRegistry")

    def test_register_single():
        registry = ConnectorRegistry()
        registry.register(GoogleCalendarConnector)
        assert_true(registry.exists("google_calendar"))
        assert_not_none(registry.get("google_calendar"))

    def test_register_many():
        registry = ConnectorRegistry()
        count = registry.register_many(GOOGLE_CONNECTORS + MICROSOFT_CONNECTORS)
        assert_greater(count, 0)
        assert_true(registry.exists("google_calendar"))
        assert_true(registry.exists("microsoft_outlook"))

    def test_filter_by_category():
        registry = ConnectorRegistry()
        registry.register_many(GOOGLE_CONNECTORS + MICROSOFT_CONNECTORS + APPLE_CONNECTORS)
        calendars = registry.by_category(ConnectorCategory.CALENDAR)
        ids = [m.connector_id for m in calendars]
        assert_in("google_calendar", ids)
        assert_in("microsoft_outlook", ids)
        assert_in("apple_calendar", ids)

    def test_search():
        registry = ConnectorRegistry()
        registry.register_many(GOOGLE_CONNECTORS + PRODUCTIVITY_CONNECTORS)
        results = registry.search("github")
        ids = [m.connector_id for m in results]
        assert_in("github", ids)

    def test_unregister():
        registry = ConnectorRegistry()
        registry.register(GoogleCalendarConnector)
        assert_true(registry.exists("google_calendar"))
        registry.unregister("google_calendar")
        assert_false(registry.exists("google_calendar"))

    def test_stats():
        registry = ConnectorRegistry()
        all_connectors = (GOOGLE_CONNECTORS + MICROSOFT_CONNECTORS +
                         APPLE_CONNECTORS + PRODUCTIVITY_CONNECTORS + FUTURE_CONNECTORS)
        registry.register_many(all_connectors)
        stats = registry.get_stats()
        assert_greater(stats["total_connectors"], 15)

    suite.run("Register single connector", test_register_single)
    suite.run("Register many connectors", test_register_many)
    suite.run("Filter by category", test_filter_by_category)
    suite.run("Search connectors", test_search)
    suite.run("Unregister connector", test_unregister)
    suite.run("Registry statistics", test_stats)
    return suite


# ─────────────────────────────────────────────
# Test Suite 3: Connector Manifests
# ─────────────────────────────────────────────

def test_manifests():
    suite = TestSuite("ConnectorManifests")

    def test_google_calendar_manifest():
        m = GoogleCalendarConnector.manifest
        assert_equal(m.connector_id, "google_calendar")
        assert_equal(m.provider, "Google")
        assert_equal(m.auth_type, AuthType.OAUTH2)
        assert_true(m.is_verified)
        assert_true(m.is_official)
        assert_greater(len(m.capabilities), 3)

    def test_microsoft_outlook_manifest():
        m = MicrosoftOutlookConnector.manifest
        assert_equal(m.connector_id, "microsoft_outlook")
        assert_equal(m.provider, "Microsoft")
        assert_in(SyncDirection.BIDIRECTIONAL, m.supported_sync_directions)

    def test_all_manifests_have_required_fields():
        all_connectors = (GOOGLE_CONNECTORS + MICROSOFT_CONNECTORS +
                         APPLE_CONNECTORS + PRODUCTIVITY_CONNECTORS)
        for cls in all_connectors:
            m = cls.manifest
            assert_not_none(m.connector_id, f"{cls.__name__} missing connector_id")
            assert_not_none(m.name, f"{cls.__name__} missing name")
            assert_not_none(m.provider, f"{cls.__name__} missing provider")
            assert_not_none(m.description, f"{cls.__name__} missing description")

    def test_future_connectors_architecture():
        for cls in FUTURE_CONNECTORS:
            m = cls.manifest
            assert_not_none(m.connector_id)
            assert_equal(m.is_beta, True)
            assert_in("status", m.metadata)

    suite.run("Google Calendar manifest", test_google_calendar_manifest)
    suite.run("Microsoft Outlook manifest", test_microsoft_outlook_manifest)
    suite.run("All manifests have required fields", test_all_manifests_have_required_fields)
    suite.run("Future connectors architecture", test_future_connectors_architecture)
    return suite


# ─────────────────────────────────────────────
# Test Suite 4: OAuth Manager
# ─────────────────────────────────────────────

def test_oauth():
    suite = TestSuite("OAuthManager")

    def test_generate_pkce():
        pair = PKCEHelper.generate_pair()
        assert_in("verifier", pair)
        assert_in("challenge", pair)
        assert_true(len(pair["verifier"]) >= 43)
        assert_true(len(pair["challenge"]) >= 43)
        assert_true(pair["verifier"] != pair["challenge"])

    def test_generate_state():
        oauth = OAuthManager()
        state1 = oauth._state_manager.create_state("user_1", "google_calendar")
        state2 = oauth._state_manager.create_state("user_1", "google_calendar")
        assert_true(len(state1) >= 32)
        assert_true(state1 != state2)

    def test_store_and_retrieve_token():
        oauth = OAuthManager()
        token = OAuthToken(
            user_id="user_1",
            connector_id="google_calendar",
            access_token="at_test_123",
            refresh_token="rt_test_456",
            token_type="Bearer",
            expires_at=datetime.utcnow() + timedelta(hours=1),
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        oauth._token_store.save(token)
        retrieved = oauth._token_store.get("user_1", "google_calendar")
        assert_not_none(retrieved)
        assert_equal(retrieved.access_token, "at_test_123")

    def test_token_expiry_detection():
        oauth = OAuthManager()
        token = OAuthToken(
            user_id="user_2",
            connector_id="test",
            access_token="at_expired",
            refresh_token="rt_test",
            token_type="Bearer",
            expires_at=datetime.utcnow() - timedelta(minutes=1),
            scopes=[],
        )
        assert_true(oauth._token_store.is_expired(token))

    async def test_revoke_token():
        oauth = OAuthManager()
        token = OAuthToken(
            user_id="user_3",
            connector_id="google_calendar",
            access_token="at_to_revoke",
            refresh_token=None,
            token_type="Bearer",
            expires_at=datetime.utcnow() + timedelta(hours=1),
            scopes=[],
        )
        oauth._token_store.save(token)
        result = await oauth.revoke_token("user_3", "google_calendar")
        assert_true(result)
        retrieved = oauth._token_store.get("user_3", "google_calendar")
        assert_true(retrieved is None)

    def test_get_provider_config():
        oauth = OAuthManager()
        google_config = oauth.get_provider_config("google_calendar")
        assert_in("auth_url", google_config)
        assert_in("token_url", google_config)
        ms_config = oauth.get_provider_config("microsoft_outlook")
        assert_in("auth_url", ms_config)

    suite.run("Generate PKCE pair", test_generate_pkce)
    suite.run("Generate state token", test_generate_state)
    suite.run("Store and retrieve token", test_store_and_retrieve_token)
    suite.run("Token expiry detection", test_token_expiry_detection)
    suite.run("Revoke token", test_revoke_token)
    suite.run("Get provider config (Google + Microsoft)", test_get_provider_config)
    return suite


# ─────────────────────────────────────────────
# Test Suite 5: Connector Authentication
# ─────────────────────────────────────────────

def test_authentication():
    suite = TestSuite("ConnectorAuthentication")

    async def test_google_calendar_auth():
        connector = GoogleCalendarConnector()
        token = await connector.authenticate({
            "user_id": "user_1",
            "access_token": "goog_at_test",
            "refresh_token": "goog_rt_test",
        })
        assert_equal(token.connector_id, "google_calendar")
        assert_equal(token.access_token, "goog_at_test")
        assert_not_none(token.expires_at)

    async def test_microsoft_outlook_auth():
        connector = MicrosoftOutlookConnector()
        token = await connector.authenticate({
            "user_id": "user_1",
            "access_token": "ms_at_test",
            "refresh_token": "ms_rt_test",
        })
        assert_equal(token.connector_id, "microsoft_outlook")
        assert_equal(token.token_type, "Bearer")

    async def test_apple_calendar_auth():
        connector = AppleCalendarConnector()
        token = await connector.authenticate({
            "user_id": "user_1",
            "app_specific_password": "apple_asp_test",
        })
        assert_equal(token.connector_id, "apple_calendar")
        assert_equal(token.token_type, "BasicAuth")
        assert_true(token.expires_at is None)  # Basic auth doesn't expire

    async def test_github_auth():
        connector = GitHubConnector()
        token = await connector.authenticate({
            "user_id": "user_1",
            "access_token": "gh_pat_test",
        })
        assert_equal(token.connector_id, "github")
        assert_true(token.expires_at is None)  # PAT doesn't expire

    async def test_connection_test():
        for cls in [GoogleCalendarConnector, MicrosoftOutlookConnector,
                    NotionConnector, SlackConnector, GitHubConnector]:
            connector = cls()
            result = await connector.test_connection()
            assert_true(result, f"{cls.__name__} test_connection failed")

    suite.run("Google Calendar authentication", test_google_calendar_auth)
    suite.run("Microsoft Outlook authentication", test_microsoft_outlook_auth)
    suite.run("Apple Calendar authentication", test_apple_calendar_auth)
    suite.run("GitHub authentication", test_github_auth)
    suite.run("Connection tests for all major connectors", test_connection_test)
    return suite


# ─────────────────────────────────────────────
# Test Suite 6: Sync Manager
# ─────────────────────────────────────────────

def test_sync():
    suite = TestSuite("SyncManager")

    def test_schedule_job():
        sync_mgr = SyncManager()
        config = IntegrationConfig(
            integration_id="int_001",
            user_id="user_1",
            connector_id="google_calendar",
        )
        job = sync_mgr.schedule_sync(config)
        assert_not_none(job.job_id)
        assert_in(job.status, ["pending", "queued"])

    async def test_execute_google_sync():
        connector = GoogleCalendarConnector()
        job = SyncJob(
            job_id="test_job_001",
            integration_id="int_001",
            connector_id="google_calendar",
            user_id="user_1",
        )
        result = await connector.sync(job)
        assert_equal(result.status, "completed")
        assert_greater(result.records_synced, 0)
        assert_not_none(result.delta_token)

    async def test_execute_microsoft_sync():
        connector = MicrosoftOutlookConnector()
        job = SyncJob(
            job_id="test_job_002",
            integration_id="int_002",
            connector_id="microsoft_outlook",
            user_id="user_1",
        )
        result = await connector.sync(job)
        assert_equal(result.status, "completed")
        assert_greater(result.records_synced, 0)

    async def test_delta_sync():
        connector = GoogleCalendarConnector()
        job = SyncJob(
            job_id="test_delta_001",
            integration_id="int_001",
            connector_id="google_calendar",
            user_id="user_1",
            delta_token="existing_delta_token",
        )
        result = await connector.sync(job)
        assert_equal(result.status, "completed")
        assert_greater(result.records_synced, 0)

    def test_sync_stats():
        sync_mgr = SyncManager()
        stats = sync_mgr.get_stats()
        assert_in("queue_size", stats)
        assert_in("total_syncs", stats)
        assert_in("successful_syncs", stats)

    suite.run("Schedule sync job", test_schedule_job)
    suite.run("Execute Google Calendar sync", test_execute_google_sync)
    suite.run("Execute Microsoft Outlook sync", test_execute_microsoft_sync)
    suite.run("Delta sync (incremental)", test_delta_sync)
    suite.run("Sync manager statistics", test_sync_stats)
    return suite


# ─────────────────────────────────────────────
# Test Suite 7: Webhook Manager
# ─────────────────────────────────────────────

def test_webhooks():
    suite = TestSuite("WebhookManager")

    def test_register_webhook():
        wh_mgr = WebhookManager()
        sub = wh_mgr.register_webhook(
            integration_id="int_001",
            connector_id="google_calendar",
            user_id="user_1",
            events=[WebhookEvent.CREATED, WebhookEvent.UPDATED, WebhookEvent.DELETED],
            endpoint_url="https://lifeos.app/webhooks/google_calendar",
        )
        assert_not_none(sub.webhook_id)
        assert_equal(sub.connector_id, "google_calendar")
        assert_true(sub.is_active)

    def test_hmac_validation():
        import hmac as hmac_lib
        import hashlib
        wh_mgr = WebhookManager()
        sub = wh_mgr.register_webhook(
            integration_id="int_001",
            connector_id="google_calendar",
            user_id="user_1",
            events=[WebhookEvent.CREATED],
            endpoint_url="https://lifeos.app/webhooks/test",
            secret="test_webhook_secret",
        )
        payload = b'{"event": "created", "data": {"id": "evt_123"}}'
        # Generate valid signature using the stored secret
        expected = hmac_lib.new(
            sub.secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        valid_sig = f"sha256={expected}"
        result = wh_mgr.validate_inbound(
            connector_id="google_calendar",
            webhook_id=sub.webhook_id,
            payload_body=payload,
            signature_header=valid_sig,
        )
        assert_true(result)
        # Invalid signature should fail
        result_invalid = wh_mgr.validate_inbound(
            connector_id="google_calendar",
            webhook_id=sub.webhook_id,
            payload_body=payload,
            signature_header="sha256=invalidsignature",
        )
        assert_false(result_invalid)

    async def test_process_event():
        from connector_platform.engines.webhook_manager import WebhookPayload
        wh_mgr = WebhookManager()
        wh_mgr.register_webhook(
            integration_id="int_001",
            connector_id="google_calendar",
            user_id="user_1",
            events=[WebhookEvent.CREATED],
            endpoint_url="https://lifeos.app/webhooks/test",
        )
        payload = WebhookPayload(
            event=WebhookEvent.CREATED,
            connector_id="google_calendar",
            user_id="user_1",
            resource_type="calendar_event",
            resource_id="evt_new",
            data={"id": "evt_new", "summary": "New Event"},
        )
        delivery_ids = await wh_mgr.process_event(payload)
        assert_not_none(delivery_ids)

    def test_webhook_stats():
        wh_mgr = WebhookManager()
        stats = wh_mgr.get_stats()
        assert_in("active_webhooks", stats)
        assert_in("total_deliveries", stats)

    suite.run("Register webhook subscription", test_register_webhook)
    suite.run("HMAC signature validation", test_hmac_validation)
    suite.run("Process incoming event", test_process_event)
    suite.run("Webhook manager statistics", test_webhook_stats)
    return suite


# ─────────────────────────────────────────────
# Test Suite 8: Permission Manager
# ─────────────────────────────────────────────

def test_permissions():
    suite = TestSuite("PermissionManager")

    def test_grant_consent():
        perm_mgr = PermissionManager()
        record = perm_mgr.grant_consent(
            user_id="user_1",
            connector_id="google_calendar",
            scopes=["calendar:read"],
            consent_text="I agree to share my Google Calendar data with LifeOS.",
        )
        assert_not_none(record)
        assert_equal(record.user_id, "user_1")

    def test_check_permission():
        perm_mgr = PermissionManager()
        perm_mgr.grant_consent(
            "user_1", "google_calendar",
            ["calendar:read"],
            "I agree to share my Google Calendar data.",
        )
        assert_true(perm_mgr.has_permission("user_1", "google_calendar", "calendar", PermissionScope.READ))
        assert_false(perm_mgr.has_permission("user_1", "google_calendar", "calendar", PermissionScope.WRITE))

    def test_revoke_consent():
        perm_mgr = PermissionManager()
        perm_mgr.grant_consent(
            "user_1", "google_calendar",
            ["calendar:read"],
            "I agree.",
        )
        perm_mgr.revoke_consent("user_1", "google_calendar")
        assert_false(perm_mgr.has_permission("user_1", "google_calendar", "calendar", PermissionScope.READ))

    def test_zero_trust_default_deny():
        perm_mgr = PermissionManager()
        # Without explicit grant, access should be denied (Zero Trust)
        assert_false(perm_mgr.has_permission("new_user", "google_calendar", "calendar", PermissionScope.WRITE))

    def test_list_permissions():
        perm_mgr = PermissionManager()
        perm_mgr.grant_consent(
            "user_1", "google_calendar",
            ["calendar:read", "calendar:write"],
            "I agree to share my Google Calendar data.",
        )
        perms = perm_mgr.get_active_permissions("user_1", "google_calendar")
        assert_greater(len(perms), 0)

    suite.run("Grant consent", test_grant_consent)
    suite.run("Check permission", test_check_permission)
    suite.run("Revoke consent", test_revoke_consent)
    suite.run("Zero Trust: deny by default", test_zero_trust_default_deny)
    suite.run("List active permissions", test_list_permissions)
    return suite


# ─────────────────────────────────────────────
# Test Suite 9: Marketplace
# ─────────────────────────────────────────────

def test_marketplace():
    suite = TestSuite("ConnectorMarketplace")

    def make_registry_and_marketplace():
        registry = ConnectorRegistry()
        all_connectors = (GOOGLE_CONNECTORS + MICROSOFT_CONNECTORS +
                         APPLE_CONNECTORS + PRODUCTIVITY_CONNECTORS + FUTURE_CONNECTORS)
        registry.register_many(all_connectors)
        marketplace = ConnectorMarketplace(registry)
        return registry, marketplace

    def test_marketplace_init():
        _, marketplace = make_registry_and_marketplace()
        stats = marketplace.get_stats()
        assert_greater(stats["total_connectors"], 15)
        assert_greater(stats["total_bundles"], 5)

    def test_get_featured():
        _, marketplace = make_registry_and_marketplace()
        featured = marketplace.get_featured()
        assert_greater(len(featured), 0)

    def test_install_connector():
        _, marketplace = make_registry_and_marketplace()
        result = marketplace.install("user_1", "google_calendar")
        assert_true(result)
        assert_true(marketplace.is_installed("user_1", "google_calendar"))

    def test_install_bundle():
        _, marketplace = make_registry_and_marketplace()
        installed = marketplace.install_bundle("user_1", "google_workspace")
        assert_greater(len(installed), 0)

    def test_uninstall():
        _, marketplace = make_registry_and_marketplace()
        marketplace.install("user_1", "notion")
        assert_true(marketplace.is_installed("user_1", "notion"))
        marketplace.uninstall("user_1", "notion")
        assert_false(marketplace.is_installed("user_1", "notion"))

    def test_search():
        _, marketplace = make_registry_and_marketplace()
        results = marketplace.search("calendar")
        assert_greater(len(results), 0)

    def test_add_review():
        _, marketplace = make_registry_and_marketplace()
        review = marketplace.add_review("user_1", "google_calendar", 5, "Excellent integration!")
        assert_not_none(review)
        assert_equal(review.rating, 5)

    def test_get_catalog():
        _, marketplace = make_registry_and_marketplace()
        catalog = marketplace.get_catalog()
        assert_in("total_connectors", catalog)
        assert_in("featured", catalog)
        assert_in("bundles", catalog)
        assert_in("categories", catalog)

    suite.run("Marketplace initialization", test_marketplace_init)
    suite.run("Get featured connectors", test_get_featured)
    suite.run("Install connector", test_install_connector)
    suite.run("Install bundle", test_install_bundle)
    suite.run("Uninstall connector", test_uninstall)
    suite.run("Search marketplace", test_search)
    suite.run("Add review", test_add_review)
    suite.run("Get full catalog", test_get_catalog)
    return suite


# ─────────────────────────────────────────────
# Test Suite 10: Monitor
# ─────────────────────────────────────────────

def test_monitor():
    suite = TestSuite("IntegrationMonitor")

    def test_record_sync():
        monitor = IntegrationMonitor()
        monitor.record_sync("int_001", "google_calendar", True, 25, 320.5)
        metrics = monitor.get_connector_metrics("int_001")
        assert_equal(metrics["total_records_synced"], 25)
        assert_equal(metrics["error_count"], 0)

    def test_record_failure():
        monitor = IntegrationMonitor()
        for _ in range(6):
            monitor.record_sync("int_002", "test_connector", False, 0, 100.0)
        alerts = monitor.get_active_alerts()
        assert_greater(len(alerts), 0)

    def test_audit_log():
        monitor = IntegrationMonitor()
        monitor.audit("connector.connected", "user_1", "google_calendar",
                     {"scopes": ["calendar:read"]}, "192.168.1.1")
        log = monitor.get_audit_log(user_id="user_1")
        assert_greater(len(log), 0)
        assert_equal(log[-1].event_type, "connector.connected")

    def test_health_report():
        monitor = IntegrationMonitor()
        report = monitor.get_health_report()
        assert_in("overall_status", report)
        assert_in("active_alerts", report)

    def test_latency_percentiles():
        monitor = IntegrationMonitor()
        for i in range(100):
            monitor.record_api_call("google_calendar", "/events", 200, float(i * 10))
        percentiles = monitor.get_latency_percentiles("google_calendar")
        assert_in("p50_ms", percentiles)
        assert_in("p99_ms", percentiles)
        assert_greater(percentiles["p99_ms"], percentiles["p50_ms"])

    suite.run("Record sync metrics", test_record_sync)
    suite.run("Record failures and fire alerts", test_record_failure)
    suite.run("Audit log recording", test_audit_log)
    suite.run("Health report generation", test_health_report)
    suite.run("Latency percentiles", test_latency_percentiles)
    return suite


# ─────────────────────────────────────────────
# Test Suite 11: End-to-End — Google + Microsoft
# ─────────────────────────────────────────────

def test_e2e_dual_calendar():
    suite = TestSuite("E2E: Google Calendar + Microsoft Outlook Simultaneous")

    async def test_simultaneous_auth():
        """Both connectors authenticate simultaneously."""
        google = GoogleCalendarConnector()
        microsoft = MicrosoftOutlookConnector()

        google_token, ms_token = await asyncio.gather(
            google.authenticate({"user_id": "user_1", "access_token": "goog_at", "refresh_token": "goog_rt"}),
            microsoft.authenticate({"user_id": "user_1", "access_token": "ms_at", "refresh_token": "ms_rt"}),
        )
        assert_equal(google_token.connector_id, "google_calendar")
        assert_equal(ms_token.connector_id, "microsoft_outlook")
        assert_true(google_token.expires_at > datetime.utcnow())
        assert_true(ms_token.expires_at > datetime.utcnow())

    async def test_simultaneous_sync():
        """Both connectors sync simultaneously."""
        google = GoogleCalendarConnector()
        microsoft = MicrosoftOutlookConnector()

        google_job = SyncJob("g_job_001", "int_google", "google_calendar", "user_1")
        ms_job = SyncJob("ms_job_001", "int_microsoft", "microsoft_outlook", "user_1")

        start = time.monotonic()
        google_result, ms_result = await asyncio.gather(
            google.sync(google_job),
            microsoft.sync(ms_job),
        )
        duration = (time.monotonic() - start) * 1000

        assert_equal(google_result.status, "completed")
        assert_equal(ms_result.status, "completed")
        assert_greater(google_result.records_synced, 0)
        assert_greater(ms_result.records_synced, 0)
        assert_not_none(google_result.delta_token)
        assert_not_none(ms_result.delta_token)

        print(f"\n         Google Calendar: {google_result.records_synced} events synced")
        print(f"         Microsoft Outlook: {ms_result.records_synced} events synced")
        print(f"         Concurrent execution time: {duration:.1f}ms")

    async def test_event_creation_both():
        """Create events in both calendars."""
        google = GoogleCalendarConnector()
        microsoft = MicrosoftOutlookConnector()

        now = datetime.utcnow()
        event_data = {
            "summary": "LifeOS Test Event",
            "start": {"dateTime": now.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": (now + timedelta(hours=1)).isoformat(), "timeZone": "UTC"},
        }

        g_event, ms_event = await asyncio.gather(
            google.create_event(event_data),
            microsoft.create_event({"subject": "LifeOS Test Event", **event_data}),
        )
        assert_not_none(g_event.get("id"))
        assert_not_none(ms_event.get("id"))

    async def test_delta_sync_both():
        """Delta sync on both connectors after initial sync."""
        google = GoogleCalendarConnector()
        microsoft = MicrosoftOutlookConnector()

        # Full sync first
        g_full = SyncJob("g_full", "int_g", "google_calendar", "user_1")
        ms_full = SyncJob("ms_full", "int_ms", "microsoft_outlook", "user_1")
        g_full, ms_full = await asyncio.gather(google.sync(g_full), microsoft.sync(ms_full))

        # Delta sync using delta tokens from full sync
        g_delta = SyncJob("g_delta", "int_g", "google_calendar", "user_1",
                         delta_token=g_full.delta_token)
        ms_delta = SyncJob("ms_delta", "int_ms", "microsoft_outlook", "user_1",
                          delta_token=ms_full.delta_token)
        g_delta, ms_delta = await asyncio.gather(google.sync(g_delta), microsoft.sync(ms_delta))

        assert_equal(g_delta.status, "completed")
        assert_equal(ms_delta.status, "completed")

    async def test_free_busy_comparison():
        """Compare free/busy from Microsoft Outlook."""
        microsoft = MicrosoftOutlookConnector()
        now = datetime.utcnow()
        schedule = await microsoft.get_schedule(
            ["user@company.com"],
            now,
            now + timedelta(days=1),
        )
        assert_in("value", schedule)

    async def test_monitor_both_integrations():
        """Monitor both integrations simultaneously."""
        monitor = IntegrationMonitor()
        monitor.record_sync("int_google", "google_calendar", True, 15, 250.0)
        monitor.record_sync("int_microsoft", "microsoft_outlook", True, 18, 310.0)

        g_metrics = monitor.get_connector_metrics("int_google")
        ms_metrics = monitor.get_connector_metrics("int_microsoft")

        assert_equal(g_metrics["total_records_synced"], 15)
        assert_equal(ms_metrics["total_records_synced"], 18)
        assert_equal(g_metrics["error_count"], 0)
        assert_equal(ms_metrics["error_count"], 0)

    async def test_token_refresh_both():
        """Refresh tokens for both connectors."""
        google = GoogleCalendarConnector()
        microsoft = MicrosoftOutlookConnector()

        g_token = OAuthToken("user_1", "google_calendar", "old_g_at", "g_rt", "Bearer",
                            datetime.utcnow() + timedelta(hours=1), [])
        ms_token = OAuthToken("user_1", "microsoft_outlook", "old_ms_at", "ms_rt", "Bearer",
                             datetime.utcnow() + timedelta(hours=1), [])

        g_refreshed, ms_refreshed = await asyncio.gather(
            google.refresh_token(g_token),
            microsoft.refresh_token(ms_token),
        )
        assert_not_none(g_refreshed)
        assert_not_none(ms_refreshed)

    suite.run("Simultaneous OAuth authentication", test_simultaneous_auth)
    suite.run("Simultaneous calendar sync", test_simultaneous_sync)
    suite.run("Event creation in both calendars", test_event_creation_both)
    suite.run("Delta sync on both connectors", test_delta_sync_both)
    suite.run("Free/busy schedule comparison", test_free_busy_comparison)
    suite.run("Monitor both integrations simultaneously", test_monitor_both_integrations)
    suite.run("Token refresh for both connectors", test_token_refresh_both)
    return suite


# ─────────────────────────────────────────────
# Test Suite 12: Security
# ─────────────────────────────────────────────

def test_security():
    suite = TestSuite("Security")

    def test_credential_vault_store_retrieve():
        vault = CredentialVault()
        vault.store("key_test", "super_secret_token_12345")
        retrieved = vault.retrieve("key_test")
        assert_equal(retrieved, "super_secret_token_12345")
        assert_true(vault.exists("key_test"))

    def test_credential_vault_encrypted_storage():
        vault = CredentialVault()
        plaintext = "my_secret_api_key"
        vault.store("api_key", plaintext)
        # Internal storage should be encrypted (not plaintext)
        raw_stored = vault._store.get("api_key", "")
        assert_true(raw_stored.startswith("enc:v1:"))
        # But retrieval should return original
        assert_equal(vault.retrieve("api_key"), plaintext)

    def test_zero_trust_default_deny():
        perm_mgr = PermissionManager()
        # New user, no grants — should be denied
        assert_false(perm_mgr.has_permission("new_user", "google_calendar", "calendar", PermissionScope.WRITE))
        assert_false(perm_mgr.has_permission("new_user", "microsoft_outlook", "calendar", PermissionScope.READ))

    def test_scope_boundaries():
        perm_mgr = PermissionManager()
        perm_mgr.grant_consent(
            "user_1", "google_calendar",
            ["calendar:read"],
            "I agree to read-only access.",
        )
        # Read granted, write not granted
        assert_true(perm_mgr.has_permission("user_1", "google_calendar", "calendar", PermissionScope.READ))
        assert_false(perm_mgr.has_permission("user_1", "google_calendar", "calendar", PermissionScope.WRITE))

    def test_hmac_tamper_detection():
        import hmac as hmac_lib
        import hashlib
        wh_mgr = WebhookManager()
        sub = wh_mgr.register_webhook(
            integration_id="int_001",
            connector_id="google_calendar",
            user_id="user_1",
            events=[WebhookEvent.CREATED],
            endpoint_url="https://lifeos.app/webhooks/test",
        )
        payload = b'{"event": "created"}'
        # Generate valid signature
        valid_sig = "sha256=" + hmac_lib.new(
            sub.secret.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()
        # Tampered payload should fail
        tampered = b'{"event": "deleted"}'
        assert_false(wh_mgr.validate_inbound(
            "google_calendar", sub.webhook_id, tampered, valid_sig
        ))

    def test_token_isolation():
        """Tokens must be isolated per user."""
        oauth = OAuthManager()
        t1 = OAuthToken("user_A", "google_calendar", "token_A", None, "Bearer",
                       datetime.utcnow() + timedelta(hours=1), [])
        t2 = OAuthToken("user_B", "google_calendar", "token_B", None, "Bearer",
                       datetime.utcnow() + timedelta(hours=1), [])
        oauth._token_store.save(t1)
        oauth._token_store.save(t2)
        r1 = oauth._token_store.get("user_A", "google_calendar")
        r2 = oauth._token_store.get("user_B", "google_calendar")
        assert_equal(r1.access_token, "token_A")
        assert_equal(r2.access_token, "token_B")
        assert_true(r1.access_token != r2.access_token)

    suite.run("Credential vault store/retrieve", test_credential_vault_store_retrieve)
    suite.run("Credential vault encrypted storage", test_credential_vault_encrypted_storage)
    suite.run("Zero Trust: default deny", test_zero_trust_default_deny)
    suite.run("Scope boundary enforcement", test_scope_boundaries)
    suite.run("HMAC tamper detection", test_hmac_tamper_detection)
    suite.run("Token isolation per user", test_token_isolation)
    return suite


# ─────────────────────────────────────────────
# Test Runner
# ─────────────────────────────────────────────

def run_all_tests():
    print("\n" + "=" * 70)
    print("  UNIVERSAL CONNECTOR PLATFORM — AUTOMATED TEST SUITE")
    print("  Sprint 025 | LifeOS Project-X")
    print("=" * 70)

    suites = [
        ("Models", test_models),
        ("ConnectorRegistry", test_registry),
        ("ConnectorManifests", test_manifests),
        ("OAuthManager", test_oauth),
        ("ConnectorAuthentication", test_authentication),
        ("SyncManager", test_sync),
        ("WebhookManager", test_webhooks),
        ("PermissionManager", test_permissions),
        ("ConnectorMarketplace", test_marketplace),
        ("IntegrationMonitor", test_monitor),
        ("E2E: Google Calendar + Microsoft Outlook Simultaneous", test_e2e_dual_calendar),
        ("Security", test_security),
    ]

    total_passed = 0
    total_tests = 0
    all_suites = []

    for suite_name, suite_fn in suites:
        print(f"\n{'─' * 60}")
        print(f"  {suite_name}")
        print(f"{'─' * 60}")
        try:
            suite = suite_fn()
            for result in suite.results:
                print(result)
            passed, total = suite.summary()
            total_passed += passed
            total_tests += total
            all_suites.append((suite_name, passed, total))
            print(f"\n  Result: {passed}/{total} passed")
        except Exception as e:
            print(f"  ❌ SUITE ERROR: {e}")
            traceback.print_exc()

    print("\n" + "=" * 70)
    print("  FINAL RESULTS")
    print("=" * 70)
    for suite_name, passed, total in all_suites:
        status = "✅" if passed == total else "⚠️ " if passed > 0 else "❌"
        print(f"  {status} {suite_name}: {passed}/{total}")
    print(f"\n  TOTAL: {total_passed}/{total_tests} tests passed")
    success_rate = total_passed / max(total_tests, 1) * 100
    print(f"  SUCCESS RATE: {success_rate:.1f}%")
    print("=" * 70)

    return total_passed, total_tests


if __name__ == "__main__":
    passed, total = run_all_tests()
    sys.exit(0 if passed == total else 1)
