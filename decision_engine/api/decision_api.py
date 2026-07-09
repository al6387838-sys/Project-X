"""
Decision Engine API V1
======================
API REST completa para o Decision Engine do LifeOS.

Endpoints:
  POST   /decisions/analyze          — Analisar contexto e gerar decisão
  GET    /decisions/{id}             — Buscar decisão por ID
  GET    /decisions                  — Listar histórico de decisões
  POST   /decisions/{id}/feedback    — Registrar feedback (aceitar/rejeitar)
  GET    /decisions/{id}/score       — Detalhamento do Decision Score
  GET    /decisions/insights         — Insights de aprendizagem
  GET    /decisions/categories       — Listar categorias disponíveis
  GET    /decisions/health           — Health check
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from flask import Flask, request, jsonify
from dataclasses import asdict
from decision_engine.engines.core_decision_engine import DecisionEngineCore
from decision_engine.models.decision import DecisionCategory

app = Flask(__name__)
engine = DecisionEngineCore()


def decision_to_dict(decision) -> dict:
    """Serializa um objeto Decision para dicionário JSON-safe."""
    alts = []
    for alt in decision.alternatives:
        alts.append({
            "alternative_id": alt.alternative_id,
            "description": alt.description,
            "pros": alt.pros,
            "cons": alt.cons,
            "estimated_impact": round(alt.estimated_impact, 2),
        })
    return {
        "decision_id": decision.decision_id,
        "timestamp": decision.timestamp,
        "related_goal": decision.related_goal,
        "category": decision.category,
        "context_used": decision.context_used,
        "factor_weights": decision.factor_weights,
        "alternatives": alts,
        "confidence_pct": round(decision.confidence_score * 100, 1),
        "decision_score": round(decision.decision_score, 2),
        "recommendation": decision.recommendation,
        "justification": decision.justification,
        "reasoning": decision.reasoning,
        "possible_risks": decision.possible_risks,
        "possible_benefits": decision.possible_benefits,
        "priority": decision.priority,
        "status": decision.status,
    }


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

@app.route("/decisions/health", methods=["GET"])
def health():
    """Verifica se o Decision Engine está operacional."""
    return jsonify({
        "status": "operational",
        "engine": "Decision Engine V1",
        "sprint": "021",
        "version": "1.0.0",
    }), 200


# ---------------------------------------------------------------------------
# Categorias
# ---------------------------------------------------------------------------

@app.route("/decisions/categories", methods=["GET"])
def list_categories():
    """Retorna todas as categorias de decisão disponíveis."""
    categories = [cat.value for cat in DecisionCategory]
    return jsonify({"categories": categories}), 200


# ---------------------------------------------------------------------------
# Analisar contexto e gerar decisão
# ---------------------------------------------------------------------------

@app.route("/decisions/analyze", methods=["POST"])
def analyze():
    """
    Analisa o contexto e gera uma recomendação de decisão.

    Body JSON:
      {
        "context": { ... },
        "goal": "string",
        "category": "Saúde | Finanças | ..."
      }
    """
    body = request.get_json(force=True) or {}
    context = body.get("context", {})
    goal = body.get("goal", "")
    category = body.get("category", DecisionCategory.PRODUTIVIDADE.value)

    if not context:
        return jsonify({"error": "O campo 'context' é obrigatório."}), 400

    valid_categories = [cat.value for cat in DecisionCategory]
    if category not in valid_categories:
        return jsonify({
            "error": f"Categoria inválida. Use uma de: {valid_categories}"
        }), 400

    decision = engine.analyze(context=context, goal=goal, category=category)
    return jsonify(decision_to_dict(decision)), 201


# ---------------------------------------------------------------------------
# Buscar decisão por ID
# ---------------------------------------------------------------------------

@app.route("/decisions/<decision_id>", methods=["GET"])
def get_decision(decision_id: str):
    """Busca uma decisão específica pelo seu ID."""
    decision = engine.get_decision(decision_id)
    if not decision:
        return jsonify({"error": f"Decisão '{decision_id}' não encontrada."}), 404
    return jsonify(decision_to_dict(decision)), 200


# ---------------------------------------------------------------------------
# Listar histórico
# ---------------------------------------------------------------------------

@app.route("/decisions", methods=["GET"])
def list_decisions():
    """
    Lista o histórico de decisões.

    Query params:
      category — filtrar por categoria
      status   — filtrar por status (pending, accepted, rejected)
      limit    — número máximo de resultados
    """
    category_filter = request.args.get("category")
    status_filter = request.args.get("status")
    limit = request.args.get("limit", type=int)

    decisions = engine.get_history()

    if category_filter:
        decisions = [d for d in decisions if d.category == category_filter]
    if status_filter:
        decisions = [d for d in decisions if d.status == status_filter]
    if limit:
        decisions = decisions[:limit]

    return jsonify({
        "total": len(decisions),
        "decisions": [decision_to_dict(d) for d in decisions],
    }), 200


# ---------------------------------------------------------------------------
# Feedback (aceitar / rejeitar)
# ---------------------------------------------------------------------------

@app.route("/decisions/<decision_id>/feedback", methods=["POST"])
def submit_feedback(decision_id: str):
    """
    Registra o feedback do usuário sobre uma decisão.
    Alimenta o sistema de aprendizagem.

    Body JSON:
      {
        "accepted": true | false,
        "feedback_text": "string opcional"
      }
    """
    body = request.get_json(force=True) or {}
    accepted = body.get("accepted")
    feedback_text = body.get("feedback_text", "")

    if accepted is None:
        return jsonify({"error": "O campo 'accepted' (boolean) é obrigatório."}), 400

    success = engine.submit_feedback(decision_id, bool(accepted), feedback_text)
    if not success:
        return jsonify({"error": f"Decisão '{decision_id}' não encontrada."}), 404

    return jsonify({
        "decision_id": decision_id,
        "feedback_registered": True,
        "accepted": bool(accepted),
        "message": "Feedback registrado. O sistema aprenderá com esta resposta.",
    }), 200


# ---------------------------------------------------------------------------
# Decision Score detalhado
# ---------------------------------------------------------------------------

@app.route("/decisions/<decision_id>/score", methods=["GET"])
def get_score(decision_id: str):
    """Retorna o detalhamento completo do Decision Score de uma decisão."""
    decision = engine.get_decision(decision_id)
    if not decision:
        return jsonify({"error": f"Decisão '{decision_id}' não encontrada."}), 404

    breakdown = engine.get_score_breakdown(decision)
    breakdown["classification"] = engine.scorer.classify(decision.decision_score)
    return jsonify(breakdown), 200


# ---------------------------------------------------------------------------
# Insights de aprendizagem
# ---------------------------------------------------------------------------

@app.route("/decisions/insights", methods=["GET"])
def get_insights():
    """
    Retorna insights de aprendizagem baseados no histórico de feedback.

    Query params:
      category — filtrar por categoria
    """
    category = request.args.get("category")
    insights = engine.get_learning_insights(category)
    return jsonify(insights), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5021, debug=False)
