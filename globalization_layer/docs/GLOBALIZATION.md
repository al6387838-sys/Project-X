# LifeOS Globalization Strategy

The Globalization Layer ensures LifeOS is ready for worldwide adoption from Day 1.

## Design Principles

1. **English as the Technical Baseline**
   - All source code, variables, and architecture remain in English.
   - All technical documentation remains in English.
   - Only the user-facing interface is translated.

2. **Namespace Segregation**
   - Translations are strictly segregated by feature domain (e.g., `dashboard`, `companion`, `decisions`).
   - This prevents key collisions and allows lazy-loading of translations in the future frontend.

3. **Graceful Fallback**
   - If a translation key is missing in the active locale, the system automatically falls back to English (`en`).
   - If it's missing in English, the key itself is returned to ensure the UI never crashes.

4. **Context-Aware Formatting**
   - A date is never just a string; it is a localized representation.
   - `09/07/2026` in Brazil is `7/9/26` in the US and `2026/07/09` in Japan.
   - The `LocaleFormatter` guarantees cultural correctness for dates, times, currencies, and numbers.

## Regional Formatting Rules

### Currency
Currencies are formatted with their correct symbols and placement:
- **pt_BR**: `R$ 1.500,00` (Symbol before, space, comma for decimals)
- **en**: `$1,500.00` (Symbol before, no space, dot for decimals)
- **de**: `1.500,00 €` (Symbol after, space, comma for decimals)
- **ja**: `￥1,500` (No decimals)

### Timezones
All datetimes are stored internally as UTC. When displayed to the user, they are converted to the user's local timezone via the `LocaleFormatter.convert_to_user_timezone()` method.

### Relative Time
The system provides culturally appropriate relative time strings:
- **pt_BR**: `há 5 minutos`
- **en**: `5 minutes ago`
- **ja**: `5分前`
