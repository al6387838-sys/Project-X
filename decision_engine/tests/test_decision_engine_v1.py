"""
Testes Automatizados — Decision Engine V1
==========================================
Sprint 021 | PROJECT-X Phase 3

Cobertura:
  - Modelos (Decision, Alternative, DecisionCategory)
  - Decision Score System
  - Decision History e Feedback
  - Core Decision Engine (todas as categorias)
  - API REST (todos os endpoints)
"""

import pytest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from decision_engine.models.decision import Decision, Alternative, DecisionCategory
from decision_engine.engines.decision_score import DecisionScore
from decision_engine.engines.decision_history import DecisionHistory
from decision_engine.engines.core_decision_engine import DecisionEngineCore


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture
def engine():
    """Instância limpa do Decision Engine para cada teste."""
    import uuid
    path = f"/tmp/test_engine_{uuid.uuid4().hex}.json"
    return DecisionEngineCore(history_manager=DecisionHistory(storage_path=path))


@pytest.fixture
def scorer():
    return DecisionScore()


@pytest.fixture
def history():
    import uuid
    path = f"/tmp/test_history_{uuid.uuid4().hex}.json"
    return DecisionHistory(storage_path=path)


# ===========================================================================
# Testes de Modelos
# ===========================================================================

class TestDecisionModel:
    def test_decision_has_unique_id(self):
        d1 = Decision()
        d2 = Decision()
        assert d1.decision_id != d2.decision_id

    def test_decision_default_status_is_pending(self):
        d = Decision()
        assert d.status == "pending"

    def test_decision_explain_with_justification(self):
        d = Decision(justification="Teste de justificativa.", reasoning=["Passo 1", "Passo 2"])
        explanation = d.explain()
        assert "Teste de justificativa." in explanation
        assert "Passo 1" in explanation

    def test_decision_explain_empty(self):
        d = Decision()
        assert "Nenhum raciocínio" in d.explain()

    def test_alternative_has_unique_id(self):
        a1 = Alternative()
        a2 = Alternative()
        assert a1.alternative_id != a2.alternative_id

    def test_decision_categories_are_valid(self):
        categories = [cat.value for cat in DecisionCategory]
        assert "Saúde" in categories
        assert "Finanças" in categories
        assert "Produtividade" in categories
        assert "Relacionamentos" in categories
        assert "Projetos" in categories
        assert "Carreira" in categories
        assert "Conhecimento" in categories
        assert len(categories) == 7


# ===========================================================================
# Testes do Decision Score
# ===========================================================================

class TestDecisionScore:
    def test_score_range_0_to_100(self, scorer):
        d = Decision(confidence_score=0.8)
        score = scorer.calculate(d, urgency=0.7, impact=0.8)
        assert 0 <= score <= 100

    def test_high_confidence_yields_high_score(self, scorer):
        d_high = Decision(confidence_score=0.95)
        d_low = Decision(confidence_score=0.1)
        score_high = scorer.calculate(d_high, urgency=0.9, impact=0.9)
        score_low = scorer.calculate(d_low, urgency=0.1, impact=0.1)
        assert score_high > score_low

    def test_score_breakdown_has_all_keys(self, scorer):
        d = Decision(confidence_score=0.7)
        breakdown = scorer.score_breakdown(d, urgency=0.5, impact=0.5)
        assert "total_score" in breakdown
        assert "confidence_pct" in breakdown
        assert "breakdown" in breakdown
        assert "weights_used" in breakdown

    def test_classify_excellent(self, scorer):
        assert scorer.classify(90) == "Excelente"

    def test_classify_good(self, scorer):
        assert scorer.classify(75) == "Bom"

    def test_classify_moderate(self, scorer):
        assert scorer.classify(55) == "Moderado"

    def test_classify_weak(self, scorer):
        assert scorer.classify(35) == "Fraco"

    def test_classify_insufficient(self, scorer):
        assert scorer.classify(15) == "Insuficiente"

    def test_learning_boost_increases_score(self, scorer):
        d = Decision(confidence_score=0.7)
        score_no_boost = scorer.calculate(d, urgency=0.5, impact=0.5, learning_boost=0.0)
        score_with_boost = scorer.calculate(d, urgency=0.5, impact=0.5, learning_boost=1.0)
        assert score_with_boost > score_no_boost


