"""
Demo: LifeOS Continuous Learning Engine
========================================
Simula 4 semanas de uso do LifeOS e mostra como o sistema
melhora suas recomendações ao longo do tempo.

Execução:
    python3 demo_continuous_learning.py
"""

import sys
sys.path.insert(0, '/home/ubuntu/Project-X')

from learning_engine.engines.learning_engine import LearningEngine
from learning_engine.models.learning_event import EventType, FeedbackType
from learning_engine.models.preference import PreferenceCategory


def separator(title: str = "") -> None:
    width = 60
    if title:
        print(f"\n{'═' * width}")
        print(f"  {title}")
        print(f"{'═' * width}")
    else:
        print(f"{'─' * width}")


def print_score(engine: LearningEngine, week: int) -> None:
    score = engine.get_learning_score()
    print(f"\n  📊 SEMANA {week} — Learning Score: {score.overall:.1f}/100")
    print(f"     Nível: {score.level()}")
    print(f"     Eventos processados: {score.total_events_processed}")
    print(f"     Preferências aprendidas: {score.total_preferences_learned}")
    dims = score.to_dict()["dimensions"]
    for dim, val in dims.items():
        if val > 0:
            bar = "█" * int(val / 10) + "░" * (10 - int(val / 10))
            print(f"     {dim:<15} [{bar}] {val:.0f}")


def print_insights(engine: LearningEngine) -> None:
    insights = engine.get_insights(max_insights=5)
    if not insights:
        print("\n  💡 Ainda sem insights suficientes...")
        return
    print(f"\n  💡 O LIFEOS APRENDEU ISTO SOBRE VOCÊ:")
    for i, insight in enumerate(insights, 1):
        conf_bar = "█" * int(insight["confidence"] * 10)
        print(f"     {i}. {insight['insight']}")
        print(f"        Confiança: {insight['confidence']:.0%} | Evidências: {insight['evidence_count']}")


# ======================================================================
# INÍCIO DA SIMULAÇÃO
# ======================================================================

print("\n")
separator("LIFEOS — CONTINUOUS LEARNING ENGINE DEMO")
print("  Simulação de 4 semanas de uso do LifeOS")
print("  Observando como o sistema aprende e melhora")
separator()

engine = LearningEngine(user_id="demo_user_joao")

# ======================================================================
# SEMANA 1 — Usuário começa a usar o LifeOS
# ======================================================================

separator("SEMANA 1 — Primeiros passos")
print("""
  João começa a usar o LifeOS. O sistema ainda não sabe
  nada sobre ele. As sugestões são genéricas.
""")

# Aceita sugestão de exercício matinal (2 vezes)
engine.record_positive_feedback("morning_exercise", domain="saude",
    context={"time": "07:00", "day": "segunda"})
engine.record_positive_feedback("morning_exercise", domain="saude",
    context={"time": "07:00", "day": "terca"})

# Rejeita reuniões tardias (1 vez)
engine.record_negative_feedback("late_evening_meetings", domain="trabalho",
    reason="Muito cansativo após as 19h")

# Segue rotina matinal (3 vezes)
engine.record_routine_interaction("morning_routine", followed=True)
engine.record_routine_interaction("morning_routine", followed=True)
engine.record_routine_interaction("morning_routine", followed=True)

# Prefere comunicação direta
engine.record_communication_style("response_style", tone="direto")
engine.record_communication_style("response_style", tone="direto")

print_score(engine, 1)
print_insights(engine)

# ======================================================================
# SEMANA 2 — Padrões começam a emergir
# ======================================================================

separator("SEMANA 2 — Padrões emergindo")
print("""
  O LifeOS começa a notar padrões. João sempre aceita
  sugestões de exercício. Rejeita reuniões tardias.
""")

# Exercício matinal — padrão se fortalece
for _ in range(5):
    engine.record_positive_feedback("morning_exercise", domain="saude",
        context={"time": "07:00"})

# Reuniões tardias — padrão de rejeição se fortalece
for _ in range(3):
    engine.record_negative_feedback("late_evening_meetings", domain="trabalho")

# Hábito de meditação começa
engine.record_habit_interaction("morning_meditation", completed=True)
engine.record_habit_interaction("morning_meditation", completed=True)
engine.record_habit_interaction("morning_meditation", completed=True)

# Preferência de horário de trabalho
engine.record_interaction(
    EventType.SCHEDULE_INTERACTION,
    FeedbackType.IMPLICIT,
    pattern_key="deep_work_morning",
    domain="produtividade",
    context={"time_of_day": "manhã", "focus_score": 0.9},
)

# Declara preferência explícita de horário
engine.record_explicit_feedback(
    "morning_productivity",
    domain="produtividade",
    rating=0.95,
    note="Sou muito mais produtivo de manhã!",
    is_positive=True,
)

print_score(engine, 2)
print_insights(engine)

# ======================================================================
# SEMANA 3 — Sistema personaliza recomendações
# ======================================================================

separator("SEMANA 3 — Recomendações personalizadas")
print("""
  O LifeOS agora sabe que João é uma pessoa matinal.
  Começa a sugerir tarefas difíceis pela manhã e
  para de sugerir reuniões após as 18h.
""")

