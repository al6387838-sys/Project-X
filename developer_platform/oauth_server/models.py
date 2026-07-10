"""
LifeOS OAuth 2.0 — Modelos de Dados
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import List, Optional


class OAuthScope(str, Enum):
    """Escopos oficiais da LifeOS API."""
    # Memory
    READ_MEMORY = "read:memory"
    WRITE_MEMORY = "write:memory"
    DELETE_MEMORY = "delete:memory"

    # Timeline
    READ_TIMELINE = "read:timeline"
    WRITE_TIMELINE = "write:timeline"

    # Decisions
    READ_DECISIONS = "read:decisions"
    WRITE_DECISIONS = "write:decisions"

    # Insights
    READ_INSIGHTS = "read:insights"

    # Webhooks
    MANAGE_WEBHOOKS = "manage:webhooks"

    # API Keys
    MANAGE_API_KEYS = "manage:api_keys"

    # Developer
    DEVELOPER_SANDBOX = "developer:sandbox"

    # Profile
    READ_PROFILE = "read:profile"

    @classmethod
    def all_scopes(cls) -> List[str]:
        return [s.value for s in cls]

    @classmethod
    def default_scopes(cls) -> List[str]:
        return [cls.READ_MEMORY.value, cls.READ_TIMELINE.value, cls.READ_PROFILE.value]


@dataclass
class OAuthApp:
    """Aplicação registrada no LifeOS Developer Portal."""
    app_id: str
    name: str
    description: str
    client_id: str = field(default_factory=lambda: f"lk_client_{secrets.token_hex(16)}")
    client_secret: str = field(default_factory=lambda: f"lk_secret_{secrets.token_hex(32)}")
    redirect_uris: List[str] = field(default_factory=list)
    allowed_scopes: List[str] = field(default_factory=OAuthScope.default_scopes)
    owner_id: str = ""
    website_url: str = ""
    logo_url: str = ""
    is_verified: bool = False
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_public_dict(self) -> dict:
        """Retorna dados públicos (sem client_secret)."""
        return {
            "app_id": self.app_id,
            "name": self.name,
            "description": self.description,
            "client_id": self.client_id,
            "redirect_uris": self.redirect_uris,
            "allowed_scopes": self.allowed_scopes,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class AuthorizationCode:
    """Código de autorização temporário (Authorization Code Flow)."""
    code: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    client_id: str = ""
    user_id: str = ""
    scopes: List[str] = field(default_factory=list)
    redirect_uri: str = ""
    code_challenge: Optional[str] = None  # PKCE
    code_challenge_method: str = "S256"
    expires_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    used: bool = False

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at

    def is_valid(self) -> bool:
        return not self.used and not self.is_expired()


@dataclass
class OAuthToken:
    """Token de acesso OAuth 2.0."""
    access_token: str = field(default_factory=lambda: f"lk_token_{secrets.token_urlsafe(48)}")
    refresh_token: str = field(default_factory=lambda: f"lk_refresh_{secrets.token_urlsafe(48)}")
    token_type: str = "Bearer"
    client_id: str = ""
    user_id: str = ""
    scopes: List[str] = field(default_factory=list)
    expires_in: int = 3600  # seconds
    expires_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=1)
    )
    refresh_expires_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=30)
    )
    revoked: bool = False

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at

    def is_valid(self) -> bool:
        return not self.revoked and not self.is_expired()

    def to_response_dict(self) -> dict:
        return {
            "access_token": self.access_token,
            "token_type": self.token_type,
            "expires_in": self.expires_in,
            "refresh_token": self.refresh_token,
            "scope": " ".join(self.scopes),
        }
