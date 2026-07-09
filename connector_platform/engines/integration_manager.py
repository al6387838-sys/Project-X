"""
Integration Manager — Universal Connector Platform
Manages the full lifecycle of user integrations.

Responsibilities:
  - Create, configure, and manage integrations
  - Coordinate between OAuth, Sync, and Webhook managers
  - Track integration health and status
  - Handle integration errors and retries
  - Provide integration dashboard data
"""

from __future__ import annotations
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from connector_platform.models.connector_models import (
    ConnectorStatus,
    IntegrationConfig,
    IntegrationHealth,
    SyncDirection,
    SyncFrequency,
    SyncJob,
    ConnectorPermission,
    PermissionScope,
)

logger = logging.getLogger(__name__)


class IntegrationManager:
    """
    Central manager for all user integrations in LifeOS.

    Orchestrates:
      - Integration creation and configuration
      - Status tracking and health monitoring
      - Error handling and automatic retry
      - Integration settings management
      - Cross-connector data flow
    """

    def __init__(self):
        self._integrations: Dict[str, IntegrationConfig] = {}
        self._error_history: Dict[str, List[Dict]] = {}
        self._sync_history: Dict[str, List[SyncJob]] = {}
        self._initialized_at = datetime.utcnow()
        logger.info("[IntegrationManager] Initialized")

    # ── CRUD ──────────────────────────────────

    def create_integration(
        self,
        user_id: str,
        connector_id: str,
        sync_direction: SyncDirection = SyncDirection.BIDIRECTIONAL,
        sync_frequency: SyncFrequency = SyncFrequency.HOURLY,
        settings: Optional[Dict[str, Any]] = None,
    ) -> IntegrationConfig:
        """Create a new integration configuration."""
        config = IntegrationConfig(
            user_id=user_id,
            connector_id=connector_id,
            status=ConnectorStatus.DISCONNECTED,
            sync_direction=sync_direction,
            sync_frequency=sync_frequency,
            settings=settings or {},
        )
        key = f"{user_id}:{connector_id}"
        self._integrations[key] = config
        self._error_history[config.integration_id] = []
        self._sync_history[config.integration_id] = []
        logger.info(f"[IntegrationManager] Created: {key} id={config.integration_id}")
        return config

    def get_integration(self, user_id: str, connector_id: str) -> Optional[IntegrationConfig]:
        return self._integrations.get(f"{user_id}:{connector_id}")

    def get_integration_by_id(self, integration_id: str) -> Optional[IntegrationConfig]:
        for config in self._integrations.values():
            if config.integration_id == integration_id:
                return config
        return None

    def list_user_integrations(self, user_id: str) -> List[IntegrationConfig]:
        return [
            c for k, c in self._integrations.items()
            if k.startswith(f"{user_id}:")
        ]

    def update_integration(
        self,
        user_id: str,
        connector_id: str,
        updates: Dict[str, Any],
    ) -> Optional[IntegrationConfig]:
        config = self.get_integration(user_id, connector_id)
        if not config:
            return None
        for key, value in updates.items():
            if hasattr(config, key):
                setattr(config, key, value)
        logger.info(f"[IntegrationManager] Updated: {user_id}:{connector_id}")
        return config

    def delete_integration(self, user_id: str, connector_id: str) -> bool:
        key = f"{user_id}:{connector_id}"
        config = self._integrations.pop(key, None)
        if config:
            self._error_history.pop(config.integration_id, None)
            self._sync_history.pop(config.integration_id, None)
            logger.info(f"[IntegrationManager] Deleted: {key}")
            return True
        return False

    # ── Status Management ─────────────────────

    def set_status(
        self,
        user_id: str,
        connector_id: str,
        status: ConnectorStatus,
        error: Optional[str] = None,
    ):
        config = self.get_integration(user_id, connector_id)
        if not config:
            return
        config.status = status
        if error:
            config.last_error = error
            config.error_count += 1
            self._error_history[config.integration_id].append({
                "timestamp": datetime.utcnow().isoformat(),
                "error": error,
                "status": status.value,
            })
        logger.info(f"[IntegrationManager] Status → {status.value}: {user_id}:{connector_id}")

    def mark_connected(self, user_id: str, connector_id: str):
        config = self.get_integration(user_id, connector_id)
        if config:
            config.status = ConnectorStatus.CONNECTED
            config.error_count = 0
            config.last_error = None
            config.health = IntegrationHealth.HEALTHY

    def mark_error(self, user_id: str, connector_id: str, error: str):
        self.set_status(user_id, connector_id, ConnectorStatus.ERROR, error)
        config = self.get_integration(user_id, connector_id)
        if config:
            config.health = IntegrationHealth.UNHEALTHY

    # ── Sync Tracking ─────────────────────────

    def record_sync(self, job: SyncJob):
        """Record a completed sync job."""
        config = self.get_integration_by_id(job.integration_id)
        if config:
            config.last_sync = job.completed_at or datetime.utcnow()
            config.next_sync = self._calculate_next_sync(config)
            if job.status == "completed":
                config.health = IntegrationHealth.HEALTHY
            elif job.status == "failed":
                config.error_count += 1
                config.health = IntegrationHealth.DEGRADED if config.error_count < 3 else IntegrationHealth.UNHEALTHY

        history = self._sync_history.get(job.integration_id, [])
        history.append(job)
        # Keep last 100 sync jobs
        if len(history) > 100:
            history = history[-100:]
        self._sync_history[job.integration_id] = history

    def _calculate_next_sync(self, config: IntegrationConfig) -> datetime:
        freq_map = {
            SyncFrequency.REALTIME: timedelta(seconds=0),
            SyncFrequency.EVERY_5_MINUTES: timedelta(minutes=5),
            SyncFrequency.EVERY_15_MINUTES: timedelta(minutes=15),
            SyncFrequency.EVERY_30_MINUTES: timedelta(minutes=30),
            SyncFrequency.HOURLY: timedelta(hours=1),
            SyncFrequency.DAILY: timedelta(days=1),
            SyncFrequency.MANUAL: timedelta(days=365),
        }
        delta = freq_map.get(config.sync_frequency, timedelta(hours=1))
        return datetime.utcnow() + delta

    def get_sync_history(self, integration_id: str, limit: int = 20) -> List[SyncJob]:
        return self._sync_history.get(integration_id, [])[-limit:]

    def get_error_history(self, integration_id: str, limit: int = 20) -> List[Dict]:
        return self._error_history.get(integration_id, [])[-limit:]

    # ── Permissions ───────────────────────────

    def add_permission(
        self,
        user_id: str,
        connector_id: str,
        scope: PermissionScope,
        resource_type: str,
        consent_text: str,
        resource_filter: Optional[str] = None,
    ) -> Optional[ConnectorPermission]:
        config = self.get_integration(user_id, connector_id)
        if not config:
            return None
        permission = ConnectorPermission(
            user_id=user_id,
            connector_id=connector_id,
            scope=scope,
            resource_type=resource_type,
            resource_filter=resource_filter,
            consent_text=consent_text,
        )
        config.permissions.append(permission)
        logger.info(f"[IntegrationManager] Permission added: {resource_type}/{scope.value}")
        return permission

    def revoke_permission(self, user_id: str, connector_id: str, permission_id: str) -> bool:
        config = self.get_integration(user_id, connector_id)
        if not config:
            return False
        for perm in config.permissions:
            if perm.permission_id == permission_id:
                perm.is_active = False
                logger.info(f"[IntegrationManager] Permission revoked: {permission_id}")
                return True
        return False

    def get_active_permissions(self, user_id: str, connector_id: str) -> List[ConnectorPermission]:
        config = self.get_integration(user_id, connector_id)
        if not config:
            return []
        return [p for p in config.permissions if p.is_active]

    # ── Dashboard Data ────────────────────────

    def get_dashboard_data(self, user_id: str) -> Dict[str, Any]:
        """Return aggregated data for the Integration Dashboard."""
        integrations = self.list_user_integrations(user_id)
        total = len(integrations)
        connected = sum(1 for i in integrations if i.status == ConnectorStatus.CONNECTED)
        errors = sum(1 for i in integrations if i.status == ConnectorStatus.ERROR)
        healthy = sum(1 for i in integrations if i.health == IntegrationHealth.HEALTHY)

        return {
            "summary": {
                "total": total,
                "connected": connected,
                "disconnected": total - connected - errors,
                "errors": errors,
                "healthy": healthy,
            },
            "integrations": [
                {
                    "integration_id": i.integration_id,
                    "connector_id": i.connector_id,
                    "status": i.status.value,
                    "health": i.health.value,
                    "sync_frequency": i.sync_frequency.value,
                    "last_sync": i.last_sync.isoformat() if i.last_sync else None,
                    "next_sync": i.next_sync.isoformat() if i.next_sync else None,
                    "error_count": i.error_count,
                    "permissions_count": len(self.get_active_permissions(user_id, i.connector_id)),
                }
                for i in integrations
            ],
        }

    def get_stats(self) -> Dict[str, Any]:
        return {
            "total_integrations": len(self._integrations),
            "by_status": {
                status.value: sum(
                    1 for c in self._integrations.values() if c.status == status
                )
                for status in ConnectorStatus
            },
        }
