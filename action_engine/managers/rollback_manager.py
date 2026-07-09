"""
Rollback Manager
================
Responsável por reverter ações que falharam ou que precisam ser desfeitas.
Gerencia estratégias de recuperação de estado.
"""

from typing import List, Dict, Any, Optional
from ..models.action import Action

class RollbackManager:
    """
    Gerencia a reversão de ações executadas.
    """

    def __init__(self):
        self.rollback_log: List[Dict[str, Any]] = []

    def can_rollback(self, action: Action) -> bool:
        """Verifica se uma ação possui estratégia de rollback."""
        return action.rollback_strategy != "none" and action.execution_status == "completed"

    def perform_rollback(self, action: Action) -> bool:
        """
        Executa a reversão de uma ação.
        """
        if not self.can_rollback(action):
            return False

        try:
            # Simulação de reversão
            # No futuro, chamará o método 'undo' do conector correspondente
            action.execution_status = "rolled_back"
            self.rollback_log.append({
                "action_id": action.action_id,
                "status": "success",
                "strategy": action.rollback_strategy
            })
            return True
        except Exception as e:
            self.rollback_log.append({
                "action_id": action.action_id,
                "status": "failed",
                "error": str(e)
            })
            return False

    def get_rollback_history(self) -> List[Dict[str, Any]]:
        return self.rollback_log
