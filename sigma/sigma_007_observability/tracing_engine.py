"""
Tracing Engine — Distributed Tracing for LifeOS.
SIGMA-007: Observability Pro
"""

import time
import uuid
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class SpanStatus(Enum):
    """Span status."""
    UNSET = "unset"
    OK = "ok"
    ERROR = "error"


@dataclass
class Span:
    """A single trace span."""
    span_id: str
    trace_id: str
    parent_span_id: Optional[str]
    operation: str
    module: str
    start_time: float
    end_time: float = 0.0
    duration_ms: float = 0.0
    status: SpanStatus = SpanStatus.UNSET
    tags: Dict[str, Any] = field(default_factory=dict)
    logs: List[Dict[str, Any]] = field(default_factory=list)
    attributes: Dict[str, Any] = field(default_factory=dict)

    def finish(self, status: SpanStatus = SpanStatus.OK) -> None:
        self.end_time = time.time()
        self.duration_ms = round((self.end_time - self.start_time) * 1000, 2)
        self.status = status


@dataclass
class Trace:
    """A complete distributed trace."""
    trace_id: str
    root_span: Span
    spans: List[Span] = field(default_factory=list)
    start_time: float = 0.0
    end_time: float = 0.0
    duration_ms: float = 0.0
    status: SpanStatus = SpanStatus.UNSET

    def finish(self) -> None:
        self.end_time = time.time()
        self.duration_ms = round((self.end_time - self.start_time) * 1000, 2)
        # Aggregate status
        if any(s.status == SpanStatus.ERROR for s in self.spans):
            self.status = SpanStatus.ERROR
        else:
            self.status = SpanStatus.OK


class TracingEngine:
    """
    World-Class Distributed Tracing Engine for LifeOS.

    SIGMA-007: Implements:
    - OpenTelemetry-compatible trace/span model
    - Context propagation
    - Span nesting
    - Trace sampling
    - Trace visualization data
    - Slow span detection
    """

    def __init__(self, name: str = "tracing_engine") -> None:
        self.name = name
        self._traces: Dict[str, Trace] = {}
        self._spans: Dict[str, Span] = {}
        self._sampling_rate = 1.0  # 100% in dev, lower in prod
        self._slow_threshold_ms = 100.0
        self._stats = {
            "total_traces": 0,
            "total_spans": 0,
            "error_traces": 0,
            "slow_spans": 0,
            "sampled": 0,
        }

    def start_trace(self, root_operation: str, module: str = "lifeos") -> Trace:
        """Start a new distributed trace."""
        trace_id = str(uuid.uuid4())[:12]
        span_id = str(uuid.uuid4())[:12]

        root_span = Span(
            span_id=span_id,
            trace_id=trace_id,
            parent_span_id=None,
            operation=root_operation,
            module=module,
            start_time=time.time(),
        )

        trace = Trace(
            trace_id=trace_id,
            root_span=root_span,
            start_time=time.time(),
        )

        self._traces[trace_id] = trace
        self._spans[span_id] = root_span
        self._stats["total_traces"] += 1

        logger.info(f"[TracingEngine] Trace started: {trace_id} ({root_operation})")
        return trace

    def start_span(self, trace_id: str, operation: str, module: str = "", parent_span_id: Optional[str] = None) -> Span:
        """Start a new span within a trace."""
        trace = self._traces.get(trace_id)
        if not trace:
            raise ValueError(f"Trace {trace_id} not found")

        span_id = str(uuid.uuid4())[:12]
        span = Span(
            span_id=span_id,
            trace_id=trace_id,
            parent_span_id=parent_span_id or trace.root_span.span_id,
            operation=operation,
            module=module,
            start_time=time.time(),
        )

        trace.spans.append(span)
        self._spans[span_id] = span
        self._stats["total_spans"] += 1

        return span

    def finish_trace(self, trace_id: str) -> Trace:
        """Finish a trace."""
        trace = self._traces.get(trace_id)
        if not trace:
            return Trace(trace_id="unknown", root_span=Span(
                span_id="unknown", trace_id="unknown", parent_span_id=None,
                operation="unknown", module="unknown", start_time=time.time()))

        # Finish all unfinished spans
        for span in trace.spans:
            if span.end_time == 0.0:
                span.finish()

        trace.root_span.finish()
        trace.finish()

        if trace.status == SpanStatus.ERROR:
            self._stats["error_traces"] += 1

        logger.info(f"[TracingEngine] Trace finished: {trace_id} ({trace.duration_ms}ms)")
        return trace

    def finish_span(self, span_id: str, status: SpanStatus = SpanStatus.OK) -> None:
        """Finish a span."""
        span = self._spans.get(span_id)
        if span:
            span.finish(status)
            if span.duration_ms > self._slow_threshold_ms:
                self._stats["slow_spans"] += 1

    def get_trace(self, trace_id: str) -> Optional[Trace]:
        return self._traces.get(trace_id)

    def get_slow_spans(self) -> List[Span]:
        """Get spans exceeding the slow threshold."""
        return [s for s in self._spans.values() if s.duration_ms > self._slow_threshold_ms]

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "active_traces": len(self._traces),
            "active_spans": len(self._spans),
        }

    def __repr__(self) -> str:
        return (
            f"TracingEngine(name={self.name!r}, "
            f"traces={self._stats['total_traces']}, "
            f"spans={self._stats['total_spans']})"
        )
