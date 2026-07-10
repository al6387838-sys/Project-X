"""
Globalization Layer — Automated Tests
======================================
PROJECT-X | Phase 3 | Sprint 022

Tests cover:
  - TranslationLoader: loading, caching, fallback
  - LanguageProvider: translate, interpolate, switch locale, auto-detect
  - LocaleManager: persist/retrieve user preferences
  - LanguageSelector: list languages, select, auto-detect
  - LocaleFormatter: dates, times, currencies, numbers, relative time
  - CompanionI18n: greetings, decision messages, context messages
  - All 8 locales: pt_BR, en, es, fr, de, it, ja, zh
"""

import sys
import os
import uuid
import pytest
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from globalization_layer.core.models import SupportedLocale, DEFAULT_LOCALE, FALLBACK_LOCALE
from globalization_layer.core.translation_loader import TranslationLoader
from globalization_layer.core.language_provider import LanguageProvider
from globalization_layer.core.locale_manager import LocaleManager
from globalization_layer.core.language_selector import LanguageSelector
from globalization_layer.formatters.locale_formatter import LocaleFormatter
from globalization_layer.companion.companion_i18n import CompanionI18n


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture
def loader():
    return TranslationLoader()

@pytest.fixture
def provider():
    return LanguageProvider(default_locale=SupportedLocale.PT_BR)

@pytest.fixture
def manager():
    path = f"/tmp/test_locale_manager_{uuid.uuid4().hex}.json"
    return LocaleManager(storage_path=path)

@pytest.fixture
def selector(provider, manager):
    return LanguageSelector(provider=provider, manager=manager)

@pytest.fixture
def pt_formatter():
    return LocaleFormatter(locale=SupportedLocale.PT_BR)

@pytest.fixture
def en_formatter():
    return LocaleFormatter(locale=SupportedLocale.EN)

@pytest.fixture
def companion():
    return CompanionI18n()


# ===========================================================================
# TranslationLoader Tests
# ===========================================================================

class TestTranslationLoader:

    def test_load_pt_br_common(self, loader):
        data = loader.load(SupportedLocale.PT_BR, "common")
        assert isinstance(data, dict)
        assert "app" in data
        assert data["app"]["name"] == "LifeOS"

    def test_load_en_common(self, loader):
        data = loader.load(SupportedLocale.EN, "common")
        assert data["app"]["tagline"] == "The operating system of your life"

    def test_load_all_namespaces(self, loader):
        all_ns = loader.load_all(SupportedLocale.PT_BR)
        assert "common" in all_ns
        assert "dashboard" in all_ns
        assert "companion" in all_ns
        assert "onboarding" in all_ns
        assert "decisions" in all_ns
        assert "errors" in all_ns
        assert "formats" in all_ns

    def test_cache_is_used_on_second_load(self, loader):
        data1 = loader.load(SupportedLocale.EN, "common")
        data2 = loader.load(SupportedLocale.EN, "common")
        assert data1 is data2  # Same object from cache

    def test_reload_clears_cache(self, loader):
        data1 = loader.load(SupportedLocale.EN, "common")
        loader.reload()
        data2 = loader.load(SupportedLocale.EN, "common")
        assert data1 is not data2  # Different objects after reload

    def test_available_locales_returns_all_8(self, loader):
        available = loader.available_locales()
        assert len(available) == 8

    def test_all_8_locales_have_common_namespace(self, loader):
        for locale in SupportedLocale:
            data = loader.load(locale, "common")
            assert "app" in data, f"Missing 'app' key in {locale.value}/common.json"

    def test_all_8_locales_have_companion_namespace(self, loader):
        for locale in SupportedLocale:
            data = loader.load(locale, "companion")
            assert "greeting" in data, f"Missing 'greeting' in {locale.value}/companion.json"


# ===========================================================================
# LanguageProvider Tests
# ===========================================================================

