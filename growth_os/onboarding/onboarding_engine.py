"""
Onboarding Engine
=================
Sistema de onboarding inteligente e adaptativo da LifeOS.

O onboarding se adapta ao perfil do usuário identificado
nas primeiras interações, apresentando:
- Fluxo personalizado por perfil
- Perguntas de qualificação progressivas
- Conteúdo contextual por objetivo
- Intervenções automáticas para usuários travados

Perfis Suportados:
    Professional | Student | Entrepreneur | Wellness | Creative

Fluxo Base (5 etapas):
    1. Boas-vindas e identificação de objetivo
    2. Perguntas de qualificação do perfil
    3. Configuração inicial personalizada
    4. Primeira ação guiada (quick win)
    5. Ativação completa e próximos passos
"""

from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

from ..models.user_journey import UserProfile
from .profile_detector import ProfileDetector


class OnboardingStepType(str, Enum):
    """Tipos de etapas do onboarding."""

    WELCOME = "welcome"
    QUALIFICATION = "qualification"
    PROFILE_SETUP = "profile_setup"
    QUICK_WIN = "quick_win"
    FEATURE_INTRO = "feature_intro"
    COMPLETION = "completion"


@dataclass
class OnboardingQuestion:
    """Pergunta de qualificação do onboarding."""

    question_id: str
    text: str
    options: List[Dict[str, str]]
    """Lista de {value, label, profile_hint}"""
    is_required: bool = True
    answered: bool = False
    answer: str = ""
    answered_at: Optional[datetime] = None

    def answer_question(self, value: str) -> None:
        self.answer = value
        self.answered = True
        self.answered_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "question_id": self.question_id,
            "text": self.text,
            "options": self.options,
            "is_required": self.is_required,
            "answered": self.answered,
            "answer": self.answer,
        }


@dataclass
class OnboardingStep:
    """Etapa do fluxo de onboarding."""

    step_id: str
    step_number: int
    step_type: OnboardingStepType
    title: str
    description: str
    cta_text: str = "Continuar"
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    skippable: bool = False
    questions: List[OnboardingQuestion] = field(default_factory=list)
    content: Dict[str, Any] = field(default_factory=dict)

    def complete(self) -> None:
        self.is_completed = True
        self.completed_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_id": self.step_id,
            "step_number": self.step_number,
            "step_type": self.step_type.value,
            "title": self.title,
            "description": self.description,
            "cta_text": self.cta_text,
            "is_completed": self.is_completed,
            "skippable": self.skippable,
            "questions": [q.to_dict() for q in self.questions],
            "content": self.content,
        }


@dataclass
class OnboardingFlow:
    """
    Fluxo de onboarding completo de um usuário.

    Adaptado ao perfil identificado durante a qualificação.
    """

    user_id: str
    profile: UserProfile = UserProfile.UNKNOWN
    steps: List[OnboardingStep] = field(default_factory=list)
    current_step_index: int = 0
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    abandoned_at: Optional[datetime] = None
    is_personalized: bool = False
    """True quando o fluxo foi adaptado ao perfil identificado."""

    @property
    def current_step(self) -> Optional[OnboardingStep]:
        if self.current_step_index < len(self.steps):
            return self.steps[self.current_step_index]
        return None

    @property
    def progress_pct(self) -> float:
        if not self.steps:
            return 0.0
        completed = sum(1 for s in self.steps if s.is_completed)
        return completed / len(self.steps) * 100

    @property
    def is_completed(self) -> bool:
        return all(s.is_completed for s in self.steps if not s.skippable)

    @property
    def time_in_onboarding_minutes(self) -> float:
        end = self.completed_at or datetime.utcnow()
        return (end - self.started_at).total_seconds() / 60

    def advance(self) -> Optional[OnboardingStep]:
        """Avança para a próxima etapa."""
        if self.current_step:
            self.current_step.complete()

        self.current_step_index += 1

        if self.is_completed and not self.completed_at:
            self.completed_at = datetime.utcnow()

        return self.current_step

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "profile": self.profile.value,
            "current_step": self.current_step.to_dict() if self.current_step else None,
            "current_step_index": self.current_step_index,
            "total_steps": len(self.steps),
            "progress_pct": round(self.progress_pct, 1),
            "is_completed": self.is_completed,
            "is_personalized": self.is_personalized,
            "time_in_onboarding_minutes": round(self.time_in_onboarding_minutes, 1),
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "steps": [s.to_dict() for s in self.steps],
        }


