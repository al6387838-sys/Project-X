from typing import List, Dict, Any, Optional
from .decision_history import DecisionHistory
from .reasoning_engine import ReasoningEngine
from ..models.trust import DecisionRecord

class TransparencyEngine:
    def __init__(self, decision_history: DecisionHistory, reasoning_engine: ReasoningEngine):
        self.decision_history = decision_history
        self.reasoning_engine = reasoning_engine

    def answer_why_question(self, user_id: str, query: str, decision_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Responde a perguntas do tipo 'Por que você fez/sugeriu isso?'
        Se decision_id for fornecido, busca a decisão específica. Caso contrário, tenta inferir
        a decisão mais relevante ou recente para o usuário.
        """
        record: Optional[DecisionRecord] = None
        if decision_id:
            record = self.decision_history.get_decision_by_id(decision_id)
        else:
            # Para simplificar, pega a decisão mais recente do usuário
            recent_decisions = self.decision_history.get_decisions_for_user(user_id, limit=1)
            if recent_decisions:
                record = recent_decisions[0]
        
        if record:
            explanation = self.reasoning_engine.generate_explanation(record)
            return {
                "success": True,
                "query": query,
                "decision_id": record.decision_id,
                "explanation": explanation,
                "confidence_explanation": self.reasoning_engine.explain_confidence_level(record.confidence_level)
            }
        else:
            return {
                "success": False,
                "query": query,
                "error": "Não foi possível encontrar uma decisão relevante para a sua pergunta."
            }

    def get_data_used_for_decision(self, user_id: str, decision_id: str) -> Dict[str, Any]:
        """
        Retorna os dados utilizados para uma decisão específica.
        """
        record = self.decision_history.get_decision_by_id(decision_id)
        if record and record.user_id == user_id:
            return {"success": True, "decision_id": decision_id, "data_used": record.data_used}
        else:
            return {"success": False, "error": "Decisão não encontrada ou não pertence a este usuário."}

    def get_decision_details(self, user_id: str, decision_id: str) -> Dict[str, Any]:
        """
        Retorna todos os detalhes de uma decisão específica.
        """
        record = self.decision_history.get_decision_by_id(decision_id)
        if record and record.user_id == user_id:
            return {"success": True, "decision_id": decision_id, "details": record.to_dict()}
        else:
            return {"success": False, "error": "Decisão não encontrada ou não pertence a este usuário."}
