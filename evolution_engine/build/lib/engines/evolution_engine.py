import time
from typing import List, Dict, Any, Optional
from ..models.evolution import EvolutionSnapshot, UserTimeline
from .learning_loop import LearningLoop

class EvolutionEngine:
    """
    Motor central que orquestra a evolução do LifeOS.
    Gerencia o Learning Loop, Behavior Analyzer, Confidence Engine e Adaptation Engine.
    """
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.timeline = UserTimeline(user_id=user_id)
        self.learning_loop = LearningLoop(self.timeline)
        
        from .behavior_analyzer import BehaviorAnalyzer
        from .confidence_engine import ConfidenceEngine
        
        self.behavior_analyzer = BehaviorAnalyzer(self.timeline)
        self.confidence_engine = ConfidenceEngine(self.timeline)
        
        from .adaptation_engine import AdaptationEngine
        self.adaptation_engine = AdaptationEngine()
        
        # Cria o snapshot inicial
        initial_snapshot = EvolutionSnapshot(
            confidence_score=0.1, # Começa baixo, não conhece o usuário
            evolution_score=0.0,
            adaptation_score=0.0,
            learning_velocity=0.0,
            metadata={"note": "Initial system state"}
        )
        self.timeline.add_snapshot(initial_snapshot)
        
    def process_new_data(self, data: Dict[str, Any]) -> bool:
        """
        Ponto de entrada principal para novos dados do usuário.
        Retorna True se uma melhoria significativa foi detectada.
        """
        # 1. Aprende com os dados
        learning_event = self.learning_loop.process_interaction(data)
        
        significant_improvement = False
        
        if learning_event:
            # 2. Atualiza confiança e comportamento (simulado por enquanto)
            # 3. Gera novo snapshot se houver mudança
            significant_improvement = self._generate_new_snapshot(learning_event)
            
            # 4. Adapta os outros sistemas se necessário
            if significant_improvement and self.adaptation_engine:
                self.adaptation_engine.trigger_adaptation(self.timeline.get_latest_snapshot(), learning_event)
                
        return significant_improvement
        
    def _generate_new_snapshot(self, trigger_event) -> bool:
        """
        Gera um novo snapshot baseado no estado atual e no evento recente.
        Retorna True se for considerado uma 'melhoria significativa'.
        """
        latest = self.timeline.get_latest_snapshot()
        if not latest:
            return False
            
        # Calcula novas métricas (simplificado)
        new_confidence = min(1.0, max(0.0, latest.confidence_score + trigger_event.confidence_delta))
        new_evolution = min(100.0, latest.evolution_score + abs(trigger_event.confidence_delta) * 50)
        new_adaptation = min(100.0, latest.adaptation_score + 2.0)
        
        # Velocidade baseada na diferença de tempo
        time_diff = time.time() - latest.timestamp
        new_velocity = 1.0 if time_diff < 1 else (1.0 / time_diff) * 100 # Fictício
        
        # Copia listas antigas
        routines = list(latest.routines_learned)
        prefs = list(latest.preferences_learned)
        
        if trigger_event.category == "routine":
            routines.append(trigger_event.what_learned)
        elif trigger_event.category == "preference":
            prefs.append(trigger_event.what_learned)
            
        new_snapshot = EvolutionSnapshot(
            confidence_score=new_confidence,
            evolution_score=new_evolution,
            adaptation_score=new_adaptation,
            learning_velocity=new_velocity,
            routines_learned=routines,
            preferences_learned=prefs,
            habits_learned=list(latest.habits_learned),
            goals_updated=list(latest.goals_updated),
            work_style=latest.work_style,
            learning_style=latest.learning_style,
            decision_style=latest.decision_style,
            significant_changes=[trigger_event.description]
        )
        
        self.timeline.add_snapshot(new_snapshot)
        
        # Considera 'significativo' se a confiança aumentou mais de 0.05 de uma vez
        # ou se a pontuação de evolução cruzou um limiar (ex: múltiplo de 10)
        is_significant = trigger_event.confidence_delta >= 0.05 or \
                         int(new_evolution / 10) > int(latest.evolution_score / 10)
                         
        return is_significant
        
    def get_timeline(self) -> UserTimeline:
        return self.timeline