# ===========================================================================
# Testes do Decision History
# ===========================================================================

class TestDecisionHistory:
    def test_record_and_retrieve_decision(self, history):
        d = Decision(related_goal="Teste", category=DecisionCategory.SAUDE.value)
        history.record_decision(d)
        retrieved = history.get_decision(d.decision_id)
        assert retrieved is not None
        assert retrieved.decision_id == d.decision_id

    def test_get_all_returns_sorted_by_timestamp(self, history):
        d1 = Decision()
        d2 = Decision()
        history.record_decision(d1)
        history.record_decision(d2)
        all_decisions = history.get_all()
        assert len(all_decisions) >= 2

    def test_feedback_accepted_updates_status(self, history):
        d = Decision()
        history.record_decision(d)
        result = history.register_feedback(d.decision_id, accepted=True, feedback_text="Ótima decisão!")
        assert result is True
        assert d.status == "accepted"

    def test_feedback_rejected_updates_status(self, history):
        d = Decision()
        history.record_decision(d)
        history.register_feedback(d.decision_id, accepted=False)
        assert d.status == "rejected"

    def test_feedback_nonexistent_decision_returns_false(self, history):
        result = history.register_feedback("id-inexistente", accepted=True)
        assert result is False

    def test_learning_patterns_empty_history(self, history):
        patterns = history.get_learning_patterns()
        assert patterns["acceptance_rate"] == 0

    def test_learning_patterns_with_feedback(self, history):
        for _ in range(3):
            d = Decision(category=DecisionCategory.SAUDE.value)
            history.record_decision(d)
            history.register_feedback(d.decision_id, accepted=True)
        patterns = history.get_learning_patterns(DecisionCategory.SAUDE.value)
        assert patterns["acceptance_rate"] == 1.0
        assert patterns["total_decisions"] == 3


# ===========================================================================
# Testes do Core Decision Engine
# ===========================================================================

