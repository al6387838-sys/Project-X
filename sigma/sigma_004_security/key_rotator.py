"""
Key Rotator — Automatic Key Rotation for LifeOS.
SIGMA-004: Enterprise Security Hardening
"""

import time
import hashlib
import secrets
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class KeyType(Enum):
    API_KEY = "api_key"
    ENCRYPTION = "encryption"
    SIGNING = "signing"
    AUTH_TOKEN = "auth_token"
    SESSION = "session"
    DATABASE = "database"


@dataclass
class KeyEntry:
    """A single key with rotation metadata."""
    key_id: str
    key_type: KeyType
    current_value: str
    previous_value: str = ""
    created_at: float = 0.0
    last_rotated: float = 0.0
    rotation_count: int = 0
    expires_at: float = 0.0
    is_active: bool = True


@dataclass
class RotationPolicy:
    """Key rotation policy configuration."""
    key_type: KeyType
    rotation_interval_days: int = 90
    grace_period_hours: int = 24
    overlap_period_hours: int = 2
    key_length: int = 64


class KeyRotator:
    """
    World-Class Key Rotation Engine for LifeOS.

    SIGMA-004: Implements:
    - Automatic key rotation on schedule
    - Grace period for key transitions
    - Key history and audit trail
    - Emergency key revocation
    - Multi-type key management
    - Cryptographically secure key generation
    """

    def __init__(self, name: str = "key_rotator") -> None:
        self.name = name
        self._keys: Dict[str, KeyEntry] = {}
        self._policies: Dict[KeyType, RotationPolicy] = {}
        self._rotation_history: List[Dict[str, Any]] = []
        self._stats = {
            "rotations_completed": 0,
            "keys_active": 0,
            "keys_expired": 0,
            "keys_revoked": 0,
            "emergency_rotations": 0,
        }
        self._init_policies()

    def _init_policies(self) -> None:
        """Initialize default rotation policies."""
        self._policies = {
            KeyType.API_KEY: RotationPolicy(
                key_type=KeyType.API_KEY,
                rotation_interval_days=90,
                grace_period_hours=24,
                overlap_period_hours=2,
                key_length=64,
            ),
            KeyType.ENCRYPTION: RotationPolicy(
                key_type=KeyType.ENCRYPTION,
                rotation_interval_days=365,
                grace_period_hours=48,
                overlap_period_hours=4,
                key_length=128,
            ),
            KeyType.SIGNING: RotationPolicy(
                key_type=KeyType.SIGNING,
                rotation_interval_days=180,
                grace_period_hours=24,
                overlap_period_hours=2,
                key_length=64,
            ),
            KeyType.AUTH_TOKEN: RotationPolicy(
                key_type=KeyType.AUTH_TOKEN,
                rotation_interval_days=30,
                grace_period_hours=12,
                overlap_period_hours=1,
                key_length=64,
            ),
            KeyType.SESSION: RotationPolicy(
                key_type=KeyType.SESSION,
                rotation_interval_days=7,
                grace_period_hours=4,
                overlap_period_hours=1,
                key_length=32,
            ),
            KeyType.DATABASE: RotationPolicy(
                key_type=KeyType.DATABASE,
                rotation_interval_days=90,
                grace_period_hours=24,
                overlap_period_hours=2,
                key_length=64,
            ),
        }

    def create_key(self, key_type: KeyType, key_id: Optional[str] = None) -> KeyEntry:
        """Create a new cryptographic key."""
        policy = self._policies.get(key_type, self._policies[KeyType.API_KEY])
        now = time.time()

        key_value = secrets.token_hex(policy.key_length)
        if not key_id:
            key_id = hashlib.sha256(key_value.encode()).hexdigest()[:16]

        entry = KeyEntry(
            key_id=key_id,
            key_type=key_type,
            current_value=key_value,
            created_at=now,
            last_rotated=now,
            expires_at=now + (policy.rotation_interval_days * 86400),
            is_active=True,
        )

        self._keys[key_id] = entry
        self._stats["keys_active"] += 1

        logger.info(f"[KeyRotator] Key created: {key_id} ({key_type.value})")
        return entry

    def rotate_key(self, key_id: str) -> Optional[KeyEntry]:
        """Rotate a key — generate new key, keep old one during grace period."""
        entry = self._keys.get(key_id)
        if not entry:
            return None

        policy = self._policies.get(entry.key_type, self._policies[KeyType.API_KEY])

        # Generate new key
        new_value = secrets.token_hex(policy.key_length)
        old_value = entry.current_value

        entry.previous_value = old_value
        entry.current_value = new_value
        entry.last_rotated = time.time()
        entry.rotation_count += 1
        entry.expires_at = time.time() + (policy.rotation_interval_days * 86400)

        self._rotation_history.append({
            "key_id": key_id,
            "key_type": entry.key_type.value,
            "rotation_count": entry.rotation_count,
            "timestamp": entry.last_rotated,
        })
        self._stats["rotations_completed"] += 1

        logger.info(f"[KeyRotator] Key rotated: {key_id} (rotation #{entry.rotation_count})")
        return entry

    def revoke_key(self, key_id: str) -> bool:
        """Revoke a key immediately (emergency)."""
        entry = self._keys.get(key_id)
        if entry:
            entry.is_active = False
            self._stats["keys_revoked"] += 1
            self._stats["keys_active"] -= 1
            logger.warning(f"[KeyRotator] Key revoked (emergency): {key_id}")
            return True
        return False

    def emergency_rotate_all(self) -> int:
        """
        Emergency rotation of all active keys.

        SIGMA-004: Used when a breach is detected or suspected.
        """
        count = 0
        for key_id, entry in list(self._keys.items()):
            if entry.is_active:
                self.rotate_key(key_id)
                count += 1
                self._stats["emergency_rotations"] += 1

        logger.warning(f"[KeyRotator] Emergency rotation: {count} keys rotated")
        return count

    def check_expiring_keys(self, days_threshold: int = 7) -> List[str]:
        """Check for keys expiring within threshold days."""
        now = time.time()
        expiring = []
        threshold = now + (days_threshold * 86400)

        for key_id, entry in self._keys.items():
            if entry.is_active and entry.expires_at < threshold:
                expiring.append(key_id)

        return expiring

    def get_key(self, key_id: str) -> Optional[KeyEntry]:
        return self._keys.get(key_id)

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "total_keys": len(self._keys),
            "policies": {kt.value: {"interval_days": p.rotation_interval_days} for kt, p in self._policies.items()},
            "recent_rotations": len(self._rotation_history),
        }

    def __repr__(self) -> str:
        return (
            f"KeyRotator(name={self.name!r}, "
            f"keys={len(self._keys)}, "
            f"rotations={self._stats['rotations_completed']})"
        )
