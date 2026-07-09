"""
Connector Marketplace — Universal Connector Platform
The LifeOS app store for integrations.

Features:
  - Browse connectors by category, provider, and tags
  - Featured and trending connectors
  - User reviews and ratings
  - One-click install/uninstall
  - Connector bundles (e.g., "Google Workspace Bundle")
  - Search with relevance ranking
  - Changelog and version history
"""

from __future__ import annotations
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from connector_platform.models.connector_models import (
    ConnectorCategory,
    ConnectorManifest,
    MarketplaceEntry,
)
from connector_platform.registry.connector_registry import ConnectorRegistry

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Connector Bundle
# ─────────────────────────────────────────────

class ConnectorBundle:
    """
    A curated bundle of related connectors.
    Allows users to install multiple connectors at once.
    """

    def __init__(
        self,
        bundle_id: str,
        name: str,
        description: str,
        connector_ids: List[str],
        icon_url: str = "",
        tags: List[str] = None,
    ):
        self.bundle_id = bundle_id
        self.name = name
        self.description = description
        self.connector_ids = connector_ids
        self.icon_url = icon_url
        self.tags = tags or []
        self.created_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bundle_id": self.bundle_id,
            "name": self.name,
            "description": self.description,
            "connector_ids": self.connector_ids,
            "connector_count": len(self.connector_ids),
            "tags": self.tags,
        }


# ─────────────────────────────────────────────
# Review
# ─────────────────────────────────────────────

class ConnectorReview:
    def __init__(self, user_id: str, connector_id: str, rating: int, comment: str):
        self.review_id = f"review_{user_id}_{connector_id}_{datetime.utcnow().timestamp():.0f}"
        self.user_id = user_id
        self.connector_id = connector_id
        self.rating = max(1, min(5, rating))
        self.comment = comment
        self.created_at = datetime.utcnow()
        self.helpful_count = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "review_id": self.review_id,
            "user_id": self.user_id,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat(),
            "helpful_count": self.helpful_count,
        }


# ─────────────────────────────────────────────
# Connector Marketplace
# ─────────────────────────────────────────────

