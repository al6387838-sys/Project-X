from typing import List, Dict, Any, Optional
try:
    from .core.lifeos_api import LifeOSApi
    from .core.permission_manager import PermissionManager
    from .core.extension_runtime import ExtensionRuntime
    from .core.models import PluginManifest, APIResponse, AppSession
except ImportError:
    from lifeos_sdk.core.lifeos_api import LifeOSApi
    from lifeos_sdk.core.permission_manager import PermissionManager
    from lifeos_sdk.core.extension_runtime import ExtensionRuntime
    from lifeos_sdk.core.models import PluginManifest, APIResponse, AppSession

class LifeOSSDK:
    """
    SDK oficial do LifeOS para desenvolvedores externos.
    Fornece uma interface simplificada para interagir com os motores do LifeOS
    e gerenciar plugins.
    """
    def __init__(self, user_id: str = "default_user"):
        self.user_id = user_id
        self.permission_manager = PermissionManager()
        self.lifeos_api = LifeOSApi(self.permission_manager)
        self.extension_runtime = ExtensionRuntime(self.lifeos_api, self.permission_manager)
        print(f"[LifeOS SDK] Inicializado para o usuário: {self.user_id}")

    def request_session(self, plugin_id: str, requested_permissions: List[str]) -> Optional[AppSession]:
        """
        Solicita uma nova sessão para um plugin com as permissões especificadas.
        """
        print(f"[LifeOS SDK] Solicitando sessão para plugin '{plugin_id}' com permissões: {requested_permissions}")
        session = self.permission_manager.create_app_session(plugin_id, requested_permissions)
        if session:
            print(f"[LifeOS SDK] Sessão criada com sucesso. ID: {session.session_id}")
        else:
            print(f"[LifeOS SDK] Falha ao criar sessão para plugin '{plugin_id}'.")
        return session

    def revoke_permission(self, session_id: str, scope: str) -> bool:
        """
        Revoga uma permissão específica para uma sessão.
        """
        print(f"[LifeOS SDK] Revogando permissão '{scope}' para sessão '{session_id}'.")
        return self.permission_manager.revoke_permission(session_id, scope)

    def get_available_scopes(self) -> List[str]:
        """
        Retorna todos os escopos de permissão disponíveis no LifeOS.
        """
        return self.permission_manager.get_all_available_scopes()

    def register_and_load_plugin(self, manifest: PluginManifest) -> Optional[str]:
        """
        Registra e carrega um plugin no Extension Runtime.
        """
        print(f"[LifeOS SDK] Registrando e carregando plugin: {manifest.name}")
        return self.extension_runtime.register_and_load_plugin(manifest)

    def unload_plugin(self, plugin_id: str) -> bool:
        """
        Descarrega um plugin do Extension Runtime.
        """
        print(f"[LifeOS SDK] Descarregando plugin: {plugin_id}")
        return self.extension_runtime.unload_plugin(plugin_id)

    def run_plugin_task(self, plugin_id: str, task_name: str, *args, **kwargs) -> Any:
        """
        Executa uma tarefa específica de um plugin carregado.
        """
        print(f"[LifeOS SDK] Executando tarefa '{task_name}' do plugin '{plugin_id}'.")
        return self.extension_runtime.run_plugin_task(plugin_id, task_name, *args, **kwargs)

    # --- Métodos de Acesso à API do LifeOS (simplificados para o SDK) ---
    def get_life_graph_goals(self, session_id: str) -> APIResponse:
        return self.lifeos_api.get_life_graph_goals(session_id, self.user_id)

    def update_life_graph_goal_progress(self, session_id: str, goal_id: str, progress: float) -> APIResponse:
        return self.lifeos_api.update_life_graph_goal_progress(session_id, self.user_id, goal_id, progress)

    def get_context(self, session_id: str) -> APIResponse:
        return self.lifeos_api.get_context(session_id, self.user_id)

    def update_context(self, session_id: str, data: Dict[str, Any]) -> APIResponse:
        return self.lifeos_api.update_context(session_id, self.user_id, data)

    def get_timeline_events(self, session_id: str, start_date: Optional[float] = None, end_date: Optional[float] = None) -> APIResponse:
        return self.lifeos_api.get_timeline_events(session_id, self.user_id, start_date, end_date)

    def add_timeline_event(self, session_id: str, event_data: Dict[str, Any]) -> APIResponse:
        return self.lifeos_api.add_timeline_event(session_id, self.user_id, event_data)

    def get_memory_items(self, session_id: str, query: str) -> APIResponse:
        return self.lifeos_api.get_memory_items(session_id, self.user_id, query)

    def add_memory_item(self, session_id: str, memory_data: Dict[str, Any]) -> APIResponse:
        return self.lifeos_api.add_memory_item(session_id, self.user_id, memory_data)

    def simulate_future_scenario(self, session_id: str, situation: str, time_horizon: str) -> APIResponse:
        return self.lifeos_api.simulate_future_scenario(session_id, self.user_id, situation, time_horizon)

    def get_future_risks(self, session_id: str) -> APIResponse:
        return self.lifeos_api.get_future_risks(session_id, self.user_id)

    def get_future_opportunities(self, session_id: str) -> APIResponse:
        return self.lifeos_api.get_future_opportunities(session_id, self.user_id)

    def get_user_missions(self, session_id: str) -> APIResponse:
        return self.lifeos_api.get_user_missions(session_id, self.user_id)

    def create_user_mission(self, session_id: str, title: str, objective: str, priority: int) -> APIResponse:
        return self.lifeos_api.create_user_mission(session_id, self.user_id, title, objective, priority)

    def update_user_mission_status(self, session_id: str, mission_id: str, status: str) -> APIResponse:
        return self.lifeos_api.update_user_mission_status(session_id, self.user_id, mission_id, status)

    def send_companion_notification(self, session_id: str, message: str, type: str = "info") -> APIResponse:
        return self.lifeos_api.send_companion_notification(session_id, self.user_id, message, type)

    def update_companion_dashboard(self, session_id: str, data: Dict[str, Any]) -> APIResponse:
        return self.lifeos_api.update_companion_dashboard(session_id, self.user_id, data)