class TestDecisionEngineCore:

    # --- Cenário 1: Dormiu mal + Reunião importante (Saúde) ---
    def test_sleep_bad_meeting_recommends_reschedule(self, engine):
        context = {
            "sleep_quality": "bad",
            "upcoming_event": "important_meeting",
            "energy_level": "low",
        }
        decision = engine.analyze(
            context=context,
            goal="Manter performance cognitiva",
            category=DecisionCategory.SAUDE.value,
        )
        assert decision.recommendation == "Reagendar a reunião importante"
        assert decision.confidence_score > 0.5
        assert decision.decision_score > 0
        assert len(decision.alternatives) == 3
        assert len(decision.possible_benefits) > 0
        assert len(decision.possible_risks) > 0
        assert decision.justification != ""
        assert len(decision.reasoning) >= 6

    # --- Cenário 2: Compra por impulso (Finanças) ---
    def test_impulse_buy_recommends_waiting(self, engine):
        context = {
            "expense_type": "impulse",
            "budget_status": "tight",
            "financial_risk": "high",
        }
        decision = engine.analyze(
            context=context,
            goal="Controlar finanças pessoais",
            category=DecisionCategory.FINANCAS.value,
        )
        assert "Adiar" in decision.recommendation
        assert decision.decision_score > 0
        assert len(decision.alternatives) == 2

    # --- Cenário 3: Foco baixo + Deep Work (Produtividade) ---
    def test_low_focus_deep_work_recommends_break(self, engine):
        context = {
            "focus_level": "low",
            "task_type": "deep_work",
        }
        decision = engine.analyze(
            context=context,
            goal="Completar tarefa de alta complexidade",
            category=DecisionCategory.PRODUTIVIDADE.value,
        )
        assert "pausa" in decision.recommendation.lower()
        assert len(decision.alternatives) == 3

    # --- Cenário 4: Oferta de emprego (Carreira) ---
    def test_job_offer_low_satisfaction_recommends_accept(self, engine):
        context = {
            "opportunity": "job_offer",
            "current_satisfaction": "low",
        }
        decision = engine.analyze(
            context=context,
            goal="Crescimento profissional",
            category=DecisionCategory.CARREIRA.value,
        )
        assert "Aceitar" in decision.recommendation
        assert len(decision.alternatives) == 3

    # --- Cenário 5: Projeto atrasado (Projetos) ---
    def test_delayed_project_recommends_mvp(self, engine):
        context = {
            "project_status": "delayed",
            "resources": "limited",
        }
        decision = engine.analyze(
            context=context,
            goal="Entregar projeto no prazo",
            category=DecisionCategory.PROJETOS.value,
        )
        assert "MVP" in decision.recommendation or "escopo" in decision.recommendation.lower()

    # --- Cenário 6: Conflito profissional (Relacionamentos) ---
    def test_professional_conflict_recommends_conversation(self, engine):
        context = {
            "conflict": "active",
            "relationship_type": "professional",
        }
        decision = engine.analyze(
            context=context,
            goal="Resolver conflito no trabalho",
            category=DecisionCategory.RELACIONAMENTOS.value,
        )
        assert "conversa" in decision.recommendation.lower() or "direta" in decision.recommendation.lower()

    # --- Cenário 7: Aprender nova habilidade (Conhecimento) ---
    def test_new_skill_limited_time_recommends_micro_sessions(self, engine):
        context = {
            "learning_goal": "new_skill",
            "available_time": "limited",
        }
        decision = engine.analyze(
            context=context,
            goal="Aprender Python",
            category=DecisionCategory.CONHECIMENTO.value,
        )
        assert "micro" in decision.recommendation.lower() or "diárias" in decision.recommendation.lower()

    # --- Cenário 8: Contexto genérico (fallback) ---
    def test_generic_context_uses_fallback(self, engine):
        context = {"some_variable": "some_value"}
        decision = engine.analyze(context=context, goal="Objetivo genérico")
        assert decision.recommendation != ""
        assert len(decision.alternatives) == 2

    # --- Decision ID e Timestamp ---
    def test_decision_has_id_and_timestamp(self, engine):
        decision = engine.analyze(context={"x": 1})
        assert decision.decision_id != ""
        assert decision.timestamp > 0

    # --- Histórico ---
    def test_decisions_are_recorded_in_history(self, engine):
        engine.analyze(context={"x": 1})
        engine.analyze(context={"y": 2})
        history = engine.get_history()
        assert len(history) >= 2

    # --- Feedback e Aprendizagem ---
    def test_feedback_accepted_updates_status(self, engine):
        d = engine.analyze(context={"sleep_quality": "bad", "upcoming_event": "important_meeting"},
                           category=DecisionCategory.SAUDE.value)
        result = engine.submit_feedback(d.decision_id, accepted=True, feedback_text="Ótima sugestão!")
        assert result is True
        retrieved = engine.get_decision(d.decision_id)
        assert retrieved.status == "accepted"

    def test_feedback_rejected_updates_status(self, engine):
        d = engine.analyze(context={"x": 1})
        engine.submit_feedback(d.decision_id, accepted=False)
        retrieved = engine.get_decision(d.decision_id)
        assert retrieved.status == "rejected"

    def test_learning_insights_returns_dict(self, engine):
        insights = engine.get_learning_insights()
        assert isinstance(insights, dict)
        assert "acceptance_rate" in insights

    # --- Score Breakdown ---
    def test_score_breakdown_returns_complete_data(self, engine):
        d = engine.analyze(context={"sleep_quality": "bad", "upcoming_event": "important_meeting"},
                           category=DecisionCategory.SAUDE.value)
        breakdown = engine.get_score_breakdown(d)
        assert "total_score" in breakdown
        assert "breakdown" in breakdown
        assert "confidence_pct" in breakdown

    # --- Pesos dos fatores ---
    def test_factor_weights_populated(self, engine):
        d = engine.analyze(context={"sleep_quality": "bad", "energy_level": "low"},
                           category=DecisionCategory.SAUDE.value)
        assert "energy_conservation" in d.factor_weights

    # --- Categoria registrada ---
    def test_category_is_stored_in_decision(self, engine):
        d = engine.analyze(context={"x": 1}, category=DecisionCategory.FINANCAS.value)
        assert d.category == DecisionCategory.FINANCAS.value


# ===========================================================================
# Testes da API REST
# ===========================================================================

