import pytest
import time
from life_orchestrator.models import Mission, MissionStep, OrchestrationEvent
from life_orchestrator.engines import OrchestratorRuntime

class TestLifeOrchestrator:
    def setup_method(self):
        self.orchestrator = OrchestratorRuntime()

    def test_create_and_orchestrate_mission(self):
        steps = [
            {"title": "Pesquisar casas", "description": "Ver portais imobiliários"},
            {"title": "Visitar casas", "description": "Agendar visitas", "dependencies": []}
        ]
        mission = self.orchestrator.create_and_orchestrate_mission(
            title="Comprar uma casa",
            objective="Adquirir a casa própria em 1 ano",
            priority=80,
            step_definitions=steps
        )
        
        assert mission.title == "Comprar uma casa"
        assert len(mission.steps) == 2
        assert mission.status == "active"
        assert mission.progress == 0.0

    def test_complete_step_updates_progress(self):
        steps = [{"title": "Passo 1"}, {"title": "Passo 2"}]
        mission = self.orchestrator.create_and_orchestrate_mission("Teste", "Obj", 50, steps)
        
        step_id = mission.steps[0].step_id
        self.orchestrator.complete_mission_step(mission.mission_id, step_id)
        
        assert mission.progress == 50.0
        assert mission.steps[0].status == "completed"

    def test_mission_completion(self):
        steps = [{"title": "Passo Único"}]
        mission = self.orchestrator.create_and_orchestrate_mission("Teste Fim", "Obj", 50, steps)
        
        self.orchestrator.complete_mission_step(mission.mission_id, mission.steps[0].step_id)
        
        assert mission.progress == 100.0
        assert mission.status == "completed"

    def test_dependency_blocking(self):
        # Passo 2 depende do Passo 1
        steps = [
            {"title": "Passo 1"},
            {"title": "Passo 2", "dependencies": []} # Será atualizado manualmente para simular dependência
        ]
        mission = self.orchestrator.create_and_orchestrate_mission("Dep Test", "Obj", 50, steps)
        
        # Adicionar dependência manualmente para o teste
        mission.steps[1].dependencies = [mission.steps[0].step_id]
        
        is_ready = self.orchestrator.dependency_engine.check_step_dependencies(mission.mission_id, mission.steps[1].step_id)
        assert is_ready is False
        
        # Completa o 1
        self.orchestrator.complete_mission_step(mission.mission_id, mission.steps[0].step_id)
        
        is_ready = self.orchestrator.dependency_engine.check_step_dependencies(mission.mission_id, mission.steps[1].step_id)
        assert is_ready is True

    def test_priority_calculation(self):
        mission = Mission(title="Família", objective="Visitar família", priority=50)
        # Mock DNA tem valor 'family'
        priority = self.orchestrator.priority_engine.calculate_mission_priority(mission)
        assert priority == 70 # 50 + 20 do DNA

    def test_conflict_resolution(self):
        m1 = self.orchestrator.mission_engine.create_mission("Trabalho", "Projeto carreira", 50)
        m2 = self.orchestrator.mission_engine.create_mission("Lazer", "Jogar videogame", 10)
        
        resolution = self.orchestrator.resolve_mission_conflict(m1.mission_id, m2.mission_id)
        
        assert resolution["winner_mission_id"] == m1.mission_id
        assert "prioridade mais alta" in resolution["explanation"][0]

    def test_event_processing_cascades(self):
        event = OrchestrationEvent(category="test_event", source="Test", data={"info": "test"})
        # Não deve quebrar
        self.orchestrator.process_event(event)
