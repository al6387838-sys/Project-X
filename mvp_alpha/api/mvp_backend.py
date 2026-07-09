"""
LifeOS MVP Alpha Backend
========================
SPRINT 018 - MVP Alpha Experience
Servidor Flask que integra todos os módulos do LifeOS em um fluxo completo.
"""

import sys
import os
import json
import uuid
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Adiciona o diretório raiz do projeto ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

app = Flask(__name__, static_folder='../static', template_folder='../templates')
CORS(app)

# ============================================================
# ARMAZENAMENTO EM MEMÓRIA (MVP Alpha - sem banco de dados)
# ============================================================

USERS_DB = {}
SESSIONS_DB = {}
METRICS_DB = {}
FEEDBACK_DB = []
ERRORS_DB = []

# ============================================================
# DADOS SIMULADOS DO LIFEOS
# ============================================================

SAMPLE_DATA_SOURCES = [
    {"id": "google_calendar", "name": "Google Calendar", "icon": "📅", "category": "agenda", "connected": False},
    {"id": "gmail", "name": "Gmail", "icon": "📧", "category": "comunicacao", "connected": False},
    {"id": "spotify", "name": "Spotify", "icon": "🎵", "category": "entretenimento", "connected": False},
    {"id": "apple_health", "name": "Apple Health", "icon": "❤️", "category": "saude", "connected": False},
    {"id": "notion", "name": "Notion", "icon": "📝", "category": "produtividade", "connected": False},
    {"id": "nubank", "name": "Nubank", "icon": "💜", "category": "financas", "connected": False},
    {"id": "whatsapp", "name": "WhatsApp", "icon": "💬", "category": "comunicacao", "connected": False},
    {"id": "instagram", "name": "Instagram", "icon": "📸", "category": "social", "connected": False},
]

LIFE_AREAS = [
    {"id": "saude", "name": "Saúde & Bem-estar", "icon": "💪", "color": "#10B981"},
    {"id": "carreira", "name": "Carreira & Negócios", "icon": "🚀", "color": "#3B82F6"},
    {"id": "relacionamentos", "name": "Relacionamentos", "icon": "❤️", "color": "#EF4444"},
    {"id": "financas", "name": "Finanças", "icon": "💰", "color": "#F59E0B"},
    {"id": "aprendizado", "name": "Aprendizado", "icon": "📚", "color": "#8B5CF6"},
    {"id": "lazer", "name": "Lazer & Criatividade", "icon": "🎨", "color": "#EC4899"},
]

VALUES_OPTIONS = [
    "Família", "Liberdade", "Crescimento", "Impacto", "Saúde",
    "Criatividade", "Conhecimento", "Segurança", "Aventura", "Conexão"
]

# ============================================================
# HELPERS
# ============================================================

def get_user(user_id):
    return USERS_DB.get(user_id)

def track_metric(user_id, event, data=None):
    if user_id not in METRICS_DB:
        METRICS_DB[user_id] = {
            "session_start": time.time(),
            "events": [],
            "actions_completed": 0,
            "companion_interactions": 0,
            "onboarding_start": None,
            "first_value_time": None,
        }
    
    METRICS_DB[user_id]["events"].append({
        "event": event,
        "timestamp": time.time(),
        "data": data or {}
    })
    
    if event == "onboarding_start":
        METRICS_DB[user_id]["onboarding_start"] = time.time()
    elif event == "first_value":
        METRICS_DB[user_id]["first_value_time"] = time.time()
    elif event == "action_completed":
        METRICS_DB[user_id]["actions_completed"] += 1
    elif event == "companion_interaction":
        METRICS_DB[user_id]["companion_interactions"] += 1

def track_error(user_id, step, error_msg):
    ERRORS_DB.append({
        "user_id": user_id,
        "step": step,
        "error": error_msg,
        "timestamp": datetime.now().isoformat()
    })

# ============================================================
# ROTAS - AUTENTICAÇÃO E SESSÃO
# ============================================================

@app.route('/api/session/create', methods=['POST'])
def create_session():
    """Cria uma nova sessão de usuário para o MVP Alpha."""
    data = request.json or {}
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    USERS_DB[user_id] = {
        "user_id": user_id,
        "created_at": datetime.now().isoformat(),
        "onboarding_completed": False,
        "onboarding_step": 0,
        "profile": None,
        "data_sources": [],
        "life_graph": None,
        "missions": [],
        "morning_briefing_generated": False,
        "companion_messages": [],
        "dashboard_viewed": False,
    }
    
    SESSIONS_DB[session_id] = user_id
    track_metric(user_id, "session_created")
    
    return jsonify({
        "success": True,
        "user_id": user_id,
        "session_id": session_id,
        "message": "Sessão criada com sucesso"
    })

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session(session_id):
    """Recupera dados da sessão."""
    user_id = SESSIONS_DB.get(session_id)
    if not user_id:
        return jsonify({"success": False, "error": "Sessão não encontrada"}), 404
    
    user = get_user(user_id)
    return jsonify({"success": True, "user": user, "user_id": user_id})

