"""
LifeOS API Gateway — Middlewares
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from .gateway import GatewayRequest, GatewayResponse, RouteConfig


class AuthMiddleware:
    """
    Middleware de autenticação do API Gateway.

    Suporta dois métodos de autenticação:
    - API Key (Authorization: Bearer lk_...)
    - OAuth 2.0 Bearer Token
    """

    def __init__(self, api_key_validator: Callable, oauth_validator: Callable):
        self._validate_api_key = api_key_validator
        self._validate_oauth = oauth_validator

    def __call__(
        self, request: GatewayRequest, route: RouteConfig
    ) -> Optional[GatewayResponse]:
        if not route.auth_required:
            return None

        # Tentar API Key
        if request.api_key:
            result = self._validate_api_key(request.api_key)
            if result.get("valid"):
                request.headers["X-Authenticated-App"] = result.get("app_name", "")
                request.headers["X-App-Scopes"] = ",".join(result.get("scopes", []))
                # Verificar escopos necessários
                if route.scopes_required:
                    app_scopes = set(result.get("scopes", []))
                    required = set(route.scopes_required)
                    if not required.issubset(app_scopes):
                        missing = required - app_scopes
                        return self._forbidden(
                            request.request_id,
                            f"Missing required scopes: {list(missing)}",
                        )
                return None
            return self._unauthorized(request.request_id, "Invalid API key.")

        # Tentar OAuth Token
        if request.oauth_token:
            result = self._validate_oauth(request.oauth_token)
            if result.get("valid"):
                request.headers["X-Authenticated-User"] = result.get("user_id", "")
                request.headers["X-Token-Scopes"] = ",".join(result.get("scopes", []))
                if route.scopes_required:
                    token_scopes = set(result.get("scopes", []))
                    required = set(route.scopes_required)
                    if not required.issubset(token_scopes):
                        missing = required - token_scopes
                        return self._forbidden(
                            request.request_id,
                            f"Missing required scopes: {list(missing)}",
                        )
                return None
            return self._unauthorized(request.request_id, "Invalid or expired OAuth token.")

        return self._unauthorized(request.request_id, "Authentication required. Provide an API key or OAuth token.")

    def _unauthorized(self, request_id: str, message: str) -> GatewayResponse:
        return GatewayResponse(
            status_code=401,
            body={
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": message,
                    "request_id": request_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "docs": "https://developers.lifeos.app/authentication",
                }
            },
            headers={"WWW-Authenticate": 'Bearer realm="LifeOS API"'},
            request_id=request_id,
        )

    def _forbidden(self, request_id: str, message: str) -> GatewayResponse:
        return GatewayResponse(
            status_code=403,
            body={
                "error": {
                    "code": "FORBIDDEN",
                    "message": message,
                    "request_id": request_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "docs": "https://developers.lifeos.app/scopes",
                }
            },
            request_id=request_id,
        )


class RateLimitMiddleware:
    """
    Middleware de Rate Limiting do API Gateway.

    Implementa algoritmo de sliding window por chave de API/IP.
    Limites padrão por plano:
    - Free: 60 req/min
    - Pro: 300 req/min
    - Enterprise: 1000 req/min
    """

    DEFAULT_LIMITS = {
        "free": 60,
        "pro": 300,
        "enterprise": 1000,
    }

    def __init__(self, default_limit: int = 60, window_seconds: int = 60):
        self._default_limit = default_limit
        self._window_seconds = window_seconds
        self._request_windows: Dict[str, list] = defaultdict(list)
        self._plan_limits: Dict[str, str] = {}  # api_key -> plan

    def set_key_plan(self, api_key: str, plan: str) -> None:
        self._plan_limits[api_key] = plan

    def get_limit_for_key(self, api_key: str, route_override: Optional[int] = None) -> int:
        if route_override:
            return route_override
        plan = self._plan_limits.get(api_key, "free")
        return self.DEFAULT_LIMITS.get(plan, self._default_limit)

    def __call__(
        self, request: GatewayRequest, route: RouteConfig
    ) -> Optional[GatewayResponse]:
        identifier = request.api_key or request.client_ip
        limit = self.get_limit_for_key(identifier, route.rate_limit_override)
        now = time.monotonic()
        window_start = now - self._window_seconds

        # Limpar requisições fora da janela
        self._request_windows[identifier] = [
            ts for ts in self._request_windows[identifier] if ts > window_start
        ]

        current_count = len(self._request_windows[identifier])
        remaining = max(0, limit - current_count)
        reset_at = int(time.time()) + self._window_seconds

        if current_count >= limit:
            return GatewayResponse(
                status_code=429,
                body={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded. Maximum {limit} requests per {self._window_seconds} seconds.",
                        "request_id": request.request_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "docs": "https://developers.lifeos.app/rate-limits",
                    }
                },
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_at),
                    "Retry-After": str(self._window_seconds),
                },
                request_id=request.request_id,
            )

        self._request_windows[identifier].append(now)

        # Adicionar headers de rate limit à request para propagação
        request.headers["X-RateLimit-Limit"] = str(limit)
        request.headers["X-RateLimit-Remaining"] = str(remaining - 1)
        request.headers["X-RateLimit-Reset"] = str(reset_at)

        return None


class LoggingMiddleware:
    """
    Middleware de logging estruturado para o API Gateway.
    Registra todas as requisições com contexto completo.
    """

    def __init__(self, log_handler: Optional[Callable] = None):
        self._log_handler = log_handler or self._default_log
        self._logs: list = []

    def __call__(
        self, request: GatewayRequest, route: RouteConfig
    ) -> Optional[GatewayResponse]:
        log_entry = {
            "event": "api_request",
            "request_id": request.request_id,
            "method": request.method.value,
            "path": request.path,
            "version": request.version.value,
            "client_ip": request.client_ip,
            "has_api_key": bool(request.api_key),
            "has_oauth_token": bool(request.oauth_token),
            "timestamp": request.timestamp.isoformat(),
        }
        self._log_handler(log_entry)
        return None

    def _default_log(self, entry: Dict[str, Any]) -> None:
        self._logs.append(entry)

    def get_logs(self) -> list:
        return list(self._logs)
