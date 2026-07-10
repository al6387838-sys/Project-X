"""
RTL Support — Right-to-Left layout for Arabic and future RTL languages.
SIGMA-003: Internationalization
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class RTLLayout:
    """RTL layout configuration."""
    direction: str = "rtl"
    text_align: str = "right"
    margin_start: str = "margin-inline-start"
    margin_end: str = "margin-inline-end"
    padding_start: str = "padding-inline-start"
    padding_end: str = "padding-inline-end"
    float_start: str = "float: inline-start"
    float_end: str = "float: inline-end"
    flex_direction: str = "row-reverse"


class RTLSupport:
    """
    World-Class RTL Support for LifeOS.

    SIGMA-003: Full RTL layout support for Arabic and future RTL languages.
    """

    def __init__(self, name: str = "rtl_support") -> None:
        self.name = name
        self._rtl_locales = {"ar-SA", "he-IL", "fa-IR", "ur-PK"}
        self._layout = RTLLayout()

    def is_rtl(self, locale_code: str) -> bool:
        return locale_code in self._rtl_locales

    def get_layout(self, locale_code: str) -> Dict[str, str]:
        if self.is_rtl(locale_code):
            return {
                "direction": self._layout.direction,
                "text-align": self._layout.text_align,
                "flex-direction": self._layout.flex_direction,
            }
        return {
            "direction": "ltr",
            "text-align": "left",
            "flex-direction": "row",
        }

    def get_logical_properties(self) -> Dict[str, str]:
        """Return CSS logical properties for RTL compatibility."""
        return {
            "margin-inline-start": "start margin",
            "margin-inline-end": "end margin",
            "padding-inline-start": "start padding",
            "padding-inline-end": "end padding",
        }

    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "rtl_locales": list(self._rtl_locales),
            "layout": self._layout.direction,
        }
