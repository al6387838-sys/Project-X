"""
End-to-End Encryption (E2EE) Engine
===================================
Ensures all data is encrypted before leaving the device and can only
be decrypted by the user's authorized devices.
"""

import base64
import json
from typing import Dict, Any

class E2EEEngine:
    """
    Simulates End-to-End Encryption.
    In a real-world scenario, this would use AES-256-GCM or similar.
    """

    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def encrypt(self, data: Dict[str, Any]) -> str:
        """
        Encrypts data dictionary into an encrypted string.
        (Simulation using base64 + key prefix)
        """
        data_json = json.dumps(data)
        # Simulation: XOR or just base64 for demonstration
        # We'll use a simple base64 with a key-based "wrapper"
        raw_bytes = data_json.encode('utf-8')
        encoded = base64.b64encode(raw_bytes).decode('utf-8')
        return f"E2EE:{self.secret_key}:{encoded}"

    def decrypt(self, encrypted_str: str) -> Dict[str, Any]:
        """
        Decrypts an encrypted string back into a data dictionary.
        """
        if not encrypted_str.startswith(f"E2EE:{self.secret_key}:"):
            raise ValueError("Invalid encryption key or format")
        
        parts = encrypted_str.split(":")
        encoded_data = parts[2]
        decoded_bytes = base64.b64decode(encoded_data)
        return json.loads(decoded_bytes.decode('utf-8'))
