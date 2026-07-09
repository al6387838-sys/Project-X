"""
Action Planner
==============
Transforma decisões vindas do Decision Engine em planos de ação executáveis.
Analisa o contexto para agrupar e sequenciar ações de forma inteligente.
"""

from typing import List, Dict, Any, Optional
from ..models.action import Action
from ..models.action_group import ActionGroup

class ActionPlanner:
    """
    Responsável por planejar e organizar ações a partir de decisões.
    """

    def plan_from_decision(self, decision: Dict[str, Any]) -> List[Action]:
        """
        Cria uma ou mais ações baseadas em uma decisão.
        """
        actions = []
        
        # Exemplo de lógica de mapeamento de decisão para ação
        # No futuro, isso será integrado diretamente com a classe Decision do SPRINT 004
        action_type = decision.get("action_type", "general")
        confidence = decision.get("confidence_score", 0.0)
        
        # Ações críticas exigem aprovação
        approval_required = confidence < 0.8 or decision.get("priority", 0) > 80
        
        action = Action(
            priority=decision.get("priority", 0),
            approval_required=approval_required,
            origin_decision_id=decision.get("decision_id"),
            expected_result=f"Resultado esperado para {action_type}",
            justification=decision.get("reasoning", ["Justificativa automática"])[0],
            origin="DecisionEngine",
            objective=f"Executar {action_type}",
            action_type=action_type,
            parameters=decision.get("metadata", {})
        )
        
        actions.append(action)
        return actions

    def create_action_group(self, name: str, actions: List[Action], description: str = "") -> ActionGroup:
        """
        Agrupa múltiplas ações em um plano de ação coeso.
        """
        group = ActionGroup(
            name=name,
            actions=actions,
            description=description
        )
        return group

    def sequence_actions(self, actions: List[Action]) -> List[Action]:
        """
        Ordena as ações por prioridade e dependências.
        """
        return sorted(actions, key=lambda a: a.priority, reverse=True)
