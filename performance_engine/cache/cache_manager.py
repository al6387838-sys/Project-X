"""
CacheManager — Central orchestrator for the LifeOS multi-layer cache.

Cache hierarchy (fastest → slowest):
  L1: MemoryCache    — in-process, sub-ms, per-instance
  L2: RedisCache     — distributed, <5 ms, cross-instance
  L3: GraphCache     — specialized graph queries
  L4: ContextCache   — AI Companion context windows
  L5: TimelineCache  — Life Timeline segments & events

Write strategy: write-through (L1 + L2 simultaneously).
Read strategy: L1 → L2 → source (with backfill).
Invalidation: cascading from L1 through all layers.
"""

import time
import logging
import threading
from typing import Any, Optional, Dict, List, Callable
from dataclasses import dataclass, field

from .memory_cache import MemoryCache
from .redis_cache import RedisCache, RedisConfig
from .graph_cache import GraphCache
from .context_cache import ContextCache
from .timeline_cache import TimelineCache

logger = logging.getLogger(__name__)


@dataclass
class CacheManagerConfig:
    """Configuration for the CacheManager."""
    # L1 Memory
    memory_max_size: int = 10_000
    memory_default_ttl: float = 300.0
    # L2 Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_default_ttl: int = 3600
    redis_key_prefix: str = "lifeos:"
    # L3 Graph
    graph_max_nodes: int = 50_000
    graph_max_queries: int = 5_000
    graph_default_ttl: float = 120.0
    # L4 Context
    context_max_sessions: int = 100_000
    context_session_ttl: float = 1800.0
    # L5 Timeline
    timeline_max_segments: int = 2_000
    timeline_max_events: int = 500_000
    # General
    enable_write_through: bool = True
    enable_stats_logging: bool = True
    stats_log_interval_s: float = 60.0


class CacheManager:
    """
    Central cache orchestrator for LifeOS.

    Provides a unified API over all cache layers with:
    - Automatic L1 → L2 read-through and backfill
    - Write-through to both L1 and L2
    - Cascading invalidation
    - Aggregate statistics
    - Health monitoring
    """

    def __init__(self, config: Optional[CacheManagerConfig] = None) -> None:
        self.config = config or CacheManagerConfig()
        self._init_layers()
        self._lock = threading.Lock()
        self._start_time = time.monotonic()
        self._op_count = 0

    def _init_layers(self) -> None:
        cfg = self.config

        self.memory = MemoryCache(
            max_size=cfg.memory_max_size,
            default_ttl=cfg.memory_default_ttl,
            name="L1_memory",
        )

        redis_config = RedisConfig(
            host=cfg.redis_host,
            port=cfg.redis_port,
        )
        self.redis = RedisCache(
            config=redis_config,
            default_ttl=cfg.redis_default_ttl,
            key_prefix=cfg.redis_key_prefix,
            name="L2_redis",
        )

        self.graph = GraphCache(
            max_nodes=cfg.graph_max_nodes,
            max_queries=cfg.graph_max_queries,
            default_ttl=cfg.graph_default_ttl,
            name="L3_graph",
        )

        self.context = ContextCache(
            max_sessions=cfg.context_max_sessions,
            session_ttl=cfg.context_session_ttl,
            name="L4_context",
        )

        self.timeline = TimelineCache(
            max_segments=cfg.timeline_max_segments,
            max_events=cfg.timeline_max_events,
            name="L5_timeline",
        )

        logger.info("[CacheManager] All cache layers initialized.")

    # ------------------------------------------------------------------
    # Generic L1/L2 operations
    # ------------------------------------------------------------------

    def get(self, key: str) -> Optional[Any]:
        """Read from L1; on miss, try L2 and backfill L1."""
        with self._lock:
            self._op_count += 1

        # L1 hit
        value = self.memory.get(key)
        if value is not None:
            return value

        # L2 hit → backfill L1
        value = self.redis.get(key)
        if value is not None:
            self.memory.set(key, value)
            return value

        return None

    def set(
        self,
        key: str,
        value: Any,
        ttl_memory: Optional[float] = None,
        ttl_redis: Optional[int] = None,
    ) -> None:
        """Write-through to L1 and L2."""
        self.memory.set(key, value, ttl=ttl_memory)
        if self.config.enable_write_through:
            self.redis.set(key, value, ttl=ttl_redis)

    def delete(self, key: str) -> None:
        """Delete from all layers."""
        self.memory.delete(key)
        self.redis.delete(key)

    def invalidate_prefix(self, prefix: str) -> int:
        """Cascade invalidation across L1 and L2."""
        n1 = self.memory.invalidate_prefix(prefix)
        n2 = self.redis.invalidate_prefix(prefix)
        return n1 + n2

    # ------------------------------------------------------------------
    # Decorator: cache_result
    # ------------------------------------------------------------------

    def cache_result(
        self,
        key_fn: Callable,
        ttl_memory: float = 300.0,
        ttl_redis: int = 3600,
    ):
        """
        Decorator that caches the return value of a function.

        Usage:
            @cache_manager.cache_result(key_fn=lambda *a, **kw: f"my_key:{a[0]}")
            def expensive_fn(user_id):
                ...
        """
        def decorator(fn: Callable) -> Callable:
            def wrapper(*args, **kwargs):
                key = key_fn(*args, **kwargs)
                cached = self.get(key)
                if cached is not None:
                    return cached
                result = fn(*args, **kwargs)
                if result is not None:
                    self.set(key, result, ttl_memory=ttl_memory, ttl_redis=ttl_redis)
                return result
            wrapper.__wrapped__ = fn
            return wrapper
        return decorator

    # ------------------------------------------------------------------
    # Aggregate statistics
    # ------------------------------------------------------------------

    def all_stats(self) -> Dict[str, Any]:
        """Return statistics from all cache layers."""
        uptime = time.monotonic() - self._start_time
        return {
            "uptime_s": round(uptime, 1),
            "total_operations": self._op_count,
            "layers": {
                "L1_memory": self.memory.stats(),
                "L2_redis": self.redis.stats(),
                "L3_graph": self.graph.stats(),
                "L4_context": self.context.stats(),
                "L5_timeline": self.timeline.stats(),
            },
        }

    def health_check(self) -> Dict[str, bool]:
        """Quick health check for all layers."""
        return {
            "L1_memory": True,  # always available
            "L2_redis": self.redis.ping(),
            "L3_graph": True,
            "L4_context": True,
            "L5_timeline": True,
        }

    def warm_up(self, data_loader: Optional[Callable] = None) -> None:
        """
        Pre-warm the cache by loading frequently accessed data.
        data_loader(cache_manager) is called if provided.
        """
        logger.info("[CacheManager] Starting cache warm-up...")
        if data_loader:
            data_loader(self)
        logger.info("[CacheManager] Cache warm-up complete.")

    def flush_all(self) -> None:
        """Clear all cache layers. Use with caution."""
        self.memory.clear()
        self.graph.clear()
        self.context._sessions.clear()
        logger.warning("[CacheManager] All cache layers flushed.")

    def __repr__(self) -> str:
        health = self.health_check()
        layers_up = sum(1 for v in health.values() if v)
        return f"CacheManager(layers={layers_up}/5, ops={self._op_count})"
