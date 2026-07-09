from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class ConfidenceLevel(Enum):
    VERY_HIGH = "Muito Alto"
    HIGH = "Alto"
    MEDIUM = "Médio"
    LOW = "Baixo"

class DecisionRecord:
    def __init__(
        self,
        decision_id: str,
        timestamp: datetime,
        engine_responsible: str,
        data_used: Dict[str, Any],
        confidence_level: ConfidenceLevel,
        explanation: str,
        alternatives_considered: List[Dict[str, Any]],
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.decision_id = decision_id
        self.timestamp = timestamp
        self.engine_responsible = engine_responsible
        self.data_used = data_used
        self.confidence_level = confidence_level
        self.explanation = explanation
        self.alternatives_considered = alternatives_considered
        self.user_id = user_id
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision_id": self.decision_id,
            "timestamp": self.timestamp.isoformat(),
            "engine_responsible": self.engine_responsible,
            "data_used": self.data_used,
            "confidence_level": self.confidence_level.value,
            "explanation": self.explanation,
            "alternatives_considered": self.alternatives_considered,
            "user_id": self.user_id,
            "metadata": self.metadata
        }

class TrustTimelineEntry:
    def __init__(self, timestamp: datetime, event_type: str, description: str, score_change: float, current_trust_score: float):
        self.timestamp = timestamp
        self.event_type = event_type
        self.description = description
        self.score_change = score_change
        self.current_trust_score = current_trust_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type,
            "description": self.description,
            "score_change": self.score_change,
            "current_trust_score": self.current_trust_score
        }
