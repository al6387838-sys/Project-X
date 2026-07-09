from typing import List, Dict, Any, Optional
from datetime import datetime
from human_experience.design_system.components import Card, Typography, Button, Dashboard

# Mock de motores do LifeOS para simulação
class MockLifeOSCore:
    def get_morning_briefing(self, user_id: str) -> Dict[str, Any]:
        return {
            "greeting": f"Bom dia, {user_id}!",
            "weather": "Ensolarado, 28°C",
            "top_priority": "Revisar Sprint 014",
            "upcoming_event": "Reunião de equipe às 10h",
            "daily_quote": "A simplicidade é a sofisticação máxima."
        }

    def get_active_missions(self, user_id: str) -> List[Dict[str, Any]]:
        return [
            {"id": "m1", "title": "Finalizar relatório X", "progress": 75, "priority": 80},
            {"id": "m2", "title": "Planejar viagem de férias", "progress": 20, "priority": 60}
        ]

    def get_agenda_items(self, user_id: str) -> List[Dict[str, Any]]:
        return [
            {"time": "10:00", "description": "Reunião de equipe"},
            {"time": "14:00", "description": "Foco profundo: Sprint 015"}
        ]

    def get_companion_status(self, user_id: str) -> Dict[str, Any]:
        return {"message": "Estou aqui para ajudar a simplificar seu dia!", "mood": "positivo"}

    def get_suggested_action(self, user_id: str) -> Dict[str, Any]:
        return {"action": "Revisar pendências do relatório X", "priority": 90}


class DashboardEngine:
    def __init__(self, user_id: str, lifeos_core: Optional[MockLifeOSCore] = None):
        self.user_id = user_id
        self.lifeos_core = lifeos_core or MockLifeOSCore()

    def generate_simple_dashboard(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        widgets: List[Any] = []

        # Morning Briefing
        briefing = self.lifeos_core.get_morning_briefing(self.user_id)
        widgets.append(Card(
            id="morning_briefing_card",
            title=briefing["greeting"],
            content=[
                Typography(id="weather", text=f"Tempo: {briefing["weather"]}").render(),
                Typography(id="priority", text=f"Prioridade hoje: {briefing["top_priority"]}").render(),
                Typography(id="event", text=f"Próximo evento: {briefing["upcoming_event"]}").render(),
                Typography(id="quote", text=f"Citação do dia: \"{briefing["daily_quote"]}\"").render()
            ]
        ).render())

        # Missões
        missions = self.lifeos_core.get_active_missions(self.user_id)
        if missions:
            mission_content = [Typography(id=f"mission_{m['id']}", text=f"{m['title']} ({m['progress']}%)").render() for m in missions]
            widgets.append(Card(
                id="missions_card",
                title="Suas Missões Ativas",
                content=mission_content,
                footer=Button(id="view_all_missions", label="Ver todas as missões", variant="secondary").render()
            ).render())

        # Agenda
        agenda_items = self.lifeos_core.get_agenda_items(self.user_id)
        if agenda_items:
            agenda_content = [Typography(id=f"agenda_{i}", text=f"{item['time']} - {item['description']}").render() for i, item in enumerate(agenda_items)]
            widgets.append(Card(
                id="agenda_card",
                title="Sua Agenda Hoje",
                content=agenda_content,
                footer=Button(id="view_full_agenda", label="Ver agenda completa", variant="secondary").render()
            ).render())

        # Companion
        companion_status = self.lifeos_core.get_companion_status(self.user_id)
        widgets.append(Card(
            id="companion_card",
            title="Seu Companion",
            content=Typography(id="companion_msg", text=companion_status["message"]).render()
        ).render())

        # Ação Sugerida (Progressive Disclosure)
        suggested_action = self.lifeos_core.get_suggested_action(self.user_id)
        if suggested_action and user_context.get("show_suggested_action", True):
            widgets.append(Card(
                id="suggested_action_card",
                title="Ação Sugerida",
                content=Typography(id="action_text", text=suggested_action["action"]).render(),
                footer=Button(id="take_action", label="Fazer agora", variant="primary").render()
            ).render())

        return Dashboard(id="main_dashboard", widgets=widgets).render()

    def get_adaptive_dashboard(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gera um dashboard adaptativo com base no contexto do usuário.
        Implementa Progressive Disclosure: mostra apenas o que é relevante.
        """
        # Exemplo de lógica de adaptação:
        # Se o usuário é novo, mostrar menos widgets.
        # Se o usuário está sobrecarregado, focar apenas nas prioridades.
        
        if user_context.get("is_new_user", False):
            # Dashboard mais simples para novos usuários
            widgets: List[Any] = []
            briefing = self.lifeos_core.get_morning_briefing(self.user_id)
            widgets.append(Card(
                id="morning_briefing_card",
                title=briefing["greeting"],
                content=Typography(id="quote", text=f"Citação do dia: \"{briefing["daily_quote"]}\"").render()
            ).render())
            widgets.append(Card(
                id="companion_card",
                title="Seu Companion",
                content=Typography(id="companion_msg", text="Bem-vindo! Estou aqui para te guiar.").render()
            ).render())
            widgets.append(Card(
                id="onboarding_prompt",
                title="Continue seu Onboarding",
                content=Typography(id="onboarding_text", text="Parece que você ainda está explorando o LifeOS. Que tal continuar de onde parou?").render(),
                footer=Button(id="continue_onboarding", label="Continuar Onboarding", variant="primary").render()
            ).render())
            return Dashboard(id="adaptive_dashboard_new_user", widgets=widgets).render()
        
        elif user_context.get("is_overwhelmed", False):
            # Dashboard focado em prioridades para usuários sobrecarregados
            widgets: List[Any] = []
            briefing = self.lifeos_core.get_morning_briefing(self.user_id)
            widgets.append(Card(
                id="morning_briefing_card",
                title=briefing["greeting"],
                content=Typography(id="priority", text=f"Foco hoje: {briefing["top_priority"]}").render()
            ).render())
            suggested_action = self.lifeos_core.get_suggested_action(self.user_id)
            if suggested_action:
                widgets.append(Card(
                    id="suggested_action_card",
                    title="Próxima Ação",
                    content=Typography(id="action_text", text=suggested_action["action"]).render(),
                    footer=Button(id="take_action", label="Fazer agora", variant="primary").render()
                ).render())
            widgets.append(Card(
                id="companion_card",
                title="Seu Companion",
                content=Typography(id="companion_msg", text="Respire fundo. Vamos focar no essencial.").render()
            ).render())
            return Dashboard(id="adaptive_dashboard_overwhelmed", widgets=widgets).render()
        
        else:
            # Dashboard padrão completo para usuários engajados
            return self.generate_simple_dashboard(user_context)
