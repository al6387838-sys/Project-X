from typing import List, Dict, Any

class PluginFinanceiro:
    def __init__(self, lifeos_api: Any):
        self.lifeos_api = lifeos_api
        self.session_id = None # Será definido após o carregamento do plugin

    def set_session_id(self, session_id: str):
        self.session_id = session_id

    def get_financial_overview(self) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        # Exemplo de interação com a LifeOS API
        user_id = "test_user" # Em um sistema real, isso viria da sessão
        goals_response = self.lifeos_api.get_life_graph_goals(self.session_id, user_id)
        risks_response = self.lifeos_api.get_future_risks(self.session_id, user_id)
        
        overview = {
            "status": "ok",
            "goals": goals_response.data if goals_response.success else [],
            "financial_risks": risks_response.data if risks_response.success else [],
            "recommendations": []
        }
        
        # Lógica de negócio do plugin
        if any("instabilidade financeira" in r.get("title", "").lower() for r in overview["financial_risks"]):
            overview["recommendations"].append("Revisar orçamento e cortar gastos não essenciais.")
            self.lifeos_api.send_companion_notification(self.session_id, "Alerta financeiro: Risco de instabilidade detectado. Verifique suas finanças.", "warning")

        return overview

    def create_budget_mission(self, amount: float, period: str) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        user_id = "test_user"
        title = f"Criar Orçamento de {amount} para {period}"
        objective = f"Estabelecer e seguir um orçamento de {amount} por {period} para controle financeiro."
        priority = 70
        
        response = self.lifeos_api.create_user_mission(self.session_id, user_id, title, objective, priority)
        if response.success:
            self.lifeos_api.send_companion_notification(self.session_id, f"Missão financeira \'{title}\' criada com sucesso!", "info")
        return response.data if response.success else {"error": response.error}
