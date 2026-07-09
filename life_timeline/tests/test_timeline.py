import pytest
import time
from life_timeline.models import TimelineEntry
from life_timeline.engines import TimelineEngine, TimelineIndex, LifeEventsEngine
from life_timeline.mappers import RelationshipMapper
from life_timeline.viewers import HistoryViewer

class TestLifeTimeline:

    @pytest.fixture
    def setup_timeline(self):
        engine = TimelineEngine()
        mapper = RelationshipMapper()
        events_engine = LifeEventsEngine()
        viewer = HistoryViewer(engine)
        return engine, mapper, events_engine, viewer

    def test_record_and_search(self, setup_timeline):
        engine, _, _, _ = setup_timeline
        engine.record_event("Projeto X Iniciado", "projects", impact=80)
        engine.record_event("Mudança de Emprego", "changes", impact=95)
        
        results = engine.search(category="projects")
        assert len(results) == 1
        assert results[0].title == "Projeto X Iniciado"

    def test_automatic_relationships(self, setup_timeline):
        engine, mapper, _, _ = setup_timeline
        
        e1 = engine.record_event("Reunião com Anderson", "events", context={"people": ["Anderson"]})
        e2 = engine.record_event("Jantar com Anderson", "events", context={"people": ["Anderson"]})
        
        all_entries = engine.search()
        mapper.auto_map_relationships(e2, [e1])
        
        assert e2.timeline_id in e1.relationships
        assert e1.timeline_id in e2.relationships

    def test_life_events_detection(self, setup_timeline):
        engine, _, events_engine, _ = setup_timeline
        
        engine.record_event("Promoção", "achievements", impact=90)
        engine.record_event("Mudança de Casa", "changes", impact=85)
        
        all_entries = engine.search()
        changes = events_engine.detect_major_change(all_entries)
        achievements = events_engine.get_achievements(all_entries)
        
        assert len(changes) == 2
        assert len(achievements) == 1

    def test_causality_chain(self, setup_timeline):
        engine, mapper, events_engine, _ = setup_timeline
        
        # Cria uma cadeia causal
        t1 = time.time()
        e1 = engine.record_event("Novo Emprego", "changes", impact=90, timestamp=t1)
        e2 = engine.record_event("Nova Rotina", "changes", impact=60, timestamp=t1 + 100)
        e3 = engine.record_event("Melhora na Saúde", "changes", impact=70, timestamp=t1 + 200)
        
        mapper.connect_entries(e1, e2)
        mapper.connect_entries(e2, e3)
        
        all_entries = engine.search()
        chains = events_engine.analyze_causality(all_entries)
        
        assert len(chains) >= 1
        assert "Novo Emprego" in chains[0]["chain"]
        assert "Melhora na Saúde" in chains[0]["chain"]

    def test_history_navigation(self, setup_timeline):
        engine, _, _, viewer = setup_timeline
        
        engine.record_event("Evento de Hoje", "events")
        
        today = viewer.get_today()
        assert len(today) >= 1
        assert today[0].title == "Evento de Hoje"

    def test_search_by_entity(self, setup_timeline):
        engine, _, _, viewer = setup_timeline
        
        engine.record_event("Viagem para Paris", "events", context={"location": "Paris"})
        engine.record_event("Viagem para Londres", "events", context={"location": "Londres"})
        
        results = viewer.search_by_entity("location", "Paris")
        assert len(results) == 1
        assert results[0].title == "Viagem para Paris"

    def test_timeline_engine_timestamp_coverage(self, setup_timeline):
        engine, _, _, _ = setup_timeline
        # Testar com timestamp fornecido
        entry_with_ts = engine.record_event("Evento com TS", "events", timestamp=12345.0)
        assert entry_with_ts.timestamp == 12345.0
        # Testar sem timestamp (deve usar time.time())
        entry_without_ts = engine.record_event("Evento sem TS", "events")
        assert entry_without_ts.timestamp is not None

    def test_timeline_engine_search_query_coverage(self, setup_timeline):
        engine, _, _, _ = setup_timeline
        engine.record_event("Título Único", "events", description="Descrição Única")
        engine.record_event("Outro Título", "events", description="Outra Descrição")

        results_title = engine.search(query="Único")
        assert len(results_title) == 1
        assert results_title[0].title == "Título Único"

        results_desc = engine.search(query="Outra")
        assert len(results_desc) == 1
        assert results_desc[0].title == "Outro Título"

        results_both = engine.search(query="título")
        assert len(results_both) == 2

    def test_relationship_mapper_project_location_coverage(self, setup_timeline):
        engine, mapper, _, _ = setup_timeline

        e_proj1 = engine.record_event("Projeto Alpha", "projects", context={"project": "Alpha"})
        e_proj2 = engine.record_event("Tarefa Alpha", "tasks", context={"project": "Alpha"})
        mapper.auto_map_relationships(e_proj2, [e_proj1])
        assert e_proj1.timeline_id in e_proj2.relationships
        assert e_proj2.timeline_id in e_proj1.relationships

        e_loc1 = engine.record_event("Viagem para SP", "events", context={"location": "São Paulo"})
        e_loc2 = engine.record_event("Reunião em SP", "events", context={"location": "São Paulo"})
        mapper.auto_map_relationships(e_loc2, [e_loc1])
        assert e_loc1.timeline_id in e_loc2.relationships
        assert e_loc2.timeline_id in e_loc1.relationships

    def test_relationship_mapper_get_relationship_graph_coverage(self, setup_timeline):
        engine, mapper, _, _ = setup_timeline
        e1 = engine.record_event("Evento A", "events")
        e2 = engine.record_event("Evento B", "events")
        e3 = engine.record_event("Evento C", "events")

        mapper.connect_entries(e1, e2)
        mapper.connect_entries(e1, e3)

        all_entries_dict = {e.timeline_id: e for e in [e1, e2, e3]}
        graph = mapper.get_relationship_graph(e1, all_entries_dict)

        assert len(graph) == 2
        assert any(item["title"] == "Evento B" for item in graph)
        assert any(item["title"] == "Evento C" for item in graph)

    def test_timeline_entry_methods(self):
        entry = TimelineEntry(title="Teste", category="general", description="Descrição")
        assert entry.to_dict()["title"] == "Teste"
        assert "[GENERAL] Teste" in str(entry)

    def test_history_viewer_time_navigation_coverage(self, setup_timeline):
        engine, _, _, viewer = setup_timeline
        # Clear existing entries for precise time-based testing
        engine.index = TimelineIndex()

        now = time.time()
        # Eventos para hoje
        engine.record_event("Evento Hoje", "events", timestamp=now - 3600) # 1 hour ago
        # Eventos para semana
        engine.record_event("Evento Semana Passada", "events", timestamp=now - (7 * 24 * 3600) + 3600)
        # Eventos para mês
        engine.record_event("Evento Mês Passado", "events", timestamp=now - (30 * 24 * 3600) + 3600)
        # Eventos para ano
        engine.record_event("Evento Ano Passado", "events", timestamp=now - (365 * 24 * 3600) + 3600)

        today_events = viewer.get_today()
        assert any(e.title == "Evento Hoje" for e in today_events)

        week_events = viewer.get_this_week()
        assert any(e.title == "Evento Semana Passada" for e in week_events)

        month_events = viewer.get_this_month()
        assert any(e.title == "Evento Mês Passado" for e in month_events)

        year_events = viewer.get_this_year()
        assert any(e.title == "Evento Ano Passado" for e in year_events)

    def test_history_viewer_life_milestones_coverage(self, setup_timeline):
        engine, _, _, viewer = setup_timeline
        engine.record_event("Marco Importante", "achievements", impact=95)
        engine.record_event("Evento Menor", "events", impact=50)

        milestones = viewer.get_life_milestones()
        assert len(milestones) == 1
        assert milestones[0].title == "Marco Importante"

    def test_timeline_engine_get_entry_coverage(self, setup_timeline):
        engine, _, _, _ = setup_timeline
        entry = engine.record_event("Teste Get Entry", "test")
        retrieved_entry = engine.get_entry(entry.timeline_id)
        assert retrieved_entry.title == "Teste Get Entry"
        assert engine.get_entry("non-existent-id") is None

    def test_history_viewer_get_life_milestones_no_milestones(self, setup_timeline):
        engine, _, _, viewer = setup_timeline
        engine.index = TimelineIndex() # Clear existing entries
        engine.record_event("Evento Normal", "events", impact=10)
        milestones = viewer.get_life_milestones()
        assert len(milestones) == 0

    def test_history_viewer_search_by_entity_list_coverage(self, setup_timeline):
        engine, _, _, viewer = setup_timeline
        engine.index = TimelineIndex() # Clear existing entries
        engine.record_event("Evento com Multiplas Pessoas", "events", context={"people": ["Alice", "Bob"]})
        engine.record_event("Evento com Uma Pessoa", "events", context={"people": "Alice"})

        results_list = viewer.search_by_entity("people", "Bob")
        assert len(results_list) == 1
        assert results_list[0].title == "Evento com Multiplas Pessoas"

        results_single = viewer.search_by_entity("people", "Alice")
        assert len(results_single) == 2
        assert any(e.title == "Evento com Multiplas Pessoas" for e in results_single)
        assert any(e.title == "Evento com Uma Pessoa" for e in results_single)
