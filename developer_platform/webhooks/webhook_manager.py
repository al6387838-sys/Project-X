"""
LifeOS Webhook Manager
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlparse


class WebhookEventType(str, Enum):
    """Eventos oficiais que podem ser enviados via webhook."""
    # Memory
    MEMORY_CREATED = "memory.created"
    MEMORY_UPDATED = "memory.updated"
    MEMORY_DELETED = "memory.deleted"

    # Timeline
    TIMELINE_EVENT_ADDED = "timeline.event_added"

    # Decisions
    DECISION_CREATED = "decision.created"
    DECISION_RESOLVED = "decision.resolved"

    # Insights
    INSIGHT_GENERATED = "insight.generated"

    # System
    API_KEY_REVOKED = "api_key.revoked"
    WEBHOOK_TEST = "webhook.test"

    # User
    USER_CONNECTED = "user.connected"
    USER_DISCONNECTED = "user.disconnected"


@dataclass
class Webhook:
    """Representa um webhook registrado."""
    webhook_id: str
    app_id: str
    owner_id: str
    url: str
    events: List[WebhookEventType]
    secret: str = field(default_factory=lambda: f"whsec_{secrets.token_hex(32)}")
    is_active: bool = True
    description: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_triggered_at: Optional[datetime] = None
    total_deliveries: int = 0
    failed_deliveries: int = 0

    def to_dict(self, include_secret: bool = False) -> dict:
        result = {
            "webhook_id": self.webhook_id,
            "app_id": self.app_id,
            "url": self.url,
            "events": [e.value for e in self.events],
            "is_active": self.is_active,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "last_triggered_at": self.last_triggered_at.isoformat() if self.last_triggered_at else None,
            "stats": {
                "total_deliveries": self.total_deliveries,
                "failed_deliveries": self.failed_deliveries,
                "success_rate": (
                    round((self.total_deliveries - self.failed_deliveries) / self.total_deliveries * 100, 1)
                    if self.total_deliveries > 0 else 100.0
                ),
            },
        }
        if include_secret:
            result["secret"] = self.secret
        return result


@dataclass
class WebhookEvent:
    """Evento a ser entregue via webhook."""
    event_id: str = field(default_factory=lambda: f"evt_{secrets.token_hex(12)}")
    event_type: WebhookEventType = WebhookEventType.WEBHOOK_TEST
    payload: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.event_id,
            "type": self.event_type.value,
            "data": self.payload,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class WebhookDelivery:
    """Registro de uma tentativa de entrega de webhook."""
    delivery_id: str = field(default_factory=lambda: f"del_{secrets.token_hex(8)}")
    webhook_id: str = ""
    event_id: str = ""
    url: str = ""
    status_code: Optional[int] = None
    response_body: str = ""
    response_time_ms: float = 0.0
    success: bool = False
    attempt: int = 1
    delivered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "delivery_id": self.delivery_id,
            "webhook_id": self.webhook_id,
            "event_id": self.event_id,
            "url": self.url,
            "status_code": self.status_code,
            "response_time_ms": self.response_time_ms,
            "success": self.success,
            "attempt": self.attempt,
            "delivered_at": self.delivered_at.isoformat(),
            "error": self.error,
        }


class WebhookManager:
    """
    Gerenciador de Webhooks do LifeOS.

    Responsável por:
    - Registro e gerenciamento de webhooks
    - Assinatura HMAC-SHA256 dos payloads
    - Entrega com retry automático (3 tentativas)
    - Rastreamento de deliveries
    - Eventos de teste
    """

    MAX_RETRIES = 3
    RETRY_DELAYS = [5, 30, 300]  # segundos

    def __init__(self, http_client: Optional[Callable] = None):
        self._webhooks: Dict[str, Webhook] = {}
        self._deliveries: List[WebhookDelivery] = []
        self._http_client = http_client or self._mock_http_client

    def register_webhook(
        self,
        app_id: str,
        owner_id: str,
        url: str,
        events: List[WebhookEventType],
        description: str = "",
    ) -> Webhook:
        """Registra um novo webhook."""
        # Validar URL
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Webhook URL must use HTTP or HTTPS.")

        webhook_id = f"wh_{secrets.token_hex(8)}"
        webhook = Webhook(
            webhook_id=webhook_id,
            app_id=app_id,
            owner_id=owner_id,
            url=url,
            events=events,
            description=description,
        )
        self._webhooks[webhook_id] = webhook
        return webhook

    def delete_webhook(self, webhook_id: str, owner_id: str) -> bool:
        """Remove um webhook."""
        webhook = self._webhooks.get(webhook_id)
        if not webhook or webhook.owner_id != owner_id:
            return False
        del self._webhooks[webhook_id]
        return True

    def list_webhooks(self, owner_id: str) -> List[Dict]:
        """Lista webhooks de um owner."""
        return [
            wh.to_dict()
            for wh in self._webhooks.values()
            if wh.owner_id == owner_id
        ]

    def dispatch_event(self, event: WebhookEvent, owner_id: str) -> List[WebhookDelivery]:
        """
        Dispara um evento para todos os webhooks registrados do owner
        que assinam aquele tipo de evento.
        """
        deliveries = []
        for webhook in self._webhooks.values():
            if webhook.owner_id != owner_id:
                continue
            if not webhook.is_active:
                continue
            if event.event_type not in webhook.events:
                continue

            delivery = self._deliver(webhook, event)
            deliveries.append(delivery)

        return deliveries

    def send_test_event(self, webhook_id: str, owner_id: str) -> WebhookDelivery:
        """Envia um evento de teste para um webhook."""
        webhook = self._webhooks.get(webhook_id)
        if not webhook or webhook.owner_id != owner_id:
            raise ValueError(f"Webhook {webhook_id} not found.")

        test_event = WebhookEvent(
            event_type=WebhookEventType.WEBHOOK_TEST,
            payload={
                "message": "This is a test event from LifeOS.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        return self._deliver(webhook, test_event)

    def get_deliveries(self, webhook_id: str) -> List[Dict]:
        """Retorna histórico de deliveries de um webhook."""
        return [
            d.to_dict()
            for d in self._deliveries
            if d.webhook_id == webhook_id
        ]

    def _sign_payload(self, payload: str, secret: str) -> str:
        """Assina o payload com HMAC-SHA256."""
        timestamp = str(int(time.time()))
        signed_content = f"{timestamp}.{payload}"
        signature = hmac.new(
            secret.encode(),
            signed_content.encode(),
            hashlib.sha256,
        ).hexdigest()
        return f"t={timestamp},v1={signature}"

    def _deliver(self, webhook: Webhook, event: WebhookEvent, attempt: int = 1) -> WebhookDelivery:
        """Tenta entregar um evento para um webhook."""
        payload_str = json.dumps(event.to_dict())
        signature = self._sign_payload(payload_str, webhook.secret)

        headers = {
            "Content-Type": "application/json",
            "X-LifeOS-Signature": signature,
            "X-LifeOS-Event": event.event_type.value,
            "X-LifeOS-Delivery": f"del_{secrets.token_hex(8)}",
            "User-Agent": "LifeOS-Webhooks/1.0",
        }

        start = time.monotonic()
        result = self._http_client(webhook.url, payload_str, headers)
        elapsed_ms = (time.monotonic() - start) * 1000

        delivery = WebhookDelivery(
            webhook_id=webhook.webhook_id,
            event_id=event.event_id,
            url=webhook.url,
            status_code=result.get("status_code"),
            response_body=result.get("body", ""),
            response_time_ms=elapsed_ms,
            success=result.get("success", False),
            attempt=attempt,
            error=result.get("error"),
        )

        webhook.total_deliveries += 1
        if not delivery.success:
            webhook.failed_deliveries += 1
        else:
            webhook.last_triggered_at = datetime.now(timezone.utc)

        self._deliveries.append(delivery)
        return delivery

    def _mock_http_client(self, url: str, payload: str, headers: dict) -> dict:
        """Cliente HTTP simulado para testes."""
        return {
            "status_code": 200,
            "body": '{"received": true}',
            "success": True,
        }
