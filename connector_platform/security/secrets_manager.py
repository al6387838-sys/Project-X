"""
Secrets Manager — LifeOS Integration Framework.

Provides namespaced, authenticated secret storage with versioning, rotation,
expiration and auditability. Production deployments can inject a durable
SecretBackend backed by Cloudflare bindings or an external KMS. The default
backend is intentionally in-memory and is suitable for tests and local runs.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol


class SecretBackend(Protocol):
    """Minimal persistence contract required by SecretsManager."""

    def put(self, key: str, value: str) -> None: ...
    def get(self, key: str) -> Optional[str]: ...
    def delete(self, key: str) -> None: ...
    def list_keys(self, prefix: str = "") -> List[str]: ...


class InMemorySecretBackend:
    """Ephemeral backend used for local execution and deterministic tests."""

    def __init__(self):
        self._values: Dict[str, str] = {}

    def put(self, key: str, value: str) -> None:
        self._values[key] = value

    def get(self, key: str) -> Optional[str]:
        return self._values.get(key)

    def delete(self, key: str) -> None:
        self._values.pop(key, None)

    def list_keys(self, prefix: str = "") -> List[str]:
        return sorted(key for key in self._values if key.startswith(prefix))


@dataclass(frozen=True)
class SecretRef:
    """Stable reference to a secret version; never contains secret material."""

    tenant_id: str
    user_id: str
    connector_id: str
    name: str
    version: int
    created_at: datetime
    expires_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def namespace(self) -> str:
        return f"{self.tenant_id}/{self.user_id}/{self.connector_id}/{self.name}"


class SecretsManager:
    """
    Central secret lifecycle manager for all integrations.

    The built-in authenticated envelope uses separate encryption and MAC keys
    derived from a 256-bit master key. Durable production deployments should
    inject a backend whose storage is bound to Cloudflare or an external KMS.
    """

    ENV_KEY = "LIFEOS_SECRETS_MASTER_KEY"

    def __init__(
        self,
        master_key: Optional[bytes | str] = None,
        backend: Optional[SecretBackend] = None,
    ):
        self._backend = backend or InMemorySecretBackend()
        self._master_key = self._normalize_master_key(master_key)
        self._audit_log: List[Dict[str, Any]] = []

    @classmethod
    def _normalize_master_key(cls, supplied: Optional[bytes | str]) -> bytes:
        value: bytes
        if supplied is None:
            env_value = os.getenv(cls.ENV_KEY)
            value = env_value.encode("utf-8") if env_value else secrets.token_bytes(32)
        elif isinstance(supplied, str):
            value = supplied.encode("utf-8")
        else:
            value = supplied
        if len(value) < 32:
            value = hashlib.sha256(value).digest()
        return value

    @staticmethod
    def _validate_segment(value: str, field_name: str) -> str:
        cleaned = value.strip()
        if not cleaned or any(char in cleaned for char in ("/", "\\", "..")):
            raise ValueError(f"Invalid {field_name}")
        return cleaned

    def _namespace(
        self,
        tenant_id: str,
        user_id: str,
        connector_id: str,
        name: str,
    ) -> str:
        parts = (
            self._validate_segment(tenant_id, "tenant_id"),
            self._validate_segment(user_id, "user_id"),
            self._validate_segment(connector_id, "connector_id"),
            self._validate_segment(name, "secret name"),
        )
        return "/".join(parts)

    def _derive_key(self, purpose: bytes) -> bytes:
        return hmac.new(self._master_key, b"lifeos-integrations:" + purpose, hashlib.sha256).digest()

    @staticmethod
    def _xor(data: bytes, mask: bytes) -> bytes:
        return bytes(left ^ right for left, right in zip(data, mask))

    def _keystream(self, nonce: bytes, length: int) -> bytes:
        key = self._derive_key(b"encryption")
        output = bytearray()
        counter = 0
        while len(output) < length:
            block = hmac.new(key, nonce + counter.to_bytes(8, "big"), hashlib.sha256).digest()
            output.extend(block)
            counter += 1
        return bytes(output[:length])

    def _seal(self, plaintext: str, aad: str) -> str:
        nonce = secrets.token_bytes(16)
        data = plaintext.encode("utf-8")
        ciphertext = self._xor(data, self._keystream(nonce, len(data)))
        auth_key = self._derive_key(b"authentication")
        tag = hmac.new(auth_key, aad.encode("utf-8") + nonce + ciphertext, hashlib.sha256).digest()
        payload = {
            "v": 1,
            "n": base64.urlsafe_b64encode(nonce).decode("ascii"),
            "c": base64.urlsafe_b64encode(ciphertext).decode("ascii"),
            "t": base64.urlsafe_b64encode(tag).decode("ascii"),
        }
        return json.dumps(payload, separators=(",", ":"), sort_keys=True)

    def _open(self, envelope: str, aad: str) -> str:
        payload = json.loads(envelope)
        if payload.get("v") != 1:
            raise ValueError("Unsupported secret envelope version")
        nonce = base64.urlsafe_b64decode(payload["n"])
        ciphertext = base64.urlsafe_b64decode(payload["c"])
        received_tag = base64.urlsafe_b64decode(payload["t"])
        auth_key = self._derive_key(b"authentication")
        expected_tag = hmac.new(
            auth_key,
            aad.encode("utf-8") + nonce + ciphertext,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(received_tag, expected_tag):
            raise ValueError("Secret integrity validation failed")
        plaintext = self._xor(ciphertext, self._keystream(nonce, len(ciphertext)))
        return plaintext.decode("utf-8")

    @staticmethod
    def _utcnow() -> datetime:
        return datetime.now(timezone.utc)

    def _index_key(self, namespace: str) -> str:
        return f"index/{namespace}"

    def _version_key(self, namespace: str, version: int) -> str:
        return f"secret/{namespace}/v{version}"

    def _audit(self, action: str, namespace: str, version: Optional[int], actor_id: str) -> None:
        self._audit_log.append({
            "timestamp": self._utcnow().isoformat(),
            "action": action,
            "namespace": namespace,
            "version": version,
            "actor_id": actor_id,
        })
        if len(self._audit_log) > 5000:
            self._audit_log = self._audit_log[-5000:]

    def put_secret(
        self,
        tenant_id: str,
        user_id: str,
        connector_id: str,
        name: str,
        value: str,
        *,
        expires_at: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None,
        actor_id: str = "system",
    ) -> SecretRef:
        if not isinstance(value, str) or not value:
            raise ValueError("Secret value must be a non-empty string")
        namespace = self._namespace(tenant_id, user_id, connector_id, name)
        index_key = self._index_key(namespace)
        current_raw = self._backend.get(index_key)
        current = json.loads(current_raw) if current_raw else {"latest": 0, "versions": []}
        version = int(current["latest"]) + 1
        created_at = self._utcnow()
        expires_value = expires_at.astimezone(timezone.utc).isoformat() if expires_at else None
        record = {
            "namespace": namespace,
            "version": version,
            "created_at": created_at.isoformat(),
            "expires_at": expires_value,
            "metadata": metadata or {},
            "envelope": self._seal(value, f"{namespace}:v{version}"),
        }
        self._backend.put(self._version_key(namespace, version), json.dumps(record, separators=(",", ":")))
        current["latest"] = version
        current["versions"] = [*current.get("versions", []), version]
        self._backend.put(index_key, json.dumps(current, separators=(",", ":")))
        self._audit("secret.created", namespace, version, actor_id)
        return SecretRef(
            tenant_id=tenant_id,
            user_id=user_id,
            connector_id=connector_id,
            name=name,
            version=version,
            created_at=created_at,
            expires_at=expires_at,
            metadata=dict(metadata or {}),
        )

    def get_secret(
        self,
        tenant_id: str,
        user_id: str,
        connector_id: str,
        name: str,
        *,
        version: Optional[int] = None,
        actor_id: str = "system",
    ) -> Optional[str]:
        namespace = self._namespace(tenant_id, user_id, connector_id, name)
        index_raw = self._backend.get(self._index_key(namespace))
        if not index_raw:
            self._audit("secret.miss", namespace, version, actor_id)
            return None
        index = json.loads(index_raw)
        selected = int(version or index["latest"])
        record_raw = self._backend.get(self._version_key(namespace, selected))
        if not record_raw:
            self._audit("secret.miss", namespace, selected, actor_id)
            return None
        record = json.loads(record_raw)
        if record.get("expires_at"):
            expiry = datetime.fromisoformat(record["expires_at"])
            if self._utcnow() >= expiry:
                self._audit("secret.expired", namespace, selected, actor_id)
                return None
        value = self._open(record["envelope"], f"{namespace}:v{selected}")
        self._audit("secret.accessed", namespace, selected, actor_id)
        return value

    def rotate_secret(self, *args: Any, **kwargs: Any) -> SecretRef:
        """Create a new active version while retaining previous versions."""
        return self.put_secret(*args, **kwargs)

    def delete_secret(
        self,
        tenant_id: str,
        user_id: str,
        connector_id: str,
        name: str,
        *,
        actor_id: str = "system",
    ) -> bool:
        namespace = self._namespace(tenant_id, user_id, connector_id, name)
        index_key = self._index_key(namespace)
        index_raw = self._backend.get(index_key)
        if not index_raw:
            return False
        index = json.loads(index_raw)
        for version in index.get("versions", []):
            self._backend.delete(self._version_key(namespace, int(version)))
        self._backend.delete(index_key)
        self._audit("secret.deleted", namespace, None, actor_id)
        return True

    def delete_connector_secrets(
        self,
        tenant_id: str,
        user_id: str,
        connector_id: str,
        *,
        actor_id: str = "system",
    ) -> int:
        prefix = f"index/{self._namespace(tenant_id, user_id, connector_id, '_placeholder').rsplit('/', 1)[0]}/"
        names = [key[len(prefix):] for key in self._backend.list_keys(prefix)]
        deleted = 0
        for name in names:
            deleted += int(self.delete_secret(
                tenant_id,
                user_id,
                connector_id,
                name,
                actor_id=actor_id,
            ))
        return deleted

    def exists(self, tenant_id: str, user_id: str, connector_id: str, name: str) -> bool:
        namespace = self._namespace(tenant_id, user_id, connector_id, name)
        return self._backend.get(self._index_key(namespace)) is not None

    def list_metadata(
        self,
        tenant_id: str,
        user_id: str,
        connector_id: str,
    ) -> List[SecretRef]:
        prefix = f"index/{self._namespace(tenant_id, user_id, connector_id, '_placeholder').rsplit('/', 1)[0]}/"
        refs: List[SecretRef] = []
        for key in self._backend.list_keys(prefix):
            name = key[len(prefix):]
            index = json.loads(self._backend.get(key) or "{}")
            version = int(index.get("latest", 0))
            record_raw = self._backend.get(self._version_key(key[len("index/"):], version))
            if not record_raw:
                continue
            record = json.loads(record_raw)
            refs.append(SecretRef(
                tenant_id=tenant_id,
                user_id=user_id,
                connector_id=connector_id,
                name=name,
                version=version,
                created_at=datetime.fromisoformat(record["created_at"]),
                expires_at=datetime.fromisoformat(record["expires_at"]) if record.get("expires_at") else None,
                metadata=dict(record.get("metadata", {})),
            ))
        return refs

    def get_audit_log(self, namespace_prefix: Optional[str] = None) -> List[Dict[str, Any]]:
        if namespace_prefix:
            return [entry.copy() for entry in self._audit_log if entry["namespace"].startswith(namespace_prefix)]
        return [entry.copy() for entry in self._audit_log]

    @staticmethod
    def redact(value: Optional[str]) -> str:
        if not value:
            return "<empty>"
        if len(value) <= 8:
            return "*" * len(value)
        return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


class LegacyCredentialVaultAdapter:
    """CredentialVault-compatible adapter backed by SecretsManager."""

    def __init__(
        self,
        manager: SecretsManager,
        tenant_id: str = "default",
        user_id: str = "system",
        connector_id: str = "legacy",
    ):
        self._manager = manager
        self._tenant_id = tenant_id
        self._user_id = user_id
        self._connector_id = connector_id

    def store(self, key: str, value: str, key_id: str = "default") -> None:
        self._manager.put_secret(
            self._tenant_id,
            self._user_id,
            self._connector_id,
            hashlib.sha256(key.encode("utf-8")).hexdigest(),
            value,
            metadata={"legacy_key_id": key_id},
        )

    def retrieve(self, key: str) -> Optional[str]:
        return self._manager.get_secret(
            self._tenant_id,
            self._user_id,
            self._connector_id,
            hashlib.sha256(key.encode("utf-8")).hexdigest(),
        )

    def delete(self, key: str) -> None:
        self._manager.delete_secret(
            self._tenant_id,
            self._user_id,
            self._connector_id,
            hashlib.sha256(key.encode("utf-8")).hexdigest(),
        )

    def exists(self, key: str) -> bool:
        return self._manager.exists(
            self._tenant_id,
            self._user_id,
            self._connector_id,
            hashlib.sha256(key.encode("utf-8")).hexdigest(),
        )
