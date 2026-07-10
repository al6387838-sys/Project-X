"""
StressTest — Stress testing framework for LifeOS.

Pushes the system beyond normal operating capacity to find:
- Breaking point (max load before failure)
- Recovery behavior
- Memory leaks under sustained load
- Degradation patterns
- Error cascade behavior
"""

import gc
import time
import threading
import statistics
import logging
import tracemalloc
from typing import Any, Callable, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


@dataclass
class StressTestResult:
    """Result of a stress test run."""
    name: str
    max_concurrent_reached: int
    breaking_point_concurrent: Optional[int]
    breaking_point_rps: Optional[float]
    # Latency at various load levels
    latency_profile: List[Dict]   # [{concurrent, p99_ms, rps, error_rate}]
    # Memory
    memory_start_mb: float
    memory_end_mb: float
    memory_leak_mb: float
    # Recovery
    recovery_time_s: Optional[float]
    # Overall
    total_duration_s: float
    total_requests: int
    timestamp: float = field(default_factory=time.monotonic)

    def summary(self) -> str:
        bp = self.breaking_point_concurrent
        leak = self.memory_leak_mb
        return (
            f"[{self.name}] "
            f"Breaking point: {bp or 'not reached'} concurrent | "
            f"Memory leak: {leak:.1f}MB | "
            f"Recovery: {self.recovery_time_s or 'N/A'}s"
        )


