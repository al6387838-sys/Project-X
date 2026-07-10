"""
SIGMA-001: Performance Optimization
===================================
World-Class Performance Enhancement Suite for LifeOS.

Optimizes:
- CPU: Algorithmic improvements, parallel processing
- RAM: Memory pooling, object reuse, GC tuning
- Renderização: Virtual rendering, component memoization
- Consultas: Query optimization, connection pooling, prepared statements
- Cache: Multi-tier cache with adaptive policies
- Tempo de abertura: Pre-warming, code splitting, lazy initialization
- Lazy Loading: Intelligent prefetching, predictive loading

Target SLAs (Sprint Sigma):
- Startup: < 800ms (was 2000ms)
- Dashboard: < 200ms (was 500ms)
- Life Graph Search: < 100ms (was 300ms)
- Companion Response: < 400ms (was 1000ms)
- Cache Hit Rate: > 95% (was ~70%)
- Memory Growth: < 1MB/min (was unmonitored)
"""

from .cpu_optimizer import CPUOptimizer
from .memory_optimizer import MemoryOptimizer
from .cache_optimizer import CacheOptimizer
from .query_optimizer import QueryOptimizer
from .lazy_loading_optimizer import LazyLoadingOptimizer
from .render_optimizer import RenderOptimizer
from .startup_optimizer import StartupOptimizer

__all__ = [
    "CPUOptimizer",
    "MemoryOptimizer",
    "CacheOptimizer",
    "QueryOptimizer",
    "LazyLoadingOptimizer",
    "RenderOptimizer",
    "StartupOptimizer",
]
