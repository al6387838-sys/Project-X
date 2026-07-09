from typing import List, Dict, Any, Optional
try:
    from ..core.models import PluginManifest
except (ImportError, ValueError):
    from lifeos_sdk.core.models import PluginManifest
import importlib.util
import sys
import os

class PluginEngine:
    """
    Gerencia o carregamento, descarregamento e ciclo de vida dos plugins.
    """
    def __init__(self, lifeos_api: Any):
        self.lifeos_api = lifeos_api
        self.loaded_plugins: Dict[str, Any] = {}
        self.plugin_manifests: Dict[str, PluginManifest] = {}

    def load_plugin(self, manifest: PluginManifest) -> bool:
        """
        Carrega um plugin a partir do seu manifesto.
        """
        if manifest.plugin_id in self.loaded_plugins:
            print(f"[PluginEngine] Plugin {manifest.name} já carregado.")
            return False

        try:
            # Simula o carregamento de um módulo Python
            # Em um ambiente real, isso seria mais robusto e seguro (sandboxing)
            module_name = f"lifeos_plugin_{manifest.name.replace(' ', '_').lower()}"
            spec = importlib.util.spec_from_file_location(module_name, manifest.entry_point)
            if spec is None:
                print(f"[PluginEngine] Não foi possível encontrar o ponto de entrada para o plugin {manifest.name}.")
                return False
            
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            
            # Assumimos que o entry_point aponta para um arquivo que define uma classe com o mesmo nome do plugin
            plugin_class = getattr(module, manifest.name.replace(' ', '')) # Ex: 'PluginFinanceiro' para 'Plugin Financeiro'
            plugin_instance = plugin_class(self.lifeos_api) # Passa a API do LifeOS para o plugin
            
            self.loaded_plugins[manifest.plugin_id] = plugin_instance
            self.plugin_manifests[manifest.plugin_id] = manifest
            print(f"[PluginEngine] Plugin {manifest.name} (ID: {manifest.plugin_id}) carregado com sucesso.")
            return True
        except Exception as e:
            print(f"[PluginEngine] Erro ao carregar plugin {manifest.name}: {e}")
            return False

    def unload_plugin(self, plugin_id: str) -> bool:
        """
        Descarrega um plugin pelo seu ID.
        """
        if plugin_id in self.loaded_plugins:
            plugin_name = self.plugin_manifests[plugin_id].name
            del self.loaded_plugins[plugin_id]
            del self.plugin_manifests[plugin_id]
            print(f"[PluginEngine] Plugin {plugin_name} (ID: {plugin_id}) descarregado com sucesso.")
            return True
        return False

    def get_loaded_plugins(self) -> Dict[str, Any]:
        """
        Retorna todos os plugins carregados.
        """
        return self.loaded_plugins

    def get_plugin_manifest(self, plugin_id: str) -> Optional[PluginManifest]:
        """
        Retorna o manifesto de um plugin pelo seu ID.
        """
        return self.plugin_manifests.get(plugin_id)

    def execute_plugin_action(self, plugin_id: str, action_name: str, *args, **kwargs) -> Any:
        """
        Executa uma ação específica de um plugin carregado.
        """
        plugin = self.loaded_plugins.get(plugin_id)
        if plugin:
            if hasattr(plugin, action_name) and callable(getattr(plugin, action_name)):
                print(f"[PluginEngine] Executando ação '{action_name}' do plugin '{self.plugin_manifests[plugin_id].name}'.")
                return getattr(plugin, action_name)(*args, **kwargs)
            else:
                print(f"[PluginEngine] Ação '{action_name}' não encontrada ou não é executável no plugin '{self.plugin_manifests[plugin_id].name}'.")
        return None
