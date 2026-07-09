from typing import Dict, Any, Callable, List
from .models import KernelEvent, EventPriority
from .event_queue import EventQueue

class KernelEventManager:
    def __init__(self):
        self.event_queue = EventQueue()
        self._subscribers: Dict[str, List[Callable[[KernelEvent], None]]] = {}

    def publish(self, event: KernelEvent):
        """Publica um evento na fila de eventos."""
        self.event_queue.put(event)

    def subscribe(self, event_type: str, handler: Callable[[KernelEvent], None]):
        """Assina um handler para um tipo específico de evento."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)

    def unsubscribe(self, event_type: str, handler: Callable[[KernelEvent], None]):
        """Remove a assinatura de um handler para um tipo específico de evento."""
        if event_type in self._subscribers:
            self._subscribers[event_type].remove(handler)

    def process_next_event(self):
        """Processa o próximo evento da fila de prioridade e o despacha para os subscribers."""
        event = self.event_queue.get()
        if event:
            if event.event_type in self._subscribers:
                for handler in self._subscribers[event.event_type]:
                    handler(event)
            return event
        return None

    def get_queue_size(self) -> int:
        """Retorna o tamanho atual da fila de eventos."""
        return self.event_queue.size()
