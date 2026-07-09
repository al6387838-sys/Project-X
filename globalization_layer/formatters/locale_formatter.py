"""
Locale Formatter
================
Regional formatting for dates, times, currencies, numbers and timezones.
Uses Babel for locale-aware formatting — the same engine behind Flask-Babel
and many production i18n systems.

Supported formats per locale:
  - Date: short, medium, long, full
  - Time: short, medium, long
  - Currency: locale-aware symbol placement and decimal rules
  - Number: decimal/thousands separators per locale
  - Timezone: convert and display in user's local timezone
"""

from datetime import datetime, date
from typing import Union, Optional
import pytz

from babel import Locale
from babel.dates import format_date, format_time, format_datetime
from babel.numbers import format_currency, format_decimal

from ..core.models import (
    SupportedLocale,
    LocaleConfig,
    BABEL_LOCALE_MAP,
    DEFAULT_TIMEZONE_MAP,
    DEFAULT_CURRENCY_MAP,
)


class LocaleFormatter:
    """
    Formats dates, times, currencies and numbers according to a locale's
    regional conventions.
    """

    def __init__(self, locale: SupportedLocale = SupportedLocale.PT_BR):
        self._locale = locale
        self._babel_locale = BABEL_LOCALE_MAP.get(locale, "pt_BR")
        self._timezone = DEFAULT_TIMEZONE_MAP.get(locale, "UTC")
        self._currency = DEFAULT_CURRENCY_MAP.get(locale, "BRL")

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    def set_locale(self, locale: SupportedLocale):
        self._locale = locale
        self._babel_locale = BABEL_LOCALE_MAP.get(locale, "pt_BR")
        self._timezone = DEFAULT_TIMEZONE_MAP.get(locale, "UTC")
        self._currency = DEFAULT_CURRENCY_MAP.get(locale, "BRL")

    def set_timezone(self, timezone: str):
        """Override the timezone (e.g. 'America/New_York')."""
        self._timezone = timezone

    def set_currency(self, currency: str):
        """Override the currency code (e.g. 'EUR')."""
        self._currency = currency

    # ------------------------------------------------------------------
    # Date formatting
    # ------------------------------------------------------------------

    def format_date(
        self,
        value: Union[datetime, date],
        style: str = "short",
    ) -> str:
        """
        Format a date according to the locale.

        Args:
            value: datetime or date object
            style: 'short' | 'medium' | 'long' | 'full'

        Returns:
            Locale-formatted date string.

        Examples:
            pt_BR short: 09/07/2026
            en    short: 7/9/26
            de    short: 09.07.2026
            ja    short: 2026/07/09
        """
        if isinstance(value, datetime):
            value = value.date()
        return format_date(value, format=style, locale=self._babel_locale)

    def format_time(
        self,
        value: datetime,
        style: str = "short",
        timezone: str = None,
    ) -> str:
        """
        Format a time according to the locale.

        Args:
            value: datetime object
            style: 'short' | 'medium' | 'long'
            timezone: override timezone string

        Returns:
            Locale-formatted time string.

        Examples:
            pt_BR short: 14:30
            en    short: 2:30 PM
            ja    short: 14:30
        """
        tz = pytz.timezone(timezone or self._timezone)
        if value.tzinfo is None:
            value = pytz.utc.localize(value)
        value = value.astimezone(tz)
        return format_time(value, format=style, locale=self._babel_locale, tzinfo=tz)

    def format_datetime(
        self,
        value: datetime,
        date_style: str = "short",
        time_style: str = "short",
        timezone: str = None,
    ) -> str:
        """
        Format a full datetime according to the locale.

        Examples:
            pt_BR: 09/07/2026 14:30
            en:    7/9/26, 2:30 PM
            de:    09.07.2026, 14:30
        """
        tz = pytz.timezone(timezone or self._timezone)
        if value.tzinfo is None:
            value = pytz.utc.localize(value)
        value = value.astimezone(tz)
        return format_datetime(
            value,
            format=f"{date_style}",
            locale=self._babel_locale,
            tzinfo=tz,
        )

    def format_relative(self, value: datetime) -> str:
        """
        Format a datetime as a relative time string.
        e.g. "2 hours ago", "há 2 horas", "vor 2 Stunden"
        """
        now = datetime.utcnow()
        if value.tzinfo is not None:
            now = pytz.utc.localize(now)
        diff = now - value
        seconds = int(diff.total_seconds())

        if seconds < 60:
            return self._relative_label("just_now", seconds)
        elif seconds < 3600:
            minutes = seconds // 60
            return self._relative_label("minutes_ago", minutes)
        elif seconds < 86400:
            hours = seconds // 3600
            return self._relative_label("hours_ago", hours)
        else:
            days = seconds // 86400
            return self._relative_label("days_ago", days)

    def _relative_label(self, key: str, count: int = 0) -> str:
        """Return a relative time label using locale-specific patterns."""
        labels = {
            SupportedLocale.PT_BR: {
                "just_now": "agora mesmo",
                "minutes_ago": f"{count} minuto(s) atrás",
                "hours_ago": f"{count} hora(s) atrás",
                "days_ago": f"{count} dia(s) atrás",
            },
            SupportedLocale.EN: {
                "just_now": "just now",
                "minutes_ago": f"{count} minute(s) ago",
                "hours_ago": f"{count} hour(s) ago",
                "days_ago": f"{count} day(s) ago",
            },
            SupportedLocale.ES: {
                "just_now": "ahora mismo",
                "minutes_ago": f"hace {count} minuto(s)",
                "hours_ago": f"hace {count} hora(s)",
                "days_ago": f"hace {count} día(s)",
            },
            SupportedLocale.FR: {
                "just_now": "à l'instant",
                "minutes_ago": f"il y a {count} minute(s)",
                "hours_ago": f"il y a {count} heure(s)",
                "days_ago": f"il y a {count} jour(s)",
            },
            SupportedLocale.DE: {
                "just_now": "gerade eben",
                "minutes_ago": f"vor {count} Minute(n)",
                "hours_ago": f"vor {count} Stunde(n)",
                "days_ago": f"vor {count} Tag(en)",
            },
            SupportedLocale.IT: {
                "just_now": "proprio ora",
                "minutes_ago": f"{count} minuto/i fa",
                "hours_ago": f"{count} ora/e fa",
                "days_ago": f"{count} giorno/i fa",
            },
            SupportedLocale.JA: {
                "just_now": "たった今",
                "minutes_ago": f"{count}分前",
                "hours_ago": f"{count}時間前",
                "days_ago": f"{count}日前",
            },
            SupportedLocale.ZH: {
                "just_now": "刚刚",
                "minutes_ago": f"{count}分钟前",
                "hours_ago": f"{count}小时前",
                "days_ago": f"{count}天前",
            },
        }
        locale_labels = labels.get(self._locale, labels[SupportedLocale.EN])
        return locale_labels.get(key, key)

    # ------------------------------------------------------------------
    # Number formatting
    # ------------------------------------------------------------------

    def format_number(self, value: Union[int, float], decimal_places: int = 2) -> str:
        """
        Format a number with locale-specific separators.

        Examples:
            pt_BR: 1.234,56
            en:    1,234.56
            de:    1.234,56
            fr:    1 234,56
        """
        fmt = f"#,##0.{'0' * decimal_places}" if decimal_places > 0 else "#,##0"
        return format_decimal(value, format=fmt, locale=self._babel_locale)

    def format_percent(self, value: float) -> str:
        """
        Format a float as a percentage.

        Examples:
            pt_BR: 85%
            en:    85%
            de:    85 %
        """
        return format_decimal(value / 100, format="0%", locale=self._babel_locale)

    # ------------------------------------------------------------------
    # Currency formatting
    # ------------------------------------------------------------------

    def format_currency(
        self,
        amount: Union[int, float],
        currency: str = None,
    ) -> str:
        """
        Format a monetary amount with locale-specific symbol and placement.

        Examples:
            pt_BR BRL: R$ 1.234,56
            en    USD: $1,234.56
            de    EUR: 1.234,56 €
            ja    JPY: ¥1,235
        """
        currency_code = currency or self._currency
        return format_currency(
            amount,
            currency_code,
            locale=self._babel_locale,
        )

    # ------------------------------------------------------------------
    # Timezone utilities
    # ------------------------------------------------------------------

    def convert_to_user_timezone(self, dt: datetime, timezone: str = None) -> datetime:
        """Convert a UTC datetime to the user's local timezone."""
        tz = pytz.timezone(timezone or self._timezone)
        if dt.tzinfo is None:
            dt = pytz.utc.localize(dt)
        return dt.astimezone(tz)

    def get_timezone_name(self, timezone: str = None) -> str:
        """Return the display name of a timezone."""
        tz_str = timezone or self._timezone
        try:
            tz = pytz.timezone(tz_str)
            return tz.zone
        except Exception:
            return tz_str

    def now_in_user_timezone(self, timezone: str = None) -> datetime:
        """Return the current datetime in the user's timezone."""
        tz = pytz.timezone(timezone or self._timezone)
        return datetime.now(tz)
