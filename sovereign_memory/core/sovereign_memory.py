"""
SovereignMemory — Orquestrador Central da Memória Soberana
===========================================================
Ponto de entrada único para todo o sistema de Memória Soberana.

Integra todos os subsistemas:
- MemoryEvolutionEngine (captura e ciclo de vida)
- MemoryGraph (relações e conhecimento)
- MemoryTimeline (linha do tempo)
- MemoryConsolidation (consolidação automática)

Interface pública para o Companion:
  memory = SovereignMemory()
  memory.learn("preferência", "usuário prefere dark mode")
  memory.recall("preferências visuais")
  memory.remember_person("Ana", "esposa")
  memory.get_context_for_companion()
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from ..models.memory_node import MemoryNode, MemoryType, MemoryPriority, MemoryStatus
from ..models.memory_relation import RelationType
from ..stores.memory_store import MemoryStore
from ..engines.memory_evolution_engine import MemoryEvolutionEngine
from ..engines.memory_graph import MemoryGraph
from ..engines.memory_timeline import MemoryTimeline
from ..engines.memory_consolidation import MemoryConsolidation, ConsolidationResult


class SovereignMemory:
    """
    Memória Soberana Evolutiva do Companion.

    Sistema completo de memória com:
    - 6 tipos de memória (Long-Term, Short-Term, Working, Context, Semantic, Episodic)
    - Memory Graph com detecção automática de relações
    - Memory Timeline cronológica
    - Consolidação automática
    - Aging e decay natural
    - Soberania total do usuário
    - Consentimento explícito para toda aprendizagem
    """

    def __init__(self, data_dir: str = None):
        # Inicializa subsistemas
        self.store = MemoryStore(data_dir=data_dir)
        self.engine = MemoryEvolutionEngine(store=self.store)
        self.graph = MemoryGraph(store=self.store)
        self.timeline = MemoryTimeline(store=self.store)
        self.consolidation = MemoryConsolidation(store=self.store, graph=self.graph)

        # Estado do sistema
        self._initialized_at = time.time()
        self._consolidation_interval = 3600  # 1 hora
        self._last_consolidation = 0.0

    # ------------------------------------------------------------------ #
    #  INTERFACE PRINCIPAL — APRENDIZADO                                   #
    # ------------------------------------------------------------------ #

    def learn_preference(
        self, preference: str, value: Any, domain: str = "preferências"
    ) -> MemoryNode:
        """Aprende uma preferência do usuário."""
        return self.engine.remember_preference(preference, value, domain)

    def learn_goal(
        self, goal: str, deadline: Optional[str] = None
    ) -> MemoryNode:
        """Aprende um objetivo do usuário."""
        return self.engine.remember_goal(goal, deadline)

    def learn_habit(self, habit: str, frequency: str) -> MemoryNode:
        """Aprende um hábito do usuário."""
        return self.engine.remember_habit(habit, frequency)

    def learn_project(
        self, name: str, description: str, status: str = "ativo"
    ) -> MemoryNode:
        """Aprende sobre um projeto do usuário."""
        return self.engine.remember_project(name, description, status)

    def learn_person(
        self, name: str, relationship: str, notes: str = ""
    ) -> MemoryNode:
        """Aprende sobre uma pessoa importante."""
        return self.engine.remember_person(name, relationship, notes)

    def learn_event(
        self, event: str, date: str, recurrent: bool = False
    ) -> MemoryNode:
        """Aprende sobre um evento."""
        return self.engine.remember_event(event, date, recurrent)

    def learn_episode(
        self,
        title: str,
        description: str,
        participants: Optional[List[str]] = None,
    ) -> MemoryNode:
        """Aprende sobre uma experiência episódica."""
        return self.engine.remember_episodic(title, description, participants)

    def learn_fact(self, concept: str, definition: str) -> MemoryNode:
        """Aprende um fato ou conceito semântico."""
        return self.engine.remember_semantic(concept, definition)

    def set_context(
        self, key: str, value: str, ttl_hours: float = 24.0
    ) -> MemoryNode:
        """Define contexto situacional com TTL."""
        return self.engine.remember_context(key, value, ttl_hours)

    # ------------------------------------------------------------------ #
    #  INTERFACE PRINCIPAL — RECUPERAÇÃO                                   #
    # ------------------------------------------------------------------ #

    def recall(
        self,
        query: str,
        limit: int = 10,
    ) -> List[Tuple[MemoryNode, str]]:
        """
        Recupera memórias relevantes com justificativa.
        Retorna lista de (MemoryNode, razão).
        """
        return self.engine.recall(query, limit=limit)

    def recall_about(self, entity: str) -> List[MemoryNode]:
        """Recupera tudo que o Companion sabe sobre uma entidade."""
        return self.engine.recall_about_person(entity)

    def recall_domain(self, domain: str) -> List[MemoryNode]:
        """Recupera memórias de um domínio."""
        return self.engine.recall_for_domain(domain)

    def get_working_memory(self) -> List[MemoryNode]:
        """Retorna a memória de trabalho atual."""
        return self.engine.get_working_memory()

    def get_long_term_memories(self) -> List[MemoryNode]:
        """Retorna todas as memórias de longo prazo."""
        return self.store.filter(memory_type=MemoryType.LONG_TERM)

    def get_protected_memories(self) -> List[MemoryNode]:
        """Retorna todas as memórias protegidas."""
        return self.store.get_protected()

    # ------------------------------------------------------------------ #
    #  INTERFACE COMPANION — CONTEXTO PARA RESPOSTAS                      #
    # ------------------------------------------------------------------ #

    def get_context_for_companion(
        self,
        query: Optional[str] = None,
        max_memories: int = 15,
    ) -> Dict[str, Any]:
        """
        Gera contexto rico para o Companion responder de forma personalizada.

        Retorna um dicionário com:
        - memories: memórias relevantes com justificativas
        - user_profile: perfil resumido do usuário
        - active_context: contexto atual da sessão
        - recent_topics: tópicos recentes
        """
        # Memórias relevantes para a query
        relevant_memories = []
        if query:
            recalled = self.engine.recall(query, limit=max_memories)
            relevant_memories = [
                {
                    "memory": m.to_dict(),
                    "reason": reason,
                    "type": m.memory_type.value,
                }
                for m, reason in recalled
            ]

        # Perfil do usuário
        user_profile = self._build_user_profile()

        # Contexto ativo
        active_context = [
            n.to_dict()
            for n in self.store.filter(memory_type=MemoryType.CONTEXT)
            if not n.is_expired()
        ]

        # Tópicos recentes (últimas 24h)
        recent = self.store.get_recent(limit=5)
        recent_topics = [
            {"title": n.title, "domain": n.domain, "type": n.memory_type.value}
            for n in recent
        ]

        return {
            "memories": relevant_memories,
            "user_profile": user_profile,
            "active_context": active_context,
            "recent_topics": recent_topics,
            "memory_summary": self.engine.get_memory_summary(),
            "timestamp": time.time(),
        }

    def _build_user_profile(self) -> Dict[str, Any]:
        """Constrói perfil resumido do usuário a partir das memórias."""
        preferences = self.store.filter(domain="preferências")
        goals = self.store.filter(domain="objetivos")
        habits = self.store.filter(domain="hábitos")
        projects = self.store.filter(domain="projetos")
        people = self.store.filter(domain="pessoas")
        events = self.store.filter(domain="eventos")

        return {
            "preferences": [
                {
                    "key": n.metadata.get("preference_key", n.title),
                    "value": n.metadata.get("preference_value", ""),
                }
                for n in preferences[:10]
            ],
            "goals": [
                {
                    "goal": n.metadata.get("goal", n.title),
                    "deadline": n.metadata.get("deadline"),
                }
                for n in goals[:10]
            ],
            "habits": [
                {
                    "habit": n.metadata.get("habit", n.title),
                    "frequency": n.metadata.get("frequency", ""),
                }
                for n in habits[:10]
            ],
            "projects": [
                {
                    "name": n.metadata.get("project_name", n.title),
                    "status": n.metadata.get("status", ""),
                }
                for n in projects[:10]
            ],
            "important_people": [
                {
                    "name": n.metadata.get("person_name", n.title),
                    "relationship": n.metadata.get("relationship", ""),
                }
                for n in people[:10]
            ],
            "events": [
                {
                    "event": n.metadata.get("event_name", n.title),
                    "date": n.metadata.get("date", ""),
                    "recurrent": n.metadata.get("recurrent", False),
                }
                for n in events[:10]
            ],
        }

    # ------------------------------------------------------------------ #
    #  SOBERANIA DO USUÁRIO                                                #
    # ------------------------------------------------------------------ #

    def protect_memory(self, memory_id: str) -> bool:
        """Protege uma memória contra exclusão automática."""
        return self.engine.protect(memory_id)

    def unprotect_memory(self, memory_id: str) -> bool:
        """Remove proteção de uma memória."""
        return self.engine.unprotect(memory_id)

    def delete_memory(self, memory_id: str, permanent: bool = False) -> bool:
        """Exclui uma memória (permanente ou arquivo)."""
        return self.engine.delete_memory(memory_id, permanent=permanent)

    def forget_domain(self, domain: str) -> int:
        """Apaga todas as memórias de um domínio."""
        return self.engine.forget_all(domain=domain)

    def forget_everything(self) -> int:
        """
        Apaga TODAS as memórias não protegidas.
        Operação irreversível — requer confirmação do usuário.
        """
        return self.engine.forget_all()

    def export_memories(self) -> Dict[str, Any]:
        """Exporta todas as memórias para portabilidade de dados."""
        return {
            "exported_at": time.time(),
            "version": "1.0",
            "nodes": [n.to_dict() for n in self.store.all(include_archived=True)],
            "relations": [r.to_dict() for r in self.store.all_relations()],
            "events": [e.to_dict() for e in self.store.get_events(limit=1000)],
        }

    # ------------------------------------------------------------------ #
    #  MANUTENÇÃO AUTOMÁTICA                                               #
    # ------------------------------------------------------------------ #

    def run_maintenance(self, force: bool = False) -> Dict[str, Any]:
        """
        Executa manutenção completa do sistema de memória.
        Inclui aging, consolidação e repriorização.
        """
        results = {}

        # Aging
        aging_result = self.engine.run_aging(force=force)
        results["aging"] = aging_result

        # Consolidação
        now = time.time()
        should_consolidate = (
            force or
            (now - self._last_consolidation) > self._consolidation_interval
        )
        if should_consolidate:
            consolidation_result = self.consolidation.run(force=force)
            results["consolidation"] = consolidation_result.to_dict()
            self._last_consolidation = now

            # Repriorização
            reprioritized = self.consolidation.reprioritize()
            results["reprioritized"] = reprioritized

            # Rebuild do grafo
            self.graph._rebuild()

        return results

    # ------------------------------------------------------------------ #
    #  ESTATÍSTICAS E DIAGNÓSTICO                                          #
    # ------------------------------------------------------------------ #

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas completas do sistema."""
        stats = self.engine.get_stats()
        graph_data = self.graph.get_graph_data()
        stats["graph"] = graph_data["stats"]
        return stats

    def get_timeline(self, days: int = 30) -> List[Dict[str, Any]]:
        """Retorna a timeline dos últimos N dias."""
        entries = self.timeline.get_recent_timeline(days=days)
        return [e.to_dict() for e in entries]

    def get_memory_density(self, days: int = 30) -> Dict[str, int]:
        """Retorna densidade de memórias por dia."""
        return self.timeline.get_memory_density(days=days)

    def search(self, query: str, limit: int = 20) -> List[MemoryNode]:
        """Busca textual nas memórias."""
        return self.store.search(query, limit=limit)

    def __repr__(self) -> str:
        stats = self.store.stats()
        return (
            f"SovereignMemory("
            f"active={stats['total_active']}, "
            f"archived={stats['total_archived']}, "
            f"relations={stats['total_relations']})"
        )
