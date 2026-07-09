"""
Prediction Engine
=================
Gera predições sobre estados futuros com base em padrões de memória,
tendências de contexto e dados do Life Graph.
Cada predição é acompanhada de raciocínio explícito e intervalo de confiança.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import uuid
import time


@dataclass
class Prediction:
    prediction_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    target: str = ""
    predicted_value: Any = None
    confidence: float = 0.0
    horizon: str = "short_term"  # short_term | medium_term | long_term
    reasoning: List[str] = field(default_factory=list)
    supporting_evidence: List[str] = field(default_factory=list)
    risk_factors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def explain(self) -> str:
        lines = [
            f"Predição [{self.prediction_id}]:",
            f"  Alvo: {self.target}",
            f"  Valor previsto: {self.predicted_value}",
            f"  Confiança: {self.confidence:.2f}",
            f"  Horizonte: {self.horizon}",
            f"  Raciocínio:",
        ]
        for r in self.reasoning:
            lines.append(f"    - {r}")
        if self.risk_factors:
            lines.append(f"  Fatores de risco:")
            for rf in self.risk_factors:
                lines.append(f"    - {rf}")
        return "\n".join(lines)


class PredictionEngine:
    """
    Motor de predição do PROJECT-X.
    
    Utiliza padrões históricos, tendências de contexto e dados do Life Graph
    para gerar predições sobre estados futuros com raciocínio explícito.
    """

    HORIZON_WEIGHTS = {
        "short_term": 0.9,
        "medium_term": 0.75,
        "long_term": 0.55,
    }

    def predict(
        self,
        target: str,
        context: Dict[str, Any],
        memory: Dict[str, Any],
        horizon: str = "short_term",
    ) -> Prediction:
        """
        Gera uma predição para um alvo específico.

        Args:
            target: O que está sendo predito (ex: 'user_stress_level').
            context: Dados do Context Engine.
            memory: Dados do Memory Engine.
            horizon: Horizonte temporal da predição.

        Returns:
            Objeto Prediction com valor previsto e raciocínio.
        """
        if horizon not in self.HORIZON_WEIGHTS:
            horizon = "short_term"

        base_confidence = self.HORIZON_WEIGHTS[horizon]
        reasoning = []
        evidence = []
        risk_factors = []

        # Análise de tendência histórica
        historical = memory.get("historical_values", {}).get(target, [])
        if historical:
            trend = self._calculate_trend(historical)
            predicted_value = historical[-1] + trend
            evidence.append(f"Tendência histórica calculada a partir de {len(historical)} pontos.")
            reasoning.append(
                f"Análise de {len(historical)} valores históricos para '{target}'. "
                f"Tendência: {trend:+.3f} por período."
            )
            base_confidence = min(base_confidence + 0.05 * min(len(historical), 5), 0.99)
        else:
            predicted_value = context.get(target, 0.5)
            reasoning.append(
                f"Sem histórico disponível para '{target}'. "
                f"Usando valor atual do contexto como base."
            )
            base_confidence *= 0.7

        # Análise de sinais de contexto
        signals = context.get("signals", {})
        if signals.get("volatility_high", False):
            base_confidence *= 0.85
            risk_factors.append("Alta volatilidade no contexto atual reduz confiança da predição.")
            reasoning.append("Volatilidade alta detectada: confiança reduzida em 15%.")

        if signals.get("data_quality_low", False):
            base_confidence *= 0.80
            risk_factors.append("Qualidade dos dados de entrada abaixo do ideal.")
            reasoning.append("Qualidade de dados baixa: confiança reduzida em 20%.")

        # Análise de padrões de memória
        patterns = memory.get("patterns", [])
        relevant_patterns = [p for p in patterns if p.get("domain") == target]
        if relevant_patterns:
            strongest = max(relevant_patterns, key=lambda p: p.get("strength", 0))
            reasoning.append(
                f"Padrão relevante identificado: '{strongest.get('name', 'padrão')}' "
                f"com força {strongest.get('strength', 0):.2f}."
            )
            evidence.append(f"Padrão de memória: {strongest.get('name', 'padrão')}")
            base_confidence = min(base_confidence + strongest.get("strength", 0) * 0.1, 0.99)

        reasoning.append(
            f"Predição final para '{target}' no horizonte '{horizon}': "
            f"valor={predicted_value}, confiança={base_confidence:.2f}."
        )

        return Prediction(
            target=target,
            predicted_value=round(predicted_value, 4) if isinstance(predicted_value, float) else predicted_value,
            confidence=round(base_confidence, 3),
            horizon=horizon,
            reasoning=reasoning,
            supporting_evidence=evidence,
            risk_factors=risk_factors,
            metadata={"context_keys": list(context.keys()), "memory_patterns": len(patterns)},
        )

    def predict_batch(
        self,
        targets: List[str],
        context: Dict[str, Any],
        memory: Dict[str, Any],
        horizon: str = "short_term",
    ) -> List[Prediction]:
        """
        Gera predições para múltiplos alvos.

        Args:
            targets: Lista de alvos a serem preditos.
            context: Dados do Context Engine.
            memory: Dados do Memory Engine.
            horizon: Horizonte temporal.

        Returns:
            Lista de objetos Prediction.
        """
        return [self.predict(t, context, memory, horizon) for t in targets]

    def assess_risk(self, predictions: List[Prediction]) -> Dict[str, Any]:
        """
        Avalia o risco geral com base em um conjunto de predições.

        Args:
            predictions: Lista de predições geradas.

        Returns:
            Dicionário com avaliação de risco.
        """
        if not predictions:
            return {"risk_level": "unknown", "reasoning": "Nenhuma predição disponível."}

        avg_confidence = sum(p.confidence for p in predictions) / len(predictions)
        total_risks = sum(len(p.risk_factors) for p in predictions)
        low_confidence = [p for p in predictions if p.confidence < 0.5]

        if avg_confidence < 0.4 or total_risks > 5:
            risk_level = "high"
        elif avg_confidence < 0.65 or total_risks > 2:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "risk_level": risk_level,
            "average_confidence": round(avg_confidence, 3),
            "total_risk_factors": total_risks,
            "low_confidence_predictions": len(low_confidence),
            "reasoning": (
                f"Risco {risk_level} baseado em confiança média de {avg_confidence:.2f}, "
                f"{total_risks} fatores de risco e {len(low_confidence)} predições de baixa confiança."
            ),
        }

    def _calculate_trend(self, values: List[float]) -> float:
        """Calcula a tendência linear de uma série de valores."""
        if len(values) < 2:
            return 0.0
        n = len(values)
        x_mean = (n - 1) / 2.0
        y_mean = sum(values) / n
        numerator = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        if denominator == 0:
            return 0.0
        return numerator / denominator
