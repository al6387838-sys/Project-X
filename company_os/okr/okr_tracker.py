"""
OKR Tracker
===========
Sistema de acompanhamento de OKRs da LifeOS.

Gerencia ciclos, objectives e key results com:
    - Criação e atualização de OKRs
    - Cálculo automático de progresso
    - Detecção de OKRs em risco
    - Relatórios de progresso por ciclo
    - Histórico de atualizações
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta

from ..models.okr import (
    OKRCycle, Objective, KeyResult,
    OKRStatus, OKRLevel
)


class OKRTracker:
    """
    Tracker central de OKRs da LifeOS.

    Gerencia múltiplos ciclos simultâneos e fornece
    visibilidade completa sobre o progresso dos objetivos.
    """

    def __init__(self):
        self._cycles: Dict[str, OKRCycle] = {}
        self._objectives: Dict[str, Objective] = {}
        self._key_results: Dict[str, KeyResult] = {}
        self._update_log: List[Dict[str, Any]] = []

    # ─────────────────────────────────────────────
    # Gestão de Ciclos
    # ─────────────────────────────────────────────

    def create_cycle(
        self,
        name: str,
        start_date: date,
        end_date: date,
        cycle_type: str = "quarterly",
    ) -> OKRCycle:
        """Cria um novo ciclo de OKRs."""
        cycle = OKRCycle(
            name=name,
            cycle_type=cycle_type,
            start_date=start_date,
            end_date=end_date,
        )
        self._cycles[cycle.cycle_id] = cycle
        return cycle

    def get_active_cycle(self) -> Optional[OKRCycle]:
        """Retorna o ciclo ativo mais recente."""
        active = [c for c in self._cycles.values() if c.is_active]
        if not active:
            return None
        return sorted(active, key=lambda c: c.start_date, reverse=True)[0]

    def close_cycle(self, cycle_id: str) -> bool:
        """Encerra um ciclo."""
        cycle = self._cycles.get(cycle_id)
        if cycle:
            cycle.is_active = False
            return True
        return False

    # ─────────────────────────────────────────────
    # Gestão de Objectives
    # ─────────────────────────────────────────────

    def add_objective(
        self,
        cycle_id: str,
        title: str,
        description: str = "",
        owner: str = "",
        level: OKRLevel = OKRLevel.COMPANY,
        tags: Optional[List[str]] = None,
    ) -> Optional[Objective]:
        """Adiciona um Objective a um ciclo."""
        cycle = self._cycles.get(cycle_id)
        if not cycle:
            return None

        obj = Objective(
            title=title,
            description=description,
            owner=owner,
            level=level,
            tags=tags or [],
        )
        cycle.objectives.append(obj)
        self._objectives[obj.objective_id] = obj
        return obj

    # ─────────────────────────────────────────────
    # Gestão de Key Results
    # ─────────────────────────────────────────────

    def add_key_result(
        self,
        objective_id: str,
        title: str,
        metric_name: str,
        start_value: float,
        target_value: float,
        unit: str = "",
        owner: str = "",
        weight: float = 1.0,
    ) -> Optional[KeyResult]:
        """Adiciona um Key Result a um Objective."""
        obj = self._objectives.get(objective_id)
        if not obj:
            return None

        kr = KeyResult(
            title=title,
            metric_name=metric_name,
            start_value=start_value,
            target_value=target_value,
            current_value=start_value,
            unit=unit,
            owner=owner,
            weight=weight,
        )
        obj.add_key_result(kr)
        self._key_results[kr.kr_id] = kr
        return kr

    def update_key_result(
        self,
        kr_id: str,
        new_value: float,
        notes: str = "",
    ) -> Optional[KeyResult]:
        """Atualiza o valor atual de um Key Result."""
        kr = self._key_results.get(kr_id)
        if not kr:
            return None

        old_value = kr.current_value
        kr.update(new_value, notes)

        self._update_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "kr_id": kr_id,
            "kr_title": kr.title,
            "old_value": old_value,
            "new_value": new_value,
            "progress_pct": kr.progress_pct,
            "status": kr.status.value,
            "notes": notes,
        })

        return kr

    # ─────────────────────────────────────────────
    # Análise e Relatórios
    # ─────────────────────────────────────────────

    def get_at_risk_objectives(self, cycle_id: Optional[str] = None) -> List[Objective]:
        """
        Retorna Objectives em risco (AT_RISK ou BEHIND).

        Considera o tempo decorrido do ciclo para avaliar risco.
        """
        if cycle_id:
            cycle = self._cycles.get(cycle_id)
            objectives = cycle.objectives if cycle else []
        else:
            active = self.get_active_cycle()
            objectives = active.objectives if active else []

        at_risk = []
        for obj in objectives:
            status = obj.computed_status
            if status in (OKRStatus.AT_RISK, OKRStatus.BEHIND):
                at_risk.append(obj)

        return at_risk

    def get_cycle_report(self, cycle_id: Optional[str] = None) -> Dict[str, Any]:
        """Gera relatório completo de um ciclo."""
        if cycle_id:
            cycle = self._cycles.get(cycle_id)
        else:
            cycle = self.get_active_cycle()

        if not cycle:
            return {"error": "Ciclo não encontrado."}

        summary = cycle.get_summary()
        at_risk = self.get_at_risk_objectives(cycle.cycle_id)

        return {
            **summary,
            "at_risk_objectives": [o.to_dict() for o in at_risk],
            "recent_updates": self._update_log[-10:],
        }

    def get_all_cycles_summary(self) -> List[Dict[str, Any]]:
        """Retorna resumo de todos os ciclos."""
        return [
            {
                "cycle_id": c.cycle_id,
                "name": c.name,
                "cycle_type": c.cycle_type,
                "is_active": c.is_active,
                "overall_progress_pct": c.overall_progress_pct,
                "days_remaining": c.days_remaining,
                "total_objectives": len(c.objectives),
            }
            for c in sorted(self._cycles.values(), key=lambda c: c.start_date, reverse=True)
        ]

    def create_lifeos_q1_okrs(self) -> OKRCycle:
        """
        Cria os OKRs padrão da LifeOS para Q1.

        Exemplo de ciclo completo com Objectives e Key Results
        alinhados à estratégia de crescimento da empresa.
        """
        today = date.today()
        quarter_start = date(today.year, ((today.month - 1) // 3) * 3 + 1, 1)
        quarter_end = date(
            today.year if quarter_start.month <= 9 else today.year + 1,
            (quarter_start.month + 2) % 12 + 1 if quarter_start.month <= 10 else 1,
            1,
        ) - timedelta(days=1)

        cycle = self.create_cycle(
            name=f"Q{(today.month - 1) // 3 + 1} {today.year}",
            start_date=quarter_start,
            end_date=quarter_end,
            cycle_type="quarterly",
        )

        # ── O1: Crescimento de Receita ────────────────────────────────────
        o1 = self.add_objective(
            cycle.cycle_id,
            title="Atingir crescimento de receita sustentável",
            description="Dobrar o MRR no trimestre com unit economics saudáveis.",
            owner="CEO",
            tags=["revenue", "growth"],
        )
        if o1:
            self.add_key_result(o1.objective_id, "MRR de R$ 100k", "mrr",
                                0, 100_000, "R$", "CEO", 1.5)
            self.add_key_result(o1.objective_id, "LTV/CAC ≥ 3.0x", "ltv_cac_ratio",
                                1.0, 3.0, "x", "CFO")
            self.add_key_result(o1.objective_id, "Churn < 3%", "monthly_churn_pct",
                                8.0, 3.0, "%", "Head of CS")

        # ── O2: Crescimento de Usuários ───────────────────────────────────
        o2 = self.add_objective(
            cycle.cycle_id,
            title="Escalar a base de usuários ativos",
            description="Atingir 10.000 usuários ativos com alta retenção.",
            owner="Head of Growth",
            tags=["users", "retention"],
        )
        if o2:
            self.add_key_result(o2.objective_id, "10.000 usuários ativos (MAU)", "mau",
                                1_000, 10_000, "usuários", "Head of Growth", 1.5)
            self.add_key_result(o2.objective_id, "Retenção D30 ≥ 30%", "d30_retention_pct",
                                15.0, 30.0, "%", "Head of Product")
            self.add_key_result(o2.objective_id, "K-Factor ≥ 0.3", "k_factor",
                                0.0, 0.3, "", "Head of Growth")

        # ── O3: Excelência de Produto ─────────────────────────────────────
        o3 = self.add_objective(
            cycle.cycle_id,
            title="Entregar produto de classe mundial",
            description="NPS > 50 e disponibilidade > 99.9%.",
            owner="CTO",
            tags=["product", "platform"],
        )
        if o3:
            self.add_key_result(o3.objective_id, "NPS ≥ 50", "nps",
                                20.0, 50.0, "", "Head of Product")
            self.add_key_result(o3.objective_id, "Uptime ≥ 99.9%", "uptime_pct",
                                99.0, 99.9, "%", "CTO")
            self.add_key_result(o3.objective_id, "Latência P95 < 500ms", "p95_latency_ms",
                                1500.0, 500.0, "ms", "CTO")

        return cycle
