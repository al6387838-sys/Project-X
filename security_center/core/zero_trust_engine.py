"""
Zero Trust Engine
=================
The core of the Zero Trust Architecture.
Implements the "Never Trust, Always Verify" principle.
"""

from enum import Enum
from datetime import datetime
from typing import Dict, Any, Optional, List

class TrustLevel(Enum):
    NONE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    VERIFIED = 4

class ZeroTrustEngine:
    """
    Evaluates trust for every access request based on multiple factors.
    """

    def __init__(self):
        self.trust_scores: Dict[str, float] = {} # user_id -> score (0-100)

    def evaluate_request(self, 
                         user_id: str, 
                         device_id: str, 
                         location: str, 
                         context: Dict[str, Any]) -> TrustLevel:
        """
        Evaluates the trust level of an incoming request.
        Factors: Identity, Device, Location, Behavior.
        """
        score = 100.0
        
        # 1. Identity Trust (Assuming authenticated for now)
        # 2. Device Trust (Check if known device)
        if context.get("is_trusted_device") is False:
            score -= 40.0
            
        # 3. Location Trust (Check for anomalous location)
        if context.get("is_unusual_location") is True:
            score -= 30.0
            
        # 4. Behavioral Trust
        if context.get("is_anomalous_behavior") is True:
            score -= 50.0

        # Determine Trust Level
        if score >= 90: return TrustLevel.VERIFIED
        if score >= 70: return TrustLevel.HIGH
        if score >= 50: return TrustLevel.MEDIUM
        if score >= 30: return TrustLevel.LOW
        return TrustLevel.NONE

    def get_trust_score(self, user_id: str) -> float:
        """Returns the current trust score for a user."""
        return self.trust_scores.get(user_id, 100.0)
