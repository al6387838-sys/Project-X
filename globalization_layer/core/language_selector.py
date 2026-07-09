"""
Language Selector
=================
Component that provides language selection UI data and switching logic.
Mirrors the react-i18next useTranslation + language switcher pattern.
"""

import os
from typing import List, Dict, Optional
from .models import SupportedLocale, LOCALE_DISPLAY_NAMES, DEFAULT_LOCALE
from .language_provider import LanguageProvider
from .locale_manager import LocaleManager


class LanguageSelector:
    """
    Provides language selection capabilities for the LifeOS UI.

    Responsibilities:
    - List available languages with display names and flags
    - Switch language for a user session
    - Auto-detect language from environment
    - Persist language preference per user
    """

    # Unicode flag emojis for each locale
    LOCALE_FLAGS = {
        SupportedLocale.PT_BR: "🇧🇷",
        SupportedLocale.EN:    "🇺🇸",
        SupportedLocale.ES:    "🇪🇸",
        SupportedLocale.FR:    "🇫🇷",
        SupportedLocale.DE:    "🇩🇪",
        SupportedLocale.IT:    "🇮🇹",
        SupportedLocale.JA:    "🇯🇵",
        SupportedLocale.ZH:    "🇨🇳",
    }

    def __init__(
        self,
        provider: LanguageProvider = None,
        manager: LocaleManager = None,
    ):
        self._provider = provider or LanguageProvider()
        self._manager = manager or LocaleManager()

    def get_language_list(self) -> List[Dict]:
        """
        Return all supported languages as a list of option dicts.
        Ready for rendering in a dropdown or settings screen.
        """
        return [
            {
                "code": loc.value,
                "name": LOCALE_DISPLAY_NAMES[loc],
                "flag": self.LOCALE_FLAGS.get(loc, ""),
                "active": loc == self._provider.locale,
            }
            for loc in SupportedLocale
        ]

    def select(self, locale_code: str, user_id: str = None) -> bool:
        """
        Select a language for the current session.
        Optionally persists the preference for a user.

        Returns True if the language was successfully switched.
        """
        success = self._provider.switch_locale(locale_code)
        if success and user_id:
            self._manager.set_user_locale(user_id, self._provider.locale)
        return success

    def auto_detect(self, language_tag: str, user_id: str = None) -> SupportedLocale:
        """
        Auto-detect and apply locale from a browser/OS language tag.
        Falls back to DEFAULT_LOCALE if not recognized.
        """
        detected = self._provider.auto_detect_and_set(language_tag)
        if user_id:
            self._manager.set_user_locale(user_id, detected)
        return detected

    def restore_user_preference(self, user_id: str) -> SupportedLocale:
        """
        Restore a user's saved language preference.
        Used on session start to apply the user's last chosen language.
        """
        locale = self._manager.get_user_locale(user_id)
        self._provider.set_locale(locale.value)
        return locale

    @property
    def current_locale(self) -> SupportedLocale:
        return self._provider.locale

    @property
    def current_display_name(self) -> str:
        return LOCALE_DISPLAY_NAMES.get(self._provider.locale, self._provider.locale_code)
