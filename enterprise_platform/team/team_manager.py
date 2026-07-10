"""
LifeOS Enterprise Platform — Team Manager
EXECUTION-010: Enterprise Platform

Gerencia equipes dentro de workspaces e organizações.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class MemberRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    MEMBER = "member"
    VIEWER = "viewer"
    GUEST = "guest"


class MemberStatus(str, Enum):
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"
    REMOVED = "removed"


@dataclass
class TeamMember:
    """Membro de uma equipe."""
    user_id: str
    email: str
    role: MemberRole = MemberRole.MEMBER
    status: MemberStatus = MemberStatus.ACTIVE
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    invited_by: Optional[str] = None
    custom_permissions: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "email": self.email,
            "role": self.role.value,
            "status": self.status.value,
            "joined_at": self.joined_at.isoformat(),
        }


@dataclass
class Team:
    """Representa uma equipe dentro de um workspace."""
    org_id: str
    workspace_id: str
    name: str
    team_id: str = field(default_factory=lambda: f"team_{secrets.token_hex(8)}")
    description: str = ""
    owner_id: str = ""
    members: List[TeamMember] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def member_count(self) -> int:
        return sum(1 for m in self.members if m.status == MemberStatus.ACTIVE)

    def get_member(self, user_id: str) -> Optional[TeamMember]:
        return next((m for m in self.members if m.user_id == user_id), None)

    def to_dict(self) -> dict:
        return {
            "team_id": self.team_id,
            "org_id": self.org_id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "description": self.description,
            "owner_id": self.owner_id,
            "member_count": self.member_count,
            "created_at": self.created_at.isoformat(),
            "tags": self.tags,
        }


class TeamManager:
    """Gerenciador de equipes do LifeOS Enterprise."""

    def __init__(self):
        self._teams: Dict[str, Team] = {}
        self._org_index: Dict[str, List[str]] = {}
        self._workspace_index: Dict[str, List[str]] = {}

    def create_team(
        self,
        org_id: str,
        workspace_id: str,
        name: str,
        owner_id: str = "",
        description: str = "",
        tags: Optional[List[str]] = None,
    ) -> Team:
        team = Team(
            org_id=org_id,
            workspace_id=workspace_id,
            name=name,
            owner_id=owner_id,
            description=description,
            tags=tags or [],
        )
        # Adicionar owner como membro com role OWNER
        if owner_id:
            team.members.append(TeamMember(
                user_id=owner_id,
                email="",
                role=MemberRole.OWNER,
            ))
        self._teams[team.team_id] = team
        self._org_index.setdefault(org_id, []).append(team.team_id)
        self._workspace_index.setdefault(workspace_id, []).append(team.team_id)
        return team

    def get_team(self, team_id: str) -> Optional[Team]:
        return self._teams.get(team_id)

    def add_member(
        self,
        team_id: str,
        user_id: str,
        email: str,
        role: MemberRole = MemberRole.MEMBER,
        invited_by: Optional[str] = None,
    ) -> TeamMember:
        team = self._teams.get(team_id)
        if not team:
            raise ValueError(f"Team '{team_id}' not found.")
        existing = team.get_member(user_id)
        if existing and existing.status == MemberStatus.ACTIVE:
            raise ValueError(f"User '{user_id}' is already a member.")
        member = TeamMember(
            user_id=user_id,
            email=email,
            role=role,
            invited_by=invited_by,
        )
        team.members.append(member)
        team.updated_at = datetime.now(timezone.utc)
        return member

    def remove_member(self, team_id: str, user_id: str) -> bool:
        team = self._teams.get(team_id)
        if not team:
            return False
        member = team.get_member(user_id)
        if not member:
            return False
        member.status = MemberStatus.REMOVED
        team.updated_at = datetime.now(timezone.utc)
        return True

    def update_member_role(
        self, team_id: str, user_id: str, new_role: MemberRole
    ) -> bool:
        team = self._teams.get(team_id)
        if not team:
            return False
        member = team.get_member(user_id)
        if not member:
            return False
        member.role = new_role
        team.updated_at = datetime.now(timezone.utc)
        return True

    def list_teams(
        self,
        org_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> List[Team]:
        if workspace_id:
            ids = self._workspace_index.get(workspace_id, [])
        elif org_id:
            ids = self._org_index.get(org_id, [])
        else:
            ids = list(self._teams.keys())
        return [self._teams[tid] for tid in ids if tid in self._teams]

    def get_user_teams(self, user_id: str, org_id: Optional[str] = None) -> List[Dict]:
        """Retorna todas as equipes de um usuário com suas roles."""
        result = []
        teams = self.list_teams(org_id=org_id)
        for team in teams:
            member = team.get_member(user_id)
            if member and member.status == MemberStatus.ACTIVE:
                result.append({
                    "team_id": team.team_id,
                    "team_name": team.name,
                    "workspace_id": team.workspace_id,
                    "role": member.role.value,
                })
        return result
