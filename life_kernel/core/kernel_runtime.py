from typing import Dict, Any, Callable, Optional
from datetime import datetime, timedelta
import time
import threading

from .event_manager import KernelEventManager
from .state_manager import KernelStateManager
from .scheduler import KernelScheduler
from .models import KernelEvent, EventPriority, EngineStatus

# Mock de Engines do LifeOS para simular a comunicação via Kernel
class MockEngine:
    def __init__(self, name: str, event_manager: KernelEventManager, state_manager: KernelStateManager):
        self.name = name
        self.event_manager = event_manager
        self.state_manager = state_manager
        self.state_manager.update_engine_status(self.name, EngineStatus.ONLINE)

    def handle_event(self, event: KernelEvent):
        self.state_manager.update_engine_status(self.name, EngineStatus.BUSY)
        # Simula processamento
        time.sleep(0.01) # Reduzido para acelerar testes
        self.state_manager.update_engine_status(self.name, EngineStatus.ONLINE)
        # Pode publicar um novo evento como resultado
        if event.event_type == "USER_ACTION":
            new_event = KernelEvent("ACTION_PROCESSED", self.name, {"original_action": event.payload["action"]})
            self.event_manager.publish(new_event)

class KernelMonitor:
    def __init__(self, state_manager: KernelStateManager, event_manager: KernelEventManager):
        self.state_manager = state_manager
        self.event_manager = event_manager

    def perform_health_check(self) -> Dict[str, Any]:
        current_state = self.state_manager.get_current_state()
        health_report = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "HEALTHY",
            "engine_health": {},
            "queue_status": {
                "event_queue_size": self.event_manager.get_queue_size(),
                "execution_queue_size": self.event_manager.event_queue.execution_queue_size()
            },
            "system_load": current_state.system_load
        }

        for engine, status in current_state.engine_statuses.items():
            if status == EngineStatus.ERROR:
                health_report["overall_status"] = "DEGRADED"
                health_report["engine_health"][engine] = "ERROR"
            elif status == EngineStatus.RECOVERING:
                health_report["overall_status"] = "DEGRADED"
                health_report["engine_health"][engine] = "RECOVERING"
            else:
                health_report["engine_health"][engine] = status.value
        
        if health_report["overall_status"] == "DEGRADED":
            print(f"[KernelMonitor] ALERTA: Sistema em estado DEGRADADO. Detalhes: {health_report}")

        return health_report

    def attempt_recovery(self, engine_name: str):
        print(f"[KernelMonitor] Tentando recuperação para o engine: {engine_name}")
        self.state_manager.update_engine_status(engine_name, EngineStatus.RECOVERING)
        # Simula uma tentativa de reinício ou reconfiguração
        time.sleep(0.5)
        # Para demonstração, assume que a recuperação foi bem-sucedida
        self.state_manager.update_engine_status(engine_name, EngineStatus.ONLINE)
        print(f"[KernelMonitor] Engine {engine_name} recuperado com sucesso.")
        self.event_manager.publish(KernelEvent("ENGINE_RECOVERED", "KernelMonitor", {"engine": engine_name}))


class KernelRuntime:
    def __init__(self):
        self.event_manager = KernelEventManager()
        self.state_manager = KernelStateManager()
        self.scheduler = KernelScheduler(self.event_manager.event_queue)
        self.monitor = KernelMonitor(self.state_manager, self.event_manager)
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self.registered_engines: Dict[str, MockEngine] = {}

        # Registrar engines mock para demonstração
        self.register_engine(MockEngine("LifeGraph", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("MemoryEngine", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("ContextEngine", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("DecisionEngine", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("ActionEngine", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("FutureEngine", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("MissionEngine", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("Companion", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("EvolutionEngine", self.event_manager, self.state_manager))
        self.register_engine(MockEngine("TrustEngine", self.event_manager, self.state_manager))

        # Assinar engines a eventos genéricos para demonstração
        for engine_name, engine_instance in self.registered_engines.items():
            self.event_manager.subscribe("USER_ACTION", engine_instance.handle_event)
            self.event_manager.subscribe("SYSTEM_EVENT", engine_instance.handle_event)
            self.event_manager.subscribe("ACTION_PROCESSED", engine_instance.handle_event)

    def register_engine(self, engine_instance: MockEngine):
        self.registered_engines[engine_instance.name] = engine_instance
        self.state_manager.update_engine_status(engine_instance.name, EngineStatus.ONLINE)

    def start(self):
        if not self._running:
            print("[KernelRuntime] Iniciando...")
            self._running = True
            self._thread = threading.Thread(target=self._run_loop)
            self._thread.start()
            # Publicar evento de inicialização do Kernel
            self.event_manager.publish(KernelEvent("KERNEL_STARTED", "KernelRuntime", {"status": "online"}, priority=EventPriority.CRITICAL))

    def stop(self):
        if self._running:
            print("[KernelRuntime] Parando...")
            self._running = False
            if self._thread:
                self._thread.join()
            print("[KernelRuntime] Parado.")

    def _run_loop(self):
        while self._running:
            self.scheduler.process_scheduled_tasks()
            event = self.event_manager.process_next_event()
            if event:
                self.state_manager.update_event_metrics(active_events_delta=1, processed_events_delta=1)
                # O evento já foi despachado para os handlers pelo event_manager.process_next_event()
            else:
                self.state_manager.update_event_metrics(active_events_delta=0, processed_events_delta=0)
                time.sleep(0.01) # Pequena pausa para evitar busy-waiting
            
            # Realizar health check periodicamente
            if datetime.now().second % 10 == 0: # A cada 10 segundos para demonstração
                self.monitor.perform_health_check()
            self.state_manager.update_system_load(self.event_manager.get_queue_size() + self.scheduler.get_scheduled_tasks_count())

    def publish_event(self, event_type: str, source: str, payload: Dict[str, Any], priority: EventPriority = EventPriority.MEDIUM, target: Optional[str] = None):
        event = KernelEvent(event_type, source, payload, priority, target)
        self.event_manager.publish(event)
        print(f"[KernelRuntime] Publicou evento: {event.event_type} de {event.source}")

    def get_current_state(self) -> Dict[str, Any]:
        return self.state_manager.get_current_state_dict()

    def get_event_queue_size(self) -> int:
        return self.event_manager.get_queue_size()

    def get_scheduled_tasks_count(self) -> int:
        return self.scheduler.get_scheduled_tasks_count()

    def get_health_report(self) -> Dict[str, Any]:
        return self.monitor.perform_health_check()

    def trigger_recovery(self, engine_name: str):
        self.monitor.attempt_recovery(engine_name)
