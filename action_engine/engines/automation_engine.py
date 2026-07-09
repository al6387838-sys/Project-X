"""
Automation Engine
=================
Gerencia regras de automação e gatilhos para execução recorrente ou condicional.
Prepara a base para integrações futuras (IoT, Wearables, etc).
"""

from typing import List, Dict, Any, Optional, Callable
from ..models.action import Action
from .action_planner import ActionPlanner

class AutomationRule:
    """Representa uma regra de automação."""
    def __init__(self, rule_id: str, trigger_condition: Callable, action_template: Dict[str, Any]):
        self.rule_id = rule_id
        self.trigger_condition = trigger_condition
        self.action_template = action_template
        self.active = True

class AutomationEngine:
    """
    Motor de automação que dispara ações baseadas em gatilhos.
    """

    def __init__(self, planner: ActionPlanner):
        self.planner = planner
        self.rules: List[AutomationRule] = []
        self.triggered_history: List[str] = []

    def add_rule(self, rule_id: str, condition: Callable, template: Dict[str, Any]):
        """Adiciona uma nova regra de automação."""
        rule = AutomationRule(rule_id, condition, template)
        self.rules.append(rule)

    def check_triggers(self, context_data: Dict[str, Any]) -> List[Action]:
        """
        Verifica se alguma regra de automação foi disparada pelo contexto atual.
        """
        triggered_actions = []
        for rule in self.rules:
            if rule.active and rule.trigger_condition(context_data):
                # Se a condição for atendida, planeja a ação usando o template
                actions = self.planner.plan_from_decision(rule.action_template)
                triggered_actions.extend(actions)
                self.triggered_history.append(rule.rule_id)
        return triggered_actions

    def toggle_rule(self, rule_id: str, status: bool):
        """Ativa ou desativa uma regra."""
        for rule in self.rules:
            if rule.rule_id == rule_id:
                rule.active = status
                break

    def get_supported_integrations(self) -> List[str]:
        """Retorna os domínios de integração preparados."""
        return [
            "calendar", "email", "messaging", 
            "financial", "health", "iot", "wearables"
        ]
