from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .decision_history import DecisionHistory
from ..models.trust import DecisionRecord, ConfidenceLevel

class AuditEngine:
    def __init__(self, decision_history: DecisionHistory):
        self.decision_history = decision_history

    def get_audit_trail_for_user(self, user_id: str, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        records = self.decision_history.get_decisions_for_user(user_id)
        audit_trail = []
        for record in records:
            if (start_date is None or record.timestamp >= start_date) and \
               (end_date is None or record.timestamp <= end_date):
                audit_trail.append(record.to_dict())
        return audit_trail

    def get_decision_summary(self, user_id: str, period_days: int = 30) -> Dict[str, Any]:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_days)
        
        records = self.decision_history.get_decisions_for_user(user_id)
        
        total_decisions = 0
        decisions_by_engine: Dict[str, int] = {}
        confidence_distribution: Dict[str, int] = {level.value: 0 for level in ConfidenceLevel}
        
        for record in records:
            if record.timestamp >= start_date and record.timestamp <= end_date:
                total_decisions += 1
                decisions_by_engine[record.engine_responsible] = decisions_by_engine.get(record.engine_responsible, 0) + 1
                confidence_distribution[record.confidence_level.value] = confidence_distribution.get(record.confidence_level.value, 0) + 1
                
        return {
            "user_id": user_id,
            "period_days": period_days,
            "total_decisions": total_decisions,
            "decisions_by_engine": decisions_by_engine,
            "confidence_distribution": confidence_distribution,
            "most_recent_decision": records[0].to_dict() if records else None
        }

    def get_decision_timeline(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        records = self.decision_history.get_decisions_for_user(user_id, limit=limit)
        return [record.to_dict() for record in records]
