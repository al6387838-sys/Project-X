"""
GraphCache — Specialized cache for Life Graph queries.

Optimized for:
- Node lookups by ID (O(1))
- Edge traversal results
- Subgraph snapshots
- Relationship path queries

Target: Life Graph search < 300 ms (Sprint 027 SLA).
"""

import time
import threading
import hashlib
import json
from typing import Any, Optional, Dict, List, Set
from dataclasses import dataclass, field


@dataclass
class GraphCacheEntry:
    """Cache entry for a graph query result."""
    data: Any
    node_ids: Set[str] = field(default_factory=set)   # nodes involved
    edge_ids: Set[str] = field(default_factory=set)   # edges involved
    created_at: float = field(default_factory=time.monotonic)
    ttl: float = 120.0  # graph data is relatively volatile
    hit_count: int = 0

    @property
    def is_expired(self) -> bool:
        return (time.monotonic() - self.created_at) > self.ttl

    def touch(self) -> None:
        self.hit_count += 1


class GraphCache:
    """
    Specialized cache for Life Graph data structures.

    Provides:
    - Node cache: individual node data by node_id
    - Edge cache: edge data by edge_id
    - Query cache: results of graph traversal queries
    - Invalidation by node/edge (cascades to dependent queries)
    """

    def __init__(
        self,
        max_nodes: int = 50_000,
        max_edges: int = 200_000,
        max_queries: int = 5_000,
        default_ttl: float = 120.0,
        name: str = "graph_cache",
    ) -> None:
        self.name = name
        self.max_nodes = max_nodes
        self.max_edges = max_edges
        self.max_queries = max_queries
        self.default_ttl = default_ttl
        self._lock = threading.RLock()

        # Storage layers
        self._nodes: Dict[str, GraphCacheEntry] = {}
        self._edges: Dict[str, GraphCacheEntry] = {}
        self._queries: Dict[str, GraphCacheEntry] = {}

        # Reverse index: node_id -> set of query_keys that depend on it
        self._node_to_queries: Dict[str, Set[str]] = {}

        self._stats = {
            "node_hits": 0, "node_misses": 0,
            "edge_hits": 0, "edge_misses": 0,
            "query_hits": 0, "query_misses": 0,
            "invalidations": 0,
        }

    # ------------------------------------------------------------------
    # Query key generation
    # ------------------------------------------------------------------

    @staticmethod
    def make_query_key(query_type: str, params: Any) -> str:
        """Generate a deterministic cache key for a graph query."""
        raw = json.dumps({"type": query_type, "params": params}, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    # ------------------------------------------------------------------
    # Node cache
    # ------------------------------------------------------------------

    def get_node(self, node_id: str) -> Optional[Any]:
        with self._lock:
            entry = self._nodes.get(node_id)
            if entry is None or entry.is_expired:
                if entry and entry.is_expired:
                    del self._nodes[node_id]
                self._stats["node_misses"] += 1
                return None
            entry.touch()
            self._stats["node_hits"] += 1
            return entry.data

    def set_node(self, node_id: str, data: Any, ttl: Optional[float] = None) -> None:
        ttl = ttl if ttl is not None else self.default_ttl
        with self._lock:
            if len(self._nodes) >= self.max_nodes:
                self._evict_oldest(self._nodes)
            self._nodes[node_id] = GraphCacheEntry(data=data, node_ids={node_id}, ttl=ttl)

    def invalidate_node(self, node_id: str) -> int:
        """Remove node and all queries that depend on it."""
        with self._lock:
            self._nodes.pop(node_id, None)
            query_keys = self._node_to_queries.pop(node_id, set())
            for qk in query_keys:
                self._queries.pop(qk, None)
            self._stats["invalidations"] += 1 + len(query_keys)
            return 1 + len(query_keys)

    # ------------------------------------------------------------------
    # Edge cache
    # ------------------------------------------------------------------

    def get_edge(self, edge_id: str) -> Optional[Any]:
        with self._lock:
            entry = self._edges.get(edge_id)
            if entry is None or entry.is_expired:
                if entry and entry.is_expired:
                    del self._edges[edge_id]
                self._stats["edge_misses"] += 1
                return None
            entry.touch()
            self._stats["edge_hits"] += 1
            return entry.data

    def set_edge(self, edge_id: str, data: Any, ttl: Optional[float] = None) -> None:
        ttl = ttl if ttl is not None else self.default_ttl
        with self._lock:
            if len(self._edges) >= self.max_edges:
                self._evict_oldest(self._edges)
            self._edges[edge_id] = GraphCacheEntry(data=data, edge_ids={edge_id}, ttl=ttl)

    # ------------------------------------------------------------------
    # Query result cache
    # ------------------------------------------------------------------

    def get_query(self, query_key: str) -> Optional[Any]:
        with self._lock:
            entry = self._queries.get(query_key)
            if entry is None or entry.is_expired:
                if entry and entry.is_expired:
                    del self._queries[query_key]
                self._stats["query_misses"] += 1
                return None
            entry.touch()
            self._stats["query_hits"] += 1
            return entry.data

    def set_query(
        self,
        query_key: str,
        data: Any,
        node_ids: Optional[Set[str]] = None,
        edge_ids: Optional[Set[str]] = None,
        ttl: Optional[float] = None,
    ) -> None:
        ttl = ttl if ttl is not None else self.default_ttl
        node_ids = node_ids or set()
        edge_ids = edge_ids or set()
        with self._lock:
            if len(self._queries) >= self.max_queries:
                self._evict_oldest(self._queries)
            entry = GraphCacheEntry(
                data=data,
                node_ids=node_ids,
                edge_ids=edge_ids,
                ttl=ttl,
            )
            self._queries[query_key] = entry
            # Register reverse index
            for nid in node_ids:
                self._node_to_queries.setdefault(nid, set()).add(query_key)

    # ------------------------------------------------------------------
    # Subgraph snapshot (for dashboard pre-loading)
    # ------------------------------------------------------------------

    def snapshot_subgraph(
        self,
        root_node_id: str,
        depth: int,
        data: Any,
        ttl: float = 60.0,
    ) -> None:
        key = f"subgraph:{root_node_id}:d{depth}"
        self.set_query(key, data, node_ids={root_node_id}, ttl=ttl)

    def get_subgraph(self, root_node_id: str, depth: int) -> Optional[Any]:
        key = f"subgraph:{root_node_id}:d{depth}"
        return self.get_query(key)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _evict_oldest(self, store: Dict) -> None:
        """Remove 10% oldest entries from store."""
        n = max(1, len(store) // 10)
        oldest = sorted(store.items(), key=lambda x: x[1].created_at)[:n]
        for k, _ in oldest:
            del store[k]

    def clear(self) -> None:
        with self._lock:
            self._nodes.clear()
            self._edges.clear()
            self._queries.clear()
            self._node_to_queries.clear()

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            node_total = self._stats["node_hits"] + self._stats["node_misses"]
            query_total = self._stats["query_hits"] + self._stats["query_misses"]
            return {
                "name": self.name,
                "nodes_cached": len(self._nodes),
                "edges_cached": len(self._edges),
                "queries_cached": len(self._queries),
                "node_hit_rate": round(
                    self._stats["node_hits"] / node_total * 100 if node_total else 0, 2
                ),
                "query_hit_rate": round(
                    self._stats["query_hits"] / query_total * 100 if query_total else 0, 2
                ),
                **self._stats,
            }

    def __repr__(self) -> str:
        return (
            f"GraphCache(name={self.name!r}, "
            f"nodes={len(self._nodes)}, "
            f"edges={len(self._edges)}, "
            f"queries={len(self._queries)})"
        )