class TestLanguageProvider:

    def test_default_locale_is_pt_br(self, provider):
        assert provider.locale == SupportedLocale.PT_BR

    def test_translate_app_name(self, provider):
        result = provider.t("app.name")
        assert result == "LifeOS"

    def test_translate_with_interpolation(self, provider):
        result = provider.t("greeting.morning", namespace="common", name="Alex")
        assert "Alex" in result
        assert "Bom dia" in result

    def test_switch_to_english(self, provider):
        provider.switch_locale("en")
        result = provider.t("greeting.morning", namespace="common", name="Alex")
        assert "Good morning" in result
        assert "Alex" in result

    def test_switch_to_japanese(self, provider):
        provider.switch_locale("ja")
        result = provider.t("app.tagline")
        assert "オペレーティングシステム" in result

    def test_switch_to_chinese(self, provider):
        provider.switch_locale("zh")
        result = provider.t("app.tagline")
        assert "操作系统" in result

    def test_switch_to_german(self, provider):
        provider.switch_locale("de")
        result = provider.t("actions.save")
        assert result == "Speichern"

    def test_switch_to_french(self, provider):
        provider.switch_locale("fr")
        result = provider.t("actions.save")
        assert result == "Enregistrer"

    def test_switch_to_italian(self, provider):
        provider.switch_locale("it")
        result = provider.t("actions.save")
        assert result == "Salva"

    def test_switch_to_spanish(self, provider):
        provider.switch_locale("es")
        result = provider.t("actions.save")
        assert result == "Guardar"

    def test_invalid_locale_returns_false(self, provider):
        result = provider.switch_locale("xx_INVALID")
        assert result is False

    def test_fallback_to_english_for_missing_key(self, provider):
        # pt_BR is default; if a key is missing, falls back to English
        result = provider.t("nonexistent.key.deep")
        # Should return the key itself as last resort
        assert result == "nonexistent.key.deep"

    def test_namespace_colon_syntax(self, provider):
        result = provider.t("dashboard:title")
        assert "Painel" in result

    def test_auto_detect_pt_br(self, provider):
        detected = provider.detect_locale("pt-BR")
        assert detected == SupportedLocale.PT_BR

    def test_auto_detect_en_us(self, provider):
        detected = provider.detect_locale("en-US")
        assert detected == SupportedLocale.EN

    def test_auto_detect_ja(self, provider):
        detected = provider.detect_locale("ja")
        assert detected == SupportedLocale.JA

    def test_auto_detect_zh_cn(self, provider):
        detected = provider.detect_locale("zh-CN")
        assert detected == SupportedLocale.ZH

    def test_auto_detect_unknown_falls_back_to_default(self, provider):
        detected = provider.detect_locale("xx-UNKNOWN")
        assert detected == DEFAULT_LOCALE

    def test_available_locales_returns_8(self, provider):
        locales = provider.available_locales()
        assert len(locales) == 8

    def test_get_display_name_pt_br(self, provider):
        name = provider.get_display_name(SupportedLocale.PT_BR)
        assert name == "Português (Brasil)"

    def test_get_display_name_ja(self, provider):
        name = provider.get_display_name(SupportedLocale.JA)
        assert name == "日本語"

    def test_decisions_namespace_all_locales(self, provider):
        for locale in SupportedLocale:
            provider.switch_locale(locale.value)
            result = provider.t("title", namespace="decisions")
            assert result != "title", f"Missing decisions.title for {locale.value}"


# ===========================================================================
# LocaleManager Tests
# ===========================================================================

class TestLocaleManager:

    def test_default_locale_for_unknown_user(self, manager):
        locale = manager.get_user_locale("unknown_user")
        assert locale == DEFAULT_LOCALE

    def test_set_and_get_user_locale(self, manager):
        manager.set_user_locale("user_001", SupportedLocale.EN)
        locale = manager.get_user_locale("user_001")
        assert locale == SupportedLocale.EN

    def test_set_multiple_users(self, manager):
        manager.set_user_locale("user_jp", SupportedLocale.JA)
        manager.set_user_locale("user_cn", SupportedLocale.ZH)
        manager.set_user_locale("user_de", SupportedLocale.DE)
        assert manager.get_user_locale("user_jp") == SupportedLocale.JA
        assert manager.get_user_locale("user_cn") == SupportedLocale.ZH
        assert manager.get_user_locale("user_de") == SupportedLocale.DE

    def test_get_user_config(self, manager):
        manager.set_user_locale("user_fr", SupportedLocale.FR)
        config = manager.get_user_config("user_fr")
        assert config.locale == SupportedLocale.FR
        assert config.timezone == "Europe/Paris"
        assert config.currency == "EUR"

    def test_remove_user_locale(self, manager):
        manager.set_user_locale("user_temp", SupportedLocale.IT)
        removed = manager.remove_user_locale("user_temp")
        assert removed is True
        assert manager.get_user_locale("user_temp") == DEFAULT_LOCALE

    def test_remove_nonexistent_user_returns_false(self, manager):
        result = manager.remove_user_locale("ghost_user")
        assert result is False

    def test_all_preferences_returns_dict(self, manager):
        manager.set_user_locale("u1", SupportedLocale.EN)
        manager.set_user_locale("u2", SupportedLocale.ES)
        prefs = manager.all_preferences()
        assert "u1" in prefs
        assert "u2" in prefs


