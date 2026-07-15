import asyncio

import pytest

from action_engine import ActionEngine, ActionPlanner, AutomationEngine


class TestGovernedRulesAndTriggers:
    def test_event_trigger_is_idempotent_and_audited(self):
        engine = AutomationEngine(ActionPlanner())
        engine.add_rule(
            "message.received",
            lambda context: context.get("urgent") is True,
            {
                "action_type": "module.communication.notify",
                "priority": 50,
                "parameters": {"message_id": "{message_id}"},
            },
            trigger_type="communication.message.received",
        )

        first = engine.emit(
            "communication.message.received",
            {"urgent": True, "message_id": "msg-1"},
            event_id="evt-1",
        )
        replay = engine.emit(
            "communication.message.received",
            {"urgent": True, "message_id": "msg-1"},
            event_id="evt-1",
        )

        assert len(first) == 1
        assert first[0].parameters["message_id"] == "msg-1"
        assert first[0].metadata["automation_rule_id"] == "message.received"
        assert replay == []
        assert engine.get_status()["processed_events"] == 1

    def test_smart_rule_threshold_and_execution_limit(self):
        engine = AutomationEngine(ActionPlanner())
        engine.add_smart_rule(
            "financial.anomaly",
            lambda context: context["risk_score"],
            0.8,
            {"action_type": "module.finance.review", "priority": 70},
            trigger_type="finance.transaction.created",
            max_executions=1,
        )

        below = engine.emit(
            "finance.transaction.created",
            {"risk_score": 0.79},
            event_id="finance-1",
        )
        above = engine.emit(
            "finance.transaction.created",
            {"risk_score": 0.95},
            event_id="finance-2",
        )
        limited = engine.emit(
            "finance.transaction.created",
            {"risk_score": 0.99},
            event_id="finance-3",
        )

        assert below == []
        assert len(above) == 1
        assert limited == []
        assert engine.rules[0].executions == 1
        assert engine.rules[0].metadata["smart"] is True

    def test_faulty_rule_does_not_block_independent_rules(self):
        engine = AutomationEngine(ActionPlanner())
        engine.add_rule("broken", lambda _: 1 / 0, {"action_type": "broken"})
        engine.add_rule("healthy", lambda _: True, {"action_type": "general"})

        actions = engine.check_triggers({})

        assert len(actions) == 1
        assert engine.event_history[-1]["errors"][0]["rule_id"] == "broken"


class TestWorkflowEngine:
    def test_dependency_order_overrides_action_priority(self):
        engine = ActionEngine()
        executed_steps = []
        engine.register_module_action(
            "test",
            "record",
            lambda action: executed_steps.append(action.metadata["workflow_step_id"]),
        )
        engine.register_workflow(
            "customer-onboarding",
            [
                {
                    "step_id": "profile",
                    "action_template": {
                        "action_type": "module.test.record",
                        "priority": 10,
                        "parameters": {"customer_id": "{customer_id}"},
                    },
                },
                {
                    "step_id": "notify",
                    "depends_on": ["profile"],
                    "action_template": {
                        "action_type": "module.test.record",
                        "priority": 70,
                        "parameters": {"customer_id": "{customer_id}"},
                    },
                },
            ],
        )

        planned = engine.launch_workflow(
            "customer-onboarding",
            {"customer_id": "customer-42"},
            run_id="run-42",
        )
        replay = engine.launch_workflow(
            "customer-onboarding",
            {"customer_id": "customer-42"},
            run_id="run-42",
        )
        executed = engine.run_cycle()

        assert replay == []
        assert len(planned) == 2
        assert planned[0].parameters["customer_id"] == "customer-42"
        assert [action.metadata["workflow_step_id"] for action in executed] == ["profile", "notify"]
        assert executed_steps == ["profile", "notify"]

    def test_critical_workflow_action_requires_human_approval(self):
        engine = ActionEngine()
        engine.register_module_action("finance", "transfer", lambda action: {"authorized": True})
        engine.register_workflow(
            "financial-operation",
            [
                {
                    "step_id": "transfer",
                    "action_template": {
                        "action_type": "module.finance.transfer",
                        "priority": 90,
                        "parameters": {"amount": 100},
                    },
                }
            ],
        )

        actions = engine.launch_workflow("financial-operation", run_id="run-finance")

        assert engine.run_cycle() == []
        assert engine.get_pending_actions() == actions
        approved = engine.approve_action(actions[0].action_id)
        executed = engine.run_cycle()
        assert approved is actions[0]
        assert executed[0].metadata["result"] == {"authorized": True}

    def test_cycle_detection_rejects_invalid_workflow(self):
        engine = ActionEngine()
        with pytest.raises(ValueError, match="cycle"):
            engine.register_workflow(
                "invalid",
                [
                    {"step_id": "a", "depends_on": ["b"], "action_template": {}},
                    {"step_id": "b", "depends_on": ["a"], "action_template": {}},
                ],
            )


class FakeIntegrationSDK:
    async def execute(self, user_id, connector_id, operation, payload, required_scope="read"):
        await asyncio.sleep(0)
        return {
            "user_id": user_id,
            "connector_id": connector_id,
            "operation": operation,
            "payload": payload,
            "scope": required_scope,
        }

    async def invoke_extension(self, name, **payload):
        await asyncio.sleep(0)
        return {"extension": name, "payload": payload}

    async def sync(self, user_id, connector_id, **options):
        await asyncio.sleep(0)
        return {"user_id": user_id, "connector_id": connector_id, **options}


class TestIntegratedActions:
    def test_integration_sdk_extension_executes_through_action_engine(self):
        engine = ActionEngine()
        engine.bind_integration_sdk(FakeIntegrationSDK())
        actions = engine.process_decisions(
            [
                {
                    "decision_id": "integration-1",
                    "action_type": "integration.extension",
                    "priority": 40,
                    "confidence_score": 1.0,
                    "parameters": {
                        "extension": "finance.reconcile",
                        "payload": {"account_id": "acc-1"},
                    },
                }
            ]
        )

        executed = engine.run_cycle()

        assert executed == actions
        assert executed[0].metadata["result"] == {
            "extension": "finance.reconcile",
            "payload": {"account_id": "acc-1"},
        }
        assert engine.get_status()["integration_sdk_bound"] is True

    def test_failed_module_action_does_not_stop_next_action(self):
        engine = ActionEngine()
        engine.register_module_action("test", "fail", lambda _: (_ for _ in ()).throw(RuntimeError("boom")))
        engine.register_module_action("test", "ok", lambda _: "ok")
        engine.process_decisions(
            [
                {
                    "action_type": "module.test.fail",
                    "priority": 70,
                    "confidence_score": 1.0,
                },
                {
                    "action_type": "module.test.ok",
                    "priority": 60,
                    "confidence_score": 1.0,
                },
            ]
        )

        executed = engine.run_cycle()

        assert [action.execution_status for action in executed] == ["failed", "completed"]
        assert executed[0].metadata["error"] == "boom"
        assert executed[1].metadata["result"] == "ok"
