from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from ..models.trust import DecisionRecord, ConfidenceLevel

class DecisionHistory:
    def __init__(self):
        self._records: Dict[str, DecisionRecord] = {}
        self._user_records: Dict[str, List[str]] = {}

    def record_decision(
        self,
        user_id: str,
        engine_responsible: str,
        data_used: Dict[str, Any],
        confidence_level: ConfidenceLevel,
        explanation: str,
        alternatives_considered: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> DecisionRecord:
        decision_id = str(uuid.uuid4())
        timestamp = datetime.now()
        record = DecisionRecord(
            decision_id=decision_id,
            timestamp=timestamp,
            engine_responsible=engine_responsible,
            data_used=data_used,
            confidence_level=confidence_level,
            explanation=explanation,
            alternatives_considered=alternatives_considered,
            user_id=user_id,
            metadata=metadata
        )
        self._records[decision_id] = record
        if user_id not in self._user_records:
            self._user_records[user_id] = []
        self._user_records[user_id].append(decision_id)
        return record

    def get_decision_by_id(self, decision_id: str) -> Optional[DecisionRecord]:
        return self._records.get(decision_id)

    def get_decisions_for_user(self, user_id: str, limit: Optional[int] = None) -> List[DecisionRecord]:
        decision_ids = self._user_records.get(user_id, [])
        records = [self._records[did] for did in decision_ids]
        return sorted(records, key=lambda x: x.timestamp, reverse=True)[:limit]

    def get_all_decisions(self, limit: Optional[int] = None) -> List[DecisionRecord]:
        records = list(self._records.values())
        return sorted(records, key=lambda x: x.timestamp, reverse=True)[:limit]
