"""
Decision Engine — PROJECT-X SPRINT 004
=======================================
Motor de decisão inteligente e explicável do PROJECT-X.
Transforma contexto e memória em decisões estruturadas.
"""

from .models import Decision, ContextInput, Conflict
from .engines import (
    DecisionEngine,
    PriorityEngine,
    ReasoningEngine,
    PredictionEngine,
    Prediction,
    RecommendationEngine,
    Recommendation,
)
from .resolvers import ConflictResolver

__version__ = "1.0.0"
__sprint__ = "004"

__all__ = [
    "Decision",
    "ContextInput",
    "Conflict",
    "DecisionEngine",
    "PriorityEngine",
    "ReasoningEngine",
    "PredictionEngine",
    "Prediction",
    "RecommendationEngine",
    "Recommendation",
    "ConflictResolver",
]
