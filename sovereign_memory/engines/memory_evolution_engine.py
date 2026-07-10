"""
Memory Evolution Engine — Motor de Evolução da Memória Soberana
================================================================
O coração do sistema de Memória Soberana Evolutiva.

Responsabilidades:
- Orquestrar todos os tipos de memória
- Gerenciar o ciclo de vida completo das memórias
- Coordenar consolidação, aging e priorização
- Garantir soberania e consentimento do usuário
- Integrar com o Companion para respostas contextuais

Arquitetura cognitiva:
  Working Memory ──► Short-Term ──► Long-Term
       │                │               │
       └────────────────┴───────────────┘
                        │
                  Context Memory
                  Semantic Memory
                  Episodic Memory
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from ..models.memory_node import MemoryNode, MemoryType, MemoryPriority, MemoryStatus
from ..models.memory_event import MemoryEvent, EventCategory
from ..models.memory_relation import MemoryRelation, RelationType
from ..stores.memory_store import MemoryStore


class MemoryEvolutionEngine:
    """
    Motor central de evolução da memória do Companion.

    Gerencia o fluxo completo:
    1. Captura de informações → Working Memory
    2. Consolidação → Short-Term Memory
    3. Promoção → Long-Term Memory
    4. Aging e decay automático
    5. Priorização dinâmica
    6. Soberania total do usuário
    """

    # Thresholds de consolidação
    CONSOLIDATION_MIN_ACCESSES = 3
    CONSOLIDATION_MIN_AGE_HOURS = 1
    CONSOLIDATION_MIN_STRENGTH = 0.6

    # Thresholds de aging
    AGING_INTERVAL_HOURS = 24
    WEAK_THRESHOLD = 0.15
    ARCHIVE_THRESHOLD = 0.10

    # Limites de memória de trabalho
    WORKING_MEMORY_LIMIT = 20

    def __init__(self, store: Optional[MemoryStore] = None, data_dir: str = None):
        self.store = store or MemoryStore(data_dir=data_dir)
        self._session_id = str(uuid.uuid4())
        self._working_memory: List[MemoryNode] = []
        self._last_aging_run: float = time.time()

    # ------------------------------------------------------------------ #
    #  CAPTURA DE MEMÓRIAS                                                 #
    # ------------------------------------------------------------------ #

    def capture(
        self,
        title: str,
        content: str,
        memory_type: MemoryType = MemoryType.WORKING,
        priority: MemoryPriority = MemoryPriority.MEDIUM,
        domain: str = "general",
        tags: Optional[List[str]] = None,
        entities: Optional[List[str]] = None,
        auto_consent: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MemoryNode:
        """
        Captura uma nova memória.

        Por padrão, cria com status PENDING aguardando consentimento.
        Se auto_consent=True (apenas para memórias de sistema), persiste imediatamente.
        """
        node = MemoryNode(
            title=title,
            content=content,
            summary=content[:200] if len(content) > 200 else content,
            memory_type=memory_type,
            priority=priority,
            status=MemoryStatus.PENDING if not auto_consent else MemoryStatus.ACTIVE,
            domain=domain,
            tags=tags or [],
            entities=entities or [],
            metadata=metadata or {},
            user_consented=auto_consent,
            consent_timestamp=time.time() if auto_consent else None,
        )

        # Memórias de trabalho ficam em cache local
        if memory_type == MemoryType.WORKING:
            self._working_memory.append(node)
            if len(self._working_memory) > self.WORKING_MEMORY_LIMIT:
                self._working_memory.pop(0)
            if auto_consent:
                node.user_consented = True
                self.store.save(node, actor="system")
            return node

        if auto_consent:
            self.store.save(node, actor="system")

        return node

    def consent(self, node: MemoryNode, actor: str = "user") -> MemoryNode:
        """
        Registra consentimento do usuário para uma memória.
        Sem consentimento, a memória não é persistida.
        """
        node.user_consented = True
        node.consent_timestamp = time.time()
        node.status = MemoryStatus.ACTIVE
        saved = self.store.save(node, actor=actor)
        self.store._log_event(
            node.id, EventCategory.CONSENT_GIVEN,
            actor=actor,
            description=f"Consentimento registrado: {node.title}"
        )
        return saved

    def revoke_consent(self, memory_id: str, actor: str = "user") -> bool:
        """
        Revoga consentimento — move para arquivo ou exclui.
        """
        node = self.store.get(memory_id)
        if not node:
            return False
        self.store._log_event(
            memory_id, EventCategory.CONSENT_REVOKED,
            actor=actor,
            description=f"Consentimento revogado: {node.title}"
        )
        return self.store.delete(memory_id, actor=actor, permanent=False)

    # ------------------------------------------------------------------ #
    #  TIPOS ESPECIALIZADOS DE MEMÓRIA                                     #
    # ------------------------------------------------------------------ #

    def remember_preference(
        self,
        preference: str,
        value: Any,
        domain: str = "preferences",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra uma preferência do usuário."""
        return self.capture(
            title=f"Preferência: {preference}",
            content=f"O usuário prefere: {preference} = {value}",
            memory_type=MemoryType.LONG_TERM,
            priority=MemoryPriority.HIGH,
            domain=domain,
            tags=["preferência", "aprendizado"],
            auto_consent=auto_consent,
            metadata={"preference_key": preference, "preference_value": str(value)},
        )

    def remember_goal(
        self,
        goal: str,
        deadline: Optional[str] = None,
        domain: str = "objetivos",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra um objetivo do usuário."""
        content = f"Objetivo: {goal}"
        if deadline:
            content += f" | Prazo: {deadline}"
        return self.capture(
            title=f"Objetivo: {goal[:60]}",
            content=content,
            memory_type=MemoryType.LONG_TERM,
            priority=MemoryPriority.HIGH,
            domain=domain,
            tags=["objetivo", "meta", "missão"],
            auto_consent=auto_consent,
            metadata={"goal": goal, "deadline": deadline},
        )

    def remember_habit(
        self,
        habit: str,
        frequency: str,
        domain: str = "hábitos",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra um hábito do usuário."""
        return self.capture(
            title=f"Hábito: {habit[:60]}",
            content=f"Hábito recorrente: {habit} | Frequência: {frequency}",
            memory_type=MemoryType.LONG_TERM,
            priority=MemoryPriority.HIGH,
            domain=domain,
            tags=["hábito", "rotina", "recorrente"],
            auto_consent=auto_consent,
            metadata={"habit": habit, "frequency": frequency},
        )

    def remember_project(
        self,
        project_name: str,
        description: str,
        status: str = "ativo",
        domain: str = "projetos",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra um projeto do usuário."""
        return self.capture(
            title=f"Projeto: {project_name}",
            content=f"Projeto '{project_name}': {description} | Status: {status}",
            memory_type=MemoryType.LONG_TERM,
            priority=MemoryPriority.HIGH,
            domain=domain,
            tags=["projeto", "trabalho", status],
            entities=[project_name],
            auto_consent=auto_consent,
            metadata={"project_name": project_name, "status": status},
        )

    def remember_person(
        self,
        name: str,
        relationship: str,
        notes: str = "",
        domain: str = "pessoas",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra uma pessoa importante para o usuário."""
        content = f"Pessoa importante: {name} | Relação: {relationship}"
        if notes:
            content += f" | Notas: {notes}"
        return self.capture(
            title=f"Pessoa: {name}",
            content=content,
            memory_type=MemoryType.LONG_TERM,
            priority=MemoryPriority.HIGH,
            domain=domain,
            tags=["pessoa", "relacionamento", relationship],
            entities=[name],
            auto_consent=auto_consent,
            metadata={"person_name": name, "relationship": relationship},
        )

    def remember_event(
        self,
        event_name: str,
        date: str,
        recurrent: bool = False,
        domain: str = "eventos",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra um evento (recorrente ou único)."""
        tags = ["evento"]
        if recurrent:
            tags.append("recorrente")
        return self.capture(
            title=f"Evento: {event_name}",
            content=f"Evento: {event_name} | Data: {date} | Recorrente: {recurrent}",
            memory_type=MemoryType.EPISODIC,
            priority=MemoryPriority.HIGH if recurrent else MemoryPriority.MEDIUM,
            domain=domain,
            tags=tags,
            auto_consent=auto_consent,
            metadata={"event_name": event_name, "date": date, "recurrent": recurrent},
        )

    def remember_episodic(
        self,
        title: str,
        description: str,
        participants: Optional[List[str]] = None,
        domain: str = "episódios",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra uma memória episódica (experiência específica)."""
        return self.capture(
            title=title,
            content=description,
            memory_type=MemoryType.EPISODIC,
            priority=MemoryPriority.MEDIUM,
            domain=domain,
            tags=["episódio", "experiência"],
            entities=participants or [],
            auto_consent=auto_consent,
            metadata={"participants": participants or []},
        )

    def remember_semantic(
        self,
        concept: str,
        definition: str,
        domain: str = "conhecimento",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra conhecimento semântico (fatos, conceitos)."""
        return self.capture(
            title=f"Conceito: {concept}",
            content=f"{concept}: {definition}",
            memory_type=MemoryType.SEMANTIC,
            priority=MemoryPriority.MEDIUM,
            domain=domain,
            tags=["conhecimento", "conceito", "semântico"],
            auto_consent=auto_consent,
            metadata={"concept": concept},
        )

    def remember_context(
        self,
        context_key: str,
        context_value: str,
        ttl_hours: float = 24.0,
        domain: str = "contexto",
        auto_consent: bool = True,
    ) -> MemoryNode:
        """Registra contexto situacional com TTL."""
        expires_at = time.time() + (ttl_hours * 3600)
        node = self.capture(
            title=f"Contexto: {context_key}",
            content=f"{context_key}: {context_value}",
            memory_type=MemoryType.CONTEXT,
            priority=MemoryPriority.LOW,
            domain=domain,
            tags=["contexto", "situacional"],
            auto_consent=auto_consent,
            metadata={"context_key": context_key, "ttl_hours": ttl_hours},
        )
        node.expires_at = expires_at
        if auto_consent and node.user_consented:
            self.store.save(node, actor="system")
        return node

    # ------------------------------------------------------------------ #
    #  PROTEÇÃO E SOBERANIA                                                #
    # ------------------------------------------------------------------ #

    def protect(self, memory_id: str, actor: str = "user") -> bool:
        """Protege uma memória contra exclusão automática."""
        node = self.store.get(memory_id)
        if not node:
            return False
        node.user_protected = True
        node.status = MemoryStatus.PROTECTED
        node.priority = MemoryPriority.CRITICAL
        node.decay_rate = 0.0
        self.store.save(node, actor=actor)
        self.store._log_event(
            memory_id, EventCategory.PROTECTED,
            actor=actor,
            description=f"Protegida pelo usuário: {node.title}"
        )
        return True

    def unprotect(self, memory_id: str, actor: str = "user") -> bool:
        """Remove proteção de uma memória."""
        node = self.store.get(memory_id)
        if not node:
            return False
        node.user_protected = False
        node.status = MemoryStatus.ACTIVE
        node.priority = MemoryPriority.HIGH
        node.decay_rate = 0.002
        self.store.save(node, actor=actor)
        self.store._log_event(
            memory_id, EventCategory.UNPROTECTED,
            actor=actor,
            description=f"Proteção removida: {node.title}"
        )
        return True

    def delete_memory(
        self,
        memory_id: str,
        permanent: bool = False,
        actor: str = "user",
    ) -> bool:
        """
        Exclui uma memória com controle do usuário.
        permanent=True para exclusão definitiva e irreversível.
        """
        return self.store.delete(memory_id, actor=actor, permanent=permanent)

    def forget_all(self, domain: Optional[str] = None, actor: str = "user") -> int:
        """
        Apaga todas as memórias de um domínio (ou todas).
        Retorna o número de memórias apagadas.
        """
        nodes = self.store.filter(domain=domain) if domain else self.store.all()
        count = 0
        for node in nodes:
            if not node.user_protected:
                self.store.delete(node.id, actor=actor, permanent=True)
                count += 1
        return count

    # ------------------------------------------------------------------ #
    #  RECUPERAÇÃO CONTEXTUAL                                              #
    # ------------------------------------------------------------------ #

    def recall(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        limit: int = 10,
    ) -> List[Tuple[MemoryNode, str]]:
        """
        Recupera memórias relevantes para uma query com justificativa.
        Retorna lista de (MemoryNode, razão_da_seleção).
        """
        results = self.store.search(query, limit=limit * 2)
        recalled = []

        for node in results[:limit]:
            reason = self._explain_recall(node, query, context)
            recalled.append((node, reason))

        # Adiciona memórias de contexto ativo
        context_nodes = self.store.filter(memory_type=MemoryType.WORKING)
        for node in context_nodes[:3]:
            if node not in [r[0] for r in recalled]:
                recalled.append((node, "Contexto ativo da sessão atual"))

        return recalled[:limit]

    def recall_for_domain(self, domain: str, limit: int = 10) -> List[MemoryNode]:
        """Recupera memórias de um domínio específico."""
        nodes = self.store.get_by_domain(domain)
        nodes.sort(key=lambda n: n.strength * n.relevance, reverse=True)
        for node in nodes[:limit]:
            node.touch()
        return nodes[:limit]

    def recall_about_person(self, name: str) -> List[MemoryNode]:
        """Recupera todas as memórias sobre uma pessoa."""
        nodes = self.store.get_by_entity(name)
        for node in nodes:
            node.touch()
        return nodes

    def get_working_memory(self) -> List[MemoryNode]:
        """Retorna o conteúdo atual da memória de trabalho."""
        return list(self._working_memory)

    def _explain_recall(
        self,
        node: MemoryNode,
        query: str,
        context: Optional[Dict] = None,
    ) -> str:
        """Gera explicação de por que uma memória foi recuperada."""
        reasons = []

        if query.lower() in node.title.lower():
            reasons.append(f"título contém '{query}'")
        if query.lower() in node.content.lower():
            reasons.append("conteúdo é relevante para a consulta")
        if any(query.lower() in t.lower() for t in node.tags):
            reasons.append("tags correspondem à consulta")
        if any(query.lower() in e.lower() for e in node.entities):
            reasons.append(f"envolve entidade relacionada")

        if node.priority == MemoryPriority.CRITICAL:
            reasons.append("memória crítica sempre disponível")
        elif node.priority == MemoryPriority.HIGH:
            reasons.append("alta prioridade")

        if node.memory_type == MemoryType.LONG_TERM:
            reasons.append("memória consolidada de longo prazo")
        elif node.memory_type == MemoryType.EPISODIC:
            reasons.append("experiência episódica relevante")

        if node.access_count > 5:
            reasons.append(f"acessada {node.access_count}x — frequentemente utilizada")
        if node.reinforcement_count > 2:
            reasons.append("reforçada múltiplas vezes")

        return "; ".join(reasons) if reasons else "relevância semântica detectada"

    # ------------------------------------------------------------------ #
    #  AGING E MANUTENÇÃO                                                  #
    # ------------------------------------------------------------------ #

    def run_aging(self, force: bool = False) -> Dict[str, int]:
        """
        Executa o ciclo de envelhecimento das memórias.
        Retorna estatísticas do processo.
        """
        now = time.time()
        hours_since_last = (now - self._last_aging_run) / 3600

        if not force and hours_since_last < self.AGING_INTERVAL_HOURS:
            return {"skipped": True, "hours_since_last": hours_since_last}

        stats = {
            "processed": 0,
            "weakened": 0,
            "archived": 0,
            "expired": 0,
        }

        days_elapsed = hours_since_last / 24
        nodes = self.store.all()

        for node in nodes:
            stats["processed"] += 1

            # Expirar memórias com TTL
            if node.is_expired():
                self.store.delete(node.id, actor="system", permanent=True)
                stats["expired"] += 1
                continue

            # Aplicar decay
            old_strength = node.strength
            node.decay(days_elapsed)

            if node.strength < old_strength:
                stats["weakened"] += 1

            # Arquivar memórias muito fracas
            if node.is_weak(self.ARCHIVE_THRESHOLD) and not node.user_protected:
                self.store.delete(node.id, actor="system", permanent=False)
                stats["archived"] += 1
                continue

            self.store._nodes[node.id] = node

        self.store._save_nodes()
        self._last_aging_run = now
        return stats

    # ------------------------------------------------------------------ #
    #  ESTATÍSTICAS E DIAGNÓSTICO                                          #
    # ------------------------------------------------------------------ #

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas completas do sistema de memória."""
        store_stats = self.store.stats()
        store_stats["working_memory_size"] = len(self._working_memory)
        store_stats["session_id"] = self._session_id
        return store_stats

    def get_memory_summary(self) -> str:
        """Gera um resumo textual do estado da memória para o Companion."""
        stats = self.get_stats()
        lines = [
            f"Memórias ativas: {stats['total_active']}",
            f"Memórias arquivadas: {stats['total_archived']}",
            f"Relações detectadas: {stats['total_relations']}",
            f"Força média: {stats['avg_strength']:.1%}",
            f"Confiança média: {stats['avg_confidence']:.1%}",
        ]
        if stats.get("by_domain"):
            top_domains = sorted(
                stats["by_domain"].items(), key=lambda x: x[1], reverse=True
            )[:3]
            lines.append(
                "Domínios principais: " + ", ".join(f"{d}({c})" for d, c in top_domains)
            )
        return " | ".join(lines)
