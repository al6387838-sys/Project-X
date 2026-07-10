"""
GAMMA-001: Global API Gateway
LifeOS Global Cloud Platform

Architecture: Central entry point for all API requests.
Handles routing, load balancing, versioning, and global rate limiting.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple
import time
import uuid
import random

class ApiVersion(Enum):
    V1 = "v1"
    V2 = "v2"
    V3 = "v3"
    V4 = "v4"  # LifeOS 4.0

class HttpMethod(Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"

@dataclass
class ApiRequest:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    method: HttpMethod = HttpMethod.GET
    path: str = "/"
    headers: Dict[str, str] = field(default_factory=dict)
    client_ip: str = "0.0.0.0"
    body: Dict = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

@dataclass
class ApiResponse:
    request_id: str
    status_code: int
    headers: Dict[str, str] = field(default_factory=dict)
    body: Dict = field(default_factory=dict)
    latency_ms: float = 0.0

class RateLimiter:
    """Global Token Bucket Rate Limiter."""
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens: Dict[str, float] = {}
        self.last_refill: Dict[str, float] = {}

    def allow_request(self, client_id: str) -> Tuple[bool, int]:
        now = time.time()
        
        if client_id not in self.tokens:
            self.tokens[client_id] = self.capacity
            self.last_refill[client_id] = now
            
        # Refill tokens
        time_passed = now - self.last_refill[client_id]
        refill = time_passed * self.refill_rate
        self.tokens[client_id] = min(self.capacity, self.tokens[client_id] + refill)
        self.last_refill[client_id] = now
        
        if self.tokens[client_id] >= 1.0:
            self.tokens[client_id] -= 1.0
            return True, int(self.tokens[client_id])
        return False, 0

class SmartLoadBalancer:
    """Smart Load Balancer with health checking and latency-based routing."""
    def __init__(self):
        self.backends: Dict[str, List[Dict]] = {
            "core": [
                {"id": "core-a", "health": 100, "latency": 12.5, "active": True},
                {"id": "core-b", "health": 100, "latency": 15.2, "active": True},
                {"id": "core-c", "health": 95, "latency": 22.1, "active": True}
            ],
            "companion": [
                {"id": "comp-a", "health": 100, "latency": 45.0, "active": True},
                {"id": "comp-b", "health": 100, "latency": 42.5, "active": True}
            ]
        }
        
    def get_optimal_backend(self, service: str) -> Optional[str]:
        if service not in self.backends:
            return None
            
        active_backends = [b for b in self.backends[service] if b["active"] and b["health"] > 80]
        if not active_backends:
            return None
            
        # Sort by latency (lowest first) + some randomness to prevent thundering herd
        active_backends.sort(key=lambda b: b["latency"] * random.uniform(0.9, 1.1))
        return active_backends[0]["id"]

class GlobalApiGateway:
    """Main API Gateway entry point."""
    def __init__(self):
        self.rate_limiter = RateLimiter(capacity=1000, refill_rate=50.0) # 50 req/sec
        self.load_balancer = SmartLoadBalancer()
        
        self.routes = {
            "/api/v4/core": "core",
            "/api/v4/companion": "companion",
            "/api/v4/memory": "core",
            "/api/v4/sync": "core"
        }
        
    def handle_request(self, request: ApiRequest) -> ApiResponse:
        start_time = time.time()
        client_id = request.headers.get("X-Client-ID", request.client_ip)
        
        # 1. Rate Limiting
        allowed, remaining = self.rate_limiter.allow_request(client_id)
        if not allowed:
            return self._build_response(request.id, 429, {"error": "Too Many Requests"}, start_time,
                                     {"X-RateLimit-Remaining": "0"})
            
        # 2. Versioning & Routing
        service = self._route_request(request.path)
        if not service:
            return self._build_response(request.id, 404, {"error": "Not Found"}, start_time)
            
        # 3. Load Balancing
        backend_id = self.load_balancer.get_optimal_backend(service)
        if not backend_id:
            return self._build_response(request.id, 503, {"error": "Service Unavailable"}, start_time)
            
        # 4. Simulate Backend Processing
        time.sleep(random.uniform(0.01, 0.05)) # Simulate processing latency
        
        headers = {
            "X-Backend-ID": backend_id,
            "X-RateLimit-Remaining": str(remaining),
            "X-API-Version": "v4"
        }
        
        return self._build_response(request.id, 200, {"status": "success", "data": f"Processed by {backend_id}"}, 
                                  start_time, headers)
                                  
    def _route_request(self, path: str) -> Optional[str]:
        for route, service in self.routes.items():
            if path.startswith(route):
                return service
        return None
        
    def _build_response(self, req_id: str, status: int, body: Dict, start_time: float, 
                      headers: Dict = None) -> ApiResponse:
        latency = (time.time() - start_time) * 1000
        return ApiResponse(
            request_id=req_id,
            status_code=status,
            headers=headers or {},
            body=body,
            latency_ms=latency
        )

# Demo
if __name__ == "__main__":
    gateway = GlobalApiGateway()
    print("="*60)
    print("GAMMA-001: Global API Gateway - Load Test")
    print("="*60)
    
    success_count = 0
    rate_limited = 0
    
    for i in range(15):
        req = ApiRequest(path="/api/v4/companion/ask", client_ip="192.168.1.100")
        res = gateway.handle_request(req)
        if res.status_code == 200:
            success_count += 1
            print(f"[200 OK] Routed to {res.headers['X-Backend-ID']} in {res.latency_ms:.1f}ms")
        elif res.status_code == 429:
            rate_limited += 1
            print(f"[429] Rate Limited")
            
    print(f"\nResults: {success_count} Success | {rate_limited} Rate Limited")
    print("✅ GAMMA-001: API Gateway Engine — COMPLETE")
