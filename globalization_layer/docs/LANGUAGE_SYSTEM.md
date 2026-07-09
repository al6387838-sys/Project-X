# Language System API Reference

This document details the public API for the LifeOS Globalization Layer.

## Initialization

The module exports singleton instances for immediate use:

```python
from globalization_layer import i18n, formatter, locale_manager, language_selector, companion_i18n
```

## LanguageProvider (`i18n`)

The core translation engine.

### `t(key: str, namespace: str = "common", **kwargs) -> str`
Translates a dot-notated key.
```python
i18n.t("actions.save")  # "Salvar" (pt_BR)
i18n.t("greeting.morning", namespace="companion")
```

### `switch_locale(locale_code: str) -> bool`
Dynamically changes the active language.
```python
i18n.switch_locale("ja")
```

### `detect_locale(accept_language: str) -> SupportedLocale`
Parses an HTTP `Accept-Language` header to find the best match.

## LocaleFormatter (`formatter`)

Handles regional formatting.

### `format_date(value: datetime, style: str = "short") -> str`
Formats a date according to the active locale.

### `format_currency(amount: float, currency: str = None) -> str`
Formats a monetary amount.

### `format_relative(value: datetime) -> str`
Returns a relative time string (e.g., "5 minutes ago").

## CompanionI18n (`companion_i18n`)

Wraps Companion responses in the user's language.

### `greet(name: str, dt: datetime = None) -> str`
Returns a time-aware greeting.

### `format_decision_prompt(recommendation: str) -> str`
Wraps a decision recommendation in a localized prompt.

### `context_message(context_key: str) -> str`
Returns localized context observations (e.g., `sleep_bad`, `high_energy`).
