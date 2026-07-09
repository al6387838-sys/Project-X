"""
Connector Platform — Core Data Models
Defines all data structures used across the Universal Connector Platform.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid


# ─────────────────────────────────────────────
# Enumerations
# ─────────────────────────────────────────────

class ConnectorCategory(Enum):
    CALENDAR = "calendar"
    EMAIL = "email"
    STORAGE = "storage"
    TASKS = "tasks"
    COMMUNICATION = "communication"
    DEVELOPER = "developer"
    PRODUCTIVITY = "productivity"
    HEALTH = "health"
    FINANCE = "finance"
    WEARABLE = "wearable"
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    CRM = "crm"
    ERP = "erp"
    INSURANCE = "insurance"


class ConnectorStatus(Enum):
    AVAILABLE = "available"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    PENDING_AUTH = "pending_auth"
    SUSPENDED = "suspended"
    BETA = "beta"
    COMING_SOON = "coming_soon"


class AuthType(Enum):
    OAUTH2 = "oauth2"
    API_KEY = "api_key"
    BASIC_AUTH = "basic_auth"
    JWT = "jwt"
    OPEN_FINANCE = "open_finance"
    FHIR = "fhir"
    CUSTOM = "custom"


class SyncDirection(Enum):
    READ_ONLY = "read_only"
    WRITE_ONLY = "write_only"
    BIDIRECTIONAL = "bidirectional"


class SyncFrequency(Enum):
    REALTIME = "realtime"
    EVERY_5_MINUTES = "5min"
    EVERY_15_MINUTES = "15min"
    EVERY_30_MINUTES = "30min"
    HOURLY = "hourly"
    DAILY = "daily"
    MANUAL = "manual"


class PermissionScope(Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"


class WebhookEvent(Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    SYNCED = "synced"
    ERROR = "error"
    AUTH_EXPIRED = "auth_expired"
    RATE_LIMITED = "rate_limited"


class IntegrationHealth(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


# ─────────────────────────────────────────────
# Core Models
# ─────────────────────────────────────────────

@dataclass
class ConnectorCapability:
    """Defines what a connector can do."""
    name: str
    description: str
    scope_required: str
    is_realtime: bool = False
    requires_webhook: bool = False
    data_types: List[str] = field(default_factory=list)


@dataclass
class ConnectorManifest:
    """
    Connector Manifest — the complete descriptor of a connector.
    Every connector must provide a manifest for registration.
    """
    connector_id: str
    name: str
    provider: str
    version: str
    category: ConnectorCategory
    auth_type: AuthType
    description: str
    icon_url: str
    website_url: str
    privacy_policy_url: str
    terms_url: str
    capabilities: List[ConnectorCapability] = field(default_factory=list)
    required_scopes: List[str] = field(default_factory=list)
    optional_scopes: List[str] = field(default_factory=list)
    supported_sync_directions: List[SyncDirection] = field(default_factory=list)
    supported_sync_frequencies: List[SyncFrequency] = field(default_factory=list)
    is_verified: bool = False
    is_official: bool = False
    is_beta: bool = False
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OAuthConfig:
    """OAuth 2.0 configuration for a connector."""
    client_id: str
    client_secret: str  # Encrypted at rest
    auth_url: str
    token_url: str
    revoke_url: Optional[str]
    scopes: List[str]
    redirect_uri: str
    pkce_enabled: bool = True
    state_param: str = field(default_factory=lambda: str(uuid.uuid4()))
    extra_params: Dict[str, str] = field(default_factory=dict)


@dataclass
class OAuthToken:
    """Stored OAuth token — encrypted at rest."""
    user_id: str
    connector_id: str
    access_token: str       # Encrypted
    refresh_token: Optional[str]  # Encrypted
    token_type: str
    expires_at: Optional[datetime]
    scopes: List[str]
    issued_at: datetime = field(default_factory=datetime.utcnow)
    last_refreshed: Optional[datetime] = None
    is_valid: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConnectorPermission:
    """Granular permission granted by user for a specific connector."""
    permission_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    connector_id: str = ""
    scope: PermissionScope = PermissionScope.READ
    resource_type: str = ""          # e.g., "calendar", "email", "file"
    resource_filter: Optional[str] = None  # e.g., "work_calendar_only"
    granted_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    is_active: bool = True
    consent_version: str = "1.0"
    consent_text: str = ""


@dataclass
class IntegrationConfig:
    """User-level configuration for an active integration."""
    integration_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    connector_id: str = ""
    status: ConnectorStatus = ConnectorStatus.DISCONNECTED
    sync_direction: SyncDirection = SyncDirection.BIDIRECTIONAL
    sync_frequency: SyncFrequency = SyncFrequency.HOURLY
    permissions: List[ConnectorPermission] = field(default_factory=list)
    settings: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_sync: Optional[datetime] = None
    next_sync: Optional[datetime] = None
    error_count: int = 0
    last_error: Optional[str] = None
    health: IntegrationHealth = IntegrationHealth.UNKNOWN
    tags: List[str] = field(default_factory=list)


@dataclass
class SyncJob:
    """Represents a single synchronization job."""
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    integration_id: str = ""
    connector_id: str = ""
    user_id: str = ""
    direction: SyncDirection = SyncDirection.BIDIRECTIONAL
    resource_types: List[str] = field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    records_synced: int = 0
    records_failed: int = 0
    delta_token: Optional[str] = None   # For incremental sync
    status: str = "pending"
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WebhookRegistration:
    """Webhook registration for real-time event delivery."""
    webhook_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    integration_id: str = ""
    connector_id: str = ""
    user_id: str = ""
    endpoint_url: str = ""
    secret: str = ""    # HMAC secret — encrypted
    events: List[WebhookEvent] = field(default_factory=list)
    is_active: bool = True
    registered_at: datetime = field(default_factory=datetime.utcnow)
    last_delivery: Optional[datetime] = None
    delivery_count: int = 0
    failure_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConnectorHealthMetric:
    """Health metric snapshot for a connector integration."""
    metric_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    integration_id: str = ""
    connector_id: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    health: IntegrationHealth = IntegrationHealth.UNKNOWN
    latency_ms: Optional[float] = None
    success_rate: float = 0.0
    error_rate: float = 0.0
    api_calls_last_hour: int = 0
    rate_limit_remaining: Optional[int] = None
    last_successful_sync: Optional[datetime] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MarketplaceEntry:
    """Entry in the Connector Marketplace."""
    manifest: ConnectorManifest
    install_count: int = 0
    rating: float = 0.0
    review_count: int = 0
    featured: bool = False
    published_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    changelog: str = ""
    screenshots: List[str] = field(default_factory=list)
    reviews: List[Dict[str, Any]] = field(default_factory=list)
