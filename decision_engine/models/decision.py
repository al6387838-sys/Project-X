from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time
import uuid
from enum import Enum

class DecisionCategory(str, Enum):
    SAUDE = "Saúde"
    FINANCAS = "Finanças"
    PRODUTIVIDADE = "Produtividade"
    RELACIONAMENTOS = "Relacionamentos"
    PROJETOS = "Projetos"
    CARREIRA = "Carreira"
    CONHECIMENTO = "Conhecimento"

@dataclass
class Alternative:
    alternative_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    description: str = ""
    pros: List[str] = field(default_factory=list)
    cons: List[str] = field(default_factory=list)
    estimated_impact: float = 0.0

@dataclass
class Decision:
    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    related_goal: str = ""
    category: str = DecisionCategory.PRODUTIVIDADE.value
    
    # Contexto
    context_used: Dict[str, Any] = field(default_factory=dict)
    factor_weights: Dict[str, float] = field(default_factory=dict)
    
    # Avaliação
    alternatives: List[Alternative] = field(default_factory=list)
    confidence_score: float = 0.0 # 0.0 to 1.0 (Confiança da IA)
    decision_score: float = 0.0 # Pontuação geral da decisão (0 a 100)
    
    # Recomendação e Justificativa
    recommendation: str = ""
    reasoning: List[str] = field(default_factory=list)
    justification: str = ""
    
    # Impactos
    possible_risks: List[str] = field(default_factory=list)
    possible_benefits: List[str] = field(default_factory=list)
    
    # Status/Histórico
    priority: int = 0
    status: str = "pending" # pending, accepted, rejected
    
    def explain(self) -> str:
        """Retorna uma explicação compreensível do raciocínio da decisão."""
        if not self.reasoning and not self.justification:
            return "Nenhum raciocínio fornecido."
        explanation = f"Justificativa: {self.justification}\n"
        explanation += "\n".join([f"- {r}" for r in self.reasoning])
        return explanation
