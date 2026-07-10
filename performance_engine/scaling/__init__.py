"""Auto Scaling & Stateless Services architecture for LifeOS."""

from .auto_scaler import AutoScaler, ScalingPolicy, ScalingEvent
from .stateless_service import StatelessService, ServiceRegistry
from .load_balancer import LoadBalancer, LoadBalancingStrategy
from .health_checker import HealthChecker, ServiceInstance

__all__ = [
    "AutoScaler",
    "ScalingPolicy",
    "ScalingEvent",
    "StatelessService",
    "ServiceRegistry",
    "LoadBalancer",
    "LoadBalancingStrategy",
    "HealthChecker",
    "ServiceInstance",
]
