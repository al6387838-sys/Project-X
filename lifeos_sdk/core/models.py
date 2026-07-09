from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time
import uuid

@dataclass
class Permission:
    """Representa uma permissão específica para um plugin."""
    scope: str # ex: life_graph.read, context.write, missions.all
    description: str
    granted: bool = False
    granted_at: Optional[float] = None

@dataclass
class PluginManifest:
    """Metadados de um plugin do LifeOS."""
    plugin_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    version: str = "1.0.0"
    author: str = ""
    description: str = ""
    required_permissions: List[str] = field(default_factory=list)
    category: str = "general" # finance, health, education, crm, erp
    entry_point: str = "" # Classe principal do plugin

@dataclass
class AppSession:
    """Sessão ativa de um plugin externo utilizando o SDK."""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    plugin_id: str = ""
    access_token: str = ""
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    permissions: List[Permission] = field(default_factory=list)

@dataclass
class APIResponse:
    """Resposta padrão da LifeOS Developer API."""
    success: bool = True
    data: Any = None
    error: Optional[str] = None
    timestamp: float = field(default_factory=time.time)
