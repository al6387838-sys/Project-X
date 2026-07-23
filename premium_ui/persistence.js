// LifeOS Enterprise — Persistence Layer v1.0
// Fase 731 — Persistência Real Absoluta
// Substitui localStorage/sessionStorage por chamadas à API /api/persistence (KV)
// Compatível com fallback para localStorage quando offline ou não autenticado.

(() => {
  'use strict';

  const API = '/api/persistence';
  const MEMORY_CACHE = new Map();
  let _authenticated = false;
  let _migrated = false;

  // ─── AUTH DETECTION ──────────────────────────────────────────────────────
  async function ensureAuth() {
    try {
      const res = await fetch('/api/session?optional=1', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        _authenticated = data.ok && !!data.sub;
        return _authenticated;
      }
    } catch { /* offline */ }
    return false;
  }

  // ─── MAP localStorage KEY → {ns, key} ───────────────────────────────────
  function mapLocalStorageKey(lk) {
    if (lk.startsWith('lifeos_prefs_v11')) return { ns: 'prefs', key: 'preferences' };
    if (lk.startsWith('lifeos_onboarded')) return { ns: 'onboarding', key: 'completed' };
    if (lk.startsWith('lifeos_state')) return { ns: 'state', key: 'app' };
    if (lk.startsWith('lifeos_v10_companion_preferences')) return { ns: 'prefs', key: 'companion' };
    if (lk.startsWith('ONBOARDING_STORAGE_KEY') || lk === 'onboardingState') return { ns: 'onboarding', key: 'state' };
    if (lk.startsWith('lifeos_dv11_order')) return { ns: 'layout', key: 'dv11_order' };
    if (lk.startsWith('lifeos_dv11_hidden')) return { ns: 'layout', key: 'dv11_hidden' };
    if (lk.startsWith('lifeos_dashboard_v2_order')) return { ns: 'layout', key: 'dv2_order' };
    if (lk.startsWith('lifeos_dashboard_v2_hidden')) return { ns: 'layout', key: 'dv2_hidden' };
    if (lk.startsWith('integration_')) return { ns: 'integrations', key: lk.replace('integration_', '') };
    if (lk.startsWith('lifeos_recent_searches')) return { ns: 'search', key: 'recent' };
    if (lk === 'theme') return { ns: 'ui', key: 'theme' };
    if (lk.startsWith('LIFEOS_THEME') || lk === 'STORAGE_KEY_THEME') return { ns: 'ui', key: 'theme' };
    if (lk.startsWith('LIFEOS_FONT') || lk === 'STORAGE_KEY_FONT') return { ns: 'ui', key: 'font' };
    if (lk.startsWith('LIFEOS_SOUND') || lk === 'STORAGE_KEY_SOUND') return { ns: 'ui', key: 'sound' };
    if (lk.startsWith('LIFEOS_MOTION') || lk === 'STORAGE_KEY_MOTION') return { ns: 'ui', key: 'motion' };
    // Calendar visibility
    if (lk.startsWith('lifeos_cal_') || lk.startsWith('cal_vis_')) return { ns: 'calendar', key: lk };
    // General lifeos_ prefix
    if (lk.startsWith('lifeos_')) return { ns: 'state', key: lk.replace('lifeos_', '') };
    return null;
  }

  // ─── Migrate localStorage → KV ──────────────────────────────────────────
  async function migrateLocalStorage() {
    if (_migrated || !_authenticated) return;
    _migrated = true;
    try {
      const items = [];
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const lk = localStorage.key(i);
        const mapping = mapLocalStorageKey(lk);
        if (mapping) {
          try {
            const value = JSON.parse(localStorage.getItem(lk));
            items.push({ ns: mapping.ns, key: mapping.key, value });
          } catch {
            const value = localStorage.getItem(lk);
            items.push({ ns: mapping.ns, key: mapping.key, value });
          }
          keysToRemove.push(lk);
        }
      }
      if (items.length > 0) {
        await fetch(API, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'migrate-local-storage', items }),
        });
        // Remove migrated keys from localStorage
        keysToRemove.forEach(k => localStorage.removeItem(k));
        console.log(`[LifeOS Persistence] Migrados ${items.length} itens de localStorage para KV`);
      }
    } catch (err) {
      console.warn('[LifeOS Persistence] Migração falhou:', err);
    }
  }

  // ─── Load cache on startup ──────────────────────────────────────────────
  async function loadCache() {
    if (!_authenticated) return;
    try {
      const res = await fetch(`${API}?ns=prefs&list`, { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.entries) {
          for (const entry of data.entries) {
            MEMORY_CACHE.set(`prefs:${entry.key}`, entry.value);
          }
        }
      }
      // Load other namespaces
      const namespaces = ['onboarding', 'layout', 'calendar', 'search', 'ui', 'state'];
      for (const ns of namespaces) {
        try {
          const res2 = await fetch(`${API}?ns=${ns}&list`, { credentials: 'same-origin' });
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.ok && data2.entries) {
              for (const entry of data2.entries) {
                MEMORY_CACHE.set(`${ns}:${entry.key}`, entry.value);
              }
            }
          }
        } catch { /* namespace not available */ }
      }
    } catch (err) {
      console.warn('[LifeOS Persistence] Cache load failed:', err);
    }
  }

  // ─── PERSISTENT GET/SET ─────────────────────────────────────────────────
  async function persistGet(ns, key) {
    const cacheKey = `${ns}:${key}`;
    if (MEMORY_CACHE.has(cacheKey)) return MEMORY_CACHE.get(cacheKey);
    if (!_authenticated) return null;
    try {
      const res = await fetch(`${API}?ns=${ns}&key=${encodeURIComponent(key)}`, { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.value !== null) {
          MEMORY_CACHE.set(cacheKey, data.value);
          return data.value;
        }
      }
    } catch { /* offline */ }
    return null;
  }

  async function persistSet(ns, key, value) {
    const cacheKey = `${ns}:${key}`;
    MEMORY_CACHE.set(cacheKey, value);
    if (!_authenticated) {
      // Fallback: also store in localStorage temporarily
      try { localStorage.setItem(`lifeos_temp_${ns}_${key}`, JSON.stringify(value)); } catch { /* */ }
      return;
    }
    try {
      await fetch(API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'save', ns, key, value }),
      });
    } catch { /* offline, will sync later */ }
  }

  async function persistDelete(ns, key) {
    const cacheKey = `${ns}:${key}`;
    MEMORY_CACHE.delete(cacheKey);
    if (_authenticated) {
      try {
        await fetch(API, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'delete', ns, key }),
        });
      } catch { /* offline */ }
    }
  }

  // ─── INIT ───────────────────────────────────────────────────────────────
  async function init() {
    _authenticated = await ensureAuth();
    if (_authenticated) {
      await loadCache();
      await migrateLocalStorage();
    }
  }

  // Export API
  window.LifeOSPersistence = {
    get: persistGet,
    set: persistSet,
    delete: persistDelete,
    init,
    refreshCache: loadCache,
    migrate: migrateLocalStorage,
    isAuthenticated: () => _authenticated,
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
