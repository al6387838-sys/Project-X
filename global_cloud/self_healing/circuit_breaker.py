"""
GAMMA-006: Self-Healing Infrastructure
LifeOS Global Cloud Platform

Architecture: Circuit Breaker pattern with Auto Recovery.
"""
import time
from enum import Enum
from typing import Callable, Any

class CircuitState(Enum):
    CLOSED = "CLOSED"     # Normal operation, requests flow freely
    OPEN = "OPEN"         # Failing, requests are blocked fast
    HALF_OPEN = "HALF_OPEN" # Testing recovery, limited requests allowed

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_timeout: float = 2.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0.0

    def call(self, func: Callable, *args, **kwargs) -> Any:
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                print("[CIRCUIT] Timeout reached, entering HALF_OPEN state")
                self.state = CircuitState.HALF_OPEN
            else:
                raise Exception("Circuit Breaker is OPEN - Request Blocked")

        try:
            result = func(*args, **kwargs)
            if self.state == CircuitState.HALF_OPEN:
                print("[CIRCUIT] Call succeeded in HALF_OPEN, recovering to CLOSED")
                self.reset()
            return result
            
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            print(f"[CIRCUIT] Call failed ({self.failure_count}/{self.failure_threshold})")
            
            if self.failure_count >= self.failure_threshold:
                print("[CIRCUIT] Threshold reached, entering OPEN state")
                self.state = CircuitState.OPEN
            raise e

    def reset(self):
        self.state = CircuitState.CLOSED
        self.failure_count = 0

if __name__ == "__main__":
    print("="*60)
    print("GAMMA-006: Circuit Breaker Auto Recovery")
    print("="*60)
    
    cb = CircuitBreaker()
    
    def unreliable_service(should_fail: bool):
        if should_fail: raise ValueError("Service Timeout")
        return "Success"
        
    for i in range(5):
        try:
            print(f"Attempt {i+1}: ", end="")
            res = cb.call(unreliable_service, should_fail=True)
        except Exception as e:
            print(f"Error: {e}")
            
    print("\nWaiting for recovery timeout (2.1s)...")
    time.sleep(2.1)
    
    try:
        print(f"Attempt 6 (Recovery): ", end="")
        res = cb.call(unreliable_service, should_fail=False)
        print(res)
    except Exception as e:
        print(f"Error: {e}")
        
    print("\n✅ GAMMA-006: Self-Healing — COMPLETE")
