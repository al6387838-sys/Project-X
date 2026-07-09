"""
Translation Loader
==================
Loads and caches JSON translation files for all supported locales.
Mirrors the i18next resource loading pattern.
"""

import json
import os
from typing import Dict, Any, Optional
from .models import SupportedLocale, FALLBACK_LOCALE


LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "locales")


class TranslationLoader:
    """
    Loads translation namespaces from JSON files.

    File structure:
        locales/{locale}/{namespace}.json

    Namespaces:
        common      — shared UI strings (buttons, labels, status)
        dashboard   — dashboard widgets and sections
        companion   — AI companion messages and prompts
        onboarding  — onboarding flow
        decisions   — decision engine UI
        errors      — error messages
        formats     — date/time/number format labels
    """

    NAMESPACES = [
        "common",
        "dashboard",
        "companion",
        "onboarding",
        "decisions",
        "errors",
        "formats",
    ]

    def __init__(self, locales_dir: str = None):
        self._locales_dir = locales_dir or LOCALES_DIR
        self._cache: Dict[str, Dict[str, Any]] = {}

    def load(self, locale: SupportedLocale, namespace: str = "common") -> Dict[str, Any]:
        """
        Load a translation namespace for a given locale.
        Falls back to FALLBACK_LOCALE if the file is missing.
        """
        cache_key = f"{locale.value}:{namespace}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        translations = self._load_file(locale.value, namespace)

        if not translations:
            # Fallback to English
            translations = self._load_file(FALLBACK_LOCALE.value, namespace)

        if not translations:
            translations = {}

        self._cache[cache_key] = translations
        return translations

    def load_all(self, locale: SupportedLocale) -> Dict[str, Dict[str, Any]]:
        """Load all namespaces for a locale."""
        return {ns: self.load(locale, ns) for ns in self.NAMESPACES}

    def _load_file(self, locale_code: str, namespace: str) -> Optional[Dict[str, Any]]:
        path = os.path.join(self._locales_dir, locale_code, f"{namespace}.json")
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None

    def reload(self):
        """Clear the cache and force reload on next access."""
        self._cache.clear()

    def available_locales(self) -> list:
        """Return list of locales that have translation files."""
        available = []
        for locale in SupportedLocale:
            path = os.path.join(self._locales_dir, locale.value)
            if os.path.isdir(path):
                available.append(locale)
        return available
