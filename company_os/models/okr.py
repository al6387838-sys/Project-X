"""
OKR Models
==========
Modelos para o sistema de OKRs (Objectives and Key Results) da LifeOS.

Suporta ciclos trimestrais, anuais e personalizados.
Cada Objective tem múltiplos Key Results com progresso rastreável.
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from enum import Enum
import uuid


class OKRStatus(str, Enum):
    """Status de um OKR ou Key Result."""
    NOT_STARTED = "not_started"
    ON_TRACK    = "on_track"
    AT_RISK     = "at_risk"
    BEHIND      = "behind"
    COMPLETED   = "completed"
    CANCELLED   = "cancelled"


class OKRLevel(str, Enum):
    """Nível hierárquico do OKR."""
    COMPANY = "company"
    TEAM    = "team"
    INDIVIDUAL = "individual"


@dataclass
class KeyResult:
    """
    Key Result — resultado mensurável de um Objective.

    Cada KR tem uma métrica, valor inicial, meta e progresso atual.
    """
    kr_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    title: str = ""
    description: str = ""
    metric_name: str = ""
    start_value: float = 0.0
    target_value: float = 0.0
    current_value: float = 0.0
    unit: str = ""
    weight: float = 1.0
    status: OKRStatus = OKRStatus.NOT_STARTED
    owner: str = ""
    last_updated: datetime = field(default_factory=datetime.utcnow)
    notes: str = ""

    @property
    def progress_pct(self) -> float:
        """Progresso em % em relação à meta."""
        if self.target_value == self.start_value:
            return 100.0 if self.current_value >= self.target_value else 0.0
        range_ = self.target_value - self.start_value
        progress = self.current_value - self.start_value
        return round(min(max(progress / range_ * 100, 0), 100), 1)

    def update(self, new_value: float, notes: str = "") -> None:
        """Atualiza o valor atual e recalcula o status."""
        self.current_value = new_value
        self.last_updated = datetime.utcnow()
        if notes:
            self.notes = notes

        p = self.progress_pct
        if p >= 100:
            self.status = OKRStatus.COMPLETED
        elif p >= 70:
            self.status = OKRStatus.ON_TRACK
        elif p >= 40:
            self.status = OKRStatus.AT_RISK
        else:
            self.status = OKRStatus.BEHIND

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kr_id": self.kr_id,
            "title": self.title,
            "metric_name": self.metric_name,
            "start_value": self.start_value,
            "target_value": self.target_value,
            "current_value": self.current_value,
            "unit": self.unit,
            "progress_pct": self.progress_pct,
            "status": self.status.value,
            "owner": self.owner,
            "last_updated": self.last_updated.isoformat(),
            "notes": self.notes,
        }


@dataclass
class Objective:
    """
    Objective — meta qualitativa de alto nível.

    Cada Objective contém múltiplos Key Results que
    medem o progresso quantitativo em direção ao objetivo.
    """
    objective_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    title: str = ""
    description: str = ""
    level: OKRLevel = OKRLevel.COMPANY
    owner: str = ""
    key_results: List[KeyResult] = field(default_factory=list)
    status: OKRStatus = OKRStatus.NOT_STARTED
    created_at: datetime = field(default_factory=datetime.utcnow)
    tags: List[str] = field(default_factory=list)

    @property
    def overall_progress_pct(self) -> float:
        """Progresso geral ponderado dos Key Results."""
        if not self.key_results:
            return 0.0
        total_weight = sum(kr.weight for kr in self.key_results)
        weighted_progress = sum(
            kr.progress_pct * kr.weight for kr in self.key_results
        )
        return round(weighted_progress / total_weight, 1) if total_weight > 0 else 0.0

    @property
    def computed_status(self) -> OKRStatus:
        """Status calculado com base no progresso dos KRs."""
        if not self.key_results:
            return OKRStatus.NOT_STARTED
        p = self.overall_progress_pct
        if p >= 100:
            return OKRStatus.COMPLETED
        elif p >= 70:
            return OKRStatus.ON_TRACK
        elif p >= 40:
            return OKRStatus.AT_RISK
        else:
            return OKRStatus.BEHIND

    def add_key_result(self, kr: KeyResult) -> None:
        self.key_results.append(kr)
        self.status = self.computed_status

    def to_dict(self) -> Dict[str, Any]:
        return {
            "objective_id": self.objective_id,
            "title": self.title,
            "description": self.description,
            "level": self.level.value,
            "owner": self.owner,
            "overall_progress_pct": self.overall_progress_pct,
            "status": self.computed_status.value,
            "key_results": [kr.to_dict() for kr in self.key_results],
            "tags": self.tags,
        }


@dataclass
class OKRCycle:
    """
    Ciclo de OKRs (trimestral, anual ou personalizado).

    Contém todos os Objectives do ciclo e métricas de progresso.
    """
    cycle_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    cycle_type: str = "quarterly"     # quarterly | annual | custom
    start_date: date = field(default_factory=date.today)
    end_date: date = field(default_factory=date.today)
    objectives: List[Objective] = field(default_factory=list)
    is_active: bool = True

    @property
    def days_remaining(self) -> int:
        delta = self.end_date - date.today()
        return max(delta.days, 0)

    @property
    def elapsed_pct(self) -> float:
        total = (self.end_date - self.start_date).days
        elapsed = (date.today() - self.start_date).days
        return round(min(max(elapsed / total * 100, 0), 100), 1) if total > 0 else 0.0

    @property
    def overall_progress_pct(self) -> float:
        if not self.objectives:
            return 0.0
        return round(
            sum(o.overall_progress_pct for o in self.objectives) / len(self.objectives), 1
        )

    def get_summary(self) -> Dict[str, Any]:
        by_status = {s.value: 0 for s in OKRStatus}
        for obj in self.objectives:
            by_status[obj.computed_status.value] += 1

        return {
            "cycle_id": self.cycle_id,
            "name": self.name,
            "cycle_type": self.cycle_type,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "days_remaining": self.days_remaining,
            "elapsed_pct": self.elapsed_pct,
            "overall_progress_pct": self.overall_progress_pct,
            "total_objectives": len(self.objectives),
            "by_status": by_status,
            "is_active": self.is_active,
            "objectives": [o.to_dict() for o in self.objectives],
        }
