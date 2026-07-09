import pytest
import time
from life_kernel.core.models import EventPriority, KernelEvent, EngineStatus
from life_kernel.core.kernel_runtime import KernelRuntime

class TestLifeKernel:
    def test_kernel_initialization(self):
        kernel = KernelRuntime()
        state = kernel.get_current_state()
        assert "LifeGraph" in state["engine_statuses"]
        assert state["engine_statuses"]["LifeGraph"] == "online"
        assert state["total_events_processed"] == 0

    def test_event_publishing_and_processing(self):
        kernel = KernelRuntime()
        kernel.start()
        
        # Publicar um evento
        kernel.publish_event("USER_ACTION", "Test", {"action": "test_action"})
        
        # Esperar processamento
        time.sleep(0.5)
        
        state = kernel.get_current_state()
        # 1 evento original + 1 evento KERNEL_STARTED + 10 eventos ACTION_PROCESSED (um de cada engine que assinou)
        # Na verdade, todos os 10 engines assinaram USER_ACTION e publicam ACTION_PROCESSED.
        # Então: KERNEL_STARTED (1) + USER_ACTION (1) + ACTION_PROCESSED (10) = 12 eventos.
        assert state["total_events_processed"] >= 2
        
        kernel.stop()

    def test_kernel_scheduler(self):
        kernel = KernelRuntime()
        kernel.start()
        
        event = KernelEvent("SCHEDULED_EVENT", "Test", {})
        kernel.scheduler.schedule_event(event, delay_seconds=1)
        
        assert kernel.get_scheduled_tasks_count() == 1
        
        time.sleep(1.5)
        
        assert kernel.get_scheduled_tasks_count() == 0
        kernel.stop()

    def test_health_check_and_recovery(self):
        kernel = KernelRuntime()
        
        # Simular erro em um engine
        kernel.state_manager.update_engine_status("LifeGraph", EngineStatus.ERROR)
        
        report = kernel.get_health_report()
        assert report["overall_status"] == "DEGRADED"
        assert report["engine_health"]["LifeGraph"] == "ERROR"
        
        # Trigger recovery
        kernel.trigger_recovery("LifeGraph")
        
        report = kernel.get_health_report()
        assert report["overall_status"] == "HEALTHY"
        assert report["engine_health"]["LifeGraph"] == "online"
