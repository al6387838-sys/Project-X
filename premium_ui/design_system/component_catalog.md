# LifeOS Enterprise — Design System Component Catalog

**Version:** 5.0.0  
**Phase:** 002 — Design System Enterprise  
**Status:** Production Ready  
**Last Updated:** 2026-07-13

---

## 📋 Table of Contents

1. [Buttons](#buttons)
2. [Inputs](#inputs)
3. [Dropdowns & Selects](#dropdowns--selects)
4. [Date Picker](#date-picker)
5. [Dialogs & Modals](#dialogs--modals)
6. [Notifications](#notifications)
7. [Tables](#tables)
8. [Charts](#charts)
9. [Sidebar](#sidebar)
10. [Topbar](#topbar)
11. [Breadcrumb](#breadcrumb)
12. [Tabs](#tabs)
13. [Cards](#cards)
14. [Avatars](#avatars)
15. [Loading States](#loading-states)
16. [Skeletons](#skeletons)
17. [Badges](#badges)
18. [Status Indicators](#status-indicators)
19. [Empty States](#empty-states)
20. [Search](#search)

---

## Buttons

### Primary Button
```html
<button class="enterprise-btn enterprise-btn-primary enterprise-btn-md">
  Ação Principal
</button>
```

**Variants:**
- `.enterprise-btn-primary` - Gradient primary
- `.enterprise-btn-secondary` - Surface with border
- `.enterprise-btn-ghost` - Transparent
- `.enterprise-btn-success` - Gradient success
- `.enterprise-btn-danger` - Danger state

**Sizes:**
- `.enterprise-btn-xs` - 28px
- `.enterprise-btn-sm` - 36px
- `.enterprise-btn-md` - 44px (default)
- `.enterprise-btn-lg` - 52px
- `.enterprise-btn-xl` - 60px

**States:**
- `:hover` - Elevation glow, slight translateY
- `:active` - Pressed state
- `:disabled` - 50% opacity
- `.loading` - Spinner animation

### Icon Button
```html
<button class="enterprise-btn-icon">
  <svg>...</svg>
</button>
```

**Sizes:**
- Default: 40px
- `.sm` - 32px
- `.lg` - 48px

---

## Inputs

### Text Input
```html
<input class="enterprise-input" type="text" placeholder="Placeholder..." />
```

**Variants:**
- `.enterprise-input` - Default
- `.enterprise-input-sm` - 36px
- `.enterprise-input-lg` - 52px

**States:**
- `:hover` - Border strong
- `:focus` - Border focus + glow
- `:disabled` - 50% opacity

### Textarea
```html
<textarea class="enterprise-textarea" placeholder="Texto..."></textarea>
```

---

## Dropdowns & Selects

### Select
```html
<select class="enterprise-select">
  <option>Opção 1</option>
  <option>Opção 2</option>
</select>
```

### Checkbox
```html
<label class="enterprise-checkbox">
  <input type="checkbox" />
  <span>Label</span>
</label>
```

### Toggle
```html
<label class="enterprise-toggle">
  <input type="checkbox" />
  <span class="toggle-track"></span>
  <span class="toggle-thumb"></span>
</label>
```

---

## Date Picker

### Date Input
```html
<input class="enterprise-input" type="date" />
```

**Future Enhancement:** Custom date picker component with calendar UI

---

## Dialogs & Modals

### Modal
```html
<div class="enterprise-modal-overlay">
  <div class="enterprise-modal">
    <div class="enterprise-modal-header">
      <h2 class="enterprise-modal-title">Título</h2>
    </div>
    <div class="enterprise-modal-body">
      Conteúdo...
    </div>
    <div class="enterprise-modal-footer">
      <button class="enterprise-btn enterprise-btn-secondary">Cancelar</button>
      <button class="enterprise-btn enterprise-btn-primary">Confirmar</button>
    </div>
  </div>
</div>
```

**Max Widths:**
- sm: 400px
- md: 560px (default)
- lg: 720px
- xl: 960px

---

## Notifications

### Toast
```html
<div class="enterprise-toast-stack">
  <div class="enterprise-toast success">
    ✓ Operação realizada com sucesso!
  </div>
</div>
```

**Variants:**
- `.success` - Verde com borda esquerda
- `.error` - Vermelho com borda esquerda
- `.warning` - Amarelo com borda esquerda
- `.info` - Azul com borda esquerda

---

## Tables

### Basic Table
```html
<table class="enterprise-table">
  <thead>
    <tr>
      <th>Coluna 1</th>
      <th>Coluna 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Dado 1</td>
      <td>Dado 2</td>
    </tr>
  </tbody>
</table>
```

**Features:**
- Header com background destacado
- Hover state em linhas
- Borders sutis
- Responsive

---

## Charts

### Chart.js Integration
```html
<canvas id="myChart"></canvas>
<script>
  const ctx = document.getElementById('myChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: { /* ... */ },
    options: {
      responsive: true,
      plugins: {
        filler: true
      }
    }
  });
</script>
```

---

## Sidebar

### Sidebar Structure
```html
<aside class="app-sidebar">
  <div class="app-sidebar-header">
    <div class="app-sidebar-logo">L</div>
    <div class="app-sidebar-title">LifeOS</div>
  </div>
  
  <nav class="app-sidebar-nav">
    <a href="#" class="app-sidebar-item active">
      <span>📊</span>
      <span>Dashboard</span>
    </a>
  </nav>
  
  <div class="app-sidebar-footer">
    <button class="enterprise-btn enterprise-btn-secondary">Suporte</button>
  </div>
</aside>
```

**Features:**
- Sticky positioning
- Smooth scroll
- Active state com borda esquerda
- Hover animations

---

## Topbar

### Topbar Structure
```html
<header class="app-topbar">
  <div class="app-topbar-left">
    <div class="app-topbar-title">Dashboard Executivo</div>
    <div class="app-topbar-search">
      <svg>...</svg>
      <input type="search" placeholder="Buscar..." />
    </div>
  </div>
  
  <div class="app-topbar-right">
    <div class="app-topbar-actions">
      <button class="enterprise-btn-icon">🔔</button>
      <button class="enterprise-btn-icon">👤</button>
    </div>
  </div>
</header>
```

---

## Breadcrumb

### Breadcrumb Navigation
```html
<nav class="enterprise-breadcrumb">
  <a href="/">Home</a>
  <span>/</span>
  <a href="/dashboard">Dashboard</a>
  <span>/</span>
  <span>Detalhes</span>
</nav>
```

---

## Tabs

### Tabs Component
```html
<div class="enterprise-tabs">
  <button class="enterprise-tab active">Tab 1</button>
  <button class="enterprise-tab">Tab 2</button>
</div>

<div class="enterprise-tab-content">
  <div class="enterprise-tab-pane active">Conteúdo 1</div>
  <div class="enterprise-tab-pane">Conteúdo 2</div>
</div>
```

---

## Cards

### Card Variants
```html
<!-- Small Card -->
<div class="enterprise-card enterprise-card-sm">
  <div class="enterprise-card-header">
    <h3 class="enterprise-card-title">Título</h3>
  </div>
  <div class="enterprise-card-body">
    Conteúdo...
  </div>
</div>

<!-- Medium Card -->
<div class="enterprise-card enterprise-card-md">
  ...
</div>

<!-- Large Card -->
<div class="enterprise-card enterprise-card-lg">
  ...
</div>
```

**Sizes:**
- `.enterprise-card-sm` - 16px padding
- `.enterprise-card-md` - 24px padding
- `.enterprise-card-lg` - 32px padding

---

## Avatars

### Avatar Sizes
```html
<div class="enterprise-avatar enterprise-avatar-md">
  <img src="avatar.jpg" alt="User" />
</div>
```

**Sizes:**
- `.enterprise-avatar-xs` - 24px
- `.enterprise-avatar-sm` - 32px
- `.enterprise-avatar-md` - 40px
- `.enterprise-avatar-lg` - 48px
- `.enterprise-avatar-xl` - 56px
- `.enterprise-avatar-2xl` - 72px

---

## Loading States

### Spinner
```html
<div class="enterprise-spinner"></div>
```

### Button Loading
```html
<button class="enterprise-btn enterprise-btn-primary loading">
  <span class="btn-text">Salvando...</span>
  <span class="btn-spinner"></span>
</button>
```

---

## Skeletons

### Skeleton Components
```html
<div class="enterprise-skeleton enterprise-skeleton-text"></div>
<div class="enterprise-skeleton enterprise-skeleton-avatar"></div>
```

---

## Badges

### Badge Variants
```html
<span class="enterprise-badge enterprise-badge-primary">Primary</span>
<span class="enterprise-badge enterprise-badge-success">Success</span>
<span class="enterprise-badge enterprise-badge-warning">Warning</span>
<span class="enterprise-badge enterprise-badge-danger">Danger</span>
<span class="enterprise-badge enterprise-badge-info">Info</span>
```

---

## Status Indicators

### Status Badges
```html
<span class="enterprise-badge enterprise-badge-success">● Ativo</span>
<span class="enterprise-badge enterprise-badge-warning">● Pendente</span>
<span class="enterprise-badge enterprise-badge-danger">● Inativo</span>
```

---

## Empty States

### Empty State
```html
<div class="enterprise-empty-state">
  <div class="enterprise-empty-icon">📭</div>
  <h3 class="enterprise-empty-title">Nenhum resultado</h3>
  <p class="enterprise-empty-description">Tente ajustar seus filtros</p>
  <button class="enterprise-btn enterprise-btn-primary">Limpar Filtros</button>
</div>
```

---

## Search

### Search Input
```html
<div class="app-topbar-search">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
  <input type="search" placeholder="Buscar..." />
</div>
```

---

## Typography Classes

### Display
- `.enterprise-display-2xl` - 60px, bold
- `.enterprise-display-xl` - 48px, bold
- `.enterprise-display-lg` - 36px, bold

### Headings
- `.enterprise-heading-1` - 30px, bold
- `.enterprise-heading-2` - 24px, semibold
- `.enterprise-heading-3` - 20px, semibold
- `.enterprise-heading-4` - 18px, semibold

### Body
- `.enterprise-body-lg` - 18px, normal
- `.enterprise-body` - 16px, normal
- `.enterprise-body-sm` - 14px, normal
- `.enterprise-body-xs` - 12px, normal

### Label
- `.enterprise-label` - 14px, medium, uppercase

---

## Color Utilities

### Text Colors
- `.text-primary` - Primary text
- `.text-secondary` - Secondary text
- `.text-tertiary` - Tertiary text
- `.text-disabled` - Disabled text
- `.text-link` - Link color

### Background Colors
- `.bg-base` - Base background
- `.bg-card` - Card background
- `.bg-surface-1` - Surface level 1
- `.bg-surface-2` - Surface level 2

### Border Colors
- `.border-default` - Default border
- `.border-strong` - Strong border

### Shadow Utilities
- `.shadow-sm` - Small shadow
- `.shadow-md` - Medium shadow
- `.shadow-lg` - Large shadow
- `.shadow-xl` - Extra large shadow

### Gradient Utilities
- `.gradient-primary` - Primary gradient
- `.gradient-accent` - Accent gradient
- `.gradient-success` - Success gradient

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| xs | 375px | Mobile |
| sm | 390px | Mobile |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Desktop |
| 2xl | 1440px | Desktop |
| 3xl | 1920px | Large Desktop |
| 4xl | 2560px | Ultra Wide |

---

## Animation Classes

### Entrance Animations
- `.animate-fade-in` - Fade in
- `.animate-fade-in-up` - Slide up + fade
- `.animate-fade-in-down` - Slide down + fade
- `.animate-fade-in-left` - Slide left + fade
- `.animate-fade-in-right` - Slide right + fade
- `.animate-scale-in` - Scale in
- `.animate-bounce-in` - Bounce in

### Continuous Animations
- `.animate-pulse` - Pulse
- `.animate-spin` - Spin
- `.animate-glow-pulse` - Glow pulse
- `.animate-heartbeat` - Heartbeat
- `.animate-float` - Float

### Delay Utilities
- `.delay-50` - 50ms
- `.delay-100` - 100ms
- `.delay-150` - 150ms
- `.delay-200` - 200ms
- `.delay-300` - 300ms
- `.delay-400` - 400ms
- `.delay-500` - 500ms
- `.delay-600` - 600ms
- `.delay-700` - 700ms
- `.delay-1000` - 1000ms

---

## Usage Guidelines

### Do's ✅
- Use semantic HTML
- Combine classes for flexibility
- Use CSS variables for theming
- Follow spacing grid (4px)
- Use proper contrast ratios
- Test on multiple devices

### Don'ts ❌
- Don't override CSS variables
- Don't mix old and new components
- Don't use inline styles
- Don't skip accessibility attributes
- Don't use hardcoded colors

---

## Theme Switching

### Dark Theme (Default)
```html
<html data-theme="enterprise-dark">
```

### Light Theme
```html
<html data-theme="enterprise-light">
```

### High Contrast Theme
```html
<html data-theme="enterprise-high-contrast">
```

---

## CSS Variables Reference

### Colors
- `--brand-primary-*` (50-950)
- `--brand-accent-*` (50-900)
- `--status-success-*` (50-700)
- `--status-warning-*` (50-700)
- `--status-danger-*` (50-700)
- `--status-info-*` (50-700)

### Backgrounds
- `--bg-base`
- `--bg-elevated`
- `--bg-card`
- `--bg-card-hover`
- `--bg-surface-1` through `--bg-surface-4`
- `--bg-glass`

### Borders
- `--border-subtle`
- `--border-default`
- `--border-strong`
- `--border-strong-2`
- `--border-focus`
- `--border-focus-strong`

### Text
- `--text-primary`
- `--text-secondary`
- `--text-tertiary`
- `--text-quaternary`
- `--text-disabled`
- `--text-inverse`
- `--text-link`

### Shadows
- `--shadow-xs` through `--shadow-2xl`
- `--shadow-glow-primary`
- `--shadow-glow-accent`
- `--shadow-glow-success`
- `--shadow-glow-danger`
- `--shadow-inset`
- `--shadow-inset-strong`

### Motion
- `--duration-instant` (50ms)
- `--duration-fast` (100ms)
- `--duration-normal` (150ms)
- `--duration-moderate` (250ms)
- `--duration-slow` (400ms)
- `--duration-slower` (600ms)
- `--duration-slowest` (800ms)

### Easing
- `--ease-linear`
- `--ease-in`
- `--ease-out`
- `--ease-in-out`
- `--ease-spring`
- `--ease-spring-smooth`
- `--ease-bounce`

---

## Accessibility

### WCAG 2.1 Compliance
- ✅ Color contrast ratios meet AA standards
- ✅ Focus states clearly visible
- ✅ Keyboard navigation supported
- ✅ Screen reader friendly
- ✅ Reduced motion respected

### Focus Management
```html
:focus-visible {
  outline: 2px solid var(--border-focus-strong);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Performance Considerations

- All CSS is optimized and minified
- CSS variables reduce file size
- No JavaScript required for basic components
- GPU-accelerated animations
- Smooth 60fps transitions

---

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| iOS Safari | 14+ | ✅ Full |
| Chrome Android | 90+ | ✅ Full |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.0.0 | 2026-07-13 | Enterprise Premium redesign |
| 4.0.0 | 2026-06-15 | Design System v4 |
| 3.0.0 | 2026-05-01 | Initial release |

---

**Last Updated:** 2026-07-13  
**Maintained By:** LifeOS Design Team  
**License:** Proprietary