class OnboardingEngine:
    """
    Motor de onboarding inteligente da LifeOS.

    Cria e gerencia fluxos de onboarding personalizados,
    adaptando o conteúdo ao perfil identificado do usuário.
    """

    def __init__(self, profile_detector: Optional[ProfileDetector] = None):
        self._profile_detector = profile_detector or ProfileDetector()
        self._flows: Dict[str, OnboardingFlow] = {}
        self._completion_events: List[Dict[str, Any]] = []

    def start_onboarding(self, user_id: str) -> OnboardingFlow:
        """
        Inicia o onboarding para um novo usuário.

        Começa com o fluxo genérico e adapta após qualificação.
        """
        flow = OnboardingFlow(user_id=user_id)
        flow.steps = self._create_generic_flow()
        self._flows[user_id] = flow
        return flow

    def answer_question(
        self,
        user_id: str,
        question_id: str,
        answer: str,
    ) -> Dict[str, Any]:
        """
        Registra a resposta de uma pergunta de qualificação.

        Após responder perguntas suficientes, adapta o fluxo
        ao perfil identificado.
        """
        flow = self._flows.get(user_id)
        if not flow:
            return {"error": "Flow not found"}

        # Encontra e responde a pergunta
        for step in flow.steps:
            for question in step.questions:
                if question.question_id == question_id:
                    question.answer_question(answer)
                    break

        # Coleta todas as respostas para detecção de perfil
        all_answers = self._collect_answers(flow)
        detected_profile = self._profile_detector.detect(all_answers)

        result = {
            "question_id": question_id,
            "answer": answer,
            "detected_profile": detected_profile.value,
            "profile_confidence": self._profile_detector.get_confidence(all_answers, detected_profile),
        }

        # Personaliza o fluxo se o perfil foi identificado com confiança
        if (
            detected_profile != UserProfile.UNKNOWN
            and not flow.is_personalized
            and result["profile_confidence"] >= 0.6
        ):
            self._personalize_flow(flow, detected_profile)
            result["flow_personalized"] = True
            result["new_profile"] = detected_profile.value

        return result

    def advance_step(self, user_id: str) -> Dict[str, Any]:
        """Avança o usuário para a próxima etapa do onboarding."""
        flow = self._flows.get(user_id)
        if not flow:
            return {"error": "Flow not found"}

        previous_step = flow.current_step
        next_step = flow.advance()

        result = {
            "completed_step": previous_step.step_id if previous_step else None,
            "next_step": next_step.to_dict() if next_step else None,
            "progress_pct": flow.progress_pct,
            "is_completed": flow.is_completed,
        }

        if flow.is_completed:
            self._record_completion(flow)
            result["completion_time_minutes"] = flow.time_in_onboarding_minutes

        return result

    def get_flow(self, user_id: str) -> Optional[OnboardingFlow]:
        """Retorna o fluxo de onboarding do usuário."""
        return self._flows.get(user_id)

    def get_onboarding_metrics(self) -> Dict[str, Any]:
        """Métricas do sistema de onboarding."""
        total = len(self._flows)
        if total == 0:
            return {"total_users": 0}

        completed = sum(1 for f in self._flows.values() if f.is_completed)
        personalized = sum(1 for f in self._flows.values() if f.is_personalized)

        completion_times = [
            f.time_in_onboarding_minutes
            for f in self._flows.values()
            if f.is_completed
        ]

        by_profile = {}
        for flow in self._flows.values():
            profile = flow.profile.value
            by_profile[profile] = by_profile.get(profile, 0) + 1

        return {
            "total_users": total,
            "completed": completed,
            "completion_rate_pct": round(completed / total * 100, 2),
            "personalized_flows": personalized,
            "personalization_rate_pct": round(personalized / total * 100, 2),
            "avg_completion_time_minutes": round(
                sum(completion_times) / len(completion_times), 2
            ) if completion_times else 0.0,
            "by_profile": by_profile,
        }

    def _create_generic_flow(self) -> List[OnboardingStep]:
        """Cria o fluxo genérico inicial de onboarding."""
        return [
            OnboardingStep(
                step_id="welcome",
                step_number=1,
                step_type=OnboardingStepType.WELCOME,
                title="Bem-vindo ao LifeOS",
                description="O sistema operacional da sua vida. Vamos personalizar sua experiência.",
                cta_text="Começar",
                content={
                    "headline": "Transforme sua vida com IA",
                    "subheadline": "O LifeOS aprende com você e se adapta aos seus objetivos",
                    "features": ["Metas inteligentes", "Hábitos poderosos", "Decisões melhores"],
                },
            ),
            OnboardingStep(
                step_id="qualification",
                step_number=2,
                step_type=OnboardingStepType.QUALIFICATION,
                title="Conte-nos sobre você",
                description="Suas respostas nos ajudam a personalizar o LifeOS para você.",
                cta_text="Próximo",
                questions=[
                    OnboardingQuestion(
                        question_id="main_goal",
                        text="Qual é seu principal objetivo com o LifeOS?",
                        options=[
                            {"value": "career", "label": "Avançar na carreira", "profile_hint": "professional"},
                            {"value": "study", "label": "Melhorar meus estudos", "profile_hint": "student"},
                            {"value": "business", "label": "Fazer meu negócio crescer", "profile_hint": "entrepreneur"},
                            {"value": "health", "label": "Melhorar minha saúde e bem-estar", "profile_hint": "wellness"},
                            {"value": "creative", "label": "Desenvolver projetos criativos", "profile_hint": "creative"},
                        ],
                    ),
                    OnboardingQuestion(
                        question_id="biggest_challenge",
                        text="Qual é seu maior desafio hoje?",
                        options=[
                            {"value": "focus", "label": "Manter o foco", "profile_hint": "professional"},
                            {"value": "time", "label": "Gerenciar o tempo", "profile_hint": "student"},
                            {"value": "priorities", "label": "Definir prioridades", "profile_hint": "entrepreneur"},
                            {"value": "consistency", "label": "Ser consistente", "profile_hint": "wellness"},
                            {"value": "motivation", "label": "Manter a motivação", "profile_hint": "creative"},
                        ],
                    ),
                ],
            ),
            OnboardingStep(
                step_id="profile_setup",
                step_number=3,
                step_type=OnboardingStepType.PROFILE_SETUP,
                title="Configure seu perfil",
                description="Adicione informações básicas para personalizar sua experiência.",
                cta_text="Salvar Perfil",
            ),
            OnboardingStep(
                step_id="quick_win",
                step_number=4,
                step_type=OnboardingStepType.QUICK_WIN,
                title="Sua primeira conquista",
                description="Crie sua primeira meta e experimente o poder do LifeOS.",
                cta_text="Criar Minha Primeira Meta",
                content={
                    "action": "create_first_goal",
                    "reward": "Você ganhará seu primeiro badge ao completar!",
                },
            ),
            OnboardingStep(
                step_id="completion",
                step_number=5,
                step_type=OnboardingStepType.COMPLETION,
                title="Você está pronto!",
                description="Seu LifeOS está configurado. Vamos começar sua jornada.",
                cta_text="Ir para o Dashboard",
                content={
                    "celebration": True,
                    "next_steps": [
                        "Explore o Dashboard",
                        "Configure notificações",
                        "Convide um amigo",
                    ],
                },
            ),
        ]

    def _personalize_flow(self, flow: OnboardingFlow, profile: UserProfile) -> None:
        """Adapta o fluxo ao perfil identificado."""
        flow.profile = profile
        flow.is_personalized = True

        # Personaliza o quick win baseado no perfil
        quick_win_step = next((s for s in flow.steps if s.step_id == "quick_win"), None)
        if quick_win_step:
            personalized_content = {
                UserProfile.PROFESSIONAL: {
                    "title": "Crie sua primeira meta de carreira",
                    "description": "Defina um objetivo profissional claro e mensurável.",
                    "action": "create_career_goal",
                    "example": "Ex: Conseguir uma promoção em 6 meses",
                },
                UserProfile.STUDENT: {
                    "title": "Monte seu plano de estudos",
                    "description": "Organize suas matérias e defina metas de aprendizado.",
                    "action": "create_study_plan",
                    "example": "Ex: Estudar 2 horas por dia durante a semana",
                },
                UserProfile.ENTREPRENEUR: {
                    "title": "Crie seu primeiro projeto",
                    "description": "Defina seu projeto e os 3 principais milestones.",
                    "action": "create_project",
                    "example": "Ex: Lançar MVP em 3 meses",
                },
                UserProfile.WELLNESS: {
                    "title": "Crie seu primeiro hábito",
                    "description": "Defina um hábito saudável que você quer desenvolver.",
                    "action": "create_habit",
                    "example": "Ex: Meditar 10 minutos toda manhã",
                },
                UserProfile.CREATIVE: {
                    "title": "Inicie seu projeto criativo",
                    "description": "Defina seu projeto e a primeira entrega.",
                    "action": "create_creative_project",
                    "example": "Ex: Escrever um capítulo por semana",
                },
            }.get(profile, {})

            if personalized_content:
                quick_win_step.title = personalized_content.get("title", quick_win_step.title)
                quick_win_step.description = personalized_content.get("description", quick_win_step.description)
                quick_win_step.content.update(personalized_content)

    def _collect_answers(self, flow: OnboardingFlow) -> Dict[str, str]:
        """Coleta todas as respostas de qualificação do fluxo."""
        answers = {}
        for step in flow.steps:
            for question in step.questions:
                if question.answered:
                    answers[question.question_id] = question.answer
        return answers

    def _record_completion(self, flow: OnboardingFlow) -> None:
        """Registra a conclusão do onboarding."""
        self._completion_events.append({
            "user_id": flow.user_id,
            "profile": flow.profile.value,
            "completed_at": flow.completed_at.isoformat() if flow.completed_at else None,
            "time_minutes": flow.time_in_onboarding_minutes,
            "personalized": flow.is_personalized,
        })
