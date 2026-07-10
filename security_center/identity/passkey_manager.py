"""
Passkey Manager (FIDO2/WebAuthn)
================================
Handles registration and authentication using Passkeys.
Ensures phishing-resistant authentication for LifeOS.
"""

import uuid
import json
import base64
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

class PasskeyManager:
    """
    Manages FIDO2/WebAuthn credentials for users.
    """

    def __init__(self):
        # In a real system, this would be a persistent DB
        self.credentials: Dict[str, List[Dict[str, Any]]] = {}

    def register_passkey(self, user_id: str, device_name: str) -> Dict[str, Any]:
        """
        Simulates the registration of a new Passkey.
        """
        credential_id = base64.b64encode(uuid.uuid4().bytes).decode('utf-8')
        public_key = "PUB_KEY_" + str(uuid.uuid4()) # Simulation
        
        credential = {
            "credential_id": credential_id,
            "device_name": device_name,
            "public_key": public_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "sign_count": 0
        }

        if user_id not in self.credentials:
            self.credentials[user_id] = []
        
        self.credentials[user_id].append(credential)
        return credential

    def authenticate(self, user_id: str, credential_id: str) -> bool:
        """
        Simulates authentication with a Passkey.
        """
        if user_id not in self.credentials:
            return False
        
        for cred in self.credentials[user_id]:
            if cred["credential_id"] == credential_id:
                cred["last_used"] = datetime.now(timezone.utc).isoformat()
                cred["sign_count"] += 1
                return True
        
        return False

    def get_user_passkeys(self, user_id: str) -> List[Dict[str, Any]]:
        """Returns all passkeys registered for a user."""
        return self.credentials.get(user_id, [])
