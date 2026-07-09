from typing import Dict, Any
from ..models.evolution import UserTimeline, EvolutionSnapshot

class ConfidenceEngine:
    """
    Calcula e gerencia o Confidence Score do sistema em relação ao usuário.
    O Confidence Score dita o quão autônomo o sistema pode ser.
    """
    def __init__(self, timeline: UserTimeline):
        self.timeline = timeline
        
    def calculate_confidence(self, recent_successes: int, recent_failures: int, time_active_days: float) -> float:
        """
        Calcula a confiança baseada no histórico recente de predições corretas/incorretas.
        """
        total = recent_successes + recent_failures
        if total == 0:
            return 0.1 # Base mínima
            
        accuracy = recent_successes / total
        
        # Fator de tempo: sistema precisa de tempo para ganhar confiança, mesmo acertando tudo
        time_factor = min(1.0, time_active_days / 30.0) # Máxima confiança requer pelo menos 30 dias
        
        # Fórmula ponderada
        base_confidence = (accuracy * 0.7) + (time_factor * 0.3)
        
        # Penalidade por falhas recentes (sistema fica cauteloso rapidamente se errar muito)
        if recent_failures > recent_successes:
            base_confidence *= 0.5
            
        return max(0.0, min(1.0, base_confidence))
        
    def get_autonomy_level(self, confidence_score: float) -> str:
        """
        Determina o nível de autonomia que o sistema deve ter baseado na confiança.
        """
        if confidence_score < 0.3:
            return "observation_only" # Apenas observa e sugere timidamente
        elif confidence_score < 0.6:
            return "suggestive"       # Sugere ações ativamente, requer aprovação para tudo
        elif confidence_score < 0.85:
            return "semi_autonomous"  # Executa ações de baixo risco sozinho, pede aprovação para alto risco
        else:
            return "autonomous"       # Executa a maioria das ações, notifica após o fato (Action Engine segura)
            
    def evaluate_snapshot(self, snapshot: EvolutionSnapshot) -> Dict[str, Any]:
        """
        Avalia um snapshot e retorna métricas de confiança.
        """
        autonomy = self.get_autonomy_level(snapshot.confidence_score)
        
        return {
            "current_confidence": snapshot.confidence_score,
            "recommended_autonomy": autonomy,
            "is_ready_for_automation": snapshot.confidence_score >= 0.6
        }
