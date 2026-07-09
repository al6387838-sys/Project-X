from typing import List, Dict, Any, Optional
from ..models.future import Scenario, Risk, Opportunity

class ScenarioGenerator:
    """
    Gera cenários futuros possíveis com base nos dados do LifeOS.
    """
    def __init__(self, life_graph: Any, timeline: Any, personal_dna: Any, decision_engine: Any, context_engine: Any, memory_engine: Any, evolution_engine: Any):
        self.life_graph = life_graph
        self.timeline = timeline
        self.personal_dna = personal_dna
        self.decision_engine = decision_engine
        self.context_engine = context_engine
        self.memory_engine = memory_engine
        self.evolution_engine = evolution_engine
        
        self.time_horizons = {
            "30_days": "próximo mês",
            "90_days": "próximos 3 meses",
            "1_year": "próximo ano",
            "5_years": "próximos 5 anos",
            "10_years": "próximos 10 anos"
        }

    def generate_scenario(self, 
                          base_situation: str, 
                          action_taken: Optional[str] = None, 
                          time_horizon: str = "30_days") -> Scenario:
        """
        Gera um cenário futuro com base em uma situação base e uma ação hipotética.
        """
        if time_horizon not in self.time_horizons:
            raise ValueError(f"Time horizon '{time_horizon}' not supported. Choose from {list(self.time_horizons.keys())}")

        # Simulação de coleta de dados dos motores
        user_snapshot = self.evolution_engine.get_timeline().get_latest_snapshot() if self.evolution_engine else None
        current_context = self.context_engine.get_current_context() if self.context_engine else {}
        
        # Lógica de simulação (simplificada para o sprint)
        title = f"Cenário: {base_situation}"
        description = f"Simulação para o {self.time_horizons[time_horizon]} com base em '{base_situation}'."
        
        probability = 0.5 # Valor base
        impact_score = 0.0
        confidence_score = user_snapshot.confidence_score if user_snapshot else 0.5
        
        reasons = [f"Análise do {base_situation}"]
        suggestions = []
        
        risks = []
        opportunities = []
        conflicts = []
        potential_gains = []
        potential_losses = []
        
        # Exemplo de lógica baseada na situação/ação
        if "dormindo pouco" in base_situation.lower():
            probability = 0.7
            impact_score = -30.0
            reasons.append("Padrões de sono inconsistentes detectados no Life Graph.")
            suggestions.append("Implementar rotina de sono consistente.")
            risks.append({"title": "Fadiga crônica", "severity": 0.8, "likelihood": 0.7})
            potential_losses.append("Produtividade reduzida")
            
        if "aumentar investimentos" in base_situation.lower():
            probability = 0.6
            impact_score = 40.0
            reasons.append("Histórico de investimentos bem-sucedidos no Life Graph.")
            suggestions.append("Consultar especialista financeiro.")
            opportunities.append({"title": "Crescimento patrimonial", "potential_gain": 0.7, "feasibility": 0.6})
            potential_gains.append("Aumento de renda passiva")
            
        if action_taken:
            description += f" Ação hipotética: '{action_taken}'."
            # Ajustar probabilidade/impacto com base na ação
            if "aceitar proposta" in action_taken.lower():
                probability *= 0.8
                impact_score += 15.0
                
        # Ajustar confiança com base no tempo
        if time_horizon == "10_years":
            confidence_score *= 0.3 # Menos confiança em longo prazo
        elif time_horizon == "30_days":
            confidence_score *= 1.2 # Mais confiança em curto prazo
            
        return Scenario(
            title=title,
            description=description,
            time_horizon=time_horizon,
            probability=min(1.0, max(0.0, probability)),
            impact_score=impact_score,
            confidence_score=min(1.0, max(0.0, confidence_score)),
            reasons=reasons,
            suggestions=suggestions,
            risks=risks,
            opportunities=opportunities,
            conflicts=conflicts,
            potential_gains=potential_gains,
            potential_losses=potential_losses
        )

    def generate_multiple_scenarios(self, 
                                    base_situations: List[str], 
                                    actions: List[Optional[str]], 
                                    time_horizons: List[str]) -> List[Scenario]:
        """
        Gera múltiplos cenários para diferentes situações e horizontes de tempo.
        """
        scenarios = []
        for situation in base_situations:
            for horizon in time_horizons:
                for action in actions:
                    scenarios.append(self.generate_scenario(situation, action, horizon))
        return scenarios
