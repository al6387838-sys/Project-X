"""
Tests — Sovereign Memory Evolution
====================================
Suite de testes para o sistema de Memória Soberana.
EXECUTION-006 | PROJECT-X
"""
import sys
import os
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sovereign_memory import (
    SovereignMemory, MemoryNode, MemoryType, MemoryPriority, MemoryStatus,
    MemoryStore, MemoryEvolutionEngine, MemoryGraph, MemoryTimeline
)
from sovereign_memory.models.memory_relation import RelationType


def test_capture_and_consent():
    """Testa captura de memória com consentimento."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        # Sem consentimento — não deve persistir
        node = mem.engine.capture(
            title="Teste sem consentimento",
            content="Esta memória não deve ser persistida",
            auto_consent=False,
        )
        assert node.user_consented == False
        assert node.status == MemoryStatus.PENDING

        # Com consentimento — deve persistir
        node2 = mem.engine.capture(
            title="Teste com consentimento",
            content="Esta memória deve ser persistida",
            auto_consent=True,
        )
        assert node2.user_consented == True
        assert node2.status == MemoryStatus.ACTIVE
        print("  ✅ test_capture_and_consent PASSED")


def test_all_memory_types():
    """Testa todos os 6 tipos de memória."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        pref = mem.learn_preference("tema", "dark")
        assert pref.memory_type == MemoryType.LONG_TERM

        goal = mem.learn_goal("Objetivo teste")
        assert goal.memory_type == MemoryType.LONG_TERM

        habit = mem.learn_habit("Hábito teste", "diário")
        assert habit.memory_type == MemoryType.LONG_TERM

        project = mem.learn_project("Projeto X", "Descrição X")
        assert project.memory_type == MemoryType.LONG_TERM

        person = mem.learn_person("João", "amigo")
        assert person.memory_type == MemoryType.LONG_TERM

        event = mem.learn_event("Evento teste", "2026-01-01")
        assert event.memory_type == MemoryType.EPISODIC

        episode = mem.learn_episode("Episódio teste", "Descrição do episódio")
        assert episode.memory_type == MemoryType.EPISODIC

        fact = mem.learn_fact("Conceito", "Definição")
        assert fact.memory_type == MemoryType.SEMANTIC

        context = mem.set_context("local", "São Paulo", ttl_hours=1.0)
        assert context.memory_type == MemoryType.CONTEXT
        assert context.expires_at is not None

        print("  ✅ test_all_memory_types PASSED")


def test_sovereignty_protection():
    """Testa proteção soberana de memórias."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        person = mem.learn_person("Ana", "esposa")
        mem.protect_memory(person.id)

        # Sistema não pode apagar memória protegida
        try:
            mem.store.delete(person.id, actor="system")
            assert False, "Deveria ter lançado PermissionError"
        except PermissionError:
            pass  # Esperado

        # Usuário pode apagar
        result = mem.delete_memory(person.id, permanent=True)
        assert result == True
        assert mem.store.get(person.id) is None
        print("  ✅ test_sovereignty_protection PASSED")


def test_recall_with_reasons():
    """Testa recall com justificativas."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        mem.learn_project("PROJECT-X", "Plataforma LifeOS")
        mem.learn_goal("Lançar PROJECT-X em Q3")
        mem.learn_person("Carlos", "co-fundador do PROJECT-X")

        results = mem.recall("PROJECT-X", limit=5)
        assert len(results) > 0

        for node, reason in results:
            assert isinstance(node, MemoryNode)
            assert isinstance(reason, str)
            assert len(reason) > 0

        print("  ✅ test_recall_with_reasons PASSED")


def test_memory_graph():
    """Testa o Memory Graph."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        n1 = mem.learn_person("Ana", "esposa")
        n2 = mem.learn_event("Aniversário da Ana", "15/08", recurrent=True)

        mem.graph.add_relation(
            source_id=n1.id,
            target_id=n2.id,
            relation_type=RelationType.INVOLVES_PERSON,
            weight=0.9,
        )

        relations = mem.store.get_relations(n1.id)
        assert len(relations) >= 1

        graph_data = mem.graph.get_graph_data()
        assert graph_data["stats"]["total_nodes"] >= 2
        assert graph_data["stats"]["total_edges"] >= 1
        print("  ✅ test_memory_graph PASSED")


def test_memory_aging():
    """Testa o aging (envelhecimento) das memórias."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        node = mem.learn_fact("Fato temporário", "Este fato vai envelhecer")
        initial_strength = node.strength

        # Aplica aging forçado
        node.decay(days_elapsed=30)
        assert node.strength < initial_strength
        print("  ✅ test_memory_aging PASSED")


def test_consolidation():
    """Testa a consolidação automática."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        # Cria memória de curto prazo com muitos acessos
        node = mem.engine.capture(
            title="Memória para consolidar",
            content="Esta memória deve ser consolidada para longo prazo",
            memory_type=MemoryType.SHORT_TERM,
            auto_consent=True,
        )
        node.access_count = 5
        node.strength = 0.8
        mem.store.save(node, actor="test")

        result = mem.run_maintenance(force=True)
        assert "consolidation" in result
        print("  ✅ test_consolidation PASSED")


def test_context_for_companion():
    """Testa geração de contexto para o Companion."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        mem.learn_preference("idioma", "pt-BR")
        mem.learn_goal("Lançar produto")
        mem.learn_person("Ana", "esposa")

        ctx = mem.get_context_for_companion("projeto")
        assert "user_profile" in ctx
        assert "memory_summary" in ctx
        assert len(ctx["user_profile"]["preferences"]) > 0
        assert len(ctx["user_profile"]["goals"]) > 0
        assert len(ctx["user_profile"]["important_people"]) > 0
        print("  ✅ test_context_for_companion PASSED")


def test_export_memories():
    """Testa exportação de memórias."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mem = SovereignMemory(data_dir=tmpdir)

        mem.learn_preference("tema", "dark")
        mem.learn_goal("Objetivo exportado")

        export = mem.export_memories()
        assert "nodes" in export
        assert "relations" in export
        assert "events" in export
        assert len(export["nodes"]) >= 2
        print("  ✅ test_export_memories PASSED")


def run_all_tests():
    """Executa todos os testes."""
    print("\n" + "═" * 60)
    print("  SOVEREIGN MEMORY — TEST SUITE")
    print("  EXECUTION-006 | PROJECT-X")
    print("═" * 60 + "\n")

    tests = [
        test_capture_and_consent,
        test_all_memory_types,
        test_sovereignty_protection,
        test_recall_with_reasons,
        test_memory_graph,
        test_memory_aging,
        test_consolidation,
        test_context_for_companion,
        test_export_memories,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ❌ {test.__name__} FAILED: {e}")
            failed += 1

    print(f"\n{'═' * 60}")
    print(f"  Resultado: {passed}/{len(tests)} testes passaram")
    if failed == 0:
        print("  ✅ TODOS OS TESTES PASSARAM")
    else:
        print(f"  ❌ {failed} testes falharam")
    print("═" * 60 + "\n")
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
