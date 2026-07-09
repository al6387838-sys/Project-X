"""
Audit Manager
=============
Provides comprehensive auditing for all system activities.
Specifically tracks every access to the Life Graph.
"""

import json
from datetime import datetime
from typing import List, Dict, Any

class AuditManager:
    """
    Logs and retrieves audit trails for security and compliance.
    """

    def __init__(self):
        self.logs: List[Dict[str, Any]] = []

    def log_access(self, 
                   user_id: str, 
                   resource_id: str, 
                   action: str, 
                   status: str, 
                   metadata: Dict[str, Any]):
        """Logs an access attempt to a resource."""
        entry = {
            "audit_id": f"AUD-{datetime.utcnow().timestamp()}",
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "resource_id": resource_id,
            "action": action,
            "status": status,
            "device_id": metadata.get("device_id"),
            "ip_address": metadata.get("ip_address"),
            "context": metadata.get("context", {})
        }
        self.logs.append(entry)
        return entry

    def get_resource_audit_trail(self, resource_id: str) -> List[Dict[str, Any]]:
        """Returns the audit trail for a specific resource (e.g., a Life Graph node)."""
        return [log for log in self.logs if log["resource_id"] == resource_id]

    def get_user_security_timeline(self, user_id: str) -> List[Dict[str, Any]]:
        """Returns a timeline of security-related events for a user."""
        return [log for log in self.logs if log["user_id"] == user_id]