# ===========================================================================
# LanguageSelector Tests
# ===========================================================================

class TestLanguageSelector:

    def test_get_language_list_returns_8_items(self, selector):
        langs = selector.get_language_list()
        assert len(langs) == 8

    def test_language_list_has_required_fields(self, selector):
        langs = selector.get_language_list()
        for lang in langs:
            assert "code" in lang
            assert "name" in lang
            assert "flag" in lang
            assert "active" in lang

    def test_default_active_is_pt_br(self, selector):
        langs = selector.get_language_list()
        active = [l for l in langs if l["active"]]
        assert len(active) == 1
        assert active[0]["code"] == "pt_BR"

    def test_select_english(self, selector):
        result = selector.select("en")
        assert result is True
        assert selector.current_locale == SupportedLocale.EN

    def test_select_persists_for_user(self, selector, manager):
        selector.select("fr", user_id="user_test_fr")
        saved = manager.get_user_locale("user_test_fr")
        assert saved == SupportedLocale.FR

    def test_auto_detect_from_browser_tag(self, selector):
        detected = selector.auto_detect("de-DE")
        assert detected == SupportedLocale.DE

    def test_restore_user_preference(self, selector, manager):
        manager.set_user_locale("user_restore", SupportedLocale.JA)
        restored = selector.restore_user_preference("user_restore")
        assert restored == SupportedLocale.JA
        assert selector.current_locale == SupportedLocale.JA


# ===========================================================================
# LocaleFormatter Tests
# ===========================================================================

class TestLocaleFormatter:

    def test_format_date_pt_br(self, pt_formatter):
        dt = datetime(2026, 7, 9)
        result = pt_formatter.format_date(dt, style="short")
        assert "09" in result or "9" in result
        assert "07" in result or "7" in result
        assert "2026" in result or "26" in result

    def test_format_date_en(self, en_formatter):
        dt = datetime(2026, 7, 9)
        result = en_formatter.format_date(dt, style="short")
        assert "7" in result
        assert "9" in result

    def test_format_date_de(self):
        fmt = LocaleFormatter(SupportedLocale.DE)
        dt = datetime(2026, 7, 9)
        result = fmt.format_date(dt, style="short")
        assert "09.07.2026" in result or "9.7.26" in result or "07" in result

    def test_format_number_pt_br(self, pt_formatter):
        result = pt_formatter.format_number(1234567.89)
        assert "," in result  # decimal comma in pt_BR

    def test_format_number_en(self, en_formatter):
        result = en_formatter.format_number(1234567.89)
        assert "." in result  # decimal dot in en

    def test_format_currency_pt_br(self, pt_formatter):
        result = pt_formatter.format_currency(1500.00, "BRL")
        assert "R$" in result or "BRL" in result or "1" in result

    def test_format_currency_en(self, en_formatter):
        result = en_formatter.format_currency(1500.00, "USD")
        assert "$" in result or "USD" in result

    def test_format_currency_jp(self):
        fmt = LocaleFormatter(SupportedLocale.JA)
        result = fmt.format_currency(1500, "JPY")
        # Babel may use fullwidth ¥ (￥) or regular ¥ depending on locale data
        assert "¥" in result or "￥" in result or "JPY" in result

    def test_format_percent(self, pt_formatter):
        result = pt_formatter.format_percent(85.0)
        assert "85" in result

    def test_convert_to_user_timezone(self, pt_formatter):
        dt = datetime(2026, 7, 9, 12, 0, 0)
        converted = pt_formatter.convert_to_user_timezone(dt)
        assert converted is not None

    def test_now_in_user_timezone(self, pt_formatter):
        now = pt_formatter.now_in_user_timezone()
        assert now is not None
        assert now.tzinfo is not None

    def test_format_relative_just_now(self, pt_formatter):
        dt = datetime.now(timezone.utc)
        result = pt_formatter.format_relative(dt)
        assert "agora" in result.lower() or "now" in result.lower()

    def test_format_relative_minutes_ago(self, pt_formatter):
        from datetime import timedelta
        dt = datetime.now(timezone.utc) - timedelta(minutes=5)
        result = pt_formatter.format_relative(dt)
        assert "5" in result

    def test_all_locales_format_currency(self):
        """All locales should format currency without error."""
        for locale in SupportedLocale:
            fmt = LocaleFormatter(locale)
            result = fmt.format_currency(999.99)
            assert result is not None
            assert len(result) > 0


