"""
MemoryMonitor — Real-time memory usage monitoring for LifeOS.

Tracks:
- System memory (total, used, available, percent)
- Process RSS and VMS
- Heap allocations (Python gc)
- Swap usage
- Memory growth rate
- OOM risk assessment
"""

import gc
import os
import sys
import time
import threading
import logging
from typing import Any, Dict, List, Optional
from collections import deque

logger = logging.getLogger(__name__)


class MemoryMonitor:
    """Real-time memory monitor with OOM risk detection."""

    def __init__(
        self,
        interval_s: float = 10.0,
        window_size: int = 30,
        alert_threshold_pct: float = 85.0,
        name: str = "memory_monitor",
    ) -> None:
        self.name = name
        self.interval_s = interval_s
        self.window_size = window_size
        self.alert_threshold_pct = alert_threshold_pct
        self._samples: deque = deque(maxlen=window_size)
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._psutil_available = self._check_psutil()

    def _check_psutil(self) -> bool:
        try:
            import psutil
            return True
        except ImportError:
            return False

    def sample(self) -> Dict[str, Any]:
        ts = time.monotonic()
        if self._psutil_available:
            import psutil
            vm = psutil.virtual_memory()
            swap = psutil.swap_memory()
            proc = psutil.Process()
            mem_info = proc.memory_info()
            gc_counts = gc.get_count()
            return {
                "ts": ts,
                "system_total_mb": round(vm.total / 1_048_576, 1),
                "system_used_mb": round(vm.used / 1_048_576, 1),
                "system_available_mb": round(vm.available / 1_048_576, 1),
                "system_pct": vm.percent,
                "swap_used_mb": round(swap.used / 1_048_576, 1),
                "swap_pct": swap.percent,
                "process_rss_mb": round(mem_info.rss / 1_048_576, 1),
                "process_vms_mb": round(mem_info.vms / 1_048_576, 1),
                "gc_gen0": gc_counts[0],
                "gc_gen1": gc_counts[1],
                "gc_gen2": gc_counts[2],
            }
        else:
            # /proc/meminfo fallback
            try:
                info = {}
                with open("/proc/meminfo") as f:
                    for line in f:
                        k, v = line.split(":")
                        info[k.strip()] = int(v.strip().split()[0])
                total = info.get("MemTotal", 0)
                avail = info.get("MemAvailable", 0)
                used = total - avail
                pct = used / total * 100 if total else 0
                return {
                    "ts": ts,
                    "system_total_mb": round(total / 1024, 1),
                    "system_used_mb": round(used / 1024, 1),
                    "system_available_mb": round(avail / 1024, 1),
                    "system_pct": round(pct, 1),
                }
            except Exception:
                return {"ts": ts}

    def start(self) -> None:
        self._running = True
        self._thread = threading.Thread(
            target=self._collect_loop, daemon=True, name=f"{self.name}_thread"
        )
        self._thread.start()

    def stop(self) -> None:
        self._running = False

    def _collect_loop(self) -> None:
        while self._running:
            s = self.sample()
            with self._lock:
                self._samples.append(s)
            time.sleep(self.interval_s)

    def oom_risk(self) -> str:
        """Return OOM risk level: LOW / MEDIUM / HIGH / CRITICAL."""
        s = self.current()
        if not s:
            return "UNKNOWN"
        pct = s.get("system_pct", 0)
        if pct < 60:
            return "LOW"
        if pct < 75:
            return "MEDIUM"
        if pct < 90:
            return "HIGH"
        return "CRITICAL"

    def current(self) -> Optional[Dict]:
        with self._lock:
            return self._samples[-1] if self._samples else None

    def memory_growth_rate_mb_per_min(self) -> Optional[float]:
        """Estimate memory growth rate from the sample window."""
        with self._lock:
            samples = list(self._samples)
        if len(samples) < 2:
            return None
        first = samples[0]
        last = samples[-1]
        delta_mb = last.get("process_rss_mb", 0) - first.get("process_rss_mb", 0)
        delta_s = last["ts"] - first["ts"]
        if delta_s <= 0:
            return None
        return round(delta_mb / delta_s * 60, 3)

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            samples = list(self._samples)
        if not samples:
            return {"name": self.name, "status": "no_data"}
        latest = samples[-1]
        return {
            "name": self.name,
            "oom_risk": self.oom_risk(),
            "growth_rate_mb_per_min": self.memory_growth_rate_mb_per_min(),
            **latest,
        }

    def __repr__(self) -> str:
        s = self.current()
        pct = s.get("system_pct") if s else None
        return f"MemoryMonitor(name={self.name!r}, system_pct={pct}%)"