# ============================================================
# ROTAS - ONBOARDING
# ============================================================

@app.route('/api/onboarding/start', methods=['POST'])
def start_onboarding():
    """Inicia o fluxo de onboarding."""
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    track_metric(user_id, "onboarding_start")
    USERS_DB[user_id]["onboarding_step"] = 1
    
    steps = [
        {
            "step": 1,
            "id": "welcome",
            "title": "Bem-vindo ao LifeOS",
            "subtitle": "Seu copiloto de vida pessoal",
            "description": "O LifeOS aprende com você para otimizar sua rotina, alcançar seus objetivos e simplificar suas decisões mais importantes.",
            "cta": "Começar Jornada",
            "type": "welcome"
        },
        {
            "step": 2,
            "id": "how_it_works",
            "title": "Como o LifeOS Funciona",
            "subtitle": "Inteligência a serviço da sua vida",
            "description": "Integramos seus dados de vida — agenda, saúde, finanças, relacionamentos — para entender seus padrões, prever o futuro e sugerir as melhores ações. Tudo de forma privada e segura.",
            "features": [
                {"icon": "🧠", "title": "Aprende com você", "desc": "Evolui continuamente"},
                {"icon": "🔮", "title": "Antecipa o futuro", "desc": "Detecta riscos e oportunidades"},
                {"icon": "⚡", "title": "Age por você", "desc": "Automatiza decisões simples"},
                {"icon": "🔒", "title": "100% privado", "desc": "Seus dados, seu controle"}
            ],
            "cta": "Entendi",
            "type": "features"
        },
        {
            "step": 3,
            "id": "life_profile",
            "title": "Criando seu Life Profile",
            "subtitle": "Nos conte sobre você",
            "description": "Seu Life Profile é o DNA do LifeOS. Quanto mais você compartilhar, mais preciso e útil ele será.",
            "cta": "Criar meu Perfil",
            "type": "profile_intro"
        },
        {
            "step": 4,
            "id": "data_sources",
            "title": "Conectando suas Fontes",
            "subtitle": "Onde sua vida acontece",
            "description": "Conecte as ferramentas que você já usa. O LifeOS integra tudo em uma visão unificada.",
            "cta": "Conectar Fontes",
            "type": "data_sources"
        },
        {
            "step": 5,
            "id": "ready",
            "title": "Tudo Pronto!",
            "subtitle": "Seu LifeOS está ativo",
            "description": "Seu Life Graph foi criado, seu Morning Briefing está pronto e seu Companion está esperando por você.",
            "cta": "Entrar no LifeOS",
            "type": "ready"
        }
    ]
    
    return jsonify({
        "success": True,
        "steps": steps,
        "total_steps": len(steps),
        "current_step": 1
    })

@app.route('/api/onboarding/step', methods=['POST'])
def update_onboarding_step():
    """Atualiza o passo atual do onboarding."""
    data = request.json or {}
    user_id = data.get('user_id')
    step = data.get('step', 1)
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    USERS_DB[user_id]["onboarding_step"] = step
    track_metric(user_id, f"onboarding_step_{step}")
    
    return jsonify({"success": True, "step": step})

@app.route('/api/onboarding/complete', methods=['POST'])
def complete_onboarding():
    """Marca o onboarding como completo."""
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    USERS_DB[user_id]["onboarding_completed"] = True
    
    # Calcula tempo de onboarding
    if user_id in METRICS_DB and METRICS_DB[user_id]["onboarding_start"]:
        onboarding_time = time.time() - METRICS_DB[user_id]["onboarding_start"]
        METRICS_DB[user_id]["onboarding_duration_seconds"] = onboarding_time
    
    track_metric(user_id, "onboarding_completed")
    track_metric(user_id, "action_completed", {"action": "onboarding"})
    
    return jsonify({
        "success": True,
        "message": "Onboarding concluído!",
        "next_step": "life_profile"
    })

# ============================================================
# ROTAS - LIFE PROFILE
# ============================================================

@app.route('/api/profile/create', methods=['POST'])
def create_profile():
    """Cria o Life Profile do usuário."""
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    profile = {
        "name": data.get('name', ''),
        "age": data.get('age', ''),
        "occupation": data.get('occupation', ''),
        "location": data.get('location', ''),
        "values": data.get('values', []),
        "life_areas": data.get('life_areas', {}),
        "goals": data.get('goals', []),
        "challenges": data.get('challenges', []),
        "wake_time": data.get('wake_time', '07:00'),
        "sleep_time": data.get('sleep_time', '23:00'),
        "created_at": datetime.now().isoformat()
    }
    
    USERS_DB[user_id]["profile"] = profile
    track_metric(user_id, "profile_created", {"name": profile["name"]})
    track_metric(user_id, "action_completed", {"action": "profile_created"})
    
    return jsonify({
        "success": True,
        "profile": profile,
        "message": f"Life Profile de {profile['name']} criado com sucesso!"
    })

