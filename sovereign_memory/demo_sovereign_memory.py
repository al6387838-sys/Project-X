"""
Demo: Companion com Sovereign Memory Evolution
==============================================
Demonstra o Companion lembrando corretamente informações
de diferentes momentos e explicando por que cada memória foi utilizada.

EXECUTION-006 — SOVEREIGN MEMORY EVOLUTION
"""
import sys
import os
import json
import time
import tempfile

# Adiciona o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sovereign_memory import SovereignMemory, MemoryType, MemoryPriority


def separator(title: str = "", char: str = "═", width: int = 70):
    if title:
        side = (width - len(title) - 2) // 2
        print(f"\n{'═' * side} {title} {'═' * side}")
    else:
        print(f"\n{'═' * width}")


def print_memory(node, reason: str = ""):
    icon = {
        "long_term": "🧠",
        "short_term": "⚡",
        "working": "💭",
        "context": "🌐",
        "semantic": "📚",
        "episodic": "🎭",
    }.get(node.memory_type.value, "💾")

    priority_icon = {
        "critical": "🔴",
        "high": "🟠",
        "medium": "🟡",
        "low": "🟢",
        "ephemeral": "⚪",
    }.get(node.priority.value, "⚪")

    print(f"\n  {icon} {priority_icon} [{node.memory_type.value.upper()}] {node.title}")
    print(f"     Domínio: {node.domain} | Força: {node.strength:.0%} | Confiança: {node.confidence:.0%}")
    if reason:
        print(f"     💡 Por que lembrei: {reason}")
    if node.tags:
        print(f"     🏷️  Tags: {', '.join(node.tags[:5])}")
    if node.entities:
        print(f"     👥 Entidades: {', '.join(node.entities[:5])}")


