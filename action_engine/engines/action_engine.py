"""
Action Engine
=============
Coordenador de decisões, automações, workflows e ações integradas do LIFEOS.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from ..models.action import Action
from ..models.action_group import ActionGroup
from .action_planner import ActionPlanner
from .automation_engine import AutomationEngine, WorkflowDefinition, WorkflowStep
from .execution_manager import ExecutionManager


class ActionEngine:
    """Fachada canônica para transformar decisões e eventos em ações governadas."""

    def __init__(self):
        self.planner = ActionPlanner()
        self.executor = ExecutionManager()
        self.automation = AutomationEngine(self.planner)
        self.history: List[Action] = []
        self._integration_sdk: Any = None

    def process_decisions(self, decisions: List[Dict[str, Any]]) -> List[Action]:
        """Planeja decisões e encaminha cada ação à fila ou aprovação humana."""
        all_actions: List[Action] = []
        for decision in decisions:
            actions = self.planner.plan_from_decision(decision)
            self._enqueue(actions)
            all_actions.extend(actions)
        return all_actions

    def process_event(
        self,
        event_type: str,
        payload: Dict[str, Any],
        *,
        event_id: Optional[str] = None,
    ) -> List[Action]:
        """Converte eventos de módulos, conectores, webhooks e sincronização em ações."""
        actions = self.automation.emit(event_type, payload, event_id=event_id)
        self._enqueue(actions)
        return actions

    def register_workflow(
        self,
        workflow_id: str,
        steps: List[WorkflowStep | Dict[str, Any]],
        *,
        name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> WorkflowDefinition:
        return self.automation.add_workflow(
            workflow_id,
            steps,
            name=name,
            metadata=metadata,
        )

    def launch_workflow(
        self,
        workflow_id: str,
        context: Optional[Dict[str, Any]] = None,
        *,
        run_id: Optional[str] = None,
    ) -> List[Action]:
        actions = self.automation.start_workflow(workflow_id, context, run_id=run_id)
        self._enqueue(actions)
        return actions

    def register_action_handler(
        self,
        action_type: str,
        handler: Callable[[Action], Any],
        *,
        replace: bool = False,
    ) -> None:
        """Registra uma ação inteligente ou interna sem acoplar o workflow ao módulo."""
        self.executor.register_handler(action_type, handler, replace=replace)

    def register_module_action(
        self,
        module_name: str,
        action_name: str,
        handler: Callable[[Action], Any],
        *,
        replace: bool = False,
    ) -> str:
        """Expõe uma ação de módulo sob um namespace estável."""
        action_type = f"module.{module_name}.{action_name}"
        self.register_action_handler(action_type, handler, replace=replace)
        return action_type

    def bind_integration_sdk(self, sdk: Any) -> None:
        """Conecta operações e extensões ao framework oficial da Phase 061."""
        self._integration_sdk = sdk

        def execute_connector(action: Action) -> Any:
            parameters = dict(action.parameters)
            return sdk.execute(
                parameters.pop("user_id"),
                parameters.pop("connector_id"),
                parameters.pop("operation"),
                parameters.pop("payload", parameters),
                required_scope=parameters.pop("required_scope", "read"),
            )

        def invoke_extension(action: Action) -> Any:
            parameters = dict(action.parameters)
            extension = parameters.pop("extension")
            payload = parameters.pop("payload", parameters)
            return sdk.invoke_extension(extension, **payload)

        def synchronize(action: Action) -> Any:
            parameters = dict(action.parameters)
            return sdk.sync(
                parameters.pop("user_id"),
                parameters.pop("connector_id"),
                resource_types=parameters.pop("resource_types", None),
                priority=parameters.pop("priority", 5),
                force_full=parameters.pop("force_full", False),
            )

        self.register_action_handler("integration.execute", execute_connector, replace=True)
        self.register_action_handler("integration.extension", invoke_extension, replace=True)
        self.register_action_handler("integration.sync", synchronize, replace=True)

    def approve_action(self, action_id: str) -> Optional[Action]:
        return self.executor.approve_action(action_id)

    def reject_action(self, action_id: str, reason: str) -> Optional[Action]:
        return self.executor.reject_action(action_id, reason)

    def run_cycle(self, *, max_actions: Optional[int] = None) -> List[Action]:
        """Executa a fila por prioridade, respeitando um limite opcional por ciclo."""
        executed: List[Action] = []
        while self.executor.action_queue and (max_actions is None or len(executed) < max_actions):
            action = self.executor.execute_next()
            if action is None:
                break
            executed.append(action)
            self.history.append(action)
        return executed

    def get_pending_actions(self) -> List[Action]:
        return list(self.executor.pending_approval)

    def get_history(self) -> List[Action]:
        return list(self.history)

    def get_status(self) -> Dict[str, Any]:
        return {
            "execution": self.executor.get_status_summary(),
            "automation": self.automation.get_status(),
            "history": len(self.history),
            "integration_sdk_bound": self._integration_sdk is not None,
        }

    def _enqueue(self, actions: List[Action]) -> None:
        for action in self.planner.sequence_actions(actions):
            self.executor.enqueue_action(action)
