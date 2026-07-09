from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time
import uuid

@dataclass
class Scenario:
    """Representa um cenário futuro simulado."""
    scenario_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    title: str = ""
    description: str = ""
    time_horizon: str = "30_days" # 30_days, 90_days, 1_year, 5_years, 10_years
    
    probability: float = 0.0 # 0.0 a 1.0
    impact_score: float = 0.0 # -100.0 a 100.0
    confidence_score: float = 0.0 # 0.0 a 1.0
    
    reasons: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    
    # Detalhes específicos
    risks: List[Dict[str, Any]] = field(default_factory=list)
    opportunities: List[Dict[str, Any]] = field(default_factory=list)
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    potential_gains: List[str] = field(default_factory=list)
    potential_losses: List[str] = field(default_factory=list)
    
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__

@dataclass
class Prediction:
    """Uma predição específica gerada pelo Prediction Engine."""
    prediction_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    category: str = "general" # health, financial, career, personal, relationship
    subject: str = ""
    outcome: str = ""
    probability: float = 0.0
    evidence: List[str] = field(default_factory=list)
    
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Risk:
    """Um risco identificado pelo Risk Detector."""
    risk_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    severity: float = 0.0 # 0.0 a 1.0
    likelihood: float = 0.0 # 0.0 a 1.0
    mitigation_strategy: str = ""
    consequences: List[str] = field(default_factory=list)

@dataclass
class Opportunity:
    """Uma oportunidade identificada pelo Opportunity Detector."""
    opportunity_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    potential_gain: float = 0.0 # 0.0 a 1.0
    feasibility: float = 0.0 # 0.0 a 1.0
    action_plan: str = ""
    benefits: List[str] = field(default_factory=list)
