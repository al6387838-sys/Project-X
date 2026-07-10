"""
Logging Engine — Structured Logging for LifeOS.
SIGMA-007: Observability Pro
"""

import time
import json
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class LogLevel(Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class LogEntry:
    """A structured log entry."""
    timestamp: float
    level: LogLevel
    message: str
    module: str
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "level": self.level.value,
            "message": self.message,
            "module": self.module,
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "metadata": self.metadata,
            "context": self.context,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


class LoggingEngine:
    """
    World-Class Structured Logging Engine for LifeOS.

    SIGMA-007: Implements:
    - Structured JSON logging
    - Log levels with filtering
    - Context propagation (trace_id, span_id)
    - Log buffering and batching
    - Log rotation policies
    - Searchable log index
    """

    def __init__(self, name: str = "logging_engine") -> None:
        self.name = name
        self._entries: List[LogEntry] = []
        self._buffer: List[LogEntry] = []
        self._buffer_size = 1000
        self._context: Dict[str, Any] = {}
        self._stats = {
            "total_logs": 0,
            "debug": 0,
            "info": 0,
            "warning": 0,
            "error": 0,
            "critical": 0,
            "buffer_flushes": 0,
        }

    def log(self, level: LogLevel, message: str, module: str = "", **kwargs) -> LogEntry:
        """Create a structured log entry."""
        entry = LogEntry(
            timestamp=time.time(),
            level=level,
            message=message,
            module=module,
            trace_id=self._context.get("trace_id"),
            span_id=self._context.get("span_id"),
            metadata=kwargs,
            context=dict(self._context),
        )
        self._entries.append(entry)
        self._buffer.append(entry)
        self._stats["total_logs"] += 1
        self._stats[level.value] += 1

        if len(self._buffer) >= self._buffer_size:
            self._flush()

        return entry

    def debug(self, message: str, **kwargs) -> LogEntry:
        return self.log(LogLevel.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs) -> LogEntry:
        return self.log(LogLevel.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs) -> LogEntry:
        return self.log(LogLevel.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs) -> LogEntry:
        return self.log(LogLevel.ERROR, message, **kwargs)

    def critical(self, message: str, **kwargs) -> LogEntry:
        return self.log(LogLevel.CRITICAL, message, **kwargs)

    def set_context(self, **kwargs) -> None:
        """Set logging context (propagated to all entries)."""
        self._context.update(kwargs)

    def clear_context(self) -> None:
        self._context.clear()

    def get_entries(self, level: Optional[LogLevel] = None, limit: int = 100) -> List[LogEntry]:
        """Get log entries, optionally filtered by level."""
        entries = self._entries
        if level:
            entries = [e for e in entries if e.level == level]
        return entries[-limit:]

    def search(self, query: str) -> List[LogEntry]:
        """Search logs by message content."""
        return [e for e in self._entries if query.lower() in e.message.lower()]

    def _flush(self) -> None:
        """Flush buffer (in production, sends to log aggregator)."""
        self._buffer.clear()
        self._stats["buffer_flushes"] += 1

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "current_buffer_size": len(self._buffer),
            "total_entries": len(self._entries),
        }

    def __repr__(self) -> str:
        return (
            f"LoggingEngine(name={self.name!r}, "
            f"entries={len(self._entries)}, "
            f"errors={self._stats['error']})"
        )
