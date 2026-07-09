from typing import List, Dict, Any, Optional
from ..models.mission import Mission, MissionStep

class DependencyEngine:
    """
    Gerencia as dependências entre missões e passos de missão.
    Garante que as ações sejam executadas na ordem correta e identifica bloqueios.
    """
    def __init__(self, mission_engine: Any):
        self.mission_engine = mission_engine

    def check_step_dependencies(self, mission_id: str, step_id: str) -> bool:
        """
        Verifica se todas as dependências de um passo estão completas.
        """
        mission = self.mission_engine.get_mission(mission_id)
        if not mission:
            return False

        current_step = None
        for step in mission.steps:
            if step.step_id == step_id:
                current_step = step
                break

        if not current_step or not current_step.dependencies:
            return True # Sem dependências ou passo não encontrado, pode prosseguir

        for dep_step_id in current_step.dependencies:
            dep_step = next((s for s in mission.steps if s.step_id == dep_step_id), None)
            if not dep_step or dep_step.status != "completed":
                return False # Dependência não encontrada ou não completa
        return True

    def check_mission_dependencies(self, mission_id: str) -> bool:
        """
        Verifica se todas as dependências de uma missão estão completas.
        """
        mission = self.mission_engine.get_mission(mission_id)
        if not mission or not mission.dependencies:
            return True # Sem dependências ou missão não encontrada, pode prosseguir

        for dep_mission_id in mission.dependencies:
            dep_mission = self.mission_engine.get_mission(dep_mission_id)
            if not dep_mission or dep_mission.status != "completed":
                return False # Dependência não encontrada ou não completa
        return True

    def get_blocked_steps(self, mission_id: str) -> List[MissionStep]:
        """
        Retorna uma lista de passos bloqueados para uma missão.
        """
        mission = self.mission_engine.get_mission(mission_id)
        if not mission:
            return []

        blocked_steps = []
        for step in mission.steps:
            if step.status == "pending" or step.status == "in_progress":
                if not self.check_step_dependencies(mission_id, step.step_id):
                    blocked_steps.append(step)
        return blocked_steps

    def get_blocked_missions(self) -> List[Mission]:
        """
        Retorna uma lista de missões bloqueadas.
        """
        blocked_missions = []
        for mission_id, mission in self.mission_engine.missions.items():
            if mission.status == "active" or mission.status == "paused":
                if not self.check_mission_dependencies(mission_id):
                    blocked_missions.append(mission)
        return blocked_missions
