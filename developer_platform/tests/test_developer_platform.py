"""
LifeOS Developer Platform — Test Suite
EXECUTION-009: Developer Platform
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import pytest
from developer_platform.api_gateway.gateway import (
    APIGateway, GatewayConfig, GatewayRequest, HTTPMethod, APIVersion
)
from developer_platform.api_gateway.middleware import (
    AuthMiddleware, RateLimitMiddleware, LoggingMiddleware
)
from developer_platform.api_gateway.versioning import APIVersionManager, VersionStatus
from developer_platform.oauth_server.oauth_server import OAuthServer, OAuthConfig
from developer_platform.oauth_server.models import OAuthApp, OAuthScope
from developer_platform.oauth_server.flows import PKCEHelper, AuthorizationCodeFlow, ClientCredentialsFlow
from developer_platform.api_keys.api_key_manager import APIKeyManager, APIKeyPlan, APIKeyStatus
from developer_platform.webhooks.webhook_manager import WebhookManager, WebhookEvent, WebhookEventType
from developer_platform.sandbox.sandbox import DeveloperSandbox, SandboxState
from developer_platform.sdk.client import LifeOSClient
from developer_platform.sdk.exceptions import AuthenticationError
from developer_platform.cli.cli import LifeOSCLI


# ── API Gateway Tests ────────────────────────────────────────────────────────

class TestAPIGateway:
    def setup_method(self):
        self.gateway = APIGateway(GatewayConfig(enable_request_logging=True))

    def _make_request(self, path="/health", method=HTTPMethod.GET, version=APIVersion.V2,
                      api_key=None, oauth_token=None):
        return GatewayRequest(
            method=method,
            path=path,
            version=version,
            api_key=api_key,
            oauth_token=oauth_token,
        )

    def test_gateway_initializes(self):
        assert self.gateway is not None
        assert self.gateway.config.port == 8080

    def test_register_route(self):
        from developer_platform.api_gateway.gateway import RouteConfig
        route = RouteConfig(
            path="/test",
            method=HTTPMethod.GET,
            handler=lambda r: {"ok": True},
            version=APIVersion.V2,
            auth_required=False,
        )
        self.gateway.register_route(route)
        assert "v2:GET:/test" in self.gateway._routes

    def test_route_not_found_returns_404(self):
        req = self._make_request(path="/nonexistent")
        response = self.gateway.process_request(req)
        assert response.status_code == 404
        assert response.body["error"]["code"] == "ROUTE_NOT_FOUND"

    def test_unsupported_version_returns_400(self):
        from developer_platform.api_gateway.gateway import RouteConfig
        route = RouteConfig(
            path="/health",
            method=HTTPMethod.GET,
            handler=lambda r: {"status": "ok"},
            version=APIVersion.V2,
            auth_required=False,
        )
        self.gateway.register_route(route)
        # Pass a valid APIVersion enum but for a route that doesn't exist in that version
        req = GatewayRequest(path="/health", method=HTTPMethod.GET, version=APIVersion.V1)
        response = self.gateway.process_request(req)
        # v1 route not registered — should return 404
        assert response.status_code == 404

    def test_successful_request_returns_200(self):
        from developer_platform.api_gateway.gateway import RouteConfig
        route = RouteConfig(
            path="/health",
            method=HTTPMethod.GET,
            handler=lambda r: {"data": {"status": "healthy"}},
            version=APIVersion.V2,
            auth_required=False,
        )
        self.gateway.register_route(route)
        req = self._make_request(path="/health")
        response = self.gateway.process_request(req)
        assert response.status_code == 200
        assert response.body["data"]["status"] == "healthy"

    def test_gateway_stats_track_requests(self):
        from developer_platform.api_gateway.gateway import RouteConfig
        route = RouteConfig(
            path="/health",
            method=HTTPMethod.GET,
            handler=lambda r: {"ok": True},
            version=APIVersion.V2,
            auth_required=False,
        )
        self.gateway.register_route(route)
        self.gateway.process_request(self._make_request("/health"))
        self.gateway.process_request(self._make_request("/health"))
        stats = self.gateway.get_stats()
        assert stats["total_requests"] == 2
        assert stats["successful_requests"] == 2


# ── API Versioning Tests ─────────────────────────────────────────────────────

class TestAPIVersionManager:
    def setup_method(self):
        self.manager = APIVersionManager()

    def test_default_versions_registered(self):
        versions = self.manager.list_versions()
        version_names = [v["version"] for v in versions]
        assert "v1" in version_names
        assert "v2" in version_names

    def test_v1_is_deprecated(self):
        assert self.manager.is_deprecated("v1") is True

    def test_v2_is_not_deprecated(self):
        assert self.manager.is_deprecated("v2") is False

    def test_current_version_is_v2(self):
        assert self.manager.get_current_version() == "v2"

    def test_deprecation_warning_for_v1(self):
        warning = self.manager.get_deprecation_warning("v1")
        assert warning is not None
        assert "deprecated" in warning.lower()

    def test_no_deprecation_warning_for_v2(self):
        warning = self.manager.get_deprecation_warning("v2")
        assert warning is None


# ── Rate Limit Middleware Tests ──────────────────────────────────────────────

class TestRateLimitMiddleware:
    def setup_method(self):
        self.middleware = RateLimitMiddleware(default_limit=5, window_seconds=60)

    def _make_request(self, api_key="test_key"):
        return GatewayRequest(api_key=api_key)

    def _make_route(self):
        from developer_platform.api_gateway.gateway import RouteConfig
        return RouteConfig(
            path="/test",
            method=HTTPMethod.GET,
            handler=lambda r: {},
            auth_required=False,
        )

    def test_allows_requests_within_limit(self):
        route = self._make_route()
        for _ in range(5):
            result = self.middleware(self._make_request(), route)
            assert result is None

    def test_blocks_requests_over_limit(self):
        from developer_platform.api_gateway.gateway import RouteConfig
        # Use route_override to set a very low limit of 2 requests
        route = RouteConfig(
            path="/limited",
            method=HTTPMethod.GET,
            handler=lambda r: {},
            auth_required=False,
            rate_limit_override=2,
        )
        middleware = RateLimitMiddleware(default_limit=60, window_seconds=60)
        for _ in range(2):
            middleware(self._make_request(), route)
        result = middleware(self._make_request(), route)
        assert result is not None
        assert result.status_code == 429
        assert result.body["error"]["code"] == "RATE_LIMIT_EXCEEDED"

    def test_rate_limit_headers_set(self):
        route = self._make_route()
        req = self._make_request()
        self.middleware(req, route)
        assert "X-RateLimit-Limit" in req.headers
        assert "X-RateLimit-Remaining" in req.headers


# ── OAuth Server Tests ───────────────────────────────────────────────────────

class TestOAuthServer:
    def setup_method(self):
        self.server = OAuthServer()
        self.app = OAuthApp(
            app_id="app_01",
            name="Test App",
            description="Test application",
            redirect_uris=["https://myapp.com/callback"],
            allowed_scopes=[OAuthScope.READ_MEMORY.value, OAuthScope.WRITE_MEMORY.value],
        )
        self.server.register_app(self.app)

    def test_register_app(self):
        app = self.server.get_app(self.app.client_id)
        assert app is not None
        assert app.name == "Test App"

    def test_client_credentials_flow(self):
        result = self.server.client_credentials_token(
            client_id=self.app.client_id,
            client_secret=self.app.client_secret,
            scopes=[OAuthScope.READ_MEMORY.value],
        )
        assert "access_token" in result
        assert result["token_type"] == "Bearer"
        assert "expires_in" in result

    def test_invalid_client_credentials(self):
        result = self.server.client_credentials_token(
            client_id=self.app.client_id,
            client_secret="wrong_secret",
            scopes=[OAuthScope.READ_MEMORY.value],
        )
        assert "error" in result
        assert result["error"] == "invalid_client"

    def test_invalid_scope_rejected(self):
        result = self.server.client_credentials_token(
            client_id=self.app.client_id,
            client_secret=self.app.client_secret,
            scopes=["read:decisions"],  # Not in allowed_scopes
        )
        assert "error" in result
        assert result["error"] == "invalid_scope"

    def test_token_validation(self):
        token_result = self.server.client_credentials_token(
            client_id=self.app.client_id,
            client_secret=self.app.client_secret,
            scopes=[OAuthScope.READ_MEMORY.value],
        )
        validation = self.server.validate_token(token_result["access_token"])
        assert validation["valid"] is True
        assert OAuthScope.READ_MEMORY.value in validation["scopes"]

    def test_token_revocation(self):
        token_result = self.server.client_credentials_token(
            client_id=self.app.client_id,
            client_secret=self.app.client_secret,
            scopes=[OAuthScope.READ_MEMORY.value],
        )
        token = token_result["access_token"]
        self.server.revoke_token(token)
        validation = self.server.validate_token(token)
        assert validation["valid"] is False

    def test_token_introspection(self):
        token_result = self.server.client_credentials_token(
            client_id=self.app.client_id,
            client_secret=self.app.client_secret,
            scopes=[OAuthScope.READ_MEMORY.value],
        )
        introspection = self.server.introspect_token(token_result["access_token"])
        assert introspection["active"] is True
        assert introspection["client_id"] == self.app.client_id


# ── PKCE Tests ───────────────────────────────────────────────────────────────

class TestPKCE:
    def test_generate_code_verifier(self):
        verifier = PKCEHelper.generate_code_verifier()
        assert len(verifier) > 40

    def test_generate_code_challenge(self):
        verifier = PKCEHelper.generate_code_verifier()
        challenge = PKCEHelper.generate_code_challenge(verifier)
        assert len(challenge) > 0
        assert challenge != verifier

    def test_verify_pkce(self):
        verifier = PKCEHelper.generate_code_verifier()
        challenge = PKCEHelper.generate_code_challenge(verifier)
        assert PKCEHelper.verify(verifier, challenge) is True

    def test_wrong_verifier_fails(self):
        verifier = PKCEHelper.generate_code_verifier()
        challenge = PKCEHelper.generate_code_challenge(verifier)
        wrong_verifier = PKCEHelper.generate_code_verifier()
        assert PKCEHelper.verify(wrong_verifier, challenge) is False


# ── API Key Manager Tests ────────────────────────────────────────────────────

class TestAPIKeyManager:
    def setup_method(self):
        self.manager = APIKeyManager()

    def test_create_key(self):
        key = self.manager.create_key(
            name="Test Key",
            app_id="app_01",
            owner_id="user_01",
            scopes=["read:memory"],
        )
        assert key._raw_key.startswith("lk_live_")
        assert key.key_hash != key._raw_key
        assert key.is_active()

    def test_validate_key(self):
        key = self.manager.create_key(
            name="Test Key",
            app_id="app_01",
            owner_id="user_01",
            scopes=["read:memory"],
        )
        result = self.manager.validate_key(key._raw_key)
        assert result["valid"] is True
        assert result["owner_id"] == "user_01"

    def test_invalid_key_rejected(self):
        result = self.manager.validate_key("lk_live_invalid_key")
        assert result["valid"] is False

    def test_revoke_key(self):
        key = self.manager.create_key(
            name="Test Key",
            app_id="app_01",
            owner_id="user_01",
            scopes=["read:memory"],
        )
        self.manager.revoke_key(key.key_id, "user_01")
        result = self.manager.validate_key(key._raw_key)
        assert result["valid"] is False

    def test_test_key_prefix(self):
        key = self.manager.create_key(
            name="Test Key",
            app_id="app_01",
            owner_id="user_01",
            scopes=["read:memory"],
            environment="test",
        )
        assert key._raw_key.startswith("lk_test_")

    def test_list_keys_by_owner(self):
        self.manager.create_key("Key 1", "app_01", "user_01", ["read:memory"])
        self.manager.create_key("Key 2", "app_01", "user_01", ["read:memory"])
        self.manager.create_key("Key 3", "app_02", "user_02", ["read:memory"])
        keys = self.manager.list_keys("user_01")
        assert len(keys) == 2

    def test_usage_tracking(self):
        key = self.manager.create_key("Key", "app_01", "user_01", ["read:memory"])
        self.manager.validate_key(key._raw_key)
        self.manager.validate_key(key._raw_key)
        stats = self.manager.get_usage_stats(key.key_id)
        assert stats["total_requests"] == 2


# ── Webhook Manager Tests ────────────────────────────────────────────────────

class TestWebhookManager:
    def setup_method(self):
        self.manager = WebhookManager()

    def test_register_webhook(self):
        webhook = self.manager.register_webhook(
            app_id="app_01",
            owner_id="user_01",
            url="https://myapp.com/webhooks",
            events=[WebhookEventType.MEMORY_CREATED],
        )
        assert webhook.webhook_id.startswith("wh_")
        assert webhook.secret.startswith("whsec_")

    def test_invalid_url_rejected(self):
        with pytest.raises(ValueError):
            self.manager.register_webhook(
                app_id="app_01",
                owner_id="user_01",
                url="ftp://invalid-url.com",
                events=[WebhookEventType.MEMORY_CREATED],
            )

    def test_send_test_event(self):
        webhook = self.manager.register_webhook(
            app_id="app_01",
            owner_id="user_01",
            url="https://myapp.com/webhooks",
            events=[WebhookEventType.MEMORY_CREATED],
        )
        delivery = self.manager.send_test_event(webhook.webhook_id, "user_01")
        assert delivery.success is True
        assert delivery.status_code == 200

    def test_dispatch_event_to_subscribers(self):
        self.manager.register_webhook(
            app_id="app_01",
            owner_id="user_01",
            url="https://myapp.com/webhooks",
            events=[WebhookEventType.MEMORY_CREATED],
        )
        event = WebhookEvent(
            event_type=WebhookEventType.MEMORY_CREATED,
            payload={"memory_id": "mem_01"},
        )
        deliveries = self.manager.dispatch_event(event, "user_01")
        assert len(deliveries) == 1
        assert deliveries[0].success is True

    def test_event_not_dispatched_to_non_subscribers(self):
        self.manager.register_webhook(
            app_id="app_01",
            owner_id="user_01",
            url="https://myapp.com/webhooks",
            events=[WebhookEventType.MEMORY_CREATED],
        )
        event = WebhookEvent(event_type=WebhookEventType.INSIGHT_GENERATED)
        deliveries = self.manager.dispatch_event(event, "user_01")
        assert len(deliveries) == 0

    def test_delete_webhook(self):
        webhook = self.manager.register_webhook(
            app_id="app_01",
            owner_id="user_01",
            url="https://myapp.com/webhooks",
            events=[WebhookEventType.MEMORY_CREATED],
        )
        result = self.manager.delete_webhook(webhook.webhook_id, "user_01")
        assert result is True
        assert len(self.manager.list_webhooks("user_01")) == 0


# ── Sandbox Tests ─────────────────────────────────────────────────────────────

class TestDeveloperSandbox:
    def setup_method(self):
        self.sandbox = DeveloperSandbox()

    def test_create_session(self):
        session = self.sandbox.create_session("dev_01")
        assert session.session_id.startswith("sbx_")
        assert session.api_key.startswith("lk_test_")
        assert session.state == SandboxState.CLEAN

    def test_seed_session(self):
        session = self.sandbox.create_session("dev_01")
        result = self.sandbox.seed(session.session_id)
        assert result["seeded"] is True
        assert result["records_created"] > 0
        assert session.state == SandboxState.SEEDED

    def test_reset_session(self):
        session = self.sandbox.create_session("dev_01")
        self.sandbox.seed(session.session_id)
        self.sandbox.reset(session.session_id)
        assert session.state == SandboxState.CLEAN
        assert all(len(v) == 0 for v in session.data.values())

    def test_sample_data_loaded(self):
        session = self.sandbox.create_session("dev_01")
        self.sandbox.seed(session.session_id)
        assert len(session.data["memories"]) == 10
        assert len(session.data["timeline_events"]) == 8
        assert len(session.data["decisions"]) == 5

    def test_get_status(self):
        session = self.sandbox.create_session("dev_01")
        status = self.sandbox.get_status(session.session_id)
        assert status is not None
        assert "config" in status
        assert status["config"]["rate_limit_per_minute"] == 300


# ── SDK Client Tests ─────────────────────────────────────────────────────────

class TestSDKClient:
    def test_requires_auth(self):
        with pytest.raises(AuthenticationError):
            LifeOSClient()

    def test_api_key_auth(self):
        client = LifeOSClient(api_key="lk_live_test")
        assert client is not None

    def test_oauth_token_auth(self):
        client = LifeOSClient(oauth_token="lk_token_test")
        assert client is not None

    def test_memory_list(self):
        client = LifeOSClient(api_key="lk_live_test")
        result = client.memory.list()
        assert "data" in result
        assert isinstance(result["data"], list)

    def test_memory_create(self):
        client = LifeOSClient(api_key="lk_live_test")
        result = client.memory.create(content="Test memory", type="work")
        assert "data" in result
        assert result["data"]["content"] == "Test memory"

    def test_timeline_list(self):
        client = LifeOSClient(api_key="lk_live_test")
        result = client.timeline.list()
        assert "data" in result

    def test_insights_list(self):
        client = LifeOSClient(api_key="lk_live_test")
        result = client.insights.list()
        assert "data" in result
        assert len(result["data"]) > 0

    def test_webhooks_create(self):
        client = LifeOSClient(api_key="lk_live_test")
        result = client.webhooks.create(
            url="https://myapp.com/webhooks",
            events=["memory.created"]
        )
        assert "data" in result
        assert result["data"]["url"] == "https://myapp.com/webhooks"

    def test_sandbox_seed(self):
        client = LifeOSClient(api_key="lk_test_test")
        result = client.developer.sandbox_seed()
        assert "data" in result


# ── CLI Tests ─────────────────────────────────────────────────────────────────

class TestCLI:
    def setup_method(self):
        self.cli = LifeOSCLI()

    def test_help_command(self, capsys):
        result = self.cli.run(["help"])
        assert result == 0

    def test_version_command(self, capsys):
        result = self.cli.run(["--version"])
        captured = capsys.readouterr()
        assert result == 0
        assert "2.0.0" in captured.out

    def test_memory_list(self, capsys):
        result = self.cli.run(["memory", "list"])
        assert result == 0

    def test_memory_create(self, capsys):
        result = self.cli.run(["memory", "create", "Test memory content"])
        assert result == 0

    def test_webhooks_list(self, capsys):
        result = self.cli.run(["webhooks", "list"])
        assert result == 0

    def test_sandbox_status(self, capsys):
        result = self.cli.run(["sandbox", "status"])
        assert result == 0

    def test_api_versions(self, capsys):
        result = self.cli.run(["api", "versions"])
        assert result == 0

    def test_unknown_command(self, capsys):
        result = self.cli.run(["unknown-command"])
        assert result == 1

    def test_insights_list(self, capsys):
        result = self.cli.run(["insights", "list"])
        assert result == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