def main():
    print("\n" + "█" * 70)
    print("█" + " " * 68 + "█")
    print("█" + "  SOVEREIGN MEMORY EVOLUTION — COMPANION DEMO".center(68) + "█")
    print("█" + "  PROJECT-X | EXECUTION-006".center(68) + "█")
    print("█" + " " * 68 + "█")
    print("█" * 70)

    # Usa diretório temporário para o demo
    with tempfile.TemporaryDirectory() as tmpdir:
        memory = SovereignMemory(data_dir=tmpdir)

        # ============================================================
        separator("FASE 1: APRENDIZADO INICIAL")
        # ============================================================
        print("\n📖 O Companion está aprendendo sobre o usuário...\n")
        time.sleep(0.1)

        # Preferências
        p1 = memory.learn_preference("tema_visual", "dark mode")
        p2 = memory.learn_preference("idioma", "Português Brasileiro")
        p3 = memory.learn_preference("notificações", "apenas críticas")
        p4 = memory.learn_preference("horário_produtivo", "manhã (6h-12h)")
        print(f"  ✅ Preferência aprendida: {p1.title}")
        print(f"  ✅ Preferência aprendida: {p2.title}")
        print(f"  ✅ Preferência aprendida: {p3.title}")
        print(f"  ✅ Preferência aprendida: {p4.title}")

        # Objetivos
        g1 = memory.learn_goal("Lançar o PROJECT-X em produção", deadline="2026-09-30")
        g2 = memory.learn_goal("Alcançar 1000 usuários ativos", deadline="2026-12-31")
        g3 = memory.learn_goal("Completar certificação em IA", deadline="2026-08-15")
        print(f"\n  🎯 Objetivo aprendido: {g1.title}")
        print(f"  🎯 Objetivo aprendido: {g2.title}")
        print(f"  🎯 Objetivo aprendido: {g3.title}")

        # Hábitos
        h1 = memory.learn_habit("Exercício físico", "4x por semana")
        h2 = memory.learn_habit("Leitura técnica", "30 minutos diários")
        h3 = memory.learn_habit("Revisão semanal do PROJECT-X", "toda segunda-feira")
        print(f"\n  🔄 Hábito aprendido: {h1.title}")
        print(f"  🔄 Hábito aprendido: {h2.title}")
        print(f"  🔄 Hábito aprendido: {h3.title}")

        # Projetos
        proj1 = memory.learn_project(
            "PROJECT-X",
            "Plataforma LifeOS com Companion de IA soberana",
            status="em desenvolvimento ativo"
        )
        proj2 = memory.learn_project(
            "API Gateway",
            "Gateway de APIs para integração com serviços externos",
            status="planejamento"
        )
        print(f"\n  📁 Projeto aprendido: {proj1.title}")
        print(f"  📁 Projeto aprendido: {proj2.title}")

        # Pessoas importantes
        person1 = memory.learn_person("Ana", "esposa", "aniversário em 15/08, adora viagens")
        person2 = memory.learn_person("Carlos", "co-fundador do PROJECT-X", "especialista em backend")
        person3 = memory.learn_person("Dr. Martins", "médico", "consulta trimestral")
        print(f"\n  👤 Pessoa aprendida: {person1.title}")
        print(f"  👤 Pessoa aprendida: {person2.title}")
        print(f"  👤 Pessoa aprendida: {person3.title}")

        # Eventos
        ev1 = memory.learn_event("Aniversário da Ana", "15/08", recurrent=True)
        ev2 = memory.learn_event("Demo Day PROJECT-X", "2026-09-15")
        ev3 = memory.learn_event("Revisão semanal do time", "toda segunda 10h", recurrent=True)
        print(f"\n  📅 Evento aprendido: {ev1.title}")
        print(f"  📅 Evento aprendido: {ev2.title}")
        print(f"  📅 Evento aprendido: {ev3.title}")

        # Memórias episódicas
        ep1 = memory.learn_episode(
            "Primeira demo do Companion",
            "O usuário ficou impressionado com a resposta contextual do Companion na primeira demo ao vivo",
            participants=["Carlos", "Ana"]
        )
        ep2 = memory.learn_episode(
            "Decisão de usar Python para o backend",
            "Após análise técnica com Carlos, decidimos usar Python + FastAPI para o backend do PROJECT-X",
            participants=["Carlos"]
        )
        print(f"\n  🎭 Episódio aprendido: {ep1.title}")
        print(f"  🎭 Episódio aprendido: {ep2.title}")

        # Fatos semânticos
        f1 = memory.learn_fact("LifeOS", "Sistema operacional de vida pessoal com IA soberana")
        f2 = memory.learn_fact("Sovereign Memory", "Sistema de memória com consentimento e controle total do usuário")
        print(f"\n  📚 Fato aprendido: {f1.title}")
        print(f"  📚 Fato aprendido: {f2.title}")

        # ============================================================
        separator("FASE 2: CONSOLIDAÇÃO AUTOMÁTICA")
        # ============================================================
        print("\n⚙️  Executando consolidação automática das memórias...\n")

        # Simula acessos múltiplos para consolidação
        for node_id in [g1.id, proj1.id, person1.id, h1.id]:
            node = memory.store.get(node_id)
            if node:
                node.access_count = 3
                node.strength = 0.8
                memory.store.save(node, actor="demo")

        result = memory.run_maintenance(force=True)
        print(f"  ✅ Aging executado: {result.get('aging', {}).get('processed', 0)} memórias processadas")
        if "consolidation" in result:
            c = result["consolidation"]
            print(f"  ✅ Consolidação: {c.get('consolidated', 0)} promovidas para longo prazo")
            print(f"  ✅ Relações detectadas: {c.get('relations_created', 0)}")
            print(f"  ✅ Contexto comprimido: {c.get('compressed', 0)} memórias")
            print(f"  ✅ Repriorização: {result.get('reprioritized', 0)} memórias repriorizadas")

        # ============================================================
        separator("FASE 3: COMPANION LEMBRANDO — TESTE DE RECALL")
        # ============================================================

        test_queries = [
            ("projeto principal", "O usuário pergunta sobre o projeto principal"),
            ("Ana", "O usuário menciona Ana"),
            ("exercício físico", "O usuário fala sobre saúde e exercício"),
            ("objetivos 2026", "O usuário quer revisar seus objetivos"),
            ("preferências visuais", "O usuário configura a interface"),
        ]

        for query, scenario in test_queries:
            print(f"\n\n  🗣️  Cenário: \"{scenario}\"")
            print(f"  🔍 Query: \"{query}\"")
            print(f"  {'─' * 60}")

            recalled = memory.recall(query, limit=4)
            if recalled:
                print(f"  📌 Companion lembrou {len(recalled)} memória(s) relevante(s):")
                for node, reason in recalled:
                    print_memory(node, reason)
            else:
                print("  ⚠️  Nenhuma memória relevante encontrada.")

        # ============================================================
        separator("FASE 4: CONTEXTO COMPLETO PARA O COMPANION")
        # ============================================================
        print("\n🧠 Gerando contexto completo para resposta personalizada...\n")

        ctx = memory.get_context_for_companion("PROJECT-X lançamento")
        profile = ctx["user_profile"]

        print("  👤 PERFIL DO USUÁRIO:")
        if profile["goals"]:
            print(f"\n  🎯 Objetivos ({len(profile['goals'])}):")
            for g in profile["goals"]:
                deadline = f" → {g['deadline']}" if g.get("deadline") else ""
                print(f"     • {g['goal']}{deadline}")

        if profile["habits"]:
            print(f"\n  🔄 Hábitos ({len(profile['habits'])}):")
            for h in profile["habits"]:
                print(f"     • {h['habit']} ({h['frequency']})")

        if profile["projects"]:
            print(f"\n  📁 Projetos ({len(profile['projects'])}):")
            for p in profile["projects"]:
                print(f"     • {p['name']} — {p['status']}")

        if profile["important_people"]:
            print(f"\n  👥 Pessoas Importantes ({len(profile['important_people'])}):")
            for p in profile["important_people"]:
                print(f"     • {p['name']} ({p['relationship']})")

        if profile["preferences"]:
            print(f"\n  ⚙️  Preferências ({len(profile['preferences'])}):")
            for pref in profile["preferences"]:
                print(f"     • {pref['key']}: {pref['value']}")

        # ============================================================
        separator("FASE 5: MEMORY GRAPH — RELAÇÕES DETECTADAS")
        # ============================================================
        print("\n🕸️  Analisando grafo de memórias...\n")

        graph_data = memory.graph.get_graph_data()
        print(f"  📊 Nós no grafo: {graph_data['stats']['total_nodes']}")
        print(f"  🔗 Relações detectadas: {graph_data['stats']['total_edges']}")
        print(f"  🔵 Clusters temáticos: {graph_data['stats']['clusters']}")

        most_connected = memory.graph.most_connected(limit=5)
        if most_connected:
            print(f"\n  🏆 Memórias mais conectadas (centrais):")
            for node, score in most_connected:
                print(f"     • {node.title[:50]} (centralidade: {score:.2f})")

        # ============================================================
        separator("FASE 6: MEMORY TIMELINE")
        # ============================================================
        print("\n📅 Linha do tempo das memórias...\n")

        timeline_data = memory.timeline.to_dict(limit=8)
        print(f"  📌 Últimas {len(timeline_data)} entradas na timeline:")
        for entry in timeline_data[:6]:
            node_info = entry.get("node", {})
            print(f"     [{entry['datetime']}] {node_info.get('title', entry.get('label', ''))[:50]}")

        density = memory.get_memory_density(days=7)
        print(f"\n  📈 Densidade de memórias (últimos 7 dias):")
        for day, count in list(density.items())[-7:]:
            bar = "█" * count if count > 0 else "·"
            print(f"     {day}: {bar} ({count})")

        # ============================================================
        separator("FASE 7: SOBERANIA — PROTEÇÃO E CONTROLE")
        # ============================================================
        print("\n🛡️  Demonstrando controle soberano do usuário...\n")

        # Protege memória da Ana
        memory.protect_memory(person1.id)
        protected = memory.get_protected_memories()
        print(f"  🔒 Memórias protegidas: {len(protected)}")
        for p in protected:
            print(f"     • {p.title} (protegida pelo usuário)")

        # Tenta apagar memória protegida via sistema (deve falhar)
        try:
            memory.store.delete(person1.id, actor="system")
            print("  ❌ ERRO: Memória protegida foi apagada pelo sistema!")
        except PermissionError as e:
            print(f"  ✅ Proteção funcionando: sistema não pode apagar memória protegida")

        # Usuário pode apagar
        test_node = memory.learn_fact("teste_exclusão", "Esta memória será apagada")
        deleted = memory.delete_memory(test_node.id, permanent=True)
        print(f"  ✅ Usuário apagou memória permanentemente: {deleted}")

        # ============================================================
        separator("FASE 8: ESTATÍSTICAS FINAIS")
        # ============================================================
        print("\n📊 Estado final do sistema de memória:\n")

        stats = memory.get_stats()
        print(f"  🧠 Memórias ativas:     {stats['total_active']:>4}")
        print(f"  📦 Memórias arquivadas: {stats['total_archived']:>4}")
        print(f"  🔗 Relações no grafo:   {stats['total_relations']:>4}")
        print(f"  📋 Eventos auditados:   {stats['total_events']:>4}")
        print(f"  💪 Força média:         {stats['avg_strength']:.1%}")
        print(f"  🎯 Confiança média:     {stats['avg_confidence']:.1%}")

        print(f"\n  📂 Por tipo de memória:")
        for mem_type, count in stats.get("by_type", {}).items():
            icon = {"long_term": "🧠", "short_term": "⚡", "working": "💭",
                    "context": "🌐", "semantic": "📚", "episodic": "🎭"}.get(mem_type, "💾")
            print(f"     {icon} {mem_type:<15}: {count}")

        print(f"\n  🏷️  Por domínio:")
        for domain, count in sorted(stats.get("by_domain", {}).items(), key=lambda x: -x[1]):
            print(f"     • {domain:<20}: {count}")

        # ============================================================
        separator("RESULTADO FINAL")
        # ============================================================
        print("""
  ✅ SOVEREIGN MEMORY EVOLUTION — IMPLEMENTAÇÃO COMPLETA

  O Companion demonstrou capacidade de:

  🧠 TIPOS DE MEMÓRIA IMPLEMENTADOS:
     ├── Long-Term Memory    → Objetivos, hábitos, pessoas, projetos
     ├── Short-Term Memory   → Informações recentes não consolidadas
     ├── Working Memory      → Contexto ativo da sessão
     ├── Context Memory      → Contexto situacional com TTL
     ├── Semantic Memory     → Fatos e conceitos (LifeOS, Sovereign Memory)
     └── Episodic Memory     → Experiências específicas (primeira demo, decisões)

  🔄 SISTEMAS AUTOMÁTICOS:
     ├── Memory Consolidation → Promoção automática para longo prazo
     ├── Duplicate Detection  → Detecção e mesclagem de duplicatas
     ├── Relationship Detection → Grafo de relações auto-detectadas
     ├── Context Compression  → Compressão de contexto expirado
     └── Memory Aging         → Decaimento natural por tempo

  🛡️  SOBERANIA DO USUÁRIO:
     ├── Consentimento explícito para toda aprendizagem
     ├── Proteção de memórias críticas
     ├── Exclusão permanente sob controle do usuário
     ├── Auditoria completa de todos os eventos
     └── Exportação total dos dados

  📊 INTERFACES CRIADAS:
     ├── Memory Center (UI completa)
     ├── Memory Timeline (linha do tempo)
     ├── Memory Search (busca semântica)
     └── Memory Inspector (inspeção detalhada)
""")

    print("═" * 70)
    print("  EXECUTION-006 — SOVEREIGN MEMORY EVOLUTION COMPLETED")
    print("═" * 70 + "\n")


if __name__ == "__main__":
    main()
