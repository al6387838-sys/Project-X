"""
Productivity, Communication, Developer & Storage Connectors
Universal Connector Platform — Sprint 025

Connectors:
  - Notion
  - Slack
  - Discord
  - GitHub
  - GitLab
  - Zoom
  - Dropbox
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
    OAuthToken,
    SyncDirection,
    SyncFrequency,
    SyncJob,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Notion Connector
# ─────────────────────────────────────────────

class NotionConnector(BaseConnector):
    """
    Notion Connector.
    Syncs pages, databases, and blocks from Notion workspaces.
    """

    manifest = ConnectorManifest(
        connector_id="notion",
        name="Notion",
        provider="Notion Labs",
        version="1.0.0",
        category=ConnectorCategory.PRODUCTIVITY,
        auth_type=AuthType.OAUTH2,
        description="Connect your Notion workspace to sync pages, databases, and tasks with LifeOS.",
        icon_url="https://www.notion.so/images/favicon.ico",
        website_url="https://notion.so",
        privacy_policy_url="https://www.notion.so/Privacy-Policy",
        terms_url="https://www.notion.so/Terms-and-Privacy",
        capabilities=[
            ConnectorCapability("read_pages", "Read Notion pages", "read_content"),
            ConnectorCapability("create_pages", "Create Notion pages", "insert_content"),
            ConnectorCapability("update_pages", "Update Notion pages", "update_content"),
            ConnectorCapability("read_databases", "Read database entries", "read_content"),
            ConnectorCapability("query_databases", "Query database with filters", "read_content"),
            ConnectorCapability("create_database_entries", "Create database entries", "insert_content"),
            ConnectorCapability("read_blocks", "Read page blocks", "read_content"),
            ConnectorCapability("search", "Search across workspace", "read_content"),
        ],
        required_scopes=["read_content"],
        optional_scopes=["insert_content", "update_content"],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.EVERY_15_MINUTES, SyncFrequency.HOURLY, SyncFrequency.DAILY],
        is_verified=True,
        is_official=True,
        tags=["notion", "notes", "databases", "productivity", "wiki"],
    )

    BASE_URL = "https://api.notion.com/v1"

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="notion",
            access_token=credentials.get("access_token", ""),
            refresh_token=None,
            token_type="Bearer",
            expires_at=None,  # Notion tokens don't expire
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        return token  # Notion tokens are long-lived

    async def revoke_token(self, token: OAuthToken) -> bool:
        return True

    async def test_connection(self) -> bool:
        # GET /users/me
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        logger.info(f"[Notion] Syncing: job={job.job_id}")
        # POST /search with filter.last_edited_time
        await asyncio.sleep(0.05)
        job.records_synced = 22
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job

    async def search(self, query: str, filter_type: Optional[str] = None) -> List[Dict]:
        """Search across Notion workspace."""
        # POST /search
        return [{"id": f"page_{i}", "title": f"Result {i}"} for i in range(5)]

    async def query_database(self, database_id: str, filter_obj: Optional[Dict] = None) -> List[Dict]:
        """Query a Notion database."""
        # POST /databases/{database_id}/query
        return [{"id": f"entry_{i}", "properties": {}} for i in range(10)]


# ─────────────────────────────────────────────
# Slack Connector
# ─────────────────────────────────────────────

class SlackConnector(BaseConnector):
    """Slack Connector — channels, messages, and notifications."""

    manifest = ConnectorManifest(
        connector_id="slack",
        name="Slack",
        provider="Slack Technologies",
        version="1.0.0",
        category=ConnectorCategory.COMMUNICATION,
        auth_type=AuthType.OAUTH2,
        description="Connect Slack to receive notifications and manage messages from LifeOS.",
        icon_url="https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png",
        website_url="https://slack.com",
        privacy_policy_url="https://slack.com/privacy-policy",
        terms_url="https://slack.com/terms-of-service",
        capabilities=[
            ConnectorCapability("list_channels", "List Slack channels", "channels:read"),
            ConnectorCapability("read_messages", "Read channel messages", "channels:history"),
            ConnectorCapability("send_messages", "Send messages to channels", "chat:write"),
            ConnectorCapability("read_users", "Read workspace users", "users:read"),
            ConnectorCapability("send_dm", "Send direct messages", "im:write"),
            ConnectorCapability("manage_notifications", "Manage LifeOS notifications via Slack", "chat:write"),
        ],
        required_scopes=["channels:read", "users:read"],
        optional_scopes=["channels:history", "chat:write", "im:write"],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.REALTIME, SyncFrequency.EVERY_5_MINUTES],
        is_verified=True,
        is_official=True,
        tags=["slack", "chat", "communication", "notifications", "team"],
    )

    BASE_URL = "https://slack.com/api"

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="slack",
            access_token=credentials.get("access_token", ""),
            refresh_token=credentials.get("refresh_token"),
            token_type="Bearer",
            expires_at=None,
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        return token

    async def revoke_token(self, token: OAuthToken) -> bool:
        # POST /auth.revoke
        return True

    async def test_connection(self) -> bool:
        # POST /auth.test
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        await asyncio.sleep(0.05)
        job.records_synced = 50
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job

    async def send_message(self, channel: str, text: str, blocks: Optional[List] = None) -> Dict:
        """Send a message to a Slack channel."""
        # POST /chat.postMessage
        return {"ok": True, "ts": f"{datetime.now(timezone.utc).timestamp():.6f}", "channel": channel}

    async def send_notification(self, user_id: str, title: str, message: str) -> Dict:
        """Send a LifeOS notification via Slack DM."""
        return await self.send_message(f"@{user_id}", f"*{title}*\n{message}")


# ─────────────────────────────────────────────
# Discord Connector
# ─────────────────────────────────────────────

class DiscordConnector(BaseConnector):
    """Discord Connector — servers, channels, and notifications."""

    manifest = ConnectorManifest(
        connector_id="discord",
        name="Discord",
        provider="Discord Inc.",
        version="1.0.0",
        category=ConnectorCategory.COMMUNICATION,
        auth_type=AuthType.OAUTH2,
        description="Connect Discord to receive LifeOS notifications and sync server activity.",
        icon_url="https://discord.com/assets/favicon.ico",
        website_url="https://discord.com",
        privacy_policy_url="https://discord.com/privacy",
        terms_url="https://discord.com/terms",
        capabilities=[
            ConnectorCapability("read_guilds", "Read Discord servers", "guilds"),
            ConnectorCapability("read_channels", "Read server channels", "guilds"),
            ConnectorCapability("send_messages", "Send messages via webhook", "webhook.incoming"),
            ConnectorCapability("read_user", "Read user profile", "identify"),
            ConnectorCapability("manage_notifications", "LifeOS notifications via Discord", "webhook.incoming"),
        ],
        required_scopes=["identify", "guilds"],
        optional_scopes=["guilds.members.read", "webhook.incoming"],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.WRITE_ONLY],
        supported_sync_frequencies=[SyncFrequency.REALTIME, SyncFrequency.EVERY_15_MINUTES],
        is_verified=True,
        is_official=True,
        tags=["discord", "chat", "gaming", "community", "notifications"],
    )

    BASE_URL = "https://discord.com/api/v10"

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="discord",
            access_token=credentials.get("access_token", ""),
            refresh_token=credentials.get("refresh_token"),
            token_type="Bearer",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        token.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        return token

    async def revoke_token(self, token: OAuthToken) -> bool:
        return True

    async def test_connection(self) -> bool:
        # GET /users/@me
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        await asyncio.sleep(0.05)
        job.records_synced = 5
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job


# ─────────────────────────────────────────────
# GitHub Connector
# ─────────────────────────────────────────────

class GitHubConnector(BaseConnector):
    """GitHub Connector — repos, issues, PRs, and notifications."""

    manifest = ConnectorManifest(
        connector_id="github",
        name="GitHub",
        provider="GitHub Inc.",
        version="1.0.0",
        category=ConnectorCategory.DEVELOPER,
        auth_type=AuthType.OAUTH2,
        description="Connect GitHub to track issues, PRs, and repository activity in LifeOS.",
        icon_url="https://github.com/favicon.ico",
        website_url="https://github.com",
        privacy_policy_url="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement",
        terms_url="https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
        capabilities=[
            ConnectorCapability("list_repos", "List repositories", "repo"),
            ConnectorCapability("read_issues", "Read issues", "repo"),
            ConnectorCapability("create_issues", "Create issues", "repo"),
            ConnectorCapability("read_prs", "Read pull requests", "repo"),
            ConnectorCapability("read_notifications", "Read GitHub notifications", "notifications"),
            ConnectorCapability("read_commits", "Read commit history", "repo"),
            ConnectorCapability("read_actions", "Read GitHub Actions", "repo"),
            ConnectorCapability("manage_projects", "Manage GitHub Projects", "project"),
        ],
        required_scopes=["read:user", "notifications"],
        optional_scopes=["repo", "project", "read:org"],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.EVERY_5_MINUTES, SyncFrequency.EVERY_15_MINUTES, SyncFrequency.HOURLY],
        is_verified=True,
        is_official=True,
        tags=["github", "git", "developer", "code", "issues", "devops"],
    )

    BASE_URL = "https://api.github.com"

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="github",
            access_token=credentials.get("access_token", ""),
            refresh_token=None,
            token_type="Bearer",
            expires_at=None,
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        return token  # GitHub tokens don't expire by default

    async def revoke_token(self, token: OAuthToken) -> bool:
        # DELETE /applications/{client_id}/token
        return True

    async def test_connection(self) -> bool:
        # GET /user
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        logger.info(f"[GitHub] Syncing: job={job.job_id}")
        await asyncio.sleep(0.05)
        job.records_synced = 35
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job

    async def list_notifications(self, all_notifications: bool = False) -> List[Dict]:
        """List GitHub notifications."""
        # GET /notifications
        return [{"id": f"notif_{i}", "reason": "mention", "subject": {"title": f"Issue {i}"}} for i in range(5)]


# ─────────────────────────────────────────────
# GitLab Connector
# ─────────────────────────────────────────────

class GitLabConnector(BaseConnector):
    """GitLab Connector — projects, issues, MRs, and CI/CD."""

    manifest = ConnectorManifest(
        connector_id="gitlab",
        name="GitLab",
        provider="GitLab Inc.",
        version="1.0.0",
        category=ConnectorCategory.DEVELOPER,
        auth_type=AuthType.OAUTH2,
        description="Connect GitLab to track projects, merge requests, and CI/CD pipelines in LifeOS.",
        icon_url="https://gitlab.com/assets/favicon-72a2cad5025aa931d6ea56c3201d1f18e68a8cd39788c7c80d5b2b82aa5143ef.png",
        website_url="https://gitlab.com",
        privacy_policy_url="https://about.gitlab.com/privacy/",
        terms_url="https://about.gitlab.com/terms/",
        capabilities=[
            ConnectorCapability("list_projects", "List GitLab projects", "read_api"),
            ConnectorCapability("read_issues", "Read issues", "read_api"),
            ConnectorCapability("read_mrs", "Read merge requests", "read_api"),
            ConnectorCapability("read_pipelines", "Read CI/CD pipelines", "read_api"),
            ConnectorCapability("read_todos", "Read GitLab todos", "read_api"),
        ],
        required_scopes=["read_user", "read_api"],
        optional_scopes=["api", "write_repository"],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.EVERY_15_MINUTES, SyncFrequency.HOURLY],
        is_verified=True,
        is_official=True,
        tags=["gitlab", "git", "developer", "cicd", "devops"],
    )

    BASE_URL = "https://gitlab.com/api/v4"

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="gitlab",
            access_token=credentials.get("access_token", ""),
            refresh_token=credentials.get("refresh_token"),
            token_type="Bearer",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        token.expires_at = datetime.now(timezone.utc) + timedelta(hours=2)
        return token

    async def revoke_token(self, token: OAuthToken) -> bool:
        # POST /oauth/revoke
        return True

    async def test_connection(self) -> bool:
        # GET /user
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        await asyncio.sleep(0.05)
        job.records_synced = 28
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job


# ─────────────────────────────────────────────
# Zoom Connector
# ─────────────────────────────────────────────

class ZoomConnector(BaseConnector):
    """Zoom Connector — meetings, webinars, and recordings."""

    manifest = ConnectorManifest(
        connector_id="zoom",
        name="Zoom",
        provider="Zoom Video Communications",
        version="1.0.0",
        category=ConnectorCategory.COMMUNICATION,
        auth_type=AuthType.OAUTH2,
        description="Connect Zoom to manage meetings, webinars, and recordings from LifeOS.",
        icon_url="https://st1.zoom.us/zoom.ico",
        website_url="https://zoom.us",
        privacy_policy_url="https://zoom.us/privacy",
        terms_url="https://zoom.us/terms",
        capabilities=[
            ConnectorCapability("list_meetings", "List Zoom meetings", "meeting:read"),
            ConnectorCapability("create_meeting", "Create Zoom meetings", "meeting:write"),
            ConnectorCapability("update_meeting", "Update Zoom meetings", "meeting:write"),
            ConnectorCapability("delete_meeting", "Delete Zoom meetings", "meeting:write"),
            ConnectorCapability("list_webinars", "List webinars", "webinar:read"),
            ConnectorCapability("list_recordings", "List cloud recordings", "recording:read"),
            ConnectorCapability("get_meeting_link", "Get meeting join link", "meeting:read"),
        ],
        required_scopes=["meeting:read", "user:read"],
        optional_scopes=["meeting:write", "webinar:read", "recording:read"],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.EVERY_15_MINUTES, SyncFrequency.HOURLY],
        is_verified=True,
        is_official=True,
        tags=["zoom", "video", "meetings", "webinars", "communication"],
    )

    BASE_URL = "https://api.zoom.us/v2"

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="zoom",
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
        # POST /oauth/revoke
        return True

    async def test_connection(self) -> bool:
        # GET /users/me
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        await asyncio.sleep(0.05)
        job.records_synced = 12
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job

    async def create_meeting(self, topic: str, start_time: datetime, duration: int = 60) -> Dict:
        """Create a Zoom meeting."""
        # POST /users/me/meetings
        return {
            "id": f"zoom_{datetime.now(timezone.utc).timestamp():.0f}",
            "topic": topic,
            "join_url": f"https://zoom.us/j/123456789",
            "start_time": start_time.isoformat(),
            "duration": duration,
        }


# ─────────────────────────────────────────────
# Dropbox Connector
# ─────────────────────────────────────────────

class DropboxConnector(BaseConnector):
    """Dropbox Connector — file storage and sync."""

    manifest = ConnectorManifest(
        connector_id="dropbox",
        name="Dropbox",
        provider="Dropbox Inc.",
        version="1.0.0",
        category=ConnectorCategory.STORAGE,
        auth_type=AuthType.OAUTH2,
        description="Sync your Dropbox files and folders with LifeOS.",
        icon_url="https://cfl.dropboxstatic.com/static/images/favicon-vfl8lUR9B.ico",
        website_url="https://www.dropbox.com",
        privacy_policy_url="https://www.dropbox.com/privacy",
        terms_url="https://www.dropbox.com/terms",
        capabilities=[
            ConnectorCapability("list_files", "List files and folders", "files.metadata.read"),
            ConnectorCapability("read_files", "Read file content", "files.content.read"),
            ConnectorCapability("upload_files", "Upload files", "files.content.write"),
            ConnectorCapability("share_files", "Share files and folders", "sharing.write"),
            ConnectorCapability("search_files", "Search files", "files.metadata.read"),
            ConnectorCapability("delta_sync", "Incremental file sync via longpoll", "files.metadata.read"),
        ],
        required_scopes=["files.metadata.read"],
        optional_scopes=["files.content.read", "files.content.write", "sharing.write"],
        supported_sync_directions=[SyncDirection.READ_ONLY, SyncDirection.BIDIRECTIONAL],
        supported_sync_frequencies=[SyncFrequency.EVERY_15_MINUTES, SyncFrequency.HOURLY, SyncFrequency.DAILY],
        is_verified=True,
        is_official=True,
        tags=["dropbox", "storage", "files", "cloud", "sync"],
    )

    BASE_URL = "https://api.dropboxapi.com/2"

    async def authenticate(self, credentials: Dict[str, Any]) -> OAuthToken:
        return OAuthToken(
            user_id=credentials.get("user_id", ""),
            connector_id="dropbox",
            access_token=credentials.get("access_token", ""),
            refresh_token=credentials.get("refresh_token"),
            token_type="Bearer",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=4),
            scopes=self.manifest.required_scopes,
        )

    async def refresh_token(self, token: OAuthToken) -> OAuthToken:
        token.expires_at = datetime.now(timezone.utc) + timedelta(hours=4)
        return token

    async def revoke_token(self, token: OAuthToken) -> bool:
        # POST /auth/token/revoke
        return True

    async def test_connection(self) -> bool:
        # POST /users/get_current_account
        return True

    async def sync(self, job: SyncJob) -> SyncJob:
        job.started_at = datetime.now(timezone.utc)
        logger.info(f"[Dropbox] Syncing: job={job.job_id}")
        # POST /files/list_folder/continue with cursor
        await asyncio.sleep(0.05)
        job.records_synced = 18
        job.delta_token = f"dbx_cursor_{datetime.now(timezone.utc).timestamp():.0f}"
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        return job


# ─────────────────────────────────────────────
# Registry
# ─────────────────────────────────────────────

PRODUCTIVITY_CONNECTORS = [
    NotionConnector,
    SlackConnector,
    DiscordConnector,
    GitHubConnector,
    GitLabConnector,
    ZoomConnector,
    DropboxConnector,
]
