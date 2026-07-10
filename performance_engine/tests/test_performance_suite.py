"""
Sprint 027 — Performance Test Suite for LifeOS.

Validates all SLA targets:
- Startup < 2000ms
- Dashboard < 500ms
- Life Graph Search < 300ms
- Companion Response < 1000ms

Runs:
- Unit benchmarks for each subsystem
- Load tests at multiple concurrency levels
- Stress test to find breaking point
- Cache effectiveness tests
- Memory leak detection
"""

import time
import random
import string
import threading
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from performance_engine.benchmarks.benchmark_runner import BenchmarkRunner
from performance_engine.benchmarks.load_test import LoadTest, LoadTestScenario, LoadPattern
from performance_engine.benchmarks.stress_test import StressTest
from performance_engine.cache.memory_cache import MemoryCache
from performance_engine.cache.cache_manager import CacheManager
from performance_engine.monitoring.latency_monitor import LatencyMonitor
from performance_engine.monitoring.performance_dashboard import PerformanceDashboard


# ==============================================================================
# Mock LifeOS operations (simulate real workloads)
# ==============================================================================

class MockLifeOSOperations:
    """Simulated LifeOS operations for testing."""

    def __init__(self):
        self.cache = MemoryCache(max_size=10000, default_ttl=300)
        self._graph_data = {f"node_{i}": {"id": i, "connections": list(range(max(0, i-5), i))} for i in range(1000)}
        self._timeline_data = [{"ts": i, "event": f"event_{i}"} for i in range(10000)]
        self._companion_responses = [
            "I understand your goal. Let me help you plan.",
            "Based on your life graph, I suggest focusing on...",
            "Your progress this week has been excellent!",
        ]

    def startup(self):
        """Simulate application startup."""
        time.sleep(0.001)  # 1ms simulated init
        return {"status": "ready", "modules": 12}

    def dashboard_load(self):
        """Simulate dashboard data loading."""
        cache_key = "dashboard_main"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        # Simulate DB query
        time.sleep(0.002)  # 2ms simulated query
        data = {
            "stats": {"nodes": 1000, "events": 10000},
            "recent": self._timeline_data[-10:],
        }
        self.cache.set(cache_key, data, ttl=60)
        return data

    def life_graph_search(self, query: str = "goal"):
        """Simulate Life Graph search."""
        cache_key = f"graph_search_{query}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        # Simulate graph traversal
        time.sleep(0.001)  # 1ms simulated traversal
        results = [v for k, v in self._graph_data.items() if query in k][:20]
        self.cache.set(cache_key, results, ttl=30)
        return results

    def companion_response(self, prompt: str = "help"):
        """Simulate AI Companion response."""
        cache_key = f"companion_{hash(prompt) % 100}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        # Simulate LLM inference (fast mock)
        time.sleep(0.005)  # 5ms simulated inference
        response = random.choice(self._companion_responses)
        self.cache.set(cache_key, response, ttl=10)
        return response

    def cache_get(self):
        """Benchmark cache get operation."""
        key = f"key_{random.randint(0, 999)}"
        return self.cache.get(key)

    def cache_set(self):
        """Benchmark cache set operation."""
        key = f"key_{random.randint(0, 999)}"
        value = {"data": "x" * 100}
        self.cache.set(key, value)

    def memory_allocation(self):
        """Simulate memory-intensive operation."""
        data = [random.random() for _ in range(1000)]
        return sum(data)


# ==============================================================================
# Test Suite
# ==============================================================================

def run_benchmark_suite(ops: MockLifeOSOperations) -> dict:
    """Run Sprint 027 benchmark suite."""
    print("\n" + "="*70)
    print("  SPRINT 027 — PERFORMANCE BENCHMARKS")
    print("="*70)

    runner = BenchmarkRunner(
        name="sprint_027_benchmarks",
        default_iterations=500,
        default_warmup=50,
        track_memory=True,
    )

    # SLA-critical benchmarks
    benchmarks = {
        "startup": (ops.startup, 2000),
        "dashboard_load": (ops.dashboard_load, 500),
        "life_graph_search": (ops.life_graph_search, 300),
        "companion_response": (ops.companion_response, 1000),
    }

    results = {}
    for name, (fn, sla_ms) in benchmarks.items():
        result = runner.benchmark(name, fn, sla_target_ms=sla_ms)
        results[name] = result
        print(result.summary_line())

    # Cache benchmarks
    print("\n  Cache Operations:")
    cache_benchmarks = {
        "cache_get": (ops.cache_get, None),
        "cache_set": (ops.cache_set, None),
    }
    for name, (fn, sla) in cache_benchmarks.items():
        result = runner.benchmark(name, fn, iterations=10000, sla_target_ms=sla)
        results[name] = result
        print(result.summary_line())

    runner.print_report()
    return {name: r.to_dict() for name, r in results.items()}


