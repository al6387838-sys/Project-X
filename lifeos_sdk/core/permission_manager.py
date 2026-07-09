from typing import List, Dict, Any, Optional
try:
    from ..core.models import Permission, AppSession
except (ImportError, ValueError):
    from lifeos_sdk.core.models import Permission, AppSession
import time
import uuid

class PermissionManager:
    """
    Gerencia as permissões concedidas a cada sessão de aplicativo/plugin.
    Garante a soberania dos dados, consentimento explícito e revogação instantânea.
    """
    def __init__(self):
        self.app_sessions: Dict[str, AppSession] = {}
        self.available_scopes: List[str] = [
            "life_graph.read", "life_graph.write",
            "context.read", "context.write",
            "timeline.read", "timeline.write",
            "memory.read", "memory.write",
            "future_engine.read", "future_engine.simulate",
            "mission_engine.read", "mission_engine.write",
            "companion.send_notification", "companion.update_dashboard"
        ]

    def create_app_session(self, plugin_id: str, requested_permissions: List[str]) -> Optional[AppSession]:
        """
        Cria uma nova sessão para um plugin, solicitando permissões.
        As permissões são inicialmente concedidas se forem válidas.
        """
        session_id = str(uuid.uuid4())
        access_token = str(uuid.uuid4()) # Token simples para o demo
        
        permissions = []
        for scope in requested_permissions:
            if scope in self.available_scopes:
                permissions.append(Permission(scope=scope, description=f"Acesso a {scope}", granted=True, granted_at=time.time()))
            else:
                print(f"[PermissionManager] Escopo de permissão inválido solicitado: {scope}")

        if not permissions:
            return None # Nenhuma permissão válida concedida

        app_session = AppSession(
            session_id=session_id,
            plugin_id=plugin_id,
            access_token=access_token,
            expires_at=time.time() + 3600, # Expira em 1 hora para o demo
            permissions=permissions
        )
        self.app_sessions[session_id] = app_session
        return app_session

    def revoke_permission(self, session_id: str, scope: str) -> bool:
        """
        Revoga uma permissão específica para uma sessão.
        """
        session = self.app_sessions.get(session_id)
        if session:
            for perm in session.permissions:
                if perm.scope == scope:
                    perm.granted = False
                    perm.granted_at = None
                    print(f"[PermissionManager] Permissão '{scope}' revogada para sessão '{session_id}'.")
                    return True
        return False

    def check_permission(self, session_id: str, scope: str) -> bool:
        """
        Verifica se uma sessão tem uma permissão específica concedida e ativa.
        """
        session = self.app_sessions.get(session_id)
        if session and session.expires_at > time.time():
            for perm in session.permissions:
                if perm.scope == scope and perm.granted:
                    return True
        return False

    def get_session_permissions(self, session_id: str) -> List[Permission]:
        """
        Retorna todas as permissões de uma sessão.
        """
        session = self.app_sessions.get(session_id)
        return session.permissions if session else []

    def get_all_available_scopes(self) -> List[str]:
        """
        Retorna todos os escopos de permissão disponíveis no sistema.
        """
        return self.available_scopes
