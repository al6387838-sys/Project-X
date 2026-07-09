import time
from life_orchestrator.engines import OrchestratorRuntime
from typing import Any, Dict
from life_orchestrator.models import Mission, MissionStep, OrchestrationEvent

# Mock de PersonalDNA para o demo
class DemoPersonalDNA:
    def get_profile(self): 
        return {"values": {"family": True, "career_growth": True, "health": True}}
    def update_dna(self, learning_event: Any): pass

# Mock de ContextEngine para o demo
class DemoContextEngine:
    def __init__(self):
        self._context = {"time_of_day": "morning", "location": "home", "urgent_events": []}
    def get_current_context(self): return self._context
    def update_context(self, event_data: Dict[str, Any]):
        print(f"[DemoContextEngine] Contexto atualizado com: {event_data}")
        # Simula uma mudança de contexto
        if event_data.get("mission_title") == "Melhorar Saúde" and event_data.get("step_status") == "completed":
            if "dieta" in event_data.get("step_title", "").lower():
                self._context["urgent_events"].append({"related_missions": [event_data["mission_id"]], "type": "health_boost"})

# Mock de LifeCompanion para o demo
class DemoLifeCompanion:
    def send_notification(self, message: str, type: str = "info"):
        print(f"[Companion - {type.upper()}] {message}")
    def update_dashboard(self, data: Dict[str, Any]):
        print(f"[Companion - DASHBOARD] Atualizado com: {data}")

# Instanciar o OrchestratorRuntime com mocks para o demo
personal_dna_mock = DemoPersonalDNA()
context_engine_mock = DemoContextEngine()
life_companion_mock = DemoLifeCompanion()

orchestrator = OrchestratorRuntime(
    personal_dna=personal_dna_mock,
    context_engine=context_engine_mock,
    life_companion=life_companion_mock
)

print("\n--- DEMONSTRAÇÃO DO LIFE ORCHESTRATOR ---\n")

# --- Missão 1: Melhorar Saúde ---
print("### Criando Missão: Melhorar Saúde ###")
mission_saude_steps = [
    {"title": "Pesquisar dieta saudável", "description": "Encontrar planos alimentares balanceados", "assigned_engine": "ResearchEngine"},
    {"title": "Planejar refeições semanais", "description": "Criar cardápio e lista de compras", "dependencies": []},
    {"title": "Iniciar exercícios físicos", "description": "Começar caminhadas diárias", "dependencies": []},
    {"title": "Consultar nutricionista", "description": "Agendar consulta para plano personalizado", "dependencies": []}
]
mission_saude = orchestrator.create_and_orchestrate_mission(
    title="Melhorar Saúde",
    objective="Atingir peso ideal e aumentar energia em 3 meses",
    priority=90,
    step_definitions=mission_saude_steps
)
print(f"Missão '{mission_saude.title}' criada com ID: {mission_saude.mission_id}")
print(f"Status inicial: {mission_saude.status}, Progresso: {mission_saude.progress}%")

# --- Missão 2: Aprender Nova Habilidade ---
print("\n### Criando Missão: Aprender Nova Habilidade (Programação) ###")
mission_habilidade_steps = [
    {"title": "Escolher linguagem de programação", "description": "Pesquisar e decidir entre Python/JS", "assigned_engine": "ResearchEngine"},
    {"title": "Fazer curso introdutório", "description": "Completar curso online básico", "dependencies": []},
    {"title": "Desenvolver projeto simples", "description": "Aplicar conhecimentos em um projeto prático", "dependencies": []}
]
mission_habilidade = orchestrator.create_and_orchestrate_mission(
    title="Aprender Programação",
    objective="Dominar Python para automação em 6 meses",
    priority=70,
    step_definitions=mission_habilidade_steps
)
print(f"Missão '{mission_habilidade.title}' criada com ID: {mission_habilidade.mission_id}")
print(f"Status inicial: {mission_habilidade.status}, Progresso: {mission_habilidade.progress}%")

# --- Simulação de Progresso ---
print("\n### Simulando Progresso da Missão 'Melhorar Saúde' ###")

# Passo 1: Pesquisar dieta saudável
step_id_pesquisa_dieta = mission_saude.steps[0].step_id
orchestrator.complete_mission_step(mission_saude.mission_id, step_id_pesquisa_dieta)
print(f"Passo '{mission_saude.steps[0].title}' concluído. Progresso da missão: {mission_saude.progress}%")

# Passo 2: Planejar refeições semanais (depende do passo 1)
mission_saude.steps[1].dependencies = [step_id_pesquisa_dieta] # Adiciona dependência dinamicamente para o demo
step_id_planejar_refeicoes = mission_saude.steps[1].step_id
orchestrator.complete_mission_step(mission_saude.mission_id, step_id_planejar_refeicoes)
print(f"Passo '{mission_saude.steps[1].title}' concluído. Progresso da missão: {mission_saude.progress}%")

# Passo 3: Iniciar exercícios físicos
step_id_exercicios = mission_saude.steps[2].step_id
orchestrator.complete_mission_step(mission_saude.mission_id, step_id_exercicios)
print(f"Passo '{mission_saude.steps[2].title}' concluído. Progresso da missão: {mission_saude.progress}%")

# --- Conflito de Prioridade ---
print("\n### Resolvendo Conflito de Prioridade ###")
conflict_resolution = orchestrator.resolve_mission_conflict(mission_saude.mission_id, mission_habilidade.mission_id)
print(f"Resolução do conflito: {conflict_resolution}")

# --- Simulação de Progresso da Missão 'Aprender Programação' ---
print("\n### Simulando Progresso da Missão 'Aprender Programação' ###")
step_id_escolher_linguagem = mission_habilidade.steps[0].step_id
orchestrator.complete_mission_step(mission_habilidade.mission_id, step_id_escolher_linguagem)
print(f"Passo '{mission_habilidade.steps[0].title}' concluído. Progresso da missão: {mission_habilidade.progress}%")

# --- Conclusão da Missão 'Melhorar Saúde' ---
print("\n### Concluindo Missão 'Melhorar Saúde' ###")
step_id_nutricionista = mission_saude.steps[3].step_id
orchestrator.complete_mission_step(mission_saude.mission_id, step_id_nutricionista)
print(f"Passo '{mission_saude.steps[3].title}' concluído. Progresso da missão: {mission_saude.progress}%")
print(f"Status final da missão '{mission_saude.title}': {mission_saude.status}")

print("\n--- DEMONSTRAÇÃO CONCLUÍDA ---")

# Exemplo de como o Future Engine e Evolution Engine foram chamados
# O OrchestratorRuntime chama automaticamente simulate_future e process_new_data
print("\n--- Verificando interações com outros Engines (simuladas) ---")
print(f"Evolution Engine timeline snapshots: {len(orchestrator.evolution_engine.get_timeline().snapshots)}")
print(f"Future Engine simulou cenários durante o processo.")
print(f"Context Engine atualizado durante o processo.")
print(f"Personal DNA (mock) influenciou prioridades.")
print(f"Life Companion (mock) enviou notificações e atualizou dashboard.")
