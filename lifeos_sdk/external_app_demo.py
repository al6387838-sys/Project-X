import os
import sys

# Adicionar o diretório raiz do Project-X ao PYTHONPATH para que o SDK possa ser importado
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lifeos_sdk import LifeOSSDK, PluginManifest

# --- Simulação de uma Aplicação Externa --- 
# Esta aplicação externa deseja usar um plugin financeiro do LifeOS

class ExternalFinanceApp:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.lifeos_sdk = LifeOSSDK(user_id=user_id)
        self.finance_plugin_id = None
        self.finance_session_id = None

    def initialize_finance_plugin(self):
        print("\n--- Aplicação Externa: Inicializando Plugin Financeiro ---")
        
        # 1. Definir o manifesto do plugin financeiro
        finance_manifest = PluginManifest(
            plugin_id="finance_plugin_001",
            name="Plugin Financeiro",
            author="LifeOS Finance Team",
            description="Gerencie suas finanças, orçamentos e investimentos.",
            required_permissions=[
                "life_graph.read", 
                "future_engine.read", 
                "companion.send_notification", 
                "mission_engine.write"
            ],
            entry_point="/home/ubuntu/Project-X/lifeos_sdk/plugins/plugin_financeiro.py"
        )
        
        # 2. Registrar e carregar o plugin através do SDK
        # Em um cenário real, o usuário seria solicitado a aprovar as permissões aqui.
        # O SDK simula essa aprovação e cria uma sessão.
        self.finance_plugin_id = self.lifeos_sdk.register_and_load_plugin(finance_manifest)
        
        if self.finance_plugin_id:
            print(f"[ExternalFinanceApp] Plugin Financeiro carregado com sucesso (ID: {self.finance_plugin_id}).")
            
            # O SDK já criou uma sessão interna para o plugin. Precisamos obter o session_id
            # para que o plugin possa usá-lo em suas chamadas à API.
            # Em um sistema real, o runtime passaria isso diretamente ao plugin.
            # Para esta demo, vamos simular que o plugin obtém seu session_id.
            for session in self.lifeos_sdk.permission_manager.app_sessions.values():
                if session.plugin_id == self.finance_plugin_id:
                    self.finance_session_id = session.session_id
                    # Passar o session_id para a instância do plugin
                    plugin_instance = self.lifeos_sdk.extension_runtime.plugin_engine.loaded_plugins[self.finance_plugin_id]
                    plugin_instance.set_session_id(self.finance_session_id)
                    print(f"[ExternalFinanceApp] Session ID para o Plugin Financeiro: {self.finance_session_id}")
                    break
        else:
            print("[ExternalFinanceApp] Falha ao carregar o Plugin Financeiro.")

    def get_and_display_financial_overview(self):
        if not self.finance_plugin_id or not self.finance_session_id:
            print("[ExternalFinanceApp] Plugin Financeiro não inicializado.")
            return

        print("\n--- Aplicação Externa: Obtendo Visão Geral Financeira ---")
        # 3. A aplicação externa solicita ao SDK para executar uma tarefa do plugin
        overview = self.lifeos_sdk.run_plugin_task(self.finance_plugin_id, "get_financial_overview")
        
        if overview and overview.get("status") == "ok":
            print("Visão Geral Financeira Recebida:")
            print(f"  Metas: {overview["goals"]}")
            print(f"  Riscos Financeiros: {overview["financial_risks"]}")
            print(f"  Recomendações: {overview["recommendations"]}")
        else:
            print(f"[ExternalFinanceApp] Erro ao obter visão geral financeira: {overview.get("error", "Desconhecido")}")

    def create_new_budget_mission(self):
        if not self.finance_plugin_id or not self.finance_session_id:
            print("[ExternalFinanceApp] Plugin Financeiro não inicializado.")
            return

        print("\n--- Aplicação Externa: Criando Nova Missão de Orçamento ---")
        # 4. A aplicação externa solicita ao SDK para executar outra tarefa do plugin
        mission_data = self.lifeos_sdk.run_plugin_task(self.finance_plugin_id, "create_budget_mission", 1500.00, "mensal")
        
        if mission_data and "id" in mission_data:
            print(f"[ExternalFinanceApp] Missão de orçamento criada com sucesso: {mission_data["title"]} (ID: {mission_data["id"]})")
        else:
            print(f"[ExternalFinanceApp] Erro ao criar missão de orçamento: {mission_data.get("error", "Desconhecido")}")

    def demonstrate_permission_revocation(self):
        if not self.finance_session_id:
            print("[ExternalFinanceApp] Nenhuma sessão financeira ativa para revogar permissões.")
            return

        print("\n--- Aplicação Externa: Demonstrando Revogação de Permissão ---")
        print("Revogando permissão 'life_graph.read' para o Plugin Financeiro...")
        self.lifeos_sdk.revoke_permission(self.finance_session_id, "life_graph.read")

        print("Tentando obter visão geral financeira novamente (deve falhar para life_graph.read)...")
        overview_after_revoke = self.lifeos_sdk.run_plugin_task(self.finance_plugin_id, "get_financial_overview")
        
        if overview_after_revoke and overview_after_revoke.get("status") == "ok":
            print("[ExternalFinanceApp] ERRO: Acesso concedido após revogação! (Isso não deveria acontecer)")
        else:
            print("[ExternalFinanceApp] Acesso negado para life_graph.read após revogação, como esperado.")
            print(f"  Erro: {overview_after_revoke.get("error", "Desconhecido")}")

# --- Execução da Demonstração ---
if __name__ == "__main__":
    app = ExternalFinanceApp(user_id="demo_user_001")
    app.initialize_finance_plugin()
    app.get_and_display_financial_overview()
    app.create_new_budget_mission()
    app.demonstrate_permission_revocation()
    print("\n--- DEMONSTRAÇÃO DO LIFEOS PLATFORM SDK CONCLUÍDA ---")
