import pytest
from action_engine.models import Action, ActionGroup
from action_engine.engines import ActionEngine, ActionPlanner, ExecutionManager, AutomationEngine
from action_engine.managers import ApprovalManager, RollbackManager

class TestActionModels:
    def test_action_creation(self):
        action = Action(
            justification="Teste",
            origin="Unit Test",
            objective="Validar criação",
            expected_result="Sucesso"
        )
        assert action.execution_status == "pending"
        assert action.action_id is not None
        assert "Validar criação" in str(action)

    def test_action_group(self):
        group = ActionGroup(name="Grupo Teste")
        action = Action(objective="Ação 1")
        group.add_action(action)
        assert len(group.actions) == 1
        assert group.get_action(action.action_id).objective == "Ação 1"

class TestActionPlanner:
    def test_plan_from_decision(self):
        planner = ActionPlanner()
        decision = {
            "decision_id": "dec-123",
            "action_type": "email",
            "priority": 90,
            "reasoning": ["Enviar email importante"],
            "confidence_score": 0.95
        }
        actions = planner.plan_from_decision(decision)
        assert len(actions) == 1
        assert actions[0].priority == 90
        assert actions[0].approval_required is True # Prioridade > 80 exige aprovação

class TestExecutionManager:
    def test_enqueue_and_execute(self):
        manager = ExecutionManager()
        action = Action(priority=50, objective="Executar")
        manager.enqueue_action(action)
        assert manager.get_status_summary()["queued"] == 1
        
        executed = manager.execute_next()
        assert executed.execution_status == "completed"
        assert manager.get_status_summary()["completed"] == 1

    def test_pending_approval_queue(self):
        manager = ExecutionManager()
        action = Action(priority=50, approval_required=True)
        manager.enqueue_action(action)
        assert manager.get_status_summary()["pending_approval"] == 1
        assert manager.get_status_summary()["queued"] == 0

class TestApprovalManager:
    def test_approve_reject(self):
        manager = ApprovalManager()
        action = Action(objective="Crítica")
        manager.request_approval(action)
        
        approved = manager.approve(action.action_id)
        assert approved.execution_status == "approved"
        
        action2 = Action(objective="Outra")
        manager.request_approval(action2)
        rejected = manager.reject(action2.action_id, "Não seguro")
        assert rejected.execution_status == "rejected"
        assert rejected.metadata["rejection_reason"] == "Não seguro"

class TestRollbackManager:
    def test_rollback(self):
        manager = RollbackManager()
        action = Action(rollback_strategy="automatic", execution_status="completed")
        assert manager.can_rollback(action) is True
        
        success = manager.perform_rollback(action)
        assert success is True
        assert action.execution_status == "rolled_back"

class TestAutomationEngine:
    def test_automation_trigger(self):
        planner = ActionPlanner()
        engine = AutomationEngine(planner)
        
        # Regra: se 'temp' > 30, disparar ação
        engine.add_rule(
            "calor", 
            lambda ctx: ctx.get("temp", 0) > 30,
            {"action_type": "iot", "priority": 100}
        )
        
        actions = engine.check_triggers({"temp": 35})
        assert len(actions) == 1
        assert actions[0].action_type == "iot"
        
        actions_none = engine.check_triggers({"temp": 20})
        assert len(actions_none) == 0

class TestActionEngineIntegration:
    def test_full_cycle(self):
        engine = ActionEngine()
        decisions = [
            {"decision_id": "d1", "action_type": "msg", "priority": 50, "confidence_score": 0.9}
        ]
        
        # Processar decisões
        actions = engine.process_decisions(decisions)
        assert len(actions) == 1
        
        # Executar ciclo
        executed = engine.run_cycle()
        assert len(executed) == 1
        assert executed[0].execution_status == "completed"
        assert len(engine.get_history()) == 1
