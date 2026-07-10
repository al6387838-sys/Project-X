"""
SIGMA-002: Accessibility
========================
World-Class Accessibility Suite for LifeOS.

Implements:
- WCAG 2.2 AA Compliance
- Screen Reader Support (ARIA, semantic markup)
- Keyboard Navigation (full accessibility)
- High Contrast Mode
- Dynamic Scaling (text, UI, responsive)
- Accessibility Testing & Validation
- Accessibility Audit Reports
"""

from .wcag_validator import WCAGValidator, WCAGLevel
from .screen_reader import ScreenReaderSupport
from .keyboard_navigation import KeyboardNavigation
from .high_contrast import HighContrastMode
from .dynamic_scaling import DynamicScaling
from .accessibility_suite import SIGMA002Suite

__all__ = [
    "WCAGValidator",
    "WCAGLevel",
    "ScreenReaderSupport",
    "KeyboardNavigation",
    "HighContrastMode",
    "DynamicScaling",
    "SIGMA002Suite",
]
