"""
Decision Engine Core V1
=======================
Responsável por transformar contexto em decisões inteligentes.

Responsabilidades:
  - Analisar contexto (Life Graph, eventos, sinais)
  - Avaliar prioridades
  - Calcular impacto
  - Comparar alternativas
  - Justificar decisões
  - Gerar recomendações

O Decision Engine NÃO executa ações. Ele recomenda.
"""

from typing import List, Dict, Any, Optional
from ..models.decision import Decision, Alternative, DecisionCategory
from .decision_history import DecisionHistory
from .decision_score import DecisionScore


CONTEXT_RULES: Dict[str, List[Dict[str, Any]]] = {
    DecisionCategory.SAUDE.value: [
        {
            "condition": lambda ctx: ctx.get("sleep_quality") == "bad"
                and ctx.get("upcoming_event") == "important_meeting",
            "alternatives": [
                {
                    "description": "Reagendar a reunião importante",
                    "pros": [
                        "Evitar tomar decisões ruins por cansaço",
                        "Recuperar energia para melhor performance",
                        "Reduzir risco de erros cognitivos",
                    ],
                    "cons": ["Pode atrasar o projeto", "Pode gerar atrito com participantes"],
                    "urgency": 0.6, "impact": 0.85, "goal_alignment": 0.9,
                },
                {
                    "description": "Manter a reunião, mas reduzir o escopo",
                    "pros": ["Mantém o cronograma", "Exige menos esforço cognitivo"],
                    "cons": ["Ainda exige energia", "Pode não resolver todos os tópicos"],
                    "urgency": 0.6, "impact": 0.55, "goal_alignment": 0.6,
                },
                {
                    "description": "Manter a reunião como planejada",
                    "pros": ["Não altera a agenda de ninguém", "Demonstra compromisso"],
                    "cons": ["Alto risco de baixa performance", "Aumento do estresse", "Decisões de baixa qualidade"],
                    "urgency": 0.6, "impact": 0.25, "goal_alignment": 0.3,
                },
            ],
        },
        {
            "condition": lambda ctx: ctx.get("stress_level") == "high" and ctx.get("activity") == "exercise",
            "alternatives": [
                {
                    "description": "Realizar exercício leve (caminhada, yoga)",
                    "pros": ["Reduz cortisol sem sobrecarregar o corpo", "Melhora o humor"],
                    "cons": ["Menor ganho físico do que treino intenso"],
                    "urgency": 0.5, "impact": 0.8, "goal_alignment": 0.85,
                },
                {
                    "description": "Adiar o treino para amanhã",
                    "pros": ["Recuperação completa"],
                    "cons": ["Quebra de rotina", "Pode aumentar a ansiedade"],
                    "urgency": 0.5, "impact": 0.4, "goal_alignment": 0.4,
                },
            ],
        },
    ],
    DecisionCategory.FINANCAS.value: [
        {
            "condition": lambda ctx: ctx.get("expense_type") == "impulse" and ctx.get("budget_status") == "tight",
            "alternatives": [
                {
                    "description": "Adiar a compra por 48 horas (regra de espera)",
                    "pros": ["Evita compra por impulso", "Preserva o orçamento", "Tempo para pesquisar alternativas mais baratas"],
                    "cons": ["Pode perder promoção", "Frustração imediata"],
                    "urgency": 0.3, "impact": 0.9, "goal_alignment": 0.95,
                },
                {
                    "description": "Realizar a compra agora",
                    "pros": ["Satisfação imediata"],
                    "cons": ["Compromete o orçamento", "Reforça comportamento impulsivo"],
                    "urgency": 0.3, "impact": 0.2, "goal_alignment": 0.1,
                },
            ],
        },
    ],
    DecisionCategory.PRODUTIVIDADE.value: [
        {
            "condition": lambda ctx: ctx.get("focus_level") == "low" and ctx.get("task_type") == "deep_work",
            "alternatives": [
                {
                    "description": "Fazer uma pausa de 20 minutos antes de iniciar",
                    "pros": ["Restaura o foco", "Melhora a qualidade do trabalho profundo"],
                    "cons": ["Atrasa o início da tarefa"],
                    "urgency": 0.4, "impact": 0.85, "goal_alignment": 0.9,
                },
                {
                    "description": "Iniciar com tarefas menores para ganhar momentum",
                    "pros": ["Ativa o modo de trabalho gradualmente"],
                    "cons": ["Pode não chegar ao deep work"],
                    "urgency": 0.4, "impact": 0.6, "goal_alignment": 0.65,
                },
                {
                    "description": "Forçar o início do deep work agora",
                    "pros": ["Sem atraso"],
                    "cons": ["Baixa qualidade de output", "Maior risco de erros"],
                    "urgency": 0.4, "impact": 0.3, "goal_alignment": 0.35,
                },
            ],
        },
    ],
    DecisionCategory.CARREIRA.value: [
        {
            "condition": lambda ctx: ctx.get("opportunity") == "job_offer" and ctx.get("current_satisfaction") == "low",
            "alternatives": [
                {
                    "description": "Aceitar a oferta e negociar condições",
                    "pros": ["Nova oportunidade de crescimento", "Sair de ambiente insatisfatório"],
                    "cons": ["Incerteza do novo ambiente", "Período de adaptação"],
                    "urgency": 0.7, "impact": 0.85, "goal_alignment": 0.8,
                },
                {
                    "description": "Negociar melhorias no emprego atual antes de decidir",
                    "pros": ["Pode resolver o problema sem mudar"],
                    "cons": ["Pode não ter resultado", "Perde tempo"],
                    "urgency": 0.7, "impact": 0.5, "goal_alignment": 0.55,
                },
                {
                    "description": "Recusar a oferta",
                    "pros": ["Estabilidade"],
                    "cons": ["Permanece insatisfeito", "Perde oportunidade"],
                    "urgency": 0.7, "impact": 0.15, "goal_alignment": 0.1,
                },
            ],
        },
    ],
    DecisionCategory.PROJETOS.value: [
        {
            "condition": lambda ctx: ctx.get("project_status") == "delayed" and ctx.get("resources") == "limited",
            "alternatives": [
                {
                    "description": "Reduzir escopo e entregar MVP",
                    "pros": ["Entrega algo de valor", "Evita atraso maior", "Feedback antecipado"],
                    "cons": ["Funcionalidades adiadas"],
                    "urgency": 0.8, "impact": 0.85, "goal_alignment": 0.9,
                },
                {
                    "description": "Solicitar extensão de prazo",
                    "pros": ["Entrega completa"],
                    "cons": ["Pode não ser aprovado", "Aumenta custos"],
                    "urgency": 0.8, "impact": 0.5, "goal_alignment": 0.5,
                },
            ],
        },
    ],
    DecisionCategory.RELACIONAMENTOS.value: [
        {
            "condition": lambda ctx: ctx.get("conflict") == "active" and ctx.get("relationship_type") == "professional",
            "alternatives": [
                {
                    "description": "Iniciar conversa direta e empática",
                    "pros": ["Resolve o conflito na raiz", "Fortalece o relacionamento"],
                    "cons": ["Pode ser desconfortável inicialmente"],
                    "urgency": 0.7, "impact": 0.9, "goal_alignment": 0.9,
                },
                {
                    "description": "Aguardar o conflito se resolver sozinho",
                    "pros": ["Sem confronto imediato"],
                    "cons": ["Conflito pode escalar", "Ambiente de trabalho deteriora"],
                    "urgency": 0.7, "impact": 0.2, "goal_alignment": 0.15,
                },
            ],
        },
    ],
    DecisionCategory.CONHECIMENTO.value: [
        {
            "condition": lambda ctx: ctx.get("learning_goal") == "new_skill" and ctx.get("available_time") == "limited",
            "alternatives": [
                {
                    "description": "Aprendizado em micro-sessões diárias (15-20 min)",
                    "pros": ["Consistência supera intensidade", "Encaixa na rotina", "Menor risco de abandono"],
                    "cons": ["Progresso mais lento"],
                    "urgency": 0.4, "impact": 0.85, "goal_alignment": 0.9,
                },
                {
                    "description": "Bloco de estudo intensivo no fim de semana",
                    "pros": ["Progresso rápido"],
                    "cons": ["Difícil de manter", "Retenção menor"],
                    "urgency": 0.4, "impact": 0.55, "goal_alignment": 0.5,
                },
            ],
        },
    ],
}

