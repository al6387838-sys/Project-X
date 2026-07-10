"""
VirtualList — Virtual scrolling / windowed list for LifeOS.

Renders only the visible portion of a large dataset, keeping
memory usage constant regardless of total item count.

Supports:
- Fixed-height and variable-height items
- Overscan buffer (pre-render items outside viewport)
- Dynamic item loading (on-demand fetch)
- Scroll position restoration
- Estimated total height calculation
"""

import math
import threading
from typing import Any, Callable, Dict, List, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class VirtualItem:
    """Metadata for a single virtual list item."""
    index: int
    data: Optional[Any] = None
    height: float = 48.0   # pixels
    loaded: bool = False
    loading: bool = False
    error: bool = False


@dataclass
class ViewportState:
    """Current viewport state for the virtual list."""
    scroll_top: float = 0.0
    viewport_height: float = 600.0
    overscan: int = 5  # extra items to render above/below viewport


class VirtualList:
    """
    Virtual list engine for efficient large-dataset rendering.

    Calculates which items are visible in the current viewport
    and manages on-demand loading of item data.
    """

    def __init__(
        self,
        total_items: int,
        item_height: float = 48.0,
        viewport_height: float = 600.0,
        overscan: int = 5,
        loader_fn: Optional[Callable[[int, int], List[Any]]] = None,
        name: str = "virtual_list",
    ) -> None:
        self.name = name
        self.total_items = total_items
        self.default_item_height = item_height
        self.viewport_height = viewport_height
        self.overscan = overscan
        self.loader_fn = loader_fn
        self._items: Dict[int, VirtualItem] = {}
        self._lock = threading.RLock()
        self._viewport = ViewportState(viewport_height=viewport_height, overscan=overscan)
        self._stats = {
            "renders": 0,
            "loads": 0,
            "cache_hits": 0,
        }

    # ------------------------------------------------------------------
    # Item management
    # ------------------------------------------------------------------

    def set_item_data(self, index: int, data: Any, height: Optional[float] = None) -> None:
        with self._lock:
            item = self._items.get(index, VirtualItem(index=index))
            item.data = data
            item.loaded = True
            item.loading = False
            if height is not None:
                item.height = height
            self._items[index] = item

    def set_item_heights(self, heights: Dict[int, float]) -> None:
        """Bulk update item heights (for variable-height lists)."""
        with self._lock:
            for idx, h in heights.items():
                item = self._items.get(idx, VirtualItem(index=idx))
                item.height = h
                self._items[idx] = item

    # ------------------------------------------------------------------
    # Viewport calculations
    # ------------------------------------------------------------------

    def update_viewport(self, scroll_top: float, viewport_height: Optional[float] = None) -> None:
        with self._lock:
            self._viewport.scroll_top = scroll_top
            if viewport_height is not None:
                self._viewport.viewport_height = viewport_height

    def get_visible_range(self) -> Tuple[int, int]:
        """
        Calculate the range of visible item indices.
        Returns (start_index, end_index) inclusive.
        """
        with self._lock:
            scroll_top = self._viewport.scroll_top
            vh = self._viewport.viewport_height
            overscan = self._viewport.overscan

            # Accumulate heights to find visible range
            accumulated = 0.0
            start_idx = 0
            end_idx = self.total_items - 1

            for i in range(self.total_items):
                h = self._get_item_height(i)
                if accumulated + h > scroll_top:
                    start_idx = max(0, i - overscan)
                    break
                accumulated += h

            accumulated = 0.0
            for i in range(self.total_items):
                h = self._get_item_height(i)
                accumulated += h
                if accumulated > scroll_top + vh:
                    end_idx = min(self.total_items - 1, i + overscan)
                    break

            return start_idx, end_idx

    def get_visible_items(self) -> List[VirtualItem]:
        """Return VirtualItem objects for the current visible range."""
        start, end = self.get_visible_range()
        self._stats["renders"] += 1
        items = []
        with self._lock:
            for i in range(start, end + 1):
                item = self._items.get(i, VirtualItem(index=i, height=self.default_item_height))
                if item.loaded:
                    self._stats["cache_hits"] += 1
                items.append(item)
        return items

    def load_visible(self) -> List[VirtualItem]:
        """Load data for visible items that are not yet loaded."""
        start, end = self.get_visible_range()
        unloaded = [
            i for i in range(start, end + 1)
            if not self._items.get(i, VirtualItem(index=i)).loaded
        ]
        if unloaded and self.loader_fn:
            try:
                batch = self.loader_fn(unloaded[0], unloaded[-1])
                for idx, data in zip(unloaded, batch):
                    self.set_item_data(idx, data)
                self._stats["loads"] += len(unloaded)
            except Exception:
                pass
        return self.get_visible_items()

    # ------------------------------------------------------------------
    # Layout calculations
    # ------------------------------------------------------------------

    def _get_item_height(self, index: int) -> float:
        item = self._items.get(index)
        return item.height if item else self.default_item_height

    @property
    def total_height(self) -> float:
        """Total scrollable height in pixels."""
        with self._lock:
            return sum(
                self._get_item_height(i) for i in range(self.total_items)
            )

    def get_item_offset(self, index: int) -> float:
        """Top offset in pixels for item at given index."""
        with self._lock:
            return sum(self._get_item_height(i) for i in range(index))

    def scroll_to_index(self, index: int) -> float:
        """Calculate scroll_top needed to bring item into view."""
        offset = self.get_item_offset(index)
        self.update_viewport(scroll_top=offset)
        return offset

    # ------------------------------------------------------------------
    # Pagination helpers
    # ------------------------------------------------------------------

    def get_page_for_index(self, index: int, page_size: int = 50) -> int:
        return index // page_size

    def get_indices_for_page(self, page: int, page_size: int = 50) -> range:
        start = page * page_size
        end = min(start + page_size, self.total_items)
        return range(start, end)

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            loaded = sum(1 for item in self._items.values() if item.loaded)
            return {
                "name": self.name,
                "total_items": self.total_items,
                "loaded_items": loaded,
                "load_ratio": round(loaded / self.total_items * 100 if self.total_items else 0, 2),
                "total_height_px": self.total_height,
                **self._stats,
            }

    def __repr__(self) -> str:
        loaded = sum(1 for item in self._items.values() if item.loaded)
        return (
            f"VirtualList(name={self.name!r}, "
            f"total={self.total_items}, loaded={loaded})"
        )
