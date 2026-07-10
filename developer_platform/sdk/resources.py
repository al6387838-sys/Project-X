"""
LifeOS SDK — Recursos da API
EXECUTION-009: Developer Platform
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from .client import LifeOSClient


class BaseResource:
    """Classe base para todos os recursos do SDK."""

    def __init__(self, client: "LifeOSClient"):
        self._client = client

    def _get(self, path: str, params: Optional[Dict] = None) -> Dict:
        return self._client.request("GET", path, params=params)

    def _post(self, path: str, body: Optional[Dict] = None) -> Dict:
        return self._client.request("POST", path, body=body)

    def _delete(self, path: str) -> Dict:
        return self._client.request("DELETE", path)

    def _patch(self, path: str, body: Optional[Dict] = None) -> Dict:
        return self._client.request("PATCH", path, body=body)


class MemoryResource(BaseResource):
    """
    Recurso de Memórias da LifeOS API.

    Exemplos:
        # Listar memórias
        memories = client.memory.list()

        # Criar memória
        memory = client.memory.create(
            content="Reunião com equipe de produto",
            type="work",
            tags=["meeting", "product"]
        )

        # Buscar memória específica
        memory = client.memory.get("mem_01")

        # Deletar memória
        client.memory.delete("mem_01")
    """

    def list(
        self,
        limit: int = 20,
        cursor: Optional[str] = None,
        type: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Lista memórias do usuário com paginação por cursor."""
        params = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        if type:
            params["type"] = type
        if tags:
            params["tags"] = ",".join(tags)
        return self._get("/memory", params=params)

    def create(
        self,
        content: str,
        type: str = "general",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Cria uma nova memória."""
        body = {"content": content, "type": type}
        if tags:
            body["tags"] = tags
        if metadata:
            body["metadata"] = metadata
        return self._post("/memory", body=body)

    def get(self, memory_id: str) -> Dict[str, Any]:
        """Obtém uma memória específica."""
        return self._get(f"/memory/{memory_id}")

    def delete(self, memory_id: str) -> Dict[str, Any]:
        """Deleta uma memória."""
        return self._delete(f"/memory/{memory_id}")


class TimelineResource(BaseResource):
    """
    Recurso de Timeline da LifeOS API.

    Exemplos:
        # Obter timeline
        events = client.timeline.list()

        # Adicionar evento
        event = client.timeline.add_event(
            title="Lançamento do Developer Portal",
            date="2026-07-10",
            category="milestone"
        )
    """

    def list(
        self,
        limit: int = 20,
        cursor: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Lista eventos da timeline."""
        params = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date
        return self._get("/timeline", params=params)

    def add_event(
        self,
        title: str,
        date: str,
        category: str = "general",
        description: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Adiciona um evento à timeline."""
        body = {"title": title, "date": date, "category": category}
        if description:
            body["description"] = description
        if metadata:
            body["metadata"] = metadata
        return self._post("/timeline/events", body=body)


class DecisionResource(BaseResource):
    """
    Recurso de Decisões da LifeOS API.

    Exemplos:
        # Listar decisões
        decisions = client.decisions.list()

        # Analisar decisão com IA
        analysis = client.decisions.analyze("dec_01")
    """

    def list(self, limit: int = 20, status: Optional[str] = None) -> Dict[str, Any]:
        """Lista decisões do usuário."""
        params = {"limit": limit}
        if status:
            params["status"] = status
        return self._get("/decisions", params=params)

    def analyze(self, decision_id: str) -> Dict[str, Any]:
        """Dispara análise de IA para uma decisão."""
        return self._post(f"/decisions/{decision_id}/analyze")


class InsightResource(BaseResource):
    """
    Recurso de Insights da LifeOS API.

    Exemplos:
        # Listar insights
        insights = client.insights.list()

        # Obter resumo
        summary = client.insights.summary()
    """

    def list(self, limit: int = 10, type: Optional[str] = None) -> Dict[str, Any]:
        """Lista insights gerados pela IA."""
        params = {"limit": limit}
        if type:
            params["type"] = type
        return self._get("/insights", params=params)

    def summary(self) -> Dict[str, Any]:
        """Obtém um resumo dos insights."""
        return self._get("/insights/summary")


class WebhookResource(BaseResource):
    """
    Recurso de Webhooks da LifeOS API.

    Exemplos:
        # Listar webhooks
        webhooks = client.webhooks.list()

        # Criar webhook
        webhook = client.webhooks.create(
            url="https://myapp.com/webhooks/lifeos",
            events=["memory.created", "insight.generated"]
        )

        # Testar webhook
        result = client.webhooks.test("wh_01abc")

        # Deletar webhook
        client.webhooks.delete("wh_01abc")
    """

    def list(self) -> Dict[str, Any]:
        """Lista webhooks registrados."""
        return self._get("/webhooks")

    def create(
        self,
        url: str,
        events: List[str],
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Registra um novo webhook.

        Eventos disponíveis:
        - memory.created, memory.updated, memory.deleted
        - timeline.event_added
        - decision.created, decision.resolved
        - insight.generated
        - api_key.revoked
        - webhook.test
        """
        return self._post("/webhooks", body={"url": url, "events": events, "description": description})

    def delete(self, webhook_id: str) -> Dict[str, Any]:
        """Remove um webhook."""
        return self._delete(f"/webhooks/{webhook_id}")

    def test(self, webhook_id: str) -> Dict[str, Any]:
        """Envia um evento de teste para o webhook."""
        return self._post(f"/webhooks/{webhook_id}/test")

    def deliveries(self, webhook_id: str) -> Dict[str, Any]:
        """Histórico de deliveries de um webhook."""
        return self._get(f"/webhooks/{webhook_id}/deliveries")


class APIKeyResource(BaseResource):
    """
    Recurso de API Keys da LifeOS API.

    Exemplos:
        # Listar chaves
        keys = client.api_keys.list()

        # Criar chave
        key = client.api_keys.create(
            name="Production Key",
            scopes=["read:memory", "read:timeline"]
        )

        # Revogar chave
        client.api_keys.revoke("key_01abc")
    """

    def list(self) -> Dict[str, Any]:
        """Lista API Keys do app."""
        return self._get("/api-keys")

    def create(
        self,
        name: str,
        scopes: List[str],
        expires_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Cria uma nova API Key.

        ATENÇÃO: O valor da chave só é retornado nesta chamada.
        Armazene-o com segurança imediatamente.
        """
        body = {"name": name, "scopes": scopes}
        if expires_at:
            body["expires_at"] = expires_at
        return self._post("/api-keys", body=body)

    def revoke(self, key_id: str) -> Dict[str, Any]:
        """Revoga uma API Key."""
        return self._post(f"/api-keys/{key_id}/revoke")

    def usage(self, key_id: str) -> Dict[str, Any]:
        """Estatísticas de uso de uma API Key."""
        return self._get(f"/api-keys/{key_id}/usage")


class DeveloperResource(BaseResource):
    """
    Recurso de Developer Tools da LifeOS API.

    Exemplos:
        # Resetar sandbox
        client.developer.sandbox_reset()

        # Popular sandbox com dados de exemplo
        client.developer.sandbox_seed()
    """

    def sandbox_reset(self) -> Dict[str, Any]:
        """Reseta o sandbox para estado limpo."""
        return self._post("/developer/sandbox/reset")

    def sandbox_seed(self, preset: str = "default") -> Dict[str, Any]:
        """Popula o sandbox com dados de exemplo."""
        return self._post("/developer/sandbox/seed", body={"preset": preset})

    def api_versions(self) -> Dict[str, Any]:
        """Lista versões disponíveis da API."""
        return self._get("/versions")
