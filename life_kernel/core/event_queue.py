from queue import PriorityQueue, Queue
from typing import Dict, Any, Optional
from .models import KernelEvent, EventPriority

class EventQueue:
    def __init__(self):
        self._priority_queue = PriorityQueue()
        self._execution_queue = Queue()
        self._event_counter = 0

    def put(self, event: KernelEvent):
        # PriorityQueue ordena pelo primeiro elemento da tupla. EventPriority.value é um int.
        # Adicionamos um contador para garantir ordem de chegada para eventos de mesma prioridade.
        self._priority_queue.put((event.priority.value, self._event_counter, event))
        self._event_counter += 1

    def get(self) -> Optional[KernelEvent]:
        if not self._priority_queue.empty():
            _, _, event = self._priority_queue.get()
            return event
        return None

    def is_empty(self) -> bool:
        return self._priority_queue.empty()

    def size(self) -> int:
        return self._priority_queue.qsize()

    def put_for_execution(self, event: KernelEvent):
        self._execution_queue.put(event)

    def get_for_execution(self) -> Optional[KernelEvent]:
        if not self._execution_queue.empty():
            return self._execution_queue.get()
        return None

    def execution_queue_size(self) -> int:
        return self._execution_queue.qsize()
