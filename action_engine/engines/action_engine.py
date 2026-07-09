"""
Action Engine
=============
Coordenador principal do SPRINT 005.
Integra Planner, Execution Manager e outros módulos para transformar decisões em resultados.
"""

from typing import List, Dict, Any, Optional
from ..models.action import Action
from ..models.action_group import ActionGroup
from .action_planner import ActionPlanner
from .execution_manager import ExecutionManager

class ActionEngine:
    """
    O cérebro da execução do PROJECT-X.
    """

    def __init__(self):
        self.planner = ActionPlanner()
        self.executor = ExecutionManager()
        self.history: List[Action] = []

    def process_decisions(self, decisions: List[Dict[str, Any]]) -> List[Action]:
        """
        Recebe decisões e as transforma em ações agendadas.
        """
        all_actions = []
        for decision in decisions:
            actions = self.planner.plan_from_decision(decision)
            for action in actions:
                self.executor.enqueue_action(action)
                all_actions.append(action)
        return all_actions

    def run_cycle(self) -> List[Action]:
        """
        Executa um ciclo de processamento da fila de ações.
        """
        executed = []
        while self.executor.action_queue:
            action = self.executor.execute_next()
            if action:
                executed.append(action)
                self.history.append(action)
        return executed

    def get_pending_actions(self) -> List[Action]:
        return self.executor.pending_approval

    def get_history(self) -> List[Action]:
        return self.history
