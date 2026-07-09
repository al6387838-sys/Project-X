from typing import Callable, Dict, Any, Optional
from datetime import datetime, timedelta
import time

from .event_queue import EventQueue
from .models import KernelEvent, EventPriority

class KernelScheduler:
    def __init__(self, event_queue: EventQueue):
        self.event_queue = event_queue
        self._scheduled_tasks: Dict[str, Dict[str, Any]] = {}
        self._task_counter = 0

    def schedule_event(self, event: KernelEvent, delay_seconds: int = 0):
        """Agenda um evento para ser processado após um certo atraso."""
        if delay_seconds > 0:
            scheduled_time = datetime.now() + timedelta(seconds=delay_seconds)
            task_id = f"scheduled_event_{self._task_counter}"
            self._task_counter += 1
            self._scheduled_tasks[task_id] = {
                "event": event,
                "scheduled_time": scheduled_time,
                "status": "pending"
            }
            return task_id
        else:
            self.event_queue.put(event)
            return event.event_id # Retorna o ID do evento se for imediato

    def process_scheduled_tasks(self):
        """Verifica e move tarefas agendadas para a fila de eventos quando o tempo chega."""
        now = datetime.now()
        tasks_to_remove = []
        for task_id, task_info in self._scheduled_tasks.items():
            if task_info["status"] == "pending" and task_info["scheduled_time"] <= now:
                self.event_queue.put(task_info["event"])
                task_info["status"] = "dispatched"
                tasks_to_remove.append(task_id)
        for task_id in tasks_to_remove:
            del self._scheduled_tasks[task_id]

    def get_scheduled_tasks_count(self) -> int:
        """Retorna o número de tarefas agendadas pendentes."""
        return len([t for t in self._scheduled_tasks.values() if t["status"] == "pending"])

