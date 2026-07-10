"""
Review Engine — Complete World-Class Review for LifeOS.
SIGMA-009: World-Class Review
"""

import time
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ReviewCategory(Enum):
    PRODUCT = "product"
    ARCHITECTURE = "architecture"
    SECURITY = "security"
    UX = "ux"
    UI = "ui"
    PERFORMANCE = "performance"
    SCALABILITY = "scalability"
    CODE = "code"
    DOCUMENTATION = "documentation"
    ENTERPRISE = "enterprise"


@dataclass
class ReviewItem:
    """A single review item."""
    category: ReviewCategory
    criterion: str
    score: float = 0.0  # 0-100
    weight: float = 1.0
    status: str = "pending"
    evidence: str = ""
    recommendation: str = ""


@dataclass
class ReviewReport:
    """A complete review report."""
    report_id: str
    timestamp: float = 0.0
    total_score: float = 0.0
    grade: str = ""
    categories: Dict[str, float] = field(default_factory=dict)
    items: List[ReviewItem] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "timestamp": self.timestamp,
            "total_score": self.total_score,
            "grade": self.grade,
            "categories": self.categories,
            "items": [
                {
                    "category": i.category.value,
                    "criterion": i.criterion,
                    "score": i.score,
                    "status": i.status,
                    "evidence": i.evidence,
                    "recommendation": i.recommendation,
                }
                for i in self.items
            ],
        }