# Exercício diário — hábito consolidado
for _ in range(6):
    engine.record_habit_interaction("morning_exercise", completed=True, domain="saude")

# Meditação — hábito se fortalece
for _ in range(5):
    engine.record_habit_interaction("morning_meditation", completed=True)

# Aceita sugestões de foco matinal
for _ in range(4):
    engine.record_positive_feedback("deep_work_block", domain="produtividade",
        context={"time": "09:00", "duration": "2h"})

# Rejeita sugestões de tarefas complexas à noite
for _ in range(3):
    engine.record_negative_feedback("complex_task_evening", domain="produtividade",
        reason="Muito cansado à noite para tarefas complexas")

# Prefere feedback conciso
engine.record_communication_style("feedback_style", tone="conciso")
engine.record_communication_style("feedback_style", tone="conciso")
engine.record_communication_style("feedback_style", tone="conciso")

# Declara objetivo explícito
engine._preference_engine.express_preference(
    key="main_goal_2025",
    value="Melhorar saúde e produtividade",
    category=PreferenceCategory.OBJETIVO,
    domain="objetivos",
    label="Objetivo principal 2025",
)

print_score(engine, 3)
print_insights(engine)

# ======================================================================
# SEMANA 4 — LifeOS conhece João profundamente
# ======================================================================

separator("SEMANA 4 — LifeOS conhece João")
print("""
  Após 4 semanas, o LifeOS tem um modelo robusto de João.
  As recomendações são altamente personalizadas.
  O sistema sabe exatamente quando, como e o que sugerir.
""")

# Rotina matinal completamente consolidada
for _ in range(7):
    engine.record_routine_interaction("morning_routine", followed=True)
    engine.record_habit_interaction("morning_exercise", completed=True, domain="saude")
    engine.record_habit_interaction("morning_meditation", completed=True)

# Aceita sugestões de planejamento semanal (nova preferência)
for _ in range(4):
    engine.record_positive_feedback("weekly_planning_sunday", domain="produtividade",
        context={"day": "domingo", "time": "20:00"})

# Rejeita interrupções durante o bloco de foco
for _ in range(4):
    engine.record_negative_feedback("notification_during_focus", domain="produtividade",
        reason="Interrompe o fluxo de trabalho")

# Feedback explícito sobre as melhorias
engine.record_explicit_feedback(
    "lifeos_recommendations",
    rating=0.92,
    note="As sugestões estão muito mais alinhadas com minha rotina!",
    is_positive=True,
)

print_score(engine, 4)
print_insights(engine)

# ======================================================================
# RELATÓRIO FINAL
# ======================================================================

separator("RELATÓRIO FINAL DE APRENDIZADO")
print()
print(engine.get_learning_report())

# ======================================================================
# PADRÕES DETECTADOS
# ======================================================================

separator("PADRÕES DETECTADOS")
patterns = engine.get_patterns()
if patterns:
    print(f"\n  Total de padrões detectados: {len(patterns)}\n")
    for p in patterns[:8]:
        strength_emoji = {"muito_forte": "🔥", "forte": "💪", "moderado": "📈", "fraco": "🌱"}.get(p.get("strength", ""), "•")
        print(f"  {strength_emoji} [{p.get('strength','?').upper():12}] {p.get('label', p.get('key', '?'))}")
        print(f"     Confiança: {p.get('confidence', 0):.0%} | Ocorrências: {p.get('occurrences', 0)}")

# ======================================================================
# VERSÕES DO MODELO
# ======================================================================

separator("HISTÓRICO DE VERSÕES DO MODELO")
versions = engine.get_versions()
print(f"\n  Total de versões criadas: {len(versions)}\n")
for v in versions[-4:]:
    print(f"  📌 Versão {v['version_number']:02d} | Score: {v['learning_score_at_version']:.1f} | {v['trigger']}")

# ======================================================================
# DEMONSTRAÇÃO DE ROLLBACK
# ======================================================================

separator("DEMONSTRAÇÃO DE ROLLBACK")
print("""
  Cenário: João ficou doente na semana 3 e não fez exercícios.
  O sistema interpretou isso como abandono do hábito.
  João solicita rollback para a versão antes da semana 3.
""")

rollback_result = engine.rollback_to_version(1, reason="Semana de doença — não representa padrão real")
print(f"  ✅ Rollback executado: {rollback_result.get('success', False)}")
print(f"  📋 Entidades revertidas: {rollback_result.get('entities_reverted', [])}")
print(f"  💬 Motivo registrado: Semana de doença — não representa padrão real")

# ======================================================================
# LOGS DE APRENDIZADO
# ======================================================================

separator("ÚLTIMOS LOGS DE APRENDIZADO")
logs = engine.get_logs(limit=5)
print(f"\n  Últimos {len(logs)} logs:\n")
for log in logs:
    import datetime
    ts = datetime.datetime.fromtimestamp(log["timestamp"]).strftime("%H:%M:%S")
    print(f"  [{ts}] [{log['level'].upper():8}] {log['operation']} → {log.get('message', '')[:60]}")

separator()
print("\n  ✅ DEMO CONCLUÍDA COM SUCESSO")
print("  O LifeOS aprendeu, evoluiu e está pronto para servir João.")
print()
