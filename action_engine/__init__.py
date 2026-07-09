"""
Action Engine — PROJECT-X SPRINT 005
====================================
Motor de execução inteligente e seguro do PROJECT-X.
Transforma decisões aprovadas em ações executáveis.
"""

from .models import Action, ActionGroup
from .engines import ActionEngine, ActionPlanner, ExecutionManager, AutomationEngine
from .managers import ApprovalManager, RollbackManager

__version__ = "1.0.0"
__sprint__ = "005"

__all__ = [
    "Action",
    "ActionGroup",
    "ActionEngine",
    "ActionPlanner",
    "ExecutionManager",
    "AutomationEngine",
    "ApprovalManager",
    "RollbackManager"
]
