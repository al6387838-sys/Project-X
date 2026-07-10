"""
BenchmarkRunner — Performance benchmark framework for LifeOS.

Measures:
- Function execution time (iterations, warmup)
- Memory allocation per operation
- Cache effectiveness
- Throughput (ops/sec)
- Sprint 027 SLA compliance

Usage:
    runner = BenchmarkRunner()
    result = runner.benchmark("cache_get", lambda: cache.get("key"), iterations=10000)
    runner.print_report()
"""

import gc
import math
import time
import statistics
import threading
import tracemalloc
import logging
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# Sprint 027 SLA targets
SLA_TARGETS_MS = {
    "startup": 2000,
    "dashboard": 500,
    "life_graph_search": 300,
    "companion_response": 1000,
}


@dataclass
class BenchmarkResult:
    """Result of a single benchmark run."""
    name: str
    iterations: int
    total_ms: float
    min_ms: float
    max_ms: float
    mean_ms: float
    median_ms: float
    stdev_ms: float
    p90_ms: float
    p95_ms: float
    p99_ms: float
    ops_per_sec: float
    memory_peak_kb: float = 0.0
    memory_delta_kb: float = 0.0
    sla_target_ms: Optional[float] = None
    sla_met: Optional[bool] = None
    warmup_iterations: int = 0
    timestamp: float = field(default_factory=time.monotonic)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "iterations": self.iterations,
            "mean_ms": round(self.mean_ms, 3),
            "median_ms": round(self.median_ms, 3),
            "p90_ms": round(self.p90_ms, 3),
            "p95_ms": round(self.p95_ms, 3),
            "p99_ms": round(self.p99_ms, 3),
            "min_ms": round(self.min_ms, 3),
            "max_ms": round(self.max_ms, 3),
            "stdev_ms": round(self.stdev_ms, 3),
            "ops_per_sec": round(self.ops_per_sec, 1),
            "memory_peak_kb": round(self.memory_peak_kb, 2),
            "sla_target_ms": self.sla_target_ms,
            "sla_met": self.sla_met,
        }

    def summary_line(self) -> str:
        sla_str = ""
        if self.sla_target_ms:
            status = "✓ SLA MET" if self.sla_met else "✗ SLA BREACH"
            sla_str = f" | target={self.sla_target_ms}ms [{status}]"
        return (
            f"  {self.name:<35} "
            f"mean={self.mean_ms:>8.3f}ms  "
            f"p99={self.p99_ms:>8.3f}ms  "
            f"ops/s={self.ops_per_sec:>10.1f}"
            f"{sla_str}"
        )


