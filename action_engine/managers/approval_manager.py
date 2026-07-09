"""
Approval Manager
================
Gerencia o fluxo de aprovação humana para ações críticas.
Garante que nenhuma ação perigosa seja executada sem consentimento.
"""

from typing import List, Dict, Any, Optional
from ..models.action import Action

class ApprovalManager:
    """
    Controla o estado de aprovação das ações.
    """

    def __init__(self):
        self.pending_requests: Dict[str, Action] = {}
        self.approval_history: List[Dict[str, Any]] = []

    def request_approval(self, action: Action):
        """Registra uma ação que necessita de aprovação."""
        action.execution_status = "pending"
        self.pending_requests[action.action_id] = action

    def approve(self, action_id: str, user_id: str = "default_user") -> Optional[Action]:
        """Aprova uma ação para execução."""
        if action_id in self.pending_requests:
            action = self.pending_requests.pop(action_id)
            action.execution_status = "approved"
            self.approval_history.append({
                "action_id": action_id,
                "status": "approved",
                "user": user_id,
                "timestamp": action.timestamp
            })
            return action
        return None

    def reject(self, action_id: str, reason: str, user_id: str = "default_user") -> Optional[Action]:
        """Rejeita uma ação, impedindo sua execução."""
        if action_id in self.pending_requests:
            action = self.pending_requests.pop(action_id)
            action.execution_status = "rejected"
            action.metadata["rejection_reason"] = reason
            self.approval_history.append({
                "action_id": action_id,
                "status": "rejected",
                "user": user_id,
                "reason": reason,
                "timestamp": action.timestamp
            })
            return action
        return None

    def get_pending_summary(self) -> List[Dict[str, Any]]:
        """Retorna uma lista legível de ações aguardando aprovação."""
        return [
            {
                "id": a.action_id,
                "objective": a.objective,
                "justification": a.justification,
                "priority": a.priority
            }
            for a in self.pending_requests.values()
        ]
