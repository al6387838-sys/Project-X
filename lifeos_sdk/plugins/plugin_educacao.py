from typing import List, Dict, Any

class PluginEducacao:
    def __init__(self, lifeos_api: Any):
        self.lifeos_api = lifeos_api
        self.session_id = None

    def set_session_id(self, session_id: str):
        self.session_id = session_id

    def get_learning_progress(self) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        # Exemplo de interação com a LifeOS API
        missions_response = self.lifeos_api.get_user_missions(self.session_id)
        opportunities_response = self.lifeos_api.get_future_opportunities(self.session_id)
        
        learning_progress = {
            "status": "ok",
            "active_learning_missions": [m for m in missions_response.data if "estudar" in m.get("title", "").lower() or "aprender" in m.get("title", "").lower()] if missions_response.success else [],
            "learning_opportunities": opportunities_response.data if opportunities_response.success else [],
            "recommendations": []
        }
        
        # Lógica de negócio do plugin
        if not learning_progress["active_learning_missions"] and learning_progress["learning_opportunities"]:
            learning_progress["recommendations"].append("Considere iniciar uma nova missão de aprendizado para aproveitar as oportunidades detectadas.")
            self.lifeos_api.send_companion_notification(self.session_id, "Oportunidades de aprendizado detectadas! Que tal iniciar uma nova missão?", "info")

        return learning_progress

    def create_study_mission(self, topic: str, duration_months: int) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        title = f"Estudar {topic}"
        objective = f"Aprender e dominar {topic} nos próximos {duration_months} meses."
        priority = 75
        
        response = self.lifeos_api.create_user_mission(self.session_id, title, objective, priority)
        if response.success:
            self.lifeos_api.send_companion_notification(self.session_id, f"Missão de educação \'{title}\' criada com sucesso!", "info")
        return response.data if response.success else {"error": response.error}