class ConnectorMarketplace:
    """
    LifeOS Connector Marketplace.

    The central hub for discovering, installing, and managing
    connector integrations for the LifeOS platform.
    """

    def __init__(self, registry: ConnectorRegistry):
        self._registry = registry
        self._entries: Dict[str, MarketplaceEntry] = {}
        self._bundles: Dict[str, ConnectorBundle] = {}
        self._reviews: Dict[str, List[ConnectorReview]] = {}
        self._install_records: Dict[str, List[str]] = {}  # user_id → [connector_ids]
        self._featured: List[str] = []
        self._initialized_at = datetime.utcnow()

        # Initialize marketplace entries from registry
        self._populate_from_registry()
        self._create_default_bundles()
        logger.info(f"[Marketplace] Initialized with {len(self._entries)} connectors")

    def _populate_from_registry(self):
        """Populate marketplace entries from the connector registry."""
        for manifest in self._registry.list_all():
            entry = MarketplaceEntry(
                manifest=manifest,
                install_count=0,
                rating=0.0,
                review_count=0,
                featured=manifest.is_official,
                published_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            self._entries[manifest.connector_id] = entry
            if manifest.is_official:
                self._featured.append(manifest.connector_id)

    def _create_default_bundles(self):
        """Create curated connector bundles."""
        bundles = [
            ConnectorBundle(
                bundle_id="google_workspace",
                name="Google Workspace",
                description="Complete Google Workspace integration: Calendar, Drive, Gmail, Tasks, and Meet.",
                connector_ids=["google_calendar", "google_drive", "gmail", "google_tasks", "google_meet"],
                tags=["google", "productivity", "workspace"],
            ),
            ConnectorBundle(
                bundle_id="microsoft_365",
                name="Microsoft 365",
                description="Full Microsoft 365 suite: Outlook, Teams, OneDrive, and Microsoft 365.",
                connector_ids=["microsoft_outlook", "microsoft_teams", "onedrive", "microsoft_365"],
                tags=["microsoft", "office", "productivity"],
            ),
            ConnectorBundle(
                bundle_id="apple_ecosystem",
                name="Apple Ecosystem",
                description="Apple services: Calendar, Reminders, and Health.",
                connector_ids=["apple_calendar", "apple_reminders", "apple_health"],
                tags=["apple", "icloud", "ios"],
            ),
            ConnectorBundle(
                bundle_id="developer_tools",
                name="Developer Tools",
                description="Essential developer integrations: GitHub, GitLab, Slack, and Discord.",
                connector_ids=["github", "gitlab", "slack", "discord"],
                tags=["developer", "devops", "code"],
            ),
            ConnectorBundle(
                bundle_id="video_meetings",
                name="Video Meetings",
                description="All video meeting platforms: Zoom, Google Meet, and Microsoft Teams.",
                connector_ids=["zoom", "google_meet", "microsoft_teams"],
                tags=["video", "meetings", "remote"],
            ),
            ConnectorBundle(
                bundle_id="cloud_storage",
                name="Cloud Storage",
                description="Cloud storage services: Google Drive, OneDrive, and Dropbox.",
                connector_ids=["google_drive", "onedrive", "dropbox"],
                tags=["storage", "files", "cloud"],
            ),
            ConnectorBundle(
                bundle_id="productivity_suite",
                name="Productivity Suite",
                description="Productivity powerhouse: Notion, Slack, and Google Workspace.",
                connector_ids=["notion", "slack", "google_calendar", "google_tasks"],
                tags=["productivity", "tasks", "notes"],
            ),
            ConnectorBundle(
                bundle_id="health_wellness",
                name="Health & Wellness",
                description="Health tracking: Apple Health, Oura, Garmin, and Fitbit.",
                connector_ids=["apple_health", "oura", "garmin", "fitbit", "samsung_health"],
                tags=["health", "fitness", "wearable"],
            ),
        ]
        for bundle in bundles:
            self._bundles[bundle.bundle_id] = bundle

    # ── Browse ────────────────────────────────

    def get_featured(self) -> List[MarketplaceEntry]:
        """Get featured connectors."""
        return [
            self._entries[cid]
            for cid in self._featured
            if cid in self._entries
        ]

    def get_by_category(self, category: ConnectorCategory) -> List[MarketplaceEntry]:
        """Get connectors by category."""
        return [
            entry for entry in self._entries.values()
            if entry.manifest.category == category
        ]

    def get_all(self, include_beta: bool = True) -> List[MarketplaceEntry]:
        """Get all marketplace entries."""
        if include_beta:
            return list(self._entries.values())
        return [e for e in self._entries.values() if not e.manifest.is_beta]

    def search(self, query: str) -> List[MarketplaceEntry]:
        """Search marketplace by query string."""
        manifests = self._registry.search(query)
        return [
            self._entries[m.connector_id]
            for m in manifests
            if m.connector_id in self._entries
        ]

    def get_trending(self, limit: int = 10) -> List[MarketplaceEntry]:
        """Get trending connectors by install count."""
        sorted_entries = sorted(
            self._entries.values(),
            key=lambda e: e.install_count,
            reverse=True,
        )
        return sorted_entries[:limit]

    def get_top_rated(self, limit: int = 10, min_reviews: int = 0) -> List[MarketplaceEntry]:
        """Get top-rated connectors."""
        eligible = [e for e in self._entries.values() if e.review_count >= min_reviews]
        return sorted(eligible, key=lambda e: e.rating, reverse=True)[:limit]

    def get_new(self, limit: int = 10) -> List[MarketplaceEntry]:
        """Get recently published connectors."""
        sorted_entries = sorted(
            self._entries.values(),
            key=lambda e: e.published_at or datetime.min,
            reverse=True,
        )
        return sorted_entries[:limit]

    # ── Bundles ───────────────────────────────

    def get_bundles(self) -> List[ConnectorBundle]:
        return list(self._bundles.values())

    def get_bundle(self, bundle_id: str) -> Optional[ConnectorBundle]:
        return self._bundles.get(bundle_id)

    def get_bundle_entries(self, bundle_id: str) -> List[MarketplaceEntry]:
        bundle = self._bundles.get(bundle_id)
        if not bundle:
            return []
        return [
            self._entries[cid]
            for cid in bundle.connector_ids
            if cid in self._entries
        ]

    # ── Install / Uninstall ───────────────────

    def install(self, user_id: str, connector_id: str) -> bool:
        """Record connector installation for a user."""
        if connector_id not in self._entries:
            return False
        if user_id not in self._install_records:
            self._install_records[user_id] = []
        if connector_id not in self._install_records[user_id]:
            self._install_records[user_id].append(connector_id)
            self._entries[connector_id].install_count += 1
            logger.info(f"[Marketplace] Installed: {connector_id} for user={user_id}")
        return True

    def install_bundle(self, user_id: str, bundle_id: str) -> List[str]:
        """Install all connectors in a bundle."""
        bundle = self._bundles.get(bundle_id)
        if not bundle:
            return []
        installed = []
        for cid in bundle.connector_ids:
            if self.install(user_id, cid):
                installed.append(cid)
        return installed

    def uninstall(self, user_id: str, connector_id: str) -> bool:
        """Uninstall a connector for a user."""
        user_installs = self._install_records.get(user_id, [])
        if connector_id in user_installs:
            user_installs.remove(connector_id)
            logger.info(f"[Marketplace] Uninstalled: {connector_id} for user={user_id}")
            return True
        return False

    def get_installed(self, user_id: str) -> List[MarketplaceEntry]:
        """Get all installed connectors for a user."""
        installed_ids = self._install_records.get(user_id, [])
        return [self._entries[cid] for cid in installed_ids if cid in self._entries]

    def is_installed(self, user_id: str, connector_id: str) -> bool:
        return connector_id in self._install_records.get(user_id, [])

    # ── Reviews ───────────────────────────────

    def add_review(
        self,
        user_id: str,
        connector_id: str,
        rating: int,
        comment: str,
    ) -> Optional[ConnectorReview]:
        """Add a user review for a connector."""
        if connector_id not in self._entries:
            return None
        review = ConnectorReview(user_id, connector_id, rating, comment)
        if connector_id not in self._reviews:
            self._reviews[connector_id] = []
        self._reviews[connector_id].append(review)

        # Update entry stats
        entry = self._entries[connector_id]
        all_ratings = [r.rating for r in self._reviews[connector_id]]
        entry.rating = sum(all_ratings) / len(all_ratings)
        entry.review_count = len(all_ratings)
        logger.info(f"[Marketplace] Review added: {connector_id} rating={rating}")
        return review

    def get_reviews(self, connector_id: str, limit: int = 20) -> List[ConnectorReview]:
        return self._reviews.get(connector_id, [])[-limit:]

    # ── Statistics ────────────────────────────

    def get_stats(self) -> Dict[str, Any]:
        total_installs = sum(len(installs) for installs in self._install_records.values())
        return {
            "total_connectors": len(self._entries),
            "total_bundles": len(self._bundles),
            "total_installs": total_installs,
            "total_users": len(self._install_records),
            "featured_count": len(self._featured),
            "total_reviews": sum(len(r) for r in self._reviews.values()),
            "by_category": {
                cat.value: len(self.get_by_category(cat))
                for cat in ConnectorCategory
                if self.get_by_category(cat)
            },
        }

    def get_catalog(self) -> Dict[str, Any]:
        """Return full marketplace catalog for API responses."""
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "total_connectors": len(self._entries),
            "featured": [
                {
                    "connector_id": e.manifest.connector_id,
                    "name": e.manifest.name,
                    "provider": e.manifest.provider,
                    "category": e.manifest.category.value,
                    "description": e.manifest.description,
                    "is_official": e.manifest.is_official,
                    "is_verified": e.manifest.is_verified,
                    "is_beta": e.manifest.is_beta,
                    "install_count": e.install_count,
                    "rating": round(e.rating, 1),
                    "tags": e.manifest.tags,
                }
                for e in self.get_featured()
            ],
            "bundles": [b.to_dict() for b in self.get_bundles()],
            "categories": {
                cat.value: [
                    {
                        "connector_id": e.manifest.connector_id,
                        "name": e.manifest.name,
                        "provider": e.manifest.provider,
                        "is_beta": e.manifest.is_beta,
                    }
                    for e in self.get_by_category(cat)
                ]
                for cat in ConnectorCategory
                if self.get_by_category(cat)
            },
        }
