from typing import List, Dict, Any, Optional
from datetime import datetime

from .decision_history import DecisionHistory
from .audit_engine import AuditEngine
from .reasoning_engine import ReasoningEngine
from .transparency_engine import TransparencyEngine
from ..models.trust import ConfidenceLevel, DecisionRecord

# Mock de outros motores do LifeOS para simular integração
class MockLifeOSCore:
    def get_confidence_score(self, user_id: str, decision_context: Dict[str, Any]) -> ConfidenceLevel:
        # Simula a obtenção do nível de confiança de um Confidence Engine real
        # Para demonstração, retorna um nível baseado em algum critério simples
        if "critical_impact" in decision_context.get("tags", []):
            return ConfidenceLevel.VERY_HIGH
        elif decision_context.get("data_completeness", 0.0) > 0.8:
            return ConfidenceLevel.HIGH
        elif decision_context.get("data_completeness", 0.0) > 0.5:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW

    def get_user_personal_dna(self, user_id: str) -> Dict[str, Any]:
        return {"values": ["growth", "health"], "preferences": {"learning_style": "visual"}}

    def get_user_context(self, user_id: str) -> Dict[str, Any]:
        return {"current_mood": "neutral", "location": "home"}


class TrustEngine:
    def __init__(self, lifeos_core: Optional[MockLifeOSCore] = None):
        self.decision_history = DecisionHistory()
        self.audit_engine = AuditEngine(self.decision_history)
        self.reasoning_engine = ReasoningEngine()
        self.transparency_engine = TransparencyEngine(self.decision_history, self.reasoning_engine)
        self.lifeos_core = lifeos_core or MockLifeOSCore()
        self._trust_score: Dict[str, float] = {}

    def record_lifeos_decision(
        self,
        user_id: str,
        engine_responsible: str,
        data_used: Dict[str, Any],
        explanation: str,
        alternatives_considered: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> DecisionRecord:
        # O Trust Engine solicita o nível de confiança ao LifeOS Core (Confidence Engine)
        confidence_level = self.lifeos_core.get_confidence_score(user_id, {
            "engine": engine_responsible,
            "data_completeness": data_used.get("completeness", 0.0),
            "tags": metadata.get("tags", []) if metadata else []
        })

        record = self.decision_history.record_decision(
            user_id=user_id,
            engine_responsible=engine_responsible,
            data_used=data_used,
            confidence_level=confidence_level,
            explanation=explanation,
            alternatives_considered=alternatives_considered,
            metadata=metadata
        )
        self._update_trust_score(user_id, confidence_level)
        return record

    def _update_trust_score(self, user_id: str, confidence_level: ConfidenceLevel):
        # Simula a atualização de um Trust Score geral do usuário
        # Lógica simplificada: confiança alta aumenta, baixa diminui
        current_score = self._trust_score.get(user_id, 0.5) # Começa com 0.5
        if confidence_level == ConfidenceLevel.VERY_HIGH:
            current_score += 0.05
        elif confidence_level == ConfidenceLevel.HIGH:
            current_score += 0.02
        elif confidence_level == ConfidenceLevel.LOW:
            current_score -= 0.03
        current_score = max(0.0, min(1.0, current_score)) # Limita entre 0 e 1
        self._trust_score[user_id] = current_score

    def get_user_trust_score(self, user_id: str) -> float:
        return self._trust_score.get(user_id, 0.5)

    def get_decision_explanation(self, user_id: str, decision_id: str) -> Dict[str, Any]:
        return self.transparency_engine.answer_why_question(user_id, query="", decision_id=decision_id)

    def get_audit_summary(self, user_id: str, period_days: int = 30) -> Dict[str, Any]:
        return self.audit_engine.get_decision_summary(user_id, period_days)

    def get_decision_timeline(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        return self.audit_engine.get_decision_timeline(user_id, limit)

    def get_dashboard_data(self, user_id: str) -> Dict[str, Any]:
        # Dados para um Dashboard de Confiança
        summary = self.get_audit_summary(user_id)
        return {
            "user_trust_score": self.get_user_trust_score(user_id),
            "total_decisions_last_30_days": summary.get("total_decisions", 0),
            "confidence_distribution": summary.get("confidence_distribution", {}),
            "most_recent_decision": summary.get("most_recent_decision", None)
        }
