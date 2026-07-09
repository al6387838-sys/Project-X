from typing import List, Dict, Any, Optional

class NavigationEngine:
    def __init__(self):
        self.navigation_paths = {
            "onboarding_completed": [
                {"label": "Dashboard", "route": "/dashboard", "icon": "home"},
                {"label": "Minhas Missões", "route": "/missions", "icon": "target"},
                {"label": "Agenda", "route": "/agenda", "icon": "calendar"},
                {"label": "Life Graph", "route": "/life-graph", "icon": "graph"},
                {"label": "Companion", "route": "/companion", "icon": "robot"},
                {"label": "Configurações", "route": "/settings", "icon": "settings"}
            ],
            "new_user_onboarding": [
                {"label": "Bem-vindo", "route": "/onboarding/welcome", "icon": "hand"},
                {"label": "Seu DNA Pessoal", "route": "/onboarding/personal-dna", "icon": "dna"},
                {"label": "Começar", "route": "/onboarding/start", "icon": "play"}
            ]
        }

    def get_navigation_menu(self, user_state: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Retorna o menu de navegação adaptado ao estado do usuário.
        """
        if user_state.get("onboarding_completed", False):
            return self.navigation_paths["onboarding_completed"]
        else:
            return self.navigation_paths["new_user_onboarding"]

    def get_guided_tour_steps(self, user_id: str, current_page: str) -> List[Dict[str, Any]]:
        """
        Retorna passos de um tour guiado para uma página específica.
        """
        # Simulação de passos de tour guiado
        if current_page == "/dashboard":
            return [
                {"element": "#morning_briefing_card", "title": "Seu Resumo Diário", "description": "Aqui você encontra as informações mais importantes para começar o dia."},
                {"element": "#missions_card", "title": "Suas Missões", "description": "Acompanhe o progresso dos seus objetivos de vida."},
                {"element": "#companion_card", "title": "Seu Companion", "description": "Seu assistente pessoal sempre pronto para ajudar."}
            ]
        elif current_page == "/missions":
            return [
                {"element": "#mission_list", "title": "Lista de Missões", "description": "Todas as suas missões ativas e concluídas."},
                {"element": "#add_mission_button", "title": "Criar Nova Missão", "description": "Defina um novo objetivo e o LifeOS te ajudará a alcançá-lo."}
            ]
        return []
