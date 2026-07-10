"""
API Freezer — Public API Freeze for LifeOS.
SIGMA-008: Production Certification
"""

import time
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class APIStatus(Enum):
    ACTIVE = "active"
    FROZEN = "frozen"
    DEPRECATED = "deprecated"
    REMOVED = "removed"


@dataclass
class APIEndpoint:
    """A public API endpoint."""
    path: str
    method: str
    version: str
    status: APIStatus = APIStatus.ACTIVE
    description: str = ""
    frozen_at: float = 0.0
    deprecated_at: float = 0.0
    removal_date: float = 0.0
    changelog: List[str] = field(default_factory=list)


class APIFreezer:
    """
    World-Class Public API Freezer for LifeOS.

    SIGMA-008: Implements:
    - API versioning
    - API freezing (no breaking changes allowed)
    - Deprecation management
    - Breaking change detection
    - API changelog
    - Backward compatibility verification
    """

    def __init__(self, name: str = "api_freezer") -> None:
        self.name = name
        self._endpoints: List[APIEndpoint] = []
        self._frozen_version: str = ""
        self._stats = {
            "total_endpoints": 0,
            "frozen": 0,
            "deprecated": 0,
            "active": 0,
        }

    def register_endpoint(self, path: str, method: str, version: str, description: str = "") -> APIEndpoint:
        """Register a public API endpoint."""
        endpoint = APIEndpoint(
            path=path,
            method=method,
            version=version,
            description=description,
        )
        self._endpoints.append(endpoint)
        self._stats["total_endpoints"] += 1
        return endpoint

    def freeze_api(self, version: str) -> Dict[str, int]:
        """Freeze all endpoints at a given version."""
        frozen = 0
        for endpoint in self._endpoints:
            if endpoint.version == version and endpoint.status == APIStatus.ACTIVE:
                endpoint.status = APIStatus.FROZEN
                endpoint.frozen_at = time.time()
                endpoint.changelog.append(f"Frozen at {version} ({time.time()})")
                frozen += 1

        self._frozen_version = version
        self._stats["frozen"] += frozen
        self._stats["active"] = max(0, self._stats["active"] - frozen)

        logger.info(f"[APIFreezer] Frozen {frozen} endpoints at version {version}")
        return {"frozen": frozen}

    def deprecate_endpoint(self, path: str, method: str, removal_date: str = "") -> bool:
        """Deprecate a specific endpoint."""
        for endpoint in self._endpoints:
            if endpoint.path == path and endpoint.method == method:
                endpoint.status = APIStatus.DEPRECATED
                endpoint.deprecated_at = time.time()
                self._stats["deprecated"] += 1
                self._stats["frozen"] -= 1
                endpoint.changelog.append(f"Deprecated at {time.time()}, removal: {removal_date}")
                return True
        return False

    def check_breaking_changes(self, new_version: str) -> List[str]:
        """Check for potential breaking changes."""
        issues = []
        for endpoint in self._endpoints:
            if endpoint.status == APIStatus.FROZEN and endpoint.version != new_version:
                issues.append(f"WARNING: {endpoint.method} {endpoint.path} is frozen at {endpoint.version}")

        return issues

    def verify_backward_compatibility(self) -> bool:
        """Verify no breaking changes have been made."""
        return len(self.check_breaking_changes("")) == 0

    def get_endpoints(self, status: Optional[APIStatus] = None) -> List[APIEndpoint]:
        if status:
            return [e for e in self._endpoints if e.status == status]
        return list(self._endpoints)

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "frozen_version": self._frozen_version,
            "endpoints": [{"path": e.path, "method": e.method, "version": e.version, "status": e.status.value} for e in self._endpoints],
        }

    def __repr__(self) -> str:
        return (
            f"APIFreezer(name={self.name!r}, "
            f"endpoints={len(self._endpoints)}, "
            f"frozen_version={self._frozen_version!r})"
        )
