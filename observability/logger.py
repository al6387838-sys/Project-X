"""
LifeOS Structured Logger
=========================
JSON-structured logging for production observability.
Compatible with Loki/Grafana log aggregation.
"""
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class LifeOSLogger:
    """
    Structured JSON logger for LifeOS.
    Outputs JSON lines compatible with Loki ingestion.
    """

    LEVELS = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }

    def __init__(
        self,
        name: str,
        level: str = None,
        log_file: Optional[str] = None,
    ):
        self.name = name
        self.version = os.getenv("LIFEOS_VERSION", "1.0.0-rc")
        self.environment = os.getenv("LIFEOS_ENV", "development")

        level_str = level or os.getenv("LOG_LEVEL", "INFO")
        self.level = self.LEVELS.get(level_str.upper(), logging.INFO)

        self._logger = logging.getLogger(name)
        self._logger.setLevel(self.level)

        # Console handler
        if not self._logger.handlers:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setFormatter(self._JsonFormatter())
            self._logger.addHandler(console_handler)

            # File handler
            if log_file:
                os.makedirs(os.path.dirname(log_file), exist_ok=True)
                file_handler = logging.FileHandler(log_file)
                file_handler.setFormatter(self._JsonFormatter())
                self._logger.addHandler(file_handler)

    class _JsonFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            log_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "module": record.module,
                "function": record.funcName,
                "line": record.lineno,
            }
            if hasattr(record, "extra"):
                log_entry.update(record.extra)
            if record.exc_info:
                log_entry["exception"] = self.formatException(record.exc_info)
            return json.dumps(log_entry, ensure_ascii=False)

    def _log(self, level: int, message: str, **kwargs):
        extra = {
            "service": self.name,
            "version": self.version,
            "environment": self.environment,
            **kwargs,
        }
        record = self._logger.makeRecord(
            self.name, level, "", 0, message, (), None
        )
        record.extra = extra
        self._logger.handle(record)

    def debug(self, message: str, **kwargs):
        self._log(logging.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs):
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs):
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs):
        self._log(logging.ERROR, message, **kwargs)

    def critical(self, message: str, **kwargs):
        self._log(logging.CRITICAL, message, **kwargs)

    def audit(self, action: str, user_id: str, resource: str, **kwargs):
        """Structured audit log entry."""
        self._log(
            logging.INFO,
            f"AUDIT: {action} on {resource} by {user_id}",
            audit=True,
            action=action,
            user_id=user_id,
            resource=resource,
            **kwargs,
        )

    def performance(self, operation: str, duration_ms: float, **kwargs):
        """Performance metric log entry."""
        self._log(
            logging.INFO,
            f"PERF: {operation} completed in {duration_ms:.2f}ms",
            metric=True,
            operation=operation,
            duration_ms=duration_ms,
            **kwargs,
        )


# Default logger instance
logger = LifeOSLogger("lifeos")
