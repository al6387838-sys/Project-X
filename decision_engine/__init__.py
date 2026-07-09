"""
Decision Engine V1 — PROJECT-X SPRINT 021
==========================================
Motor de decisão inteligente e explicável do LifeOS.
Transforma contexto em decisões estruturadas com scoring, histórico e aprendizagem.
"""
from .models import Decision, ContextInput, Conflict
from .models.decision import Alternative, DecisionCategory
from .engines import (
    DecisionEngine,
    DecisionEngineCore,
    DecisionHistory,
    DecisionScore,
    PriorityEngine,
    ReasoningEngine,
    PredictionEngine,
    Prediction,
    RecommendationEngine,
    Recommendation,
)
from .resolvers import ConflictResolver

__version__ = "1.0.0"
__sprint__ = "021"

__all__ = [
    "Decision",
    "Alternative",
    "DecisionCategory",
    "ContextInput",
    "Conflict",
    "DecisionEngine",
    "DecisionEngineCore",
    "DecisionHistory",
    "DecisionScore",
    "PriorityEngine",
    "ReasoningEngine",
    "PredictionEngine",
    "Prediction",
    "RecommendationEngine",
    "Recommendation",
    "ConflictResolver",
]
