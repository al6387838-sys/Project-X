"""Unified Communication Platform for LifeOS Enterprise.

The hub composes provider connectors already implemented by LifeOS and keeps
product modules decoupled from Gmail, Outlook, Teams, Slack, Discord and meeting
provider details.  Every provider operation is routed through IntegrationSDK.
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Type

from connector_platform.core.connector_engine import BaseConnector
from connector_platform.models.connector_models import (
    SyncDirection,
    SyncFrequency,
    WebhookEvent,
    WebhookRegistration,
)
from connector_platform.sdk.integration_sdk import IntegrationSDK


@dataclass(frozen=True)
class CommunicationIdentity:
    address: str
    name: str = ""
    provider_id: str = ""


@dataclass(frozen=True)
class UnifiedMessage:
    message_id: str
    provider: str
    connector_id: str
    conversation_id: str
    sender: CommunicationIdentity
    recipients: List[CommunicationIdentity]
    subject: str
    body_preview: str
    sent_at: datetime
    channel: str = "email"
    unread: bool = False
    labels: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class UnifiedEvent:
    event_id: str
    provider: str
    connector_id: str
    title: str
    starts_at: datetime
    ends_at: datetime
    attendees: List[CommunicationIdentity] = field(default_factory=list)
    meeting_url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class CommunicationPlatform:
    """Canonical multi-provider communication application service."""

    def __init__(self, sdk: IntegrationSDK):
        self.sdk = sdk
        self._messages: Dict[str, Dict[str, UnifiedMessage]] = {}
        self._events: Dict[str, Dict[str, UnifiedEvent]] = {}
        self._connector_classes: Dict[str, Type[BaseConnector]] = {}

    def register_connectors(self, connector_classes: Iterable[Type[BaseConnector]]) -> Dict[str, bool]:
        results: Dict[str, bool] = {}
        for connector_class in connector_classes:
            connector_id = connector_class.manifest.connector_id
            self._connector_classes[connector_id] = connector_class
            results[connector_id] = self.sdk.register_connector(connector_class)
        return results

    def available_channels(self) -> List[Dict[str, Any]]:
        channels = []
        for connector_id, connector_class in sorted(self._connector_classes.items()):
            manifest = connector_class.manifest
            channels.append({
                "connector_id": connector_id,
                "name": manifest.name,
                "provider": manifest.provider,
                "category": manifest.category.value,
                "capabilities": [capability.name for capability in manifest.capabilities],
            })
        return channels

    async def prepare_connection(
        self,
        user_id: str,
        connector_id: str,
        scopes: Sequence[str],
        consent_text: str,
        *,
        settings: Optional[Dict[str, Any]] = None,
    ):
        if connector_id not in self._connector_classes:
            raise KeyError(f"Communication connector is not registered: {connector_id}")
        manifest = self._connector_classes[connector_id].manifest
        allowed = set(manifest.required_scopes) | set(manifest.optional_scopes)
        unsupported = sorted(set(scopes) - allowed)
        if unsupported:
            raise PermissionError(f"Unsupported scopes for {connector_id}: {unsupported}")
        return await self.sdk.prepare_connection(
            user_id,
            connector_id,
            list(scopes),
            consent_text,
            settings=settings,
            sync_direction=SyncDirection.BIDIRECTIONAL,
            sync_frequency=SyncFrequency.EVERY_5_MINUTES,
        )

    async def synchronize(
        self,
        user_id: str,
        connector_id: str,
        provider_payload: Dict[str, Any],
    ) -> Dict[str, int]:
        if connector_id not in self._connector_classes:
            raise KeyError(f"Communication connector is not registered: {connector_id}")
        await self.sdk.sync(
            user_id,
            connector_id,
            resource_types=["messages", "events", "contacts"],
        )
        messages = [
            self._normalize_message(connector_id, item)
            for item in provider_payload.get("messages", [])
        ]
        events = [
            self._normalize_event(connector_id, item)
            for item in provider_payload.get("events", [])
        ]
        message_store = self._messages.setdefault(user_id, {})
        event_store = self._events.setdefault(user_id, {})
        for message in messages:
            message_store[message.message_id] = message
        for event in events:
            event_store[event.event_id] = event
        return {"messages": len(messages), "events": len(events)}

    def unified_inbox(
        self,
        user_id: str,
        *,
        unread_only: bool = False,
        connector_ids: Optional[Sequence[str]] = None,
        limit: int = 100,
    ) -> List[UnifiedMessage]:
        allowed = set(connector_ids or [])
        messages = [
            message
            for message in self._messages.get(user_id, {}).values()
            if (not unread_only or message.unread)
            and (not allowed or message.connector_id in allowed)
        ]
        return sorted(messages, key=lambda item: item.sent_at, reverse=True)[:limit]

    def unified_calendar(
        self,
        user_id: str,
        *,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> List[UnifiedEvent]:
        events = list(self._events.get(user_id, {}).values())
        if start is not None:
            events = [event for event in events if event.ends_at >= start]
        if end is not None:
            events = [event for event in events if event.starts_at <= end]
        return sorted(events, key=lambda item: item.starts_at)

    def search(self, user_id: str, query: str, *, limit: int = 50) -> List[UnifiedMessage]:
        needle = query.casefold().strip()
        if not needle:
            return []
        matches = [
            message
            for message in self._messages.get(user_id, {}).values()
            if needle in message.subject.casefold()
            or needle in message.body_preview.casefold()
            or needle in message.sender.name.casefold()
            or needle in message.sender.address.casefold()
        ]
        return sorted(matches, key=lambda item: item.sent_at, reverse=True)[:limit]

    async def route_action(
        self,
        user_id: str,
        connector_id: str,
        operation: str,
        payload: Dict[str, Any],
        *,
        required_scope: str,
    ) -> Dict[str, Any]:
        if connector_id not in self._connector_classes:
            raise KeyError(f"Communication connector is not registered: {connector_id}")
        return await self.sdk.execute(
            user_id,
            connector_id,
            operation,
            payload,
            required_scope=required_scope,
        )

    def subscribe(
        self,
        user_id: str,
        connector_id: str,
        endpoint_url: str,
        *,
        events: Optional[List[WebhookEvent]] = None,
        secret: Optional[str] = None,
    ) -> WebhookRegistration:
        if connector_id not in self._connector_classes:
            raise KeyError(f"Communication connector is not registered: {connector_id}")
        return self.sdk.register_webhook(
            user_id,
            connector_id,
            endpoint_url,
            events or [WebhookEvent.CREATED, WebhookEvent.UPDATED, WebhookEvent.SYNCED],
            secret=secret,
        )

    def export_state(self, user_id: str) -> Dict[str, Any]:
        def serialize(value: Any) -> Any:
            if isinstance(value, datetime):
                return value.isoformat()
            if isinstance(value, list):
                return [serialize(item) for item in value]
            if isinstance(value, dict):
                return {key: serialize(item) for key, item in value.items()}
            return value

        return {
            "messages": [serialize(asdict(item)) for item in self.unified_inbox(user_id)],
            "events": [serialize(asdict(item)) for item in self.unified_calendar(user_id)],
        }

    @staticmethod
    def _identity(value: Any) -> CommunicationIdentity:
        if isinstance(value, str):
            return CommunicationIdentity(address=value)
        value = value or {}
        return CommunicationIdentity(
            address=str(value.get("address") or value.get("email") or value.get("id") or ""),
            name=str(value.get("name", "")),
            provider_id=str(value.get("provider_id") or value.get("id") or ""),
        )

    @classmethod
    def _normalize_message(cls, connector_id: str, item: Dict[str, Any]) -> UnifiedMessage:
        sent_at = cls._timestamp(item.get("sent_at") or item.get("timestamp"))
        sender = cls._identity(item.get("sender") or item.get("from"))
        recipients = [cls._identity(value) for value in item.get("recipients", item.get("to", []))]
        subject = str(item.get("subject", ""))
        preview = str(item.get("body_preview") or item.get("preview") or item.get("text") or "")
        raw_id = item.get("message_id") or item.get("id")
        message_id = str(raw_id or hashlib.sha256(
            f"{connector_id}|{sender.address}|{subject}|{sent_at.isoformat()}".encode()
        ).hexdigest()[:24])
        return UnifiedMessage(
            message_id=message_id,
            provider=str(item.get("provider", connector_id)),
            connector_id=connector_id,
            conversation_id=str(item.get("conversation_id") or item.get("thread_id") or message_id),
            sender=sender,
            recipients=recipients,
            subject=subject,
            body_preview=preview,
            sent_at=sent_at,
            channel=str(item.get("channel", "email")),
            unread=bool(item.get("unread", False)),
            labels=list(item.get("labels", [])),
            metadata=dict(item.get("metadata", {})),
        )

    @classmethod
    def _normalize_event(cls, connector_id: str, item: Dict[str, Any]) -> UnifiedEvent:
        starts_at = cls._timestamp(item.get("starts_at") or item.get("start"))
        ends_at = cls._timestamp(item.get("ends_at") or item.get("end") or starts_at)
        raw_id = item.get("event_id") or item.get("id")
        event_id = str(raw_id or hashlib.sha256(
            f"{connector_id}|{item.get('title', '')}|{starts_at.isoformat()}".encode()
        ).hexdigest()[:24])
        return UnifiedEvent(
            event_id=event_id,
            provider=str(item.get("provider", connector_id)),
            connector_id=connector_id,
            title=str(item.get("title") or item.get("subject") or "Evento"),
            starts_at=starts_at,
            ends_at=ends_at,
            attendees=[cls._identity(value) for value in item.get("attendees", [])],
            meeting_url=item.get("meeting_url") or item.get("join_url"),
            metadata=dict(item.get("metadata", {})),
        )

    @staticmethod
    def _timestamp(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, str) and value:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc)
