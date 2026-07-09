from typing import List, Dict, Any

class PluginCRM:
    def __init__(self, lifeos_api: Any):
        self.lifeos_api = lifeos_api
        self.session_id = None

    def set_session_id(self, session_id: str):
        self.session_id = session_id

    def get_client_interactions(self) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        # Exemplo de interação com a LifeOS API
        timeline_response = self.lifeos_api.get_timeline_events(self.session_id)
        memory_response = self.lifeos_api.get_memory_items(self.session_id, "interação com cliente")
        
        client_interactions = {
            "status": "ok",
            "recent_interactions": [e for e in timeline_response.data if "cliente" in e.get("description", "").lower()] if timeline_response.success else [],
            "key_memories": memory_response.data if memory_response.success else [],
            "follow_up_needed": []
        }
        
        # Lógica de negócio do plugin
        if any("reunião" in i.get("description", "").lower() and "follow-up" not in i.get("description", "").lower() for i in client_interactions["recent_interactions"]):
            client_interactions["follow_up_needed"].append("Verificar follow-up de reuniões recentes com clientes.")
            self.lifeos_api.send_companion_notification(self.session_id, "Lembrete de CRM: Há reuniões recentes com clientes que podem precisar de follow-up.", "info")

        return client_interactions

    def create_follow_up_mission(self, client_name: str, due_date: str) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        title = f"Follow-up com {client_name}"
        objective = f"Realizar follow-up com o cliente {client_name} até {due_date} para avançar no projeto."
        priority = 60
        
        response = self.lifeos_api.create_user_mission(self.session_id, title, objective, priority)
        if response.success:
            self.lifeos_api.send_companion_notification(self.session_id, f"Missão de CRM \'{title}\' criada com sucesso!", "info")
        return response.data if response.success else {"error": response.error}
