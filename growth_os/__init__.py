"""
Growth OS
=========
Sistema Operacional de Crescimento da LifeOS.

Responsável por toda aquisição, retenção e expansão de usuários.
Cada métrica é mensurável, rastreável e auditável.

Módulos:
    - models: Modelos de dados do funil e métricas
    - engines: Growth Engine central
    - dashboards: Acquisition e Retention Dashboards
    - referral: Referral Engine e sistema de recompensas
    - activation: Activation Engine
    - onboarding: Onboarding inteligente adaptativo
"""

from .engines.growth_engine import GrowthEngine
from .models.funnel import FunnelStage, FunnelEvent, FunnelMetrics
from .models.user_journey import UserJourney, JourneyStatus

__version__ = "1.0.0"
__all__ = [
    "GrowthEngine",
    "FunnelStage",
    "FunnelEvent",
    "FunnelMetrics",
    "UserJourney",
    "JourneyStatus",
]