class BenchmarkRunner:
    """
    Performance benchmark runner for LifeOS.

    Runs functions repeatedly, collects timing statistics,
    and validates against Sprint 027 SLA targets.
    """

    def __init__(
        self,
        name: str = "benchmark_runner",
        default_iterations: int = 1000,
        default_warmup: int = 100,
        track_memory: bool = True,
    ) -> None:
        self.name = name
        self.default_iterations = default_iterations
        self.default_warmup = default_warmup
        self.track_memory = track_memory
        self._results: List[BenchmarkResult] = []
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Core benchmark
    # ------------------------------------------------------------------

    def benchmark(
        self,
        name: str,
        fn: Callable,
        iterations: Optional[int] = None,
        warmup: Optional[int] = None,
        sla_target_ms: Optional[float] = None,
        setup_fn: Optional[Callable] = None,
        teardown_fn: Optional[Callable] = None,
    ) -> BenchmarkResult:
        """
        Benchmark a function over multiple iterations.

        Args:
            name: Benchmark name
            fn: Function to benchmark
            iterations: Number of timed iterations
            warmup: Number of warmup iterations (not timed)
            sla_target_ms: SLA target in milliseconds
            setup_fn: Called before each iteration
            teardown_fn: Called after each iteration
        """
        iters = iterations or self.default_iterations
        warmup_iters = warmup or self.default_warmup

        # Auto-detect SLA target
        if sla_target_ms is None:
            for key, target in SLA_TARGETS_MS.items():
                if key in name.lower():
                    sla_target_ms = float(target)
                    break

        # Warmup
        gc.collect()
        for _ in range(warmup_iters):
            if setup_fn:
                setup_fn()
            fn()
            if teardown_fn:
                teardown_fn()

        # Memory tracking
        if self.track_memory:
            tracemalloc.start()

        # Timed iterations
        gc.collect()
        timings: List[float] = []
        for _ in range(iters):
            if setup_fn:
                setup_fn()
            t0 = time.perf_counter()
            fn()
            elapsed = (time.perf_counter() - t0) * 1000
            timings.append(elapsed)
            if teardown_fn:
                teardown_fn()

        # Memory stats
        mem_peak_kb = 0.0
        mem_delta_kb = 0.0
        if self.track_memory:
            _, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()
            mem_peak_kb = peak / 1024

        # Statistics
        sorted_t = sorted(timings)
        total_ms = sum(timings)
        mean_ms = statistics.mean(timings)
        median_ms = statistics.median(timings)
        stdev_ms = statistics.stdev(timings) if len(timings) > 1 else 0.0
        p90 = self._percentile(sorted_t, 90)
        p95 = self._percentile(sorted_t, 95)
        p99 = self._percentile(sorted_t, 99)
        ops_per_sec = iters / (total_ms / 1000) if total_ms > 0 else 0.0

        sla_met = None
        if sla_target_ms is not None:
            sla_met = p99 <= sla_target_ms

        result = BenchmarkResult(
            name=name,
            iterations=iters,
            total_ms=total_ms,
            min_ms=sorted_t[0],
            max_ms=sorted_t[-1],
            mean_ms=mean_ms,
            median_ms=median_ms,
            stdev_ms=stdev_ms,
            p90_ms=p90,
            p95_ms=p95,
            p99_ms=p99,
            ops_per_sec=ops_per_sec,
            memory_peak_kb=mem_peak_kb,
            sla_target_ms=sla_target_ms,
            sla_met=sla_met,
            warmup_iterations=warmup_iters,
        )

        with self._lock:
            self._results.append(result)

        return result

    @staticmethod
    def _percentile(sorted_data: List[float], p: float) -> float:
        idx = math.ceil(p / 100.0 * len(sorted_data)) - 1
        return sorted_data[max(0, min(idx, len(sorted_data) - 1))]

    # ------------------------------------------------------------------
    # Suite
    # ------------------------------------------------------------------

    def suite(self, benchmarks: Dict[str, Callable], **kwargs) -> List[BenchmarkResult]:
        """Run a suite of benchmarks."""
        results = []
        for name, fn in benchmarks.items():
            logger.info("[BenchmarkRunner] Running: %s", name)
            result = self.benchmark(name, fn, **kwargs)
            results.append(result)
        return results

    # ------------------------------------------------------------------
    # Reporting
    # ------------------------------------------------------------------

    def print_report(self) -> None:
        """Print a formatted benchmark report."""
        print(f"\n{'='*80}")
        print(f"  LifeOS Performance Benchmarks — Sprint 027")
        print(f"{'='*80}")
        print(f"  {'Benchmark':<35} {'Mean':>12} {'P99':>12} {'Ops/s':>14}  SLA")
        print(f"  {'-'*35} {'-'*12} {'-'*12} {'-'*14}  ---")
        for r in self._results:
            print(r.summary_line())
        print(f"{'='*80}")

        # SLA summary
        sla_results = [r for r in self._results if r.sla_target_ms is not None]
        if sla_results:
            met = sum(1 for r in sla_results if r.sla_met)
            print(f"\n  SLA Compliance: {met}/{len(sla_results)} targets met")
            for r in sla_results:
                status = "✓" if r.sla_met else "✗"
                print(f"    {status} {r.name}: p99={r.p99_ms:.1f}ms / target={r.sla_target_ms}ms")
        print()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "runner": self.name,
            "results": [r.to_dict() for r in self._results],
            "sla_summary": {
                "total": len([r for r in self._results if r.sla_target_ms]),
                "met": len([r for r in self._results if r.sla_met]),
            },
        }

    def clear(self) -> None:
        with self._lock:
            self._results.clear()

    def __repr__(self) -> str:
        return f"BenchmarkRunner(name={self.name!r}, results={len(self._results)})"
