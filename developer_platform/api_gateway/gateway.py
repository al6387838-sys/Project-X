"""
LifeOS API Gateway — Core
EXECUTION-009: Developer Platform
Versão: 1.0.0
"""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class HTTPMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"


class APIVersion(str, Enum):
    V1 = "v1"
    V2 = "v2"


@dataclass
class GatewayConfig:
    """Configuração principal do API Gateway."""
    host: str = "0.0.0.0"
    port: int = 8080
    api_prefix: str = "/api"
    default_version: APIVersion = APIVersion.V1
    supported_versions: List[APIVersion] = field(default_factory=lambda: [APIVersion.V1, APIVersion.V2])
    request_timeout_seconds: int = 30
    max_request_size_bytes: int = 10 * 1024 * 1024  # 10MB
    cors_origins: List[str] = field(default_factory=lambda: ["*"])
    enable_request_logging: bool = True
    enable_rate_limiting: bool = True
    enable_auth: bool = True


@dataclass
class RouteConfig:
    """Configuração de uma rota no gateway."""
    path: str
    method: HTTPMethod
    handler: Callable
    version: APIVersion = APIVersion.V1
    auth_required: bool = True
    rate_limit_override: Optional[int] = None  # requests per minute
    scopes_required: List[str] = field(default_factory=list)
    description: str = ""
    deprecated: bool = False


@dataclass
class GatewayRequest:
    """Representação de uma requisição no gateway."""
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    method: HTTPMethod = HTTPMethod.GET
    path: str = "/"
    version: APIVersion = APIVersion.V1
    headers: Dict[str, str] = field(default_factory=dict)
    query_params: Dict[str, str] = field(default_factory=dict)
    body: Optional[Dict[str, Any]] = None
    api_key: Optional[str] = None
    oauth_token: Optional[str] = None
    client_ip: str = "127.0.0.1"
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class GatewayResponse:
    """Representação de uma resposta do gateway."""
    status_code: int = 200
    body: Dict[str, Any] = field(default_factory=dict)
    headers: Dict[str, str] = field(default_factory=dict)
    request_id: str = ""
    processing_time_ms: float = 0.0
    version: APIVersion = APIVersion.V1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status_code": self.status_code,
            "body": self.body,
            "headers": self.headers,
            "meta": {
                "request_id": self.request_id,
                "processing_time_ms": self.processing_time_ms,
                "api_version": self.version.value,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }


class APIGateway:
    """
    LifeOS API Gateway.

    Responsável por:
    - Roteamento de requisições para handlers corretos
    - Versionamento de API (v1, v2)
    - Aplicação de middlewares (auth, rate limit, logging)
    - Padronização de respostas
    - Rastreamento de requisições (request_id)
    """

    def __init__(self, config: Optional[GatewayConfig] = None):
        self.config = config or GatewayConfig()
        self._routes: Dict[str, RouteConfig] = {}
        self._middlewares: List[Callable] = []
        self._request_log: List[Dict[str, Any]] = []
        self._stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "avg_processing_time_ms": 0.0,
        }

    def register_route(self, route: RouteConfig) -> None:
        """Registra uma nova rota no gateway."""
        key = f"{route.version.value}:{route.method.value}:{route.path}"
        self._routes[key] = route

    def add_middleware(self, middleware: Callable) -> None:
        """Adiciona um middleware ao pipeline de processamento."""
        self._middlewares.append(middleware)

    def process_request(self, request: GatewayRequest) -> GatewayResponse:
        """
        Processa uma requisição através do pipeline completo do gateway.

        Pipeline:
        1. Validação da versão da API
        2. Resolução da rota
        3. Execução dos middlewares
        4. Execução do handler
        5. Padronização da resposta
        """
        start_time = time.monotonic()
        self._stats["total_requests"] += 1

        # Validar versão
        if request.version not in self.config.supported_versions:
            return self._error_response(
                request_id=request.request_id,
                status_code=400,
                error_code="UNSUPPORTED_API_VERSION",
                message=f"API version '{request.version.value}' is not supported. Supported versions: {[v.value for v in self.config.supported_versions]}",
            )

        # Resolver rota
        route_key = f"{request.version.value}:{request.method.value}:{request.path}"
        route = self._routes.get(route_key)

        if not route:
            return self._error_response(
                request_id=request.request_id,
                status_code=404,
                error_code="ROUTE_NOT_FOUND",
                message=f"No route found for {request.method.value} {request.path} ({request.version.value})",
            )

        # Aviso de deprecação
        deprecation_warning = None
        if route.deprecated:
            deprecation_warning = f"This endpoint is deprecated. Please migrate to the latest API version."

        # Executar middlewares
        for middleware in self._middlewares:
            result = middleware(request, route)
            if result is not None:
                self._stats["failed_requests"] += 1
                return result

        # Executar handler
        try:
            handler_result = route.handler(request)
            if isinstance(handler_result, GatewayResponse):
                response = handler_result
            else:
                response = GatewayResponse(
                    status_code=200,
                    body=handler_result if isinstance(handler_result, dict) else {"data": handler_result},
                    request_id=request.request_id,
                    version=request.version,
                )

            if deprecation_warning:
                response.headers["X-Deprecation-Warning"] = deprecation_warning

            processing_time = (time.monotonic() - start_time) * 1000
            response.processing_time_ms = processing_time
            response.request_id = request.request_id

            self._stats["successful_requests"] += 1
            self._update_avg_processing_time(processing_time)
            self._log_request(request, response)

            return response

        except Exception as exc:
            self._stats["failed_requests"] += 1
            return self._error_response(
                request_id=request.request_id,
                status_code=500,
                error_code="INTERNAL_SERVER_ERROR",
                message=str(exc),
            )

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do gateway."""
        return {
            **self._stats,
            "registered_routes": len(self._routes),
            "active_middlewares": len(self._middlewares),
            "uptime_timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _error_response(
        self,
        request_id: str,
        status_code: int,
        error_code: str,
        message: str,
    ) -> GatewayResponse:
        return GatewayResponse(
            status_code=status_code,
            body={
                "error": {
                    "code": error_code,
                    "message": message,
                    "request_id": request_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
            request_id=request_id,
        )

    def _update_avg_processing_time(self, new_time_ms: float) -> None:
        total = self._stats["total_requests"]
        current_avg = self._stats["avg_processing_time_ms"]
        self._stats["avg_processing_time_ms"] = (
            (current_avg * (total - 1) + new_time_ms) / total
        )

    def _log_request(self, request: GatewayRequest, response: GatewayResponse) -> None:
        if self.config.enable_request_logging:
            self._request_log.append({
                "request_id": request.request_id,
                "method": request.method.value,
                "path": request.path,
                "version": request.version.value,
                "status_code": response.status_code,
                "processing_time_ms": response.processing_time_ms,
                "client_ip": request.client_ip,
                "timestamp": request.timestamp.isoformat(),
            })
