import time
from typing import List, Dict, Any, Optional
from ..models.evolution import LearningEvent, UserTimeline

class LearningLoop:
    """
    Motor responsável por aprender continuamente com as interações do usuário.
    Analisa dados brutos e extrai padrões (rotinas, preferências, hábitos, etc).
    """
    def __init__(self, timeline: UserTimeline):
        self.timeline = timeline
        
    def process_interaction(self, interaction_data: Dict[str, Any]) -> Optional[LearningEvent]:
        """
        Processa uma nova interação do usuário e tenta extrair um aprendizado.
        Em um sistema real, isso usaria ML/LLMs para identificar padrões.
        Aqui simulamos a detecção de um padrão.
        """
        # Simulação de detecção baseada nos dados de entrada
        action_type = interaction_data.get("action_type")
        content = interaction_data.get("content", "")
        
        event = None
        
        if action_type == "decision_override":
            # Usuário ignorou a sugestão do sistema e tomou outra decisão
            event = LearningEvent(
                category="decision_style",
                description=f"User overrode system decision: {content}",
                confidence_delta=-0.05,  # Confiança cai temporariamente porque erramos
                why_changed="User chose a different path than recommended.",
                what_learned="The current decision weights for this context are incorrect.",
                how_improves_experience="System will adjust weights to favor the user's actual preference in similar future contexts."
            )
            
        elif action_type == "routine_completed_consistently":
            # Usuário completou a mesma rotina no mesmo horário por X dias
            event = LearningEvent(
                category="routine",
                description=f"Consistent routine detected: {content}",
                confidence_delta=0.1,  # Confiança aumenta porque confirmamos um padrão
                why_changed="User has performed this action consistently.",
                what_learned=f"User prefers to do '{content}' at this specific time.",
                how_improves_experience="System will automatically prepare resources and suggest this routine proactively."
            )
            
        elif action_type == "preference_stated":
            # Usuário explicitamente declarou uma preferência
            event = LearningEvent(
                category="preference",
                description=f"Explicit preference: {content}",
                confidence_delta=0.15,
                why_changed="User explicitly stated a preference.",
                what_learned=f"User prefers: {content}",
                how_improves_experience="System will apply this preference globally to all relevant future actions."
            )
            
        if event:
            self.timeline.add_learning_event(event)
            
        return event

    def analyze_historical_patterns(self, past_days: int = 7) -> List[LearningEvent]:
        """
        Analisa o histórico (batch processing) para encontrar padrões mais complexos.
        (Simulação para o Sprint)
        """
        events = []
        # Exemplo simulado de descoberta de estilo de trabalho
        event = LearningEvent(
            category="work_style",
            description="Detected shift in work style towards deep work blocks.",
            confidence_delta=0.08,
            why_changed="Analysis of past 7 days shows longer uninterrupted focus sessions.",
            what_learned="User works best in 90-minute deep work blocks rather than 30-minute sprints.",
            how_improves_experience="System will automatically block 90-minute calendar slots and silence non-urgent notifications during these periods."
        )
        events.append(event)
        self.timeline.add_learning_event(event)
        return events