@app.route('/api/profile/<user_id>', methods=['GET'])
def get_profile(user_id):
    """Retorna o Life Profile do usuário."""
    user = get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    return jsonify({"success": True, "profile": user.get("profile")})

# ============================================================
# ROTAS - DATA SOURCES
# ============================================================

@app.route('/api/datasources/list', methods=['GET'])
def list_data_sources():
    """Lista todas as fontes de dados disponíveis."""
    return jsonify({
        "success": True,
        "sources": SAMPLE_DATA_SOURCES
    })

@app.route('/api/datasources/connect', methods=['POST'])
def connect_data_source():
    """Conecta uma fonte de dados."""
    data = request.json or {}
    user_id = data.get('user_id')
    source_id = data.get('source_id')
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    # Simula conexão com delay
    source = next((s for s in SAMPLE_DATA_SOURCES if s["id"] == source_id), None)
    if not source:
        return jsonify({"success": False, "error": "Fonte não encontrada"}), 404
    
    connected_sources = USERS_DB[user_id].get("data_sources", [])
    if source_id not in [s["id"] for s in connected_sources]:
        connected_sources.append({
            "id": source_id,
            "name": source["name"],
            "icon": source["icon"],
            "connected_at": datetime.now().isoformat(),
            "status": "active"
        })
        USERS_DB[user_id]["data_sources"] = connected_sources
    
    track_metric(user_id, "data_source_connected", {"source": source_id})
    track_metric(user_id, "action_completed", {"action": f"connected_{source_id}"})
    
    return jsonify({
        "success": True,
        "source": source,
        "message": f"{source['name']} conectado com sucesso!",
        "connected_count": len(connected_sources)
    })

@app.route('/api/datasources/user/<user_id>', methods=['GET'])
def get_user_data_sources(user_id):
    """Retorna fontes de dados conectadas pelo usuário."""
    user = get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    return jsonify({
        "success": True,
        "connected": user.get("data_sources", []),
        "count": len(user.get("data_sources", []))
    })

# ============================================================
# ROTAS - LIFE GRAPH
# ============================================================

@app.route('/api/lifegraph/generate', methods=['POST'])
def generate_life_graph():
    """Gera o primeiro Life Graph do usuário."""
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    user = USERS_DB[user_id]
    profile = user.get("profile", {})
    sources = user.get("data_sources", [])
    
    # Gera Life Graph baseado no perfil e fontes conectadas
    name = profile.get("name", "Usuário") if profile else "Usuário"
    values = profile.get("values", []) if profile else []
    goals = profile.get("goals", []) if profile else []
    
    nodes = [
        {"id": "user", "label": name, "type": "user", "size": 40, "color": "#6366F1"},
    ]
    
    edges = []
    
    # Adiciona nós de valores
    for i, value in enumerate(values[:5]):
        node_id = f"value_{i}"
        nodes.append({"id": node_id, "label": value, "type": "value", "size": 20, "color": "#10B981"})
        edges.append({"from": "user", "to": node_id, "label": "valoriza"})
    
    # Adiciona nós de objetivos
    for i, goal in enumerate(goals[:3]):
        node_id = f"goal_{i}"
        nodes.append({"id": node_id, "label": goal[:30] + "..." if len(goal) > 30 else goal, "type": "goal", "size": 25, "color": "#F59E0B"})
        edges.append({"from": "user", "to": node_id, "label": "busca"})
    
    # Adiciona nós de fontes de dados
    for source in sources[:4]:
        node_id = f"source_{source['id']}"
        nodes.append({"id": node_id, "label": source["name"], "type": "datasource", "size": 15, "color": "#8B5CF6"})
        edges.append({"from": "user", "to": node_id, "label": "conectado"})
    
    # Adiciona áreas de vida
    life_areas_data = profile.get("life_areas", {}) if profile else {}
    for area_id, score in list(life_areas_data.items())[:4]:
        area = next((a for a in LIFE_AREAS if a["id"] == area_id), None)
        if area:
            node_id = f"area_{area_id}"
            nodes.append({"id": node_id, "label": area["name"], "type": "life_area", "size": int(score/5) + 10, "color": area["color"]})
            edges.append({"from": "user", "to": node_id, "label": f"{score}/10"})
    
    life_graph = {
        "generated_at": datetime.now().isoformat(),
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "total_connections": len(edges),
            "data_sources": len(sources),
            "values_mapped": len(values),
            "goals_tracked": len(goals)
        },
        "insights": [
            f"Seu Life Graph possui {len(nodes)} nós e {len(edges)} conexões",
            f"{len(sources)} fontes de dados integradas",
            f"Seus principais valores: {', '.join(values[:3]) if values else 'a definir'}",
            "O LifeOS continuará aprendendo e expandindo seu grafo"
        ]
    }
    
    USERS_DB[user_id]["life_graph"] = life_graph
    track_metric(user_id, "life_graph_generated")
    track_metric(user_id, "action_completed", {"action": "life_graph_generated"})
    track_metric(user_id, "first_value")  # Primeiro valor percebido!
    
    return jsonify({
        "success": True,
        "life_graph": life_graph,
        "message": "Seu Life Graph foi gerado com sucesso!"
    })

