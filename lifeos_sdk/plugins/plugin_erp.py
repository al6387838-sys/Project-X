from typing import List, Dict, Any

class PluginERP:
    def __init__(self, lifeos_api: Any):
        self.lifeos_api = lifeos_api
        self.session_id = None

    def set_session_id(self, session_id: str):
        self.session_id = session_id

    def get_inventory_status(self) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        # Exemplo de interação com a LifeOS API
        context_response = self.lifeos_api.get_context(self.session_id)
        risks_response = self.lifeos_api.get_future_risks(self.session_id)
        
        inventory_status = {
            "status": "ok",
            "current_context": context_response.data if context_response.success else {},
            "inventory_risks": risks_response.data if risks_response.success else [],
            "recommendations": []
        }
        
        # Lógica de negócio do plugin
        if any("estoque baixo" in r.get("title", "").lower() for r in inventory_status["inventory_risks"]):
            inventory_status["recommendations"].append("Realizar pedido de reposição de estoque urgentemente.")
            self.lifeos_api.send_companion_notification(self.session_id, "Alerta de ERP: Risco de estoque baixo detectado. Verifique o inventário.", "warning")

        return inventory_status

    def create_reorder_mission(self, product_name: str, quantity: int) -> Dict[str, Any]:
        if not self.session_id: return {"error": "Sessão não iniciada."}
        
        title = f"Repor estoque de {product_name}"
        objective = f"Realizar pedido de {quantity} unidades de {product_name} para manter o estoque adequado."
        priority = 95
        
        response = self.lifeos_api.create_user_mission(self.session_id, title, objective, priority)
        if response.success:
            self.lifeos_api.send_companion_notification(self.session_id, f"Missão de ERP \'{title}\' criada com sucesso!", "info")
        return response.data if response.success else {"error": response.error}
