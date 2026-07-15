"""
LIFEOS Enterprise Action Engine
===============================
Motor governado de ações, automações, gatilhos e workflows.
"""

from .models import Action, ActionGroup
from .engines import (
    ActionEngine,
    ActionPlanner,
    AutomationEngine,
    AutomationRule,
    ExecutionManager,
    WorkflowDefinition,
    WorkflowRun,
    WorkflowStep,
)
from .managers import ApprovalManager, RollbackManager

__version__ = "2.0.0"
__sprint__ = "064"

__all__ = [
    "Action",
    "ActionGroup",
    "ActionEngine",
    "ActionPlanner",
    "ExecutionManager",
    "AutomationEngine",
    "AutomationRule",
    "WorkflowDefinition",
    "WorkflowRun",
    "WorkflowStep",
    "ApprovalManager",
    "RollbackManager",
]
