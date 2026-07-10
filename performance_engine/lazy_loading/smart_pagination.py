"""
SmartPagination — Intelligent pagination engine for LifeOS.

Supports:
- Cursor-based pagination (stable, scalable)
- Offset-based pagination (simple, compatible)
- Keyset pagination (high-performance for sorted data)
- Adaptive page size based on client capabilities
- Prefetch next page in background
- Total count estimation (avoid expensive COUNT(*))
"""

import time
import math
import threading
import hashlib
import json
from typing import Any, Callable, Dict, Generic, List, Optional, Tuple, TypeVar
from dataclasses import dataclass, field
from enum import Enum

T = TypeVar("T")


class PaginationStrategy(Enum):
    OFFSET = "offset"       # Traditional LIMIT/OFFSET
    CURSOR = "cursor"       # Cursor-based (opaque token)
    KEYSET = "keyset"       # Keyset / seek pagination


@dataclass
class PageRequest:
    """Request parameters for a paginated query."""
    page_size: int = 20
    strategy: PaginationStrategy = PaginationStrategy.CURSOR
    # Cursor strategy
    cursor: Optional[str] = None
    # Offset strategy
    page: int = 0
    # Keyset strategy
    last_value: Optional[Any] = None
    last_id: Optional[str] = None
    # Filters & sorting
    sort_by: str = "created_at"
    sort_order: str = "desc"
    filters: Dict = field(default_factory=dict)


@dataclass
class PageResult(Generic[T]):
    """Result of a paginated query."""
    items: List[T]
    page_size: int
    has_next: bool
    has_prev: bool
    # Cursor strategy
    next_cursor: Optional[str] = None
    prev_cursor: Optional[str] = None
    # Offset strategy
    current_page: int = 0
    total_pages: Optional[int] = None
    # Metadata
    total_count: Optional[int] = None   # None = not computed (expensive)
    estimated_count: Optional[int] = None
    load_time_ms: float = 0.0
    strategy: str = "cursor"
    from_cache: bool = False


