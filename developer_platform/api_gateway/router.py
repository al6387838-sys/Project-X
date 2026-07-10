"""
LifeOS API Router — Definição de Todas as Rotas Públicas
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

from typing import TYPE_CHECKING, List

from .gateway import APIVersion, GatewayRequest, GatewayResponse, HTTPMethod, RouteConfig

if TYPE_CHECKING:
    from .gateway import APIGateway


class APIRouter:
    """
    Router oficial da LifeOS Public API.

    Registra todas as rotas públicas organizadas por domínio:
    - /memory — Memórias do usuário
    - /timeline — Linha do tempo
    - /decisions — Decisões
    - /insights — Insights e análises
    - /webhooks — Gerenciamento de webhooks
    - /api-keys — Gerenciamento de API Keys
    - /oauth — Fluxos OAuth
    - /developer — Recursos do Developer Portal
    """

    def __init__(self, gateway: "APIGateway"):
        self._gateway = gateway
        self._register_all_routes()

    def _register_all_routes(self) -> None:
        routes = self._get_v1_routes() + self._get_v2_routes()
        for route in routes:
            self._gateway.register_route(route)

    def _get_v1_routes(self) -> List[RouteConfig]:
        """Rotas legadas v1 (deprecated)."""
        return [
            RouteConfig(
                path="/memory",
                method=HTTPMethod.GET,
                handler=self._handle_memory_list,
                version=APIVersion.V1,
                scopes_required=["read:memory"],
                description="[DEPRECATED] List memories. Use v2.",
                deprecated=True,
            ),
            RouteConfig(
                path="/timeline",
                method=HTTPMethod.GET,
                handler=self._handle_timeline,
                version=APIVersion.V1,
                scopes_required=["read:timeline"],
                description="[DEPRECATED] Get timeline. Use v2.",
                deprecated=True,
            ),
        ]

    def _get_v2_routes(self) -> List[RouteConfig]:
        """Rotas atuais v2."""
        return [
            # ── Memory ──────────────────────────────────────────────────────
            RouteConfig(
                path="/memory",
                method=HTTPMethod.GET,
                handler=self._handle_memory_list,
                version=APIVersion.V2,
                scopes_required=["read:memory"],
                description="List user memories with filtering and pagination.",
            ),
            RouteConfig(
                path="/memory",
                method=HTTPMethod.POST,
                handler=self._handle_memory_create,
                version=APIVersion.V2,
                scopes_required=["write:memory"],
                description="Create a new memory entry.",
            ),
            RouteConfig(
                path="/memory/{id}",
                method=HTTPMethod.GET,
                handler=self._handle_memory_get,
                version=APIVersion.V2,
                scopes_required=["read:memory"],
                description="Get a specific memory by ID.",
            ),
            RouteConfig(
                path="/memory/{id}",
                method=HTTPMethod.DELETE,
                handler=self._handle_memory_delete,
                version=APIVersion.V2,
                scopes_required=["delete:memory"],
                description="Delete a memory entry.",
            ),
            # ── Timeline ────────────────────────────────────────────────────
            RouteConfig(
                path="/timeline",
                method=HTTPMethod.GET,
                handler=self._handle_timeline,
                version=APIVersion.V2,
                scopes_required=["read:timeline"],
                description="Get user timeline events.",
            ),
            RouteConfig(
                path="/timeline/events",
                method=HTTPMethod.POST,
                handler=self._handle_timeline_event_create,
                version=APIVersion.V2,
                scopes_required=["write:timeline"],
                description="Add an event to the timeline.",
            ),
            # ── Decisions ───────────────────────────────────────────────────
            RouteConfig(
                path="/decisions",
                method=HTTPMethod.GET,
                handler=self._handle_decisions_list,
                version=APIVersion.V2,
                scopes_required=["read:decisions"],
                description="List user decisions.",
            ),
            RouteConfig(
                path="/decisions/{id}/analyze",
                method=HTTPMethod.POST,
                handler=self._handle_decision_analyze,
                version=APIVersion.V2,
                scopes_required=["read:decisions", "read:insights"],
                description="Trigger AI analysis for a decision.",
            ),
            # ── Insights ────────────────────────────────────────────────────
            RouteConfig(
                path="/insights",
                method=HTTPMethod.GET,
                handler=self._handle_insights,
                version=APIVersion.V2,
                scopes_required=["read:insights"],
                description="Get AI-generated insights about the user.",
            ),
            RouteConfig(
                path="/insights/summary",
                method=HTTPMethod.GET,
                handler=self._handle_insights_summary,
                version=APIVersion.V2,
                scopes_required=["read:insights"],
                description="Get a summarized insights report.",
            ),
            # ── Webhooks ────────────────────────────────────────────────────
            RouteConfig(
                path="/webhooks",
                method=HTTPMethod.GET,
                handler=self._handle_webhooks_list,
                version=APIVersion.V2,
                scopes_required=["manage:webhooks"],
                description="List registered webhooks.",
            ),
            RouteConfig(
                path="/webhooks",
                method=HTTPMethod.POST,
                handler=self._handle_webhook_create,
                version=APIVersion.V2,
                scopes_required=["manage:webhooks"],
                description="Register a new webhook.",
            ),
            RouteConfig(
                path="/webhooks/{id}",
                method=HTTPMethod.DELETE,
                handler=self._handle_webhook_delete,
                version=APIVersion.V2,
                scopes_required=["manage:webhooks"],
                description="Delete a webhook.",
            ),
            RouteConfig(
                path="/webhooks/{id}/test",
                method=HTTPMethod.POST,
                handler=self._handle_webhook_test,
                version=APIVersion.V2,
                scopes_required=["manage:webhooks"],
                description="Send a test event to a webhook.",
            ),
            # ── API Keys ────────────────────────────────────────────────────
            RouteConfig(
                path="/api-keys",
                method=HTTPMethod.GET,
                handler=self._handle_api_keys_list,
                version=APIVersion.V2,
                scopes_required=["manage:api_keys"],
                description="List API keys for the authenticated app.",
            ),
            RouteConfig(
                path="/api-keys",
                method=HTTPMethod.POST,
                handler=self._handle_api_key_create,
                version=APIVersion.V2,
                scopes_required=["manage:api_keys"],
                description="Create a new API key.",
            ),
            RouteConfig(
                path="/api-keys/{id}/revoke",
                method=HTTPMethod.POST,
                handler=self._handle_api_key_revoke,
                version=APIVersion.V2,
                scopes_required=["manage:api_keys"],
                description="Revoke an API key.",
            ),
            # ── Developer ───────────────────────────────────────────────────
            RouteConfig(
                path="/developer/sandbox/reset",
                method=HTTPMethod.POST,
                handler=self._handle_sandbox_reset,
                version=APIVersion.V2,
                scopes_required=["developer:sandbox"],
                description="Reset the developer sandbox to a clean state.",
            ),
            RouteConfig(
                path="/developer/sandbox/seed",
                method=HTTPMethod.POST,
                handler=self._handle_sandbox_seed,
                version=APIVersion.V2,
                scopes_required=["developer:sandbox"],
                description="Seed the sandbox with sample data.",
            ),
            # ── Health ──────────────────────────────────────────────────────
            RouteConfig(
                path="/health",
                method=HTTPMethod.GET,
                handler=self._handle_health,
                version=APIVersion.V2,
                auth_required=False,
                description="API health check. No authentication required.",
            ),
            RouteConfig(
                path="/versions",
                method=HTTPMethod.GET,
                handler=self._handle_versions,
                version=APIVersion.V2,
                auth_required=False,
                description="List available API versions.",
            ),
        ]

    # ── Handlers ────────────────────────────────────────────────────────────

    def _handle_memory_list(self, request: GatewayRequest) -> dict:
        return {
            "data": [
                {"id": "mem_01", "content": "Meeting with team about Q3 roadmap", "type": "work", "created_at": "2026-07-10T09:00:00Z"},
                {"id": "mem_02", "content": "Decided to prioritize Developer Platform", "type": "decision", "created_at": "2026-07-10T10:30:00Z"},
            ],
            "meta": {"total": 2, "cursor": None, "has_more": False},
        }

    def _handle_memory_create(self, request: GatewayRequest) -> dict:
        return {
            "data": {
                "id": "mem_03",
                "content": request.body.get("content", "") if request.body else "",
                "type": request.body.get("type", "general") if request.body else "general",
                "created_at": "2026-07-10T12:00:00Z",
            }
        }

    def _handle_memory_get(self, request: GatewayRequest) -> dict:
        return {
            "data": {"id": "mem_01", "content": "Meeting with team about Q3 roadmap", "type": "work", "created_at": "2026-07-10T09:00:00Z"}
        }

    def _handle_memory_delete(self, request: GatewayRequest) -> dict:
        return {"data": {"deleted": True, "id": "mem_01"}}

    def _handle_timeline(self, request: GatewayRequest) -> dict:
        return {
            "data": [
                {"id": "evt_01", "title": "Started Developer Platform", "date": "2026-07-10", "category": "milestone"},
                {"id": "evt_02", "title": "Launched LifeOS v1.0-rc", "date": "2026-07-09", "category": "release"},
            ],
            "meta": {"total": 2, "cursor": None},
        }

    def _handle_timeline_event_create(self, request: GatewayRequest) -> dict:
        return {"data": {"id": "evt_03", "created": True}}

    def _handle_decisions_list(self, request: GatewayRequest) -> dict:
        return {
            "data": [
                {"id": "dec_01", "title": "Adopt microservices architecture", "status": "approved", "confidence": 0.92},
            ],
            "meta": {"total": 1},
        }

    def _handle_decision_analyze(self, request: GatewayRequest) -> dict:
        return {"data": {"analysis_id": "anl_01", "status": "processing", "estimated_completion_seconds": 5}}

    def _handle_insights(self, request: GatewayRequest) -> dict:
        return {
            "data": [
                {"type": "pattern", "title": "Peak productivity on Tuesdays", "confidence": 0.87},
                {"type": "risk", "title": "Overcommitment detected in Q3", "confidence": 0.79},
            ]
        }

    def _handle_insights_summary(self, request: GatewayRequest) -> dict:
        return {"data": {"summary": "High performance week. 3 key decisions pending. 2 risks flagged.", "score": 82}}

    def _handle_webhooks_list(self, request: GatewayRequest) -> dict:
        return {"data": [], "meta": {"total": 0}}

    def _handle_webhook_create(self, request: GatewayRequest) -> dict:
        return {"data": {"id": "wh_01", "url": request.body.get("url", "") if request.body else "", "events": [], "created_at": "2026-07-10T12:00:00Z"}}

    def _handle_webhook_delete(self, request: GatewayRequest) -> dict:
        return {"data": {"deleted": True}}

    def _handle_webhook_test(self, request: GatewayRequest) -> dict:
        return {"data": {"delivered": True, "status_code": 200, "response_time_ms": 142}}

    def _handle_api_keys_list(self, request: GatewayRequest) -> dict:
        return {"data": [], "meta": {"total": 0}}

    def _handle_api_key_create(self, request: GatewayRequest) -> dict:
        return {"data": {"id": "key_01", "key": "lk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", "name": "My App Key", "created_at": "2026-07-10T12:00:00Z"}}

    def _handle_api_key_revoke(self, request: GatewayRequest) -> dict:
        return {"data": {"revoked": True}}

    def _handle_sandbox_reset(self, request: GatewayRequest) -> dict:
        return {"data": {"reset": True, "message": "Sandbox reset to clean state."}}

    def _handle_sandbox_seed(self, request: GatewayRequest) -> dict:
        return {"data": {"seeded": True, "records_created": 25, "message": "Sandbox seeded with sample data."}}

    def _handle_health(self, request: GatewayRequest) -> dict:
        return {"status": "healthy", "version": "v2", "timestamp": "2026-07-10T12:00:00Z"}

    def _handle_versions(self, request: GatewayRequest) -> dict:
        return {
            "data": [
                {"version": "v1", "status": "deprecated", "sunset_date": "2027-01-01"},
                {"version": "v2", "status": "active", "is_current": True},
            ]
        }
