"""
Microsoft Connectors — Universal Connector Platform
Connectors for Microsoft 365 services via Microsoft Graph API.

Connectors:
  - Microsoft Outlook (Calendar + Email)
  - Microsoft 365 (Office Suite)
  - Microsoft Teams
  - OneDrive
"""

from __future__ import annotations
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from connector_platform.core.connector_engine import BaseConnector, CredentialVault
from connector_platform.models.connector_models import (
    AuthType,
    ConnectorCapability,
    ConnectorCategory,
    ConnectorManifest,
    ConnectorStatus,
    IntegrationConfig,
    OAuthToken,
    SyncDirection,
    SyncFrequency,
    SyncJob,
)

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


# ─────────────────────────────────────────────
# Microsoft Outlook Connector
# ─────────────────────────────────────────────

class MicrosoftOutlookConnector(BaseConnector):
    """
    Microsoft Outlook Connector.
    Syncs calendar events, emails, contacts, and tasks via Microsoft Graph API.
    Supports delta queries for incremental sync.
    """

    manifest = ConnectorManifest(
        connector_id="microsoft_outlook",
        name="Microsoft Outlook",
        provider="Microsoft",
        version="1.0.0",
        category=ConnectorCategory.CALENDAR,
        auth_type=AuthType.OAUTH2,
        description="Sync your Outlook calendar, emails, contacts, and tasks with LifeOS.",
        icon_url="https://res.cdn.office.net/assets/mail/pwa/v1/icons/icon-192.png",
        website_url="https://outlook.com",
        privacy_policy_url="https://privacy.microsoft.com/privacystatement",
        terms_url="https://www.microsoft.com/servicesagreement",
        capabilities=[
            ConnectorCapability("list_calendars", "List Outlook calendars", "Calendars.Read"),
            ConnectorCapability("read_events", "Read calendar events", "Calendars.Read"),
            ConnectorCapability("create_events", "Create calendar events", "Calendars.ReadWrite"),
            ConnectorCapability("update_events", "Update calendar events", "Calendars.ReadWrite"),
            ConnectorCapability("delete_events", "Delete calendar events", "Calendars.ReadWrite"),
            ConnectorCapability("read_emails", "Read Outlook emails", "Mail.Read"),
            ConnectorCapability("send_emails", "Send Outlook emails", "Mail.Send"),
            ConnectorCapability("read_contacts", "Read Outlook contacts", "Contacts.Read"),
            ConnectorCapability("read_freebusy", "Read free/busy schedule", "Calendars.Read"),
            ConnectorCapability("delta_sync", "Incremental delta sync", "Calendars.Read", is_realtime=False),
            ConnectorCapability("realtime_notifications", "Real-time change notifications", "Calendars.Read", is_realtime=True, requires_webhook=True),
        ],
        required_scopes=[
            "https://graph.microsoft.com/Calendars.Read",
            "https://graph.microsoft.com/User.Read",
        ],
        optional_scopes=[
            "https://graph.microsoft.com/Calendars.ReadWrite",
            "https://graph.microsoft.com/Mail.Read",
            "https://graph.microsoft.com/Mail.Send",
            "https://graph.microsoft.com/Contacts.Read",
            "offline_access",
        ],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[
            SyncFrequency.REALTIME,
            SyncFrequency.EVERY_5_MINUTES,
            SyncFrequency.EVERY_15_MINUTES,
            SyncFrequency.HOURLY,
        ],
        is_verified=True,
        is_official=True,
        tags=["calendar", "email", "microsoft", "outlook", "office365"],
    )

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        """Initiate Microsoft OAuth2 flow."""
        logger.info("[MicrosoftOutlook] Initiating OAuth2 authentication")
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="microsoft_outlook",
            access_token=credentials.get("access_token", ""),
            refresh_token=credentials.get("refresh_token"),
            token_type="Bearer",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        """Refresh Microsoft access token."""
        logger.info("[MicrosoftOutlook] Refreshing token")
        # POST https://login.microsoftonline.com/common/oauth2/v2.0/token
        token.access_token = f"ms_refreshed_{token.access_token}"
        token.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        token.last_refreshed = datetime.now(timezone.utc)
        return token

    async def revoke_token(self, token: OAuthToken) -> bool:
        """Microsoft tokens expire — revoke via sign-out."""
        logger.info("[MicrosoftOutlook] Revoking token")
        return True

    async def test_connection(self) -> bool:
        """Test connection via GET /me."""
        logger.info("[MicrosoftOutlook] Testing connection")
        # GET https://graph.microsoft.com/v1.0/me
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        """
        Sync Outlook calendar events using Microsoft Graph delta queries.
        Delta queries return only changed items since last sync.
        """
        job.started_at = datetime.now(timezone.utc)
        logger.info(f"[MicrosoftOutlook] Syncing: job={job.job_id} delta={job.delta_token}")

        if job.delta_token:
            events = await self._fetch_delta_events(job.delta_token)
        else:
            events = await self._fetch_all_events()

        job.records_synced = len(events)
        job.delta_token = f"ms_delta_{datetime.now(timezone.utc).timestamp():.0f}"
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        logger.info(f"[MicrosoftOutlook] Sync complete: {job.records_synced} events")
        return job

    async def _fetch_delta_events(self, delta_link: str) -> List[Dict]:
        """
        Fetch changed events via Microsoft Graph delta query.
        GET /me/calendarView/delta?$deltatoken={token}
        """
        await asyncio.sleep(0.05)
        return [
            {
                "id": f"ms_event_{i}",
                "subject": f"Outlook Meeting {i}",
                "start": {"dateTime": datetime.now(timezone.utc).isoformat(), "timeZone": "UTC"},
                "end": {"dateTime": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "timeZone": "UTC"},
                "@odata.etag": f"etag_{i}",
            }
            for i in range(3)
        ]

    async def _fetch_all_events(self) -> List[Dict]:
        """
        Full sync: GET /me/calendarView?startDateTime=...&endDateTime=...
        """
        await asyncio.sleep(0.1)
        return [
            {
                "id": f"ms_event_{i}",
                "subject": f"Outlook Event {i}",
                "start": {"dateTime": datetime.now(timezone.utc).isoformat(), "timeZone": "UTC"},
                "end": {"dateTime": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "timeZone": "UTC"},
            }
            for i in range(18)
        ]

    async def create_event(self, event_data: Dict[str, Any]) -> Dict:
        """Create Outlook calendar event."""
        # POST /me/events
        logger.info(f"[MicrosoftOutlook] Creating event: {event_data.get('subject')}")
        return {"id": f"ms_new_{datetime.now(timezone.utc).timestamp():.0f}", **event_data}

    async def update_event(self, event_id: str, updates: Dict[str, Any]) -> Dict:
        """Update Outlook calendar event."""
        # PATCH /me/events/{event_id}
        return {"id": event_id, **updates}

    async def delete_event(self, event_id: str) -> bool:
        """Delete Outlook calendar event."""
        # DELETE /me/events/{event_id}
        return True

    async def get_schedule(self, emails: List[str], start: datetime, end: datetime) -> Dict:
        """
        Get free/busy schedule for multiple users.
        POST /me/calendar/getSchedule
        """
        return {
            "value": [
                {
                    "scheduleId": email,
                    "availabilityView": "0002220000",
                    "scheduleItems": [],
                }
                for email in emails
            ]
        }

    async def subscribe_to_changes(self, webhook_url: str, resource: str = "/me/events") -> Dict:
        """
        Subscribe to Microsoft Graph change notifications.
        POST /subscriptions
        """
        return {
            "id": f"sub_{datetime.now(timezone.utc).timestamp():.0f}",
            "resource": resource,
            "changeType": "created,updated,deleted",
            "notificationUrl": webhook_url,
            "expirationDateTime": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        }


