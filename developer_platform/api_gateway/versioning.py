"""
LifeOS API Version Manager
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional


class VersionStatus(str, Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    SUNSET = "sunset"


@dataclass
class APIVersionInfo:
    """Metadados de uma versão da API."""
    version: str
    status: VersionStatus
    release_date: str
    sunset_date: Optional[str] = None
    changelog: List[str] = field(default_factory=list)
    breaking_changes: List[str] = field(default_factory=list)
    migration_guide_url: Optional[str] = None


class APIVersionManager:
    """
    Gerenciador de versões da API LifeOS.

    Responsável por:
    - Registrar e manter metadados de versões
    - Determinar compatibilidade entre versões
    - Fornecer informações de migração
    - Emitir avisos de deprecação
    """

    def __init__(self):
        self._versions: Dict[str, APIVersionInfo] = {}
        self._current_version: str = "v2"
        self._register_default_versions()

    def _register_default_versions(self) -> None:
        self.register_version(APIVersionInfo(
            version="v1",
            status=VersionStatus.DEPRECATED,
            release_date="2026-01-01",
            sunset_date="2027-01-01",
            changelog=[
                "Initial public API release",
                "Core endpoints: /memory, /timeline, /decisions",
                "Basic OAuth 2.0 support",
            ],
            breaking_changes=[],
            migration_guide_url="https://developers.lifeos.app/migration/v1-to-v2",
        ))

        self.register_version(APIVersionInfo(
            version="v2",
            status=VersionStatus.ACTIVE,
            release_date="2026-07-10",
            changelog=[
                "Unified response envelope with meta field",
                "Webhook support (create, list, delete, test)",
                "API Key management endpoints",
                "Rate limit headers in all responses",
                "Expanded OAuth scopes",
                "Sandbox environment for testing",
                "Developer Portal API",
            ],
            breaking_changes=[
                "Response format changed: data now wrapped in {data: ..., meta: ...}",
                "Authentication header changed from X-API-Token to Authorization: Bearer",
                "Pagination now uses cursor-based instead of offset-based",
            ],
        ))

    def register_version(self, version_info: APIVersionInfo) -> None:
        self._versions[version_info.version] = version_info

    def get_version_info(self, version: str) -> Optional[APIVersionInfo]:
        return self._versions.get(version)

    def get_current_version(self) -> str:
        return self._current_version

    def is_deprecated(self, version: str) -> bool:
        info = self._versions.get(version)
        return info is not None and info.status == VersionStatus.DEPRECATED

    def get_deprecation_warning(self, version: str) -> Optional[str]:
        info = self._versions.get(version)
        if info and info.status == VersionStatus.DEPRECATED:
            msg = f"API {version} is deprecated."
            if info.sunset_date:
                msg += f" It will be sunset on {info.sunset_date}."
            if info.migration_guide_url:
                msg += f" Migration guide: {info.migration_guide_url}"
            return msg
        return None

    def list_versions(self) -> List[Dict]:
        return [
            {
                "version": v.version,
                "status": v.status.value,
                "release_date": v.release_date,
                "sunset_date": v.sunset_date,
                "is_current": v.version == self._current_version,
            }
            for v in self._versions.values()
        ]
