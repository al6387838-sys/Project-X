"""
SIGMA-007 Observability Suite — Consolidated Runner.
"""

import time
import logging
from typing import Dict, Any

from .logging_engine import LoggingEngine, LogLevel
from .tracing_engine import TracingEngine, SpanStatus
from .metrics_engine import MetricsEngine
from .alerting_engine import AlertingEngine, AlertSeverity
from .incident_ai import IncidentAIDetector

logger = logging.getLogger(__name__)


class SIGMA007Suite:
    """SIGMA-007: World-Class Observability Pro Suite."""

    def __init__(self) -> None:
        logger.info("[SIGMA-007] Initializing Observability Suite...")
        self.logger_engine = LoggingEngine()
        self.tracing = TracingEngine()
        self.metrics = MetricsEngine()
        self.alerting = AlertingEngine()
        self.incident_ai = IncidentAIDetector()
        logger.info("[SIGMA-007] All observability engines initialized.")

    def run_full_suite(self) -> Dict[str, Any]:
        print("\n" + "=" * 70)
        print("  SIGMA-007: OBSERVABILITY PRO SUITE")
        print("  Logs, Tracing, Metrics, Dashboards, Alerts, AI")
        print("=" * 70)

        # Logging
        print("\n  [1/6] Structured Logging...")
        self.logger_engine.set_context(trace_id="test-trace", module="lifeos")
        self.logger_engine.info("LifeOS initialized")
        self.logger_engine.debug("Debug trace")
        self.logger_engine.warning("High memory usage detected")
        self.logger_engine.error("Database connection timeout")
        log_stats = self.logger_engine.stats()
        print(f"  ✓ Logging: {log_stats['total_logs']} entries logged")

        # Tracing
        print("\n  [2/6] Distributed Tracing...")
        trace = self.tracing.start_trace("user_request", module="api")
        span1 = self.tracing.start_span(trace.trace_id, "auth", module="auth", parent_span_id=trace.root_span.span_id)
        time.sleep(0.01)
        self.tracing.finish_span(span1.span_id)
        span2 = self.tracing.start_span(trace.trace_id, "query", module="db", parent_span_id=trace.root_span.span_id)
        time.sleep(0.01)
        self.tracing.finish_span(span2.span_id)
        self.tracing.finish_trace(trace.trace_id)
        print(f"  ✓ Tracing: {self.tracing.stats()['total_traces']} traces, root {trace.root_span.duration_ms}ms")

        # Metrics
        print("\n  [3/6] Metrics Collection...")
        self.metrics.set_gauge("lifeos_active_users", 1542)
        self.metrics.set_gauge("lifeos_cache_hit_rate", 0.95)
        self.metrics.increment("lifeos_tasks_completed", 50)
        for i in range(100):
            self.metrics.observe("http_request_duration_seconds", (i % 50) * 10.0)
        export = self.metrics.export()
        print(f"  ✓ Metrics: {len(export)} metrics exported")

        # Alerting
        print("\n  [4/6] Alerting System...")
        alerts = self.alerting.evaluate_rules()
        print(f"  ✓ Alerting: {len(self.alerting._rules)} rules, {len(alerts)} alerts fired")

        # AI Incident Detection
        print("\n  [5/6] AI Incident Detection...")
        # Normal data
        for i in range(50):
            self.incident_ai.record_metric("cpu_usage", 45.0 + (i % 10) * 0.5)
        # Anomalous data
        for i in range(5):
            self.incident_ai.record_metric("cpu_usage", 98.0 + i)
        correlations = self.incident_ai.analyze_correlations()
        print(f"  ✓ AI Detection: {self.incident_ai.stats()['total_anomalies']} anomalies detected")
        print(f"  ✓ Correlations: {len(correlations)} metric pairs")

        # Dashboard Export
        print("\n  [6/6] Dashboard Export...")
        dashboard = {
            "logging": self.logger_engine.stats(),
            "tracing": self.tracing.stats(),
            "metrics": self.metrics.stats(),
            "alerting": self.alerting.stats(),
            "incident_ai": self.incident_ai.stats(),
        }
        print(f"  ✓ Dashboard: 5 panels ready")

        print("\n" + "=" * 70)
        print("  SIGMA-007 OBSERVABILITY SUMMARY")
        print("=" * 70)
        print(f"  Structured Logging:     ✓ {log_stats['total_logs']} entries")
        print(f"  Distributed Tracing:    ✓ {self.tracing.stats()['total_traces']} traces")
        print(f"  Metrics:                ✓ {len(export)} metrics")
        print(f"  Alerting:               ✓ {len(self.alerting._rules)} rules")
        print(f"  AI Detection:           ✓ {self.incident_ai.stats()['total_anomalies']} anomalies")
        print(f"  Correlations:           ✓ {len(correlations)} pairs")
        print("=" * 70)

        return dashboard

    def get_full_stats(self) -> Dict[str, Any]:
        return {
            "logging": self.logger_engine.stats(),
            "tracing": self.tracing.stats(),
            "metrics": self.metrics.stats(),
            "alerting": self.alerting.stats(),
            "incident_ai": self.incident_ai.stats(),
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    suite = SIGMA007Suite()
    suite.run_full_suite()
