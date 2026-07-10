"""Lazy Loading subsystem — incremental data loading for LifeOS."""

from .incremental_loader import IncrementalLoader
from .virtual_list import VirtualList
from .smart_pagination import SmartPagination
from .image_optimizer import ImageOptimizer
from .compression import CompressionEngine

__all__ = [
    "IncrementalLoader",
    "VirtualList",
    "SmartPagination",
    "ImageOptimizer",
    "CompressionEngine",
]
