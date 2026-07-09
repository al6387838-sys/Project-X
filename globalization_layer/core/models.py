"""
Globalization Layer — Models
=============================
Data models and constants for the LifeOS i18n system.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class SupportedLocale(str, Enum):
    """All locales natively supported by LifeOS."""
    PT_BR = "pt_BR"   # Português (Brasil) — default
    EN    = "en"      # English
    ES    = "es"      # Español
    FR    = "fr"      # Français
    DE    = "de"      # Deutsch
    IT    = "it"      # Italiano
    JA    = "ja"      # 日本語
    ZH    = "zh"      # 中文


# Babel locale codes for formatting
BABEL_LOCALE_MAP = {
    SupportedLocale.PT_BR: "pt_BR",
    SupportedLocale.EN:    "en_US",
    SupportedLocale.ES:    "es_ES",
    SupportedLocale.FR:    "fr_FR",
    SupportedLocale.DE:    "de_DE",
    SupportedLocale.IT:    "it_IT",
    SupportedLocale.JA:    "ja_JP",
    SupportedLocale.ZH:    "zh_CN",
}

# Default timezone per locale
DEFAULT_TIMEZONE_MAP = {
    SupportedLocale.PT_BR: "America/Sao_Paulo",
    SupportedLocale.EN:    "America/New_York",
    SupportedLocale.ES:    "Europe/Madrid",
    SupportedLocale.FR:    "Europe/Paris",
    SupportedLocale.DE:    "Europe/Berlin",
    SupportedLocale.IT:    "Europe/Rome",
    SupportedLocale.JA:    "Asia/Tokyo",
    SupportedLocale.ZH:    "Asia/Shanghai",
}

# Currency code per locale
DEFAULT_CURRENCY_MAP = {
    SupportedLocale.PT_BR: "BRL",
    SupportedLocale.EN:    "USD",
    SupportedLocale.ES:    "EUR",
    SupportedLocale.FR:    "EUR",
    SupportedLocale.DE:    "EUR",
    SupportedLocale.IT:    "EUR",
    SupportedLocale.JA:    "JPY",
    SupportedLocale.ZH:    "CNY",
}

# Human-readable locale names (in their own language)
LOCALE_DISPLAY_NAMES = {
    SupportedLocale.PT_BR: "Português (Brasil)",
    SupportedLocale.EN:    "English",
    SupportedLocale.ES:    "Español",
    SupportedLocale.FR:    "Français",
    SupportedLocale.DE:    "Deutsch",
    SupportedLocale.IT:    "Italiano",
    SupportedLocale.JA:    "日本語",
    SupportedLocale.ZH:    "中文",
}

# Browser/OS language tag to SupportedLocale mapping
LANGUAGE_TAG_MAP = {
    "pt":    SupportedLocale.PT_BR,
    "pt-br": SupportedLocale.PT_BR,
    "pt_br": SupportedLocale.PT_BR,
    "en":    SupportedLocale.EN,
    "en-us": SupportedLocale.EN,
    "en-gb": SupportedLocale.EN,
    "es":    SupportedLocale.ES,
    "es-es": SupportedLocale.ES,
    "es-mx": SupportedLocale.ES,
    "fr":    SupportedLocale.FR,
    "fr-fr": SupportedLocale.FR,
    "de":    SupportedLocale.DE,
    "de-de": SupportedLocale.DE,
    "it":    SupportedLocale.IT,
    "it-it": SupportedLocale.IT,
    "ja":    SupportedLocale.JA,
    "ja-jp": SupportedLocale.JA,
    "zh":    SupportedLocale.ZH,
    "zh-cn": SupportedLocale.ZH,
    "zh-tw": SupportedLocale.ZH,
}

DEFAULT_LOCALE = SupportedLocale.PT_BR
FALLBACK_LOCALE = SupportedLocale.EN


@dataclass
class LocaleConfig:
    """Runtime locale configuration for a user session."""
    locale: SupportedLocale = DEFAULT_LOCALE
    timezone: str = "America/Sao_Paulo"
    currency: str = "BRL"
    date_format: str = "short"    # short | medium | long | full
    time_format: str = "short"
    number_format: str = "decimal"

    @classmethod
    def from_locale(cls, locale: SupportedLocale) -> "LocaleConfig":
        return cls(
            locale=locale,
            timezone=DEFAULT_TIMEZONE_MAP.get(locale, "UTC"),
            currency=DEFAULT_CURRENCY_MAP.get(locale, "USD"),
        )