@app.route('/api/lifegraph/<user_id>', methods=['GET'])
def get_life_graph(user_id):
    """Retorna o Life Graph do usuário."""
    user = get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    return jsonify({"success": True, "life_graph": user.get("life_graph")})

# ============================================================
# ROTAS - MORNING BRIEFING
# ============================================================

@app.route('/api/briefing/generate', methods=['POST'])
def generate_morning_briefing():
    """Gera o primeiro Morning Briefing personalizado."""
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    user = USERS_DB[user_id]
    profile = user.get("profile", {})
    name = profile.get("name", "Usuário") if profile else "Usuário"
    
    now = datetime.now()
    hour = now.hour
    
    if hour < 12:
        greeting = f"Bom dia, {name}! ☀️"
        period = "manhã"
    elif hour < 18:
        greeting = f"Boa tarde, {name}! 🌤️"
        period = "tarde"
    else:
        greeting = f"Boa noite, {name}! 🌙"
        period = "noite"
    
    sources = user.get("data_sources", [])
    goals = profile.get("goals", []) if profile else []
    values = profile.get("values", []) if profile else []
    
    briefing = {
        "generated_at": now.isoformat(),
        "greeting": greeting,
        "date": now.strftime("%A, %d de %B de %Y"),
        "summary": f"Este é seu primeiro Morning Briefing. O LifeOS analisou seu perfil e está pronto para te ajudar a ter um {period} produtivo.",
        "energy_score": 78,
        "focus_score": 85,
        "weather": "☀️ 24°C — Dia ensolarado, ideal para produtividade",
        "top_priority": goals[0] if goals else "Definir seus primeiros objetivos no LifeOS",
        "agenda": [
            {"time": "09:00", "event": "Morning Focus Session", "type": "work", "priority": "high"},
            {"time": "12:00", "event": "Pausa para almoço", "type": "health", "priority": "medium"},
            {"time": "15:00", "event": "Revisão de progresso", "type": "review", "priority": "medium"},
            {"time": "18:00", "event": "Tempo pessoal", "type": "personal", "priority": "low"},
        ],
        "insights": [
            {
                "type": "opportunity",
                "icon": "🚀",
                "title": "Momento ideal para foco",
                "description": "Seu padrão de energia sugere alta produtividade nas próximas 3 horas."
            },
            {
                "type": "reminder",
                "icon": "💡",
                "title": "Primeiro passo",
                "description": f"Você tem {len(sources)} fonte(s) de dados conectada(s). Quanto mais você conectar, mais preciso o LifeOS será."
            },
            {
                "type": "growth",
                "icon": "📈",
                "title": "Seu Life Graph está crescendo",
                "description": f"Já mapeamos {len(values)} valores e {len(goals)} objetivos seus."
            }
        ],
        "daily_quote": "A jornada de mil milhas começa com um único passo. — Lao Tzu",
        "companion_message": f"Olá, {name}! Sou seu Companion. Estou aqui para te ajudar a navegar pelo dia. O que você quer conquistar hoje?",
        "data_sources_active": len(sources)
    }
    
    USERS_DB[user_id]["morning_briefing"] = briefing
    USERS_DB[user_id]["morning_briefing_generated"] = True
    track_metric(user_id, "morning_briefing_generated")
    track_metric(user_id, "action_completed", {"action": "morning_briefing_generated"})
    
    return jsonify({
        "success": True,
        "briefing": briefing,
        "message": "Seu Morning Briefing foi gerado!"
    })

@app.route('/api/briefing/<user_id>', methods=['GET'])
def get_briefing(user_id):
    """Retorna o Morning Briefing do usuário."""
    user = get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    return jsonify({"success": True, "briefing": user.get("morning_briefing")})

# ============================================================
# ROTAS - COMPANION (IA)
# ============================================================

