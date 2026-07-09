"""
Future Engine — PROJECT-X SPRINT 012
====================================
Motor de simulação de futuros possíveis do LifeOS.
Utiliza todo o conhecimento do sistema para gerar cenários, predições, riscos e oportunidades.
"""

from .models import Scenario, Prediction, Risk, Opportunity
from .engines import FutureEngine, ScenarioGenerator, PredictionEngine, RiskDetector, OpportunityDetector

__version__ = "1.0.0"
__sprint__ = "012"

__all__ = [
    "Scenario",
    "Prediction",
    "Risk",
    "Opportunity",
    "FutureEngine",
    "ScenarioGenerator",
    "PredictionEngine",
    "RiskDetector",
    "OpportunityDetector"
]
