import os
import sys
from typing import Dict, Any

# Adicionar o diretório raiz do Project-X ao PYTHONPATH para que os módulos possam ser importados
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from human_experience.onboarding import OnboardingEngine, SmartOnboarding
from human_experience.dashboard import DashboardEngine
from human_experience.navigation import NavigationEngine
from human_experience.accessibility import AccessibilityManager

class LifeOSUserJourneySimulator:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.onboarding_engine = OnboardingEngine()
        self.smart_onboarding = SmartOnboarding(user_id=self.user_id, onboarding_engine=self.onboarding_engine)
        self.dashboard_engine = DashboardEngine(user_id=self.user_id)
        self.navigation_engine = NavigationEngine()
        self.accessibility_manager = AccessibilityManager()
        self.user_context: Dict[str, Any] = {"user_id": self.user_id, "onboarding_completed": False, "is_new_user": True, "is_overwhelmed": False}

    def simulate_onboarding(self):
        print("\n--- SIMULAÇÃO: PRIMEIRO ACESSO E ONBOARDING ---")
        print("LifeOS detecta novo usuário. Iniciando Smart Onboarding...")

        current_step_info = self.smart_onboarding.start_onboarding()
        step_count = 1
        while current_step_info and current_step_info.get("step_data"):
            step_data = current_step_info["step_data"]
            print(f"\nPasso {step_count}: {step_data["props"]["title"]}")
            print(f"  Descrição: {step_data["props"]["description"]}")
            # Simula a interação do usuário avançando
            if step_data["id"] == "ready":
                print("  Usuário clica em 'Começar LifeOS'.")
                self.smart_onboarding.complete_onboarding()
                break
            else:
                print("  Usuário clica em 'Próximo'.")
                current_step_info = self.smart_onboarding.advance_onboarding()
            step_count += 1
        
        self.user_context["onboarding_completed"] = True
        self.user_context["is_new_user"] = False
        print("\nOnboarding concluído! Usuário pronto para usar o LifeOS.")

    def simulate_first_dashboard_access(self):
        print("\n--- SIMULAÇÃO: PRIMEIRO ACESSO AO DASHBOARD ---")
        print("Gerando Dashboard Inicial extremamente simples...")
        
        dashboard = self.dashboard_engine.get_adaptive_dashboard(self.user_context)
        print(f"Dashboard Gerado (ID: {dashboard["id"]})")
        for widget in dashboard["props"]["widgets"]:
            print(f"  Widget: {widget["type"].capitalize()} (ID: {widget["id"]})")
            if widget["type"] == "card":
                print(f"    Título: {widget["props"]["title"]}")
                if isinstance(widget["props"]["content"], list):
                    for item in widget["props"]["content"]:
                        if item["type"] == "typography":
                            print(f"      - {item["props"]["text"]}")
                elif isinstance(widget["props"]["content"], dict) and widget["props"]["content"]["type"] == "typography":
                    print(f"    Conteúdo: {widget["props"]["content"]["props"]["text"]}")
            
        print("\n--- SIMULAÇÃO: NAVEGAÇÃO GUIADA E ACESSIBILIDADE ---")
        print("Menu de navegação para usuário com onboarding completo:")
        nav_menu = self.navigation_engine.get_navigation_menu(self.user_context)
        for item in nav_menu:
            print(f"  - {item["label"]} ({item["route"]})")

        print("\nAtivando modo de alto contraste...")
        self.accessibility_manager.update_setting("high_contrast_mode", True)
        print(f"Configurações de acessibilidade: {self.accessibility_manager.get_current_settings()}")

    def simulate_adaptive_dashboard_overwhelmed(self):
        print("\n--- SIMULAÇÃO: DASHBOARD ADAPTATIVO (USUÁRIO SOBRECARREGADO) ---")
        self.user_context["is_overwhelmed"] = True
        print("LifeOS detecta que o usuário está sobrecarregado. Adaptando o Dashboard...")
        
        dashboard = self.dashboard_engine.get_adaptive_dashboard(self.user_context)
        print(f"Dashboard Gerado (ID: {dashboard["id"]})")
        for widget in dashboard["props"]["widgets"]:
            print(f"  Widget: {widget["type"].capitalize()} (ID: {widget["id"]})")
            if widget["type"] == "card":
                print(f"    Título: {widget["props"]["title"]}")
                if isinstance(widget["props"]["content"], list):
                    for item in widget["props"]["content"]:
                        if item["type"] == "typography":
                            print(f"      - {item["props"]["text"]}")
                elif isinstance(widget["props"]["content"], dict) and widget["props"]["content"]["type"] == "typography":
                    print(f"    Conteúdo: {widget["props"]["content"]["props"]["text"]}")

# --- Execução da Simulação ---
if __name__ == "__main__":
    simulator = LifeOSUserJourneySimulator(user_id="ana_silva")
    simulator.simulate_onboarding()
    simulator.simulate_first_dashboard_access()
    simulator.simulate_adaptive_dashboard_overwhelmed()
    print("\n--- JORNADA DO USUÁRIO NO LIFEOS CONCLUÍDA ---")
