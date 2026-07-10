"""
LifeOS Enterprise Platform — RBAC Engine
EXECUTION-010: Enterprise Platform

Role-Based Access Control (RBAC) completo com:
- Roles predefinidas do sistema
- Custom Roles por organização
- Permission Matrix granular
- Herança de permissões
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set


# ── Recursos do Sistema ────────────────────────────────────────────────────

class Resource(str, Enum):
    ORGANIZATION = "organization"
    WORKSPACE = "workspace"
    TEAM = "team"
    MEMBER = "member"
    ROLE = "role"
    PERMISSION = "permission"
    MEMORY = "memory"
    TIMELINE = "timeline"
    DECISION = "decision"
    INSIGHT = "insight"
    WEBHOOK = "webhook"
    API_KEY = "api_key"
    AUDIT_LOG = "audit_log"
    BILLING = "billing"
    SSO = "sso"
    COMPLIANCE = "compliance"
    SECURITY = "security"
    REPORT = "report"


class Action(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    MANAGE = "manage"
    INVITE = "invite"
    EXPORT = "export"
    CONFIGURE = "configure"
    APPROVE = "approve"
    AUDIT = "audit"


@dataclass
class Permission:
    """Representa uma permissão granular no sistema."""
    resource: Resource
    action: Action
    permission_id: str = field(
        default_factory=lambda: f"perm_{secrets.token_hex(6)}"
    )
    description: str = ""
    conditions: Dict[str, Any] = field(default_factory=dict)

    @property
    def key(self) -> str:
        return f"{self.resource.value}:{self.action.value}"

    def to_dict(self) -> dict:
        return {
            "permission_id": self.permission_id,
            "resource": self.resource.value,
            "action": self.action.value,
            "key": self.key,
            "description": self.description,
        }


@dataclass
class Role:
    """Representa um role (papel) no sistema RBAC."""
    name: str
    org_id: Optional[str] = None   # None = role do sistema (global)
    role_id: str = field(default_factory=lambda: f"role_{secrets.token_hex(8)}")
    description: str = ""
    permissions: Set[str] = field(default_factory=set)  # Set de permission keys
    is_system_role: bool = False
    is_custom: bool = False
    parent_role_id: Optional[str] = None  # Para herança de roles
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def has_permission(self, permission_key: str) -> bool:
        return permission_key in self.permissions or "organization:manage" in self.permissions

    def to_dict(self) -> dict:
        return {
            "role_id": self.role_id,
            "name": self.name,
            "org_id": self.org_id,
            "description": self.description,
            "permissions": sorted(list(self.permissions)),
            "is_system_role": self.is_system_role,
            "is_custom": self.is_custom,
            "permission_count": len(self.permissions),
        }


@dataclass
class RoleAssignment:
    """Atribuição de role a um usuário em um contexto específico."""
    user_id: str
    role_id: str
    org_id: str
    workspace_id: Optional[str] = None
    team_id: Optional[str] = None
    assignment_id: str = field(default_factory=lambda: f"ra_{secrets.token_hex(8)}")
    assigned_by: Optional[str] = None
    assigned_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None

    def is_expired(self) -> bool:
        if not self.expires_at:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def to_dict(self) -> dict:
        return {
            "assignment_id": self.assignment_id,
            "user_id": self.user_id,
            "role_id": self.role_id,
            "org_id": self.org_id,
            "workspace_id": self.workspace_id,
            "team_id": self.team_id,
            "assigned_at": self.assigned_at.isoformat(),
        }


# ── System Roles (predefinidos) ────────────────────────────────────────────

def _build_system_roles() -> Dict[str, Role]:
    """Constrói os roles predefinidos do sistema."""

    # Super Admin — acesso total
    super_admin = Role(
        name="Super Admin",
        role_id="role_super_admin",
        description="Full access to all resources across the organization.",
        is_system_role=True,
        permissions={f"{r.value}:{a.value}" for r in Resource for a in Action},
    )

    # Org Admin — administra a organização
    org_admin = Role(
        name="Organization Admin",
        role_id="role_org_admin",
        description="Full administrative access within an organization.",
        is_system_role=True,
        permissions={
            "organization:read", "organization:update", "organization:configure",
            "workspace:create", "workspace:read", "workspace:update", "workspace:delete", "workspace:manage",
            "team:create", "team:read", "team:update", "team:delete", "team:manage",
            "member:invite", "member:read", "member:update", "member:delete",
            "role:create", "role:read", "role:update", "role:delete", "role:manage",
            "permission:read", "permission:manage",
            "audit_log:read", "audit_log:audit",
            "billing:read", "billing:manage",
            "sso:configure", "sso:read",
            "compliance:read", "compliance:configure",
            "security:read", "security:configure",
            "memory:create", "memory:read", "memory:update", "memory:delete",
            "timeline:create", "timeline:read", "timeline:update",
            "decision:create", "decision:read", "decision:update",
            "insight:read", "report:read", "report:export",
            "api_key:create", "api_key:read", "api_key:delete",
            "webhook:create", "webhook:read", "webhook:delete",
        },
    )

    # Workspace Admin
    workspace_admin = Role(
        name="Workspace Admin",
        role_id="role_workspace_admin",
        description="Administrative access within a specific workspace.",
        is_system_role=True,
        parent_role_id="role_org_admin",
        permissions={
            "workspace:read", "workspace:update", "workspace:manage",
            "team:create", "team:read", "team:update", "team:delete",
            "member:invite", "member:read", "member:update",
            "memory:create", "memory:read", "memory:update", "memory:delete",
            "timeline:create", "timeline:read", "timeline:update",
            "decision:create", "decision:read", "decision:update",
            "insight:read", "report:read",
            "api_key:create", "api_key:read",
            "webhook:create", "webhook:read",
        },
    )

    # Manager
    manager = Role(
        name="Manager",
        role_id="role_manager",
        description="Can manage team members and projects within their scope.",
        is_system_role=True,
        permissions={
            "workspace:read",
            "team:read", "team:update",
            "member:invite", "member:read", "member:update",
            "memory:create", "memory:read", "memory:update",
            "timeline:create", "timeline:read",
            "decision:create", "decision:read", "decision:approve",
            "insight:read", "report:read",
        },
    )

    # Member
    member = Role(
        name="Member",
        role_id="role_member",
        description="Standard member with read/write access to workspace resources.",
        is_system_role=True,
        permissions={
            "workspace:read",
            "team:read",
            "memory:create", "memory:read", "memory:update",
            "timeline:create", "timeline:read",
            "decision:create", "decision:read",
            "insight:read",
        },
    )

    # Viewer
    viewer = Role(
        name="Viewer",
        role_id="role_viewer",
        description="Read-only access to workspace resources.",
        is_system_role=True,
        permissions={
            "workspace:read", "team:read",
            "memory:read", "timeline:read",
            "decision:read", "insight:read",
        },
    )

    # Guest
    guest = Role(
        name="Guest",
        role_id="role_guest",
        description="Limited access — can only view shared resources.",
        is_system_role=True,
        permissions={"memory:read", "timeline:read"},
    )

    # Billing Admin
    billing_admin = Role(
        name="Billing Admin",
        role_id="role_billing_admin",
        description="Access to billing and subscription management.",
        is_system_role=True,
        permissions={"billing:read", "billing:manage", "organization:read", "report:read"},
    )

    # Security Admin
    security_admin = Role(
        name="Security Admin",
        role_id="role_security_admin",
        description="Access to security settings, audit logs, and compliance.",
        is_system_role=True,
        permissions={
            "security:read", "security:configure",
            "audit_log:read", "audit_log:audit",
            "compliance:read", "compliance:configure",
            "sso:read", "sso:configure",
            "member:read", "role:read",
        },
    )

    return {
        r.role_id: r for r in [
            super_admin, org_admin, workspace_admin, manager,
            member, viewer, guest, billing_admin, security_admin,
        ]
    }


class RBACEngine:
    """
    Motor RBAC do LifeOS Enterprise.

    Funcionalidades:
    - Roles predefinidos do sistema (9 roles)
    - Custom Roles por organização
    - Herança de roles
    - Atribuição de roles por contexto (org, workspace, team)
    - Verificação de permissões com cache
    - Permission Matrix completa
    """

    def __init__(self):
        self._roles: Dict[str, Role] = _build_system_roles()
        self._assignments: Dict[str, List[RoleAssignment]] = {}  # user_id -> assignments
        self._org_custom_roles: Dict[str, List[str]] = {}  # org_id -> [role_ids]

    # ── Role Management ────────────────────────────────────────────────────

    def create_custom_role(
        self,
        org_id: str,
        name: str,
        permissions: List[str],
        description: str = "",
        parent_role_id: Optional[str] = None,
    ) -> Role:
        """Cria um custom role para uma organização."""
        role = Role(
            name=name,
            org_id=org_id,
            description=description,
            permissions=set(permissions),
            is_custom=True,
            parent_role_id=parent_role_id,
        )
        # Herdar permissões do parent role
        if parent_role_id and parent_role_id in self._roles:
            parent = self._roles[parent_role_id]
            role.permissions = role.permissions | parent.permissions

        self._roles[role.role_id] = role
        self._org_custom_roles.setdefault(org_id, []).append(role.role_id)
        return role

    def get_role(self, role_id: str) -> Optional[Role]:
        return self._roles.get(role_id)

    def list_roles(
        self,
        org_id: Optional[str] = None,
        include_system: bool = True,
    ) -> List[Role]:
        roles = []
        if include_system:
            roles = [r for r in self._roles.values() if r.is_system_role]
        if org_id:
            custom_ids = self._org_custom_roles.get(org_id, [])
            roles += [self._roles[rid] for rid in custom_ids if rid in self._roles]
        return roles

    # ── Role Assignment ────────────────────────────────────────────────────

    def assign_role(
        self,
        user_id: str,
        role_id: str,
        org_id: str,
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        assigned_by: Optional[str] = None,
        expires_at: Optional[datetime] = None,
    ) -> RoleAssignment:
        """Atribui um role a um usuário em um contexto específico."""
        if role_id not in self._roles:
            raise ValueError(f"Role '{role_id}' not found.")

        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            org_id=org_id,
            workspace_id=workspace_id,
            team_id=team_id,
            assigned_by=assigned_by,
            expires_at=expires_at,
        )
        self._assignments.setdefault(user_id, []).append(assignment)
        return assignment

    def revoke_role(self, user_id: str, role_id: str, org_id: str) -> bool:
        """Revoga um role de um usuário."""
        assignments = self._assignments.get(user_id, [])
        before = len(assignments)
        self._assignments[user_id] = [
            a for a in assignments
            if not (a.role_id == role_id and a.org_id == org_id)
        ]
        return len(self._assignments[user_id]) < before

    def get_user_roles(
        self,
        user_id: str,
        org_id: str,
        workspace_id: Optional[str] = None,
    ) -> List[Role]:
        """Retorna todos os roles ativos de um usuário em um contexto."""
        assignments = self._assignments.get(user_id, [])
        active = [
            a for a in assignments
            if a.org_id == org_id
            and not a.is_expired()
            and (workspace_id is None or a.workspace_id is None or a.workspace_id == workspace_id)
        ]
        return [self._roles[a.role_id] for a in active if a.role_id in self._roles]

    # ── Permission Checking ────────────────────────────────────────────────

    def check_permission(
        self,
        user_id: str,
        resource: Resource,
        action: Action,
        org_id: str,
        workspace_id: Optional[str] = None,
    ) -> bool:
        """
        Verifica se um usuário tem permissão para executar uma ação em um recurso.
        """
        permission_key = f"{resource.value}:{action.value}"
        roles = self.get_user_roles(user_id, org_id, workspace_id)
        return any(role.has_permission(permission_key) for role in roles)

    def get_user_permissions(
        self,
        user_id: str,
        org_id: str,
        workspace_id: Optional[str] = None,
    ) -> Set[str]:
        """Retorna o conjunto completo de permissões de um usuário."""
        roles = self.get_user_roles(user_id, org_id, workspace_id)
        permissions: Set[str] = set()
        for role in roles:
            permissions |= role.permissions
        return permissions

    def get_permission_matrix(self, org_id: str) -> Dict[str, Any]:
        """Retorna a matriz completa de permissões da organização."""
        roles = self.list_roles(org_id=org_id, include_system=True)
        matrix = {}
        for role in roles:
            matrix[role.name] = {
                resource.value: {
                    action.value: role.has_permission(f"{resource.value}:{action.value}")
                    for action in Action
                }
                for resource in Resource
            }
        return matrix

    def require_permission(
        self,
        user_id: str,
        resource: Resource,
        action: Action,
        org_id: str,
        workspace_id: Optional[str] = None,
    ) -> None:
        """Levanta PermissionDeniedError se o usuário não tiver a permissão."""
        if not self.check_permission(user_id, resource, action, org_id, workspace_id):
            raise PermissionError(
                f"User '{user_id}' does not have permission to "
                f"'{action.value}' on '{resource.value}' "
                f"in org '{org_id}'."
            )
