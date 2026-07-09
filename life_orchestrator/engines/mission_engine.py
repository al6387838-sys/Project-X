from typing import List, Dict, Any, Optional
from ..models.mission import Mission, MissionStep
import uuid
import time

class MissionEngine:
    """
    Gerencia a criação, quebra e atualização de missões e seus passos.
    """
    def __init__(self):
        self.missions: Dict[str, Mission] = {}

    def create_mission(self, title: str, objective: str, priority: int = 50) -> Mission:
        """
        Cria uma nova missão.
        """
        mission = Mission(title=title, objective=objective, priority=priority)
        self.missions[mission.mission_id] = mission
        return mission

    def get_mission(self, mission_id: str) -> Optional[Mission]:
        """
        Retorna uma missão pelo seu ID.
        """
        return self.missions.get(mission_id)

    def update_mission_status(self, mission_id: str, status: str) -> bool:
        """
        Atualiza o status de uma missão.
        """
        mission = self.get_mission(mission_id)
        if mission:
            mission.status = status
            mission.updated_at = time.time()
            return True
        return False

    def break_down_mission_into_steps(self, mission_id: str, step_definitions: List[Dict[str, Any]]) -> bool:
        """
        Quebra uma missão em passos menores.
        step_definitions: [{'title': 'Passo 1', 'description': '...', 'dependencies': ['step_id_x']}]
        """
        mission = self.get_mission(mission_id)
        if not mission:
            return False

        new_steps = []
        for step_def in step_definitions:
            step = MissionStep(
                title=step_def['title'],
                description=step_def.get('description', ''),
                dependencies=step_def.get('dependencies', []),
                assigned_engine=step_def.get('assigned_engine', None)
            )
            new_steps.append(step)
        mission.steps.extend(new_steps)
        return True

    def update_step_status(self, mission_id: str, step_id: str, status: str) -> bool:
        """
        Atualiza o status de um passo de missão.
        """
        mission = self.get_mission(mission_id)
        if mission:
            for step in mission.steps:
                if step.step_id == step_id:
                    step.status = status
                    self._update_mission_progress(mission)
                    return True
        return False

    def _update_mission_progress(self, mission: Mission):
        """
        Calcula o progresso da missão com base nos passos concluídos.
        """
        if not mission.steps:
            mission.progress = 0.0
            return

        completed_steps = sum(1 for step in mission.steps if step.status == "completed")
        mission.progress = (completed_steps / len(mission.steps)) * 100.0
        mission.updated_at = time.time()

    def add_risk_to_mission(self, mission_id: str, risk_data: Dict[str, Any]) -> bool:
        mission = self.get_mission(mission_id)
        if mission:
            mission.risks.append(risk_data)
            return True
        return False

    def add_opportunity_to_mission(self, mission_id: str, opportunity_data: Dict[str, Any]) -> bool:
        mission = self.get_mission(mission_id)
        if mission:
            mission.opportunities.append(opportunity_data)
            return True
        return False
