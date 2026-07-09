"""
Threat Monitor
==============
Monitors for suspicious activities and anomalies.
Implements automatic detection of login attempts, location changes, and behavioral shifts.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

class ThreatMonitor:
    """
    Analyzes security events to detect potential threats.
    """

    def __init__(self):
        self.alerts: List[Dict[str, Any]] = []
        self.last_locations: Dict[str, str] = {} # user_id -> last_location

    def analyze_event(self, event_type: str, user_id: str, metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Analyzes an event for threats."""
        alert = None
        
        if event_type == "login":
            location = metadata.get("location")
            device_id = metadata.get("device_id")
            
            # 1. Detect Location Change
            if user_id in self.last_locations and self.last_locations[user_id] != location:
                alert = self._create_alert(
                    user_id, "SUSPICIOUS_LOCATION", 
                    f"Login from new location: {location}", "MEDIUM"
                )
            self.last_locations[user_id] = location

            # 2. Detect Brute Force (Simulated)
            if metadata.get("failed_attempts", 0) > 3:
                alert = self._create_alert(
                    user_id, "BRUTE_FORCE_ATTEMPT", 
                    "Multiple failed login attempts detected", "HIGH"
                )

        if alert:
            self.alerts.append(alert)
        return alert

    def _create_alert(self, user_id: str, type: str, message: str, severity: str) -> Dict[str, Any]:
        return {
            "alert_id": f"ALRT-{datetime.utcnow().timestamp()}",
            "user_id": user_id,
            "type": type,
            "message": message,
            "severity": severity,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "ACTIVE"
        }

    def get_active_alerts(self, user_id: str) -> List[Dict[str, Any]]:
        """Returns active alerts for a user."""
        return [a for a in self.alerts if a["user_id"] == user_id and a["status"] == "ACTIVE"]
