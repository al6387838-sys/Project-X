"""
Locale Manager
==============
Manages per-user locale preferences and session state.
Provides persistence and retrieval of locale configurations.
"""

import json
import os
from typing import Dict, Optional
from .models import SupportedLocale, LocaleConfig, DEFAULT_LOCALE


class LocaleManager:
    """
    Manages locale configurations per user.
    Stores preferences in a lightweight JSON store.
    """

    def __init__(self, storage_path: str = None):
        self._storage_path = storage_path or os.path.join(
            os.path.dirname(__file__), "..", "data", "locale_preferences.json"
        )
        self._preferences: Dict[str, str] = {}
        self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_user_locale(self, user_id: str, locale: SupportedLocale) -> LocaleConfig:
        """Persist a user's locale preference and return the config."""
        self._preferences[user_id] = locale.value
        self._save()
        return LocaleConfig.from_locale(locale)

    def get_user_locale(self, user_id: str) -> SupportedLocale:
        """Retrieve a user's saved locale. Returns DEFAULT_LOCALE if not set."""
        code = self._preferences.get(user_id)
        if code:
            for loc in SupportedLocale:
                if loc.value == code:
                    return loc
        return DEFAULT_LOCALE

    def get_user_config(self, user_id: str) -> LocaleConfig:
        """Return the full LocaleConfig for a user."""
        locale = self.get_user_locale(user_id)
        return LocaleConfig.from_locale(locale)

    def remove_user_locale(self, user_id: str) -> bool:
        """Remove a user's locale preference (resets to default)."""
        if user_id in self._preferences:
            del self._preferences[user_id]
            self._save()
            return True
        return False

    def all_preferences(self) -> Dict[str, str]:
        """Return all stored locale preferences."""
        return dict(self._preferences)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load(self):
        os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
        if os.path.exists(self._storage_path):
            try:
                with open(self._storage_path, "r", encoding="utf-8") as f:
                    self._preferences = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._preferences = {}

    def _save(self):
        os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
        try:
            with open(self._storage_path, "w", encoding="utf-8") as f:
                json.dump(self._preferences, f, indent=2, ensure_ascii=False)
        except IOError:
            pass