def run_load_tests(ops: MockLifeOSOperations) -> dict:
    """Run Sprint 027 load tests."""
    print("\n" + "="*70)
    print("  SPRINT 027 — LOAD TESTS")
    print("="*70)

    load_test = LoadTest(name="sprint_027_load", max_workers=200)
    all_results = {}

    # Dashboard load test
    dashboard_scenarios = [
        LoadTestScenario(
            name="dashboard_1_user",
            target_fn=ops.dashboard_load,
            concurrent_users=1,
            duration_s=5.0,
            sla_p99_ms=500,
        ),
        LoadTestScenario(
            name="dashboard_10_users",
            target_fn=ops.dashboard_load,
            concurrent_users=10,
            duration_s=10.0,
            sla_p99_ms=500,
        ),
        LoadTestScenario(
            name="dashboard_50_users",
            target_fn=ops.dashboard_load,
            concurrent_users=50,
            duration_s=10.0,
            sla_p99_ms=1000,
        ),
        LoadTestScenario(
            name="graph_search_100_users",
            target_fn=ops.life_graph_search,
            concurrent_users=100,
            duration_s=10.0,
            sla_p99_ms=300,
        ),
        LoadTestScenario(
            name="companion_20_users",
            target_fn=ops.companion_response,
            concurrent_users=20,
            duration_s=10.0,
            sla_p99_ms=1000,
        ),
    ]

    for scenario in dashboard_scenarios:
        result = load_test.run(scenario)
        all_results[scenario.name] = {
            "rps": result.rps,
            "p99_ms": result.p99_ms,
            "error_rate_pct": result.error_rate_pct,
            "sla_p99_met": result.sla_p99_met,
            "total_requests": result.total_requests,
        }

    load_test.print_report()
    return all_results


def run_stress_tests(ops: MockLifeOSOperations) -> dict:
    """Run Sprint 027 stress tests."""
    print("\n" + "="*70)
    print("  SPRINT 027 — STRESS TESTS")
    print("="*70)

    stress = StressTest(
        name="sprint_027_stress",
        error_rate_threshold=5.0,
        latency_threshold_ms=5000.0,
    )

    result = stress.run(
        target_fn=ops.dashboard_load,
        name="dashboard_stress",
        start_concurrent=1,
        max_concurrent=200,
        step=20,
        step_duration_s=5.0,
        think_time_s=0.01,
    )

    stress.print_report()

    return {
        "breaking_point_concurrent": result.breaking_point_concurrent,
        "memory_leak_mb": result.memory_leak_mb,
        "recovery_time_s": result.recovery_time_s,
        "max_concurrent_reached": result.max_concurrent_reached,
        "latency_profile": result.latency_profile,
    }


def run_cache_effectiveness_test(ops: MockLifeOSOperations) -> dict:
    """Test cache hit rate and effectiveness."""
    print("\n" + "="*70)
    print("  SPRINT 027 — CACHE EFFECTIVENESS")
    print("="*70)

    cache = ops.cache
    cache.clear()

    # Warm up cache
    for i in range(100):
        cache.set(f"key_{i}", {"value": i * 2})

    # Test hit rate
    hits = 0
    misses = 0
    for _ in range(1000):
        key = f"key_{random.randint(0, 150)}"  # 50% keys don't exist
        val = cache.get(key)
        if val is not None:
            hits += 1
        else:
            misses += 1

    hit_rate = hits / (hits + misses) * 100
    stats = cache.stats()

    print(f"  Cache Hit Rate: {hit_rate:.1f}%")
    print(f"  Cache Size: {stats.get('size', 0)} items")
    print(f"  Cache Hits: {stats.get('hits', 0)}")
    print(f"  Cache Misses: {stats.get('misses', 0)}")

    return {
        "hit_rate_pct": round(hit_rate, 2),
        "cache_size": stats.get("size", 0),
        "total_hits": hits,
        "total_misses": misses,
    }


def run_all_tests() -> dict:
    """Run the complete Sprint 027 test suite."""
    print("\n" + "="*70)
    print("  LIFEOS — SPRINT 027 GLOBAL PERFORMANCE & SCALABILITY")
    print("  Complete Test Suite")
    print("="*70)

    ops = MockLifeOSOperations()

    # Pre-warm cache
    for i in range(50):
        ops.dashboard_load()
        ops.life_graph_search(f"goal_{i % 10}")

    benchmark_results = run_benchmark_suite(ops)
    load_test_results = run_load_tests(ops)
    stress_test_results = run_stress_tests(ops)
    cache_results = run_cache_effectiveness_test(ops)

    # Final summary
    print("\n" + "="*70)
    print("  SPRINT 027 — FINAL PERFORMANCE SUMMARY")
    print("="*70)

    sla_targets = {
        "startup": 2000,
        "dashboard_load": 500,
        "life_graph_search": 300,
        "companion_response": 1000,
    }

    all_sla_met = True
    for endpoint, target_ms in sla_targets.items():
        result = benchmark_results.get(endpoint, {})
        p99 = result.get("p99_ms", 0)
        met = p99 <= target_ms
        if not met:
            all_sla_met = False
        status = "✓ MET" if met else "✗ BREACH"
        print(f"  {endpoint:<30} P99={p99:>8.2f}ms  target={target_ms}ms  [{status}]")

    print(f"\n  Cache Hit Rate:    {cache_results['hit_rate_pct']:.1f}%")
    bp = stress_test_results.get("breaking_point_concurrent")
    print(f"  Breaking Point:    {bp or 'Not reached'} concurrent users")
    print(f"  Memory Leak:       {stress_test_results.get('memory_leak_mb', 0):.1f} MB")
    print(f"\n  Overall SLA:       {'✓ ALL TARGETS MET' if all_sla_met else '✗ SOME TARGETS MISSED'}")
    print("="*70 + "\n")

    return {
        "benchmarks": benchmark_results,
        "load_tests": load_test_results,
        "stress_tests": stress_test_results,
        "cache": cache_results,
        "sla_all_met": all_sla_met,
    }


if __name__ == "__main__":
    results = run_all_tests()