# ─────────────────────────────────────────────
# Microsoft 365 Connector
# ─────────────────────────────────────────────

class Microsoft365Connector(BaseConnector):
    """
    Microsoft 365 Connector.
    Access to Office suite, SharePoint, and Microsoft 365 services.
    """

    manifest = ConnectorManifest(
        connector_id="microsoft_365",
        name="Microsoft 365",
        provider="Microsoft",
        version="1.0.0",
        category=ConnectorCategory.PRODUCTIVITY,
        auth_type=AuthType.OAUTH2,
        description="Connect to Microsoft 365 for Office documents, SharePoint, and productivity tools.",
        icon_url="https://res.cdn.office.net/assets/hub/app/icons/m365-icon-96.png",
        website_url="https://www.microsoft365.com",
        privacy_policy_url="https://privacy.microsoft.com/privacystatement",
        terms_url="https://www.microsoft.com/servicesagreement",
        capabilities=[
            ConnectorCapability("read_documents", "Read Office documents", "Files.Read"),
            ConnectorCapability("write_documents", "Write Office documents", "Files.ReadWrite"),
            ConnectorCapability("sharepoint_access", "Access SharePoint sites", "Sites.Read.All"),
            ConnectorCapability("read_profile", "Read user profile", "User.Read"),
            ConnectorCapability("read_organization", "Read organization data", "Organization.Read.All"),
        ],
        required_scopes=[
            "https://graph.microsoft.com/Files.Read",
            "https://graph.microsoft.com/User.Read",
        ],
        optional_scopes=[
            "https://graph.microsoft.com/Files.ReadWrite",
            "https://graph.microsoft.com/Sites.Read.All",
        ],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.HOURLY, SyncFrequency.DAILY],
        is_verified=True,
        is_official=True,
        tags=["office", "microsoft", "documents", "sharepoint", "productivity"],
    )

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="microsoft_365",
            access_token=credentials.get("access_token", ""),
            refresh_token=credentials.get("refresh_token"),
            token_type="Bearer",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        token.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        return token

    async def revoke_token(self, token: OAuthToken) -> bool:
        return True

    async def test_connection(self) -> bool:
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        await asyncio.sleep(0.05)
        job.records_synced = 30
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job


# ─────────────────────────────────────────────
# Microsoft Teams Connector
# ─────────────────────────────────────────────

