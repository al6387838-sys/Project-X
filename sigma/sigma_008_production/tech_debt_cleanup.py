"""
Tech Debt Cleanup — Technical Debt Elimination for LifeOS.
SIGMA-008: Production Certification
"""

import time
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class DebtType(Enum):
    CODE = "code"
    TEST = "test"
    DOCUMENTATION = "documentation"
    DESIGN = "design"
    DEPENDENCY = "dependency"
    SECURITY = "security"


class DebtPriority(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class TechDebtItem:
    """A technical debt item."""
    id: str
    title: str
    debt_type: DebtType
    priority: DebtPriority
    description: str
    estimated_hours: float = 0.0
    created_at: float = 0.0
    resolved_at: float = 0.0
    resolved: bool = False
    module: str = ""


class TechDebtCleanup:
    """
    World-Class Technical Debt Elimination for LifeOS.

    SIGMA-008: Implements:
    - Debt inventory and tracking
    - Priority-based cleanup
    - Resolution tracking
    - Debt ratio calculation
    - Automated cleanup recommendations
    """

    def __init__(self, name: str = "tech_debt_cleanup") -> None:
        self.name = name
        self._debts: List[TechDebtItem] = []
        self._resolved: List[TechDebtItem] = []
        self._counter = 0
        self._stats = {
            "total": 0,
            "resolved": 0,
            "remaining": 0,
            "total_hours_estimate": 0.0,
        }

    def add_debt(self, title: str, debt_type: DebtType, priority: DebtPriority, description: str, estimated_hours: float = 1.0, module: str = "") -> TechDebtItem:
        """Add a technical debt item."""
        self._counter += 1
        item = TechDebtItem(
            id=f"TD-{self._counter:04d}",
            title=title,
            debt_type=debt_type,
            priority=priority,
            description=description,
            estimated_hours=estimated_hours,
            created_at=time.time(),
            module=module,
        )
        self._debts.append(item)
        self._stats["total"] += 1
        self._stats["total_hours_estimate"] += estimated_hours
        self._stats["remaining"] += 1
        return item

    def resolve_debt(self, debt_id: str) -> bool:
        """Resolve a technical debt item."""
        for item in self._debts:
            if item.id == debt_id:
                item.resolved = True
                item.resolved_at = time.time()
                self._debts.remove(item)
                self._resolved.append(item)
                self._stats["resolved"] += 1
                self._stats["remaining"] -= 1
                return True
        return False

    def get_by_priority(self, priority: DebtPriority) -> List[TechDebtItem]:
        return [d for d in self._debts if d.priority == priority]

    def get_critical_debts(self) -> List[TechDebtItem]:
        return self.get_by_priority(DebtPriority.CRITICAL)

    def get_total_hours(self) -> float:
        return sum(d.estimated_hours for d in self._debts)

    def get_debt_ratio(self) -> float:
        total = self._stats["total"]
        if total == 0:
            return 0.0
        return round(self._stats["resolved"] / total * 100, 1)

    def cleanup_plan(self) -> Dict[str, Any]:
        """Generate a cleanup plan prioritized by impact."""
        critical = self.get_by_priority(DebtPriority.CRITICAL)
        high = self.get_by_priority(DebtPriority.HIGH)
        medium = self.get_by_priority(DebtPriority.MEDIUM)
        low = self.get_by_priority(DebtPriority.LOW)

        return {
            "phase_1_critical": {"items": len(critical), "hours": sum(d.estimated_hours for d in critical)},
            "phase_2_high": {"items": len(high), "hours": sum(d.estimated_hours for d in high)},
            "phase_3_medium": {"items": len(medium), "hours": sum(d.estimated_hours for d in medium)},
            "phase_4_low": {"items": len(low), "hours": sum(d.estimated_hours for d in low)},
            "total_remaining": self._stats["remaining"],
            "total_hours": self.get_total_hours(),
        }

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self._stats,
            "debt_ratio": self.get_debt_ratio(),
            "remaining_hours": self.get_total_hours(),
            "cleanup_plan": self.cleanup_plan(),
        }

    def __repr__(self) -> str:
        return (
            f"TechDebtCleanup(name={self.name!r}, "
            f"remaining={self._stats['remaining']}, "
            f"resolved={self._stats['resolved']})"
        )
