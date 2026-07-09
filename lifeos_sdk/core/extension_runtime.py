from typing import List, Dict, Any, Optional
try:
    from .plugin_engine import PluginEngine
    from .lifeos_api import LifeOSApi
    from .permission_manager import PermissionManager
    from .models import PluginManifest
except (ImportError, ValueError):
    from lifeos_sdk.core.plugin_engine import PluginEngine
    from lifeos_sdk.core.lifeos_api import LifeOSApi
    from lifeos_sdk.core.permission_manager import PermissionManager
    from lifeos_sdk.core.models import PluginManifest

class ExtensionRuntime:
    """
    Fornece o ambiente de execução para os plugins do LifeOS.
    Orquestra a interação entre plugins e o core do LifeOS via LifeOSApi.
    """
    def __init__(self, lifeos_api: LifeOSApi, permission_manager: PermissionManager):
        self.lifeos_api = lifeos_api
        self.permission_manager = permission_manager
        self.plugin_engine = PluginEngine(lifeos_api)

    def register_and_load_plugin(self, manifest: PluginManifest) -> Optional[str]:
        """
        Registra um plugin e tenta carregá-lo.
        Retorna o plugin_id se for bem-sucedido, None caso contrário.
        """
        # Em um sistema real, haveria um processo de aprovação de permissões aqui
        # Por enquanto, criamos uma sessão com as permissões solicitadas
        app_session = self.permission_manager.create_app_session(manifest.plugin_id, manifest.required_permissions)
        if not app_session:
            print(f"[ExtensionRuntime] Falha ao criar sessão para o plugin {manifest.name}. Nenhuma permissão válida concedida.")
            return None

        # Anexa o token de acesso à API para o plugin usar
        # Isso é uma simplificação; em um sistema real, o token seria gerenciado de forma mais segura
        self.lifeos_api.current_session_id = app_session.session_id # Define a sessão ativa para a API

        if self.plugin_engine.load_plugin(manifest):
            return manifest.plugin_id
        return None

    def unload_plugin(self, plugin_id: str) -> bool:
        """
        Descarrega um plugin e revoga suas permissões.
        """
        if self.plugin_engine.unload_plugin(plugin_id):
            # Revogar todas as permissões associadas a este plugin_id
            # (simplificado para o demo, em um sistema real seria mais granular)
            for session_id, session in self.permission_manager.app_sessions.items():
                if session.plugin_id == plugin_id:
                    for perm in session.permissions:
                        self.permission_manager.revoke_permission(session_id, perm.scope)
            return True
        return False

    def run_plugin_task(self, plugin_id: str, task_name: str, *args, **kwargs) -> Any:
        """
        Executa uma tarefa específica de um plugin carregado.
        """
        return self.plugin_engine.execute_plugin_action(plugin_id, task_name, *args, **kwargs)

