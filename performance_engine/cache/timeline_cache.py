"""
TimelineCache — Specialized cache for Life Timeline queries.

Optimized for:
- Time-range event lookups
- Decade/year/month aggregations
- Event relationship chains
- Timeline rendering snapshots

Target: Timeline queries < 200 ms.
"""

import time
import threading
import hashlib
import json
from typing import Any, Optional, Dict, List, Tuple
from dataclasses import dataclass, field
from datetime import datetime, date


@dataclass
class TimelineSegment:
    """A cached segment of the timeline (e.g., a year or decade)."""
    segment_key: str       # e.g. "2024", "2020s", "2024-03"
    events: List[Any]
    aggregations: Dict
    created_at: float = field(default_factory=time.monotonic)
    ttl: float = 300.0
    hit_count: int = 0

    @property
    def is_expired(self) -> bool:
        return (time.monotonic() - self.created_at) > self.ttl

    def touch(self) -> None:
        self.hit_count += 1


class TimelineCache:
    """
    Specialized cache for Life Timeline data.

    Provides:
    - Segment cache: year/month/decade buckets
    - Range query cache: arbitrary date-range results
    - Event detail cache: individual event data
    - Aggregation cache: stats per period
    """

    def __init__(
        self,
        max_segments: int = 2_000,
        max_events: int = 500_000,
        max_range_queries: int = 10_000,
        default_ttl: float = 300.0,
        name: str = "timeline_cache",
    ) -> None:
        self.name = name
        self.max_segments = max_segments
        self.max_events = max_events
        self.max_range_queries = max_range_queries
        self.default_ttl = default_ttl
        self._lock = threading.RLock()

        self._segments: Dict[str, TimelineSegment] = {}
        self._events: Dict[str, Any] = {}           # event_id -> event data
        self._range_queries: Dict[str, Any] = {}    # hash -> result
        self._aggregations: Dict[str, Any] = {}     # period -> stats

        self._stats = {
            "segment_hits": 0, "segment_misses": 0,
            "event_hits": 0, "event_misses": 0,
            "range_hits": 0, "range_misses": 0,
        }

    # ------------------------------------------------------------------
    # Segment cache (year / month / decade)
    # ------------------------------------------------------------------

    def get_segment(self, user_id: str, segment_key: str) -> Optional[TimelineSegment]:
        key = f"{user_id}:{segment_key}"
        with self._lock:
            seg = self._segments.get(key)
            if seg is None or seg.is_expired:
                if seg and seg.is_expired:
                    del self._segments[key]
                self._stats["segment_misses"] += 1
                return None
            seg.touch()
            self._stats["segment_hits"] += 1
            return seg

    def set_segment(
        self,
        user_id: str,
        segment_key: str,
        events: List[Any],
        aggregations: Optional[Dict] = None,
        ttl: Optional[float] = None,
    ) -> None:
        key = f"{user_id}:{segment_key}"
        ttl = ttl if ttl is not None else self.default_ttl
        with self._lock:
            if len(self._segments) >= self.max_segments:
                self._evict_oldest(self._segments)
            self._segments[key] = TimelineSegment(
                segment_key=segment_key,
                events=events,
                aggregations=aggregations or {},
                ttl=ttl,
            )

    def invalidate_segment(self, user_id: str, segment_key: str) -> None:
        key = f"{user_id}:{segment_key}"
        with self._lock:
            self._segments.pop(key, None)

    # ------------------------------------------------------------------
    # Individual event cache
    # ------------------------------------------------------------------

    def get_event(self, event_id: str) -> Optional[Any]:
        with self._lock:
            data = self._events.get(event_id)
            if data is None:
                self._stats["event_misses"] += 1
                return None
            self._stats["event_hits"] += 1
            return data

    def set_event(self, event_id: str, data: Any) -> None:
        with self._lock:
            if len(self._events) >= self.max_events:
                # Simple eviction: remove 5% oldest by insertion order
                to_remove = list(self._events.keys())[: len(self._events) // 20]
                for k in to_remove:
                    del self._events[k]
            self._events[event_id] = data

    def invalidate_event(self, event_id: str) -> None:
        with self._lock:
            self._events.pop(event_id, None)

    # ------------------------------------------------------------------
    # Range query cache
    # ------------------------------------------------------------------

    @staticmethod
    def _range_key(user_id: str, start: Any, end: Any, filters: Any = None) -> str:
        raw = json.dumps(
            {"u": user_id, "s": str(start), "e": str(end), "f": filters},
            sort_keys=True,
        )
        return hashlib.sha256(raw.encode()).hexdigest()[:20]

    def get_range(
        self,
        user_id: str,
        start: Any,
        end: Any,
        filters: Any = None,
    ) -> Optional[Any]:
        key = self._range_key(user_id, start, end, filters)
        with self._lock:
            entry = self._range_queries.get(key)
            if entry is None:
                self._stats["range_misses"] += 1
                return None
            if (time.monotonic() - entry["ts"]) > entry["ttl"]:
                del self._range_queries[key]
                self._stats["range_misses"] += 1
                return None
            self._stats["range_hits"] += 1
            return entry["data"]

    def set_range(
        self,
        user_id: str,
        start: Any,
        end: Any,
        data: Any,
        filters: Any = None,
        ttl: Optional[float] = None,
    ) -> None:
        key = self._range_key(user_id, start, end, filters)
        ttl = ttl if ttl is not None else self.default_ttl
        with self._lock:
            if len(self._range_queries) >= self.max_range_queries:
                self._evict_oldest_dict(self._range_queries, "ts")
            self._range_queries[key] = {
                "data": data,
                "ts": time.monotonic(),
                "ttl": ttl,
            }

    # ------------------------------------------------------------------
    # Aggregation cache
    # ------------------------------------------------------------------

    def set_aggregation(self, user_id: str, period: str, stats: Dict, ttl: float = 600.0) -> None:
        key = f"{user_id}:{period}"
        with self._lock:
            self._aggregations[key] = {
                "data": stats,
                "ts": time.monotonic(),
                "ttl": ttl,
            }

    def get_aggregation(self, user_id: str, period: str) -> Optional[Dict]:
        key = f"{user_id}:{period}"
        with self._lock:
            entry = self._aggregations.get(key)
            if entry is None:
                return None
            if (time.monotonic() - entry["ts"]) > entry["ttl"]:
                del self._aggregations[key]
                return None
            return entry["data"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _evict_oldest(self, store: Dict) -> None:
        n = max(1, len(store) // 10)
        oldest = sorted(store.items(), key=lambda x: x[1].created_at)[:n]
        for k, _ in oldest:
            del store[k]

    def _evict_oldest_dict(self, store: Dict, ts_key: str) -> None:
        n = max(1, len(store) // 10)
        oldest = sorted(store.items(), key=lambda x: x[1][ts_key])[:n]
        for k, _ in oldest:
            del store[k]

    def invalidate_user(self, user_id: str) -> int:
        """Remove all cached data for a user."""
        prefix = f"{user_id}:"
        with self._lock:
            seg_keys = [k for k in self._segments if k.startswith(prefix)]
            rq_keys = [k for k in self._aggregations if k.startswith(prefix)]
            for k in seg_keys:
                del self._segments[k]
            for k in rq_keys:
                del self._aggregations[k]
            return len(seg_keys) + len(rq_keys)

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            seg_total = self._stats["segment_hits"] + self._stats["segment_misses"]
            return {
                "name": self.name,
                "segments_cached": len(self._segments),
                "events_cached": len(self._events),
                "range_queries_cached": len(self._range_queries),
                "aggregations_cached": len(self._aggregations),
                "segment_hit_rate": round(
                    self._stats["segment_hits"] / seg_total * 100 if seg_total else 0, 2
                ),
                **self._stats,
            }

    def __repr__(self) -> str:
        return (
            f"TimelineCache(name={self.name!r}, "
            f"segments={len(self._segments)}, "
            f"events={len(self._events)})"
        )