GENERIC_ALTERNATIVES = [
    {
        "description": "Avançar com o plano atual",
        "pros": ["Mantém o momentum", "Alinhado com objetivo original"],
        "cons": ["Pode ignorar novos dados do contexto"],
        "urgency": 0.5, "impact": 0.5, "goal_alignment": 0.5,
    },
    {
        "description": "Pausar e reavaliar o contexto",
        "pros": ["Evita erros", "Permite incorporar novos dados"],
        "cons": ["Atrasa o progresso"],
        "urgency": 0.5, "impact": 0.45, "goal_alignment": 0.45,
    },
]


class DecisionEngineCore:
    """
    Núcleo do Decision Engine V1.
    Transforma contexto em decisões inteligentes com scoring, justificativa e aprendizagem.
    """

    def __init__(self, history_manager: DecisionHistory = None):
        self.history = history_manager or DecisionHistory()
        self.scorer = DecisionScore()

    def analyze(self, context: Dict[str, Any], goal: str = "", category: str = DecisionCategory.PRODUTIVIDADE.value) -> Decision:
        """Analisa o contexto e retorna a melhor decisão recomendada."""
        decision = Decision(
            related_goal=goal,
            category=category,
            context_used=context,
            factor_weights=self._calculate_factor_weights(context),
        )

        raw_alternatives = self._match_alternatives(context, category)
        alternatives: List[Alternative] = []

        for raw in raw_alternatives:
            alt = Alternative(
                description=raw["description"],
                pros=raw["pros"],
                cons=raw["cons"],
            )
            score = self.scorer.calculate(
                decision=Decision(confidence_score=0.0),
                urgency=raw.get("urgency", 0.5),
                impact=raw.get("impact", 0.5),
                goal_alignment=raw.get("goal_alignment", 0.5),
                context_coverage=min(len(context) / 5.0, 1.0),
                learning_boost=self._get_learning_boost(category),
            )
            alt.estimated_impact = score
            alternatives.append(alt)

        decision.alternatives = alternatives
        best = max(alternatives, key=lambda a: a.estimated_impact) if alternatives else None

        if best:
            decision.confidence_score = min(0.97, best.estimated_impact / 100.0 + 0.15)
            decision.recommendation = best.description
            decision.possible_benefits = best.pros
            decision.possible_risks = best.cons

            learning_boost = self._get_learning_boost(category)
            final_score = self.scorer.calculate(
                decision=decision,
                urgency=self._extract_urgency(context),
                impact=best.estimated_impact / 100.0,
                goal_alignment=self._extract_goal_alignment(context, goal),
                context_coverage=min(len(context) / 5.0, 1.0),
                learning_boost=learning_boost,
            )
            decision.decision_score = final_score
            decision.priority = int(final_score)
            decision.justification = self._build_justification(decision, best, alternatives)
            decision.reasoning = self._build_reasoning(decision, context, alternatives, learning_boost)

        self.history.record_decision(decision)
        return decision

    def submit_feedback(self, decision_id: str, accepted: bool, feedback_text: str = "") -> bool:
        """Registra o feedback do usuário. Alimenta o sistema de aprendizagem."""
        return self.history.register_feedback(decision_id, accepted, feedback_text)

    def get_history(self) -> List[Decision]:
        return self.history.get_all()

    def get_decision(self, decision_id: str) -> Optional[Decision]:
        return self.history.get_decision(decision_id)

    def get_learning_insights(self, category: str = None) -> Dict[str, Any]:
        return self.history.get_learning_patterns(category)

    def get_score_breakdown(self, decision: Decision) -> Dict[str, Any]:
        return self.scorer.score_breakdown(
            decision=decision,
            urgency=self._extract_urgency(decision.context_used),
            impact=decision.decision_score / 100.0,
            goal_alignment=self._extract_goal_alignment(decision.context_used, decision.related_goal),
            context_coverage=min(len(decision.context_used) / 5.0, 1.0),
            learning_boost=self._get_learning_boost(decision.category),
        )

    def _match_alternatives(self, context: Dict[str, Any], category: str) -> List[Dict[str, Any]]:
        rules = CONTEXT_RULES.get(category, [])
        for rule in rules:
            try:
                if rule["condition"](context):
                    return rule["alternatives"]
            except Exception:
                continue
        return GENERIC_ALTERNATIVES

    def _calculate_factor_weights(self, context: Dict[str, Any]) -> Dict[str, float]:
        weights = {"urgency": 0.5, "impact": 0.5, "confidence": 0.5}
        if context.get("energy_level") == "low" or context.get("sleep_quality") == "bad":
            weights["energy_conservation"] = 0.85
        if context.get("deadline") == "soon" or context.get("urgency") == "high":
            weights["urgency"] = 0.9
        if context.get("financial_risk") == "high":
            weights["financial_safety"] = 0.9
        return weights

    def _extract_urgency(self, context: Dict[str, Any]) -> float:
        urgency_map = {"low": 0.2, "medium": 0.5, "high": 0.8, "critical": 1.0}
        raw = context.get("urgency", context.get("deadline_urgency", "medium"))
        return urgency_map.get(str(raw), 0.5)

    def _extract_goal_alignment(self, context: Dict[str, Any], goal: str) -> float:
        if not goal:
            return 0.5
        if any(kw in goal.lower() for kw in ["saúde", "saude", "health"]):
            return 0.9
        if any(kw in goal.lower() for kw in ["financ", "dinheiro", "money"]):
            return 0.85
        return 0.7

    def _get_learning_boost(self, category: str) -> float:
        patterns = self.history.get_learning_patterns(category)
        rate = patterns.get("acceptance_rate", 0.0)
        return min(rate * 0.2, 0.2)

    def _build_justification(self, decision: Decision, best: Alternative, all_alternatives: List[Alternative]) -> str:
        other_scores = [
            f"'{a.description}' ({a.estimated_impact:.1f}/100)"
            for a in all_alternatives if a.description != best.description
        ]
        other_text = ", ".join(other_scores) if other_scores else "nenhuma"
        return (
            f"A recomendação '{best.description}' foi selecionada com Decision Score de "
            f"{best.estimated_impact:.1f}/100 e confiança de {decision.confidence_score * 100:.1f}%. "
            f"Alternativas avaliadas: {other_text}. "
            f"O contexto atual indica que esta é a opção com maior impacto positivo "
            f"e menor risco para o objetivo '{decision.related_goal or 'geral'}'."
        )

    def _build_reasoning(self, decision: Decision, context: Dict[str, Any], alternatives: List[Alternative], learning_boost: float) -> List[str]:
        steps = [
            f"[1] Contexto analisado: {len(context)} variáveis detectadas na categoria '{decision.category}'.",
            f"[2] Alternativas geradas e avaliadas: {len(alternatives)} opções consideradas.",
            f"[3] Melhor alternativa selecionada por Decision Score: '{decision.recommendation}'.",
            f"[4] Benefício principal: {decision.possible_benefits[0] if decision.possible_benefits else 'N/A'}.",
            f"[5] Risco principal identificado: {decision.possible_risks[0] if decision.possible_risks else 'N/A'}.",
            f"[6] Confiança da IA: {decision.confidence_score * 100:.1f}%.",
        ]
        if learning_boost > 0:
            steps.append(
                f"[7] Bônus de aprendizagem aplicado: +{learning_boost * 100:.1f}% "
                f"(baseado em {len(self.history.feedback_log)} feedbacks históricos)."
            )
        return steps
