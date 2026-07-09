"""
Integration Dashboard — Universal Connector Platform
Provides aggregated views and metrics for all active integrations.
"""

from __future__ import annotations
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from connector_platform.models.connector_models import (
    ConnectorStatus,
    IntegrationConfig,
    IntegrationHealth,
)

logger = logging.getLogger(__name__)


class IntegrationDashboard:
    """
    Integration Dashboard for LifeOS.
    Aggregates data from all managers to provide a unified view.
    """

    def __init__(self, integration_manager, sync_manager, webhook_manager, monitor):
        self._integration_manager = integration_manager
        self._sync_manager = sync_manager
        self._webhook_manager = webhook_manager
        self._monitor = monitor

    def get_overview(self, user_id: str) -> Dict[str, Any]:
        """Get complete dashboard overview for a user."""
        integrations = self._integration_manager.list_user_integrations(user_id)
        dashboard_data = self._integration_manager.get_dashboard_data(user_id)
        sync_stats = self._sync_manager.get_stats()
        webhook_stats = self._webhook_manager.get_stats()
        health_report = self._monitor.get_health_report()

        return {
            "user_id": user_id,
            "generated_at": datetime.utcnow().isoformat(),
            "summary": dashboard_data["summary"],
            "integrations": dashboard_data["integrations"],
            "sync": {
                "queue_size": sync_stats["queue_size"],
                "active_jobs": sync_stats["active_jobs"],
                "total_syncs": sync_stats["total_syncs"],
                "success_rate": (
                    sync_stats["successful_syncs"] / max(sync_stats["total_syncs"], 1) * 100
                ),
                "pending_conflicts": sync_stats["pending_conflicts"],
                "recent_jobs": [
                    {
                        "job_id": j.job_id,
                        "connector_id": j.connector_id,
                        "status": j.status,
                        "records_synced": j.records_synced,
                        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
                    }
                    for j in self._sync_manager.get_recent_jobs(5)
                ],
            },
            "webhooks": {
                "active": webhook_stats["active_webhooks"],
                "total_deliveries": webhook_stats["total_deliveries"],
                "delivery_success_rate": (
                    webhook_stats["successful_deliveries"] / max(webhook_stats["total_deliveries"], 1) * 100
                ),
                "dead_letter_queue": webhook_stats["dead_letter_queue_size"],
            },
            "health": health_report,
            "alerts": self._get_alerts(user_id),
        }

    def _get_alerts(self, user_id: str) -> List[Dict[str, Any]]:
        """Generate alerts for integration issues."""
        alerts = []
        integrations = self._integration_manager.list_user_integrations(user_id)

        for integration in integrations:
            if integration.health == IntegrationHealth.UNHEALTHY:
                alerts.append({
                    "severity": "error",
                    "connector_id": integration.connector_id,
                    "message": f"Integration unhealthy: {integration.last_error}",
                    "action": "reconnect",
                })
            elif integration.health == IntegrationHealth.DEGRADED:
                alerts.append({
                    "severity": "warning",
                    "connector_id": integration.connector_id,
                    "message": f"Integration degraded ({integration.error_count} errors)",
                    "action": "check_settings",
                })
            elif integration.status == ConnectorStatus.PENDING_AUTH:
                alerts.append({
                    "severity": "info",
                    "connector_id": integration.connector_id,
                    "message": "Authentication pending — please complete OAuth flow",
                    "action": "authenticate",
                })

        return alerts

    def get_connector_detail(self, user_id: str, connector_id: str) -> Dict[str, Any]:
        """Get detailed view for a specific connector integration."""
        integration = self._integration_manager.get_integration(user_id, connector_id)
        if not integration:
            return {"error": "Integration not found"}

        sync_history = self._integration_manager.get_sync_history(integration.integration_id)
        error_history = self._integration_manager.get_error_history(integration.integration_id)
        permissions = self._integration_manager.get_active_permissions(user_id, connector_id)
        health_metrics = self._monitor.get_connector_metrics(integration.integration_id)

        return {
            "integration": {
                "integration_id": integration.integration_id,
                "connector_id": connector_id,
                "status": integration.status.value,
                "health": integration.health.value,
                "sync_direction": integration.sync_direction.value,
                "sync_frequency": integration.sync_frequency.value,
                "last_sync": integration.last_sync.isoformat() if integration.last_sync else None,
                "next_sync": integration.next_sync.isoformat() if integration.next_sync else None,
                "error_count": integration.error_count,
                "last_error": integration.last_error,
                "created_at": integration.created_at.isoformat(),
            },
            "permissions": [
                {
                    "scope": p.scope.value,
                    "resource_type": p.resource_type,
                    "granted_at": p.granted_at.isoformat(),
                }
                for p in permissions
            ],
            "sync_history": [
                {
                    "job_id": j.job_id,
                    "status": j.status,
                    "records_synced": j.records_synced,
                    "started_at": j.started_at.isoformat() if j.started_at else None,
                    "completed_at": j.completed_at.isoformat() if j.completed_at else None,
                }
                for j in sync_history[-10:]
            ],
            "error_history": error_history[-5:],
            "health_metrics": health_metrics,
        }
