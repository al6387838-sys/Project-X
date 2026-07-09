"""
LearningProfile — Perfil de Aprendizado do Usuário
===================================================
Agrega todo o conhecimento aprendido sobre o usuário.
É o "cérebro" do LifeOS — o que ele sabe sobre você.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import time
import uuid


@dataclass
class LearningScore:
    """
    Pontuação de aprendizado do LifeOS.

    Representa o quanto o sistema já aprendeu sobre o usuário,
    em diferentes dimensões. Evolui com o tempo e uso.
    """
    score_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    computed_at: float = field(default_factory=time.time)

    # Scores por dimensão (0.0 a 100.0)
    overall: float = 0.0             # Score geral de aprendizado
    preferences: float = 0.0        # Aprendizado de preferências
    routines: float = 0.0           # Aprendizado de rotinas
    schedules: float = 0.0          # Aprendizado de horários
    priorities: float = 0.0         # Aprendizado de prioridades
    goals: float = 0.0              # Aprendizado de objetivos
    habits: float = 0.0             # Aprendizado de hábitos
    communication: float = 0.0      # Aprendizado de estilo de comunicação
    tone: float = 0.0               # Aprendizado de tom preferido

    # Metadados do score
    total_events_processed: int = 0
    total_patterns_detected: int = 0
    total_preferences_learned: int = 0
    days_of_learning: int = 0

    def compute_overall(self) -> float:
        """Calcula o score geral como média ponderada das dimensões."""
        weights = {
            "preferences": 0.20,
            "routines": 0.15,
            "schedules": 0.10,
            "priorities": 0.15,
            "goals": 0.15,
            "habits": 0.10,
            "communication": 0.10,
            "tone": 0.05,
        }
        total = sum(
            getattr(self, dim) * w
            for dim, w in weights.items()
        )
        self.overall = round(total, 2)
        return self.overall

    def level(self) -> str:
        """Retorna o nível de aprendizado em linguagem humana."""
        if self.overall >= 80:
            return "Especialista — O LifeOS te conhece muito bem"
        elif self.overall >= 60:
            return "Avançado — O LifeOS tem um bom modelo de você"
        elif self.overall >= 40:
            return "Intermediário — O LifeOS está aprendendo sobre você"
        elif self.overall >= 20:
            return "Iniciante — O LifeOS está começando a te conhecer"
        return "Novo — O LifeOS ainda está aprendendo"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall": self.overall,
            "level": self.level(),
            "dimensions": {
                "preferences": self.preferences,
                "routines": self.routines,
                "schedules": self.schedules,
                "priorities": self.priorities,
                "goals": self.goals,
                "habits": self.habits,
                "communication": self.communication,
                "tone": self.tone,
            },
            "stats": {
                "total_events_processed": self.total_events_processed,
                "total_patterns_detected": self.total_patterns_detected,
                "total_preferences_learned": self.total_preferences_learned,
                "days_of_learning": self.days_of_learning,
            },
            "computed_at": self.computed_at,
        }


@dataclass
class LearningProfile:
    """
    Perfil completo de aprendizado do usuário no LifeOS.

    Contém todas as preferências, padrões, scores e insights
    que o sistema aprendeu. É a representação interna do usuário.
    """
    profile_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    # Score de aprendizado
    learning_score: LearningScore = field(default_factory=LearningScore)

    # Preferências aprendidas (key -> Preference dict)
    preferences: Dict[str, Any] = field(default_factory=dict)

    # Padrões detectados (pattern_key -> Pattern dict)
    patterns: Dict[str, Any] = field(default_factory=dict)

    # Insights gerados para o usuário
    insights: List[str] = field(default_factory=list)

    # Metadados de aprendizado
    total_events: int = 0
    first_event_at: Optional[float] = None
    last_event_at: Optional[float] = None

    # Configurações de privacidade e consentimento
    learning_enabled: bool = True
    auto_apply_preferences: bool = False   # Nunca aplica sem autorização
    consent_version: str = "1.0"

    def add_insight(self, insight: str) -> None:
        """Adiciona um insight ao perfil, evitando duplicatas."""
        if insight not in self.insights:
            self.insights.append(insight)
            self.updated_at = time.time()

    def get_top_insights(self, n: int = 5) -> List[str]:
        """Retorna os N insights mais recentes."""
        return self.insights[-n:]

    def summary(self) -> Dict[str, Any]:
        """Resumo do perfil para exibição ao usuário."""
        return {
            "profile_id": self.profile_id,
            "learning_score": self.learning_score.to_dict(),
            "total_preferences": len(self.preferences),
            "total_patterns": len(self.patterns),
            "total_insights": len(self.insights),
            "top_insights": self.get_top_insights(5),
            "learning_enabled": self.learning_enabled,
            "days_active": int((time.time() - self.created_at) / 86400),
        }
