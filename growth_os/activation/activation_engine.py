"""
Activation Engine
=================
Motor de ativação do Growth OS da LifeOS.

Responsável por:
- Definir e detectar o "Aha Moment" de cada perfil de usuário
- Rastrear o progresso de ativação
- Identificar usuários travados no onboarding
- Acionar intervenções automáticas para aumentar ativação

Aha Moments por Perfil:
    Professional:   Criar primeira meta de carreira + 3 check-ins
    Student:        Criar plano de estudos + completar primeira sessão
    Entrepreneur:   Criar projeto + definir 3 milestones
    Wellness:       Criar hábito + completar 3 dias consecutivos
    Creative:       Criar projeto criativo + primeira entrega
"""

from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

from ..models.funnel import FunnelStage, FunnelEventType
from ..models.user_journey import UserJourney, UserProfile


class ActivationStatus(str, Enum):
    """Status de ativação de um usuário."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    AHA_MOMENT_REACHED = "aha_moment_reached"
    FULLY_ACTIVATED = "fully_activated"
    STALLED = "stalled"
    """Usuário parou de progredir na ativação."""


@dataclass
class ActivationStep:
    """Passo do processo de ativação."""

    step_id: str
    name: str
    description: str
    is_required: bool = True
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    weight: float = 1.0
    """Peso na pontuação de ativação (0.0 a 1.0)."""

    def complete(self) -> None:
        self.is_completed = True
        self.completed_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_id": self.step_id,
            "name": self.name,
            "description": self.description,
            "is_required": self.is_required,
            "is_completed": self.is_completed,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "weight": self.weight,
        }


@dataclass
class ActivationChecklist:
    """
    Checklist de ativação personalizado por perfil de usuário.

    Define os passos necessários para o usuário atingir
    o Aha Moment e ser considerado ativado.
    """

    user_id: str
    profile: UserProfile
    steps: List[ActivationStep] = field(default_factory=list)
    aha_moment_step_id: str = ""
    """ID do passo que representa o Aha Moment."""
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    aha_reached_at: Optional[datetime] = None

    @property
    def completion_score(self) -> float:
        """Score de completude (0.0 a 1.0)."""
        if not self.steps:
            return 0.0
        total_weight = sum(s.weight for s in self.steps)
        completed_weight = sum(s.weight for s in self.steps if s.is_completed)
        return completed_weight / total_weight if total_weight > 0 else 0.0

    @property
    def is_aha_moment_reached(self) -> bool:
        """Verifica se o Aha Moment foi atingido."""
        if not self.aha_moment_step_id:
            return self.completion_score >= 0.5
        aha_step = next((s for s in self.steps if s.step_id == self.aha_moment_step_id), None)
        return aha_step.is_completed if aha_step else False

    @property
    def is_fully_activated(self) -> bool:
        """Verifica se todos os passos obrigatórios foram completados."""
        return all(s.is_completed for s in self.steps if s.is_required)

    @property
    def next_step(self) -> Optional[ActivationStep]:
        """Retorna o próximo passo não completado."""
        return next((s for s in self.steps if not s.is_completed), None)

    @property
    def completed_steps_count(self) -> int:
        return sum(1 for s in self.steps if s.is_completed)

    def complete_step(self, step_id: str) -> Optional[ActivationStep]:
        """Marca um passo como completado."""
        step = next((s for s in self.steps if s.step_id == step_id), None)
        if step and not step.is_completed:
            step.complete()
            if self.is_aha_moment_reached and not self.aha_reached_at:
                self.aha_reached_at = datetime.utcnow()
            if self.is_fully_activated and not self.completed_at:
                self.completed_at = datetime.utcnow()
            return step
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "profile": self.profile.value,
            "completion_score_pct": round(self.completion_score * 100, 1),
            "aha_moment_reached": self.is_aha_moment_reached,
            "fully_activated": self.is_fully_activated,
            "completed_steps": self.completed_steps_count,
            "total_steps": len(self.steps),
            "next_step": self.next_step.to_dict() if self.next_step else None,
            "started_at": self.started_at.isoformat(),
            "aha_reached_at": self.aha_reached_at.isoformat() if self.aha_reached_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "steps": [s.to_dict() for s in self.steps],
        }


class ActivationEngine:
    """
    Motor de ativação da LifeOS.

    Cria checklists personalizados por perfil, rastreia progresso
    e detecta o Aha Moment de cada usuário.
    """

    # Templates de ativação por perfil
    ACTIVATION_TEMPLATES: Dict[UserProfile, List[Dict[str, Any]]] = {
        UserProfile.PROFESSIONAL: [
            {"step_id": "profile_setup", "name": "Configurar Perfil", "description": "Complete seu perfil profissional", "weight": 0.1, "is_required": True},
            {"step_id": "first_goal", "name": "Criar Primeira Meta", "description": "Defina sua primeira meta de carreira", "weight": 0.2, "is_required": True},
            {"step_id": "connect_calendar", "name": "Conectar Calendário", "description": "Sincronize seu calendário para planejamento", "weight": 0.15, "is_required": False},
            {"step_id": "first_checkin", "name": "Primeiro Check-in", "description": "Registre seu primeiro check-in diário", "weight": 0.2, "is_required": True},
            {"step_id": "three_checkins", "name": "3 Check-ins Consecutivos", "description": "Complete 3 check-ins em dias seguidos", "weight": 0.25, "is_required": True},
            {"step_id": "invite_team", "name": "Convidar Colega", "description": "Compartilhe o LifeOS com um colega", "weight": 0.1, "is_required": False},
        ],
        UserProfile.STUDENT: [
            {"step_id": "profile_setup", "name": "Configurar Perfil", "description": "Complete seu perfil de estudante", "weight": 0.1, "is_required": True},
            {"step_id": "study_plan", "name": "Criar Plano de Estudos", "description": "Monte seu plano de estudos personalizado", "weight": 0.25, "is_required": True},
            {"step_id": "first_session", "name": "Primeira Sessão de Estudo", "description": "Complete sua primeira sessão de estudo", "weight": 0.25, "is_required": True},
            {"step_id": "first_goal", "name": "Definir Meta Acadêmica", "description": "Crie sua primeira meta acadêmica", "weight": 0.2, "is_required": True},
            {"step_id": "pomodoro", "name": "Usar Pomodoro", "description": "Complete uma sessão com o timer Pomodoro", "weight": 0.1, "is_required": False},
            {"step_id": "streak_3", "name": "Sequência de 3 Dias", "description": "Estude por 3 dias consecutivos", "weight": 0.1, "is_required": False},
        ],
        UserProfile.ENTREPRENEUR: [
            {"step_id": "profile_setup", "name": "Configurar Perfil", "description": "Complete seu perfil empreendedor", "weight": 0.1, "is_required": True},
            {"step_id": "create_project", "name": "Criar Projeto", "description": "Crie seu primeiro projeto no LifeOS", "weight": 0.2, "is_required": True},
            {"step_id": "define_milestones", "name": "Definir 3 Milestones", "description": "Defina os 3 principais marcos do projeto", "weight": 0.25, "is_required": True},
            {"step_id": "first_task", "name": "Primeira Tarefa Concluída", "description": "Complete a primeira tarefa do projeto", "weight": 0.2, "is_required": True},
            {"step_id": "connect_team", "name": "Convidar Sócio/Equipe", "description": "Adicione membros ao seu projeto", "weight": 0.15, "is_required": False},
            {"step_id": "weekly_review", "name": "Primeira Revisão Semanal", "description": "Complete sua primeira revisão semanal", "weight": 0.1, "is_required": False},
        ],
        UserProfile.WELLNESS: [
            {"step_id": "profile_setup", "name": "Configurar Perfil", "description": "Complete seu perfil de bem-estar", "weight": 0.1, "is_required": True},
            {"step_id": "create_habit", "name": "Criar Primeiro Hábito", "description": "Defina seu primeiro hábito saudável", "weight": 0.25, "is_required": True},
            {"step_id": "first_checkin", "name": "Primeiro Check-in de Hábito", "description": "Registre seu primeiro check-in de hábito", "weight": 0.2, "is_required": True},
            {"step_id": "streak_3", "name": "Sequência de 3 Dias", "description": "Mantenha o hábito por 3 dias consecutivos", "weight": 0.25, "is_required": True},
            {"step_id": "wellness_goal", "name": "Meta de Bem-estar", "description": "Defina uma meta de saúde ou bem-estar", "weight": 0.1, "is_required": False},
            {"step_id": "mood_tracking", "name": "Registrar Humor", "description": "Use o rastreamento de humor por 3 dias", "weight": 0.1, "is_required": False},
        ],
        UserProfile.CREATIVE: [
            {"step_id": "profile_setup", "name": "Configurar Perfil", "description": "Complete seu perfil criativo", "weight": 0.1, "is_required": True},
            {"step_id": "create_project", "name": "Criar Projeto Criativo", "description": "Crie seu primeiro projeto criativo", "weight": 0.25, "is_required": True},
            {"step_id": "first_entry", "name": "Primeira Entrada", "description": "Registre sua primeira ideia ou progresso", "weight": 0.2, "is_required": True},
            {"step_id": "first_delivery", "name": "Primeira Entrega", "description": "Complete e entregue uma parte do projeto", "weight": 0.25, "is_required": True},
            {"step_id": "share_work", "name": "Compartilhar Trabalho", "description": "Compartilhe seu progresso com alguém", "weight": 0.1, "is_required": False},
            {"step_id": "streak_3", "name": "3 Dias Criando", "description": "Trabalhe no projeto por 3 dias seguidos", "weight": 0.1, "is_required": False},
        ],
        UserProfile.UNKNOWN: [
            {"step_id": "profile_setup", "name": "Configurar Perfil", "description": "Complete seu perfil para personalizar o LifeOS", "weight": 0.2, "is_required": True},
            {"step_id": "first_goal", "name": "Criar Primeira Meta", "description": "Defina sua primeira meta no LifeOS", "weight": 0.3, "is_required": True},
            {"step_id": "first_checkin", "name": "Primeiro Check-in", "description": "Registre seu primeiro check-in", "weight": 0.3, "is_required": True},
            {"step_id": "explore_features", "name": "Explorar Funcionalidades", "description": "Explore pelo menos 3 funcionalidades do LifeOS", "weight": 0.2, "is_required": False},
        ],
    }

    # Aha Moment por perfil (step_id que representa o momento)
    AHA_MOMENTS: Dict[UserProfile, str] = {
        UserProfile.PROFESSIONAL: "three_checkins",
        UserProfile.STUDENT: "first_session",
        UserProfile.ENTREPRENEUR: "define_milestones",
        UserProfile.WELLNESS: "streak_3",
        UserProfile.CREATIVE: "first_delivery",
        UserProfile.UNKNOWN: "first_checkin",
    }

    def __init__(self):
        self._checklists: Dict[str, ActivationChecklist] = {}
        """user_id → ActivationChecklist"""
        self._activation_events: List[Dict[str, Any]] = []

    def create_checklist(
        self,
        user_id: str,
        profile: UserProfile = UserProfile.UNKNOWN,
    ) -> ActivationChecklist:
        """
        Cria um checklist de ativação personalizado para o usuário.

        O checklist é adaptado ao perfil identificado durante o onboarding.
        """
        template = self.ACTIVATION_TEMPLATES.get(profile, self.ACTIVATION_TEMPLATES[UserProfile.UNKNOWN])
        aha_step_id = self.AHA_MOMENTS.get(profile, "first_checkin")

        steps = [ActivationStep(**step_data) for step_data in template]

        checklist = ActivationChecklist(
            user_id=user_id,
            profile=profile,
            steps=steps,
            aha_moment_step_id=aha_step_id,
        )

        self._checklists[user_id] = checklist
        return checklist

    def record_action(
        self,
        user_id: str,
        action: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Registra uma ação do usuário e atualiza o checklist.

        Mapeia ações do produto para passos do checklist de ativação.
        """
        checklist = self._checklists.get(user_id)
        if not checklist:
            return {"error": "No checklist found for user"}

        # Mapeia ação para step_id
        step_id = self._map_action_to_step(action, properties or {})
        completed_step = None

        if step_id:
            completed_step = checklist.complete_step(step_id)

        event = {
            "user_id": user_id,
            "action": action,
            "step_id": step_id,
            "step_completed": completed_step is not None,
            "timestamp": datetime.utcnow().isoformat(),
            "checklist_score": checklist.completion_score,
            "aha_reached": checklist.is_aha_moment_reached,
            "fully_activated": checklist.is_fully_activated,
        }

        self._activation_events.append(event)
        return event

    def get_activation_status(self, user_id: str) -> ActivationStatus:
        """Retorna o status de ativação atual do usuário."""
        checklist = self._checklists.get(user_id)
        if not checklist:
            return ActivationStatus.NOT_STARTED

        if checklist.is_fully_activated:
            return ActivationStatus.FULLY_ACTIVATED

        if checklist.is_aha_moment_reached:
            return ActivationStatus.AHA_MOMENT_REACHED

        if checklist.completed_steps_count > 0:
            # Verifica se está travado (sem progresso há 3+ dias)
            last_completion = max(
                (s.completed_at for s in checklist.steps if s.completed_at),
                default=checklist.started_at,
            )
            if (datetime.utcnow() - last_completion).days >= 3:
                return ActivationStatus.STALLED
            return ActivationStatus.IN_PROGRESS

        return ActivationStatus.NOT_STARTED

    def get_checklist(self, user_id: str) -> Optional[ActivationChecklist]:
        """Retorna o checklist de ativação do usuário."""
        return self._checklists.get(user_id)

    def get_stalled_users(self, stall_days: int = 3) -> List[str]:
        """
        Retorna lista de usuários travados na ativação.

        Usuários que iniciaram mas não progrediram há `stall_days` dias.
        """
        stalled = []
        cutoff = datetime.utcnow() - timedelta(days=stall_days)

        for user_id, checklist in self._checklists.items():
            if checklist.is_fully_activated or checklist.is_aha_moment_reached:
                continue

            last_activity = max(
                (s.completed_at for s in checklist.steps if s.completed_at),
                default=checklist.started_at,
            )

            if last_activity < cutoff:
                stalled.append(user_id)

        return stalled

    def get_activation_metrics(self) -> Dict[str, Any]:
        """Métricas gerais de ativação."""
        total = len(self._checklists)
        if total == 0:
            return {"total_users": 0}

        by_status = {status.value: 0 for status in ActivationStatus}
        for user_id in self._checklists:
            status = self.get_activation_status(user_id)
            by_status[status.value] += 1

        avg_score = sum(c.completion_score for c in self._checklists.values()) / total

        aha_reached = sum(
            1 for c in self._checklists.values()
            if c.is_aha_moment_reached
        )

        return {
            "total_users": total,
            "by_status": by_status,
            "aha_moment_rate_pct": round(aha_reached / total * 100, 2),
            "full_activation_rate_pct": round(by_status[ActivationStatus.FULLY_ACTIVATED.value] / total * 100, 2),
            "avg_completion_score_pct": round(avg_score * 100, 2),
            "stalled_users": len(self.get_stalled_users()),
        }

    def _map_action_to_step(
        self, action: str, properties: Dict[str, Any]
    ) -> Optional[str]:
        """Mapeia uma ação do produto para um step_id do checklist."""
        action_map = {
            "profile_completed": "profile_setup",
            "goal_created": "first_goal",
            "calendar_connected": "connect_calendar",
            "checkin_completed": "first_checkin",
            "streak_3_achieved": "streak_3",
            "friend_invited": "invite_team",
            "study_plan_created": "study_plan",
            "study_session_completed": "first_session",
            "pomodoro_completed": "pomodoro",
            "project_created": "create_project",
            "milestones_defined": "define_milestones",
            "task_completed": "first_task",
            "team_member_invited": "connect_team",
            "weekly_review_completed": "weekly_review",
            "habit_created": "create_habit",
            "wellness_goal_created": "wellness_goal",
            "mood_tracked": "mood_tracking",
            "creative_entry_added": "first_entry",
            "delivery_completed": "first_delivery",
            "work_shared": "share_work",
            "features_explored": "explore_features",
        }
        return action_map.get(action)
