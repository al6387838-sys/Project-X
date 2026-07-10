"""
MemoryCache — In-process LRU cache with TTL support.

Tier 1 of the LifeOS multi-layer cache stack.
Target: sub-millisecond read latency for hot data.
"""

import time
import threading
from collections import OrderedDict
from typing import Any, Optional, Dict, Tuple
from dataclasses import dataclass, field


@dataclass
class CacheEntry:
    """A single cache entry with metadata."""
    value: Any
    created_at: float = field(default_factory=time.monotonic)
    accessed_at: float = field(default_factory=time.monotonic)
    ttl: Optional[float] = None  # seconds; None = immortal
    hit_count: int = 0

    @property
    def is_expired(self) -> bool:
        if self.ttl is None:
            return False
        return (time.monotonic() - self.created_at) > self.ttl

    def touch(self) -> None:
        self.accessed_at = time.monotonic()
        self.hit_count += 1


class MemoryCache:
    """
    Thread-safe in-memory LRU cache with TTL eviction.

    Capacity: configurable max entries (default 10 000).
    Eviction: LRU when capacity is reached + TTL expiry on access.
    Thread safety: RLock per operation.
    """

    def __init__(
        self,
        max_size: int = 10_000,
        default_ttl: Optional[float] = 300.0,
        name: str = "memory_cache",
    ) -> None:
        self.name = name
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._store: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = threading.RLock()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "expirations": 0,
            "sets": 0,
        }

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def get(self, key: str) -> Optional[Any]:
        """Return cached value or None if missing/expired."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._stats["misses"] += 1
                return None
            if entry.is_expired:
                del self._store[key]
                self._stats["misses"] += 1
                self._stats["expirations"] += 1
                return None
            # Move to end (most recently used)
            self._store.move_to_end(key)
            entry.touch()
            self._stats["hits"] += 1
            return entry.value

    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[float] = None,
    ) -> None:
        """Store a value. Evicts LRU entry if at capacity."""
        ttl = ttl if ttl is not None else self.default_ttl
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = CacheEntry(value=value, ttl=ttl)
            self._stats["sets"] += 1
            if len(self._store) > self.max_size:
                self._store.popitem(last=False)
                self._stats["evictions"] += 1

    def delete(self, key: str) -> bool:
        """Remove a key. Returns True if key existed."""
        with self._lock:
            return self._store.pop(key, None) is not None

    def exists(self, key: str) -> bool:
        """Check if key exists and is not expired."""
        return self.get(key) is not None

    def clear(self) -> None:
        """Flush all entries."""
        with self._lock:
            self._store.clear()

    def invalidate_prefix(self, prefix: str) -> int:
        """Remove all keys starting with prefix. Returns count removed."""
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            return len(keys)

    # ------------------------------------------------------------------
    # Bulk / convenience
    # ------------------------------------------------------------------

    def mget(self, keys: list) -> Dict[str, Any]:
        """Retrieve multiple keys at once."""
        return {k: self.get(k) for k in keys}

    def mset(self, mapping: Dict[str, Any], ttl: Optional[float] = None) -> None:
        """Store multiple key-value pairs at once."""
        for k, v in mapping.items():
            self.set(k, v, ttl=ttl)

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._store)

    @property
    def hit_rate(self) -> float:
        total = self._stats["hits"] + self._stats["misses"]
        return self._stats["hits"] / total if total else 0.0

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "name": self.name,
                "size": len(self._store),
                "max_size": self.max_size,
                "hit_rate": round(self.hit_rate * 100, 2),
                **self._stats,
            }

    def __repr__(self) -> str:
        return (
            f"MemoryCache(name={self.name!r}, "
            f"size={self.size}/{self.max_size}, "
            f"hit_rate={self.hit_rate:.1%})"
        )
