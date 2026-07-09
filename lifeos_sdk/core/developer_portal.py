from typing import List, Dict, Any, Optional
from .marketplace import Marketplace
from .models import PluginManifest

class DeveloperPortal:
    """
    Simula o Developer Portal do LifeOS.
    Fornece ferramentas para desenvolvedores gerenciarem seus plugins e acessarem a documentação.
    """
    def __init__(self, marketplace: Marketplace):
        self.marketplace = marketplace
        self.developer_apps: Dict[str, List[str]] = {} # developer_id -> list of plugin_ids

    def register_developer(self, developer_id: str):
        if developer_id not in self.developer_apps:
            self.developer_apps[developer_id] = []
            print(f"[DeveloperPortal] Desenvolvedor '{developer_id}' registrado com sucesso.")

    def submit_plugin(self, developer_id: str, manifest: PluginManifest) -> bool:
        """
        Simula a submissão de um novo plugin para o Marketplace.
        """
        if developer_id not in self.developer_apps:
            print(f"[DeveloperPortal] Desenvolvedor '{developer_id}' não registrado.")
            return False
        
        # Em um sistema real, haveria um processo de revisão aqui
        self.marketplace.available_plugins[manifest.plugin_id] = manifest
        self.developer_apps[developer_id].append(manifest.plugin_id)
        print(f"[DeveloperPortal] Plugin '{manifest.name}' submetido pelo desenvolvedor '{developer_id}' com sucesso.")
        return True

    def get_api_explorer(self) -> Dict[str, Any]:
        """
        Retorna informações sobre a API para o API Explorer.
        """
        return {
            "base_url": "https://api.lifeos.ai/v1",
            "endpoints": [
                {"path": "/life_graph/goals", "methods": ["GET", "POST"]},
                {"path": "/context", "methods": ["GET", "PUT"]},
                {"path": "/timeline/events", "methods": ["GET", "POST"]},
                {"path": "/memory", "methods": ["GET", "POST"]},
                {"path": "/future/simulate", "methods": ["POST"]},
                {"path": "/missions", "methods": ["GET", "POST", "PUT"]},
                {"path": "/companion/notify", "methods": ["POST"]}
            ]
        }

    def get_sandbox_config(self) -> Dict[str, Any]:
        """
        Retorna configurações para o ambiente de Sandbox.
        """
        return {
            "sandbox_user_id": "sandbox_user_123",
            "mock_data_enabled": True,
            "rate_limits": "none"
        }
