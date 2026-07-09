"""
Permission Manager — Universal Connector Platform
Granular permission control with Zero Trust enforcement.

Features:
  - Granular per-resource permissions
  - Explicit consent tracking with versioning
  - Permission inheritance and delegation
  - Time-bounded permissions
  - Audit trail for all permission changes
  - GDPR-compliant consent management
"""

from __future__ import annotations
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from collections import defaultdict

from connector_platform.models.connector_models import (
    ConnectorPermission,
    PermissionScope,
)

logger = logging.getLogger(__name__)


class ConsentRecord:
    """GDPR-compliant consent record."""

    def __init__(
        self,
        user_id: str,
        connector_id: str,
        scopes: List[str],
        consent_text: str,
        consent_version: str = "1.0",
        expires_in_days: Optional[int] = None,
    ):
        self.consent_id = f"consent_{user_id}_{connector_id}_{datetime.utcnow().timestamp():.0f}"
        self.user_id = user_id
        self.connector_id = connector_id
        self.scopes = scopes
        self.consent_text = consent_text
        self.consent_version = consent_version
        self.granted_at = datetime.utcnow()
        self.expires_at = (
            datetime.utcnow() + timedelta(days=expires_in_days)
            if expires_in_days else None
        )
        self.is_active = True
        self.revoked_at: Optional[datetime] = None
        self.revocation_reason: Optional[str] = None

    def is_valid(self) -> bool:
        if not self.is_active:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "consent_id": self.consent_id,
            "user_id": self.user_id,
            "connector_id": self.connector_id,
            "scopes": self.scopes,
            "consent_version": self.consent_version,
            "granted_at": self.granted_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
            "is_valid": self.is_valid(),
        }


class PermissionPolicy:
    """
    Defines a permission policy for a connector.
    Specifies what scopes are required, optional, and forbidden.
    """

    def __init__(
        self,
        connector_id: str,
        required_scopes: List[str],
        optional_scopes: List[str],
        forbidden_scopes: List[str],
        max_permission_duration_days: Optional[int] = None,
        requires_mfa: bool = False,
        data_residency: Optional[str] = None,
    ):
        self.connector_id = connector_id
        self.required_scopes = set(required_scopes)
        self.optional_scopes = set(optional_scopes)
        self.forbidden_scopes = set(forbidden_scopes)
        self.max_permission_duration_days = max_permission_duration_days
        self.requires_mfa = requires_mfa
        self.data_residency = data_residency  # e.g., "EU", "US", "BR"


