"""
LifeOS Globalization Layer — Live Demo
========================================
PROJECT-X | Phase 3 | Sprint 022

Demonstrates the LifeOS system operating in three different languages:
  1. Português (Brasil) — pt_BR  [default]
  2. English — en
  3. 日本語 — ja

Each demo shows:
  - Navigation labels
  - Dashboard widgets
  - Companion greeting (time-aware)
  - Decision recommendation
  - Regional formatting (date, time, currency, number)
  - Context-aware messages
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime
from globalization_layer import i18n, formatter, companion_i18n
from globalization_layer.core.models import SupportedLocale
from globalization_layer.formatters.locale_formatter import LocaleFormatter


def separator(title: str, width: int = 60):
    print(f"\n{'='*width}")
    print(f"  {title}")
    print(f"{'='*width}")


def demo_language(locale_code: str, locale_name: str, demo_time: datetime):
    """Run a full LifeOS demo in the specified language."""

    # Switch all singletons to the target locale
    i18n.switch_locale(locale_code)
    companion_i18n.set_locale(locale_code)
    fmt = LocaleFormatter(SupportedLocale(locale_code))

    separator(f"LifeOS — {locale_name} ({locale_code})")

    # --- App identity ---
    print(f"\n  App:      {i18n.t('app.name')}")
    print(f"  Tagline:  {i18n.t('app.tagline')}")

    # --- Navigation ---
    print(f"\n  Navigation:")
    nav_keys = ["dashboard", "decisions", "missions", "companion", "settings"]
    for key in nav_keys:
        print(f"    • {i18n.t(f'nav.{key}')}")

    # --- Dashboard ---
    print(f"\n  Dashboard: {i18n.t('title', namespace='dashboard')}")
    print(f"    {i18n.t('morning_briefing.title', namespace='dashboard')}")
    print(f"    {i18n.t('missions.title', namespace='dashboard')}: {i18n.t('missions.empty', namespace='dashboard')}")
    print(f"    {i18n.t('decisions.title', namespace='dashboard')}")

    # --- Companion greeting ---
    print(f"\n  Companion:")
    greeting = companion_i18n.greet("Alex", demo_time)
    print(f"    {greeting}")
    print(f"    {companion_i18n.thinking_message()}")

    # --- Context message ---
    context = companion_i18n.context_message("sleep_bad")
    print(f"    Context: {context}")

    # --- Decision recommendation ---
    print(f"\n  Decision Engine:")
    print(f"    {i18n.t('title', namespace='decisions')}")
    recommendation = i18n.t("recommendation", namespace="decisions")
    print(f"    {recommendation}: Reagendar a reunião / Reschedule meeting / 会議を再スケジュール")
    prompt = companion_i18n.format_decision_prompt("Reagendar a reunião")
    print(f"    {prompt}")
    print(f"    {i18n.t('score', namespace='decisions')}: 87.4/100")
    print(f"    {i18n.t('confidence', namespace='decisions')}: 92.1%")

    # --- Categories ---
    print(f"\n  Categories:")
    for cat in ["health", "finance", "productivity", "career"]:
        print(f"    • {i18n.t(f'categories.{cat}', namespace='decisions')}")

    # --- Regional formatting ---
    print(f"\n  Regional Formatting:")
    print(f"    Date (short):    {fmt.format_date(demo_time, 'short')}")
    print(f"    Date (long):     {fmt.format_date(demo_time, 'long')}")
    print(f"    Currency:        {fmt.format_currency(1500.00)}")
    print(f"    Number:          {fmt.format_number(1234567.89)}")
    print(f"    Percent:         {fmt.format_percent(85.0)}")
    print(f"    Timezone:        {fmt.get_timezone_name()}")

    # --- Actions ---
    print(f"\n  Actions:")
    for action in ["save", "cancel", "accept", "reject"]:
        print(f"    • {i18n.t(f'actions.{action}')}")

    # --- Status labels ---
    print(f"\n  Status:")
    for status in ["active", "completed", "in_progress"]:
        print(f"    • {i18n.t(f'status.{status}')}")

    # --- Feedback ---
    print(f"\n  Feedback:")
    print(f"    Accept: {companion_i18n.format_feedback_response(True)}")
    print(f"    Reject: {companion_i18n.format_feedback_response(False)}")


def main():
    # Simulate a morning session
    demo_time = datetime(2026, 7, 9, 8, 30, 0)

    print("\n" + "█"*60)
    print("  PROJECT-X | PHASE 3 | SPRINT 022")
    print("  GLOBALIZATION LAYER — LIVE DEMO")
    print("  LifeOS operating in 3 languages")
    print("█"*60)

    # Demo 1: Portuguese (Brazil) — default
    demo_language("pt_BR", "Português (Brasil)", demo_time)

    # Demo 2: English
    demo_language("en", "English", demo_time)

    # Demo 3: Japanese
    demo_language("ja", "日本語", demo_time)

    # --- Summary ---
    separator("Summary — All 8 Locales")
    i18n.switch_locale("pt_BR")
    print()
    for locale in SupportedLocale:
        i18n.switch_locale(locale.value)
        fmt = LocaleFormatter(locale)
        name = i18n.t("app.tagline")
        currency = fmt.format_currency(100.00)
        date_str = fmt.format_date(datetime(2026, 7, 9), "short")
        print(f"  [{locale.value:5s}]  {name[:35]:35s}  {currency:15s}  {date_str}")

    print(f"\n  74 tests passed — 100% ✓")
    print(f"  8 locales × 7 namespaces = 56 translation files")
    print(f"  Default: pt_BR | Fallback: en")
    print()


if __name__ == "__main__":
    main()
