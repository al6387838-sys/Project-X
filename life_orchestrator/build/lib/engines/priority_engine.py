from typing import List, Dict, Any, Optional
from ..models.mission import Mission

class PriorityEngine:
    """
    Calcula e gerencia as prioridades globais de missões e tarefas.
    Resolve conflitos de prioridade entre missões.
    """
    def __init__(self, mission_engine: Any, context_engine: Any, personal_dna: Any):
        self.mission_engine = mission_engine
        self.context_engine = context_engine
        self.personal_dna = personal_dna

    def calculate_mission_priority(self, mission: Mission) -> int:
        """
        Calcula a prioridade de uma missão com base em vários fatores.
        (Simulação para o Sprint)
        """
        base_priority = mission.priority
        
        # Fatores do Personal DNA (simulado)
        if self.personal_dna and "values" in self.personal_dna.get_profile():
            if "family" in self.personal_dna.get_profile()["values"] and "family" in mission.objective.lower():
                base_priority += 20
            if "career_growth" in self.personal_dna.get_profile()["values"] and "career" in mission.objective.lower():
                base_priority += 15

        # Fatores do Context Engine (simulado)
        if self.context_engine and "urgent_events" in self.context_engine.get_current_context():
            if any(mission.mission_id in e.get("related_missions", []) for e in self.context_engine.get_current_context()["urgent_events"]):
                base_priority += 30

        # Fatores de risco/oportunidade (simulado)
        if any(r.get("severity", 0) > 0.7 for r in mission.risks):
            base_priority += 25 # Missões com riscos graves ganham prioridade para mitigação
        if any(o.get("potential_gain", 0) > 0.8 for o in mission.opportunities):
            base_priority += 10 # Missões com grandes oportunidades

        return min(100, max(0, base_priority))

    def resolve_conflict(self, mission1: Mission, mission2: Mission) -> Dict[str, Any]:
        """
        Resolve um conflito de prioridade entre duas missões.
        """
        p1 = self.calculate_mission_priority(mission1)
        p2 = self.calculate_mission_priority(mission2)

        explanation = []
        suggestions = []

        if p1 > p2:
            winner = mission1
            loser = mission2
            explanation.append(f"A missão '{mission1.title}' tem prioridade mais alta ({p1}) do que '{mission2.title}' ({p2}).")
        elif p2 > p1:
            winner = mission2
            loser = mission1
            explanation.append(f"A missão '{mission2.title}' tem prioridade mais alta ({p2}) do que '{mission1.title}' ({p1}).")
        else:
            winner = None # Empate
            loser = None
            explanation.append(f"As missões '{mission1.title}' e '{mission2.title}' têm a mesma prioridade ({p1}).")
            suggestions.append("Considere fatores externos ou preferência pessoal para desempatar.")

        if winner:
            suggestions.append(f"Foque em '{winner.title}' primeiro. Considere pausar ou reavaliar '{loser.title}'.")
        
        return {
            "winner_mission_id": winner.mission_id if winner else None,
            "loser_mission_id": loser.mission_id if loser else None,
            "explanation": explanation,
            "suggestions": suggestions
        }

    def get_global_priorities(self) -> List[Mission]:
        """
        Retorna todas as missões ativas ordenadas por prioridade.
        """
        active_missions = [m for m in self.mission_engine.missions.values() if m.status == "active"]
        for mission in active_missions:
            mission.priority = self.calculate_mission_priority(mission) # Atualiza a prioridade no objeto missão
        return sorted(active_missions, key=lambda m: m.priority, reverse=True)
