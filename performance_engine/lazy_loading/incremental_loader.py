"""
IncrementalLoader — Progressive data loading for LifeOS.

Enables:
- Chunked loading of large datasets
- Priority-based loading (critical data first)
- Background prefetching
- Cancellable load operations
- Progress tracking

Target: Dashboard initial render < 500 ms (Sprint 027 SLA).
"""

import time
import threading
import logging
from typing import Any, Callable, Dict, Generator, Iterator, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, Future

logger = logging.getLogger(__name__)


class LoadPriority(Enum):
    CRITICAL = 0    # Must load before first render (< 500 ms)
    HIGH = 1        # Load in first 2 seconds
    NORMAL = 2      # Load within 5 seconds
    LOW = 3         # Background / lazy
    PREFETCH = 4    # Speculative prefetch


@dataclass
class LoadChunk:
    """A single chunk of data to be loaded."""
    chunk_id: str
    loader_fn: Callable
    priority: LoadPriority = LoadPriority.NORMAL
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    depends_on: List[str] = field(default_factory=list)
    estimated_size_bytes: int = 0
    result: Optional[Any] = None
    error: Optional[Exception] = None
    loaded_at: Optional[float] = None
    load_time_ms: float = 0.0
    status: str = "pending"  # pending | loading | done | error | cancelled


class IncrementalLoader:
    """
    Progressive data loader with priority scheduling.

    Loads data in chunks ordered by priority, enabling the UI to
    render critical content immediately while background chunks
    continue loading asynchronously.
    """

    def __init__(
        self,
        max_workers: int = 4,
        chunk_timeout_s: float = 10.0,
        name: str = "incremental_loader",
    ) -> None:
        self.name = name
        self.max_workers = max_workers
        self.chunk_timeout_s = chunk_timeout_s
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="loader")
        self._chunks: Dict[str, LoadChunk] = {}
        self._futures: Dict[str, Future] = {}
        self._lock = threading.RLock()
        self._callbacks: Dict[str, List[Callable]] = {}
        self._stats = {
            "total_chunks": 0,
            "completed": 0,
            "errors": 0,
            "cancelled": 0,
            "total_load_time_ms": 0.0,
        }

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(
        self,
        chunk_id: str,
        loader_fn: Callable,
        priority: LoadPriority = LoadPriority.NORMAL,
        args: tuple = (),
        kwargs: Optional[dict] = None,
        depends_on: Optional[List[str]] = None,
        estimated_size_bytes: int = 0,
    ) -> "IncrementalLoader":
        """Register a data chunk for loading."""
        with self._lock:
            self._chunks[chunk_id] = LoadChunk(
                chunk_id=chunk_id,
                loader_fn=loader_fn,
                priority=priority,
                args=args,
                kwargs=kwargs or {},
                depends_on=depends_on or [],
                estimated_size_bytes=estimated_size_bytes,
            )
            self._stats["total_chunks"] += 1
        return self  # fluent API

    def on_complete(self, chunk_id: str, callback: Callable) -> None:
        """Register a callback for when a specific chunk completes."""
        self._callbacks.setdefault(chunk_id, []).append(callback)

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------

    def load_critical(self) -> Dict[str, Any]:
        """
        Synchronously load all CRITICAL priority chunks.
        Returns dict of chunk_id -> result.
        Must complete within 500 ms for dashboard SLA.
        """
        critical = [
            c for c in self._chunks.values()
            if c.priority == LoadPriority.CRITICAL and c.status == "pending"
        ]
        critical.sort(key=lambda c: c.chunk_id)
        results = {}
        for chunk in critical:
            result = self._execute_chunk(chunk)
            results[chunk.chunk_id] = result
        return results

    def load_all_async(self) -> None:
        """Submit all pending chunks to the thread pool, ordered by priority."""
        with self._lock:
            pending = [
                c for c in self._chunks.values()
                if c.status == "pending"
            ]
        pending.sort(key=lambda c: c.priority.value)
        for chunk in pending:
            self._submit_chunk(chunk)

    def load_chunk(self, chunk_id: str) -> Optional[Any]:
        """Load a specific chunk synchronously."""
        with self._lock:
            chunk = self._chunks.get(chunk_id)
        if chunk is None:
            return None
        return self._execute_chunk(chunk)

    def _submit_chunk(self, chunk: LoadChunk) -> None:
        """Submit chunk to executor (async)."""
        with self._lock:
            if chunk.status != "pending":
                return
            chunk.status = "loading"
        future = self._executor.submit(self._execute_chunk, chunk)
        with self._lock:
            self._futures[chunk.chunk_id] = future

    def _execute_chunk(self, chunk: LoadChunk) -> Any:
        """Execute a single chunk loader."""
        chunk.status = "loading"
        t0 = time.monotonic()
        try:
            # Wait for dependencies
            for dep_id in chunk.depends_on:
                dep = self._chunks.get(dep_id)
                if dep and dep.status not in ("done", "error"):
                    self._execute_chunk(dep)

            result = chunk.loader_fn(*chunk.args, **chunk.kwargs)
            chunk.result = result
            chunk.status = "done"
            chunk.loaded_at = time.monotonic()
            chunk.load_time_ms = (time.monotonic() - t0) * 1000
            with self._lock:
                self._stats["completed"] += 1
                self._stats["total_load_time_ms"] += chunk.load_time_ms
            # Fire callbacks
            for cb in self._callbacks.get(chunk.chunk_id, []):
                try:
                    cb(chunk.chunk_id, result)
                except Exception:
                    pass
            return result
        except Exception as exc:
            chunk.error = exc
            chunk.status = "error"
            chunk.load_time_ms = (time.monotonic() - t0) * 1000
            with self._lock:
                self._stats["errors"] += 1
            logger.error("[IncrementalLoader] Chunk %s failed: %s", chunk.chunk_id, exc)
            return None

    # ------------------------------------------------------------------
    # Streaming / generator API
    # ------------------------------------------------------------------

    def stream_chunks(
        self,
        priority_threshold: LoadPriority = LoadPriority.LOW,
    ) -> Generator[Tuple[str, Any], None, None]:
        """
        Generator that yields (chunk_id, result) as chunks complete,
        ordered by priority up to priority_threshold.
        """
        chunks = [
            c for c in self._chunks.values()
            if c.priority.value <= priority_threshold.value
        ]
        chunks.sort(key=lambda c: c.priority.value)
        for chunk in chunks:
            result = self._execute_chunk(chunk)
            yield chunk.chunk_id, result

    # ------------------------------------------------------------------
    # Status & stats
    # ------------------------------------------------------------------

    def get_status(self) -> Dict[str, str]:
        with self._lock:
            return {cid: c.status for cid, c in self._chunks.items()}

    def get_result(self, chunk_id: str) -> Optional[Any]:
        with self._lock:
            chunk = self._chunks.get(chunk_id)
            return chunk.result if chunk else None

    def is_complete(self) -> bool:
        with self._lock:
            return all(c.status in ("done", "error", "cancelled") for c in self._chunks.values())

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            completed = self._stats["completed"]
            avg_ms = (
                self._stats["total_load_time_ms"] / completed
                if completed else 0.0
            )
            return {
                "name": self.name,
                "avg_chunk_load_ms": round(avg_ms, 2),
                **self._stats,
            }

    def reset(self) -> None:
        with self._lock:
            self._chunks.clear()
            self._futures.clear()
            self._callbacks.clear()

    def __repr__(self) -> str:
        total = len(self._chunks)
        done = sum(1 for c in self._chunks.values() if c.status == "done")
        return f"IncrementalLoader(name={self.name!r}, chunks={done}/{total})"
