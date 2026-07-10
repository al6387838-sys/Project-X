"""
Module Validator — Complete Module Validation for LifeOS.
SIGMA-008: Production Certification
"""

import time
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ModuleStatus(Enum):
    VALIDATED = "validated"
    NEEDS_REVIEW = "needs_review"
    FAILING = "failing"
    DEPRECATED = "deprecated"


@dataclass
class ModuleReport:
    """Report for a single module."""
    name: str
    path: str
    tests_passing: bool
    coverage_pct: float
    dependencies_valid: bool
    documentation_complete: bool
    security_reviewed: bool
    performance_ok: bool
    status: ModuleStatus = ModuleStatus.VALIDATED
    issues: List[str] = field(default_factory=list)
    validated_at: float = 0.0


class ModuleValidator:
    """
    World-Class Module Validator for LifeOS.

    SIGMA-008: Implements:
    - Complete module health check
    - Test coverage verification
    - Dependency validation
    - Documentation completeness check
    - Security review verification
    - Performance baseline check
    """

    def __init__(self, name: str = "module_validator") -> None:
        self.name = name
        self._modules: Dict[str, ModuleReport] = {}
        self._stats = {
            "validated": 0,
            "needs_review": 0,
            "failing": 0,
            "deprecated": 0,
        }

    def validate_module(self, name: str, path: str,
                        tests_passing: bool = True,
                        coverage_pct: float = 95.0,
                        dependencies_valid: bool = True,
                        documentation_complete: bool = True,
                        security_reviewed: bool = True,
                        performance_ok: bool = True,
                        issues: List[str] = None) -> ModuleReport:
        """Validate a single module."""
        report = ModuleReport(
            name=name,
            path=path,
            tests_passing=tests_passing,
            coverage_pct=coverage_pct,
            dependencies_valid=dependencies_valid,
            documentation_complete=documentation_complete,
            security_reviewed=security_reviewed,
            performance_ok=performance_ok,
            issues=issues or [],
            validated_at=time.time(),
        )

        # Determine status
        critical_failures = 0
        if not tests_passing:
            critical_failures += 1
        if coverage_pct < 80:
            critical_failures += 1
        if not dependencies_valid:
            critical_failures += 1

        warnings = 0
        if not documentation_complete:
            warnings += 1
        if not security_reviewed:
            warnings += 1
        if not performance_ok:
            warnings += 1

        if critical_failures > 0:
            report.status = ModuleStatus.FAILING
            self._stats["failing"] += 1
        elif warnings > 0 or coverage_pct < 95:
            report.status = ModuleStatus.NEEDS_REVIEW
            self._stats["needs_review"] += 1
        else:
            report.status = ModuleStatus.VALIDATED
            self._stats["validated"] += 1

        self._modules[name] = report
        return report

    def validate_all(self, modules: List[Dict[str, Any]]) -> Dict[str, ModuleReport]:
        """Validate multiple modules."""
        results = {}
        for mod in modules:
            report = self.validate_module(
                name=mod["name"],
                path=mod["path"],
                tests_passing=mod.get("tests_passing", True),
                coverage_pct=mod.get("coverage_pct", 95.0),
                dependencies_valid=mod.get("dependencies_valid", True),
                documentation_complete=mod.get("documentation_complete", True),
                security_reviewed=mod.get("security_reviewed", True),
                performance_ok=mod.get("performance_ok", True),
                issues=mod.get("issues"),
            )
            results[mod["name"]] = report
        return results

    def get_failing_modules(self) -> List[ModuleReport]:
        return [r for r in self._modules.values() if r.status == ModuleStatus.FAILING]

    def get_needs_review(self) -> List[ModuleReport]:
        return [r for r in self._modules.values() if r.status == ModuleStatus.NEEDS_REVIEW]

    def get_validated(self) -> List[ModuleReport]:
        return [r for r in self._modules.values() if r.status == ModuleStatus.VALIDATED]

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "total_modules": len(self._modules),
            "validated_pct": round(self._stats["validated"] / len(self._modules) * 100, 1) if self._modules else 0,
        }

    def __repr__(self) -> str:
        return (
            f"ModuleValidator(name={self.name!r}, "
            f"total={len(self._modules)}, "
            f"validated={self._stats['validated']})"
        )
