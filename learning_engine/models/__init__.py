"""Modelos de dados do Learning Engine."""
from .learning_event import LearningEvent, EventType, FeedbackType
from .preference import Preference, PreferenceCategory, PreferenceHistory
from .pattern import Pattern, PatternType, PatternStrength
from .learning_profile import LearningProfile, LearningScore
from .model_version import ModelVersion, LearningLog, RollbackRecord

__all__ = [
    "LearningEvent", "EventType", "FeedbackType",
    "Preference", "PreferenceCategory", "PreferenceHistory",
    "Pattern", "PatternType", "PatternStrength",
    "LearningProfile", "LearningScore",
    "ModelVersion", "LearningLog", "RollbackRecord",
]
