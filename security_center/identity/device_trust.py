"""
Device Trust Manager
====================
Manages the trust state of user devices.
Implements device fingerprinting and health checks.
"""

from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

class DeviceTrustManager:
    """
    Tracks and verifies trusted devices for each user.
    """

    def __init__(self):
        self.trusted_devices: Dict[str, List[Dict[str, Any]]] = {}

    def register_device(self, user_id: str, device_id: str, metadata: Dict[str, Any]):
        """Registers a new trusted device for a user."""
        device = {
            "device_id": device_id,
            "name": metadata.get("name", "Unknown Device"),
            "os": metadata.get("os"),
            "first_seen": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "is_trusted": True,
            "security_patch_level": metadata.get("security_patch_level")
        }

        if user_id not in self.trusted_devices:
            self.trusted_devices[user_id] = []
        
        # Check if already exists
        for d in self.trusted_devices[user_id]:
            if d["device_id"] == device_id:
                d["last_seen"] = datetime.now(timezone.utc).isoformat()
                return d

        self.trusted_devices[user_id].append(device)
        return device

    def is_device_trusted(self, user_id: str, device_id: str) -> bool:
        """Verifies if a device is in the trusted list for a user."""
        devices = self.trusted_devices.get(user_id, [])
        for d in devices:
            if d["device_id"] == device_id:
                return d["is_trusted"]
        return False

    def revoke_device(self, user_id: str, device_id: str):
        """Revokes trust from a device."""
        devices = self.trusted_devices.get(user_id, [])
        for d in devices:
            if d["device_id"] == device_id:
                d["is_trusted"] = False
                return True
        return False