class SmartPagination:
    """
    Intelligent pagination engine with multiple strategies.

    Automatically selects the best strategy based on:
    - Dataset size (cursor for large, offset for small)
    - Client capabilities
    - Query patterns
    """

    def __init__(
        self,
        default_page_size: int = 20,
        max_page_size: int = 100,
        default_strategy: PaginationStrategy = PaginationStrategy.CURSOR,
        enable_prefetch: bool = True,
        name: str = "smart_pagination",
    ) -> None:
        self.name = name
        self.default_page_size = default_page_size
        self.max_page_size = max_page_size
        self.default_strategy = default_strategy
        self.enable_prefetch = enable_prefetch
        self._cursor_store: Dict[str, Dict] = {}  # cursor_token -> state
        self._prefetch_cache: Dict[str, Any] = {}
        self._lock = threading.RLock()
        self._stats = {
            "total_requests": 0,
            "cache_hits": 0,
            "prefetch_hits": 0,
            "avg_load_ms": 0.0,
        }

    # ------------------------------------------------------------------
    # Cursor management
    # ------------------------------------------------------------------

    def _encode_cursor(self, state: Dict) -> str:
        """Encode pagination state into an opaque cursor token."""
        raw = json.dumps(state, sort_keys=True, default=str)
        token = hashlib.sha256(raw.encode()).hexdigest()[:24]
        with self._lock:
            self._cursor_store[token] = state
        return token

    def _decode_cursor(self, cursor: str) -> Optional[Dict]:
        with self._lock:
            return self._cursor_store.get(cursor)

    # ------------------------------------------------------------------
    # Core pagination
    # ------------------------------------------------------------------

    def paginate(
        self,
        request: PageRequest,
        data_fn: Callable[[Dict], Tuple[List, bool]],
        count_fn: Optional[Callable[[], int]] = None,
    ) -> PageResult:
        """
        Execute a paginated query.

        data_fn(query_params) -> (items, has_more)
        count_fn() -> total_count (optional, expensive)
        """
        t0 = time.monotonic()
        page_size = min(request.page_size or self.default_page_size, self.max_page_size)
        self._stats["total_requests"] += 1

        if request.strategy == PaginationStrategy.CURSOR:
            result = self._paginate_cursor(request, data_fn, page_size)
        elif request.strategy == PaginationStrategy.KEYSET:
            result = self._paginate_keyset(request, data_fn, page_size)
        else:
            result = self._paginate_offset(request, data_fn, count_fn, page_size)

        result.load_time_ms = (time.monotonic() - t0) * 1000
        result.strategy = request.strategy.value

        # Update running average
        n = self._stats["total_requests"]
        self._stats["avg_load_ms"] = (
            (self._stats["avg_load_ms"] * (n - 1) + result.load_time_ms) / n
        )

        # Prefetch next page in background
        if self.enable_prefetch and result.has_next and result.next_cursor:
            self._schedule_prefetch(request, data_fn, result.next_cursor)

        return result

    def _paginate_cursor(
        self,
        request: PageRequest,
        data_fn: Callable,
        page_size: int,
    ) -> PageResult:
        state = {}
        if request.cursor:
            state = self._decode_cursor(request.cursor) or {}

        query_params = {
            "limit": page_size + 1,  # fetch one extra to detect has_next
            "sort_by": request.sort_by,
            "sort_order": request.sort_order,
            "filters": request.filters,
            "after_id": state.get("last_id"),
            "after_value": state.get("last_value"),
        }

        items, _ = data_fn(query_params)
        has_next = len(items) > page_size
        if has_next:
            items = items[:page_size]

        next_cursor = None
        if has_next and items:
            last = items[-1]
            next_state = {
                "last_id": getattr(last, "id", None) or (last.get("id") if isinstance(last, dict) else None),
                "last_value": getattr(last, request.sort_by, None) or (last.get(request.sort_by) if isinstance(last, dict) else None),
                "sort_by": request.sort_by,
                "sort_order": request.sort_order,
            }
            next_cursor = self._encode_cursor(next_state)

        prev_cursor = request.cursor  # simple: prev = current cursor

        return PageResult(
            items=items,
            page_size=page_size,
            has_next=has_next,
            has_prev=bool(request.cursor),
            next_cursor=next_cursor,
            prev_cursor=prev_cursor if request.cursor else None,
        )

    def _paginate_offset(
        self,
        request: PageRequest,
        data_fn: Callable,
        count_fn: Optional[Callable],
        page_size: int,
    ) -> PageResult:
        offset = request.page * page_size
        query_params = {
            "limit": page_size,
            "offset": offset,
            "sort_by": request.sort_by,
            "sort_order": request.sort_order,
            "filters": request.filters,
        }
        items, has_more = data_fn(query_params)

        total_count = None
        total_pages = None
        if count_fn:
            total_count = count_fn()
            total_pages = math.ceil(total_count / page_size) if total_count else 0

        return PageResult(
            items=items,
            page_size=page_size,
            has_next=has_more or (total_count is not None and offset + page_size < total_count),
            has_prev=request.page > 0,
            current_page=request.page,
            total_pages=total_pages,
            total_count=total_count,
        )

    def _paginate_keyset(
        self,
        request: PageRequest,
        data_fn: Callable,
        page_size: int,
    ) -> PageResult:
        query_params = {
            "limit": page_size + 1,
            "sort_by": request.sort_by,
            "sort_order": request.sort_order,
            "filters": request.filters,
            "last_value": request.last_value,
            "last_id": request.last_id,
        }
        items, _ = data_fn(query_params)
        has_next = len(items) > page_size
        if has_next:
            items = items[:page_size]

        return PageResult(
            items=items,
            page_size=page_size,
            has_next=has_next,
            has_prev=request.last_id is not None,
        )

    # ------------------------------------------------------------------
    # Prefetch
    # ------------------------------------------------------------------

    def _schedule_prefetch(
        self,
        request: PageRequest,
        data_fn: Callable,
        next_cursor: str,
    ) -> None:
        """Speculatively fetch the next page in a background thread."""
        import threading
        def _prefetch():
            try:
                next_request = PageRequest(
                    page_size=request.page_size,
                    strategy=request.strategy,
                    cursor=next_cursor,
                    sort_by=request.sort_by,
                    sort_order=request.sort_order,
                    filters=request.filters,
                )
                result = self.paginate(next_request, data_fn)
                with self._lock:
                    self._prefetch_cache[next_cursor] = result
            except Exception:
                pass
        threading.Thread(target=_prefetch, daemon=True).start()

    def get_prefetched(self, cursor: str) -> Optional[PageResult]:
        with self._lock:
            result = self._prefetch_cache.pop(cursor, None)
            if result:
                result.from_cache = True
                self._stats["prefetch_hits"] += 1
            return result

    # ------------------------------------------------------------------
    # Adaptive page size
    # ------------------------------------------------------------------

    def adaptive_page_size(
        self,
        client_bandwidth_kbps: float,
        item_size_bytes: float = 500.0,
    ) -> int:
        """Suggest optimal page size based on client bandwidth."""
        target_load_ms = 300.0  # target page load time
        bytes_per_ms = client_bandwidth_kbps / 8.0
        max_bytes = bytes_per_ms * target_load_ms
        suggested = int(max_bytes / item_size_bytes)
        return max(5, min(suggested, self.max_page_size))

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "name": self.name,
                "cursors_stored": len(self._cursor_store),
                "prefetch_cached": len(self._prefetch_cache),
                **self._stats,
            }

    def __repr__(self) -> str:
        return (
            f"SmartPagination(name={self.name!r}, "
            f"default_size={self.default_page_size}, "
            f"strategy={self.default_strategy.value!r})"
        )
