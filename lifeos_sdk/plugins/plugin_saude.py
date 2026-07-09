from typing import List, Dict, Any

class PluginSaude:
    def __init__(self, lifeos_api: Any):
        self.lifeos_api = lifeos_api
        self.session_id = None

    def set_session_id(self, session_id: str):
        self.session_id = session_id

    def get_health_status(self) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        # Exemplo de interação com a LifeOS API
        context_response = self.lifeos_api.get_context(self.session_id)
        timeline_response = self.lifeos_api.get_timeline_events(self.session_id)
        
        health_status = {
            "status": "ok",
            "current_context": context_response.data if context_response.success else {},
            "recent_health_events": timeline_response.data if timeline_response.success else [],
            "recommendations": []
        }
        
        # Lógica de negócio do plugin
        if any("sono ruim" in e.get("description", "").lower() for e in health_status["recent_health_events"]):
            health_status["recommendations"].append("Melhorar higiene do sono e reduzir cafeína à noite.")
            self.lifeos_api.send_companion_notification(self.session_id, "Alerta de saúde: Padrões de sono irregulares detectados. Considere ajustar sua rotina.", "warning")

        return health_status

    def create_exercise_mission(self, activity: str, frequency: str) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        title = f"Iniciar {activity} {frequency}"
        objective = f"Incorporar {activity} {frequency} na rotina para melhorar a saúde física."
        priority = 85
        
        response = self.lifeos_api.create_user_mission(self.session_id, title, objective, priority)
        if response.success:
            self.lifeos_api.send_companion_notification(self.session_id, f"Missão de saúde \'{title}\' criada com sucesso!", "info")
        return response.data if response.success else {"error": response.error}