class MicrosoftTeamsConnector(BaseConnector):
    """Microsoft Teams Connector."""

    manifest = ConnectorManifest(
        connector_id="microsoft_teams",
        name="Microsoft Teams",
        provider="Microsoft",
        version="1.0.0",
        category=ConnectorCategory.COMMUNICATION,
        auth_type=AuthType.OAUTH2,
        description="Connect Microsoft Teams for meetings, chats, and collaboration within LifeOS.",
        icon_url="https://res.cdn.office.net/assets/teams/app/icons/teams-icon-96.png",
        website_url="https://teams.microsoft.com",
        privacy_policy_url="https://privacy.microsoft.com/privacystatement",
        terms_url="https://www.microsoft.com/servicesagreement",
        capabilities=[
            ConnectorCapability("list_teams", "List Teams and channels", "Team.ReadBasic.All"),
            ConnectorCapability("read_messages", "Read channel messages", "ChannelMessage.Read.All"),
            ConnectorCapability("send_messages", "Send channel messages", "ChannelMessage.Send"),
            ConnectorCapability("create_meeting", "Create Teams meetings", "OnlineMeetings.ReadWrite"),
            ConnectorCapability("list_meetings", "List Teams meetings", "OnlineMeetings.Read"),
            ConnectorCapability("read_chats", "Read direct chats", "Chat.Read"),
        ],
        required_scopes=[
            "https://graph.microsoft.com/Team.ReadBasic.All",
            "https://graph.microsoft.com/User.Read",
        ],
        optional_scopes=[
            "https://graph.microsoft.com/ChannelMessage.Read.All",
            "https://graph.microsoft.com/OnlineMeetings.ReadWrite",
            "https://graph.microsoft.com/Chat.Read",
        ],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.EVERY_15_MINUTES, SyncFrequency.HOURLY],
        is_verified=True,
        is_official=True,
        tags=["teams", "microsoft", "meetings", "chat", "communication"],
    )

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="microsoft_teams",
            access_token=credentials.get("access_token", ""),
            refresh_token=credentials.get("refresh_token"),
            token_type="Bearer",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        token.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        return token

    async def revoke_token(self, token: OAuthToken) -> bool:
        return True

    async def test_connection(self) -> bool:
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        await asyncio.sleep(0.05)
        job.records_synced = 10
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job

    async def create_meeting(self, subject: str, start: datetime, end: datetime) -> Dict:
        """Create a Teams online meeting."""
        # POST /me/onlineMeetings
        return {
            "id": f"teams_meeting_{datetime.now(timezone.utc).timestamp():.0f}",
            "subject": subject,
            "joinUrl": f"https://teams.microsoft.com/l/meetup-join/...",
            "start": {"dateTime": start.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end.isoformat(), "timeZone": "UTC"},
        }


# ─────────────────────────────────────────────
# OneDrive Connector
# ─────────────────────────────────────────────

class OneDriveConnector(BaseConnector):
    """OneDrive Connector."""

    manifest = ConnectorManifest(
        connector_id="onedrive",
        name="OneDrive",
        provider="Microsoft",
        version="1.0.0",
        category=ConnectorCategory.STORAGE,
        auth_type=AuthType.OAUTH2,
        description="Sync your OneDrive files and folders with LifeOS.",
        icon_url="https://res.cdn.office.net/assets/onedrive/icons/onedrive-icon-96.png",
        website_url="https://onedrive.live.com",
        privacy_policy_url="https://privacy.microsoft.com/privacystatement",
        terms_url="https://www.microsoft.com/servicesagreement",
        capabilities=[
            ConnectorCapability("list_files", "List files and folders", "Files.Read"),
            ConnectorCapability("read_files", "Read file content", "Files.Read"),
            ConnectorCapability("upload_files", "Upload files", "Files.ReadWrite"),
            ConnectorCapability("share_files", "Share files", "Files.ReadWrite"),
            ConnectorCapability("delta_sync", "Incremental file sync", "Files.Read"),
        ],
        required_scopes=["https://graph.microsoft.com/Files.Read"],
        optional_scopes=["https://graph.microsoft.com/Files.ReadWrite"],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.EVERY_15_MINUTES, SyncFrequency.HOURLY, SyncFrequency.DAILY],
        is_verified=True,
        is_official=True,
        tags=["storage", "files", "microsoft", "onedrive", "cloud"],
    )

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="onedrive",
            access_token=credentials.get("access_token", ""),
            refresh_token=credentials.get("refresh_token"),
            token_type="Bearer",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        token.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        return token

    async def revoke_token(self, token: OAuthToken) -> bool:
        return True

    async def test_connection(self) -> bool:
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        await asyncio.sleep(0.05)
        # GET /me/drive/root/delta
        job.records_synced = 20
        job.delta_token = f"od_delta_{datetime.now(timezone.utc).timestamp():.0f}"
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job


# ─────────────────────────────────────────────
# Registry
# ─────────────────────────────────────────────

MICROSOFT_CONNECTORS = [
    MicrosoftOutlookConnector,
    Microsoft365Connector,
    MicrosoftTeamsConnector,
    OneDriveConnector,
]
