"""
Review Manager
==============
Gerencia os fluxos de revisão periódica:
- Evening Review (Fim do dia)
- Weekly Review (Fim da semana)
- Monthly Review (Fim do mês)
"""

from typing import Dict, Any
from ..intelligence_engine import IntelligenceEngine

class ReviewManager:
    """
    Orquestra as revisões periódicas para fechamento de ciclos.
    """

    def __init__(self, engine: IntelligenceEngine):
        self.engine = engine

    def generate_evening_review(self) -> Dict[str, Any]:
        """Gera o resumo do dia e prepara o amanhã."""
        snapshot = self.engine.get_user_snapshot()
        return {
            "title": "Evening Review",
            "summary": "Você concluiu 80% do planejado para hoje.",
            "wins": snapshot["memory"]["completed_milestones"],
            "to_prepare": "Amanhã você tem uma reunião importante às 09:00.",
            "reflection_prompt": "Qual foi o momento mais significativo do seu dia?"
        }

    def generate_weekly_review(self) -> Dict[str, Any]:
        """Analisa a semana e ajusta o Life Graph."""
        snapshot = self.engine.get_user_snapshot()
        return {
            "title": "Weekly Review",
            "progress": f"Meta semanal: {snapshot['life_graph']['weekly_goal_progress']*100}%",
            "patterns": snapshot["memory"]["recent_patterns"],
            "focus_next_week": "Execução do SPRINT 007."
        }

    def generate_monthly_review(self) -> Dict[str, Any]:
        """Visão macro mensal de objetivos e crescimento."""
        return {
            "title": "Monthly Review",
            "status": "Em desenvolvimento para o SPRINT 008."
        }
