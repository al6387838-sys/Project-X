import pytest
from human_experience.onboarding.onboarding_engine import OnboardingEngine, SmartOnboarding
from human_experience.dashboard.dashboard_engine import DashboardEngine
from human_experience.navigation.navigation_engine import NavigationEngine
from human_experience.accessibility.accessibility_manager import AccessibilityManager

class TestHumanExperience:
    def test_onboarding_flow(self):
        engine = OnboardingEngine()
        smart_onboarding = SmartOnboarding(user_id="test_user", onboarding_engine=engine)
        
        assert smart_onboarding.is_onboarding_completed() is False
        
        # Iniciar onboarding
        step1 = smart_onboarding.start_onboarding()
        assert step1["step_data"]["id"] == "welcome"
        
        # Avançar para o segundo passo
        step2 = smart_onboarding.advance_onboarding()
        assert step2["step_data"]["id"] == "how_it_works"
        
        # Voltar para o primeiro passo
        back_to_step1 = smart_onboarding.go_back_onboarding()
        assert back_to_step1["step_data"]["id"] == "welcome"
        
        # Concluir onboarding
        smart_onboarding.complete_onboarding()
        assert smart_onboarding.is_onboarding_completed() is True

    def test_adaptive_dashboard(self):
        dashboard_engine = DashboardEngine(user_id="test_user")
        
        # Novo usuário
        new_user_context = {"is_new_user": True}
        new_user_dashboard = dashboard_engine.get_adaptive_dashboard(new_user_context)
        assert new_user_dashboard["id"] == "adaptive_dashboard_new_user"
        assert any(w["id"] == "onboarding_prompt" for w in new_user_dashboard["props"]["widgets"])
        
        # Usuário sobrecarregado
        overwhelmed_context = {"is_overwhelmed": True}
        overwhelmed_dashboard = dashboard_engine.get_adaptive_dashboard(overwhelmed_context)
        assert overwhelmed_dashboard["id"] == "adaptive_dashboard_overwhelmed"
        assert any(w["id"] == "suggested_action_card" for w in overwhelmed_dashboard["props"]["widgets"])
        
        # Usuário regular
        regular_context = {"is_new_user": False, "is_overwhelmed": False}
        regular_dashboard = dashboard_engine.get_adaptive_dashboard(regular_context)
        assert regular_dashboard["id"] == "main_dashboard"

    def test_navigation_engine(self):
        nav_engine = NavigationEngine()
        
        # Menu para novo usuário
        new_user_menu = nav_engine.get_navigation_menu({"onboarding_completed": False})
        assert any(item["label"] == "Bem-vindo" for item in new_user_menu)
        
        # Menu para usuário com onboarding completo
        regular_user_menu = nav_engine.get_navigation_menu({"onboarding_completed": True})
        assert any(item["label"] == "Dashboard" for item in regular_user_menu)
        assert any(item["label"] == "Minhas Missões" for item in regular_user_menu)

    def test_accessibility_manager(self):
        acc_manager = AccessibilityManager()
        
        # Testar atualização de configuração
        assert acc_manager.get_current_settings()["high_contrast_mode"] is False
        acc_manager.update_setting("high_contrast_mode", True)
        assert acc_manager.get_current_settings()["high_contrast_mode"] is True
        
        # Testar configuração inexistente
        assert acc_manager.update_setting("non_existent", True) is False
