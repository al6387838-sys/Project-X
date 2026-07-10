"""
DatabaseMonitor — Database performance monitoring for LifeOS.

Tracks:
- Query execution times
- Slow query detection and logging
- Connection pool utilization
- Query plan analysis hooks
- Index usage statistics
- Per-table operation counts
- Cache hit ratio (for PostgreSQL)
"""

import time
import threading
import logging
import contextlib
from typing import Any, Callable, Dict, List, Optional
from collections import defaultdict, deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class QueryRecord:
    """Record of a single database query execution."""
    query_hash: str
    query_preview: str   # first 200 chars
    table: Optional[str]
    operation: str       # SELECT | INSERT | UPDATE | DELETE | OTHER
    duration_ms: float
    rows_affected: int = 0
    from_cache: bool = False
    ts: float = field(default_factory=time.monotonic)
    error: Optional[str] = None


class DatabaseMonitor:
    """
    Database performance monitor for LifeOS.

    Instruments query execution, tracks slow queries,
    and provides aggregated statistics per table/operation.
    """

    SLOW_QUERY_THRESHOLD_MS = 100.0
    VERY_SLOW_THRESHOLD_MS = 500.0

    def __init__(
        self,
        slow_threshold_ms: float = 100.0,
        window_size: int = 5000,
        name: str = "database_monitor",
    ) -> None:
        self.name = name
        self.slow_threshold_ms = slow_threshold_ms
        self.window_size = window_size
        self._queries: deque = deque(maxlen=window_size)
        self._slow_queries: deque = deque(maxlen=500)
        self._lock = threading.RLock()
        self._table_stats: Dict[str, Dict] = defaultdict(lambda: {
            "selects": 0, "inserts": 0, "updates": 0, "deletes": 0,
            "total_ms": 0.0, "errors": 0,
        })
        self._connection_pool_stats = {
            "pool_size": 0,
            "checked_out": 0,
            "overflow": 0,
            "invalid": 0,
        }
        self._stats = {
            "total_queries": 0,
            "slow_queries": 0,
            "very_slow_queries": 0,
            "errors": 0,
            "total_ms": 0.0,
        }

    # ------------------------------------------------------------------
    # Query instrumentation
    # ------------------------------------------------------------------

    def record_query(
        self,
        query: str,
        duration_ms: float,
        table: Optional[str] = None,
        rows_affected: int = 0,
        from_cache: bool = False,
        error: Optional[str] = None,
    ) -> QueryRecord:
        """Record a completed query."""
        operation = self._detect_operation(query)
        preview = query[:200].replace("\n", " ").strip()
        qhash = str(hash(query))[:12]

        record = QueryRecord(
            query_hash=qhash,
            query_preview=preview,
            table=table,
            operation=operation,
            duration_ms=duration_ms,
            rows_affected=rows_affected,
            from_cache=from_cache,
            error=error,
        )

        with self._lock:
            self._queries.append(record)
            self._stats["total_queries"] += 1
            self._stats["total_ms"] += duration_ms

            if error:
                self._stats["errors"] += 1

            if duration_ms > self.VERY_SLOW_THRESHOLD_MS:
                self._stats["very_slow_queries"] += 1
                self._slow_queries.append(record)
                logger.warning(
                    "[DatabaseMonitor] VERY SLOW query (%.1f ms): %s",
                    duration_ms, preview[:80],
                )
            elif duration_ms > self.slow_threshold_ms:
                self._stats["slow_queries"] += 1
                self._slow_queries.append(record)

            if table:
                ts = self._table_stats[table]
                ts[f"{operation.lower()}s"] = ts.get(f"{operation.lower()}s", 0) + 1
                ts["total_ms"] += duration_ms
                if error:
                    ts["errors"] += 1

        return record

    @contextlib.contextmanager
    def measure_query(
        self,
        query: str,
        table: Optional[str] = None,
    ):
        """Context manager that records query timing."""
        t0 = time.monotonic()
        error = None
        rows = 0
        try:
            yield
        except Exception as exc:
            error = str(exc)
            raise
        finally:
            duration_ms = (time.monotonic() - t0) * 1000
            self.record_query(query, duration_ms, table=table, error=error)

    def instrument(self, table: Optional[str] = None):
        """Decorator for database access functions."""
        def decorator(fn: Callable) -> Callable:
            def wrapper(*args, **kwargs):
                query = fn.__name__
                t0 = time.monotonic()
                error = None
                try:
                    result = fn(*args, **kwargs)
                    return result
                except Exception as exc:
                    error = str(exc)
                    raise
                finally:
                    ms = (time.monotonic() - t0) * 1000
                    self.record_query(query, ms, table=table, error=error)
            return wrapper
        return decorator

    # ------------------------------------------------------------------
    # Connection pool tracking
    # ------------------------------------------------------------------

    def update_pool_stats(
        self,
        pool_size: int,
        checked_out: int,
        overflow: int = 0,
        invalid: int = 0,
    ) -> None:
        with self._lock:
            self._connection_pool_stats = {
                "pool_size": pool_size,
                "checked_out": checked_out,
                "overflow": overflow,
                "invalid": invalid,
                "utilization_pct": round(checked_out / pool_size * 100 if pool_size else 0, 1),
            }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_operation(query: str) -> str:
        q = query.strip().upper()
        if q.startswith("SELECT"):
            return "SELECT"
        if q.startswith("INSERT"):
            return "INSERT"
        if q.startswith("UPDATE"):
            return "UPDATE"
        if q.startswith("DELETE"):
            return "DELETE"
        return "OTHER"

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def avg_query_ms(self) -> Optional[float]:
        with self._lock:
            total = self._stats["total_queries"]
            if not total:
                return None
            return round(self._stats["total_ms"] / total, 2)

    def percentile_query_ms(self, p: float) -> Optional[float]:
        import math
        with self._lock:
            values = sorted(q.duration_ms for q in self._queries)
        if not values:
            return None
        idx = math.ceil(p / 100.0 * len(values)) - 1
        return round(values[max(0, idx)], 2)

    def top_slow_queries(self, n: int = 10) -> List[Dict]:
        with self._lock:
            slow = sorted(self._slow_queries, key=lambda q: q.duration_ms, reverse=True)[:n]
        return [
            {
                "query_preview": q.query_preview[:100],
                "table": q.table,
                "operation": q.operation,
                "duration_ms": q.duration_ms,
            }
            for q in slow
        ]

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            table_summary = {
                t: dict(s) for t, s in list(self._table_stats.items())[:20]
            }
        return {
            "name": self.name,
            "avg_query_ms": self.avg_query_ms(),
            "p95_query_ms": self.percentile_query_ms(95),
            "p99_query_ms": self.percentile_query_ms(99),
            "connection_pool": self._connection_pool_stats,
            "top_slow_queries": self.top_slow_queries(5),
            "table_stats": table_summary,
            **self._stats,
        }

    def __repr__(self) -> str:
        with self._lock:
            total = self._stats["total_queries"]
        return f"DatabaseMonitor(name={self.name!r}, queries={total})"
