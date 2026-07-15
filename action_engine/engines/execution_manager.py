"""
Execution Manager
=================
Gerencia filas, aprovações e despacho governado de ações internas e integradas.
"""

from __future__ import annotations

import asyncio
import inspect
import time
from typing import Any, Callable, Dict, List, Optional

from ..models.action import Action


ActionHandler = Callable[[Action], Any]


class ExecutionManager:
    """Executa ações canônicas por handlers explícitos e mantém auditoria do ciclo de vida."""

    def __init__(self):
        self.action_queue: List[Action] = []
        self.completed_actions: List[Action] = []
        self.failed_actions: List[Action] = []
        self.pending_approval: List[Action] = []
        self.cancelled_actions: List[Action] = []
        self.handlers: Dict[str, ActionHandler] = {}
        self.execution_log: List[Dict[str, Any]] = []
        self._idempotent_results: Dict[str, Any] = {}

    def register_handler(self, action_type: str, handler: ActionHandler, *, replace: bool = False) -> None:
        if not action_type or not callable(handler):
            raise ValueError("action_type and callable handler are required")
        if action_type in self.handlers and not replace:
            raise ValueError(f"Handler already registered: {action_type}")
        self.handlers[action_type] = handler

    def unregister_handler(self, action_type: str) -> bool:
        return self.handlers.pop(action_type, None) is not None

    def enqueue_action(self, action: Action) -> None:
        """Adiciona uma ação à fila correta e evita o mesmo objeto duas vezes."""
        if self._contains(action.action_id):
            return
        if action.approval_required and action.execution_status not in ("approved", "scheduled"):
            action.execution_status = "pending"
            self.pending_approval.append(action)
        else:
            action.execution_status = "scheduled"
            self.action_queue.append(action)
            self.action_queue.sort(key=lambda item: item.priority, reverse=True)
        self._record(action, "enqueued")

    def approve_action(self, action_id: str) -> Optional[Action]:
        """Move uma ação da revisão humana para a fila executável."""
        for index, action in enumerate(self.pending_approval):
            if action.action_id == action_id:
                self.pending_approval.pop(index)
                action.execution_status = "approved"
                self.enqueue_action(action)
                self._record(action, "approved")
                return action
        return None

    def reject_action(self, action_id: str, reason: str) -> Optional[Action]:
        for index, action in enumerate(self.pending_approval):
            if action.action_id == action_id:
                self.pending_approval.pop(index)
                action.execution_status = "rejected"
                action.metadata["rejection_reason"] = reason
                self.cancelled_actions.append(action)
                self._record(action, "rejected", {"reason": reason})
                return action
        return None

    def execute_next(self) -> Optional[Action]:
        if not self.action_queue:
            return None

        action = self._pop_next_ready()
        if action is None:
            return None
        action.execution_status = "executing"
        self._record(action, "executing")
        idempotency_key = action.metadata.get("idempotency_key")

        try:
            if idempotency_key and idempotency_key in self._idempotent_results:
                result = self._idempotent_results[idempotency_key]
                action.metadata["idempotent_replay"] = True
            else:
                handler = self.handlers.get(action.action_type)
                if handler:
                    result = self._resolve(handler(action))
                else:
                    # Compatibilidade: ações sem handler continuam como no executor legado.
                    time.sleep(0.01)
                    result = {"status": "completed", "mode": "legacy_noop"}
                if idempotency_key:
                    self._idempotent_results[idempotency_key] = result

            action.metadata["result"] = result
            action.execution_status = "completed"
            self.completed_actions.append(action)
            self._record(action, "completed")
            return action
        except Exception as exc:
            action.execution_status = "failed"
            action.metadata["error"] = str(exc)
            self.failed_actions.append(action)
            self._record(action, "failed", {"error": str(exc)})
            return action

    def cancel_action(self, action_id: str) -> bool:
        for queue in (self.action_queue, self.pending_approval):
            for index, action in enumerate(queue):
                if action.action_id == action_id:
                    action.execution_status = "cancelled"
                    queue.pop(index)
                    self.cancelled_actions.append(action)
                    self._record(action, "cancelled")
                    return True
        return False

    def get_status_summary(self) -> Dict[str, int]:
        return {
            "queued": len(self.action_queue),
            "pending_approval": len(self.pending_approval),
            "completed": len(self.completed_actions),
            "failed": len(self.failed_actions),
            "cancelled": len(self.cancelled_actions),
            "handlers": len(self.handlers),
        }

    def _pop_next_ready(self) -> Optional[Action]:
        completed_ids = {item.action_id for item in self.completed_actions}
        failed_ids = {item.action_id for item in self.failed_actions}
        stopped_ids = {item.action_id for item in self.cancelled_actions}
        queued_ids = {item.action_id for item in self.action_queue}

        for index, candidate in enumerate(list(self.action_queue)):
            dependencies = set(candidate.metadata.get("depends_on_action_ids", []))
            if not dependencies or dependencies <= completed_ids:
                return self.action_queue.pop(index)
            failed_dependencies = dependencies & (failed_ids | stopped_ids)
            if failed_dependencies and candidate.metadata.get("on_failure", "stop") == "continue":
                return self.action_queue.pop(index)
            if failed_dependencies:
                self.action_queue.pop(index)
                candidate.execution_status = "cancelled"
                candidate.metadata["blocked_by"] = sorted(failed_dependencies)
                self.cancelled_actions.append(candidate)
                self._record(candidate, "dependency_failed", {"dependencies": sorted(failed_dependencies)})
                return self._pop_next_ready()
            missing = dependencies - completed_ids - failed_ids - stopped_ids - queued_ids
            if missing:
                self.action_queue.pop(index)
                candidate.execution_status = "failed"
                candidate.metadata["error"] = f"Missing workflow dependencies: {sorted(missing)}"
                self.failed_actions.append(candidate)
                self._record(candidate, "dependency_missing", {"dependencies": sorted(missing)})
                return self._pop_next_ready()
        return None

    def _contains(self, action_id: str) -> bool:
        return any(
            item.action_id == action_id
            for queue in (
                self.action_queue,
                self.pending_approval,
                self.completed_actions,
                self.failed_actions,
                self.cancelled_actions,
            )
            for item in queue
        )

    def _record(self, action: Action, event: str, details: Optional[Dict[str, Any]] = None) -> None:
        self.execution_log.append(
            {
                "action_id": action.action_id,
                "action_type": action.action_type,
                "event": event,
                "timestamp": time.time(),
                "details": dict(details or {}),
            }
        )

    @staticmethod
    def _resolve(value: Any) -> Any:
        if not inspect.isawaitable(value):
            return value
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(value)
        raise RuntimeError("Async action execution requires a synchronous worker context")
