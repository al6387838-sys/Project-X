from typing import List, Dict, Any, Tuple
from ..models.evolution import UserTimeline

class BehaviorAnalyzer:
    """
    Analisa o comportamento do usuário ao longo do tempo para extrair:
    - Forma de trabalhar
    - Forma de aprender
    - Forma de decidir
    """
    def __init__(self, timeline: UserTimeline):
        self.timeline = timeline
        
    def analyze_work_style(self, interaction_history: List[Dict[str, Any]]) -> Tuple[str, float]:
        """
        Analisa como o usuário trabalha.
        Retorna (estilo_identificado, nivel_de_confianca)
        """
        # Lógica simulada
        if not interaction_history:
            return "unknown", 0.0
            
        # Contagem fictícia de padrões
        deep_work_count = sum(1 for i in interaction_history if i.get("duration", 0) > 60)
        multitask_count = sum(1 for i in interaction_history if i.get("switches", 0) > 5)
        
        if deep_work_count > multitask_count:
            return "deep_worker", 0.75
        elif multitask_count > deep_work_count:
            return "multitasker", 0.80
        else:
            return "hybrid", 0.50
            
    def analyze_learning_style(self, interaction_history: List[Dict[str, Any]]) -> Tuple[str, float]:
        """
        Analisa como o usuário aprende e consome informação.
        """
        # Lógica simulada
        return "visual_practical", 0.65
        
    def analyze_decision_style(self, interaction_history: List[Dict[str, Any]]) -> Tuple[str, float]:
        """
        Analisa como o usuário toma decisões.
        """
        # Lógica simulada
        return "data_driven_cautious", 0.85
        
    def generate_behavior_profile(self, interaction_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Gera um perfil comportamental completo.
        """
        work_style, work_conf = self.analyze_work_style(interaction_history)
        learn_style, learn_conf = self.analyze_learning_style(interaction_history)
        dec_style, dec_conf = self.analyze_decision_style(interaction_history)
        
        return {
            "work_style": {
                "value": work_style,
                "confidence": work_conf
            },
            "learning_style": {
                "value": learn_style,
                "confidence": learn_conf
            },
            "decision_style": {
                "value": dec_style,
                "confidence": dec_conf
            },
            "overall_behavior_confidence": (work_conf + learn_conf + dec_conf) / 3.0
        }
