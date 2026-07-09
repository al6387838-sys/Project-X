"""
Life Orchestrator — PROJECT-X SPRINT 013
========================================
Coordena todos os motores do LifeOS como um único organismo inteligente.
Gerencia missões, prioridades e dependências para alcançar objetivos do usuário.
"""

from .models import Mission, MissionStep, OrchestrationEvent
from .engines import MissionEngine, DependencyEngine, PriorityEngine, OrchestratorRuntime

__version__ = "1.0.0"
__sprint__ = "013"

__all__ = [
    "Mission",
    "MissionStep",
    "OrchestrationEvent",
    "MissionEngine",
    "DependencyEngine",
    "PriorityEngine",
    "OrchestratorRuntime"
]