class ReviewEngine:
    """
    World-Class Review Engine for LifeOS.

    SIGMA-009: Implements:
    - 9-category review system
    - Weighted scoring
    - Evidence-based evaluation
    - Grade assignment
    - Recommendation generation
    """

    def __init__(self, name: str = "review_engine") -> None:
        self.name = name
        self._items: List[ReviewItem] = []
        self._category_weights = {
            ReviewCategory.PRODUCT: 1.0,
            ReviewCategory.ARCHITECTURE: 1.2,
            ReviewCategory.SECURITY: 1.5,
            ReviewCategory.UX: 1.0,
            ReviewCategory.UI: 0.8,
            ReviewCategory.PERFORMANCE: 1.3,
            ReviewCategory.SCALABILITY: 1.2,
            ReviewCategory.CODE: 1.1,
            ReviewCategory.DOCUMENTATION: 0.8,
            ReviewCategory.ENTERPRISE: 1.4,
        }
        self._init_review_items()

    def _init_review_items(self) -> None:
        """Initialize all review items."""
        items = [
            # Product
            (ReviewCategory.PRODUCT, "Feature completeness", 1.0),
            (ReviewCategory.PRODUCT, "User value delivery", 1.0),
            (ReviewCategory.PRODUCT, "Innovation factor", 1.0),
            # Architecture
            (ReviewCategory.ARCHITECTURE, "Modularity and separation of concerns", 1.2),
            (ReviewCategory.ARCHITECTURE, "Design patterns usage", 1.2),
            (ReviewCategory.ARCHITECTURE, "Dependency management", 1.2),
            (ReviewCategory.ARCHITECTURE, "Microkernel architecture", 1.2),
            # Security
            (ReviewCategory.SECURITY, "Authentication & Authorization", 1.5),
            (ReviewCategory.SECURITY, "Data encryption (at rest/in transit)", 1.5),
            (ReviewCategory.SECURITY, "OWASP Top 10 coverage", 1.5),
            (ReviewCategory.SECURITY, "Key rotation & secret management", 1.5),
            (ReviewCategory.SECURITY, "Pentest results", 1.5),
            (ReviewCategory.SECURITY, "Security monitoring", 1.5),
            # UX
            (ReviewCategory.UX, "User journey flow", 1.0),
            (ReviewCategory.UX, "Consistency across modules", 1.0),
            (ReviewCategory.UX, "Accessibility compliance (WCAG 2.2 AA)", 1.0),
            (ReviewCategory.UX, "Keyboard navigation", 1.0),
            (ReviewCategory.UX, "Screen reader support", 1.0),
            # UI
            (ReviewCategory.UI, "Design system compliance (Apple HIG)", 0.8),
            (ReviewCategory.UI, "Visual consistency", 0.8),
            (ReviewCategory.UI, "Responsive design", 0.8),
            (ReviewCategory.UI, "Dark/Light mode support", 0.8),
            # Performance
            (ReviewCategory.PERFORMANCE, "CPU optimization", 1.3),
            (ReviewCategory.PERFORMANCE, "Memory management", 1.3),
            (ReviewCategory.PERFORMANCE, "Cache strategy", 1.3),
            (ReviewCategory.PERFORMANCE, "Query optimization", 1.3),
            (ReviewCategory.PERFORMANCE, "Lazy loading", 1.3),
            (ReviewCategory.PERFORMANCE, "Startup time", 1.3),
            # Scalability
            (ReviewCategory.SCALABILITY, "Horizontal scaling readiness", 1.2),
            (ReviewCategory.SCALABILITY, "Connection pooling", 1.2),
            (ReviewCategory.SCALABILITY, "Circuit breaker pattern", 1.2),
            (ReviewCategory.SCALABILITY, "Load balancing", 1.2),
            # Code
            (ReviewCategory.CODE, "Code quality (linting)", 1.1),
            (ReviewCategory.CODE, "Type safety", 1.1),
            (ReviewCategory.CODE, "Test coverage (>95%)", 1.1),
            (ReviewCategory.CODE, "Documentation coverage", 1.1),
            (ReviewCategory.CODE, "Tech debt ratio", 1.1),
            # Documentation
            (ReviewCategory.DOCUMENTATION, "Architecture docs", 0.8),
            (ReviewCategory.DOCUMENTATION, "API docs", 0.8),
            (ReviewCategory.DOCUMENTATION, "Security docs", 0.8),
            (ReviewCategory.DOCUMENTATION, "Deployment docs", 0.8),
            (ReviewCategory.DOCUMENTATION, "Runbook", 0.8),
            # Enterprise
            (ReviewCategory.ENTERPRISE, "CI/CD pipeline", 1.4),
            (ReviewCategory.ENTERPRISE, "Observability (logs/tracing/metrics)", 1.4),
            (ReviewCategory.ENTERPRISE, "Alerting & incident management", 1.4),
            (ReviewCategory.ENTERPRISE, "Multi-language support (i18n)", 1.4),
            (ReviewCategory.ENTERPRISE, "Deployment strategies (Blue/Green, Canary)", 1.4),
            (ReviewCategory.ENTERPRISE, "Production certification", 1.4),
        ]

        for cat, criterion, weight in items:
            self._items.append(ReviewItem(
                category=cat,
                criterion=criterion,
                weight=weight,
            ))

    def set_score(self, category: ReviewCategory, criterion: str, score: float, evidence: str = "", recommendation: str = "") -> bool:
        """Set a score for a review item."""
        for item in self._items:
            if item.category == category and item.criterion == criterion:
                item.score = max(0, min(100, score))
                item.status = "reviewed"
                item.evidence = evidence
                item.recommendation = recommendation
                return True
        return False

    def generate_report(self) -> ReviewReport:
        """Generate the complete review report."""
        import hashlib
        report = ReviewReport(
            report_id=hashlib.md5(f"review-{time.time()}".encode()).hexdigest()[:12],
            timestamp=time.time(),
        )

        # Calculate per-category scores (0-10 scale)
        category_scores = {}
        for item in self._items:
            if item.status == "reviewed":
                if item.category not in category_scores:
                    category_scores[item.category] = []
                # item.score is 0-100, normalize to 0-10
                category_scores[item.category].append(item.score / 10 * item.weight)

        for cat in ReviewCategory:
            scores = category_scores.get(cat, [])
            if scores:
                total_w = sum(item.weight for item in self._items if item.category == cat and item.status == "reviewed")
                report.categories[cat.value] = round(sum(scores) / total_w, 1) if total_w > 0 else 0.0
            else:
                report.categories[cat.value] = 0.0

        # Calculate total weighted score (0-10)
        total_weighted = 0.0
        total_weight = 0.0
        for item in self._items:
            if item.status == "reviewed":
                total_weighted += (item.score / 10) * item.weight
                total_weight += item.weight

        report.total_score = round(total_weighted / total_weight, 1) if total_weight > 0 else 0.0

        # Grade (0-10 scale)
        s = report.total_score
        if s >= 9.5:
            report.grade = "A+"
        elif s >= 9.0:
            report.grade = "A"
        elif s >= 8.5:
            report.grade = "B+"
        elif s >= 8.0:
            report.grade = "B"
        elif s >= 7.5:
            report.grade = "C+"
        elif s >= 7.0:
            report.grade = "C"
        else:
            report.grade = "D"

        report.items = list(self._items)
        return report

    def stats(self) -> Dict[str, Any]:
        reviewed = sum(1 for i in self._items if i.status == "reviewed")
        return {
            "name": self.name,
            "total_items": len(self._items),
            "reviewed": reviewed,
            "pending": len(self._items) - reviewed,
        }

    def __repr__(self) -> str:
        return (
            f"ReviewEngine(name={self.name!r}, "
            f"items={len(self._items)}, "
            f"reviewed={sum(1 for i in self._items if i.status == 'reviewed')})"
        )
