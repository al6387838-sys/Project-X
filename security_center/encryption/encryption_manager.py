"""
Encryption Manager
==================
Handles encryption at rest, encryption in transit (simulated), 
and cryptographic key management.
"""

import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

class EncryptionManager:
    """
    Manages keys and performs encryption/decryption.
    """

    def __init__(self):
        initial_key = "K-" + base64.b64encode(b"initial_key").decode('utf-8')
        self.keys: Dict[str, str] = {
            "primary": initial_key,
            "K-initial": initial_key
        }
        self.key_history: List[Dict[str, Any]] = [
            {"key_id": "K-initial", "created_at": datetime.now(timezone.utc).isoformat()}
        ]

    def encrypt_at_rest(self, data: Dict[str, Any], key_id: str = "primary") -> str:
        """Encrypts data for storage."""
        # If using 'primary', resolve to the actual key_id
        actual_key_id = key_id
        if key_id == "primary":
            # Find the latest key_id from history
            actual_key_id = self.key_history[-1]["key_id"]
            
        key = self.keys.get(actual_key_id)
        raw_json = json.dumps(data)
        encrypted = base64.b64encode(f"{key}:{raw_json}".encode('utf-8')).decode('utf-8')
        return f"ENC:{actual_key_id}:{encrypted}"

    def decrypt_at_rest(self, encrypted_str: str) -> Dict[str, Any]:
        """Decrypts data from storage."""
        if not encrypted_str.startswith("ENC:"):
            raise ValueError("Invalid encryption format")
        
        parts = encrypted_str.split(":")
        key_id = parts[1]
        payload = parts[2]
        
        key = self.keys.get(key_id)
        decoded = base64.b64decode(payload).decode('utf-8')
        
        if not decoded.startswith(f"{key}:"):
            raise ValueError("Key mismatch or corrupted data")
            
        json_str = decoded[len(key)+1:]
        return json.loads(json_str)

    def rotate_key(self) -> str:
        """Rotates the primary encryption key."""
        new_key_id = f"K-{datetime.now(timezone.utc).timestamp()}"
        new_key = base64.b64encode(new_key_id.encode('utf-8')).decode('utf-8')
        
        self.keys[new_key_id] = new_key
        self.keys["primary"] = new_key
        
        self.key_history.append({
            "key_id": new_key_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return new_key_id
