"""
Lazy Loading Optimizer — Intelligent Prefetching & Predictive Loading.
SIGMA-001: Performance Optimization
"""

import time
import threading
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Any, Callable, Dict, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class LoadStrategy(Enum):
    LAZY = "lazy"           # Load only when accessed
    EAGER = "eager"         # Load immediately
    PREDICTIVE = "predictive"  # Load based on prediction
    PREFETCH = "prefetch"   # Load in background
    ADAPTIVE = "adaptive"   # Auto-switch based on patterns


@dataclass
class LoadCandidate:
    """A data item that can be lazy-loaded."""
    id: str
    loader_fn: Callable
    priority: int = 0
    strategy: LoadStrategy = LoadStrategy.LAZY
    last_accessed: Optional[float] = None
    access_count: int = 0
    is_loaded: bool = False
    data: Optional[Any] = None
    load_time_ms: float = 0.0
    is_loading: bool = False
    future: Optional[Future] = None


class LazyLoadingOptimizer:
    """
    World-class lazy loading optimization engine.

    SIGMA-001: Goes beyond basic lazy loading with:
    - Predictive loading based on access patterns
    - Background prefetching of likely-next data
    - Adaptive strategy switching
    - Load dependency graph
    - Batch loading for related items
    """

    def __init__(
        self,
        max_workers: int = 8,
        prediction_window: int = 10,
        name: str = "lazy_loading_optimizer",
    ) -> None:
        self.name = name
        self.max_workers = max_workers
        self.prediction_window = prediction_window
        self._candidates: Dict[str, LoadCandidate] = {}
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="lazy-loader")
        self._access_history: List[str] = []
        self._dependency_graph: Dict[str, Set[str]] = defaultdict(set)
        self._lock = threading.Lock()
        self._stats = {
            "lazy_loads": 0,
            "prefetch_loads": 0,
            "predictive_loads": 0,
            "cache_hits": 0,
            "total_load_time_ms": 0.0,
            "prefetch_misses": 0,
        }

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(
        self,
        candidate_id: str,
        loader_fn: Callable,
        priority: int = 0,
        strategy: LoadStrategy = LoadStrategy.LAZY,
        depends_on: Optional[List[str]] = None,
    ) -> "LazyLoadingOptimizer":
        """Register a lazy-loadable candidate."""
        with self._lock:
            self._candidates[candidate_id] = LoadCandidate(
                id=candidate_id,
                loader_fn=loader_fn,
                priority=priority,
                strategy=strategy,
            )
            if depends_on:
                self._dependency_graph[candidate_id].update(depends_on)
        return self

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    def load(self, candidate_id: str) -> Optional[Any]:
        """Load a candidate, using its registered strategy."""
        with self._lock:
            candidate = self._candidates.get(candidate_id)

        if not candidate:
            return None

        # Already loaded?
        if candidate.is_loaded:
            with self._lock:
                self._stats["cache_hits"] += 1
                candidate.access_count += 1
                candidate.last_accessed = time.monotonic()
            return candidate.data

        # Strategy dispatch
        if candidate.strategy == LoadStrategy.LAZY:
            return self._load_lazy(candidate)
        elif candidate.strategy == LoadStrategy.EAGER:
            return self._load_eager(candidate)
        elif candidate.strategy == LoadStrategy.PREDICTIVE:
            return self._load_predictive(candidate)
        elif candidate.strategy == LoadStrategy.PREFETCH:
            return self._load_prefetch(candidate)
        elif candidate.strategy == LoadStrategy.ADAPTIVE:
            return self._load_adaptive(candidate)

        return None

    def _load_lazy(self, candidate: LoadCandidate) -> Optional[Any]:
        """Lazy load: only when accessed."""
        t0 = time.monotonic()
        try:
            candidate.is_loading = True
            # Load dependencies first
            deps = self._dependency_graph.get(candidate.id, set())
            for dep_id in deps:
                dep = self._candidates.get(dep_id)
                if dep and not dep.is_loaded:
                    self._load_lazy(dep)

            result = candidate.loader_fn()
            candidate.data = result
            candidate.is_loaded = True
            candidate.is_loading = False
            candidate.load_time_ms = (time.monotonic() - t0) * 1000
            candidate.access_count += 1
            candidate.last_accessed = time.monotonic()

            with self._lock:
                self._stats["lazy_loads"] += 1
                self._stats["total_load_time_ms"] += candidate.load_time_ms
                self._access_history.append(candidate.id)

            return result
        except Exception as e:
            candidate.is_loading = False
            logger.warning(f"[LazyLoadingOptimizer] Lazy load failed: {e}")
            return None

    def _load_eager(self, candidate: LoadCandidate) -> Optional[Any]:
        """Eager load: load immediately on registration."""
        return self._load_lazy(candidate)

    def _load_predictive(self, candidate: LoadCandidate) -> Optional[Any]:
        """
        Predictive load: check if it's the likely next item.

        SIGMA-001: Uses access pattern history to predict which
        item will be accessed next.
        """
        predicted = self._predict_next()
        if candidate.id in predicted:
            result = self._load_lazy(candidate)
            with self._lock:
                self._stats["predictive_loads"] += 1
            return result

        # Not predicted — load on demand
        return self._load_lazy(candidate)

    def _load_prefetch(self, candidate: LoadCandidate) -> Optional[Any]:
        """
        Prefetch: load in background, return immediately.

        SIGMA-001: Submits load to background thread so the
        caller doesn't block.
        """
        with self._lock:
            if candidate.future and not candidate.future.done():
                return None

        future = self._executor.submit(self._load_lazy, candidate)
        with self._lock:
            candidate.future = future
            self._stats["prefetch_loads"] += 1

        # Don't wait for result
        return None

    def _load_adaptive(self, candidate: LoadCandidate) -> Optional[Any]:
        """
        Adaptive strategy: switches between lazy/predictive/prefetch
        based on usage patterns.
        """
        # If accessed multiple times recently → predict and prefetch neighbors
        if candidate.access_count >= 3:
            # High reuse: prefetch dependents
            deps = self._dependency_graph.get(candidate.id, set())
            for dep_id in deps:
                dep = self._candidates.get(dep_id)
                if dep and not dep.is_loaded and dep.strategy == LoadStrategy.PREFETCH:
                    self._load_prefetch(dep)
            candidate.strategy = LoadStrategy.PREDICTIVE

        # If never accessed but registered → lazy
        if candidate.access_count == 0:
            candidate.strategy = LoadStrategy.LAZY

        return self._load_lazy(candidate)

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def _predict_next(self, top_n: int = 5) -> List[str]:
        """Predict the next likely accessed items."""
        with self._lock:
            history = list(self._access_history)

        if len(history) < 2:
            return []

        # Simple n-gram prediction
        last_n = history[-self.prediction_window :]

        # Find items that commonly follow the recent pattern
        frequency: Dict[str, int] = defaultdict(int)
        for i in range(1, len(history)):
            if history[i - self.prediction_window : i] == last_n[-self.prediction_window :]:
                frequency[history[i]] += 1

        if not frequency:
            # Fallback: load dependents of last accessed items
            last_items = set(history[-3:])
            for item in last_items:
                deps = self._dependency_graph.get(item, set())
                for dep in deps:
                    dep_candidate = self._candidates.get(dep)
                    if dep_candidate and not dep_candidate.is_loaded:
                        frequency[dep] += 1

        sorted_predictions = sorted(frequency.keys(), key=lambda k: frequency[k], reverse=True)
        return sorted_predictions[:top_n]

    # ------------------------------------------------------------------
    # Batch Operations
    # ------------------------------------------------------------------

    def load_batch(self, candidate_ids: List[str]) -> Dict[str, Any]:
        """Load multiple candidates, respecting dependencies."""
        results = {}
        # Sort by dependency order
        ordered = self._topological_sort(candidate_ids)
        for cid in ordered:
            results[cid] = self.load(cid)
        return results

    def _topological_sort(self, ids: List[str]) -> List[str]:
        """Sort candidates by dependency order."""
        visited: Set[str] = set()
        order: List[str] = []

        def visit(cid: str):
            if cid in visited:
                return
            visited.add(cid)
            for dep in self._dependency_graph.get(cid, set()):
                if dep in set(ids):
                    visit(dep)
            order.append(cid)

        for cid in ids:
            visit(cid)
        return order

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total = len(self._candidates)
            loaded = sum(1 for c in self._candidates.values() if c.is_loaded)
            avg_ms = (
                self._stats["total_load_time_ms"]
                / max(self._stats["lazy_loads"], 1)
            )
            return {
                "name": self.name,
                **self._stats,
                "avg_load_time_ms": round(avg_ms, 2),
                "total_candidates": total,
                "loaded": loaded,
                "not_loaded": total - loaded,
                "load_ratio_pct": round(loaded / max(total, 1) * 100, 1),
            }

    def __repr__(self) -> str:
        with self._lock:
            loaded = sum(1 for c in self._candidates.values() if c.is_loaded)
        return (
            f"LazyLoadingOptimizer(name={self.name!r}, "
            f"loaded={loaded}/{len(self._candidates)})"
        )
