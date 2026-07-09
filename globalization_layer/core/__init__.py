"""
Globalization Layer — Core
===========================
Core i18n infrastructure for LifeOS.
"""

from .models import (
    SupportedLocale,
    LocaleConfig,
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    LOCALE_DISPLAY_NAMES,
    BABEL_LOCALE_MAP,
    DEFAULT_TIMEZONE_MAP,
    DEFAULT_CURRENCY_MAP,
)
from .translation_loader import TranslationLoader
from .language_provider import LanguageProvider
from .locale_manager import LocaleManager
from .language_selector import LanguageSelector

__all__ = [
    "SupportedLocale",
    "LocaleConfig",
    "DEFAULT_LOCALE",
    "FALLBACK_LOCALE",
    "LOCALE_DISPLAY_NAMES",
    "BABEL_LOCALE_MAP",
    "DEFAULT_TIMEZONE_MAP",
    "DEFAULT_CURRENCY_MAP",
    "TranslationLoader",
    "LanguageProvider",
    "LocaleManager",
    "LanguageSelector",
]
