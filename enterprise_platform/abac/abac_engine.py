"""
LifeOS Enterprise Platform — ABAC Engine
EXECUTION-010: Enterprise Platform

Attribute-Based Access Control (ABAC) — controle de acesso baseado em atributos.
Complementa o RBAC com políticas dinâmicas baseadas em contexto.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class PolicyEffect(str, Enum):
    ALLOW = "allow"
    DENY = "deny"


class ConditionOperator(str, Enum):
    EQUALS = "eq"
    NOT_EQUALS = "neq"
    IN = "in"
    NOT_IN = "not_in"
    GREATER_THAN = "gt"
    LESS_THAN = "lt"
    CONTAINS = "contains"
    STARTS_WITH = "starts_with"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"


@dataclass
class PolicyCondition:
    """Condição de uma política ABAC."""
    attribute: str          # Ex: "user.department", "resource.classification"
    operator: ConditionOperator
    value: Any = None

    def evaluate(self, context: Dict[str, Any]) -> bool:
        """Avalia a condição contra um contexto."""
        # Navegar por atributos aninhados (ex: "user.department")
        parts = self.attribute.split(".")
        attr_value = context
        for part in parts:
            if isinstance(attr_value, dict):
                attr_value = attr_value.get(part)
            else:
                attr_value = getattr(attr_value, part, None)
            if attr_value is None:
                break

        op = self.operator
        val = self.value

        if op == ConditionOperator.EQUALS:
            return attr_value == val
        elif op == ConditionOperator.NOT_EQUALS:
            return attr_value != val
        elif op == ConditionOperator.IN:
            return attr_value in (val or [])
        elif op == ConditionOperator.NOT_IN:
            return attr_value not in (val or [])
        elif op == ConditionOperator.GREATER_THAN:
            return attr_value is not None and attr_value > val
        elif op == ConditionOperator.LESS_THAN:
            return attr_value is not None and attr_value < val
        elif op == ConditionOperator.CONTAINS:
            return val in (attr_value or "")
        elif op == ConditionOperator.STARTS_WITH:
            return str(attr_value or "").startswith(str(val or ""))
        elif op == ConditionOperator.IS_NULL:
            return attr_value is None
        elif op == ConditionOperator.IS_NOT_NULL:
            return attr_value is not None
        return False


@dataclass
class ABACPolicy:
    """
    Política ABAC — define regras de acesso baseadas em atributos.

    Exemplo de política:
    - Nome: "Restrict financial data to finance department"
    - Efeito: DENY
    - Condições: user.department != "finance" AND resource.classification == "financial"
    """
    name: str
    effect: PolicyEffect
    resources: List[str]    # Recursos afetados (ex: ["memory", "report"])
    actions: List[str]      # Ações afetadas (ex: ["read", "export"])
    conditions: List[PolicyCondition]
    policy_id: str = field(default_factory=lambda: f"policy_{secrets.token_hex(8)}")
    org_id: Optional[str] = None
    description: str = ""
    priority: int = 100     # Maior prioridade = avaliado primeiro
    enabled: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def matches(self, resource: str, action: str) -> bool:
        """Verifica se a política se aplica ao recurso e ação."""
        resource_match = "*" in self.resources or resource in self.resources
        action_match = "*" in self.actions or action in self.actions
        return resource_match and action_match

    def evaluate_conditions(self, context: Dict[str, Any]) -> bool:
        """Avalia todas as condições da política (AND lógico)."""
        return all(cond.evaluate(context) for cond in self.conditions)

    def to_dict(self) -> dict:
        return {
            "policy_id": self.policy_id,
            "name": self.name,
            "effect": self.effect.value,
            "resources": self.resources,
            "actions": self.actions,
            "conditions": [
                {"attribute": c.attribute, "operator": c.operator.value, "value": c.value}
                for c in self.conditions
            ],
            "priority": self.priority,
            "enabled": self.enabled,
        }


class ABACEngine:
    """
    Motor ABAC do LifeOS Enterprise.

    Funcionalidades:
    - Políticas baseadas em atributos do usuário, recurso e ambiente
    - Avaliação por prioridade (DENY > ALLOW)
    - Políticas globais e por organização
    - Auditoria de decisões de acesso
    """

    def __init__(self):
        self._policies: Dict[str, ABACPolicy] = {}
        self._org_policies: Dict[str, List[str]] = {}  # org_id -> [policy_ids]
        self._decision_log: List[Dict] = []
        self._setup_default_policies()

    def _setup_default_policies(self) -> None:
        """Configura políticas padrão do sistema."""
        # Política: Bloquear acesso fora do horário comercial para dados sensíveis
        self.create_policy(
            name="Block sensitive data outside business hours",
            effect=PolicyEffect.DENY,
            resources=["billing", "compliance", "security"],
            actions=["read", "export"],
            conditions=[
                PolicyCondition(
                    attribute="environment.business_hours",
                    operator=ConditionOperator.EQUALS,
                    value=False,
                ),
                PolicyCondition(
                    attribute="user.role",
                    operator=ConditionOperator.NOT_IN,
                    value=["super_admin", "security_admin"],
                ),
            ],
            description="Prevents access to sensitive resources outside business hours.",
            priority=200,
        )

        # Política: Bloquear acesso de IPs não autorizados
        self.create_policy(
            name="Block unauthorized IP access",
            effect=PolicyEffect.DENY,
            resources=["*"],
            actions=["*"],
            conditions=[
                PolicyCondition(
                    attribute="environment.ip_authorized",
                    operator=ConditionOperator.EQUALS,
                    value=False,
                ),
                PolicyCondition(
                    attribute="organization.ip_restriction_enabled",
                    operator=ConditionOperator.EQUALS,
                    value=True,
                ),
            ],
            description="Blocks access from IPs not in the organization's allowlist.",
            priority=300,
        )

    def create_policy(
        self,
        name: str,
        effect: PolicyEffect,
        resources: List[str],
        actions: List[str],
        conditions: List[PolicyCondition],
        org_id: Optional[str] = None,
        description: str = "",
        priority: int = 100,
    ) -> ABACPolicy:
        """Cria uma nova política ABAC."""
        policy = ABACPolicy(
            name=name,
            effect=effect,
            resources=resources,
            actions=actions,
            conditions=conditions,
            org_id=org_id,
            description=description,
            priority=priority,
        )
        self._policies[policy.policy_id] = policy
        if org_id:
            self._org_policies.setdefault(org_id, []).append(policy.policy_id)
        return policy

    def evaluate(
        self,
        user_id: str,
        resource: str,
        action: str,
        context: Dict[str, Any],
        org_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Avalia todas as políticas aplicáveis e retorna a decisão final.

        Regra de avaliação:
        1. Políticas são avaliadas por prioridade (maior primeiro)
        2. DENY explícito tem precedência sobre ALLOW
        3. Se nenhuma política se aplica, retorna ALLOW (default permissive)
        """
        applicable_policies = []

        # Coletar políticas globais + políticas da organização
        all_policies = [p for p in self._policies.values() if p.org_id is None]
        if org_id:
            org_policy_ids = self._org_policies.get(org_id, [])
            all_policies += [self._policies[pid] for pid in org_policy_ids if pid in self._policies]

        # Filtrar por recurso e ação
        for policy in all_policies:
            if policy.enabled and policy.matches(resource, action):
                applicable_policies.append(policy)

        # Ordenar por prioridade (maior primeiro)
        applicable_policies.sort(key=lambda p: p.priority, reverse=True)

        decision = PolicyEffect.ALLOW
        matched_policies = []

        for policy in applicable_policies:
            if policy.evaluate_conditions(context):
                matched_policies.append(policy.policy_id)
                if policy.effect == PolicyEffect.DENY:
                    decision = PolicyEffect.DENY
                    break  # DENY explícito é final

        result = {
            "decision": decision.value,
            "user_id": user_id,
            "resource": resource,
            "action": action,
            "matched_policies": matched_policies,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

        self._decision_log.append(result)
        return result

    def is_allowed(
        self,
        user_id: str,
        resource: str,
        action: str,
        context: Dict[str, Any],
        org_id: Optional[str] = None,
    ) -> bool:
        """Retorna True se o acesso é permitido."""
        result = self.evaluate(user_id, resource, action, context, org_id)
        return result["decision"] == PolicyEffect.ALLOW.value

    def list_policies(self, org_id: Optional[str] = None) -> List[ABACPolicy]:
        if org_id:
            global_policies = [p for p in self._policies.values() if p.org_id is None]
            org_ids = self._org_policies.get(org_id, [])
            org_policies = [self._policies[pid] for pid in org_ids if pid in self._policies]
            return global_policies + org_policies
        return list(self._policies.values())

    def get_decision_log(self, limit: int = 100) -> List[Dict]:
        return self._decision_log[-limit:]
