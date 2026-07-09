"""
Execution Manager
=================
Gerencia a fila de execução, despacha ações e monitora seu status.
Mantém o histórico de ações concluídas e pendentes.
"""

from typing import List, Dict, Any, Optional
import time
from ..models.action import Action
from ..models.action_group import ActionGroup

class ExecutionManager:
    """
    Gerencia o ciclo de vida da execução de ações.
    """

    def __init__(self):
        self.action_queue: List[Action] = []
        self.completed_actions: List[Action] = []
        self.failed_actions: List[Action] = []
        self.pending_approval: List[Action] = []

    def enqueue_action(self, action: Action):
        """Adiciona uma ação à fila correta."""
        if action.approval_required and action.execution_status == "pending":
            self.pending_approval.append(action)
        else:
            action.execution_status = "scheduled"
            self.action_queue.append(action)
            # Ordenar fila por prioridade
            self.action_queue.sort(key=lambda a: a.priority, reverse=True)

    def execute_next(self) -> Optional[Action]:
        """Executa a próxima ação na fila."""
        if not self.action_queue:
            return None

        action = self.action_queue.pop(0)
        action.execution_status = "executing"
        
        try:
            # Simulação de execução
            # No futuro, aqui haverá integração com os conectores (Email, IoT, etc)
            time.sleep(0.1) 
            
            action.execution_status = "completed"
            self.completed_actions.append(action)
            return action
        except Exception as e:
            action.execution_status = "failed"
            action.metadata["error"] = str(e)
            self.failed_actions.append(action)
            return action

    def cancel_action(self, action_id: str) -> bool:
        """Cancela uma ação em qualquer fila."""
        for queue in [self.action_queue, self.pending_approval]:
            for i, action in enumerate(queue):
                if action.action_id == action_id:
                    action.execution_status = "cancelled"
                    queue.pop(i)
                    return True
        return False

    def get_status_summary(self) -> Dict[str, int]:
        """Retorna um resumo do status das filas."""
        return {
            "queued": len(self.action_queue),
            "pending_approval": len(self.pending_approval),
            "completed": len(self.completed_actions),
            "failed": len(self.failed_actions)
        }
