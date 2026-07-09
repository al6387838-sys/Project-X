"""
Evolution Engine — PROJECT-X SPRINT 011
=======================================
Motor de aprendizado contínuo e adaptação do LifeOS.
Responsável por evoluir o sistema conforme conhece o usuário.
"""

from .models import EvolutionSnapshot, LearningEvent, UserTimeline
from .engines import EvolutionEngine, LearningLoop, BehaviorAnalyzer, ConfidenceEngine, AdaptationEngine

__version__ = "1.0.0"
__sprint__ = "011"

__all__ = [
    "EvolutionSnapshot",
    "LearningEvent",
    "UserTimeline",
    "EvolutionEngine",
    "LearningLoop",
    "BehaviorAnalyzer",
    "ConfidenceEngine",
    "AdaptationEngine"
]
