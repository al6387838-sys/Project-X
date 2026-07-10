"""
GAMMA-004: Event Streaming
LifeOS Global Cloud Platform

Architecture: Pub/Sub message bus with Dead Letter Queue support.
"""
import uuid
from typing import Callable, Dict, List
from dataclasses import dataclass, field

@dataclass
class Event:
    topic: str
    payload: Dict
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    retry_count: int = 0

class EventBus:
    def __init__(self):
        self.subscribers: Dict[str, List[Callable]] = {}
        self.dead_letter_queue: List[Event] = []
        self.MAX_RETRIES = 3

    def subscribe(self, topic: str, callback: Callable):
        if topic not in self.subscribers:
            self.subscribers[topic] = []
            
        # Support wildcard subscriptions (e.g., user.*)
        if topic.endswith("*"):
            self.subscribers[topic].append(callback)
        else:
            self.subscribers[topic].append(callback)

    def publish(self, event: Event):
        handlers = []
        # Exact match
        if event.topic in self.subscribers:
            handlers.extend(self.subscribers[event.topic])
            
        # Wildcard match
        for sub_topic in self.subscribers.keys():
            if sub_topic.endswith("*") and event.topic.startswith(sub_topic[:-1]):
                handlers.extend(self.subscribers[sub_topic])
                
        if not handlers:
            print(f"[WARN] No subscribers for {event.topic}")
            return
            
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                print(f"[ERROR] Handler failed: {str(e)}")
                self._handle_failure(event)

    def _handle_failure(self, event: Event):
        event.retry_count += 1
        if event.retry_count > self.MAX_RETRIES:
            print(f"[DLQ] Event {event.id} moved to Dead Letter Queue after {self.MAX_RETRIES} retries")
            self.dead_letter_queue.append(event)
        else:
            print(f"[RETRY] Re-queueing event {event.id} (Attempt {event.retry_count})")
            # In a real system, this would go to a retry queue with backoff
            self.publish(event)

if __name__ == "__main__":
    bus = EventBus()
    print("="*60)
    print("GAMMA-004: Event Streaming Bus")
    print("="*60)
    
    def on_user_created(event: Event):
        print(f"-> Processing user creation: {event.payload['email']}")
        
    def on_all_user_events(event: Event):
        print(f"-> Audit Log: Recorded {event.topic}")
        
    def failing_handler(event: Event):
        raise ValueError("Simulated processing failure")

    bus.subscribe("user.created", on_user_created)
    bus.subscribe("user.*", on_all_user_events)
    bus.subscribe("payment.processed", failing_handler)
    
    print("Publishing successful events:")
    bus.publish(Event(topic="user.created", payload={"email": "alex@lifeos.com"}))
    bus.publish(Event(topic="user.updated", payload={"id": "123"}))
    
    print("\nPublishing failing event (testing DLQ):")
    bus.publish(Event(topic="payment.processed", payload={"amount": 99.0}))
    
    print(f"\nDLQ Size: {len(bus.dead_letter_queue)}")
    print("✅ GAMMA-004: Event Streaming — COMPLETE")
