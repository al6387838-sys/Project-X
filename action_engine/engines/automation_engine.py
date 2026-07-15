"""
Automation Engine
=================
Motor governado de regras, gatilhos e workflows do LIFEOS Enterprise.
Mantém compatibilidade com o contrato legado e integra ações canônicas.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
import time
from typing import Any, Callable, Dict, Iterable, List, Optional, Set
import uuid

from ..models.action import Action
from .action_planner import ActionPlanner


Condition = Callable[[Dict[str, Any]], bool]
ScoreFunction = Callable[[Dict[str, Any]], float]


@dataclass
class AutomationRule:
    """Regra de automação com governança e controle de recorrência."""

    rule_id: str
    trigger_condition: Condition
    action_template: Dict[str, Any]
    trigger_type: str = "context"
    active: bool = True
    cooldown_seconds: float = 0.0
    max_executions: Optional[int] = None
    executions: int = 0
    last_triggered_at: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def can_trigger(self, context: Dict[str, Any], now: float) -> bool:
        if not self.active:
            return False
        if self.max_executions is not None and self.executions >= self.max_executions:
            return False
        if self.last_triggered_at is not None and now - self.last_triggered_at < self.cooldown_seconds:
            return False
        return bool(self.trigger_condition(context))


@dataclass
class WorkflowStep:
    """Etapa declarativa de workflow; dependências formam um DAG."""

    step_id: str
    action_template: Dict[str, Any]
    depends_on: List[str] = field(default_factory=list)
    condition: Optional[Condition] = None
    on_failure: str = "stop"


@dataclass
class WorkflowDefinition:
    workflow_id: str
    name: str
    steps: List[WorkflowStep]
    active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowRun:
    run_id: str
    workflow_id: str
    status: str
    started_at: float
    action_ids: List[str] = field(default_factory=list)
    skipped_steps: List[str] = field(default_factory=list)
    context_fingerprint: str = ""


class AutomationEngine:
    """Orquestra regras, eventos e workflows sobre o `ActionPlanner` canônico."""

    def __init__(self, planner: ActionPlanner):
        self.planner = planner
        self.rules: List[AutomationRule] = []
        self.workflows: Dict[str, WorkflowDefinition] = {}
        self.workflow_runs: Dict[str, WorkflowRun] = {}
        self.triggered_history: List[str] = []
        self.event_history: List[Dict[str, Any]] = []
        self._processed_event_ids: Set[str] = set()

    def add_rule(
        self,
        rule_id: str,
        condition: Condition,
        template: Dict[str, Any],
        *,
        trigger_type: str = "context",
        cooldown_seconds: float = 0.0,
        max_executions: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AutomationRule:
        """Adiciona uma regra, rejeitando IDs duplicados e limites inválidos."""
        if any(rule.rule_id == rule_id for rule in self.rules):
            raise ValueError(f"Automation rule already exists: {rule_id}")
        if cooldown_seconds < 0:
            raise ValueError("cooldown_seconds cannot be negative")
        if max_executions is not None and max_executions < 1:
            raise ValueError("max_executions must be positive")
        rule = AutomationRule(
            rule_id=rule_id,
            trigger_condition=condition,
            action_template=dict(template),
            trigger_type=trigger_type,
            cooldown_seconds=cooldown_seconds,
            max_executions=max_executions,
            metadata=dict(metadata or {}),
        )
        self.rules.append(rule)
        return rule

    def add_smart_rule(
        self,
        rule_id: str,
        score: ScoreFunction,
        threshold: float,
        template: Dict[str, Any],
        **governance: Any,
    ) -> AutomationRule:
        """Adiciona uma ação inteligente baseada em score explicável e limiar explícito."""
        if not 0 <= threshold <= 1:
            raise ValueError("threshold must be between 0 and 1")

        def condition(context: Dict[str, Any]) -> bool:
            value = float(score(context))
            context.setdefault("_automation_scores", {})[rule_id] = value
            return value >= threshold

        metadata = dict(governance.pop("metadata", {}))
        metadata.update({"smart": True, "threshold": threshold})
        return self.add_rule(rule_id, condition, template, metadata=metadata, **governance)

    def remove_rule(self, rule_id: str) -> bool:
        for index, rule in enumerate(self.rules):
            if rule.rule_id == rule_id:
                self.rules.pop(index)
                return True
        return False

    def check_triggers(
        self,
        context_data: Dict[str, Any],
        trigger_type: str = "context",
        event_id: Optional[str] = None,
    ) -> List[Action]:
        """Avalia regras compatíveis e retorna ações planejadas de forma idempotente."""
        if event_id and event_id in self._processed_event_ids:
            return []

        now = time.time()
        context = dict(context_data)
        triggered_actions: List[Action] = []
        errors: List[Dict[str, str]] = []
        for rule in self.rules:
            if rule.trigger_type not in (trigger_type, "any"):
                continue
            try:
                if not rule.can_trigger(context, now):
                    continue
                decision = self._render(rule.action_template, context)
                decision.setdefault("decision_id", f"automation:{rule.rule_id}:{event_id or uuid.uuid4()}")
                decision.setdefault("reasoning", [f"Automation rule {rule.rule_id} matched"])
                decision.setdefault("confidence_score", 1.0)
                decision.setdefault("metadata", {})
                decision["metadata"].update(
                    {
                        "automation_rule_id": rule.rule_id,
                        "trigger_type": trigger_type,
                        "event_id": event_id,
                        "rule_metadata": dict(rule.metadata),
                    }
                )
                actions = self.planner.plan_from_decision(decision)
                triggered_actions.extend(actions)
                rule.executions += 1
                rule.last_triggered_at = now
                self.triggered_history.append(rule.rule_id)
            except Exception as exc:  # a faulty rule must not block independent rules
                errors.append({"rule_id": rule.rule_id, "error": str(exc)})

        if event_id:
            self._processed_event_ids.add(event_id)
        self.event_history.append(
            {
                "event_id": event_id,
                "trigger_type": trigger_type,
                "timestamp": now,
                "actions": [action.action_id for action in triggered_actions],
                "errors": errors,
            }
        )
        return triggered_actions

    def emit(self, trigger_type: str, payload: Dict[str, Any], event_id: Optional[str] = None) -> List[Action]:
        """Emite um gatilho de módulo, webhook, sync, calendário ou domínio."""
        return self.check_triggers(payload, trigger_type=trigger_type, event_id=event_id)

    def add_workflow(
        self,
        workflow_id: str,
        steps: Iterable[WorkflowStep | Dict[str, Any]],
        *,
        name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> WorkflowDefinition:
        """Registra um workflow declarativo após validar seu grafo de dependências."""
        if workflow_id in self.workflows:
            raise ValueError(f"Workflow already exists: {workflow_id}")
        normalized = [step if isinstance(step, WorkflowStep) else WorkflowStep(**step) for step in steps]
        if not normalized:
            raise ValueError("Workflow requires at least one step")
        self._topological_steps(normalized)
        workflow = WorkflowDefinition(
            workflow_id=workflow_id,
            name=name or workflow_id,
            steps=normalized,
            metadata=dict(metadata or {}),
        )
        self.workflows[workflow_id] = workflow
        return workflow

    def start_workflow(
        self,
        workflow_id: str,
        context: Optional[Dict[str, Any]] = None,
        *,
        run_id: Optional[str] = None,
    ) -> List[Action]:
        """Planeja todas as etapas elegíveis em ordem topológica e cria uma execução auditável."""
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            raise KeyError(f"Unknown workflow: {workflow_id}")
        if not workflow.active:
            return []
        payload = dict(context or {})
        workflow_run_id = run_id or str(uuid.uuid4())
        if workflow_run_id in self.workflow_runs:
            return []

        run = WorkflowRun(
            run_id=workflow_run_id,
            workflow_id=workflow_id,
            status="planning",
            started_at=time.time(),
            context_fingerprint=self._fingerprint(payload),
        )
        actions: List[Action] = []
        step_action_ids: Dict[str, List[str]] = {}
        for step in self._topological_steps(workflow.steps):
            if step.condition and not step.condition(payload):
                run.skipped_steps.append(step.step_id)
                continue
            decision = self._render(step.action_template, payload)
            decision.setdefault("decision_id", f"workflow:{workflow_id}:{workflow_run_id}:{step.step_id}")
            decision.setdefault("reasoning", [f"Workflow {workflow_id}, step {step.step_id}"])
            decision.setdefault("confidence_score", 1.0)
            decision.setdefault("metadata", {})
            dependency_action_ids = [
                action_id
                for dependency in step.depends_on
                for action_id in step_action_ids.get(dependency, [])
            ]
            decision["metadata"].update(
                {
                    "workflow_id": workflow_id,
                    "workflow_run_id": workflow_run_id,
                    "workflow_step_id": step.step_id,
                    "depends_on": list(step.depends_on),
                    "depends_on_action_ids": dependency_action_ids,
                    "on_failure": step.on_failure,
                }
            )
            planned = self.planner.plan_from_decision(decision)
            actions.extend(planned)
            step_action_ids[step.step_id] = [action.action_id for action in planned]
            run.action_ids.extend(action.action_id for action in planned)
        run.status = "planned" if actions else "skipped"
        self.workflow_runs[workflow_run_id] = run
        return actions

    def toggle_rule(self, rule_id: str, status: bool) -> bool:
        for rule in self.rules:
            if rule.rule_id == rule_id:
                rule.active = status
                return True
        return False

    def toggle_workflow(self, workflow_id: str, status: bool) -> bool:
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            return False
        workflow.active = status
        return True

    def get_supported_integrations(self) -> List[str]:
        return [
            "calendar",
            "email",
            "messaging",
            "financial",
            "communication",
            "health",
            "iot",
            "wearables",
            "integration_sdk",
            "module_events",
            "webhooks",
        ]

    def get_status(self) -> Dict[str, Any]:
        return {
            "rules": len(self.rules),
            "active_rules": sum(1 for rule in self.rules if rule.active),
            "workflows": len(self.workflows),
            "active_workflows": sum(1 for workflow in self.workflows.values() if workflow.active),
            "processed_events": len(self._processed_event_ids),
            "workflow_runs": len(self.workflow_runs),
            "triggered_rules": len(self.triggered_history),
        }

    @staticmethod
    def _render(value: Any, context: Dict[str, Any]) -> Any:
        if isinstance(value, str):
            try:
                return value.format_map(_SafeContext(context))
            except (ValueError, KeyError):
                return value
        if isinstance(value, dict):
            return {key: AutomationEngine._render(item, context) for key, item in value.items()}
        if isinstance(value, list):
            return [AutomationEngine._render(item, context) for item in value]
        return value

    @staticmethod
    def _fingerprint(payload: Dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def _topological_steps(steps: List[WorkflowStep]) -> List[WorkflowStep]:
        by_id = {step.step_id: step for step in steps}
        if len(by_id) != len(steps):
            raise ValueError("Workflow step IDs must be unique")
        for step in steps:
            missing = set(step.depends_on) - set(by_id)
            if missing:
                raise ValueError(f"Unknown dependencies for {step.step_id}: {sorted(missing)}")

        ordered: List[WorkflowStep] = []
        temporary: Set[str] = set()
        permanent: Set[str] = set()

        def visit(step_id: str) -> None:
            if step_id in permanent:
                return
            if step_id in temporary:
                raise ValueError("Workflow dependencies contain a cycle")
            temporary.add(step_id)
            for dependency in by_id[step_id].depends_on:
                visit(dependency)
            temporary.remove(step_id)
            permanent.add(step_id)
            ordered.append(by_id[step_id])

        for step in steps:
            visit(step.step_id)
        return ordered


class _SafeContext(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"
