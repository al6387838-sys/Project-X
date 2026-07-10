"""
Locale Manager — Locale detection, persistence, and browser integration.
SIGMA-003: Internationalization
"""

import logging
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from .i18n_engine import I18nEngine, Locale

logger = logging.getLogger(__name__)


class LocaleManager:
    """
    World-Class Locale Manager for LifeOS.

    SIGMA-003: Handles locale detection, persistence, and switching.
    """

    def __init__(self, engine: I18nEngine) -> None:
        self.engine = engine
        self._locale_history: List[str] = []
        self._user_preferences: Dict[str, str] = {}

    def detect_locale(self, accept_language: Optional[str] = None) -> Locale:
        """Detect locale from browser Accept-Language header."""
        if not accept_language:
            return self.engine.default_locale

        # Parse Accept-Language: "pt-BR,pt;q=0.9,en-US;q=0.8"
        parts = accept_language.split(",")
        for part in parts:
            part = part.strip()
            if ";" in part:
                lang, _ = part.split(";")
            else:
                lang = part
            lang = lang.strip()

            # Try exact match
            for locale in Locale:
                if locale.value == lang:
                    return locale

            # Try base match (e.g., "pt" -> pt-BR)
            for locale in Locale:
                if locale.value.startswith(lang.split("-")[0]):
                    return locale

        return self.engine.default_locale

    def switch_locale(self, locale: Locale) -> None:
        """Switch to a new locale with history tracking."""
        self._locale_history.append(self.engine.current_locale.value)
        self.engine.set_locale(locale)
        logger.info(f"[LocaleManager] Switched to {locale.value}")

    def get_locale_history(self) -> List[str]:
        return list(self._locale_history)

    def set_user_preference(self, user_id: str, locale: Locale) -> None:
        """Persist user's locale preference."""
        self._user_preferences[user_id] = locale.value

    def get_user_locale(self, user_id: str) -> Optional[Locale]:
        """Get user's saved locale preference."""
        pref = self._user_preferences.get(user_id)
        if pref:
            for locale in Locale:
                if locale.value == pref:
                    return locale
        return None

    def stats(self) -> Dict:
        return {
            "current_locale": self.engine.current_locale.value,
            "locale_history": self._locale_history,
            "user_preferences": len(self._user_preferences),
        }
