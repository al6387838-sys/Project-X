"""
Decision Engine V1 — Demo de Exemplos Reais
============================================
Sprint 021 | PROJECT-X Phase 3

Demonstra decisões reais geradas pelo sistema em todas as categorias.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from decision_engine.engines.core_decision_engine import DecisionEngineCore
from decision_engine.engines.decision_history import DecisionHistory
from decision_engine.models.decision import DecisionCategory

def print_decision(decision, label=""):
    print(f"\n{'='*70}")
    print(f"  {label}")
    print(f"{'='*70}")
    print(f"  Decision ID   : {decision.decision_id}")
    print(f"  Categoria     : {decision.category}")
    print(f"  Objetivo      : {decision.related_goal}")
    print(f"  Decision Score: {decision.decision_score:.1f}/100")
    print(f"  Confiança IA  : {decision.confidence_score * 100:.1f}%")
    print(f"\n  RECOMENDAÇÃO  : {decision.recommendation}")
    print(f"\n  JUSTIFICATIVA :")
    print(f"  {decision.justification}")
    print(f"\n  RACIOCÍNIO    :")
    for step in decision.reasoning:
        print(f"    {step}")
    print(f"\n  BENEFÍCIOS    :")
    for b in decision.possible_benefits:
        print(f"    + {b}")
    print(f"\n  RISCOS        :")
    for r in decision.possible_risks:
        print(f"    - {r}")
    print(f"\n  ALTERNATIVAS AVALIADAS:")
    for alt in decision.alternatives:
        print(f"    [{alt.estimated_impact:.1f}/100] {alt.description}")
    print(f"\n  PESOS DOS FATORES: {decision.factor_weights}")
    print(f"  STATUS        : {decision.status}")


def main():
    engine = DecisionEngineCore(
        history_manager=DecisionHistory(storage_path="/tmp/demo_history.json")
    )

    print("\n" + "█"*70)
    print("  DECISION ENGINE V1 — LIFEOS")
    print("  PROJECT-X | PHASE 3 | SPRINT 021")
    print("█"*70)

    # -----------------------------------------------------------------------
    # EXEMPLO 1: Saúde — Dormiu mal + Reunião importante
    # -----------------------------------------------------------------------
    d1 = engine.analyze(
        context={
            "sleep_quality": "bad",
            "upcoming_event": "important_meeting",
            "energy_level": "low",
        },
        goal="Manter performance cognitiva alta",
        category=DecisionCategory.SAUDE.value,
    )
    print_decision(d1, "EXEMPLO 1 — SAÚDE: Dormiu mal + Reunião importante")

    # -----------------------------------------------------------------------
    # EXEMPLO 2: Finanças — Compra por impulso com orçamento apertado
    # -----------------------------------------------------------------------
    d2 = engine.analyze(
        context={
            "expense_type": "impulse",
            "budget_status": "tight",
            "financial_risk": "high",
        },
        goal="Controlar finanças pessoais e atingir meta de poupança",
        category=DecisionCategory.FINANCAS.value,
    )
    print_decision(d2, "EXEMPLO 2 — FINANÇAS: Compra por impulso com orçamento apertado")

    # -----------------------------------------------------------------------
    # EXEMPLO 3: Produtividade — Foco baixo + Tarefa de deep work
    # -----------------------------------------------------------------------
    d3 = engine.analyze(
        context={
            "focus_level": "low",
            "task_type": "deep_work",
        },
        goal="Completar módulo crítico do projeto",
        category=DecisionCategory.PRODUTIVIDADE.value,
    )
    print_decision(d3, "EXEMPLO 3 — PRODUTIVIDADE: Foco baixo + Tarefa de deep work")

    # -----------------------------------------------------------------------
    # EXEMPLO 4: Carreira — Oferta de emprego com insatisfação atual
    # -----------------------------------------------------------------------
    d4 = engine.analyze(
        context={
            "opportunity": "job_offer",
            "current_satisfaction": "low",
        },
        goal="Crescimento profissional e equilíbrio de vida",
        category=DecisionCategory.CARREIRA.value,
    )
    print_decision(d4, "EXEMPLO 4 — CARREIRA: Oferta de emprego com insatisfação atual")

    # -----------------------------------------------------------------------
    # EXEMPLO 5: Projetos — Projeto atrasado com recursos limitados
    # -----------------------------------------------------------------------
    d5 = engine.analyze(
        context={
            "project_status": "delayed",
            "resources": "limited",
        },
        goal="Entregar projeto dentro do prazo e orçamento",
        category=DecisionCategory.PROJETOS.value,
    )
    print_decision(d5, "EXEMPLO 5 — PROJETOS: Projeto atrasado com recursos limitados")

    # -----------------------------------------------------------------------
    # EXEMPLO 6: Relacionamentos — Conflito ativo no trabalho
    # -----------------------------------------------------------------------
    d6 = engine.analyze(
        context={
            "conflict": "active",
            "relationship_type": "professional",
        },
        goal="Manter ambiente de trabalho saudável e produtivo",
        category=DecisionCategory.RELACIONAMENTOS.value,
    )
    print_decision(d6, "EXEMPLO 6 — RELACIONAMENTOS: Conflito ativo no trabalho")

    # -----------------------------------------------------------------------
    # EXEMPLO 7: Conhecimento — Aprender nova habilidade com tempo limitado
    # -----------------------------------------------------------------------
    d7 = engine.analyze(
        context={
            "learning_goal": "new_skill",
            "available_time": "limited",
        },
        goal="Aprender Python para automação de tarefas",
        category=DecisionCategory.CONHECIMENTO.value,
    )
    print_decision(d7, "EXEMPLO 7 — CONHECIMENTO: Aprender nova habilidade com tempo limitado")

    # -----------------------------------------------------------------------
    # Demonstrar Feedback e Aprendizagem
    # -----------------------------------------------------------------------
    print(f"\n{'='*70}")
    print("  DEMONSTRAÇÃO DE FEEDBACK E APRENDIZAGEM")
    print(f"{'='*70}")
    engine.submit_feedback(d1.decision_id, accepted=True, feedback_text="Ótima sugestão, reagendei e foi muito melhor!")
    engine.submit_feedback(d2.decision_id, accepted=True, feedback_text="Esperou 48h e não comprou. Economizou!")
    engine.submit_feedback(d3.decision_id, accepted=False, feedback_text="Precisei começar o trabalho mesmo assim.")

    insights = engine.get_learning_insights()
    print(f"\n  Total de decisões com feedback: {insights.get('total_decisions', 0)}")
    print(f"  Taxa de aceitação global: {insights.get('acceptance_rate', 0) * 100:.1f}%")

    # -----------------------------------------------------------------------
    # Histórico completo
    # -----------------------------------------------------------------------
    history = engine.get_history()
    print(f"\n{'='*70}")
    print(f"  HISTÓRICO: {len(history)} decisões registradas")
    print(f"{'='*70}")
    for d in history:
        print(f"  [{d.status.upper():8s}] [{d.category:15s}] Score: {d.decision_score:5.1f} | {d.recommendation[:50]}")

    print(f"\n{'█'*70}")
    print("  DECISION ENGINE V1 — DEMO CONCLUÍDO")
    print(f"{'█'*70}\n")


if __name__ == "__main__":
    main()
