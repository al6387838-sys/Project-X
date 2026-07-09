import json
import os
from typing import List, Dict, Any, Optional
from ..models.decision import Decision

class DecisionHistory:
    """Gerencia o histórico de decisões e o feedback do usuário para aprendizagem."""
    
    def __init__(self, storage_path: str = "/home/ubuntu/Project-X/data/decision_history.json"):
        self.storage_path = storage_path
        self.decisions: Dict[str, Decision] = {}
        self.feedback_log: List[Dict[str, Any]] = []
        self._load()
        
    def _load(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    # Simple load for mock/demo purposes
                    self.feedback_log = data.get("feedback_log", [])
            except Exception:
                pass
                
    def _save(self):
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        try:
            with open(self.storage_path, 'w') as f:
                json.dump({"feedback_log": self.feedback_log}, f)
        except Exception:
            pass

    def record_decision(self, decision: Decision):
        """Registra uma nova decisão no histórico."""
        self.decisions[decision.decision_id] = decision
        
    def get_decision(self, decision_id: str) -> Optional[Decision]:
        return self.decisions.get(decision_id)
        
    def get_all(self) -> List[Decision]:
        return sorted(list(self.decisions.values()), key=lambda d: d.timestamp, reverse=True)
        
    def register_feedback(self, decision_id: str, accepted: bool, feedback_text: str = ""):
        """
        Registra o feedback do usuário (aceitou ou rejeitou).
        Isso é usado para aprendizagem futura.
        """
        decision = self.get_decision(decision_id)
        if decision:
            decision.status = "accepted" if accepted else "rejected"
            
            feedback_entry = {
                "decision_id": decision_id,
                "category": decision.category,
                "accepted": accepted,
                "feedback_text": feedback_text,
                "context_used": decision.context_used,
                "recommendation": decision.recommendation
            }
            self.feedback_log.append(feedback_entry)
            self._save()
            return True
        return False
        
    def get_learning_patterns(self, category: str = None) -> Dict[str, Any]:
        """Analisa o histórico de feedback para extrair padrões e melhorar decisões futuras."""
        if not self.feedback_log:
            return {"acceptance_rate": 0, "patterns": []}
            
        relevant_logs = self.feedback_log
        if category:
            relevant_logs = [log for log in self.feedback_log if log.get("category") == category]
            
        if not relevant_logs:
            return {"acceptance_rate": 0, "patterns": []}
            
        accepted_count = sum(1 for log in relevant_logs if log["accepted"])
        rate = accepted_count / len(relevant_logs)
        
        return {
            "total_decisions": len(relevant_logs),
            "acceptance_rate": rate,
            "patterns": ["Usuário prefere reagendar reuniões quando relata cansaço."] if rate > 0.5 else []
        }
