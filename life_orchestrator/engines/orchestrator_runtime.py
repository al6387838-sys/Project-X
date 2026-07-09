from typing import List, Dict, Any, Optional
from .mission_engine import MissionEngine
from .priority_engine import PriorityEngine
from .dependency_engine import DependencyEngine
from ..models.mission import Mission, OrchestrationEvent

from evolution_engine.engines import EvolutionEngine
from future_engine.engines import FutureEngine

# Mock de outros motores do LifeOS para simulação
class MockLifeGraph:
    def update_goal_progress(self, mission_id: str, progress: float): pass
class MockContextEngine:
    def get_current_context(self): return {"time_of_day": "morning", "location": "home", "urgent_events": []}
    def update_context(self, event_data: Dict[str, Any]): pass
class MockMemoryEngine:
    def record_event(self, event_data: Dict[str, Any]): pass
class MockDecisionEngine:
    def get_recommendation(self, context: Dict[str, Any]): return {"decision": "default", "confidence": 0.5}
    def update_weights(self, learning_event: Any): pass
class MockActionEngine:
    def execute_action(self, action_data: Dict[str, Any]): pass

class MockPersonalDNA:
    def get_profile(self): return {"values": {"family": True, "career_growth": True}}
    def update_dna(self, learning_event: Any): pass
class MockLifeCompanion:
    def send_notification(self, message: str, type: str = "info"): pass
    def update_dashboard(self, data: Dict[str, Any]): pass

class OrchestratorRuntime:
    """
    Coordena todos os motores do LifeOS como um único organismo inteligente.
    """
    def __init__(self,
                 life_graph: Any = None,
                 context_engine: Any = None,
                 memory_engine: Any = None,
                 decision_engine: Any = None,
                 action_engine: Any = None,
                 future_engine: Any = None,
                 evolution_engine: Any = None,
                 personal_dna: Any = None,
                 life_companion: Any = None):

        self.life_graph = life_graph or MockLifeGraph()
        self.context_engine = context_engine or MockContextEngine()
        self.memory_engine = memory_engine or MockMemoryEngine()
        self.decision_engine = decision_engine or MockDecisionEngine()
        self.action_engine = action_engine or MockActionEngine()
        self.future_engine = future_engine or FutureEngine()
        self.evolution_engine = evolution_engine or EvolutionEngine(user_id="orchestrator_user")
        self.personal_dna = personal_dna or MockPersonalDNA()
        self.life_companion = life_companion or MockLifeCompanion()

        self.mission_engine = MissionEngine()
        self.dependency_engine = DependencyEngine(self.mission_engine)
        self.priority_engine = PriorityEngine(self.mission_engine, self.context_engine, self.personal_dna)

    def process_event(self, event: OrchestrationEvent):
        """
        Ponto de entrada principal para eventos que disparam atualizações em cascata.
        """
        print(f"[Orchestrator] Processando evento: {event.category} de {event.source}")

        # 1. Atualizar Timeline (via Evolution Engine)
        self.evolution_engine.process_new_data(event.data) # Evolution Engine atualiza sua timeline

        # 2. Atualizar Contexto
        self.context_engine.update_context(event.data)

        # 3. Atualizar DNA (via Evolution Engine)
        # O Evolution Engine já cuida da atualização do Personal DNA via Adaptation Engine

        # 4. Atualizar Previsões (Future Engine)
        # Isso seria mais complexo, mas simulamos uma atualização de cenário
        if event.category == "mission_update" and event.data.get("mission_status") == "active":
            mission_title = event.data.get("mission_title", "")
            if mission_title:
                scenario = self.future_engine.simulate_future(f"Progresso na missão: {mission_title}", "30_days")
                print(f"[Orchestrator] Novo cenário gerado: {scenario.title}")

        # 5. Atualizar Companion e Dashboard
        self.life_companion.send_notification(f"Evento {event.category} processado. Verificando atualizações.")
        self.life_companion.update_dashboard({"last_event": event.category, "timestamp": event.timestamp})

        # 6. Reavaliar Missões e Prioridades
        self._reassess_missions_and_priorities()

    def _reassess_missions_and_priorities(self):
        """
        Reavalia o estado de todas as missões e suas prioridades.
        """
        print("[Orchestrator] Reavaliando missões e prioridades...")
        # Atualiza o progresso de todas as missões ativas
        for mission_id, mission in self.mission_engine.missions.items():
            if mission.status == "active":
                self.mission_engine._update_mission_progress(mission)

        # Obtém prioridades globais
        global_priorities = self.priority_engine.get_global_priorities()
        if global_priorities:
            print(f"[Orchestrator] Missão de maior prioridade: {global_priorities[0].title} (Prioridade: {global_priorities[0].priority})")

        # Verifica dependências bloqueadas
        blocked_missions = self.dependency_engine.get_blocked_missions()
        for bm in blocked_missions:
            self.life_companion.send_notification(f"Missão '{bm.title}' está bloqueada devido a dependências não cumpridas.", type="warning")

    def create_and_orchestrate_mission(self, title: str, objective: str, priority: int, step_definitions: List[Dict[str, Any]]) -> Mission:
        """
        Cria uma missão, a quebra em passos e inicia sua orquestração.
        """
        mission = self.mission_engine.create_mission(title, objective, priority)
        self.mission_engine.break_down_mission_into_steps(mission.mission_id, step_definitions)
        mission.status = "active"

        # Dispara um evento para o orquestrador processar a nova missão
        event_data = {
            "mission_id": mission.mission_id,
            "mission_title": mission.title,
            "mission_status": mission.status
        }
        self.process_event(OrchestrationEvent(category="mission_update", source="MissionEngine", data=event_data))

        return mission

    def complete_mission_step(self, mission_id: str, step_id: str):
        """
        Marca um passo da missão como completo e dispara o processo de orquestração.
        """
        if self.mission_engine.update_step_status(mission_id, step_id, "completed"):
            mission = self.mission_engine.get_mission(mission_id)
            if mission:
                event_data = {
                    "mission_id": mission.mission_id,
                    "mission_title": mission.title,
                    "step_id": step_id,
                    "step_status": "completed",
                    "mission_progress": mission.progress
                }
                self.process_event(OrchestrationEvent(category="mission_step_completed", source="MissionEngine", data=event_data))

                if mission.progress == 100.0:
                    self.mission_engine.update_mission_status(mission.mission_id, "completed")
                    self.life_companion.send_notification(f"Missão '{mission.title}' COMPLETA! Parabéns!", type="success")
                    self.process_event(OrchestrationEvent(category="mission_completed", source="MissionEngine", data=event_data))

    def resolve_mission_conflict(self, mission1_id: str, mission2_id: str) -> Dict[str, Any]:
        """
        Utiliza o Priority Engine para resolver um conflito entre duas missões.
        """
        mission1 = self.mission_engine.get_mission(mission1_id)
        mission2 = self.mission_engine.get_mission(mission2_id)

        if not mission1 or not mission2:
            return {"error": "Uma ou ambas as missões não encontradas."}

        conflict_resolution = self.priority_engine.resolve_conflict(mission1, mission2)
        self.life_companion.send_notification(
            f"Conflito de prioridade detectado entre '{mission1.title}' e '{mission2.title}'. " +
            "Explicação: " + " ".join(conflict_resolution["explanation"]) + " Sugestões: " + " ".join(conflict_resolution["suggestions"]),
            type="warning"
        )
        return conflict_resolution