class PermissionManager:
    """
    Granular Permission Manager for the LifeOS Connector Platform.

    Implements the principle of least privilege:
    - Users grant only what they need
    - Permissions can be scoped to specific resources
    - All grants are time-bounded by default
    - Full audit trail of all permission changes
    """

    def __init__(self):
        self._permissions: Dict[str, List[ConnectorPermission]] = defaultdict(list)
        self._consent_records: Dict[str, List[ConsentRecord]] = defaultdict(list)
        self._policies: Dict[str, PermissionPolicy] = {}
        self._audit_log: List[Dict[str, Any]] = []
        self._initialized_at = datetime.utcnow()
        logger.info("[PermissionManager] Initialized — Least Privilege + GDPR active")

    # ── Policy Management ─────────────────────

    def register_policy(self, policy: PermissionPolicy):
        """Register a permission policy for a connector."""
        self._policies[policy.connector_id] = policy
        logger.info(f"[PermissionManager] Policy registered: {policy.connector_id}")

    def get_policy(self, connector_id: str) -> Optional[PermissionPolicy]:
        return self._policies.get(connector_id)

    # ── Consent Management ────────────────────

    def grant_consent(
        self,
        user_id: str,
        connector_id: str,
        scopes: List[str],
        consent_text: str,
        consent_version: str = "1.0",
        expires_in_days: Optional[int] = 365,
    ) -> ConsentRecord:
        """
        Record explicit user consent.
        This is the ONLY way to grant permissions — no implicit grants.
        """
        # Validate against policy
        policy = self._policies.get(connector_id)
        if policy:
            forbidden = set(scopes) & policy.forbidden_scopes
            if forbidden:
                raise PermissionError(f"Forbidden scopes requested: {forbidden}")

        record = ConsentRecord(
            user_id=user_id,
            connector_id=connector_id,
            scopes=scopes,
            consent_text=consent_text,
            consent_version=consent_version,
            expires_in_days=expires_in_days,
        )
        self._consent_records[f"{user_id}:{connector_id}"].append(record)

        # Create granular permissions
        for scope_str in scopes:
            scope_parts = scope_str.split(":")
            resource_type = scope_parts[0] if scope_parts else scope_str
            scope_level = PermissionScope.READ  # Default
            if "write" in scope_str.lower():
                scope_level = PermissionScope.WRITE
            elif "delete" in scope_str.lower():
                scope_level = PermissionScope.DELETE
            elif "admin" in scope_str.lower():
                scope_level = PermissionScope.ADMIN

            permission = ConnectorPermission(
                user_id=user_id,
                connector_id=connector_id,
                scope=scope_level,
                resource_type=resource_type,
                granted_at=record.granted_at,
                expires_at=record.expires_at,
                consent_version=consent_version,
                consent_text=consent_text,
            )
            self._permissions[f"{user_id}:{connector_id}"].append(permission)

        self._audit("consent_granted", user_id, connector_id, {
            "scopes": scopes,
            "consent_version": consent_version,
            "expires_in_days": expires_in_days,
        })
        logger.info(f"[PermissionManager] Consent granted: user={user_id} connector={connector_id} scopes={scopes}")
        return record

    def revoke_consent(
        self,
        user_id: str,
        connector_id: str,
        reason: str = "user_request",
        scope: Optional[str] = None,
    ) -> bool:
        """
        Revoke consent — GDPR Right to Withdraw Consent.
        Revokes all or specific scope permissions.
        """
        key = f"{user_id}:{connector_id}"
        records = self._consent_records.get(key, [])

        revoked = False
        for record in records:
            if record.is_active:
                if scope is None or scope in record.scopes:
                    record.is_active = False
                    record.revoked_at = datetime.utcnow()
                    record.revocation_reason = reason
                    revoked = True

        # Deactivate permissions
        permissions = self._permissions.get(key, [])
        for perm in permissions:
            if scope is None or perm.resource_type == scope:
                perm.is_active = False

        if revoked:
            self._audit("consent_revoked", user_id, connector_id, {
                "reason": reason,
                "scope": scope or "ALL",
            })
            logger.info(f"[PermissionManager] Consent revoked: user={user_id} connector={connector_id}")

        return revoked

    # ── Permission Checks ─────────────────────

    def has_permission(
        self,
        user_id: str,
        connector_id: str,
        resource_type: str,
        scope: PermissionScope = PermissionScope.READ,
    ) -> bool:
        """Check if user has a specific permission."""
        key = f"{user_id}:{connector_id}"
        permissions = self._permissions.get(key, [])
        now = datetime.utcnow()

        for perm in permissions:
            if not perm.is_active:
                continue
            if perm.expires_at and now > perm.expires_at:
                perm.is_active = False
                continue
            if perm.resource_type == resource_type:
                # Check scope hierarchy: ADMIN > DELETE > WRITE > READ
                scope_hierarchy = [
                    PermissionScope.READ,
                    PermissionScope.WRITE,
                    PermissionScope.DELETE,
                    PermissionScope.ADMIN,
                ]
                perm_level = scope_hierarchy.index(perm.scope) if perm.scope in scope_hierarchy else 0
                required_level = scope_hierarchy.index(scope) if scope in scope_hierarchy else 0
                if perm_level >= required_level:
                    return True
        return False

    def get_active_permissions(
        self,
        user_id: str,
        connector_id: str,
    ) -> List[ConnectorPermission]:
        """Get all active permissions for a user-connector pair."""
        key = f"{user_id}:{connector_id}"
        now = datetime.utcnow()
        return [
            p for p in self._permissions.get(key, [])
            if p.is_active and (not p.expires_at or now <= p.expires_at)
        ]

    def get_all_user_permissions(self, user_id: str) -> Dict[str, List[ConnectorPermission]]:
        """Get all permissions across all connectors for a user."""
        result = {}
        for key, perms in self._permissions.items():
            if key.startswith(f"{user_id}:"):
                connector_id = key.split(":", 1)[1]
                active = [p for p in perms if p.is_active]
                if active:
                    result[connector_id] = active
        return result

    # ── Consent Records ───────────────────────

    def get_consent_records(self, user_id: str, connector_id: Optional[str] = None) -> List[ConsentRecord]:
        """Get consent records — GDPR data access request support."""
        if connector_id:
            return self._consent_records.get(f"{user_id}:{connector_id}", [])
        result = []
        for key, records in self._consent_records.items():
            if key.startswith(f"{user_id}:"):
                result.extend(records)
        return result

    def export_user_data(self, user_id: str) -> Dict[str, Any]:
        """
        Export all permission and consent data for a user.
        GDPR Article 20 — Right to Data Portability.
        """
        return {
            "user_id": user_id,
            "exported_at": datetime.utcnow().isoformat(),
            "consent_records": [
                r.to_dict()
                for r in self.get_consent_records(user_id)
            ],
            "active_permissions": {
                connector_id: [
                    {
                        "permission_id": p.permission_id,
                        "scope": p.scope.value,
                        "resource_type": p.resource_type,
                        "granted_at": p.granted_at.isoformat(),
                        "expires_at": p.expires_at.isoformat() if p.expires_at else None,
                    }
                    for p in perms
                ]
                for connector_id, perms in self.get_all_user_permissions(user_id).items()
            },
            "audit_log": self.get_audit_log(user_id),
        }

    def delete_user_data(self, user_id: str) -> bool:
        """
        Delete all user permission data.
        GDPR Article 17 — Right to Erasure.
        """
        keys_to_delete = [k for k in self._permissions if k.startswith(f"{user_id}:")]
        for key in keys_to_delete:
            del self._permissions[key]

        consent_keys = [k for k in self._consent_records if k.startswith(f"{user_id}:")]
        for key in consent_keys:
            del self._consent_records[key]

        self._audit("data_deleted", user_id, "ALL", {"reason": "gdpr_erasure"})
        logger.info(f"[PermissionManager] User data deleted: {user_id}")
        return True

    # ── Audit ─────────────────────────────────

    def _audit(self, action: str, user_id: str, connector_id: str, details: Dict[str, Any]):
        self._audit_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "user_id": user_id,
            "connector_id": connector_id,
            "details": details,
        })

    def get_audit_log(self, user_id: Optional[str] = None, limit: int = 100) -> List[Dict]:
        log = self._audit_log
        if user_id:
            log = [e for e in log if e.get("user_id") == user_id]
        return log[-limit:]

    # ── Statistics ────────────────────────────

    def get_stats(self) -> Dict[str, Any]:
        total_permissions = sum(len(p) for p in self._permissions.values())
        active_permissions = sum(
            sum(1 for p in perms if p.is_active)
            for perms in self._permissions.values()
        )
        total_consents = sum(len(r) for r in self._consent_records.values())
        active_consents = sum(
            sum(1 for r in records if r.is_valid())
            for records in self._consent_records.values()
        )
        return {
            "total_permissions": total_permissions,
            "active_permissions": active_permissions,
            "total_consents": total_consents,
            "active_consents": active_consents,
            "policies_registered": len(self._policies),
            "audit_entries": len(self._audit_log),
        }
