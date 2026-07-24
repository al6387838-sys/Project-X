/**
 * LifeOS Premium — Theme Engine
 * Sprint 028 | Version 2.0.0
 *
 * Manages Dark / Light / Auto / High Contrast / Large Fonts themes.
 * Persists preferences to localStorage.
 * Dispatches 'lifeos:theme-change' events.
 */

'use strict';

const ThemeEngine = (() => {

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const STORAGE_KEY_THEME      = 'lifeos_theme';
  const STORAGE_KEY_FONT       = 'lifeos_font_size';
  const STORAGE_KEY_SOUND      = 'lifeos_sound';
  const STORAGE_KEY_MOTION     = 'lifeos_motion';

  const THEMES = {
    DARK:          'dark',
    LIGHT:         'light',
    AUTO:          'auto',
    HIGH_CONTRAST: 'high-contrast',
  };

  const FONT_SIZES = {
    DEFAULT: 'default',
    LARGE:   'large',
  };

  /* ============================================================
     STATE
     ============================================================ */
  let _currentTheme    = THEMES.DARK;
  let _currentFont     = FONT_SIZES.DEFAULT;
  let _soundEnabled    = false;
  let _motionEnabled   = true;
  let _systemTheme     = 'dark';

  /* ============================================================
     SYSTEM PREFERENCE DETECTION
     ============================================================ */
  const _systemMediaQuery = window.matchMedia('(prefers-color-scheme: light)');

  function _detectSystemTheme() {
    _systemTheme = _systemMediaQuery.matches ? 'light' : 'dark';
  }

  _systemMediaQuery.addEventListener('change', (e) => {
    _systemTheme = e.matches ? 'light' : 'dark';
    if (_currentTheme === THEMES.AUTO) _applyTheme(THEMES.AUTO);
  });

  /* ============================================================
     APPLY THEME
     ============================================================ */
  function _applyTheme(theme) {
    const root = document.documentElement;

    // Remove all theme attributes
    root.removeAttribute('data-theme');

    if (theme === THEMES.AUTO) {
      _detectSystemTheme();
      root.setAttribute('data-theme', _systemTheme);
    } else {
      root.setAttribute('data-theme', theme);
    }

    // Update meta theme-color for mobile browsers
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const isDark = theme === THEMES.DARK ||
                     theme === THEMES.HIGH_CONTRAST ||
                     (theme === THEMES.AUTO && _systemTheme === 'dark');
      metaTheme.content = isDark ? '#080810' : '#FAFAFA';
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('lifeos:theme-change', {
      detail: { theme, resolvedTheme: theme === THEMES.AUTO ? _systemTheme : theme }
    }));
  }

  function _applyFont(size) {
    const root = document.documentElement;
    if (size === FONT_SIZES.LARGE) {
      root.setAttribute('data-theme-font', 'large');
    } else {
      root.removeAttribute('data-theme-font');
    }

    window.dispatchEvent(new CustomEvent('lifeos:font-change', {
      detail: { fontSize: size }
    }));
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  function init() {
    _detectSystemTheme();

    // Restore from storage
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || THEMES.DARK;
    const savedFont  = localStorage.getItem(STORAGE_KEY_FONT)  || FONT_SIZES.DEFAULT;
    _soundEnabled    = localStorage.getItem(STORAGE_KEY_SOUND) === 'true';
    _motionEnabled   = localStorage.getItem(STORAGE_KEY_MOTION) !== 'false';

    _currentTheme = savedTheme;
    _currentFont  = savedFont;

    _applyTheme(_currentTheme);
    _applyFont(_currentFont);

    // Apply motion preference
    if (!_motionEnabled) {
      document.documentElement.setAttribute('data-reduce-motion', 'true');
    }

    // Sync sound engine if available
    if (window.LifeOSMotion?.Sound) {
      if (_soundEnabled) window.LifeOSMotion.Sound.enable();
      else window.LifeOSMotion.Sound.disable();
    }

    // [removed]
  }

  function setTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      /* warn handled */
      return;
    }
    _currentTheme = theme;
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    _applyTheme(theme);
  }

  function getTheme() { return _currentTheme; }

  function getResolvedTheme() {
    if (_currentTheme === THEMES.AUTO) return _systemTheme;
    return _currentTheme;
  }

  function isDark() {
    const resolved = getResolvedTheme();
    return resolved === THEMES.DARK || resolved === THEMES.HIGH_CONTRAST;
  }

  function setFontSize(size) {
    if (!Object.values(FONT_SIZES).includes(size)) return;
    _currentFont = size;
    localStorage.setItem(STORAGE_KEY_FONT, size);
    _applyFont(size);
  }

  function getFontSize() { return _currentFont; }

  function toggleFontSize() {
    const next = _currentFont === FONT_SIZES.DEFAULT ? FONT_SIZES.LARGE : FONT_SIZES.DEFAULT;
    setFontSize(next);
    return next;
  }

  function setSoundEnabled(enabled) {
    _soundEnabled = enabled;
    localStorage.setItem(STORAGE_KEY_SOUND, enabled);
    if (window.LifeOSMotion?.Sound) {
      if (enabled) window.LifeOSMotion.Sound.enable();
      else window.LifeOSMotion.Sound.disable();
    }
    window.dispatchEvent(new CustomEvent('lifeos:sound-change', { detail: { enabled } }));
  }

  function isSoundEnabled() { return _soundEnabled; }
  function toggleSound() { setSoundEnabled(!_soundEnabled); return _soundEnabled; }

  function setMotionEnabled(enabled) {
    _motionEnabled = enabled;
    localStorage.setItem(STORAGE_KEY_MOTION, enabled);
    if (!enabled) {
      document.documentElement.setAttribute('data-reduce-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduce-motion');
    }
    if (window.LifeOSMotion?.config) {
      window.LifeOSMotion.config.reducedMotion = !enabled;
    }
    window.dispatchEvent(new CustomEvent('lifeos:motion-change', { detail: { enabled } }));
  }

  function isMotionEnabled() { return _motionEnabled; }
  function toggleMotion() { setMotionEnabled(!_motionEnabled); return _motionEnabled; }

  function getAll() {
    return {
      theme:        _currentTheme,
      resolvedTheme: getResolvedTheme(),
      fontSize:     _currentFont,
      soundEnabled: _soundEnabled,
      motionEnabled:_motionEnabled,
      isDark:       isDark(),
    };
  }

  /* ============================================================
     THEME SWITCHER UI BUILDER
     ============================================================ */
  function buildThemeSwitcher(container) {
    if (!container) return;

    const themes = [
      { value: THEMES.DARK,          label: 'Escuro',        icon: '\u{1F319}' },
      { value: THEMES.LIGHT,         label: 'Claro',         icon: '\u{2600}\u{FE0F}' },
      { value: THEMES.AUTO,          label: 'Automático',    icon: '\u{26A1}' },
      { value: THEMES.HIGH_CONTRAST, label: 'Alto Contraste',icon: '◑' },
    ];

    container.innerHTML = `
      <div class="theme-switcher" role="group" aria-label="Selecionar tema">
        <div class="theme-switcher-grid">
          ${themes.map(t => `
            <button
              class="theme-option ${_currentTheme === t.value ? 'theme-option-active' : ''}"
              data-theme-value="${t.value}"
              aria-pressed="${_currentTheme === t.value}"
              title="${t.label}"
            >
              <span class="theme-option-icon">${t.icon}</span>
              <span class="theme-option-label">${t.label}</span>
            </button>
          `).join('')}
        </div>

        <div class="theme-options-extra">
          <label class="toggle" title="Fonte grande">
            <input type="checkbox" class="toggle-input" id="toggle-font"
              ${_currentFont === FONT_SIZES.LARGE ? 'checked' : ''}>
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
            <span class="toggle-label">Fonte Grande</span>
          </label>

          <label class="toggle" title="Sons">
            <input type="checkbox" class="toggle-input" id="toggle-sound"
              ${_soundEnabled ? 'checked' : ''}>
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
            <span class="toggle-label">Sons</span>
          </label>

          <label class="toggle" title="Animações">
            <input type="checkbox" class="toggle-input" id="toggle-motion"
              ${_motionEnabled ? 'checked' : ''}>
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
            <span class="toggle-label">Animações</span>
          </label>
        </div>
      </div>
    `;

    // Theme buttons
    container.querySelectorAll('[data-theme-value]').forEach(btn => {
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.themeValue);
        container.querySelectorAll('[data-theme-value]').forEach(b => {
          b.classList.toggle('theme-option-active', b.dataset.themeValue === _currentTheme);
          b.setAttribute('aria-pressed', b.dataset.themeValue === _currentTheme);
        });
        if (window.LifeOSMotion?.Haptic) window.LifeOSMotion.Haptic.light();
        if (window.LifeOSMotion?.Sound)  window.LifeOSMotion.Sound.click();
      });
    });

    // Font toggle
    const fontToggle = container.querySelector('#toggle-font');
    if (fontToggle) {
      fontToggle.addEventListener('change', () => {
        setFontSize(fontToggle.checked ? FONT_SIZES.LARGE : FONT_SIZES.DEFAULT);
      });
    }

    // Sound toggle
    const soundToggle = container.querySelector('#toggle-sound');
    if (soundToggle) {
      soundToggle.addEventListener('change', () => {
        setSoundEnabled(soundToggle.checked);
      });
    }

    // Motion toggle
    const motionToggle = container.querySelector('#toggle-motion');
    if (motionToggle) {
      motionToggle.addEventListener('change', () => {
        setMotionEnabled(motionToggle.checked);
      });
    }
  }

  /* ============================================================
     RETURN PUBLIC API
     ============================================================ */
  return {
    THEMES,
    FONT_SIZES,
    init,
    setTheme,
    getTheme,
    getResolvedTheme,
    isDark,
    setFontSize,
    getFontSize,
    toggleFontSize,
    setSoundEnabled,
    isSoundEnabled,
    toggleSound,
    setMotionEnabled,
    isMotionEnabled,
    toggleMotion,
    getAll,
    buildThemeSwitcher,
  };

})();

window.ThemeEngine = ThemeEngine;
