from typing import List, Dict, Any, Optional
from ..design_system.components import OnboardingStep, Button, Typography

class OnboardingEngine:
    def __init__(self):
        self.onboarding_steps: List[OnboardingStep] = [
            OnboardingStep(
                id="welcome",
                title="Bem-vindo ao LifeOS!",
                description="Seu copiloto de vida pessoal. O LifeOS aprende com você para otimizar sua rotina, alcançar seus objetivos e simplificar suas decisões.",
                image_url="/assets/onboarding/welcome.png"
            ),
            OnboardingStep(
                id="how_it_works",
                title="Como o LifeOS Funciona",
                description="Nós integramos seus dados de vida (agenda, saúde, finanças) para entender seus padrões, prever o futuro e sugerir as melhores ações. Tudo isso de forma privada e segura.",
                image_url="/assets/onboarding/how_it_works.png"
            ),
            OnboardingStep(
                id="what_it_does",
                title="O que o LifeOS fará por você",
                description="O LifeOS vai te ajudar a gerenciar missões, identificar riscos e oportunidades, e te dar um Companion inteligente que te conhece profundamente. Sem linguagem técnica, apenas resultados.",
                image_url="/assets/onboarding/what_it_does.png"
            ),
            OnboardingStep(
                id="personal_dna",
                title="Seu DNA Pessoal",
                description="Começaremos criando seu Personal DNA: seus valores, objetivos e preferências. Isso nos ajuda a personalizar sua experiência desde o primeiro dia.",
                image_url="/assets/onboarding/personal_dna.png"
            ),
            OnboardingStep(
                id="ready",
                title="Pronto para Começar?",
                description="Vamos configurar suas primeiras missões e ver o LifeOS em ação. Você está no controle, e nós estamos aqui para te apoiar.",
                image_url="/assets/onboarding/ready.png"
            )
        ]
        self.current_step_index = 0

    def get_current_step(self) -> Optional[Dict[str, Any]]:
        if self.current_step_index < len(self.onboarding_steps):
            step = self.onboarding_steps[self.current_step_index]
            return {
                "step_data": step.render(),
                "controls": [
                    Button(id="prev_step", label="Anterior", variant="secondary", disabled=(self.current_step_index == 0)).render(),
                    Button(id="next_step", label="Próximo", variant="primary", disabled=(self.current_step_index == len(self.onboarding_steps) - 1)).render(),
                    Button(id="start_lifeos", label="Começar LifeOS", variant="primary", disabled=(self.current_step_index != len(self.onboarding_steps) - 1)).render()
                ]
            }
        return None

    def next_step(self) -> Optional[Dict[str, Any]]:
        if self.current_step_index < len(self.onboarding_steps) - 1:
            self.current_step_index += 1
        return self.get_current_step()

    def prev_step(self) -> Optional[Dict[str, Any]]:
        if self.current_step_index > 0:
            self.current_step_index -= 1
        return self.get_current_step()

    def reset_onboarding(self):
        self.current_step_index = 0

    def get_onboarding_flow(self) -> List[Dict[str, Any]]:
        """
        Retorna todos os passos do onboarding para renderização.
        """
        flow = []
        for i, step in enumerate(self.onboarding_steps):
            flow.append({
                "step_data": step.render(),
                "controls": [
                    Button(id=f"prev_step_{i}", label="Anterior", variant="secondary", disabled=(i == 0)).render(),
                    Button(id=f"next_step_{i}", label="Próximo", variant="primary", disabled=(i == len(self.onboarding_steps) - 1)).render(),
                    Button(id="start_lifeos", label="Começar LifeOS", variant="primary", disabled=(i != len(self.onboarding_steps) - 1)).render()
                ]
            })
        return flow


class SmartOnboarding:
    def __init__(self, user_id: str, onboarding_engine: OnboardingEngine):
        self.user_id = user_id
        self.onboarding_engine = onboarding_engine
        self.onboarding_status = self._load_onboarding_status() # Simula persistência

    def _load_onboarding_status(self) -> Dict[str, Any]:
        # Em um sistema real, isso carregaria do banco de dados do usuário
        return {"completed": False, "last_step": 0}

    def _save_onboarding_status(self):
        # Em um sistema real, isso salvaria no banco de dados do usuário
        pass

    def is_onboarding_completed(self) -> bool:
        return self.onboarding_status["completed"]

    def start_onboarding(self) -> Dict[str, Any]:
        self.onboarding_engine.reset_onboarding()
        return self.onboarding_engine.get_current_step()

    def advance_onboarding(self) -> Dict[str, Any]:
        step_info = self.onboarding_engine.next_step()
        if not step_info:
            self.onboarding_status["completed"] = True
            self._save_onboarding_status()
            return {"status": "completed", "message": "Onboarding concluído!"}
        return step_info

    def go_back_onboarding(self) -> Dict[str, Any]:
        step_info = self.onboarding_engine.prev_step()
        if not step_info:
            return self.onboarding_engine.get_current_step() # Retorna o primeiro passo se já estiver no início
        return step_info

    def complete_onboarding(self) -> Dict[str, Any]:
        self.onboarding_status["completed"] = True
        self._save_onboarding_status()
        return {"status": "completed", "message": "Onboarding concluído!"}

    def get_onboarding_progress(self) -> Dict[str, Any]:
        total_steps = len(self.onboarding_engine.onboarding_steps)
        current_step = self.onboarding_engine.current_step_index + 1
        return {"current_step": current_step, "total_steps": total_steps, "progress_percent": (current_step / total_steps) * 100}