@app.route('/api/companion/chat', methods=['POST'])
def companion_chat():
    """Processa mensagem para o Companion."""
    data = request.json or {}
    user_id = data.get('user_id')
    message = data.get('message', '')
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    user = USERS_DB[user_id]
    profile = user.get("profile", {})
    name = profile.get("name", "você") if profile else "você"
    
    # Histórico de mensagens
    history = user.get("companion_messages", [])
    
    # Adiciona mensagem do usuário
    user_msg = {
        "role": "user",
        "content": message,
        "timestamp": datetime.now().isoformat()
    }
    history.append(user_msg)
    
    # Gera resposta contextual do Companion
    response = generate_companion_response(message, name, user, len(history))
    
    companion_msg = {
        "role": "companion",
        "content": response,
        "timestamp": datetime.now().isoformat()
    }
    history.append(companion_msg)
    
    USERS_DB[user_id]["companion_messages"] = history
    track_metric(user_id, "companion_interaction", {"message_count": len(history)})
    
    return jsonify({
        "success": True,
        "response": response,
        "message_count": len(history),
        "history": history[-10:]  # Últimas 10 mensagens
    })

def generate_companion_response(message, name, user, msg_count):
    """Gera resposta contextual do Companion baseada no estado do usuário."""
    message_lower = message.lower()
    profile = user.get("profile", {})
    goals = profile.get("goals", []) if profile else []
    missions = user.get("missions", [])
    
    # Respostas contextuais baseadas em palavras-chave
    if any(word in message_lower for word in ["olá", "oi", "hello", "hey"]):
        return f"Olá, {name}! 👋 É ótimo ter você aqui. Estou analisando seu perfil e já tenho algumas sugestões para você. Como posso te ajudar hoje?"
    
    elif any(word in message_lower for word in ["missão", "objetivo", "meta", "goal"]):
        if goals:
            return f"Seus objetivos estão mapeados no seu Life Graph! 🎯 Vejo que você quer: {goals[0]}. Quer criar uma Missão estruturada para alcançar isso? Posso dividir em etapas menores e acompanhar seu progresso."
        return f"Criar missões é uma das formas mais poderosas de usar o LifeOS! 🎯 Uma missão é um objetivo estruturado com etapas claras e acompanhamento de progresso. Qual é o seu principal objetivo agora?"
    
    elif any(word in message_lower for word in ["produtividade", "foco", "trabalho", "tarefa"]):
        return f"Para maximizar sua produtividade, {name}, o LifeOS analisa seus padrões de energia e sugere os melhores momentos para tarefas que exigem foco. 🧠 Seu pico de energia costuma ser pela manhã. Quer que eu bloqueie esse tempo no seu calendário?"
    
    elif any(word in message_lower for word in ["saúde", "exercício", "dormir", "descanso"]):
        return f"Saúde é a base de tudo! 💪 O LifeOS monitora seus padrões de sono, atividade e bem-estar. Conecte o Apple Health ou Google Fit para eu ter uma visão completa e te dar recomendações personalizadas."
    
    elif any(word in message_lower for word in ["finanças", "dinheiro", "gasto", "investimento"]):
        return f"Gestão financeira inteligente! 💰 Quando você conectar o Nubank ou outro app financeiro, poderei analisar seus padrões de gasto, identificar oportunidades de economia e alinhar suas finanças com seus objetivos de vida."
    
    elif any(word in message_lower for word in ["briefing", "dia", "agenda", "hoje"]):
        return f"Seu Morning Briefing está pronto! ☀️ Analisei sua agenda e identifiquei os momentos ideais para suas atividades. Quer que eu te mostre as prioridades do dia ou prefere um resumo do que está por vir?"
    
    elif any(word in message_lower for word in ["ajuda", "como", "o que", "explica"]):
        return f"Claro, {name}! 🤝 O LifeOS é seu copiloto de vida. Posso te ajudar a:\n\n• 🎯 Criar e acompanhar Missões\n• 📊 Analisar padrões e tendências\n• ⚡ Sugerir ações prioritárias\n• 🔮 Antecipar riscos e oportunidades\n• 📅 Otimizar sua agenda\n\nO que você quer explorar primeiro?"
    
    elif any(word in message_lower for word in ["obrigado", "obrigada", "valeu", "thanks"]):
        return f"Fico feliz em ajudar, {name}! 😊 Estou aqui sempre que precisar. Quanto mais você interagir comigo, mais eu aprendo sobre você e mais preciso fico. Há mais alguma coisa que posso fazer por você?"
    
    elif any(word in message_lower for word in ["dashboard", "painel", "visão geral"]):
        return f"Seu Dashboard Inteligente mostra uma visão completa da sua vida! 📊 Lá você encontra seu Morning Briefing, missões ativas, métricas de bem-estar e muito mais. Tudo atualizado em tempo real com base nos seus dados conectados."
    
    elif msg_count <= 2:
        return f"Ótima pergunta, {name}! 🌟 Estou aqui para ser seu parceiro inteligente. Posso analisar padrões na sua vida, sugerir ações, criar missões e te ajudar a tomar melhores decisões. O que está em sua mente agora?"
    
    else:
        responses = [
            f"Entendo, {name}. Baseado no seu perfil, posso ver que isso é importante para você. Vamos trabalhar juntos nisso! 💪",
            f"Interessante perspectiva! O LifeOS está aprendendo com cada interação. Quanto mais você compartilha, mais personalizado fico. 🧠",
            f"Boa observação! Isso se conecta com seus objetivos de {goals[0] if goals else 'crescimento pessoal'}. Quer explorar mais? 🎯",
            f"Estou processando isso com base no seu Life Graph. Vejo conexões interessantes com seus valores e objetivos. 🔗",
        ]
        import random
        return random.choice(responses)

