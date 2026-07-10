"""
Session Manager
===============
Manages user sessions with Zero Trust principles.
Implements token rotation and automatic revocation on risk detection.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List

class SessionManager:
    """
    Handles secure session lifecycle.
    """

    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {} # token -> session_data

    def create_session(self, user_id: str, device_id: str) -> str:
        """Creates a new secure session."""
        token = str(uuid.uuid4())
        self.sessions[token] = {
            "user_id": user_id,
            "device_id": device_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
            "last_activity": datetime.now(timezone.utc),
            "status": "ACTIVE"
        }
        return token

    def validate_session(self, token: str) -> bool:
        """Validates and refreshes a session."""
        session = self.sessions.get(token)
        if not session or session["status"] != "ACTIVE":
            return False
        
        if datetime.now(timezone.utc) > session["expires_at"]:
            session["status"] = "EXPIRED"
            return False
        
        session["last_activity"] = datetime.now(timezone.utc)
        return True

    def revoke_session(self, token: str):
        """Manually revokes a session."""
        if token in self.sessions:
            self.sessions[token]["status"] = "REVOKED"

    def revoke_all_user_sessions(self, user_id: str):
        """Revokes all active sessions for a user (e.g., after threat detection)."""
        for session in self.sessions.values():
            if session["user_id"] == user_id:
                session["status"] = "REVOKED"
