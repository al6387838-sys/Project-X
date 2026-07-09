"""
Companion i18n Bridge
=====================
Makes the LifeOS Companion speak in the user's language automatically.

The Companion uses the active locale to:
  - Select greeting messages by time of day
  - Deliver decision recommendations in the user's language
  - Provide context-aware messages (sleep quality, energy, etc.)
  - Format dates, times and numbers in the response
"""

from datetime import datetime
from typing import Optional, Dict, Any

from ..core.language_provider import LanguageProvider
from ..core.models import SupportedLocale, DEFAULT_LOCALE
from ..formatters.locale_formatter import LocaleFormatter


class CompanionI18n:
    """
    Wraps the Companion's message generation with i18n support.
    All messages are returned in the user's active locale.
    """

    def __init__(
        self,
        provider: LanguageProvider = None,
        formatter: LocaleFormatter = None,
    ):
        self._provider = provider or LanguageProvider()
        self._formatter = formatter or LocaleFormatter()

    # ------------------------------------------------------------------
    # Locale management
    # ------------------------------------------------------------------

    def set_locale(self, locale_code: str) -> bool:
        """Set the Companion's active language."""
        success = self._provider.set_locale(locale_code)
        if success:
            self._formatter.set_locale(self._provider.locale)
        return success

    @property
    def locale(self) -> SupportedLocale:
        return self._provider.locale

    # ------------------------------------------------------------------
    # Greeting messages
    # ------------------------------------------------------------------

    def greet(self, name: str, dt: datetime = None) -> str:
        """
        Return a time-aware greeting in the user's language.

        Examples:
            pt_BR 08:00 → "Bom dia! Como posso simplificar seu dia hoje?"
            en    14:00 → "Good afternoon! How can I help?"
            ja    20:00 → "こんばんは！今日を振り返りましょうか？"
        """
        now = dt or datetime.now()
        hour = now.hour

        if 5 <= hour < 12:
            key = "morning"
        elif 12 <= hour < 18:
            key = "afternoon"
        else:
            key = "evening"

        return self._provider.t(f"greeting.{key}", namespace="companion")

    def greet_user(self, name: str, dt: datetime = None) -> str:
        """Return a personalized greeting combining common + companion namespaces."""
        now = dt or datetime.now()
        hour = now.hour

        if 5 <= hour < 12:
            key = "morning"
        elif 12 <= hour < 18:
            key = "afternoon"
        else:
            key = "evening"

        return self._provider.t(f"greeting.{key}", namespace="common", name=name)

    # ------------------------------------------------------------------
    # Decision messages
    # ------------------------------------------------------------------

    def format_decision_prompt(self, recommendation: str) -> str:
        """
        Format a decision recommendation message in the user's language.

        Example:
            pt_BR → "Com base no seu contexto, recomendo: Reagendar a reunião"
            en    → "Based on your context, I recommend: Reschedule the meeting"
        """
        return self._provider.t(
            "decision_prompt",
            namespace="companion",
            recommendation=recommendation,
        )

    def format_feedback_response(self, accepted: bool) -> str:
        """Return a feedback acknowledgment in the user's language."""
        key = "accepted" if accepted else "rejected"
        return self._provider.t(f"feedback.{key}", namespace="companion")

    # ------------------------------------------------------------------
    # Context-aware messages
    # ------------------------------------------------------------------

    def context_message(self, context_key: str) -> str:
        """
        Return a context-aware message in the user's language.

        Args:
            context_key: One of 'sleep_bad', 'high_energy', 'low_energy', 'busy_day'

        Examples:
            pt_BR sleep_bad → "Percebi que você dormiu mal. Vou ajustar minhas sugestões."
            de    sleep_bad → "Ich habe bemerkt, dass du schlecht geschlafen hast."
        """
        return self._provider.t(f"context.{context_key}", namespace="companion")

    def thinking_message(self) -> str:
        """Return the 'thinking' message in the user's language."""
        return self._provider.t("thinking", namespace="companion")

    def ready_message(self) -> str:
        """Return the 'ready' message in the user's language."""
        return self._provider.t("ready", namespace="companion")

    # ------------------------------------------------------------------
    # Formatted responses
    # ------------------------------------------------------------------

    def format_decision_summary(self, decision: Dict[str, Any]) -> str:
        """
        Format a complete decision summary in the user's language.

        Args:
            decision: dict with keys: recommendation, score, confidence, category

        Returns:
            Formatted multi-line string in the user's language.
        """
        i18n = self._provider
        lines = [
            f"{'='*50}",
            f"  {i18n.t('recommendation', namespace='decisions')}",
            f"  {decision.get('recommendation', '')}",
            f"",
            f"  {i18n.t('score', namespace='decisions')}: {decision.get('score', 0):.1f}/100",
            f"  {i18n.t('confidence', namespace='decisions')}: {decision.get('confidence', 0)*100:.1f}%",
            f"",
            f"  {i18n.t('justification', namespace='decisions')}:",
            f"  {decision.get('justification', '')}",
            f"{'='*50}",
        ]
        return "\n".join(lines)

    def format_datetime_for_user(self, dt: datetime, style: str = "medium") -> str:
        """Format a datetime in the user's locale and timezone."""
        return self._formatter.format_datetime(dt, date_style=style, time_style="short")

    def format_currency_for_user(self, amount: float, currency: str = None) -> str:
        """Format a currency amount in the user's locale."""
        return self._formatter.format_currency(amount, currency)