@app.route('/api/companion/history/<user_id>', methods=['GET'])
def get_companion_history(user_id):
    """Retorna histórico de conversas com o Companion."""
    user = get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    return jsonify({
        "success": True,
        "history": user.get("companion_messages", []),
        "count": len(user.get("companion_messages", []))
    })

# ============================================================
# ROTAS - MISSÕES
# ============================================================

@app.route('/api/missions/create', methods=['POST'])
def create_mission():
    """Cria uma nova missão."""
    data = request.json or {}
    user_id = data.get('user_id')
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    mission_id = str(uuid.uuid4())[:8]
    
    mission = {
        "id": mission_id,
        "title": data.get('title', 'Nova Missão'),
        "objective": data.get('objective', ''),
        "category": data.get('category', 'pessoal'),
        "priority": data.get('priority', 'medium'),
        "deadline": data.get('deadline', ''),
        "status": "active",
        "progress": 0,
        "steps": data.get('steps', []),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "ai_suggestions": generate_mission_suggestions(data.get('title', ''), data.get('objective', ''))
    }
    
    missions = USERS_DB[user_id].get("missions", [])
    missions.append(mission)
    USERS_DB[user_id]["missions"] = missions
    
    track_metric(user_id, "mission_created", {"mission_id": mission_id, "title": mission["title"]})
    track_metric(user_id, "action_completed", {"action": "mission_created"})
    
    return jsonify({
        "success": True,
        "mission": mission,
        "message": f"Missão '{mission['title']}' criada com sucesso!"
    })

def generate_mission_suggestions(title, objective):
    """Gera sugestões de IA para a missão."""
    return {
        "estimated_duration": "4-6 semanas",
        "suggested_steps": [
            "Definir métricas de sucesso claras",
            "Identificar recursos necessários",
            "Criar cronograma de execução",
            "Estabelecer checkpoints semanais",
            "Revisar e ajustar conforme necessário"
        ],
        "potential_blockers": [
            "Falta de tempo dedicado",
            "Dependências externas",
            "Mudança de prioridades"
        ],
        "success_probability": 78,
        "tips": "Missões com etapas claras têm 3x mais chance de sucesso. Considere dividir em micro-tarefas diárias."
    }

@app.route('/api/missions/user/<user_id>', methods=['GET'])
def get_user_missions(user_id):
    """Retorna missões do usuário."""
    user = get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    return jsonify({
        "success": True,
        "missions": user.get("missions", []),
        "count": len(user.get("missions", []))
    })

@app.route('/api/missions/<mission_id>/progress', methods=['POST'])
def update_mission_progress(mission_id):
    """Atualiza progresso de uma missão."""
    data = request.json or {}
    user_id = data.get('user_id')
    progress = data.get('progress', 0)
    
    if not user_id or user_id not in USERS_DB:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    missions = USERS_DB[user_id].get("missions", [])
    for mission in missions:
        if mission["id"] == mission_id:
            mission["progress"] = progress
            mission["updated_at"] = datetime.now().isoformat()
            if progress >= 100:
                mission["status"] = "completed"
            break
    
    USERS_DB[user_id]["missions"] = missions
    track_metric(user_id, "mission_progress_updated", {"mission_id": mission_id, "progress": progress})
    
    return jsonify({"success": True, "message": "Progresso atualizado!"})

# ============================================================
# ROTAS - DASHBOARD
# ============================================================