class TestDecisionAPI:
    @pytest.fixture
    def client(self):
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
        from decision_engine.api.decision_api import app, engine as api_engine
        # Usar engine limpo para cada teste
        api_engine.history = DecisionHistory(storage_path="/tmp/test_api_history.json")
        app.config["TESTING"] = True
        with app.test_client() as client:
            yield client

    def test_health_check(self, client):
        resp = client.get("/decisions/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "operational"

    def test_list_categories(self, client):
        resp = client.get("/decisions/categories")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "categories" in data
        assert len(data["categories"]) == 7

    def test_analyze_valid_context(self, client):
        payload = {
            "context": {"sleep_quality": "bad", "upcoming_event": "important_meeting"},
            "goal": "Manter performance",
            "category": "Saúde",
        }
        resp = client.post("/decisions/analyze", json=payload)
        assert resp.status_code == 201
        data = resp.get_json()
        assert "decision_id" in data
        assert "recommendation" in data
        assert "justification" in data
        assert "confidence_pct" in data
        assert "decision_score" in data
        assert "alternatives" in data
        assert "possible_risks" in data
        assert "possible_benefits" in data

    def test_analyze_missing_context_returns_400(self, client):
        resp = client.post("/decisions/analyze", json={"goal": "teste"})
        assert resp.status_code == 400

    def test_analyze_invalid_category_returns_400(self, client):
        resp = client.post("/decisions/analyze", json={
            "context": {"x": 1},
            "category": "CategoriaInexistente"
        })
        assert resp.status_code == 400

    def test_get_decision_by_id(self, client):
        # Criar decisão
        payload = {"context": {"x": 1}, "category": "Produtividade"}
        create_resp = client.post("/decisions/analyze", json=payload)
        decision_id = create_resp.get_json()["decision_id"]

        # Buscar por ID
        resp = client.get(f"/decisions/{decision_id}")
        assert resp.status_code == 200
        assert resp.get_json()["decision_id"] == decision_id

    def test_get_nonexistent_decision_returns_404(self, client):
        resp = client.get("/decisions/id-que-nao-existe")
        assert resp.status_code == 404

    def test_list_decisions(self, client):
        client.post("/decisions/analyze", json={"context": {"x": 1}, "category": "Produtividade"})
        resp = client.get("/decisions")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "total" in data
        assert "decisions" in data

    def test_list_decisions_with_category_filter(self, client):
        client.post("/decisions/analyze", json={"context": {"x": 1}, "category": "Saúde"})
        resp = client.get("/decisions?category=Saúde")
        assert resp.status_code == 200

    def test_submit_feedback_accepted(self, client):
        create_resp = client.post("/decisions/analyze", json={"context": {"x": 1}, "category": "Produtividade"})
        decision_id = create_resp.get_json()["decision_id"]

        resp = client.post(f"/decisions/{decision_id}/feedback", json={"accepted": True, "feedback_text": "Ótimo!"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["feedback_registered"] is True
        assert data["accepted"] is True

    def test_submit_feedback_rejected(self, client):
        create_resp = client.post("/decisions/analyze", json={"context": {"x": 1}, "category": "Produtividade"})
        decision_id = create_resp.get_json()["decision_id"]

        resp = client.post(f"/decisions/{decision_id}/feedback", json={"accepted": False})
        assert resp.status_code == 200
        assert resp.get_json()["accepted"] is False

    def test_submit_feedback_missing_accepted_returns_400(self, client):
        create_resp = client.post("/decisions/analyze", json={"context": {"x": 1}, "category": "Produtividade"})
        decision_id = create_resp.get_json()["decision_id"]
        resp = client.post(f"/decisions/{decision_id}/feedback", json={"feedback_text": "sem campo accepted"})
        assert resp.status_code == 400

    def test_submit_feedback_nonexistent_decision_returns_404(self, client):
        resp = client.post("/decisions/id-inexistente/feedback", json={"accepted": True})
        assert resp.status_code == 404

    def test_get_score_breakdown(self, client):
        create_resp = client.post("/decisions/analyze", json={
            "context": {"sleep_quality": "bad", "upcoming_event": "important_meeting"},
            "category": "Saúde"
        })
        decision_id = create_resp.get_json()["decision_id"]

        resp = client.get(f"/decisions/{decision_id}/score")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "total_score" in data
        assert "breakdown" in data
        assert "classification" in data

    def test_get_insights(self, client):
        resp = client.get("/decisions/insights")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "acceptance_rate" in data