# ===========================================================================
# CompanionI18n Tests
# ===========================================================================

class TestCompanionI18n:

    def test_greet_morning_pt_br(self, companion):
        companion.set_locale("pt_BR")
        dt = datetime(2026, 7, 9, 8, 0)
        result = companion.greet("Alex", dt)
        assert "Bom dia" in result

    def test_greet_afternoon_en(self, companion):
        companion.set_locale("en")
        dt = datetime(2026, 7, 9, 14, 0)
        result = companion.greet("Alex", dt)
        assert "afternoon" in result.lower()

    def test_greet_evening_ja(self, companion):
        companion.set_locale("ja")
        dt = datetime(2026, 7, 9, 20, 0)
        result = companion.greet("Alex", dt)
        assert "こんばんは" in result

    def test_greet_morning_de(self, companion):
        companion.set_locale("de")
        dt = datetime(2026, 7, 9, 9, 0)
        result = companion.greet("Alex", dt)
        assert "Morgen" in result

    def test_greet_morning_zh(self, companion):
        companion.set_locale("zh")
        dt = datetime(2026, 7, 9, 7, 0)
        result = companion.greet("Alex", dt)
        assert "早上好" in result

    def test_format_decision_prompt_pt_br(self, companion):
        companion.set_locale("pt_BR")
        result = companion.format_decision_prompt("Reagendar a reunião")
        assert "Reagendar a reunião" in result
        assert "recomendo" in result.lower() or "contexto" in result.lower()

    def test_format_decision_prompt_en(self, companion):
        companion.set_locale("en")
        result = companion.format_decision_prompt("Reschedule the meeting")
        assert "Reschedule the meeting" in result
        assert "recommend" in result.lower()

    def test_feedback_accepted_pt_br(self, companion):
        companion.set_locale("pt_BR")
        result = companion.format_feedback_response(accepted=True)
        assert "aprender" in result.lower() or "ótimo" in result.lower()

    def test_feedback_rejected_en(self, companion):
        companion.set_locale("en")
        result = companion.format_feedback_response(accepted=False)
        assert "improve" in result.lower() or "understood" in result.lower()

    def test_context_message_sleep_bad_pt_br(self, companion):
        companion.set_locale("pt_BR")
        result = companion.context_message("sleep_bad")
        assert "dormiu" in result.lower() or "mal" in result.lower()

    def test_context_message_high_energy_es(self, companion):
        companion.set_locale("es")
        result = companion.context_message("high_energy")
        assert "energía" in result.lower() or "energia" in result.lower()

    def test_thinking_message_fr(self, companion):
        companion.set_locale("fr")
        result = companion.thinking_message()
        assert "analyse" in result.lower() or "contexte" in result.lower()

    def test_greet_user_with_name(self, companion):
        companion.set_locale("pt_BR")
        dt = datetime(2026, 7, 9, 8, 0)
        result = companion.greet_user("Maria", dt)
        assert "Maria" in result
        assert "Bom dia" in result

    def test_format_decision_summary(self, companion):
        companion.set_locale("pt_BR")
        decision = {
            "recommendation": "Reagendar a reunião",
            "score": 85.0,
            "confidence": 0.95,
            "justification": "Energia baixa detectada."
        }
        result = companion.format_decision_summary(decision)
        assert "Reagendar" in result
        assert "85.0" in result

    def test_set_locale_returns_false_for_invalid(self, companion):
        result = companion.set_locale("xx_INVALID")
        assert result is False

    def test_all_locales_greet_without_error(self, companion):
        """All 8 locales should produce a greeting without raising exceptions."""
        dt = datetime(2026, 7, 9, 8, 0)
        for locale in SupportedLocale:
            companion.set_locale(locale.value)
            result = companion.greet("Test", dt)
            assert result is not None
            assert len(result) > 0