@app.route('/api/dashboard/<user_id>', methods=['GET'])
def get_dashboard(user_id):
    """Retorna dados completos do Dashboard Inteligente."""
    user = get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "Usuário não encontrado"}), 404
    
    profile = user.get("profile", {})
    name = profile.get("name", "Usuário") if profile else "Usuário"
    missions = user.get("missions", [])
    sources = user.get("data_sources", [])
    life_graph = user.get("life_graph", {})
    briefing = user.get("morning_briefing", {})
    companion_msgs = user.get("companion_messages", [])
    
    # Calcula métricas do dashboard
    active_missions = [m for m in missions if m["status"] == "active"]
    completed_missions = [m for m in missions if m["status"] == "completed"]
    avg_progress = sum(m["progress"] for m in active_missions) / len(active_missions) if active_missions else 0
    
    # Score de vida (calculado com base nos dados disponíveis)
    life_score = calculate_life_score(user)
    
    dashboard = {
        "user_name": name,
        "generated_at": datetime.now().isoformat(),
        "life_score": life_score,
        "widgets": {
            "morning_briefing": briefing,
            "missions_summary": {
                "active": len(active_missions),
                "completed": len(completed_missions),
                "avg_progress": round(avg_progress, 1),
                "missions": active_missions[:3]
            },
            "life_graph_summary": {
                "nodes": len(life_graph.get("nodes", [])) if life_graph else 0,
                "connections": len(life_graph.get("edges", [])) if life_graph else 0,
                "insights": life_graph.get("insights", []) if life_graph else []
            },
            "data_sources": {
                "connected": len(sources),
                "sources": sources[:4]
            },
            "companion_summary": {
                "total_interactions": len(companion_msgs),
                "last_message": companion_msgs[-1]["content"][:100] + "..." if companion_msgs else None
            },
            "quick_actions": [
                {"id": "new_mission", "label": "Nova Missão", "icon": "🎯"},
                {"id": "chat_companion", "label": "Falar com Companion", "icon": "🤖"},
                {"id": "view_graph", "label": "Ver Life Graph", "icon": "🕸️"},
                {"id": "add_source", "label": "Conectar Fonte", "icon": "🔗"},
            ]
        },
        "notifications": generate_notifications(user),
        "today_focus": profile.get("goals", ["Explorar o LifeOS"])[0] if profile and profile.get("goals") else "Explorar o LifeOS"
    }
    
    USERS_DB[user_id]["dashboard_viewed"] = True
    track_metric(user_id, "dashboard_viewed")
    track_metric(user_id, "action_completed", {"action": "dashboard_viewed"})
    
    return jsonify({"success": True, "dashboard": dashboard})

def calculate_life_score(user):
    """Calcula o Life Score do usuário baseado nos dados disponíveis."""
    score = 0
    max_score = 100
    
    if user.get("profile"):
        score += 20
        profile = user["profile"]
        if profile.get("values"):
            score += 10
        if profile.get("goals"):
            score += 10
    
    sources = user.get("data_sources", [])
    score += min(len(sources) * 5, 20)
    
    if user.get("life_graph"):
        score += 15
    
    if user.get("morning_briefing_generated"):
        score += 10
    
    missions = user.get("missions", [])
    score += min(len(missions) * 5, 15)
    
    return min(score, max_score)

def generate_notifications(user):
    """Gera notificações inteligentes para o usuário."""
    notifications = []
    
    if not user.get("data_sources"):
        notifications.append({
            "type": "suggestion",
            "icon": "🔗",
            "title": "Conecte suas primeiras fontes",
            "message": "Conectar o Google Calendar e Apple Health aumenta a precisão do LifeOS em 40%.",
            "action": "connect_sources"
        })
    
    if not user.get("missions"):
        notifications.append({
            "type": "action",
            "icon": "🎯",
            "title": "Crie sua primeira Missão",
            "message": "Missões estruturadas aumentam suas chances de sucesso em 3x.",
            "action": "create_mission"
        })
    
    if len(user.get("companion_messages", [])) < 3:
        notifications.append({
            "type": "tip",
            "icon": "🤖",
            "title": "Converse com seu Companion",
            "message": "Quanto mais você conversa, mais personalizado fica o LifeOS.",
            "action": "open_companion"
        })
    
    notifications.append({
        "type": "insight",
        "icon": "✨",
        "title": "LifeOS está aprendendo",
        "message": "Cada ação que você toma melhora a inteligência do seu sistema.",
        "action": None
    })
    
    return notifications

# ============================================================
# ROTAS - MÉTRICAS
# ============================================================

@app.route('/api/metrics/<user_id>', methods=['GET'])
def get_metrics(user_id):
    """Retorna métricas de uso do usuário."""
    if user_id not in METRICS_DB:
        return jsonify({"success": False, "error": "Métricas não encontradas"}), 404
    
    metrics = METRICS_DB[user_id]
    user = get_user(user_id)
    
    # Calcula tempo de onboarding
    onboarding_time = None
    if metrics.get("onboarding_start") and metrics.get("onboarding_duration_seconds"):
        onboarding_time = round(metrics["onboarding_duration_seconds"], 1)
    
    # Calcula tempo até primeiro valor
    first_value_time = None
    if metrics.get("session_start") and metrics.get("first_value_time"):
        first_value_time = round(metrics["first_value_time"] - metrics["session_start"], 1)
    
    return jsonify({
        "success": True,
        "metrics": {
            "onboarding_time_seconds": onboarding_time,
            "time_to_first_value_seconds": first_value_time,
            "actions_completed": metrics.get("actions_completed", 0),
            "companion_interactions": metrics.get("companion_interactions", 0),
            "events_count": len(metrics.get("events", [])),
            "session_duration_seconds": round(time.time() - metrics.get("session_start", time.time()), 1),
            "data_sources_connected": len(user.get("data_sources", [])) if user else 0,
            "missions_created": len(user.get("missions", [])) if user else 0,
        }
    })

