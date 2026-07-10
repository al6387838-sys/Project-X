"""
Hardening Policies — Security hardening policies for LifeOS.
SIGMA-004: Enterprise Security Hardening
"""

import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class HardeningLevel(Enum):
    STANDARD = "standard"
    ENHANCED = "enhanced"
    MAXIMUM = "maximum"


@dataclass
class HardeningPolicy:
    """A single security hardening policy."""
    policy_id: str
    name: str
    category: str
    description: str
    is_enabled: bool = True
    settings: Dict[str, Any] = field(default_factory=dict)


class HardeningPolicies:
    """
    World-Class Security Hardening Policies for LifeOS.

    SIGMA-004: Comprehensive hardening across all layers.
    """

    def __init__(self, name: str = "hardening_policies") -> None:
        self.name = name
        self._policies: Dict[str, HardeningPolicy] = {}
        self._level = HardeningLevel.MAXIMUM
        self._init_policies()

    def _init_policies(self) -> None:
        """Initialize all hardening policies."""
        policies = [
            # Authentication
            HardeningPolicy("AUTH-001", "MFA Required", "authentication", "Multi-factor authentication required for all accounts", settings={"methods": ["totp", "webauthn"], "enforce": True}),
            HardeningPolicy("AUTH-002", "Password Policy", "authentication", "Strong password requirements", settings={"min_length": 12, "require_uppercase": True, "require_number": True, "require_special": True}),
            HardeningPolicy("AUTH-003", "Account Lockout", "authentication", "Account lockout after failed attempts", settings={"max_attempts": 5, "lockout_duration_min": 30}),
            HardeningPolicy("AUTH-004", "Session Timeout", "authentication", "Automatic session expiration", settings={"idle_timeout_min": 15, "absolute_timeout_h": 8}),

            # Encryption
            HardeningPolicy("ENC-001", "TLS 1.3 Only", "encryption", "Enforce TLS 1.3 for all connections", settings={"min_version": "1.3", "ciphers": ["TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256"]}),
            HardeningPolicy("ENC-002", "Data at Rest", "encryption", "AES-256 encryption for all stored data", settings={"algorithm": "AES-256-GCM", "key_rotation_days": 365}),
            HardeningPolicy("ENC-003", "Field-Level Encryption", "encryption", "Sensitive fields encrypted individually", settings={"fields": ["ssn", "credit_card", "password_hash", "health_data"]}),

            # Network
            HardeningPolicy("NET-001", "WAF Enabled", "network", "Web Application Firewall active", settings={"mode": "block", "rules": "owasp_core"}),
            HardeningPolicy("NET-002", "DDoS Protection", "network", "DDoS mitigation enabled", settings={"rate_limit": 1000, "burst": 100}),
            HardeningPolicy("NET-003", "IP Allowlisting", "network", "Administrative access restricted by IP", settings={"admin_ips": "configured"}),

            # Headers
            HardeningPolicy("HDR-001", "CSP", "headers", "Content Security Policy", settings={"policy": "default-src 'self'"}),
            HardeningPolicy("HDR-002", "HSTS", "headers", "Strict Transport Security", settings={"max_age": 31536000, "include_subdomains": True}),
            HardeningPolicy("HDR-003", "X-Frame-Options", "headers", "Clickjacking protection", settings={"value": "DENY"}),

            # Database
            HardeningPolicy("DB-001", "Connection Encryption", "database", "Encrypted database connections", settings={"ssl_mode": "verify-full"}),
            HardeningPolicy("DB-002", "Query Logging", "database", "All queries logged for audit", settings={"log_queries": True, "log_slow_queries": True}),
            HardeningPolicy("DB-003", "Backup Encryption", "database", "Encrypted backups", settings={"encryption": "AES-256", "retention_days": 90}),

            # API Security
            HardeningPolicy("API-001", "Rate Limiting", "api", "API rate limiting", settings={"default_rpm": 100, "authenticated_rpm": 1000}),
            HardeningPolicy("API-002", "API Key Validation", "api", "API key validation and rotation", settings={"min_length": 32, "rotation_days": 90}),
            HardeningPolicy("API-003", "Input Validation", "api", "Strict input validation", settings={"max_payload_kb": 1024, "content_types": ["application/json"]}),

            # Infrastructure
            HardeningPolicy("INF-001", "Secret Management", "infrastructure", "Secrets stored in vault", settings={"vault": "enabled", "auto_rotate": True}),
            HardeningPolicy("INF-002", "Container Security", "infrastructure", "Container hardening", settings={"read_only_fs": True, "no_privileged": True}),
            HardeningPolicy("INF-003", "Network Segmentation", "infrastructure", "Microsegmentation enabled", settings={"zones": ["public", "private", "restricted"]}),
        ]

        for p in policies:
            self._policies[p.policy_id] = p

    def enable_policy(self, policy_id: str) -> bool:
        policy = self._policies.get(policy_id)
        if policy:
            policy.is_enabled = True
            return True
        return False

    def disable_policy(self, policy_id: str) -> bool:
        policy = self._policies.get(policy_id)
        if policy:
            policy.is_enabled = False
            return True
        return False

    def get_policies_by_category(self, category: str) -> List[HardeningPolicy]:
        return [p for p in self._policies.values() if p.category == category and p.is_enabled]

    def get_all_enabled(self) -> List[HardeningPolicy]:
        return [p for p in self._policies.values() if p.is_enabled]

    def stats(self) -> Dict[str, Any]:
        enabled = sum(1 for p in self._policies.values() if p.is_enabled)
        return {
            "name": self.name,
            "level": self._level.value,
            "total_policies": len(self._policies),
            "enabled": enabled,
            "disabled": len(self._policies) - enabled,
            "categories": list(set(p.category for p in self._policies.values())),
        }

    def __repr__(self) -> str:
        enabled = sum(1 for p in self._policies.values() if p.is_enabled)
        return (
            f"HardeningPolicies(name={self.name!r}, "
            f"enabled={enabled}/{len(self._policies)}, "
            f"level={self._level.value})"
        )
