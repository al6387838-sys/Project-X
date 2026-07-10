"""
LifeOS Developer Sandbox
EXECUTION-009: Developer Platform

Ambiente isolado para desenvolvimento e testes.
Dados do sandbox são completamente separados do ambiente de produção.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class SandboxState(str, Enum):
    CLEAN = "clean"
    SEEDED = "seeded"
    CUSTOM = "custom"


@dataclass
class SandboxConfig:
    """Configuração do sandbox."""
    base_url: str = "https://sandbox.api.lifeos.app/api/v2"
    data_retention_hours: int = 24
    max_records_per_type: int = 100
    rate_limit_per_minute: int = 300  # Mais permissivo no sandbox
    enable_debug_headers: bool = True


@dataclass
class SandboxSession:
    """Sessão de sandbox para um desenvolvedor."""
    session_id: str = field(default_factory=lambda: f"sbx_{secrets.token_hex(12)}")
    developer_id: str = ""
    api_key: str = field(default_factory=lambda: f"lk_test_{secrets.token_hex(32)}")
    state: SandboxState = SandboxState.CLEAN
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    data: Dict[str, List] = field(default_factory=lambda: {
        "memories": [],
        "timeline_events": [],
        "decisions": [],
        "insights": [],
        "webhooks": [],
        "api_keys": [],
    })

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "api_key": self.api_key,
            "state": self.state.value,
            "base_url": "https://sandbox.api.lifeos.app/api/v2",
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "record_counts": {k: len(v) for k, v in self.data.items()},
        }


class DeveloperSandbox:
    """
    LifeOS Developer Sandbox.

    Fornece um ambiente isolado e seguro para:
    - Desenvolver e testar integrações sem afetar dados reais
    - Experimentar a API com dados de exemplo
    - Executar testes automatizados de forma confiável
    - Simular diferentes cenários de dados

    Características:
    - Dados completamente isolados da produção
    - API Key com prefixo 'lk_test_' (nunca 'lk_live_')
    - Rate limits mais permissivos (300 req/min)
    - Reset e seed disponíveis a qualquer momento
    - Dados expiram em 24h automaticamente
    - Headers de debug em todas as respostas
    """

    SAMPLE_MEMORIES = [
        {"id": "mem_sample_01", "content": "Quarterly planning meeting with leadership team", "type": "work", "tags": ["meeting", "planning"]},
        {"id": "mem_sample_02", "content": "Decided to launch Developer Platform in Q3 2026", "type": "decision", "tags": ["product", "strategy"]},
        {"id": "mem_sample_03", "content": "Read 'The Pragmatic Programmer' — key insight: automate everything", "type": "learning", "tags": ["book", "engineering"]},
        {"id": "mem_sample_04", "content": "Morning run: 8km in 42min. Personal best this month.", "type": "health", "tags": ["exercise", "running"]},
        {"id": "mem_sample_05", "content": "Called mom for her birthday. Need to plan visit next month.", "type": "personal", "tags": ["family"]},
        {"id": "mem_sample_06", "content": "Invested in index funds — staying the course despite market volatility", "type": "finance", "tags": ["investing"]},
        {"id": "mem_sample_07", "content": "Team retro: velocity improved 23% after adopting async standups", "type": "work", "tags": ["team", "process"]},
        {"id": "mem_sample_08", "content": "Meditation streak: 30 days. Noticing better focus and less anxiety.", "type": "health", "tags": ["mindfulness"]},
        {"id": "mem_sample_09", "content": "Architecture decision: adopt event-driven design for scalability", "type": "technical", "tags": ["architecture", "engineering"]},
        {"id": "mem_sample_10", "content": "Finished Portuguese course — ready for the Lisbon trip", "type": "learning", "tags": ["language", "travel"]},
    ]

    SAMPLE_TIMELINE_EVENTS = [
        {"id": "evt_sample_01", "title": "Started Developer Platform project", "date": "2026-07-10", "category": "milestone"},
        {"id": "evt_sample_02", "title": "LifeOS v1.0-rc released", "date": "2026-07-09", "category": "release"},
        {"id": "evt_sample_03", "title": "Design System v3.0 completed", "date": "2026-07-08", "category": "milestone"},
        {"id": "evt_sample_04", "title": "Sovereign Memory Evolution shipped", "date": "2026-07-07", "category": "release"},
        {"id": "evt_sample_05", "title": "Team reached 10 engineers", "date": "2026-06-01", "category": "team"},
        {"id": "evt_sample_06", "title": "First enterprise customer signed", "date": "2026-05-15", "category": "business"},
        {"id": "evt_sample_07", "title": "Moved to new office in São Paulo", "date": "2026-04-01", "category": "personal"},
        {"id": "evt_sample_08", "title": "Completed 100km cycling challenge", "date": "2026-03-20", "category": "health"},
    ]

    SAMPLE_DECISIONS = [
        {"id": "dec_sample_01", "title": "Adopt microservices architecture", "status": "approved", "confidence": 0.92, "impact": "high"},
        {"id": "dec_sample_02", "title": "Expand to European market in 2027", "status": "pending", "confidence": 0.71, "impact": "high"},
        {"id": "dec_sample_03", "title": "Hire 3 senior engineers in Q3", "status": "approved", "confidence": 0.88, "impact": "medium"},
        {"id": "dec_sample_04", "title": "Migrate database to PostgreSQL", "status": "approved", "confidence": 0.95, "impact": "high"},
        {"id": "dec_sample_05", "title": "Launch mobile app in Q4 2026", "status": "pending", "confidence": 0.65, "impact": "high"},
    ]

    SAMPLE_INSIGHTS = [
        {"id": "ins_sample_01", "type": "pattern", "title": "Peak productivity on Tuesday mornings", "confidence": 0.87, "recommendation": "Schedule deep work for Tuesdays 9-12h"},
        {"id": "ins_sample_02", "type": "risk", "title": "Overcommitment detected in Q3 planning", "confidence": 0.79, "recommendation": "Remove 2 items from Q3 roadmap"},
        {"id": "ins_sample_03", "type": "opportunity", "title": "Health metrics improving consistently", "confidence": 0.91, "recommendation": "Maintain current exercise routine"},
    ]

    def __init__(self, config: Optional[SandboxConfig] = None):
        self.config = config or SandboxConfig()
        self._sessions: Dict[str, SandboxSession] = {}

    def create_session(self, developer_id: str) -> SandboxSession:
        """Cria uma nova sessão de sandbox."""
        session = SandboxSession(developer_id=developer_id)
        self._sessions[session.session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[SandboxSession]:
        return self._sessions.get(session_id)

    def reset(self, session_id: str) -> bool:
        """Reseta o sandbox para estado limpo."""
        session = self._sessions.get(session_id)
        if not session:
            return False
        session.data = {k: [] for k in session.data}
        session.state = SandboxState.CLEAN
        return True

    def seed(self, session_id: str, preset: str = "default") -> Dict[str, Any]:
        """Popula o sandbox com dados de exemplo."""
        session = self._sessions.get(session_id)
        if not session:
            return {"error": "Session not found"}

        session.data["memories"] = list(self.SAMPLE_MEMORIES)
        session.data["timeline_events"] = list(self.SAMPLE_TIMELINE_EVENTS)
        session.data["decisions"] = list(self.SAMPLE_DECISIONS)
        session.data["insights"] = list(self.SAMPLE_INSIGHTS)
        session.state = SandboxState.SEEDED

        return {
            "seeded": True,
            "preset": preset,
            "records_created": sum(len(v) for v in session.data.values()),
            "breakdown": {k: len(v) for k, v in session.data.items()},
        }

    def get_status(self, session_id: str) -> Optional[Dict]:
        session = self._sessions.get(session_id)
        if not session:
            return None
        return {
            **session.to_dict(),
            "config": {
                "base_url": self.config.base_url,
                "rate_limit_per_minute": self.config.rate_limit_per_minute,
                "data_retention_hours": self.config.data_retention_hours,
                "debug_headers_enabled": self.config.enable_debug_headers,
            },
        }
