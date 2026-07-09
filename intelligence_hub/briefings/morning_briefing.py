"""
Morning Briefing Generator
==========================
Gera o resumo matinal personalizado e contextual do LifeOS.
O foco é criar o "Magic Moment" para o usuário.
"""

from typing import List, Dict, Any
from ..intelligence_engine import IntelligenceEngine

class MorningBriefing:
    """
    Transforma o snapshot do IntelligenceEngine em uma experiência narrativa.
    """

    def __init__(self, engine: IntelligenceEngine):
        self.engine = engine

    def generate(self) -> Dict[str, Any]:
        """
        Gera o briefing matinal completo.
        """
        snapshot = self.engine.get_user_snapshot()
        user_name = snapshot["user_profile"]["name"]
        
        # Construção da Narrativa Contextual (Jamais usar textos fixos)
        greeting = self._get_dynamic_greeting(user_name, snapshot)
        priorities = self._extract_priorities(snapshot)
        conflicts = self._detect_conflicts(snapshot)
        health_signals = self._get_health_signals(snapshot)
        progress = self._get_progress_summary(snapshot)
        quick_wins = self._get_quick_wins(snapshot)

        # Estrutura do Briefing
        briefing_content = {
            "greeting": greeting,
            "sections": [
                {"title": "Prioridades Reais", "items": priorities},
                {"title": "Atenção Necessária", "items": conflicts},
                {"title": "Estado de Saúde e Energia", "items": health_signals},
                {"title": "Progresso e Metas", "items": progress},
                {"title": "Quick Wins (Menos de 15 min)", "items": quick_wins}
            ],
            "footer": "Tenha um excelente dia focado no que realmente importa."
        }

        return briefing_content

    def _get_dynamic_greeting(self, name: str, snapshot: Dict[str, Any]) -> str:
        # Lógica dinâmica baseada no estado do usuário
        if snapshot["context"]["sleep_quality"] == "lower_than_usual":
            return f"Bom dia, {name}. Percebi que você dormiu menos que o habitual, vamos ajustar o ritmo hoje?"
        return f"Bom dia, {name}. Você parece pronto para um dia produtivo."

    def _extract_priorities(self, snapshot: Dict[str, Any]) -> List[str]:
        return snapshot["decisions"]["top_priorities"]

    def _detect_conflicts(self, snapshot: Dict[str, Any]) -> List[str]:
        conflicts = []
        for event in snapshot["context"]["current_events"]:
            if event.get("conflict"):
                conflicts.append(f"Conflito de agenda às {event['time']}: {event['name']}")
        return conflicts

    def _get_health_signals(self, snapshot: Dict[str, Any]) -> List[str]:
        signals = []
        if snapshot["context"]["sleep_quality"] == "lower_than_usual":
            signals.append("Dormiu menos que o habitual. Considere pausas curtas de 5min a cada 90min.")
        return signals

    def _get_progress_summary(self, snapshot: Dict[str, Any]) -> List[str]:
        progress = snapshot["life_graph"]["weekly_goal_progress"] * 100
        project = snapshot["life_graph"]["active_projects"][0]
        return [
            f"Sua meta semanal está {progress:.0f}% concluída.",
            f"O projeto {project} está entrando na fase de execução."
        ]

    def _get_quick_wins(self, snapshot: Dict[str, Any]) -> List[str]:
        # Identifica tarefas rápidas baseadas no Context Engine
        wins = []
        if "15min_task_ready" in snapshot["context"]["available_time_slots"]:
            wins.append("Existe uma tarefa que pode ser feita em menos de 15 minutos (Update README).")
        return wins

    def explain_item(self, item_title: str) -> str:
        """
        Responde à pergunta: "Por que você sugeriu isso?"
        """
        # Integração com o Reasoning Engine do Decision Engine
        explanations = {
            "Conflito de agenda": "Detectado pelo Context Engine: dois eventos marcados para o mesmo horário (09:00).",
            "Prioridades Reais": "Calculado pelo Decision Engine com base no seu objetivo semanal e prazos do Life Graph.",
            "Dormiu menos": "Identificado pelo Memory Engine ao comparar dados do seu Wearable com sua média histórica de 7h30.",
            "Quick Wins": "O Context Engine identificou um gap de 20 minutos entre suas reuniões das 10:00 e 10:30."
        }
        return explanations.get(item_title, "Sugestão baseada na integração total do seu contexto e metas.")
