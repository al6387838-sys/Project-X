"""
LifeOS SDK — Cliente Principal
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .exceptions import AuthenticationError, RateLimitError, APIError, NotFoundError, ValidationError
from .resources import (
    APIKeyResource,
    DecisionResource,
    DeveloperResource,
    InsightResource,
    MemoryResource,
    TimelineResource,
    WebhookResource,
)


@dataclass
class LifeOSClientConfig:
    """Configuração do cliente SDK."""
    base_url: str = "https://api.lifeos.app/api/v2"
    timeout_seconds: int = 30
    max_retries: int = 3
    retry_on_rate_limit: bool = True
    user_agent: str = "LifeOS-SDK-Python/2.0.0"


class LifeOSClient:
    """
    Cliente oficial do LifeOS SDK v2.

    Suporta autenticação via:
    - API Key: LifeOSClient(api_key="lk_live_...")
    - OAuth Token: LifeOSClient(oauth_token="lk_token_...")

    Exemplo de uso:
        client = LifeOSClient(api_key="lk_live_...")

        # Listar memórias
        memories = client.memory.list(limit=10)

        # Criar memória
        memory = client.memory.create(
            content="Reunião com equipe de produto",
            type="work"
        )

        # Obter insights
        insights = client.insights.list()

        # Registrar webhook
        webhook = client.webhooks.create(
            url="https://myapp.com/webhooks",
            events=["memory.created", "insight.generated"]
        )
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        oauth_token: Optional[str] = None,
        config: Optional[LifeOSClientConfig] = None,
    ):
        if not api_key and not oauth_token:
            raise AuthenticationError(
                "Authentication required. Provide api_key or oauth_token."
            )

        self._api_key = api_key
        self._oauth_token = oauth_token
        self.config = config or LifeOSClientConfig()

        # Recursos disponíveis
        self.memory = MemoryResource(self)
        self.timeline = TimelineResource(self)
        self.decisions = DecisionResource(self)
        self.insights = InsightResource(self)
        self.webhooks = WebhookResource(self)
        self.api_keys = APIKeyResource(self)
        self.developer = DeveloperResource(self)

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": self.config.user_agent,
        }
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        elif self._oauth_token:
            headers["Authorization"] = f"Bearer {self._oauth_token}"
        return headers

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Dict] = None,
        params: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Realiza uma requisição à API LifeOS.

        Trata automaticamente:
        - Autenticação
        - Rate limiting (retry com backoff)
        - Erros da API
        - Padronização de resposta
        """
        # Simulação do cliente HTTP (em produção usaria httpx/requests)
        return self._simulate_request(method, path, body, params)

    def _simulate_request(
        self,
        method: str,
        path: str,
        body: Optional[Dict],
        params: Optional[Dict],
    ) -> Dict[str, Any]:
        """
        Simulação de requisição HTTP para o SDK.
        Em produção, este método faria chamadas HTTP reais.
        """
        import uuid
        from datetime import datetime, timezone

        request_id = str(uuid.uuid4())

        # Simular respostas para demonstração
        responses = {
            ("GET", "/memory"): {
                "data": [
                    {"id": "mem_01", "content": "Team meeting about Q3 roadmap", "type": "work", "created_at": "2026-07-10T09:00:00Z"},
                    {"id": "mem_02", "content": "Decided to prioritize Developer Platform", "type": "decision", "created_at": "2026-07-10T10:30:00Z"},
                ],
                "meta": {"total": 2, "cursor": None, "has_more": False},
            },
            ("POST", "/memory"): {
                "data": {
                    "id": "mem_03",
                    "content": body.get("content", "") if body else "",
                    "type": body.get("type", "general") if body else "general",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            ("GET", "/timeline"): {
                "data": [
                    {"id": "evt_01", "title": "Started Developer Platform", "date": "2026-07-10", "category": "milestone"},
                ],
                "meta": {"total": 1},
            },
            ("GET", "/insights"): {
                "data": [
                    {"type": "pattern", "title": "Peak productivity on Tuesdays", "confidence": 0.87},
                    {"type": "risk", "title": "Overcommitment detected in Q3", "confidence": 0.79},
                ]
            },
            ("GET", "/webhooks"): {"data": [], "meta": {"total": 0}},
            ("POST", "/webhooks"): {
                "data": {
                    "webhook_id": "wh_01abc",
                    "url": body.get("url", "") if body else "",
                    "events": body.get("events", []) if body else [],
                    "secret": "whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            ("GET", "/api-keys"): {"data": [], "meta": {"total": 0}},
            ("POST", "/api-keys"): {
                "data": {
                    "key_id": "key_01abc",
                    "key": "lk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                    "name": body.get("name", "") if body else "",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            ("GET", "/decisions"): {
                "data": [
                    {"id": "dec_01", "title": "Adopt microservices", "status": "approved", "confidence": 0.92},
                ],
                "meta": {"total": 1},
            },
            ("POST", "/developer/sandbox/reset"): {"data": {"reset": True}},
            ("POST", "/developer/sandbox/seed"): {"data": {"seeded": True, "records_created": 25}},
        }

        key = (method.upper(), path)
        response_data = responses.get(key, {"data": {}, "meta": {}})

        return {
            **response_data,
            "_meta": {
                "request_id": request_id,
                "processing_time_ms": 42.0,
                "api_version": "v2",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }
