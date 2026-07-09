"""
Reasoning Engine
================
Responsável por construir, validar e enriquecer o raciocínio de cada decisão.
Garante que toda decisão seja explicável e auditável.
A IA nunca poderá responder apenas 'Porque sim'.
"""

from typing import List, Dict, Any, Optional
from ..models.decision import Decision


class ReasoningStep:
    """Representa um passo individual no raciocínio de uma decisão."""

    def __init__(self, step_id: int, description: str, evidence: List[str] = None, weight: float = 1.0):
        self.step_id = step_id
        self.description = description
        self.evidence = evidence or []
        self.weight = weight

    def to_text(self) -> str:
        evidence_text = "; ".join(self.evidence) if self.evidence else "sem evidência adicional"
        return f"[Passo {self.step_id}] {self.description} (evidência: {evidence_text}, peso={self.weight:.2f})"


class ReasoningChain:
    """Cadeia de raciocínio completa para uma decisão."""

    def __init__(self, decision_id: str):
        self.decision_id = decision_id
        self.steps: List[ReasoningStep] = []
        self.conclusion: str = ""
        self.is_valid: bool = False

    def add_step(self, description: str, evidence: List[str] = None, weight: float = 1.0):
        step = ReasoningStep(
            step_id=len(self.steps) + 1,
            description=description,
            evidence=evidence or [],
            weight=weight,
        )
        self.steps.append(step)
        return self

    def conclude(self, conclusion: str):
        self.conclusion = conclusion
        self.is_valid = len(self.steps) > 0 and bool(conclusion)
        return self

    def to_text(self) -> str:
        lines = [f"Raciocínio para decisão '{self.decision_id}':"]
        for step in self.steps:
            lines.append(f"  {step.to_text()}")
        lines.append(f"  Conclusão: {self.conclusion}")
        lines.append(f"  Válido: {self.is_valid}")
        return "\n".join(lines)


class ReasoningEngine:
    """
    Motor de raciocínio do PROJECT-X.
    
    Constrói cadeias de raciocínio explícitas para cada decisão,
    valida a consistência lógica e garante explicabilidade total.
    """

    REASONING_TEMPLATES = {
        "goal_pursuit": [
            ("Identificação do objetivo ativo no Life Graph.", ["life_graph_data"], 1.0),
            ("Avaliação do progresso atual em relação à meta.", ["progress_data"], 0.9),
            ("Análise de recursos disponíveis para avançar.", ["resource_data"], 0.8),
            ("Determinação da próxima ação ótima.", ["context_signals"], 1.0),
        ],
        "event_response": [
            ("Detecção de evento relevante no Context Engine.", ["event_data"], 1.0),
            ("Classificação do evento por categoria e relevância.", ["event_metadata"], 0.9),
            ("Avaliação do impacto potencial no estado atual.", ["impact_analysis"], 0.85),
            ("Geração de resposta proporcional ao evento.", ["response_templates"], 0.9),
        ],
        "pattern_based": [
            ("Identificação de padrão recorrente na memória.", ["memory_patterns"], 1.0),
            ("Validação da força e frequência do padrão.", ["pattern_stats"], 0.9),
            ("Correlação com contexto atual.", ["context_correlation"], 0.8),
            ("Aplicação do padrão como base decisória.", ["pattern_application"], 0.85),
        ],
        "maintenance": [
            ("Ausência de dados de contexto detectada.", [], 0.5),
            ("Sistema em modo de manutenção por falta de entrada.", [], 0.5),
            ("Recomendação de alimentação de dados ao sistema.", [], 0.6),
        ],
        "general": [
            ("Análise geral do contexto disponível.", [], 0.7),
            ("Avaliação de alternativas possíveis.", [], 0.7),
            ("Seleção da alternativa com maior score de confiança.", [], 0.8),
        ],
    }

    def build_chain(self, decision: Decision, context: Dict[str, Any] = None) -> ReasoningChain:
        """
        Constrói uma cadeia de raciocínio para uma decisão.

        Args:
            decision: Objeto Decision a ser explicado.
            context: Dados de contexto adicionais para enriquecer o raciocínio.

        Returns:
            Objeto ReasoningChain com todos os passos documentados.
        """
        chain = ReasoningChain(decision_id=decision.decision_id)
        template = self.REASONING_TEMPLATES.get(
            decision.action_type, self.REASONING_TEMPLATES["general"]
        )

        for desc, evidence_keys, weight in template:
            evidence = []
            if context:
                for key in evidence_keys:
                    val = context.get(key)
                    if val:
                        evidence.append(f"{key}={val}")
            chain.add_step(description=desc, evidence=evidence, weight=weight)

        # Adiciona passos personalizados do raciocínio existente na decisão
        for i, r in enumerate(decision.reasoning):
            chain.add_step(
                description=r,
                evidence=[f"confidence={decision.confidence_score:.2f}"],
                weight=0.7,
            )

        conclusion = (
            f"Com base nos {len(chain.steps)} passos de raciocínio, "
            f"a decisão '{decision.action_type}' foi gerada com confiança de "
            f"{decision.confidence_score:.2f} e prioridade {decision.priority}."
        )
        chain.conclude(conclusion)
        decision.reasoning.append(f"Cadeia de raciocínio: {chain.to_text()}")
        return chain

    def validate(self, decision: Decision) -> Dict[str, Any]:
        """
        Valida se uma decisão possui raciocínio suficiente.

        Args:
            decision: Objeto Decision a ser validado.

        Returns:
            Dicionário com resultado da validação.
        """
        issues = []

        if not decision.reasoning:
            issues.append("CRÍTICO: Decisão sem raciocínio. Toda decisão deve ser explicável.")
        if decision.confidence_score <= 0.0:
            issues.append("AVISO: Score de confiança é zero. Verifique os dados de entrada.")
        if not decision.affected_context:
            issues.append("AVISO: Nenhum contexto afetado definido.")
        if decision.priority == 0 and decision.confidence_score > 0.5:
            issues.append("AVISO: Prioridade zero para decisão com alta confiança.")

        return {
            "decision_id": decision.decision_id,
            "is_valid": len(issues) == 0,
            "issues": issues,
            "reasoning_steps": len(decision.reasoning),
        }

    def validate_all(self, decisions: List[Decision]) -> List[Dict[str, Any]]:
        """Valida todas as decisões de uma lista."""
        return [self.validate(d) for d in decisions]

    def explain(self, decision: Decision) -> str:
        """
        Gera uma explicação legível e completa de uma decisão.

        Args:
            decision: Objeto Decision.

        Returns:
            String com explicação detalhada.
        """
        lines = [
            f"=== EXPLICAÇÃO DA DECISÃO ===",
            f"ID: {decision.decision_id}",
            f"Tipo: {decision.action_type}",
            f"Confiança: {decision.confidence_score:.2f}",
            f"Prioridade: {decision.priority}/100",
            f"Contextos afetados: {', '.join(decision.affected_context) or 'nenhum'}",
            f"Dependências: {', '.join(decision.dependencies) or 'nenhuma'}",
            f"",
            f"RACIOCÍNIO:",
        ]
        for i, r in enumerate(decision.reasoning, 1):
            lines.append(f"  {i}. {r}")

        if decision.alternative_decisions:
            lines.append(f"\nALTERNATIVAS CONSIDERADAS:")
            for alt in decision.alternative_decisions:
                lines.append(f"  - {alt}")

        return "\n".join(lines)
