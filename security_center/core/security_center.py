"""
Security Center
===============
The central dashboard for LifeOS security.
Calculates the Security Score and provides a unified view of the system's security posture.
"""

from typing import Dict, Any, List
from .zero_trust_engine import ZeroTrustEngine
from ..identity.passkey_manager import PasskeyManager
from ..identity.device_trust import DeviceTrustManager

class SecurityCenter:
    """
    Orchestrates all security components and calculates the Security Score.
    """

    def __init__(self):
        self.zta = ZeroTrustEngine()
        self.passkeys = PasskeyManager()
        self.devices = DeviceTrustManager()

    def calculate_security_score(self, user_id: str) -> float:
        """
        Calculates a score from 0 to 100 based on security best practices.
        """
        score = 0.0
        
        # 1. Identity Score (40%)
        passkeys = self.passkeys.get_user_passkeys(user_id)
        if passkeys:
            score += 40.0 # Using Passkeys is a major security boost
        
        # 2. Device Score (30%)
        trusted_devices = self.devices.trusted_devices.get(user_id, [])
        if trusted_devices:
            score += 30.0
            
        # 3. Trust Score (30%)
        trust_score = self.zta.get_trust_score(user_id)
        score += (trust_score * 0.3)
        
        return min(score, 100.0)

    def get_security_status(self, user_id: str) -> Dict[str, Any]:
        """Returns a comprehensive security status report."""
        return {
            "user_id": user_id,
            "security_score": self.calculate_security_score(user_id),
            "passkeys_count": len(self.passkeys.get_user_passkeys(user_id)),
            "trusted_devices_count": len(self.devices.trusted_devices.get(user_id, [])),
            "current_trust_level": self.zta.get_trust_score(user_id)
        }