@app.route('/api/metrics/admin', methods=['GET'])
def get_admin_metrics():
    """Retorna métricas agregadas de todos os usuários (admin)."""
    total_users = len(USERS_DB)
    total_sessions = len(SESSIONS_DB)
    
    all_actions = sum(m.get("actions_completed", 0) for m in METRICS_DB.values())
    all_interactions = sum(m.get("companion_interactions", 0) for m in METRICS_DB.values())
    
    onboarding_times = [
        m.get("onboarding_duration_seconds") 
        for m in METRICS_DB.values() 
        if m.get("onboarding_duration_seconds")
    ]
    avg_onboarding = sum(onboarding_times) / len(onboarding_times) if onboarding_times else 0
    
    first_value_times = []
    for m in METRICS_DB.values():
        if m.get("session_start") and m.get("first_value_time"):
            first_value_times.append(m["first_value_time"] - m["session_start"])
    avg_first_value = sum(first_value_times) / len(first_value_times) if first_value_times else 0
    
    return jsonify({
        "success": True,
        "admin_metrics": {
            "total_users": total_users,
            "total_sessions": total_sessions,
            "total_actions_completed": all_actions,
            "total_companion_interactions": all_interactions,
            "avg_onboarding_time_seconds": round(avg_onboarding, 1),
            "avg_time_to_first_value_seconds": round(avg_first_value, 1),
            "errors_logged": len(ERRORS_DB),
            "feedback_count": len(FEEDBACK_DB)
        }
    })

# ============================================================
# ROTAS - FEEDBACK
# ============================================================

@app.route('/api/feedback/submit', methods=['POST'])
def submit_feedback():
    """Registra feedback do usuário."""
    data = request.json or {}
    user_id = data.get('user_id')
    
    feedback = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "step": data.get('step', 'general'),
        "rating": data.get('rating', 0),
        "type": data.get('type', 'general'),  # difficulty, error, abandonment, positive
        "message": data.get('message', ''),
        "timestamp": datetime.now().isoformat(),
        "metadata": data.get('metadata', {})
    }
    
    FEEDBACK_DB.append(feedback)
    
    if user_id:
        track_metric(user_id, "feedback_submitted", {"step": feedback["step"], "rating": feedback["rating"]})
    
    return jsonify({
        "success": True,
        "feedback_id": feedback["id"],
        "message": "Feedback registrado. Obrigado!"
    })

@app.route('/api/feedback/list', methods=['GET'])
def list_feedback():
    """Lista todos os feedbacks registrados."""
    return jsonify({
        "success": True,
        "feedback": FEEDBACK_DB,
        "count": len(FEEDBACK_DB)
    })

# ============================================================
# ROTAS - ERROS E ABANDONO
# ============================================================

@app.route('/api/errors/log', methods=['POST'])
def log_error():
    """Registra erro ou abandono de fluxo."""
    data = request.json or {}
    
    error = {
        "id": str(uuid.uuid4())[:8],
        "user_id": data.get('user_id'),
        "step": data.get('step', 'unknown'),
        "type": data.get('type', 'error'),  # error, abandonment, difficulty
        "message": data.get('message', ''),
        "context": data.get('context', {}),
        "timestamp": datetime.now().isoformat()
    }
    
    ERRORS_DB.append(error)
    
    if data.get('user_id'):
        track_metric(data['user_id'], f"error_{data.get('type', 'general')}", {"step": error["step"]})
    
    return jsonify({"success": True, "error_id": error["id"]})

@app.route('/api/errors/list', methods=['GET'])
def list_errors():
    """Lista todos os erros registrados."""
    return jsonify({
        "success": True,
        "errors": ERRORS_DB,
        "count": len(ERRORS_DB)
    })

# ============================================================
# ROTA PRINCIPAL
# ============================================================

@app.route('/')
def index():
    """Serve o arquivo HTML principal."""
    return send_from_directory('/home/ubuntu/Project-X/mvp_alpha', 'index.html')

@app.route('/health')
def health():
    """Health check."""
    return jsonify({
        "status": "healthy",
        "version": "MVP Alpha 0.1.0",
        "sprint": "018",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("🚀 LifeOS MVP Alpha Backend iniciando...")
    print("📍 Sprint 018 - MVP Alpha Experience")
    app.run(host='0.0.0.0', port=5000, debug=True)
