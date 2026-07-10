"""
Translation Store — Complete translations for 9 languages.
SIGMA-003: Internationalization
"""

from typing import Dict, Any
from .i18n_engine import I18nEngine, Locale

# Complete LifeOS translations for all 9 supported languages
LIFEOS_TRANSLATIONS: Dict[str, Dict[str, str]] = {
    # ── Navigation ──
    "nav.home": {
        "pt-BR": "Início", "en-US": "Home", "es-ES": "Inicio", "fr-FR": "Accueil",
        "de-DE": "Startseite", "it-IT": "Home", "ja-JP": "ホーム", "ko-KR": "홈", "ar-SA": "الرئيسية",
    },
    "nav.dashboard": {
        "pt-BR": "Painel", "en-US": "Dashboard", "es-ES": "Panel", "fr-FR": "Tableau de bord",
        "de-DE": "Dashboard", "it-IT": "Dashboard", "ja-JP": "ダッシュボード", "ko-KR": "대시보드", "ar-SA": "لوحة المعلومات",
    },
    "nav.settings": {
        "pt-BR": "Configurações", "en-US": "Settings", "es-ES": "Configuración", "fr-FR": "Paramètres",
        "de-DE": "Einstellungen", "it-IT": "Impostazioni", "ja-JP": "設定", "ko-KR": "설정", "ar-SA": "الإعدادات",
    },
    "nav.profile": {
        "pt-BR": "Perfil", "en-US": "Profile", "es-ES": "Perfil", "fr-FR": "Profil",
        "de-DE": "Profil", "it-IT": "Profilo", "ja-JP": "プロフィール", "ko-KR": "프로필", "ar-SA": "الملف الشخصي",
    },
    "nav.life_graph": {
        "pt-BR": "Gráfico de Vida", "en-US": "Life Graph", "es-ES": "Gráfico de Vida", "fr-FR": "Graphique de Vie",
        "de-DE": "Lebensgraph", "it-IT": "Grafico Vita", "ja-JP": "ライフグラフ", "ko-KR": "라이프 그래프", "ar-SA": "رسم بياني للحياة",
    },
    "nav.companion": {
        "pt-BR": "Companheiro", "en-US": "Companion", "es-ES": "Compañero", "fr-FR": "Compagnon",
        "de-DE": "Begleiter", "it-IT": "Compagno", "ja-JP": "コンパニオン", "ko-KR": "컴패니언", "ar-SA": "رفيق",
    },
    "nav.tasks": {
        "pt-BR": "Tarefas", "en-US": "Tasks", "es-ES": "Tareas", "fr-FR": "Tâches",
        "de-DE": "Aufgaben", "it-IT": "Attività", "ja-JP": "タスク", "ko-KR": "작업", "ar-SA": "المهام",
    },
    "nav.habits": {
        "pt-BR": "Hábitos", "en-US": "Habits", "es-ES": "Hábitos", "fr-FR": "Habitudes",
        "de-DE": "Gewohnheiten", "it-IT": "Abitudini", "ja-JP": "習慣", "ko-KR": "습관", "ar-SA": "العادات",
    },
    "nav.goals": {
        "pt-BR": "Objetivos", "en-US": "Goals", "es-ES": "Objetivos", "fr-FR": "Objectifs",
        "de-DE": "Ziele", "it-IT": "Obiettivi", "ja-JP": "目標", "ko-KR": "목표", "ar-SA": "الأهداف",
    },
    "nav.calendar": {
        "pt-BR": "Calendário", "en-US": "Calendar", "es-ES": "Calendario", "fr-FR": "Calendrier",
        "de-DE": "Kalender", "it-IT": "Calendario", "ja-JP": "カレンダー", "ko-KR": "달력", "ar-SA": "التقويم",
    },
    "nav.notes": {
        "pt-BR": "Notas", "en-US": "Notes", "es-ES": "Notas", "fr-FR": "Notes",
        "de-DE": "Notizen", "it-IT": "Note", "ja-JP": "メモ", "ko-KR": "메모", "ar-SA": "الملاحظات",
    },
    "nav.search": {
        "pt-BR": "Pesquisar", "en-US": "Search", "es-ES": "Buscar", "fr-FR": "Rechercher",
        "de-DE": "Suchen", "it-IT": "Cerca", "ja-JP": "検索", "ko-KR": "검색", "ar-SA": "بحث",
    },
    # ── Common ──
    "common.save": {
        "pt-BR": "Salvar", "en-US": "Save", "es-ES": "Guardar", "fr-FR": "Enregistrer",
        "de-DE": "Speichern", "it-IT": "Salva", "ja-JP": "保存", "ko-KR": "저장", "ar-SA": "حفظ",
    },
    "common.cancel": {
        "pt-BR": "Cancelar", "en-US": "Cancel", "es-ES": "Cancelar", "fr-FR": "Annuler",
        "de-DE": "Abbrechen", "it-IT": "Annulla", "ja-JP": "キャンセル", "ko-KR": "취소", "ar-SA": "إلغاء",
    },
    "common.delete": {
        "pt-BR": "Excluir", "en-US": "Delete", "es-ES": "Eliminar", "fr-FR": "Supprimer",
        "de-DE": "Löschen", "it-IT": "Elimina", "ja-JP": "削除", "ko-KR": "삭제", "ar-SA": "حذف",
    },
    "common.edit": {
        "pt-BR": "Editar", "en-US": "Edit", "es-ES": "Editar", "fr-FR": "Modifier",
        "de-DE": "Bearbeiten", "it-IT": "Modifica", "ja-JP": "編集", "ko-KR": "편집", "ar-SA": "تعديل",
    },
    "common.create": {
        "pt-BR": "Criar", "en-US": "Create", "es-ES": "Crear", "fr-FR": "Créer",
        "de-DE": "Erstellen", "it-IT": "Crea", "ja-JP": "作成", "ko-KR": "생성", "ar-SA": "إنشاء",
    },
    "common.close": {
        "pt-BR": "Fechar", "en-US": "Close", "es-ES": "Cerrar", "fr-FR": "Fermer",
        "de-DE": "Schließen", "it-IT": "Chiudi", "ja-JP": "閉じる", "ko-KR": "닫기", "ar-SA": "إغلاق",
    },
    "common.loading": {
        "pt-BR": "Carregando...", "en-US": "Loading...", "es-ES": "Cargando...", "fr-FR": "Chargement...",
        "de-DE": "Wird geladen...", "it-IT": "Caricamento...", "ja-JP": "読み込み中...", "ko-KR": "로딩 중...", "ar-SA": "جاري التحميل...",
    },
    "common.error": {
        "pt-BR": "Erro", "en-US": "Error", "es-ES": "Error", "fr-FR": "Erreur",
        "de-DE": "Fehler", "it-IT": "Errore", "ja-JP": "エラー", "ko-KR": "오류", "ar-SA": "خطأ",
    },
    "common.success": {
        "pt-BR": "Sucesso", "en-US": "Success", "es-ES": "Éxito", "fr-FR": "Succès",
        "de-DE": "Erfolg", "it-IT": "Successo", "ja-JP": "成功", "ko-KR": "성공", "ar-SA": "نجاح",
    },
    "common.confirm": {
        "pt-BR": "Confirmar", "en-US": "Confirm", "es-ES": "Confirmar", "fr-FR": "Confirmer",
        "de-DE": "Bestätigen", "it-IT": "Conferma", "ja-JP": "確認", "ko-KR": "확인", "ar-SA": "تأكيد",
    },
    "common.logout": {
        "pt-BR": "Sair", "en-US": "Logout", "es-ES": "Cerrar sesión", "fr-FR": "Déconnexion",
        "de-DE": "Abmelden", "it-IT": "Esci", "ja-JP": "ログアウト", "ko-KR": "로그아웃", "ar-SA": "تسجيل الخروج",
    },
    "common.welcome": {
        "pt-BR": "Bem-vindo, {name}", "en-US": "Welcome, {name}", "es-ES": "Bienvenido, {name}", "fr-FR": "Bienvenue, {name}",
        "de-DE": "Willkommen, {name}", "it-IT": "Benvenuto, {name}", "ja-JP": "ようこそ、{name}", "ko-KR": "환영합니다, {name}", "ar-SA": "مرحباً، {name}",
    },
    # ── LifeOS Specific ──
    "lifeos.title": {
        "pt-BR": "LifeOS", "en-US": "LifeOS", "es-ES": "LifeOS", "fr-FR": "LifeOS",
        "de-DE": "LifeOS", "it-IT": "LifeOS", "ja-JP": "LifeOS", "ko-KR": "LifeOS", "ar-SA": "LifeOS",
    },
    "lifeos.subtitle": {
        "pt-BR": "Sistema Operacional para sua Vida", "en-US": "Operating System for Your Life",
        "es-ES": "Sistema Operativo para tu Vida", "fr-FR": "Système d'Exploitation pour votre Vie",
        "de-DE": "Betriebssystem für Ihr Leben", "it-IT": "Sistema Operativo per la tua Vita",
        "ja-JP": "あなたの人生のためのオペレーティングシステム", "ko-KR": "당신의 삶을 위한 운영 체제",
        "ar-SA": "نظام تشغيل لحياتك",
    },
    "lifeos.start_your_day": {
        "pt-BR": "Comece seu dia", "en-US": "Start your day", "es-ES": "Comienza tu día", "fr-FR": "Commencez votre journée",
        "de-DE": "Starten Sie Ihren Tag", "it-IT": "Inizia la tua giornata", "ja-JP": "今日を始めましょう", "ko-KR": "하루를 시작하세요", "ar-SA": "ابدأ يومك",
    },
    "lifeos.today_summary": {
        "pt-BR": "Resumo do dia", "en-US": "Today's summary", "es-ES": "Resumen del día", "fr-FR": "Résumé du jour",
        "de-DE": "Tageszusammenfassung", "it-IT": "Riepilogo del giorno", "ja-JP": "今日の概要", "ko-KR": "오늘 요약", "ar-SA": "ملخص اليوم",
    },
    "lifeos.progress": {
        "pt-BR": "Progresso", "en-US": "Progress", "es-ES": "Progreso", "fr-FR": "Progrès",
        "de-DE": "Fortschritt", "it-IT": "Progresso", "ja-JP": "進捗", "ko-KR": "진행률", "ar-SA": "التقدم",
    },
    "lifeos.weekly_review": {
        "pt-BR": "Revisão Semanal", "en-US": "Weekly Review", "es-ES": "Revisión Semanal", "fr-FR": "Revue Hebdomadaire",
        "de-DE": "Wochenreview", "it-IT": "Revisione Settimanale", "ja-JP": "週間レビュー", "ko-KR": "주간 리뷰", "ar-SA": "مراجعة أسبوعية",
    },
    "lifeos.monthly_goals": {
        "pt-BR": "Objetivos do Mês", "en-US": "Monthly Goals", "es-ES": "Objetivos del Mes", "fr-FR": "Objectifs Mensuels",
        "de-DE": "Monatsziele", "it-IT": "Obiettivi Mensili", "ja-JP": "月間目標", "ko-KR": "월간 목표", "ar-SA": "أهداف الشهر",
    },
    "lifeos.companion_message": {
        "pt-BR": "Olá! Como posso ajudar hoje?", "en-US": "Hello! How can I help today?", "es-ES": "¡Hola! ¿Cómo puedo ayudar hoy?", "fr-FR": "Bonjour ! Comment puis-je aider aujourd'hui ?",
        "de-DE": "Hallo! Wie kann ich heute helfen?", "it-IT": "Ciao! Come posso aiutarti oggi?", "ja-JP": "こんにちは！今日はどうお手伝いしましょう？", "ko-KR": "안녕하세요! 오늘 어떻게 도와드릴까요?", "ar-SA": "مرحباً! كيف يمكنني المساعدة اليوم؟",
    },
    "lifeos.habit_streak": {
        "pt-BR": "{count} dias consecutivos", "en-US": "{count} day streak", "es-ES": "{count} días consecutivos", "fr-FR": "{count} jours consécutifs",
        "de-DE": "{count} Tage in Folge", "it-IT": "{count} giorni consecutivi", "ja-JP": "{count}日連続", "ko-KR": "{count}일 연속", "ar-SA": "{count} أيام متتالية",
    },
    "lifeos.task_completed": {
        "pt-BR": "Tarefa concluída", "en-US": "Task completed", "es-ES": "Tarea completada", "fr-FR": "Tâche terminée",
        "de-DE": "Aufgabe erledigt", "it-IT": "Attività completata", "ja-JP": "タスク完了", "ko-KR": "작업 완료", "ar-SA": "تم إنجاز المهمة",
    },
    "lifeos.goal_progress": {
        "pt-BR": "{percent}% do objetivo", "en-US": "{percent}% of goal", "es-ES": "{percent}% del objetivo", "fr-FR": "{percent}% de l'objectif",
        "de-DE": "{percent}% des Ziels", "it-IT": "{percent}% dell'obiettivo", "ja-JP": "目標の{percent}%", "ko-KR": "목표의 {percent}%", "ar-SA": "{percent}% من الهدف",
    },
    "lifeos.notification_count": {
        "pt-BR": "{count} notificação", "en-US": "{count} notification", "es-ES": "{count} notificación", "fr-FR": "{count} notification",
        "de-DE": "{count} Benachrichtigung", "it-IT": "{count} notifica", "ja-JP": "{count}件の通知", "ko-KR": "{count}개 알림", "ar-SA": "{count} إشعار",
    },
    "lifeos.score": {
        "pt-BR": "Pontuação de Vida", "en-US": "Life Score", "es-ES": "Puntuación de Vida", "fr-FR": "Score de Vie",
        "de-DE": "Lebens-Score", "it-IT": "Punteggio Vita", "ja-JP": "ライフスコア", "ko-KR": "라이프 스코어", "ar-SA": "نقاط الحياة",
    },
}


def load_translations(engine: I18nEngine) -> None:
    """Load all LifeOS translations into the engine."""
    for key, translations in LIFEOS_TRANSLATIONS.items():
        engine.set_translation(key, translations)


def get_available_locales() -> dict:
    """Return all available locales."""
    return {
        "pt-BR": {"name": "Português", "native": "Português", "rtl": False},
        "en-US": {"name": "English", "native": "English", "rtl": False},
        "es-ES": {"name": "Español", "native": "Español", "rtl": False},
        "fr-FR": {"name": "Français", "native": "Français", "rtl": False},
        "de-DE": {"name": "Deutsch", "native": "Deutsch", "rtl": False},
        "it-IT": {"name": "Italiano", "native": "Italiano", "rtl": False},
        "ja-JP": {"name": "日本語", "native": "日本語", "rtl": False},
        "ko-KR": {"name": "한국어", "native": "한국어", "rtl": False},
        "ar-SA": {"name": "العربية", "native": "العربية", "rtl": True},
    }
