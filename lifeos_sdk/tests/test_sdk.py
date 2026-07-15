import pytest
import uuid
from pathlib import Path
from lifeos_sdk.lifeos_sdk import LifeOSSDK
from lifeos_sdk.core.models import PluginManifest

class TestLifeOSSDK:
    def setup_method(self):
        self.sdk = LifeOSSDK(user_id="test_user")

    def test_request_session_and_permissions(self):
        plugin_id = "test_plugin"
        requested_perms = ["life_graph.read", "context.write"]
        
        session = self.sdk.request_session(plugin_id, requested_perms)
        
        assert session is not None
        assert session.plugin_id == plugin_id
        assert len(session.permissions) == 2
        assert all(p.granted for p in session.permissions)

    def test_check_permission_valid(self):
        session = self.sdk.request_session("p1", ["life_graph.read"])
        assert self.sdk.permission_manager.check_permission(session.session_id, "life_graph.read") is True

    def test_check_permission_invalid(self):
        session = self.sdk.request_session("p1", ["life_graph.read"])
        assert self.sdk.permission_manager.check_permission(session.session_id, "context.write") is False

    def test_revoke_permission(self):
        session = self.sdk.request_session("p1", ["life_graph.read"])
        self.sdk.revoke_permission(session.session_id, "life_graph.read")
        assert self.sdk.permission_manager.check_permission(session.session_id, "life_graph.read") is False

    def test_api_access_with_permission(self):
        session = self.sdk.request_session("p1", ["life_graph.read"])
        response = self.sdk.get_life_graph_goals(session.session_id)
        assert response.success is True
        assert len(response.data) > 0

    def test_api_access_denied_without_permission(self):
        session = self.sdk.request_session("p1", ["life_graph.read"])
        response = self.sdk.get_context(session.session_id)
        assert response.success is False
        assert "Permissão negada" in response.error

    def test_plugin_loading_and_task_execution(self):
        # Para este teste, precisamos de um arquivo de plugin real ou mockado
        # Vamos usar o Plugin Financeiro criado anteriormente
        manifest = PluginManifest(
            plugin_id="finance_plugin_001",
            name="Plugin Financeiro",
            required_permissions=["life_graph.read", "future_engine.read", "companion.send_notification"],
            entry_point=str(Path(__file__).resolve().parents[1] / "plugins" / "plugin_financeiro.py")
        )
        
        plugin_id = self.sdk.register_and_load_plugin(manifest)
        assert plugin_id == "finance_plugin_001"
        
        # Simular a configuração da sessão no plugin (normalmente feita pelo runtime)
        session = self.sdk.permission_manager.app_sessions[self.sdk.lifeos_api.current_session_id]
        plugin_instance = self.sdk.extension_runtime.plugin_engine.loaded_plugins[plugin_id]
        plugin_instance.set_session_id(session.session_id)
        
        # Executar uma tarefa do plugin
        result = self.sdk.run_plugin_task(plugin_id, "get_financial_overview")
        assert result is not None
        assert result["status"] == "ok"

    def test_marketplace_listing(self):
        from lifeos_sdk.core.marketplace import Marketplace
        marketplace = Marketplace()
        plugins = marketplace.list_plugins()
        assert len(plugins) == 5
        assert any(p.name == "Plugin Financeiro" for p in plugins)
