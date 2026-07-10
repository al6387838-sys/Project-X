"""
SIGMA-003: Internationalization
===============================
World-Class i18n Suite for LifeOS.

Supported Languages:
- Português (pt-BR)
- English (en-US)
- Español (es-ES)
- Français (fr-FR)
- Deutsch (de-DE)
- Italiano (it-IT)
- 日本語 (ja-JP)
- 한국어 (ko-KR)
- العربية (ar-SA) — RTL support
"""

from .i18n_engine import I18nEngine, Locale
from .locale_manager import LocaleManager
from .translation_store import LIFEOS_TRANSLATIONS, load_translations, get_available_locales
from .rtl_support import RTLSupport
from .intl_suite import SIGMA003Suite

__all__ = [
    "I18nEngine",
    "Locale",
    "LocaleManager",
    "LIFEOS_TRANSLATIONS", "load_translations", "get_available_locales",
    "RTLSupport",
    "SIGMA003Suite",
]
