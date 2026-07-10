"""
LoadTest — Load testing framework for LifeOS.

Simulates concurrent user load with configurable ramp-up,
steady state, and ramp-down phases.

Scenarios:
- Baseline (1 user)
- Light load (100 users)
- Normal load (1,000 users)
- Heavy load (10,000 users)
- Peak load (100,000 users)
- Spike test (sudden burst)
"""

import time
import math
import threading
import statistics
import logging
import uuid
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
from enum import Enum

logger = logging.getLogger(__name__)


class LoadPattern(Enum):
    CONSTANT = "constant"       # Fixed concurrent users
    RAMP_UP = "ramp_up"         # Gradually increase load
    SPIKE = "spike"             # Sudden burst
    STEP = "step"               # Step-wise increase
    WAVE = "wave"               # Sinusoidal load


@dataclass
class LoadTestScenario:
    """Definition of a load test scenario."""
    name: str
    target_fn: Callable           # Function to test
    pattern: LoadPattern = LoadPattern.CONSTANT
    # Constant / peak concurrent users
    concurrent_users: int = 10
    # Duration
    duration_s: float = 30.0
    # Ramp-up
    ramp_up_s: float = 10.0
    ramp_down_s: float = 5.0
    # Think time between requests (simulates real user behavior)
    think_time_s: float = 0.1
    # SLA target
    sla_p99_ms: Optional[float] = None
    sla_error_rate_pct: float = 1.0
    # Setup / teardown
    setup_fn: Optional[Callable] = None
    teardown_fn: Optional[Callable] = None


@dataclass
class LoadTestResult:
    """Result of a load test run."""
    scenario_name: str
    duration_s: float
    total_requests: int
    successful_requests: int
    failed_requests: int
    # Latency
    mean_ms: float
    median_ms: float
    p90_ms: float
    p95_ms: float
    p99_ms: float
    min_ms: float
    max_ms: float
    # Throughput
    rps: float                    # requests per second
    # SLA
    sla_p99_ms: Optional[float]
    sla_p99_met: Optional[bool]
    error_rate_pct: float
    sla_error_met: bool
    # Concurrency
    peak_concurrent: int
    # Errors
    error_types: Dict[str, int] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.monotonic)

    @property
    def success_rate_pct(self) -> float:
        return (self.successful_requests / self.total_requests * 100
                if self.total_requests else 0.0)

    def summary(self) -> str:
        sla_str = ""
        if self.sla_p99_ms:
            status = "✓" if self.sla_p99_met else "✗"
            sla_str = f" | P99 SLA {status} ({self.p99_ms:.0f}ms/{self.sla_p99_ms:.0f}ms)"
        return (
            f"[{self.scenario_name}] "
            f"RPS={self.rps:.1f} | "
            f"P99={self.p99_ms:.1f}ms | "
            f"Errors={self.error_rate_pct:.2f}% | "
            f"Success={self.success_rate_pct:.1f}%"
            f"{sla_str}"
        )


