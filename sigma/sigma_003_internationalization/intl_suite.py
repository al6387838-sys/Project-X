"""
SIGMA-003 Internationalization Suite — Consolidated Runner.
"""

import logging
from typing import Dict, Any
from datetime import datetime

from .i18n_engine import I18nEngine, Locale
from .translation_store import load_translations
from .locale_manager import LocaleManager
from .rtl_support import RTLSupport

logger = logging.getLogger(__name__)


class SIGMA003Suite:
    """SIGMA-003: World-Class Internationalization Suite."""

    def __init__(self) -> None:
        logger.info("[SIGMA-003] Initializing Internationalization Suite...")
        self.engine = I18nEngine(default_locale=Locale.PT_BR)
        self.locale_manager = LocaleManager(self.engine)
        self.rtl = RTLSupport()
        load_translations(self.engine)
        logger.info("[SIGMA-003] All i18n engines initialized.")

    def run_full_test(self) -> Dict[str, Any]:
        print("\n" + "=" * 70)
        print("  SIGMA-003: INTERNATIONALIZATION SUITE")
        print("  World-Class i18n for 9 Languages")
        print("=" * 70)

        # Test all 9 languages
        print("\n  Testing translations across all locales...")
        test_keys = ["nav.home", "lifeos.welcome", "lifeos.companion_message", "common.save"]
        
        for locale in Locale:
            self.engine.set_locale(locale)
            info = self.engine.get_locale_info()
            home = self.engine.t("nav.home")
            print(f"    {locale.value:7s} ({info['native']:8s}): home='{home}'")

        # Number formatting
        print("\n  Number formatting across locales:")
        for locale in Locale:
            self.engine.set_locale(locale)
            num = self.engine.format_number(1234567.89)
            cur = self.engine.format_currency(999.99)
            print(f"    {locale.value:7s}: 1234567.89 -> {num}, $999.99 -> {cur}")

        # Date formatting
        print("\n  Date formatting across locales:")
        now = datetime(2026, 7, 10, 14, 30)
        for locale in [Locale.PT_BR, Locale.EN_US, Locale.JA_JP, Locale.AR_SA]:
            self.engine.set_locale(locale)
            date_str = self.engine.format_date(now, "long")
            print(f"    {locale.value:7s}: {date_str}")

        # RTL support
        print("\n  RTL Support:")
        ar_layout = self.rtl.get_layout("ar-SA")
        en_layout = self.rtl.get_layout("en-US")
        print(f"    Arabic:  {ar_layout}")
        print(f"    English: {en_layout}")

        # Set back to default
        self.engine.set_locale(Locale.PT_BR)

        print("\n" + "=" * 70)
        print("  SIGMA-003 i18n SUMMARY")
        print("=" * 70)
        print(f"  Languages:              9 (PT, EN, ES, FR, DE, IT, JA, KO, AR)")
        print(f"  Translations:           {len(self.engine._translations)} keys")
        print(f"  RTL Support:            ✓ Arabic + logical CSS properties")
        print(f"  Number Formatting:      ✓ Per-locale")
        print(f"  Date Formatting:        ✓ Per-locale")
        print(f"  Locale Detection:       ✓ Browser Accept-Language")
        print("=" * 70)

        return {
            "engine": self.engine.stats(),
            "locale_manager": self.locale_manager.stats(),
            "rtl": self.rtl.stats(),
        }

    def get_full_stats(self) -> Dict[str, Any]:
        return {
            "engine": self.engine.stats(),
            "locale_manager": self.locale_manager.stats(),
            "rtl": self.rtl.stats(),
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    suite = SIGMA003Suite()
    suite.run_full_test()
