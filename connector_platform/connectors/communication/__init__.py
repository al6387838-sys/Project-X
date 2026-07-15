"""Canonical communication connector bundle and unified platform exports."""

from connector_platform.connectors.communication.communication_hub import (
    CommunicationIdentity,
    CommunicationPlatform,
    UnifiedEvent,
    UnifiedMessage,
)
from connector_platform.connectors.google.google_connectors import (
    GmailConnector,
    GoogleCalendarConnector,
    GoogleMeetConnector,
)
from connector_platform.connectors.microsoft.microsoft_connectors import (
    MicrosoftOutlookConnector,
    MicrosoftTeamsConnector,
)
from connector_platform.connectors.productivity.productivity_connectors import (
    DiscordConnector,
    SlackConnector,
    ZoomConnector,
)

COMMUNICATION_CONNECTORS = [
    GmailConnector,
    GoogleCalendarConnector,
    GoogleMeetConnector,
    MicrosoftOutlookConnector,
    MicrosoftTeamsConnector,
    SlackConnector,
    DiscordConnector,
    ZoomConnector,
]

__all__ = [
    "CommunicationIdentity",
    "CommunicationPlatform",
    "UnifiedEvent",
    "UnifiedMessage",
    "GmailConnector",
    "GoogleCalendarConnector",
    "GoogleMeetConnector",
    "MicrosoftOutlookConnector",
    "MicrosoftTeamsConnector",
    "SlackConnector",
    "DiscordConnector",
    "ZoomConnector",
    "COMMUNICATION_CONNECTORS",
]
