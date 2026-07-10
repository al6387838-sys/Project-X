"""
CPUMonitor — Real-time CPU usage monitoring for LifeOS.

Tracks:
- Per-core and aggregate CPU utilization
- Process CPU usage
- CPU frequency
- Load averages (1m, 5m, 15m)
- CPU throttling events
- Thread count
"""

import os
import time
import threading
import logging
from typing import Any, Dict, List, Optional
from collections import deque

logger = logging.getLogger(__name__)


class CPUMonitor:
    """
    Real-time CPU monitor with rolling window statistics.

    Collects samples every `interval_s` seconds and maintains
    a rolling window of the last `window_size` samples.
    """

    def __init__(
        self,
        interval_s: float = 5.0,
        window_size: int = 60,  # 5 min at 5s intervals
        alert_threshold_pct: float = 80.0,
        name: str = "cpu_monitor",
    ) -> None:
        self.name = name
        self.interval_s = interval_s
        self.window_size = window_size
        self.alert_threshold_pct = alert_threshold_pct
        self._samples: deque = deque(maxlen=window_size)
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._alerts: List[Dict] = []
        self._psutil_available = self._check_psutil()

    def _check_psutil(self) -> bool:
        try:
            import psutil
            return True
        except ImportError:
            logger.warning("[CPUMonitor] psutil not available. Using /proc fallback.")
            return False

    # ------------------------------------------------------------------
    # Sampling
    # ------------------------------------------------------------------

    def sample(self) -> Dict[str, Any]:
        """Take a single CPU sample."""
        ts = time.monotonic()
        if self._psutil_available:
            return self._sample_psutil(ts)
        return self._sample_proc(ts)

    def _sample_psutil(self, ts: float) -> Dict[str, Any]:
        import psutil
        cpu_pct = psutil.cpu_percent(interval=None)
        per_core = psutil.cpu_percent(percpu=True)
        freq = psutil.cpu_freq()
        load = os.getloadavg()
        proc = psutil.Process()
        return {
            "ts": ts,
            "cpu_pct": cpu_pct,
            "per_core_pct": per_core,
            "core_count": len(per_core),
            "freq_mhz": freq.current if freq else None,
            "freq_max_mhz": freq.max if freq else None,
            "load_1m": load[0],
            "load_5m": load[1],
            "load_15m": load[2],
            "process_cpu_pct": proc.cpu_percent(interval=None),
            "thread_count": proc.num_threads(),
        }

    def _sample_proc(self, ts: float) -> Dict[str, Any]:
        """Fallback: read from /proc/stat."""
        try:
            with open("/proc/loadavg") as f:
                parts = f.read().split()
            load_1m = float(parts[0])
            load_5m = float(parts[1])
            load_15m = float(parts[2])
        except Exception:
            load_1m = load_5m = load_15m = 0.0
        return {
            "ts": ts,
            "cpu_pct": None,
            "load_1m": load_1m,
            "load_5m": load_5m,
            "load_15m": load_15m,
        }

    # ------------------------------------------------------------------
    # Background collection
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._psutil_available:
            import psutil
            psutil.cpu_percent(interval=None)  # warm up
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
                # Check alert threshold
                if s.get("cpu_pct") and s["cpu_pct"] > self.alert_threshold_pct:
                    self._alerts.append({
                        "ts": s["ts"],
                        "cpu_pct": s["cpu_pct"],
                        "threshold": self.alert_threshold_pct,
                    })
                    if len(self._alerts) > 100:
                        self._alerts = self._alerts[-100:]
            time.sleep(self.interval_s)

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def current(self) -> Optional[Dict]:
        with self._lock:
            return self._samples[-1] if self._samples else None

    def average_cpu_pct(self) -> Optional[float]:
        with self._lock:
            values = [s["cpu_pct"] for s in self._samples if s.get("cpu_pct") is not None]
        return sum(values) / len(values) if values else None

    def peak_cpu_pct(self) -> Optional[float]:
        with self._lock:
            values = [s["cpu_pct"] for s in self._samples if s.get("cpu_pct") is not None]
        return max(values) if values else None

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            samples = list(self._samples)
        if not samples:
            return {"name": self.name, "status": "no_data"}
        latest = samples[-1]
        cpu_values = [s["cpu_pct"] for s in samples if s.get("cpu_pct") is not None]
        return {
            "name": self.name,
            "current_cpu_pct": latest.get("cpu_pct"),
            "avg_cpu_pct": round(sum(cpu_values) / len(cpu_values), 2) if cpu_values else None,
            "peak_cpu_pct": max(cpu_values) if cpu_values else None,
            "load_1m": latest.get("load_1m"),
            "load_5m": latest.get("load_5m"),
            "load_15m": latest.get("load_15m"),
            "thread_count": latest.get("thread_count"),
            "core_count": latest.get("core_count"),
            "alert_count": len(self._alerts),
            "sample_count": len(samples),
        }

    def __repr__(self) -> str:
        current = self.current()
        cpu = current.get("cpu_pct") if current else None
        return f"CPUMonitor(name={self.name!r}, current={cpu}%)"
