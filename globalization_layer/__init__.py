"""
Globalization Layer — LifeOS i18n System
=========================================
PROJECT-X | Phase 3 | Sprint 022

Complete internationalization infrastructure for LifeOS.
Supports 8 languages natively with auto-detection, regional formatting
and dynamic language switching.

Supported locales:
    pt_BR  — Português (Brasil)  [default]
    en     — English
    es     — Español
    fr     — Français
    de     — Deutsch
    it     — Italiano
    ja     — 日本語
    zh     — 中文

Quick start:
    from globalization_layer import i18n, formatter, companion_i18n

    # Translate a key
    text = i18n.t("greeting.morning", namespace="common", name="Alex")

    # Switch language
    i18n.switch_locale("en")

    # Format a date
    from datetime import datetime
    formatter.set_locale(i18n.locale)
    date_str = formatter.format_date(datetime.now(), style="long")

    # Companion speaks in the user's language
    companion_i18n.set_locale("ja")
    greeting = companion_i18n.greet("Alex")
"""

from .core import (
    SupportedLocale,
    LocaleConfig,
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    LOCALE_DISPLAY_NAMES,
    TranslationLoader,
    LanguageProvider,
    LocaleManager,
    LanguageSelector,
)
from .formatters import LocaleFormatter
from .companion import CompanionI18n

# Singleton instances for convenience
i18n = LanguageProvider()
formatter = LocaleFormatter()
locale_manager = LocaleManager()
language_selector = LanguageSelector(provider=i18n, manager=locale_manager)
companion_i18n = CompanionI18n(provider=i18n, formatter=formatter)

__version__ = "1.0.0"
__sprint__ = "022"

__all__ = [
    # Core
    "SupportedLocale",
    "LocaleConfig",
    "DEFAULT_LOCALE",
    "FALLBACK_LOCALE",
    "LOCALE_DISPLAY_NAMES",
    "TranslationLoader",
    "LanguageProvider",
    "LocaleManager",
    "LanguageSelector",
    # Formatters
    "LocaleFormatter",
    # Companion
    "CompanionI18n",
    # Singletons
    "i18n",
    "formatter",
    "locale_manager",
    "language_selector",
    "companion_i18n",
]
