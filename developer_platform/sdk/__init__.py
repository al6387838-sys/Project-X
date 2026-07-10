"""
LifeOS Official SDK v2.0.0
EXECUTION-009: Developer Platform

O SDK oficial do LifeOS para Python.
Suporta autenticação via API Key e OAuth 2.0.

Instalação:
    pip install lifeos-sdk

Uso rápido:
    from lifeos_developer_sdk import LifeOSClient

    client = LifeOSClient(api_key="lk_live_...")
    memories = client.memory.list()
"""
from .client import LifeOSClient, LifeOSClientConfig
from .resources import MemoryResource, TimelineResource, DecisionResource, InsightResource
from .resources import WebhookResource, APIKeyResource, DeveloperResource
from .exceptions import (
    LifeOSError,
    AuthenticationError,
    RateLimitError,
    NotFoundError,
    ValidationError,
    APIError,
)

__version__ = "2.0.0"
__author__ = "LifeOS Developer Platform"

__all__ = [
    "LifeOSClient",
    "LifeOSClientConfig",
    "MemoryResource",
    "TimelineResource",
    "DecisionResource",
    "InsightResource",
    "WebhookResource",
    "APIKeyResource",
    "DeveloperResource",
    "LifeOSError",
    "AuthenticationError",
    "RateLimitError",
    "NotFoundError",
    "ValidationError",
    "APIError",
]
