from typing import Dict, Any, List
from ..models.evolution import EvolutionSnapshot, LearningEvent

class AdaptationEngine:
    """
    Responsável por propagar os aprendizados do Evolution Engine para o resto do LifeOS.
    Atualiza: Personal DNA, Context Engine, Decision Engine, Action Engine, Companion.
    """
    def __init__(self):
        # Em um sistema real, receberia instâncias ou interfaces para os outros motores
        self.system_registry = {}
        
    def register_system(self, system_name: str, system_interface: Any):
        """Registra um motor externo que precisa ser atualizado."""
        self.system_registry[system_name] = system_interface
        
    def trigger_adaptation(self, current_snapshot: EvolutionSnapshot, trigger_event: LearningEvent) -> Dict[str, Any]:
        """
        Dispara o processo de adaptação em todos os sistemas conectados.
        """
        results = {
            "personal_dna": False,
            "context_engine": False,
            "decision_engine": False,
            "action_engine": False,
            "companion": False
        }
        
        # 1. Atualiza Personal DNA (Identidade base do usuário)
        if trigger_event.category in ["preference", "work_style", "learning_style"]:
            results["personal_dna"] = self._update_personal_dna(trigger_event)
            
        # 2. Atualiza Context Engine (Como interpreta o ambiente)
        if trigger_event.category in ["routine", "habit"]:
            results["context_engine"] = self._update_context_engine(trigger_event)
            
        # 3. Atualiza Decision Engine (Como toma decisões)
        if trigger_event.category in ["decision_style", "preference"]:
            results["decision_engine"] = self._update_decision_engine(trigger_event)
            
        # 4. Atualiza Action Engine (Como executa ações e autonomia)
        results["action_engine"] = self._update_action_engine(current_snapshot)
        
        # 5. Atualiza Companion (Como interage com o usuário)
        results["companion"] = self._update_companion(current_snapshot, trigger_event)
        
        return results
        
    def _update_personal_dna(self, event: LearningEvent) -> bool:
        """Simula a atualização do Personal DNA."""
        # Ex: Atualiza o grafo de conhecimento pessoal
        return True
        
    def _update_context_engine(self, event: LearningEvent) -> bool:
        """Simula a atualização do Context Engine."""
        # Ex: Ajusta pesos de reconhecimento de contexto para nova rotina
        return True
        
    def _update_decision_engine(self, event: LearningEvent) -> bool:
        """Simula a atualização do Decision Engine."""
        # Ex: Ajusta os pesos (weights) do motor de recomendação e resolução de conflitos
        return True
        
    def _update_action_engine(self, snapshot: EvolutionSnapshot) -> bool:
        """Simula a atualização do Action Engine."""
        # O Action Engine depende muito do Confidence Score para definir aprovações automáticas
        confidence = snapshot.confidence_score
        # Se confiança > 0.8, diminui a necessidade de aprovação manual para ações de rotina
        return True
        
    def _update_companion(self, snapshot: EvolutionSnapshot, event: LearningEvent) -> bool:
        """Simula a atualização do Companion (Interface Conversacional)."""
        # O Companion usa o LearningEvent para explicar ao usuário o que mudou
        # Ex: "Percebi que você prefere trabalhar focado de manhã. Ajustei sua agenda."
        return True
