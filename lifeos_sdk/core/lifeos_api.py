from typing import List, Dict, Any, Optional
try:
    from .permission_manager import PermissionManager
    from ..core.models import APIResponse
except (ImportError, ValueError):
    from lifeos_sdk.core.permission_manager import PermissionManager
    from lifeos_sdk.core.models import APIResponse

# Mock de motores do LifeOS para o SDK
class MockLifeGraph:
    def get_goals(self, user_id: str) -> List[Dict[str, Any]]: return [{"id": "goal1", "title": "Comprar casa"}]
    def update_goal_progress(self, user_id: str, goal_id: str, progress: float) -> bool: return True

class MockContextEngine:
    def get_current_context(self, user_id: str) -> Dict[str, Any]: return {"location": "home"}
    def update_context(self, user_id: str, data: Dict[str, Any]) -> bool: return True

class MockTimeline:
    def get_events(self, user_id: str, start_date: Optional[float] = None, end_date: Optional[float] = None) -> List[Dict[str, Any]]: return [{"id": "event1", "description": "Acordou cedo"}]
    def add_event(self, user_id: str, event_data: Dict[str, Any]) -> bool: return True

class MockMemoryEngine:
    def get_memories(self, user_id: str, query: str) -> List[Dict[str, Any]]: return [{"id": "mem1", "content": "Lembrete importante"}]
    def add_memory(self, user_id: str, memory_data: Dict[str, Any]) -> bool: return True

class MockFutureEngine:
    def simulate_future(self, user_id: str, situation: str, time_horizon: str) -> Dict[str, Any]: return {"scenario": f"Cenário para {situation}"}
    def get_risks(self, user_id: str) -> List[Dict[str, Any]]: return [{"title": "Risco de estresse"}]
    def get_opportunities(self, user_id: str) -> List[Dict[str, Any]]: return [{"title": "Oportunidade de aprendizado"}]

class MockMissionEngine:
    def get_missions(self, user_id: str) -> List[Dict[str, Any]]: return [{"id": "mission1", "title": "Melhorar saúde"}]
    def create_mission(self, user_id: str, title: str, objective: str, priority: int) -> Dict[str, Any]: return {"id": "new_mission", "title": title}
    def update_mission_status(self, user_id: str, mission_id: str, status: str) -> bool: return True

class MockLifeCompanion:
    def send_notification(self, user_id: str, message: str, type: str) -> bool: return True
    def update_dashboard(self, user_id: str, data: Dict[str, Any]) -> bool: return True


class LifeOSApi:
    """
    API para acesso controlado aos motores do LifeOS por aplicativos externos.
    Todos os métodos verificam permissões antes de executar a operação.
    """
    def __init__(self, permission_manager: PermissionManager,
                 life_graph: Any = None,
                 context_engine: Any = None,
                 timeline: Any = None,
                 memory_engine: Any = None,
                 future_engine: Any = None,
                 mission_engine: Any = None,
                 life_companion: Any = None):
        
        self.pm = permission_manager
        self.life_graph = life_graph or MockLifeGraph()
        self.context_engine = context_engine or MockContextEngine()
        self.timeline = timeline or MockTimeline()
        self.memory_engine = memory_engine or MockMemoryEngine()
        self.future_engine = future_engine or MockFutureEngine()
        self.mission_engine = mission_engine or MockMissionEngine()
        self.life_companion = life_companion or MockLifeCompanion()

    def _check_permission_and_respond(self, session_id: str, scope: str, func: callable, *args, **kwargs) -> APIResponse:
        if not self.pm.check_permission(session_id, scope):
            return APIResponse(success=False, error=f"Permissão negada: {scope}")
        try:
            result = func(*args, **kwargs)
            return APIResponse(success=True, data=result)
        except Exception as e:
            return APIResponse(success=False, error=str(e))

    # --- Life Graph API ---
    def get_life_graph_goals(self, session_id: str, user_id: str) -> APIResponse:
        return self._check_permission_and_respond(session_id, "life_graph.read", self.life_graph.get_goals, user_id)

    def update_life_graph_goal_progress(self, session_id: str, user_id: str, goal_id: str, progress: float) -> APIResponse:
        return self._check_permission_and_respond(session_id, "life_graph.write", self.life_graph.update_goal_progress, user_id, goal_id, progress)

    # --- Context Engine API ---
    def get_context(self, session_id: str, user_id: str) -> APIResponse:
        return self._check_permission_and_respond(session_id, "context.read", self.context_engine.get_current_context, user_id)

    def update_context(self, session_id: str, user_id: str, data: Dict[str, Any]) -> APIResponse:
        return self._check_permission_and_respond(session_id, "context.write", self.context_engine.update_context, user_id, data)

    # --- Timeline API ---
    def get_timeline_events(self, session_id: str, user_id: str, start_date: Optional[float] = None, end_date: Optional[float] = None) -> APIResponse:
        return self._check_permission_and_respond(session_id, "timeline.read", self.timeline.get_events, user_id, start_date, end_date)

    def add_timeline_event(self, session_id: str, user_id: str, event_data: Dict[str, Any]) -> APIResponse:
        return self._check_permission_and_respond(session_id, "timeline.write", self.timeline.add_event, user_id, event_data)

    # --- Memory Engine API ---
    def get_memory_items(self, session_id: str, user_id: str, query: str) -> APIResponse:
        return self._check_permission_and_respond(session_id, "memory.read", self.memory_engine.get_memories, user_id, query)

    def add_memory_item(self, session_id: str, user_id: str, memory_data: Dict[str, Any]) -> APIResponse:
        return self._check_permission_and_respond(session_id, "memory.write", self.memory_engine.add_memory, user_id, memory_data)

    # --- Future Engine API ---
    def simulate_future_scenario(self, session_id: str, user_id: str, situation: str, time_horizon: str) -> APIResponse:
        return self._check_permission_and_respond(session_id, "future_engine.simulate", self.future_engine.simulate_future, user_id, situation, time_horizon)

    def get_future_risks(self, session_id: str, user_id: str) -> APIResponse:
        return self._check_permission_and_respond(session_id, "future_engine.read", self.future_engine.get_risks, user_id)

    def get_future_opportunities(self, session_id: str, user_id: str) -> APIResponse:
        return self._check_permission_and_respond(session_id, "future_engine.read", self.future_engine.get_opportunities, user_id)

    # --- Mission Engine API ---
    def get_user_missions(self, session_id: str, user_id: str) -> APIResponse:
        return self._check_permission_and_respond(session_id, "mission_engine.read", self.mission_engine.get_missions, user_id)

    def create_user_mission(self, session_id: str, user_id: str, title: str, objective: str, priority: int) -> APIResponse:
        return self._check_permission_and_respond(session_id, "mission_engine.write", self.mission_engine.create_mission, user_id, title, objective, priority)

    def update_user_mission_status(self, session_id: str, user_id: str, mission_id: str, status: str) -> APIResponse:
        return self._check_permission_and_respond(session_id, "mission_engine.write", self.mission_engine.update_mission_status, user_id, mission_id, status)

    # --- Companion API ---
    def send_companion_notification(self, session_id: str, user_id: str, message: str, type: str = "info") -> APIResponse:
        return self._check_permission_and_respond(session_id, "companion.send_notification", self.life_companion.send_notification, user_id, message, type)

    def update_companion_dashboard(self, session_id: str, user_id: str, data: Dict[str, Any]) -> APIResponse:
        return self._check_permission_and_respond(session_id, "companion.update_dashboard", self.life_companion.update_dashboard, user_id, data)
