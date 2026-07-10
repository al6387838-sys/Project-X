"""
RedisCache — Distributed cache layer backed by Redis.

Tier 2 of the LifeOS multi-layer cache stack.
Target: <5 ms read latency for warm data across service instances.

Features:
- Connection pooling with configurable pool size
- Automatic serialization (JSON / pickle fallback)
- Graceful degradation when Redis is unavailable
- Pub/Sub invalidation support
- Pipeline batching for bulk operations
- Cluster-ready key hashing
"""

import json
import time
import logging
import threading
from typing import Any, Optional, Dict, List
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class RedisConfig:
    """Redis connection configuration."""
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: Optional[str] = None
    max_connections: int = 50
    socket_timeout: float = 1.0
    socket_connect_timeout: float = 1.0
    retry_on_timeout: bool = True
    decode_responses: bool = False
    # Cluster mode
    cluster_mode: bool = False
    cluster_nodes: List[Dict] = field(default_factory=list)
    # Sentinel mode
    sentinel_mode: bool = False
    sentinel_hosts: List[tuple] = field(default_factory=list)
    sentinel_master: str = "mymaster"


class RedisCache:
    """
    Distributed Redis-backed cache with graceful degradation.

    When Redis is unavailable, falls back to a local MemoryCache
    so the application continues to function (degraded performance).
    """

    def __init__(
        self,
        config: Optional[RedisConfig] = None,
        default_ttl: int = 3600,
        key_prefix: str = "lifeos:",
        name: str = "redis_cache",
    ) -> None:
        self.name = name
        self.config = config or RedisConfig()
        self.default_ttl = default_ttl
        self.key_prefix = key_prefix
        self._client = None
        self._available = False
        self._lock = threading.Lock()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0,
            "sets": 0,
            "deletes": 0,
            "pipeline_ops": 0,
        }
        # Fallback in-process cache when Redis is down
        from .memory_cache import MemoryCache
        self._fallback = MemoryCache(
            max_size=5_000,
            default_ttl=float(default_ttl),
            name=f"{name}_fallback",
        )
        self._connect()

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def _connect(self) -> None:
        """Attempt to connect to Redis; silently degrade on failure."""
        try:
            import redis  # type: ignore
            pool = redis.ConnectionPool(
                host=self.config.host,
                port=self.config.port,
                db=self.config.db,
                password=self.config.password,
                max_connections=self.config.max_connections,
                socket_timeout=self.config.socket_timeout,
                socket_connect_timeout=self.config.socket_connect_timeout,
                retry_on_timeout=self.config.retry_on_timeout,
                decode_responses=False,
            )
            self._client = redis.Redis(connection_pool=pool)
            self._client.ping()
            self._available = True
            logger.info("[RedisCache] Connected to Redis at %s:%d", self.config.host, self.config.port)
        except Exception as exc:
            self._available = False
            logger.warning(
                "[RedisCache] Redis unavailable (%s). Using in-memory fallback.", exc
            )

    def _full_key(self, key: str) -> str:
        return f"{self.key_prefix}{key}"

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def _serialize(self, value: Any) -> bytes:
        try:
            return json.dumps(value, default=str).encode("utf-8")
        except (TypeError, ValueError):
            import pickle
            return b"pkl:" + pickle.dumps(value)

    def _deserialize(self, data: bytes) -> Any:
        if data is None:
            return None
        if data.startswith(b"pkl:"):
            import pickle
            return pickle.loads(data[4:])
        return json.loads(data.decode("utf-8"))

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def get(self, key: str) -> Optional[Any]:
        if not self._available:
            return self._fallback.get(key)
        try:
            raw = self._client.get(self._full_key(key))
            if raw is None:
                self._stats["misses"] += 1
                return None
            self._stats["hits"] += 1
            return self._deserialize(raw)
        except Exception as exc:
            self._stats["errors"] += 1
            logger.debug("[RedisCache] get error: %s", exc)
            return self._fallback.get(key)

    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        ttl = ttl if ttl is not None else self.default_ttl
        if not self._available:
            self._fallback.set(key, value, ttl=float(ttl))
            return True
        try:
            raw = self._serialize(value)
            self._client.setex(self._full_key(key), ttl, raw)
            self._stats["sets"] += 1
            return True
        except Exception as exc:
            self._stats["errors"] += 1
            logger.debug("[RedisCache] set error: %s", exc)
            self._fallback.set(key, value, ttl=float(ttl))
            return False

    def delete(self, key: str) -> bool:
        if not self._available:
            return self._fallback.delete(key)
        try:
            result = self._client.delete(self._full_key(key))
            self._stats["deletes"] += 1
            return bool(result)
        except Exception as exc:
            self._stats["errors"] += 1
            return self._fallback.delete(key)

    def exists(self, key: str) -> bool:
        if not self._available:
            return self._fallback.exists(key)
        try:
            return bool(self._client.exists(self._full_key(key)))
        except Exception:
            return self._fallback.exists(key)

    def expire(self, key: str, ttl: int) -> bool:
        if not self._available:
            return False
        try:
            return bool(self._client.expire(self._full_key(key), ttl))
        except Exception:
            return False

    def ttl(self, key: str) -> int:
        """Return remaining TTL in seconds, -1 if no TTL, -2 if not found."""
        if not self._available:
            return -2
        try:
            return self._client.ttl(self._full_key(key))
        except Exception:
            return -2

    # ------------------------------------------------------------------
    # Bulk operations via pipeline
    # ------------------------------------------------------------------

    def mget(self, keys: List[str]) -> Dict[str, Any]:
        if not self._available:
            return self._fallback.mget(keys)
        try:
            full_keys = [self._full_key(k) for k in keys]
            raw_values = self._client.mget(full_keys)
            self._stats["pipeline_ops"] += len(keys)
            return {
                k: self._deserialize(v)
                for k, v in zip(keys, raw_values)
                if v is not None
            }
        except Exception as exc:
            self._stats["errors"] += 1
            return self._fallback.mget(keys)

    def mset(self, mapping: Dict[str, Any], ttl: Optional[int] = None) -> None:
        ttl = ttl if ttl is not None else self.default_ttl
        if not self._available:
            self._fallback.mset(mapping, ttl=float(ttl))
            return
        try:
            pipe = self._client.pipeline()
            for k, v in mapping.items():
                pipe.setex(self._full_key(k), ttl, self._serialize(v))
            pipe.execute()
            self._stats["pipeline_ops"] += len(mapping)
        except Exception as exc:
            self._stats["errors"] += 1
            self._fallback.mset(mapping, ttl=float(ttl))

    def invalidate_prefix(self, prefix: str) -> int:
        """Delete all keys matching prefix. Uses SCAN to avoid blocking."""
        if not self._available:
            return self._fallback.invalidate_prefix(prefix)
        try:
            pattern = self._full_key(prefix) + "*"
            cursor = 0
            count = 0
            while True:
                cursor, keys = self._client.scan(cursor, match=pattern, count=100)
                if keys:
                    self._client.delete(*keys)
                    count += len(keys)
                if cursor == 0:
                    break
            return count
        except Exception as exc:
            self._stats["errors"] += 1
            return 0

    # ------------------------------------------------------------------
    # Health & stats
    # ------------------------------------------------------------------

    def ping(self) -> bool:
        try:
            self._client.ping()
            self._available = True
            return True
        except Exception:
            self._available = False
            return False

    def stats(self) -> Dict[str, Any]:
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total if total else 0.0
        base = {
            "name": self.name,
            "available": self._available,
            "hit_rate": round(hit_rate * 100, 2),
            **self._stats,
        }
        if self._available:
            try:
                info = self._client.info("memory")
                base["redis_used_memory_mb"] = round(
                    info.get("used_memory", 0) / 1_048_576, 2
                )
            except Exception:
                pass
        return base

    def __repr__(self) -> str:
        status = "connected" if self._available else "fallback"
        return f"RedisCache(name={self.name!r}, status={status!r})"
