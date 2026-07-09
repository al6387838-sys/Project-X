"""
Language Provider
=================
Central i18n provider for LifeOS.
Mirrors the i18next/react-i18next pattern adapted for Python.

Usage:
    from globalization_layer.core.language_provider import LanguageProvider

    i18n = LanguageProvider()
    i18n.set_locale("pt_BR")

    # Translate a key
    text = i18n.t("dashboard.greeting", name="Alex")
    # → "Bom dia, Alex!"

    # Switch language at runtime
    i18n.switch_locale("en")
    text = i18n.t("dashboard.greeting", name="Alex")
    # → "Good morning, Alex!"
"""

import re
from typing import Any, Dict, Optional

from .models import (
    SupportedLocale,
    LocaleConfig,
    LANGUAGE_TAG_MAP,
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    LOCALE_DISPLAY_NAMES,
)
from .translation_loader import TranslationLoader


class LanguageProvider:
    """
    Central i18n provider. Manages locale state, translation lookup,
    interpolation, pluralization and fallback chains.
    """

    def __init__(self, default_locale: SupportedLocale = DEFAULT_LOCALE):
        self._loader = TranslationLoader()
        self._locale: SupportedLocale = default_locale
        self._config: LocaleConfig = LocaleConfig.from_locale(default_locale)
        self._translations: Dict[str, Dict[str, Any]] = {}
        self._load_locale(default_locale)

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    def t(self, key: str, namespace: str = "common", **kwargs) -> str:
        """
        Translate a key with optional interpolation.

        Args:
            key:       Dot-separated translation key, e.g. "dashboard.greeting"
            namespace: Translation namespace (default: "common")
            **kwargs:  Interpolation variables, e.g. name="Alex"

        Returns:
            Translated string. Falls back to key if not found.
        """
        # Support "namespace:key" syntax (i18next style)
        if ":" in key:
            namespace, key = key.split(":", 1)

        value = self._resolve(key, namespace)

        if value is None:
            # Try fallback locale
            value = self._resolve_fallback(key, namespace)

        if value is None:
            return key  # Return raw key as last resort

        return self._interpolate(str(value), kwargs)

    def set_locale(self, locale_code: str) -> bool:
        """
        Set the active locale.

        Args:
            locale_code: Locale string, e.g. "pt_BR", "en", "ja"

        Returns:
            True if locale was set successfully, False if unsupported.
        """
        resolved = self._resolve_locale_code(locale_code)
        if resolved is None:
            return False
        self._locale = resolved
        self._config = LocaleConfig.from_locale(resolved)
        self._load_locale(resolved)
        return True

    def switch_locale(self, locale_code: str) -> bool:
        """Alias for set_locale — mirrors i18next changeLanguage()."""
        return self.set_locale(locale_code)

    @property
    def locale(self) -> SupportedLocale:
        return self._locale

    @property
    def locale_code(self) -> str:
        return self._locale.value

    @property
    def config(self) -> LocaleConfig:
        return self._config

    def get_display_name(self, locale: SupportedLocale = None) -> str:
        """Return the human-readable name of a locale in its own language."""
        return LOCALE_DISPLAY_NAMES.get(locale or self._locale, self._locale.value)

    def available_locales(self) -> Dict[str, str]:
        """Return all supported locales with their display names."""
        return {loc.value: LOCALE_DISPLAY_NAMES[loc] for loc in SupportedLocale}

    # ------------------------------------------------------------------
    # Auto-detection
    # ------------------------------------------------------------------

    def detect_locale(self, language_tag: str) -> SupportedLocale:
        """
        Auto-detect locale from a browser/OS language tag.
        e.g. "pt-BR" → SupportedLocale.PT_BR

        Falls back to DEFAULT_LOCALE if not recognized.
        """
        normalized = language_tag.lower().replace("_", "-")
        # Try exact match first
        if normalized in LANGUAGE_TAG_MAP:
            return LANGUAGE_TAG_MAP[normalized]
        # Try language prefix only (e.g. "pt" from "pt-BR")
        prefix = normalized.split("-")[0]
        if prefix in LANGUAGE_TAG_MAP:
            return LANGUAGE_TAG_MAP[prefix]
        return DEFAULT_LOCALE

    def auto_detect_and_set(self, language_tag: str) -> SupportedLocale:
        """Detect locale from language tag and set it as active."""
        detected = self.detect_locale(language_tag)
        self.set_locale(detected.value)
        return detected

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_locale(self, locale: SupportedLocale):
        """Load all translation namespaces for the given locale into cache."""
        self._translations = self._loader.load_all(locale)

    def _resolve(self, key: str, namespace: str) -> Optional[str]:
        """Resolve a dot-separated key within a namespace."""
        ns_data = self._translations.get(namespace, {})
        return self._deep_get(ns_data, key)

    def _resolve_fallback(self, key: str, namespace: str) -> Optional[str]:
        """Resolve key from the fallback locale (English)."""
        fallback_translations = self._loader.load_all(FALLBACK_LOCALE)
        ns_data = fallback_translations.get(namespace, {})
        return self._deep_get(ns_data, key)

    def _deep_get(self, data: Dict, key: str) -> Optional[str]:
        """Navigate a nested dict using dot-separated key."""
        parts = key.split(".")
        current = data
        for part in parts:
            if not isinstance(current, dict):
                return None
            current = current.get(part)
        if current is None or isinstance(current, dict):
            return None
        return str(current)

    def _interpolate(self, template: str, variables: Dict[str, Any]) -> str:
        """
        Replace {{variable}} placeholders in a translation string.
        Supports i18next-style {{var}} syntax.
        """
        if not variables:
            return template
        for key, value in variables.items():
            template = template.replace(f"{{{{{key}}}}}", str(value))
        return template

    def _resolve_locale_code(self, code: str) -> Optional[SupportedLocale]:
        """Resolve a locale code string to a SupportedLocale enum."""
        normalized = code.lower().replace("-", "_")
        for loc in SupportedLocale:
            if loc.value.lower() == normalized:
                return loc
        # Try language tag map
        tag_normalized = code.lower().replace("_", "-")
        return LANGUAGE_TAG_MAP.get(tag_normalized)
