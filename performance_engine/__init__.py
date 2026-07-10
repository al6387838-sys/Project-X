"""
LifeOS Performance Engine
Sprint 027 — Global Performance & Scalability

Provides:
- Multi-layer Cache Manager (Redis, Memory, Graph, Context, Timeline)
- Lazy Loading & Virtual Lists
- Background Processing & Job Queue
- Task Scheduler
- Performance Dashboard & Monitors
- Auto Scaling Ready Architecture
- Stress Tests & Load Tests
"""

from .cache.cache_manager import CacheManager
from .background.job_queue import JobQueue
from .background.task_scheduler import TaskScheduler
from .monitoring.performance_dashboard import PerformanceDashboard

__version__ = "1.0.0"
__sprint__ = "027"

__all__ = [
    "CacheManager",
    "JobQueue",
    "TaskScheduler",
    "PerformanceDashboard",
]
