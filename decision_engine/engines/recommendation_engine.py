"""
Recommendation Engine
=====================
Gera recomendações acionáveis baseadas em decisões, predições e contexto.
Cada recomendação é acompanhada de raciocínio explícito e nível de confiança.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import uuid
import time

from ..models.decision import Decision
from ..engines.prediction_engine import Prediction


@dataclass
class Recommendation:
    recommendation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    title: str = ""
    description: str = ""
    category: str = "general"
    confidence: float = 0.0
    priority: int = 0
    reasoning: List[str] = field(default_factory=list)
    source_decisions: List[str] = field(default_factory=list)
    source_predictions: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def explain(self) -> str:
        lines = [
            f"Recomendação [{self.recommendation_id}]:",
            f"  Título: {self.title}",
            f"  Categoria: {self.category}",
            f"  Confiança: {self.confidence:.2f}",
            f"  Prioridade: {self.priority}/100",
            f"  Descrição: {self.description}",
            f"  Raciocínio:",
        ]
        for r in self.reasoning:
            lines.append(f"    - {r}")
        return "\n".join(lines)


class RecommendationEngine:
    """
    Motor de recomendações do PROJECT-X.
    
    Sintetiza decisões e predições em recomendações acionáveis,
    categorizadas, priorizadas e completamente explicáveis.
    """

    CATEGORY_TEMPLATES = {
        "goal_pursuit": {
            "title_template": "Avançar no objetivo: {name}",
            "description_template": "Com base no objetivo ativo '{name}', recomenda-se tomar ação para avançar {progress:.0f}% → próximo marco.",
            "tags": ["objetivo", "progresso", "life_graph"],
        },
        "event_response": {
            "title_template": "Responder ao evento: {name}",
            "description_template": "O evento '{name}' requer atenção. Relevância: {relevance:.2f}. Ação recomendada para mitigar ou capitalizar.",
            "tags": ["evento", "resposta", "contexto"],
        },
        "pattern_based": {
            "title_template": "Aplicar padrão: {name}",
            "description_template": "Padrão recorrente '{name}' identificado com força {strength:.2f}. Recomenda-se seguir o padrão estabelecido.",
            "tags": ["padrão", "memória", "comportamento"],
        },
        "maintenance": {
            "title_template": "Manutenção do sistema",
            "description_template": "Sistema com dados insuficientes. Recomenda-se alimentar os motores com dados de contexto, memória e Life Graph.",
            "tags": ["manutenção", "sistema", "dados"],
        },
        "prediction_alert": {
            "title_template": "Alerta preditivo: {target}",
            "description_template": "Predição indica {predicted_value} para '{target}' (confiança: {confidence:.2f}). Ação preventiva recomendada.",
            "tags": ["predição", "alerta", "preventivo"],
        },
    }

    def from_decision(
        self, decision: Decision, context: Dict[str, Any] = None
    ) -> Recommendation:
        """
        Gera uma recomendação a partir de uma decisão.

        Args:
            decision: Objeto Decision como base.
            context: Dados adicionais de contexto.

        Returns:
            Objeto Recommendation.
        """
        template = self.CATEGORY_TEMPLATES.get(
            decision.action_type, self.CATEGORY_TEMPLATES["maintenance"]
        )
        meta = decision.metadata
        goal = meta.get("goal", {})
        event = meta.get("event", {})
        pattern = meta.get("pattern", {})

        if decision.action_type == "goal_pursuit":
            title = template["title_template"].format(name=goal.get("name", "objetivo"))
            description = template["description_template"].format(
                name=goal.get("name", "objetivo"),
                progress=goal.get("progress", 0) * 100,
            )
        elif decision.action_type == "event_response":
            title = template["title_template"].format(name=event.get("name", "evento"))
            description = template["description_template"].format(
                name=event.get("name", "evento"),
                relevance=event.get("relevance", 0.5),
            )
        elif decision.action_type == "pattern_based":
            title = template["title_template"].format(name=pattern.get("name", "padrão"))
            description = template["description_template"].format(
                name=pattern.get("name", "padrão"),
                strength=pattern.get("strength", 0.5),
            )
        else:
            title = template["title_template"]
            description = template["description_template"]

        reasoning = [
            f"Recomendação gerada a partir da decisão '{decision.decision_id}'.",
            f"Tipo de ação: {decision.action_type}.",
            f"Confiança da decisão base: {decision.confidence_score:.2f}.",
            f"Prioridade da decisão base: {decision.priority}/100.",
        ]
        reasoning.extend(decision.reasoning[:3])

        return Recommendation(
            title=title,
            description=description,
            category=decision.action_type,
            confidence=decision.confidence_score,
            priority=decision.priority,
            reasoning=reasoning,
            source_decisions=[decision.decision_id],
            tags=template["tags"],
            metadata={"decision_action_type": decision.action_type},
        )

    def from_prediction(self, prediction: Prediction) -> Recommendation:
        """
        Gera uma recomendação a partir de uma predição.

        Args:
            prediction: Objeto Prediction como base.

        Returns:
            Objeto Recommendation.
        """
        template = self.CATEGORY_TEMPLATES["prediction_alert"]
        title = template["title_template"].format(target=prediction.target)
        description = template["description_template"].format(
            predicted_value=prediction.predicted_value,
            target=prediction.target,
            confidence=prediction.confidence,
        )

        reasoning = [
            f"Recomendação gerada a partir da predição '{prediction.prediction_id}'.",
            f"Alvo predito: {prediction.target}.",
            f"Valor previsto: {prediction.predicted_value}.",
            f"Confiança da predição: {prediction.confidence:.2f}.",
            f"Horizonte: {prediction.horizon}.",
        ]
        reasoning.extend(prediction.reasoning[:2])

        priority = int(prediction.confidence * 80)
        if prediction.risk_factors:
            priority = min(priority + 10, 100)

        return Recommendation(
            title=title,
            description=description,
            category="prediction_alert",
            confidence=prediction.confidence,
            priority=priority,
            reasoning=reasoning,
            source_predictions=[prediction.prediction_id],
            tags=template["tags"],
            metadata={"prediction_horizon": prediction.horizon, "risk_factors": prediction.risk_factors},
        )

    def generate_batch(
        self,
        decisions: List[Decision],
        predictions: List[Prediction] = None,
        context: Dict[str, Any] = None,
    ) -> List[Recommendation]:
        """
        Gera recomendações em lote a partir de decisões e predições.

        Args:
            decisions: Lista de decisões.
            predictions: Lista de predições (opcional).
            context: Dados de contexto adicionais.

        Returns:
            Lista de recomendações ordenadas por prioridade.
        """
        recommendations: List[Recommendation] = []

        for d in decisions:
            recommendations.append(self.from_decision(d, context))

        if predictions:
            for p in predictions:
                if p.confidence > 0.4:
                    recommendations.append(self.from_prediction(p))

        return sorted(recommendations, key=lambda r: r.priority, reverse=True)

    def filter_by_category(
        self, recommendations: List[Recommendation], category: str
    ) -> List[Recommendation]:
        """Filtra recomendações por categoria."""
        return [r for r in recommendations if r.category == category]

    def filter_by_min_confidence(
        self, recommendations: List[Recommendation], min_confidence: float
    ) -> List[Recommendation]:
        """Filtra recomendações por confiança mínima."""
        return [r for r in recommendations if r.confidence >= min_confidence]

    def summarize(self, recommendations: List[Recommendation]) -> Dict[str, Any]:
        """
        Gera um resumo das recomendações.

        Args:
            recommendations: Lista de recomendações.

        Returns:
            Dicionário com estatísticas.
        """
        if not recommendations:
            return {"total": 0, "message": "Nenhuma recomendação gerada."}

        avg_conf = sum(r.confidence for r in recommendations) / len(recommendations)
        categories = {}
        for r in recommendations:
            categories[r.category] = categories.get(r.category, 0) + 1

        return {
            "total": len(recommendations),
            "average_confidence": round(avg_conf, 3),
            "top_priority": recommendations[0].priority if recommendations else 0,
            "category_distribution": categories,
        }