class StressTest:
    """
    Stress testing engine for LifeOS.

    Progressively increases load until the system degrades
    or fails, recording the breaking point and recovery.
    """

    def __init__(
        self,
        name: str = "stress_test",
        error_rate_threshold: float = 5.0,  # % errors that define "breaking"
        latency_threshold_ms: float = 5000.0,  # p99 that defines "breaking"
    ) -> None:
        self.name = name
        self.error_rate_threshold = error_rate_threshold
        self.latency_threshold_ms = latency_threshold_ms
        self._results: List[StressTestResult] = []

    # ------------------------------------------------------------------
    # Main stress test
    # ------------------------------------------------------------------

    def run(
        self,
        target_fn: Callable,
        name: str = "stress_target",
        start_concurrent: int = 1,
        max_concurrent: int = 500,
        step: int = 10,
        step_duration_s: float = 10.0,
        think_time_s: float = 0.05,
    ) -> StressTestResult:
        """
        Run a stress test by progressively increasing concurrency.
        """
        logger.info(
            "[StressTest] Starting: %s (max=%d concurrent, step=%d)",
            name, max_concurrent, step,
        )

        latency_profile = []
        breaking_point = None
        breaking_rps = None
        total_requests = 0
        start_time = time.monotonic()

        # Memory baseline
        gc.collect()
        tracemalloc.start()
        mem_start = self._current_memory_mb()

        concurrent = start_concurrent
        while concurrent <= max_concurrent:
            step_result = self._run_step(
                target_fn, concurrent, step_duration_s, think_time_s
            )
            total_requests += step_result["total_requests"]

            profile_entry = {
                "concurrent": concurrent,
                "p99_ms": step_result["p99_ms"],
                "rps": step_result["rps"],
                "error_rate_pct": step_result["error_rate_pct"],
                "mean_ms": step_result["mean_ms"],
            }
            latency_profile.append(profile_entry)

            logger.info(
                "[StressTest] Step %d concurrent: P99=%.1fms, RPS=%.1f, Errors=%.2f%%",
                concurrent,
                step_result["p99_ms"],
                step_result["rps"],
                step_result["error_rate_pct"],
            )

            # Check breaking point
            if (
                step_result["error_rate_pct"] > self.error_rate_threshold
                or step_result["p99_ms"] > self.latency_threshold_ms
            ):
                breaking_point = concurrent
                breaking_rps = step_result["rps"]
                logger.warning(
                    "[StressTest] Breaking point reached at %d concurrent users!",
                    concurrent,
                )
                break

            concurrent += step

        # Memory end
        mem_end = self._current_memory_mb()
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        memory_leak = max(0, mem_end - mem_start)

        # Recovery test
        recovery_time = self._test_recovery(target_fn, step_duration_s)

        total_duration = time.monotonic() - start_time

        result = StressTestResult(
            name=name,
            max_concurrent_reached=concurrent - step if breaking_point else concurrent,
            breaking_point_concurrent=breaking_point,
            breaking_point_rps=breaking_rps,
            latency_profile=latency_profile,
            memory_start_mb=mem_start,
            memory_end_mb=mem_end,
            memory_leak_mb=round(memory_leak, 2),
            recovery_time_s=recovery_time,
            total_duration_s=round(total_duration, 2),
            total_requests=total_requests,
        )

        self._results.append(result)
        logger.info("[StressTest] %s", result.summary())
        return result

    def _run_step(
        self,
        target_fn: Callable,
        concurrent: int,
        duration_s: float,
        think_time_s: float,
    ) -> Dict:
        timings: List[float] = []
        errors = [0]
        end_time = time.monotonic() + duration_s
        lock = threading.Lock()

        def worker():
            while time.monotonic() < end_time:
                t0 = time.perf_counter()
                try:
                    target_fn()
                    ms = (time.perf_counter() - t0) * 1000
                    with lock:
                        timings.append(ms)
                except Exception:
                    ms = (time.perf_counter() - t0) * 1000
                    with lock:
                        timings.append(ms)
                        errors[0] += 1
                if think_time_s > 0:
                    time.sleep(think_time_s)

        with ThreadPoolExecutor(max_workers=concurrent) as ex:
            futures = [ex.submit(worker) for _ in range(concurrent)]
            for f in futures:
                try:
                    f.result()
                except Exception:
                    pass

        total = len(timings)
        failed = errors[0]
        if timings:
            sorted_t = sorted(timings)
            p99 = sorted_t[int(0.99 * len(sorted_t))]
            mean_ms = statistics.mean(timings)
        else:
            p99 = mean_ms = 0.0

        rps = total / duration_s if duration_s > 0 else 0.0
        error_rate = failed / total * 100 if total else 0.0

        return {
            "total_requests": total,
            "p99_ms": round(p99, 2),
            "mean_ms": round(mean_ms, 2),
            "rps": round(rps, 2),
            "error_rate_pct": round(error_rate, 3),
        }

    def _test_recovery(self, target_fn: Callable, max_wait_s: float = 30.0) -> Optional[float]:
        """Test how quickly the system recovers after stress."""
        t0 = time.monotonic()
        deadline = t0 + max_wait_s
        while time.monotonic() < deadline:
            try:
                t_req = time.perf_counter()
                target_fn()
                ms = (time.perf_counter() - t_req) * 1000
                if ms < 1000:  # recovered when single request < 1s
                    return round(time.monotonic() - t0, 2)
            except Exception:
                pass
            time.sleep(0.5)
        return None

    def _current_memory_mb(self) -> float:
        try:
            import psutil
            return psutil.Process().memory_info().rss / 1_048_576
        except Exception:
            return 0.0

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------

    def print_report(self) -> None:
        for result in self._results:
            print(f"\n{'='*70}")
            print(f"  Stress Test: {result.name}")
            print(f"{'='*70}")
            print(f"  Breaking Point: {result.breaking_point_concurrent or 'Not reached'} concurrent users")
            print(f"  Memory Leak:    {result.memory_leak_mb:.1f} MB")
            print(f"  Recovery Time:  {result.recovery_time_s or 'N/A'} seconds")
            print(f"\n  Load Profile:")
            print(f"  {'Concurrent':>12} {'P99 (ms)':>12} {'RPS':>10} {'Errors %':>10}")
            print(f"  {'-'*12} {'-'*12} {'-'*10} {'-'*10}")
            for entry in result.latency_profile:
                print(
                    f"  {entry['concurrent']:>12} "
                    f"{entry['p99_ms']:>12.1f} "
                    f"{entry['rps']:>10.1f} "
                    f"{entry['error_rate_pct']:>10.2f}"
                )
            print(f"{'='*70}\n")

    def to_dict(self) -> List[Dict]:
        return [
            {
                "name": r.name,
                "breaking_point_concurrent": r.breaking_point_concurrent,
                "memory_leak_mb": r.memory_leak_mb,
                "recovery_time_s": r.recovery_time_s,
                "latency_profile": r.latency_profile,
            }
            for r in self._results
        ]
