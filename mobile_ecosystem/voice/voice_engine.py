"""
BETA-007: Voice Companion Engine
LifeOS Mobile Ecosystem — Program Beta

Architecture: Wake word detection, intent classification,
command routing, and TTS response generation.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple
import re
import uuid


class VoiceState(Enum):
    IDLE       = "idle"        # Waiting for wake word
    LISTENING  = "listening"   # Wake word detected, recording
    PROCESSING = "processing"  # Transcribing + classifying intent
    RESPONDING = "responding"  # Generating + speaking response
    ERROR      = "error"


class VoiceIntent(Enum):
    # Queries
    QUERY_PROGRESS    = "query_progress"
    QUERY_DECISIONS   = "query_decisions"
    QUERY_HABITS      = "query_habits"
    QUERY_MEMORY      = "query_memory"
    QUERY_SCHEDULE    = "query_schedule"
    QUERY_BRIEFING    = "query_briefing"
    QUERY_HEALTH      = "query_health"
    # Actions
    ACTION_ADD_TASK   = "action_add_task"
    ACTION_REMEMBER   = "action_remember"
    ACTION_COMPLETE   = "action_complete"
    ACTION_DECIDE     = "action_decide"
    ACTION_FOCUS      = "action_focus"
    # Navigation
    NAV_OPEN          = "nav_open"
    NAV_BACK          = "nav_back"
    # System
    SYSTEM_STOP       = "system_stop"
    SYSTEM_HELP       = "system_help"
    UNKNOWN           = "unknown"


@dataclass
class VoiceCommand:
    id:         str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    raw_text:   str = ""
    intent:     VoiceIntent = VoiceIntent.UNKNOWN
    confidence: float = 0.0
    entities:   Dict[str, Any] = field(default_factory=dict)
    language:   str = "pt-BR"


@dataclass
class VoiceResponse:
    command_id: str
    text:       str
    ssml:       str = ""
    actions:    List[Dict] = field(default_factory=list)
    data:       Dict = field(default_factory=dict)
    duration_ms: int = 0


class WakeWordDetector:
    """
    Lightweight wake word detection.
    In production: uses on-device ML model (Porcupine / Picovoice).
    """

    WAKE_WORDS = [
        "hey lifeos",
        "oi lifeos",
        "lifeos",
        "hey life",
        "ei lifeos",
    ]

    def detect(self, audio_text: str) -> Tuple[bool, float]:
        """Returns (detected, confidence)."""
        text_lower = audio_text.lower().strip()
        for wake_word in self.WAKE_WORDS:
            if wake_word in text_lower:
                return True, 0.97
        # Fuzzy match
        for wake_word in self.WAKE_WORDS:
            words = wake_word.split()
            if any(w in text_lower for w in words if len(w) > 4):
                return True, 0.72
        return False, 0.0


class IntentClassifier:
    """
    Rule-based intent classifier.
    In production: fine-tuned on-device NLU model.
    """

    PATTERNS = {
        VoiceIntent.QUERY_PROGRESS: [
            r"progresso", r"sprint", r"quanto.*conclu", r"como.*t[aá]",
            r"status.*projeto", r"andamento",
        ],
        VoiceIntent.QUERY_DECISIONS: [
            r"decis[aã]o", r"decidir", r"pendente", r"cr[ií]tico",
        ],
        VoiceIntent.QUERY_HABITS: [
            r"h[aá]bito", r"streak", r"exerc[ií]cio", r"foco",
            r"leitura", r"medita[cç][aã]o",
        ],
        VoiceIntent.QUERY_MEMORY: [
            r"mem[oó]ria", r"lembro", r"recordo", r"grafo",
        ],
        VoiceIntent.QUERY_SCHEDULE: [
            r"reuni[aã]o", r"agenda", r"calend[aá]rio", r"pr[oó]xim",
            r"hoje.*hora", r"que horas",
        ],
        VoiceIntent.QUERY_BRIEFING: [
            r"briefing", r"resumo", r"dia.*hoje", r"bom dia",
            r"como.*dia", r"o que.*hoje",
        ],
        VoiceIntent.QUERY_HEALTH: [
            r"health.*score", r"sa[uú]de", r"bem.?estar",
        ],
        VoiceIntent.ACTION_ADD_TASK: [
            r"adicionar.*tarefa", r"criar.*tarefa", r"nova.*tarefa",
            r"lembrar.*fazer", r"adiciona",
        ],
        VoiceIntent.ACTION_REMEMBER: [
            r"lembrar que", r"memorizar", r"guardar", r"anota",
            r"registra", r"salva",
        ],
        VoiceIntent.ACTION_COMPLETE: [
            r"conclu[ií]", r"terminei", r"fiz", r"feito", r"pronto",
        ],
        VoiceIntent.ACTION_FOCUS: [
            r"modo foco", r"iniciar foco", r"come[cç]ar.*foco",
            r"pomodoro", r"sessão.*foco",
        ],
        VoiceIntent.ACTION_DECIDE: [
            r"decidir", r"tomar.*decis[aã]o", r"resolver",
        ],
        VoiceIntent.NAV_OPEN: [
            r"abrir", r"ir para", r"mostrar", r"ver",
        ],
        VoiceIntent.SYSTEM_STOP: [
            r"parar", r"cancelar", r"sair", r"fechar", r"tchau",
        ],
        VoiceIntent.SYSTEM_HELP: [
            r"ajuda", r"o que.*fazer", r"comandos", r"como.*usar",
        ],
    }

    def classify(self, text: str) -> Tuple[VoiceIntent, float]:
        text_lower = text.lower()
        scores = {}

        for intent, patterns in self.PATTERNS.items():
            matches = sum(1 for p in patterns if re.search(p, text_lower))
            if matches > 0:
                scores[intent] = matches / len(patterns)

        if not scores:
            return VoiceIntent.UNKNOWN, 0.0

        best_intent = max(scores, key=scores.get)
        confidence = min(0.95, scores[best_intent] * 3)
        return best_intent, confidence

    def extract_entities(self, text: str, intent: VoiceIntent) -> Dict:
        entities = {}
        text_lower = text.lower()

        # Time entities
        time_patterns = {
            "hoje": "today", "amanhã": "tomorrow",
            "esta semana": "this_week", "próxima semana": "next_week",
        }
        for pt, en in time_patterns.items():
            if pt in text_lower:
                entities["time"] = en

        # Number entities
        numbers = re.findall(r'\d+', text)
        if numbers:
            entities["numbers"] = [int(n) for n in numbers]

        # Task/memory content (after "que" or ":")
        content_match = re.search(r'(?:que|:)\s+(.+)$', text_lower)
        if content_match:
            entities["content"] = content_match.group(1).strip()

        return entities


class VoiceResponseGenerator:
    """Generates natural language responses for voice commands."""

    def __init__(self, user_data: Dict):
        self.user = user_data

    def generate(self, command: VoiceCommand) -> VoiceResponse:
        handler = getattr(self, f"_handle_{command.intent.value}", self._handle_unknown)
        return handler(command)

    def _handle_query_progress(self, cmd: VoiceCommand) -> VoiceResponse:
        progress = self.user.get("sprint_progress", 87)
        remaining = self.user.get("tasks_remaining", 13)
        health = self.user.get("health_score", 82)

        text = (f"Sprint 030 está em {progress}% de progresso. "
                f"Você tem {remaining} tarefas restantes. "
                f"Health Score: {health}. "
                f"Quer que eu priorize as tarefas críticas?")

        return VoiceResponse(
            command_id=cmd.id,
            text=text,
            ssml=f'<speak>{text}<break time="0.5s"/></speak>',
            actions=[
                {"id": "prioritize", "title": "Priorizar tarefas"},
                {"id": "details", "title": "Ver detalhes"},
            ],
            data={"progress": progress, "remaining": remaining},
            duration_ms=4200,
        )

    def _handle_query_decisions(self, cmd: VoiceCommand) -> VoiceResponse:
        decisions = self.user.get("pending_decisions", 3)
        text = (f"Você tem {decisions} decisões críticas pendentes. "
                f"A mais urgente é sobre arquitetura mobile, com prazo hoje às 17h. "
                f"Quer revisar agora?")
        return VoiceResponse(
            command_id=cmd.id, text=text,
            actions=[{"id": "review", "title": "Revisar decisões"}],
            data={"count": decisions}, duration_ms=3800,
        )

    def _handle_query_habits(self, cmd: VoiceCommand) -> VoiceResponse:
        streak = self.user.get("streak", 12)
        text = (f"Seu streak de exercícios está em {streak} dias. "
                f"Hoje você já completou o exercício matinal. "
                f"Foco profundo está em 50%.")
        return VoiceResponse(
            command_id=cmd.id, text=text,
            data={"streak": streak}, duration_ms=3200,
        )

    def _handle_query_briefing(self, cmd: VoiceCommand) -> VoiceResponse:
        text = ("Bom dia, Alexandre. "
                "Hoje você tem 3 decisões críticas, uma reunião às 14h com investidores, "
                f"e seu streak de exercícios está em {self.user.get('streak', 12)} dias. "
                "Sprint 030 está em 87%. Quer começar pelo briefing completo?")
        return VoiceResponse(
            command_id=cmd.id, text=text,
            actions=[
                {"id": "full_brief", "title": "Briefing completo"},
                {"id": "decisions", "title": "Ver decisões"},
            ],
            duration_ms=5500,
        )

    def _handle_action_remember(self, cmd: VoiceCommand) -> VoiceResponse:
        content = cmd.entities.get("content", "informação")
        text = f"Memória salva: '{content}'. Adicionada ao seu grafo de memória soberana."
        return VoiceResponse(
            command_id=cmd.id, text=text,
            data={"saved": True, "content": content}, duration_ms=2200,
        )

    def _handle_action_focus(self, cmd: VoiceCommand) -> VoiceResponse:
        text = "Modo foco ativado. Sessão de 90 minutos iniciada. Notificações pausadas. Boa sessão!"
        return VoiceResponse(
            command_id=cmd.id, text=text,
            data={"focus_started": True, "duration_min": 90}, duration_ms=2800,
        )

    def _handle_system_stop(self, cmd: VoiceCommand) -> VoiceResponse:
        return VoiceResponse(command_id=cmd.id, text="Até logo!", duration_ms=800)

    def _handle_system_help(self, cmd: VoiceCommand) -> VoiceResponse:
        text = ("Você pode me perguntar sobre seu progresso, decisões, hábitos, memórias e agenda. "
                "Também posso criar tarefas, salvar memórias e iniciar sessões de foco.")
        return VoiceResponse(command_id=cmd.id, text=text, duration_ms=4000)

    def _handle_unknown(self, cmd: VoiceCommand) -> VoiceResponse:
        return VoiceResponse(
            command_id=cmd.id,
            text="Não entendi bem. Pode repetir? Diga 'ajuda' para ver os comandos disponíveis.",
            duration_ms=2500,
        )


class VoiceCompanionEngine:
    """
    Main Voice Companion Engine.
    Orchestrates wake word → transcription → intent → response → TTS.
    """

    def __init__(self, user_data: Dict):
        self._state = VoiceState.IDLE
        self._wake_detector = WakeWordDetector()
        self._classifier = IntentClassifier()
        self._responder = VoiceResponseGenerator(user_data)
        self._history: List[Dict] = []
        self._callbacks: Dict[str, List[Callable]] = {
            "on_wake": [], "on_listening": [], "on_processing": [],
            "on_response": [], "on_error": [],
        }

    def process_audio(self, audio_text: str) -> Optional[VoiceResponse]:
        """Process audio input through the full pipeline."""

        # 1. Wake word detection (if idle)
        if self._state == VoiceState.IDLE:
            detected, confidence = self._wake_detector.detect(audio_text)
            if not detected:
                return None
            self._state = VoiceState.LISTENING
            self._fire("on_wake", {"confidence": confidence})

        # 2. Intent classification
        self._state = VoiceState.PROCESSING
        self._fire("on_processing", {"text": audio_text})

        intent, confidence = self._classifier.classify(audio_text)
        entities = self._classifier.extract_entities(audio_text, intent)

        command = VoiceCommand(
            raw_text=audio_text,
            intent=intent,
            confidence=confidence,
            entities=entities,
        )

        # 3. Generate response
        self._state = VoiceState.RESPONDING
        response = self._responder.generate(command)

        # 4. Log to history
        self._history.append({
            "command": command.raw_text,
            "intent": command.intent.value,
            "confidence": command.confidence,
            "response": response.text[:80] + "..." if len(response.text) > 80 else response.text,
        })

        self._fire("on_response", {"response": response.text})
        self._state = VoiceState.IDLE
        return response

    def on(self, event: str, callback: Callable):
        if event in self._callbacks:
            self._callbacks[event].append(callback)

    def _fire(self, event: str, data: Dict):
        for cb in self._callbacks.get(event, []):
            cb(data)

    def get_history(self) -> List[Dict]:
        return self._history


# ── DEMO ───────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("BETA-007: Voice Companion Engine — Demo")
    print("=" * 60)

    user_data = {
        "name": "Alexandre",
        "sprint_progress": 87,
        "tasks_remaining": 13,
        "health_score": 82,
        "streak": 12,
        "pending_decisions": 3,
    }

    engine = VoiceCompanionEngine(user_data)
    engine.on("on_wake", lambda d: print(f"  [WAKE] Detected with confidence: {d['confidence']:.0%}"))
    engine.on("on_response", lambda d: print(f"  [TTS] Speaking: {d['response'][:60]}..."))

    test_inputs = [
        ("Hey LifeOS, qual é o meu progresso no Sprint 030?", "Wake word + query"),
        ("LifeOS, quais são as decisões pendentes?", "Wake word + decisions"),
        ("Oi LifeOS, bom dia, me dá um briefing", "Wake word + briefing"),
        ("Hey LifeOS, lembrar que a reunião com Ana foi produtiva", "Wake word + remember"),
        ("LifeOS, iniciar modo foco", "Wake word + action"),
        ("texto sem wake word", "No wake word (should be ignored)"),
        ("Hey LifeOS, ajuda", "Wake word + help"),
    ]

    for audio, description in test_inputs:
        print(f"\n[INPUT] {description}")
        print(f"  Audio: '{audio}'")
        response = engine.process_audio(audio)
        if response:
            print(f"  Intent: {engine.get_history()[-1]['intent']} ({engine.get_history()[-1]['confidence']:.0%})")
            print(f"  Response: {response.text[:80]}{'...' if len(response.text) > 80 else ''}")
            if response.actions:
                print(f"  Actions: {[a['title'] for a in response.actions]}")
        else:
            print(f"  [IGNORED] No wake word detected")

    print(f"\n[HISTORY] {len(engine.get_history())} commands processed")
    print("\n✅ BETA-007: Voice Companion Engine — COMPLETE")