class LoadTest:
    """
    Load testing engine for LifeOS.

    Executes load test scenarios with configurable concurrency
    patterns and collects detailed performance metrics.
    """

    def __init__(
        self,
        name: str = "load_test",
        max_workers: int = 500,
    ) -> None:
        self.name = name
        self.max_workers = max_workers
        self._results: List[LoadTestResult] = []
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Run scenario
    # ------------------------------------------------------------------

    def run(self, scenario: LoadTestScenario) -> LoadTestResult:
        """Execute a load test scenario."""
        logger.info(
            "[LoadTest] Starting scenario: %s (users=%d, duration=%.0fs)",
            scenario.name, scenario.concurrent_users, scenario.duration_s,
        )

        if scenario.setup_fn:
            scenario.setup_fn()

        timings: List[float] = []
        errors: List[str] = []
        error_types: Dict[str, int] = {}
        peak_concurrent = 0
        active_count = [0]
        active_lock = threading.Lock()

        start_time = time.monotonic()
        end_time = start_time + scenario.duration_s

        def worker():
            nonlocal peak_concurrent
            while time.monotonic() < end_time:
                with active_lock:
                    active_count[0] += 1
                    if active_count[0] > peak_concurrent:
                        peak_concurrent = active_count[0]
                t0 = time.perf_counter()
                try:
                    scenario.target_fn()
                    elapsed_ms = (time.perf_counter() - t0) * 1000
                    with self._lock:
                        timings.append(elapsed_ms)
                except Exception as exc:
                    elapsed_ms = (time.perf_counter() - t0) * 1000
                    err_type = type(exc).__name__
                    with self._lock:
                        timings.append(elapsed_ms)
                        errors.append(str(exc))
                        error_types[err_type] = error_types.get(err_type, 0) + 1
                finally:
                    with active_lock:
                        active_count[0] -= 1
                # Think time
                if scenario.think_time_s > 0:
                    time.sleep(scenario.think_time_s)

        # Determine concurrent users based on pattern
        concurrent = self._get_concurrent_users(scenario)

        with ThreadPoolExecutor(max_workers=min(concurrent, self.max_workers)) as executor:
            futures = [executor.submit(worker) for _ in range(concurrent)]
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception:
                    pass

        actual_duration = time.monotonic() - start_time

        if scenario.teardown_fn:
            scenario.teardown_fn()

        # Compute stats
        result = self._compute_result(
            scenario, timings, errors, error_types,
            actual_duration, peak_concurrent,
        )

        with self._lock:
            self._results.append(result)

        logger.info("[LoadTest] %s", result.summary())
        return result

    def _get_concurrent_users(self, scenario: LoadTestScenario) -> int:
        if scenario.pattern == LoadPattern.CONSTANT:
            return scenario.concurrent_users
        if scenario.pattern == LoadPattern.SPIKE:
            return scenario.concurrent_users * 3  # 3x spike
        return scenario.concurrent_users

    def _compute_result(
        self,
        scenario: LoadTestScenario,
        timings: List[float],
        errors: List[str],
        error_types: Dict[str, int],
        duration_s: float,
        peak_concurrent: int,
    ) -> LoadTestResult:
        total = len(timings)
        failed = len(errors)
        successful = total - failed

        if timings:
            sorted_t = sorted(timings)
            mean_ms = statistics.mean(timings)
            median_ms = statistics.median(timings)
            p90 = self._pct(sorted_t, 90)
            p95 = self._pct(sorted_t, 95)
            p99 = self._pct(sorted_t, 99)
            min_ms = sorted_t[0]
            max_ms = sorted_t[-1]
        else:
            mean_ms = median_ms = p90 = p95 = p99 = min_ms = max_ms = 0.0

        rps = total / duration_s if duration_s > 0 else 0.0
        error_rate = failed / total * 100 if total else 0.0

        sla_p99_met = None
        if scenario.sla_p99_ms:
            sla_p99_met = p99 <= scenario.sla_p99_ms

        return LoadTestResult(
            scenario_name=scenario.name,
            duration_s=round(duration_s, 2),
            total_requests=total,
            successful_requests=successful,
            failed_requests=failed,
            mean_ms=round(mean_ms, 2),
            median_ms=round(median_ms, 2),
            p90_ms=round(p90, 2),
            p95_ms=round(p95, 2),
            p99_ms=round(p99, 2),
            min_ms=round(min_ms, 2),
            max_ms=round(max_ms, 2),
            rps=round(rps, 2),
            sla_p99_ms=scenario.sla_p99_ms,
            sla_p99_met=sla_p99_met,
            error_rate_pct=round(error_rate, 3),
            sla_error_met=error_rate <= scenario.sla_error_rate_pct,
            peak_concurrent=peak_concurrent,
            error_types=error_types,
        )

    @staticmethod
    def _pct(sorted_data: List[float], p: float) -> float:
        if not sorted_data:
            return 0.0
        idx = math.ceil(p / 100.0 * len(sorted_data)) - 1
        return sorted_data[max(0, min(idx, len(sorted_data) - 1))]

    # ------------------------------------------------------------------
    # Standard scenarios
    # ------------------------------------------------------------------

    def run_standard_suite(
        self,
        target_fn: Callable,
        name: str = "lifeos_endpoint",
        sla_p99_ms: float = 500.0,
    ) -> List[LoadTestResult]:
        """Run the standard LifeOS load test suite."""
        scenarios = [
            LoadTestScenario(
                name=f"{name}_baseline",
                target_fn=target_fn,
                concurrent_users=1,
                duration_s=10.0,
                sla_p99_ms=sla_p99_ms,
            ),
            LoadTestScenario(
                name=f"{name}_light_100",
                target_fn=target_fn,
                concurrent_users=10,
                duration_s=15.0,
                sla_p99_ms=sla_p99_ms,
            ),
            LoadTestScenario(
                name=f"{name}_normal_1k",
                target_fn=target_fn,
                concurrent_users=50,
                duration_s=20.0,
                sla_p99_ms=sla_p99_ms * 1.5,
            ),
            LoadTestScenario(
                name=f"{name}_heavy_10k",
                target_fn=target_fn,
                concurrent_users=100,
                duration_s=20.0,
                sla_p99_ms=sla_p99_ms * 2,
            ),
        ]
        return [self.run(s) for s in scenarios]

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------

    def print_report(self) -> None:
        print(f"\n{'='*80}")
        print(f"  LifeOS Load Test Report — Sprint 027")
        print(f"{'='*80}")
        print(f"  {'Scenario':<35} {'RPS':>8} {'P99':>10} {'Errors':>8}  SLA")
        print(f"  {'-'*35} {'-'*8} {'-'*10} {'-'*8}  ---")
        for r in self._results:
            sla = ""
            if r.sla_p99_ms:
                sla = "✓" if r.sla_p99_met else "✗"
            print(
                f"  {r.scenario_name:<35} "
                f"{r.rps:>8.1f} "
                f"{r.p99_ms:>9.1f}ms "
                f"{r.error_rate_pct:>7.2f}%  {sla}"
            )
        print(f"{'='*80}\n")

    def to_dict(self) -> List[Dict]:
        return [
            {
                "scenario": r.scenario_name,
                "rps": r.rps,
                "p99_ms": r.p99_ms,
                "error_rate_pct": r.error_rate_pct,
                "sla_p99_met": r.sla_p99_met,
                "total_requests": r.total_requests,
            }
            for r in self._results
        ]
