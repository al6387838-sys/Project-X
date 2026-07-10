"""
GAMMA-003: Distributed Cache
LifeOS Global Cloud Platform

Architecture: Redis Cluster simulation with cache invalidation and memory optimization.
"""
import time
from typing import Any, Dict, Optional

class DistributedCache:
    def __init__(self, max_memory_mb: int = 1024):
        self.store: Dict[str, Dict[str, Any]] = {}
        self.max_memory_mb = max_memory_mb
        self.current_memory_mb = 0.0
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        if key in self.store:
            item = self.store[key]
            if item["expires_at"] and time.time() > item["expires_at"]:
                del self.store[key]
                self.misses += 1
                return None
            self.hits += 1
            item["last_accessed"] = time.time()
            return item["value"]
        self.misses += 1
        return None

    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        # Simulate memory usage (rough estimation)
        item_size_mb = len(str(value)) / (1024 * 1024)
        
        # Evict if full (LRU policy)
        while self.current_memory_mb + item_size_mb > self.max_memory_mb and self.store:
            lru_key = min(self.store.keys(), key=lambda k: self.store[k]["last_accessed"])
            del self.store[lru_key]
            self.current_memory_mb -= 0.1 # Mock reduction
            
        self.store[key] = {
            "value": value,
            "expires_at": time.time() + ttl_seconds if ttl_seconds else None,
            "last_accessed": time.time()
        }
        self.current_memory_mb += item_size_mb

    def invalidate(self, pattern: str):
        """Invalidate keys matching pattern."""
        keys_to_delete = [k for k in self.store.keys() if k.startswith(pattern.replace("*", ""))]
        for k in keys_to_delete:
            del self.store[k]
            
    def get_stats(self) -> Dict:
        total = self.hits + self.misses
        hit_ratio = (self.hits / total * 100) if total > 0 else 0
        return {
            "keys": len(self.store),
            "hit_ratio": f"{hit_ratio:.1f}%",
            "memory_usage_mb": f"{self.current_memory_mb:.2f} / {self.max_memory_mb}"
        }

if __name__ == "__main__":
    cache = DistributedCache()
    print("="*60)
    print("GAMMA-003: Distributed Cache")
    print("="*60)
    cache.set("user:123:profile", {"name": "Alex", "tier": "premium"})
    cache.set("user:123:settings", {"theme": "dark"})
    
    print(f"Get Profile: {cache.get('user:123:profile')}")
    print(f"Get Missing: {cache.get('user:404:profile')}")
    
    print("\nInvalidating user:123:*")
    cache.invalidate("user:123:*")
    print(f"Get Profile after invalidation: {cache.get('user:123:profile')}")
    
    print(f"\nStats: {cache.get_stats()}")
    print("✅ GAMMA-003: Distributed Cache — COMPLETE")
