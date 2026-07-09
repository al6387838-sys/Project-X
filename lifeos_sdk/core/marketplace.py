from typing import List, Dict, Any, Optional
from .models import PluginManifest

class Marketplace:
    """
    Simula o Marketplace interno de plugins do LifeOS.
    """
    def __init__(self):
        self.available_plugins: Dict[str, PluginManifest] = {
            "finance_plugin_001": PluginManifest(
                plugin_id="finance_plugin_001",
                name="Plugin Financeiro",
                author="LifeOS Finance Team",
                description="Gerencie suas finanças, orçamentos e investimentos.",
                required_permissions=["life_graph.read", "future_engine.read", "companion.send_notification", "mission_engine.write"],
                category="finance",
                entry_point="/home/ubuntu/Project-X/lifeos_sdk/plugins/plugin_financeiro.py"
            ),
            "health_plugin_001": PluginManifest(
                plugin_id="health_plugin_001",
                name="Plugin Saúde",
                author="LifeOS Health Team",
                description="Monitore sua saúde, sono e atividades físicas.",
                required_permissions=["context.read", "timeline.read", "companion.send_notification", "mission_engine.write"],
                category="health",
                entry_point="/home/ubuntu/Project-X/lifeos_sdk/plugins/plugin_saude.py"
            ),
            "edu_plugin_001": PluginManifest(
                plugin_id="edu_plugin_001",
                name="Plugin Educação",
                author="LifeOS Education Team",
                description="Acompanhe seu progresso de aprendizado e novos cursos.",
                required_permissions=["mission_engine.read", "future_engine.read", "companion.send_notification", "mission_engine.write"],
                category="education",
                entry_point="/home/ubuntu/Project-X/lifeos_sdk/plugins/plugin_educacao.py"
            ),
            "crm_plugin_001": PluginManifest(
                plugin_id="crm_plugin_001",
                name="Plugin CRM",
                author="LifeOS Business Team",
                description="Gerencie interações com clientes e follow-ups.",
                required_permissions=["timeline.read", "memory.read", "companion.send_notification", "mission_engine.write"],
                category="crm",
                entry_point="/home/ubuntu/Project-X/lifeos_sdk/plugins/plugin_crm.py"
            ),
            "erp_plugin_001": PluginManifest(
                plugin_id="erp_plugin_001",
                name="Plugin ERP",
                author="LifeOS Business Team",
                description="Gerencie inventário, estoque e riscos operacionais.",
                required_permissions=["context.read", "future_engine.read", "companion.send_notification", "mission_engine.write"],
                category="erp",
                entry_point="/home/ubuntu/Project-X/lifeos_sdk/plugins/plugin_erp.py"
            )
        }

    def list_plugins(self, category: Optional[str] = None) -> List[PluginManifest]:
        """
        Lista todos os plugins disponíveis no Marketplace.
        """
        if category:
            return [p for p in self.available_plugins.values() if p.category == category]
        return list(self.available_plugins.values())

    def get_plugin_details(self, plugin_id: str) -> Optional[PluginManifest]:
        """
        Retorna os detalhes de um plugin específico.
        """
        return self.available_plugins.get(plugin_id)

    def search_plugins(self, query: str) -> List[PluginManifest]:
        """
        Pesquisa plugins por nome ou descrição.
        """
        query = query.lower()
        return [p for p in self.available_plugins.values() if query in p.name.lower() or query in p.description.lower()]
