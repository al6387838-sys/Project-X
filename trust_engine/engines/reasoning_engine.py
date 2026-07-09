from typing import List, Dict, Any
from ..models.trust import DecisionRecord, ConfidenceLevel

class ReasoningEngine:
    def __init__(self):
        pass

    def generate_explanation(self, record: DecisionRecord) -> str:
        explanation_parts = [
            f"O LifeOS tomou uma decisão em {record.timestamp.strftime('%d/%m/%Y %H:%M:%S')}.",
            f"O motor responsável foi o {record.engine_responsible}.",
            f"A decisão foi: {record.explanation}"
        ]

        if record.data_used:
            explanation_parts.append("Os dados utilizados para esta decisão foram:")
            for key, value in record.data_used.items():
                explanation_parts.append(f"  - {key}: {value}")

        explanation_parts.append(f"O nível de confiança nesta decisão foi: {record.confidence_level.value}.")

        if record.alternatives_considered:
            explanation_parts.append("Alternativas consideradas:")
            for alt in record.alternatives_considered:
                explanation_parts.append(f"  - {alt.get('description', 'N/A')} (Impacto: {alt.get('impact', 'N/A')})")

        return "\n".join(explanation_parts)

    def explain_confidence_level(self, level: ConfidenceLevel) -> str:
        if level == ConfidenceLevel.VERY_HIGH:
            return "O LifeOS tem um conhecimento muito profundo e dados robustos para esta decisão, com alta probabilidade de acerto."
        elif level == ConfidenceLevel.HIGH:
            return "O LifeOS tem um bom conhecimento e dados suficientes para esta decisão, com boa probabilidade de acerto."
        elif level == ConfidenceLevel.MEDIUM:
            return "O LifeOS tem informações razoáveis, mas há alguma incerteza ou dados limitados. A decisão é ponderada."
        elif level == ConfidenceLevel.LOW:
            return "O LifeOS tem dados limitos ou o cenário é muito complexo/novo. A decisão é uma estimativa com maior incerteza."
        return "Nível de confiança desconhecido."
