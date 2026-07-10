"""
LifeOS Enterprise Platform — Workspace Manager
EXECUTION-010: Enterprise Platform

Gerencia workspaces dentro de organizações.
Um workspace representa um ambiente isolado (ex: Produção, Desenvolvimento, Departamento).
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class WorkspaceType(str, Enum):
    DEPARTMENT = "department"
    PROJECT = "project"
    ENVIRONMENT = "environment"
    TEAM = "team"
    PERSONAL = "personal"


class WorkspaceStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    SUSPENDED = "suspended"


class WorkspaceVisibility(str, Enum):
    PRIVATE = "private"
    INTERNAL = "internal"   # Visível para toda a organização
    PUBLIC = "public"


@dataclass
class WorkspaceQuota:
    """Limites de uso do workspace."""
    max_members: int = 50
    max_projects: int = 20
    max_storage_gb: float = 100.0
    max_api_calls_per_day: int = 100_000
    current_members: int = 0
    current_projects: int = 0
    current_storage_gb: float = 0.0
    current_api_calls_today: int = 0


@dataclass
class Workspace:
    """Representa um workspace dentro de uma organização."""
    org_id: str
    name: str
    type: WorkspaceType = WorkspaceType.DEPARTMENT
    workspace_id: str = field(default_factory=lambda: f"ws_{secrets.token_hex(8)}")
    status: WorkspaceStatus = WorkspaceStatus.ACTIVE
    visibility: WorkspaceVisibility = WorkspaceVisibility.PRIVATE
    owner_id: str = ""
    description: str = ""
    quota: WorkspaceQuota = field(default_factory=WorkspaceQuota)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    parent_workspace_id: Optional[str] = None  # Para hierarquia de workspaces

    def is_active(self) -> bool:
        return self.status == WorkspaceStatus.ACTIVE

    def to_dict(self) -> dict:
        return {
            "workspace_id": self.workspace_id,
            "org_id": self.org_id,
            "name": self.name,
            "type": self.type.value,
            "status": self.status.value,
            "visibility": self.visibility.value,
            "owner_id": self.owner_id,
            "description": self.description,
            "quota": {
                "max_members": self.quota.max_members,
                "current_members": self.quota.current_members,
                "max_projects": self.quota.max_projects,
                "current_projects": self.quota.current_projects,
            },
            "created_at": self.created_at.isoformat(),
            "tags": self.tags,
        }


class WorkspaceManager:
    """
    Gerenciador de workspaces do LifeOS Enterprise.

    Suporta hierarquia de workspaces:
    Organização → Departamento → Equipe → Projeto → Ambiente
    """

    def __init__(self):
        self._workspaces: Dict[str, Workspace] = {}
        self._org_index: Dict[str, List[str]] = {}  # org_id -> [workspace_ids]

    def create_workspace(
        self,
        org_id: str,
        name: str,
        workspace_type: WorkspaceType = WorkspaceType.DEPARTMENT,
        owner_id: str = "",
        description: str = "",
        visibility: WorkspaceVisibility = WorkspaceVisibility.PRIVATE,
        parent_workspace_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Workspace:
        """Cria um novo workspace dentro de uma organização."""
        ws = Workspace(
            org_id=org_id,
            name=name,
            type=workspace_type,
            owner_id=owner_id,
            description=description,
            visibility=visibility,
            parent_workspace_id=parent_workspace_id,
            tags=tags or [],
        )
        self._workspaces[ws.workspace_id] = ws
        if org_id not in self._org_index:
            self._org_index[org_id] = []
        self._org_index[org_id].append(ws.workspace_id)
        return ws

    def get_workspace(self, workspace_id: str) -> Optional[Workspace]:
        return self._workspaces.get(workspace_id)

    def list_workspaces(
        self,
        org_id: str,
        workspace_type: Optional[WorkspaceType] = None,
        status: Optional[WorkspaceStatus] = None,
    ) -> List[Workspace]:
        ws_ids = self._org_index.get(org_id, [])
        workspaces = [self._workspaces[wid] for wid in ws_ids if wid in self._workspaces]
        if workspace_type:
            workspaces = [w for w in workspaces if w.type == workspace_type]
        if status:
            workspaces = [w for w in workspaces if w.status == status]
        return workspaces

    def get_workspace_hierarchy(self, org_id: str) -> Dict[str, Any]:
        """Retorna a hierarquia completa de workspaces de uma organização."""
        workspaces = self.list_workspaces(org_id)
        root_workspaces = [w for w in workspaces if w.parent_workspace_id is None]

        def build_tree(ws: Workspace) -> dict:
            children = [w for w in workspaces if w.parent_workspace_id == ws.workspace_id]
            return {
                **ws.to_dict(),
                "children": [build_tree(c) for c in children],
            }

        return {
            "org_id": org_id,
            "total_workspaces": len(workspaces),
            "hierarchy": [build_tree(ws) for ws in root_workspaces],
        }

    def archive_workspace(self, workspace_id: str) -> bool:
        ws = self._workspaces.get(workspace_id)
        if not ws:
            return False
        ws.status = WorkspaceStatus.ARCHIVED
        ws.updated_at = datetime.now(timezone.utc)
        return True

    def update_quota(self, workspace_id: str, **quota_updates) -> bool:
        ws = self._workspaces.get(workspace_id)
        if not ws:
            return False
        for key, value in quota_updates.items():
            if hasattr(ws.quota, key):
                setattr(ws.quota, key, value)
        ws.updated_at = datetime.now(timezone.utc)
        return True

    def get_org_stats(self, org_id: str) -> Dict[str, Any]:
        workspaces = self.list_workspaces(org_id)
        return {
            "total": len(workspaces),
            "active": sum(1 for w in workspaces if w.status == WorkspaceStatus.ACTIVE),
            "archived": sum(1 for w in workspaces if w.status == WorkspaceStatus.ARCHIVED),
            "by_type": {
                wt.value: sum(1 for w in workspaces if w.type == wt)
                for wt in WorkspaceType
            },
            "total_members": sum(w.quota.current_members for w in workspaces),
        }
