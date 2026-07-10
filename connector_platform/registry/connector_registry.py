"""
Connector Registry — Universal Connector Platform
Central registry for all available connectors.

Features:
  - Auto-discovery and registration of connectors
  - Connector validation and verification
  - Version management
  - Category-based indexing
  - Search and filtering
  - Connector health tracking
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type

from connector_platform.core.connector_engine import BaseConnector
from connector_platform.models.connector_models import (
    ConnectorCategory,
    ConnectorManifest,
    ConnectorStatus,
    MarketplaceEntry,
)

logger = logging.getLogger(__name__)


class ConnectorRegistry:
    """
    Central registry for all LifeOS connectors.

    Acts as the single source of truth for:
      - Available connectors and their manifests
      - Connector categories and tags
      - Verification status
      - Version history
    """

    def __init__(self):
        self._connectors: Dict[str, Type[BaseConnector]] = {}
        self._manifests: Dict[str, ConnectorManifest] = {}
        self._categories: Dict[ConnectorCategory, List[str]] = {}
        self._tags: Dict[str, List[str]] = {}
        self._version_history: Dict[str, List[str]] = {}
        self._registered_at: Dict[str, datetime] = {}
        self._initialized_at = datetime.now(timezone.utc)
        logger.info("[ConnectorRegistry] Initialized")

    # ── Registration ──────────────────────────

    def register(self, connector_class: Type[BaseConnector]) -> bool:
        """Register a connector class."""
        manifest = connector_class.manifest
        connector_id = manifest.connector_id

        if connector_id in self._connectors:
            existing_version = self._manifests[connector_id].version
            if existing_version == manifest.version:
                logger.debug(f"[Registry] Already registered: {connector_id}")
                return False
            logger.info(f"[Registry] Updating: {connector_id} {existing_version} → {manifest.version}")

        self._connectors[connector_id] = connector_class
        self._manifests[connector_id] = manifest
        self._registered_at[connector_id] = datetime.now(timezone.utc)

        # Index by category
        cat = manifest.category
        if cat not in self._categories:
            self._categories[cat] = []
        if connector_id not in self._categories[cat]:
            self._categories[cat].append(connector_id)

        # Index by tags
        for tag in manifest.tags:
            if tag not in self._tags:
                self._tags[tag] = []
            if connector_id not in self._tags[tag]:
                self._tags[tag].append(connector_id)

        # Version history
        if connector_id not in self._version_history:
            self._version_history[connector_id] = []
        self._version_history[connector_id].append(manifest.version)

        logger.info(f"[Registry] Registered: {connector_id} v{manifest.version} ({manifest.name})")
        return True

    def register_many(self, connector_classes: List[Type[BaseConnector]]) -> int:
        """Register multiple connectors at once."""
        count = sum(1 for cls in connector_classes if self.register(cls))
        logger.info(f"[Registry] Bulk registered: {count}/{len(connector_classes)} connectors")
        return count

    def unregister(self, connector_id: str) -> bool:
        """Remove a connector from the registry."""
        if connector_id not in self._connectors:
            return False
        manifest = self._manifests[connector_id]
        self._connectors.pop(connector_id)
        self._manifests.pop(connector_id)
        self._registered_at.pop(connector_id, None)
        if manifest.category in self._categories:
            self._categories[manifest.category] = [
                c for c in self._categories[manifest.category] if c != connector_id
            ]
        for tag in manifest.tags:
            if tag in self._tags:
                self._tags[tag] = [c for c in self._tags[tag] if c != connector_id]
        logger.info(f"[Registry] Unregistered: {connector_id}")
        return True

    # ── Lookup ────────────────────────────────

    def get(self, connector_id: str) -> Optional[Type[BaseConnector]]:
        return self._connectors.get(connector_id)

    def get_manifest(self, connector_id: str) -> Optional[ConnectorManifest]:
        return self._manifests.get(connector_id)

    def exists(self, connector_id: str) -> bool:
        return connector_id in self._connectors

    def list_all(self) -> List[ConnectorManifest]:
        return list(self._manifests.values())

    def list_ids(self) -> List[str]:
        return list(self._connectors.keys())

    # ── Filtering ─────────────────────────────

    def by_category(self, category: ConnectorCategory) -> List[ConnectorManifest]:
        ids = self._categories.get(category, [])
        return [self._manifests[cid] for cid in ids if cid in self._manifests]

    def by_tag(self, tag: str) -> List[ConnectorManifest]:
        ids = self._tags.get(tag, [])
        return [self._manifests[cid] for cid in ids if cid in self._manifests]

    def by_provider(self, provider: str) -> List[ConnectorManifest]:
        return [m for m in self._manifests.values() if m.provider.lower() == provider.lower()]

    def verified_only(self) -> List[ConnectorManifest]:
        return [m for m in self._manifests.values() if m.is_verified]

    def official_only(self) -> List[ConnectorManifest]:
        return [m for m in self._manifests.values() if m.is_official]

    def beta_connectors(self) -> List[ConnectorManifest]:
        return [m for m in self._manifests.values() if m.is_beta]

    def search(self, query: str) -> List[ConnectorManifest]:
        """Search connectors by name, description, provider, or tags."""
        q = query.lower()
        results = []
        for manifest in self._manifests.values():
            if (q in manifest.name.lower() or
                q in manifest.description.lower() or
                q in manifest.provider.lower() or
                any(q in tag.lower() for tag in manifest.tags)):
                results.append(manifest)
        return results

    def filter(
        self,
        category: Optional[ConnectorCategory] = None,
        provider: Optional[str] = None,
        verified: Optional[bool] = None,
        official: Optional[bool] = None,
        beta: Optional[bool] = None,
        tags: Optional[List[str]] = None,
    ) -> List[ConnectorManifest]:
        """Multi-criteria filter."""
        results = list(self._manifests.values())
        if category:
            results = [m for m in results if m.category == category]
        if provider:
            results = [m for m in results if m.provider.lower() == provider.lower()]
        if verified is not None:
            results = [m for m in results if m.is_verified == verified]
        if official is not None:
            results = [m for m in results if m.is_official == official]
        if beta is not None:
            results = [m for m in results if m.is_beta == beta]
        if tags:
            results = [m for m in results if any(t in m.tags for t in tags)]
        return results

    # ── Statistics ────────────────────────────

    def get_stats(self) -> Dict[str, Any]:
        total = len(self._connectors)
        by_category = {
            cat.value: len(ids)
            for cat, ids in self._categories.items()
            if ids
        }
        return {
            "total_connectors": total,
            "verified": sum(1 for m in self._manifests.values() if m.is_verified),
            "official": sum(1 for m in self._manifests.values() if m.is_official),
            "beta": sum(1 for m in self._manifests.values() if m.is_beta),
            "by_category": by_category,
            "providers": list(set(m.provider for m in self._manifests.values())),
            "initialized_at": self._initialized_at.isoformat(),
        }

    def get_summary(self) -> str:
        stats = self.get_stats()
        lines = [
            f"Connector Registry — {stats['total_connectors']} connectors",
            f"  Official: {stats['official']} | Verified: {stats['verified']} | Beta: {stats['beta']}",
            f"  Providers: {', '.join(stats['providers'])}",
            "  By Category:",
        ]
        for cat, count in stats["by_category"].items():
            lines.append(f"    {cat}: {count}")
        return "\n".join(lines)
