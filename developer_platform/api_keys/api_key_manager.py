"""
LifeOS API Key Manager
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional


class APIKeyPlan(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class APIKeyStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"
    SUSPENDED = "suspended"


@dataclass
class APIKey:
    """Representa uma API Key do LifeOS."""
    key_id: str
    name: str
    app_id: str
    owner_id: str
    plan: APIKeyPlan = APIKeyPlan.FREE
    status: APIKeyStatus = APIKeyStatus.ACTIVE
    scopes: List[str] = field(default_factory=list)
    # O valor real da key (só retornado na criação)
    _raw_key: str = field(default="", repr=False)
    # Hash armazenado (nunca o valor real)
    key_hash: str = field(default="")
    key_prefix: str = ""  # ex: lk_live_abc123
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    total_requests: int = 0
    metadata: Dict = field(default_factory=dict)

    def is_active(self) -> bool:
        if self.status != APIKeyStatus.ACTIVE:
            return False
        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False
        return True

    def to_dict(self, include_raw: bool = False) -> dict:
        result = {
            "key_id": self.key_id,
            "name": self.name,
            "app_id": self.app_id,
            "plan": self.plan.value,
            "status": self.status.value,
            "scopes": self.scopes,
            "key_prefix": self.key_prefix,
            "created_at": self.created_at.isoformat(),
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "total_requests": self.total_requests,
        }
        if include_raw:
            result["key"] = self._raw_key
        return result


class APIKeyManager:
    """
    Gerenciador de API Keys do LifeOS.

    Responsável por:
    - Criação de chaves com prefixo padronizado (lk_live_, lk_test_)
    - Armazenamento seguro (apenas hash SHA-256)
    - Validação de chaves
    - Revogação e suspensão
    - Rastreamento de uso
    - Limites por plano
    """

    KEY_RATE_LIMITS = {
        APIKeyPlan.FREE: 60,        # req/min
        APIKeyPlan.PRO: 300,
        APIKeyPlan.ENTERPRISE: 1000,
    }

    def __init__(self):
        self._keys: Dict[str, APIKey] = {}  # key_hash -> APIKey
        self._keys_by_id: Dict[str, APIKey] = {}  # key_id -> APIKey

    def create_key(
        self,
        name: str,
        app_id: str,
        owner_id: str,
        scopes: List[str],
        plan: APIKeyPlan = APIKeyPlan.FREE,
        environment: str = "live",
        expires_at: Optional[datetime] = None,
        metadata: Optional[Dict] = None,
    ) -> APIKey:
        """
        Cria uma nova API Key.

        Retorna o objeto APIKey com o valor real da chave em _raw_key.
        ATENÇÃO: O valor real só é retornado neste momento. Armazene-o com segurança.
        """
        # Gerar chave com prefixo padronizado
        env_prefix = "live" if environment == "live" else "test"
        raw_key = f"lk_{env_prefix}_{secrets.token_hex(32)}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        key_prefix = raw_key[:20] + "..."
        key_id = f"key_{secrets.token_hex(8)}"

        api_key = APIKey(
            key_id=key_id,
            name=name,
            app_id=app_id,
            owner_id=owner_id,
            plan=plan,
            scopes=scopes,
            _raw_key=raw_key,
            key_hash=key_hash,
            key_prefix=key_prefix,
            expires_at=expires_at,
            metadata=metadata or {},
        )

        self._keys[key_hash] = api_key
        self._keys_by_id[key_id] = api_key

        return api_key

    def validate_key(self, raw_key: str) -> Dict:
        """
        Valida uma API Key e retorna informações para o middleware.
        """
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        api_key = self._keys.get(key_hash)

        if not api_key:
            return {"valid": False, "reason": "Key not found."}

        if not api_key.is_active():
            return {"valid": False, "reason": f"Key is {api_key.status.value}."}

        # Atualizar uso
        api_key.last_used_at = datetime.now(timezone.utc)
        api_key.total_requests += 1

        return {
            "valid": True,
            "key_id": api_key.key_id,
            "app_id": api_key.app_id,
            "app_name": api_key.name,
            "owner_id": api_key.owner_id,
            "plan": api_key.plan.value,
            "scopes": api_key.scopes,
            "rate_limit": self.KEY_RATE_LIMITS[api_key.plan],
        }

    def revoke_key(self, key_id: str, owner_id: str) -> bool:
        """Revoga uma API Key."""
        api_key = self._keys_by_id.get(key_id)
        if not api_key or api_key.owner_id != owner_id:
            return False
        api_key.status = APIKeyStatus.REVOKED
        return True

    def suspend_key(self, key_id: str) -> bool:
        """Suspende uma API Key (uso administrativo)."""
        api_key = self._keys_by_id.get(key_id)
        if not api_key:
            return False
        api_key.status = APIKeyStatus.SUSPENDED
        return True

    def list_keys(self, owner_id: str) -> List[Dict]:
        """Lista todas as chaves de um owner."""
        return [
            key.to_dict()
            for key in self._keys_by_id.values()
            if key.owner_id == owner_id
        ]

    def get_usage_stats(self, key_id: str) -> Optional[Dict]:
        """Retorna estatísticas de uso de uma chave."""
        api_key = self._keys_by_id.get(key_id)
        if not api_key:
            return None
        return {
            "key_id": key_id,
            "total_requests": api_key.total_requests,
            "last_used_at": api_key.last_used_at.isoformat() if api_key.last_used_at else None,
            "plan": api_key.plan.value,
            "rate_limit_per_minute": self.KEY_RATE_LIMITS[api_key.plan],
        }
