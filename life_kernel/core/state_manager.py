from typing import Dict, Any
from datetime import datetime
from .models import KernelState, EngineStatus

class KernelStateManager:
    def __init__(self):
        self._state = KernelState()

    def update_engine_status(self, engine_name: str, status: EngineStatus):
        self._state.engine_statuses[engine_name] = status
        self._state.last_update = datetime.now()

    def get_engine_status(self, engine_name: str) -> EngineStatus:
        return self._state.engine_statuses.get(engine_name, EngineStatus.OFFLINE)

    def update_event_metrics(self, active_events_delta: int = 0, processed_events_delta: int = 0):
        self._state.active_events += active_events_delta
        self._state.total_events_processed += processed_events_delta
        self._state.last_update = datetime.now()

    def update_system_load(self, load: float):
        self._state.system_load = load
        self._state.last_update = datetime.now()

    def get_current_state(self) -> KernelState:
        return self._state

    def get_current_state_dict(self) -> Dict[str, Any]:
        return self._state.to_dict()
