/**
 * LifeOS Feature Flags Engine
 * Sprint 029 | Version 1.0.0
 *
 * Sistema de feature flags para:
 * - Ativar/desativar funcionalidades por grupo
 * - A/B testing
 * - Rollout gradual
 * - Heatmaps de navegação
 */

'use strict';

const FeatureFlagsEngine = (() => {
  const STORAGE_KEY = 'lifeos_feature_flags';
  const HEATMAP_KEY = 'lifeos_heatmap';

  let flags = {
    // Exemplo: 'new_dashboard': { enabled: true, rollout: 100, groups: ['beta', 'vip'] }
  };

  let heatmapData = {
    clicks: [],
    hovers: [],
    scrolls: [],
    pageViews: []
  };

  /**
   * Inicializa o Feature Flags Engine
   * @param {Object} initialFlags
   */
  function init(initialFlags = {}) {
    flags = initialFlags;

    // Restaurar heatmap data
    try {
      const stored = localStorage.getItem(HEATMAP_KEY);
      if (stored) {
        heatmapData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Falha ao restaurar heatmap:', e);
    }

    // Iniciar rastreamento de heatmap
    initializeHeatmapTracking();

    // [removed]
  }

  /**
   * Verifica se uma feature está ativada para um usuário
   * @param {string} featureName
   * @param {Object} userContext - { userId, tier, groups, betaTester }
   * @returns {boolean}
   */
  function isFeatureEnabled(featureName, userContext = {}) {
    const flag = flags[featureName];

    if (!flag) {
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Verificar rollout percentual
    if (flag.rollout < 100) {
      const hash = hashUserId(userContext.userId || 'anonymous');
      if (hash % 100 >= flag.rollout) {
        return false;
      }
    }

    // Verificar grupos
    if (flag.groups && flag.groups.length > 0) {
      const userGroups = userContext.groups || [];
      const hasAccess = flag.groups.some(group => userGroups.includes(group));

      if (!hasAccess) {
        return false;
      }
    }

    // Verificar tier
    if (flag.minTier && userContext.tier) {
      const tierOrder = { 'standard': 0, 'early-access': 1, 'vip': 2 };
      const minTierOrder = tierOrder[flag.minTier] || 0;
      const userTierOrder = tierOrder[userContext.tier] || 0;

      if (userTierOrder < minTierOrder) {
        return false;
      }
    }

    return true;
  }

  /**
   * Define uma feature flag
   * @param {string} featureName
   * @param {Object} config - { enabled, rollout, groups, minTier }
   */
  function setFeatureFlag(featureName, config) {
    flags[featureName] = {
      enabled: config.enabled !== false,
      rollout: config.rollout || 100,
      groups: config.groups || [],
      minTier: config.minTier || null,
      createdAt: new Date().toISOString(),
      ...config
    };

    // [removed]
  }

  /**
   * Obtém todas as feature flags
   * @returns {Object}
   */
  function getAllFlags() {
    return { ...flags };
  }

  /**
   * Obtém flags ativas para um usuário
   * @param {Object} userContext
   * @returns {Array}
   */
  function getEnabledFeaturesForUser(userContext) {
    return Object.keys(flags).filter(featureName =>
      isFeatureEnabled(featureName, userContext)
    );
  }

  /**
   * Registra um clique no heatmap
   * @param {string} elementId
   * @param {number} x
   * @param {number} y
   */
  function recordClick(elementId, x, y) {
    heatmapData.clicks.push({
      elementId,
      x,
      y,
      timestamp: new Date().toISOString(),
      page: window.location.pathname
    });

    if (heatmapData.clicks.length > 10000) {
      heatmapData.clicks = heatmapData.clicks.slice(-5000);
    }

    saveHeatmap();
  }

  /**
   * Registra um hover no heatmap
   * @param {string} elementId
   * @param {number} x
   * @param {number} y
   */
  function recordHover(elementId, x, y) {
    heatmapData.hovers.push({
      elementId,
      x,
      y,
      timestamp: new Date().toISOString(),
      page: window.location.pathname
    });

    if (heatmapData.hovers.length > 10000) {
      heatmapData.hovers = heatmapData.hovers.slice(-5000);
    }

    saveHeatmap();
  }

  /**
   * Registra scroll no heatmap
   * @param {number} scrollY
   */
  function recordScroll(scrollY) {
    heatmapData.scrolls.push({
      scrollY,
      timestamp: new Date().toISOString(),
      page: window.location.pathname
    });

    if (heatmapData.scrolls.length > 5000) {
      heatmapData.scrolls = heatmapData.scrolls.slice(-2500);
    }

    saveHeatmap();
  }

  /**
   * Registra visualização de página
   * @param {string} pageName
   */
  function recordPageView(pageName) {
    heatmapData.pageViews.push({
      page: pageName,
      timestamp: new Date().toISOString()
    });

    if (heatmapData.pageViews.length > 5000) {
      heatmapData.pageViews = heatmapData.pageViews.slice(-2500);
    }

    saveHeatmap();
  }

  /**
   * Obtém dados de heatmap para uma página
   * @param {string} pageName
   * @returns {Object}
   */
  function getHeatmapForPage(pageName) {
    return {
      clicks: heatmapData.clicks.filter(c => c.page === pageName),
      hovers: heatmapData.hovers.filter(h => h.page === pageName),
      scrolls: heatmapData.scrolls.filter(s => s.page === pageName)
    };
  }

  /**
   * Obtém elementos mais clicados
   * @param {string} pageName
   * @param {number} limit
   * @returns {Array}
   */
  function getMostClickedElements(pageName, limit = 10) {
    const pageClicks = heatmapData.clicks.filter(c => c.page === pageName);
    const clickCounts = {};

    pageClicks.forEach(click => {
      clickCounts[click.elementId] = (clickCounts[click.elementId] || 0) + 1;
    });

    return Object.entries(clickCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([elementId, count]) => ({ elementId, count }));
  }

  /**
   * Obtém profundidade média de scroll
   * @param {string} pageName
   * @returns {number}
   */
  function getAverageScrollDepth(pageName) {
    const pageScrolls = heatmapData.scrolls.filter(s => s.page === pageName);

    if (pageScrolls.length === 0) {
      return 0;
    }

    const totalScroll = pageScrolls.reduce((sum, s) => sum + s.scrollY, 0);
    return Math.round(totalScroll / pageScrolls.length);
  }

  /**
   * Exporta dados de heatmap
   * @returns {Object}
   */
  function exportHeatmapData() {
    return {
      totalClicks: heatmapData.clicks.length,
      totalHovers: heatmapData.hovers.length,
      totalScrolls: heatmapData.scrolls.length,
      totalPageViews: heatmapData.pageViews.length,
      pages: Array.from(new Set(heatmapData.pageViews.map(p => p.page))),
      heatmapData
    };
  }

  // ===== PRIVATE HELPERS =====

  function hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function saveHeatmap() {
    localStorage.setItem(HEATMAP_KEY, JSON.stringify(heatmapData));
  }

  function initializeHeatmapTracking() {
    // Rastrear cliques
    document.addEventListener('click', (e) => {
      if (e.target.id) {
        recordClick(e.target.id, e.clientX, e.clientY);
      }
    }, true);

    // Rastrear hovers
    document.addEventListener('mouseover', (e) => {
      if (e.target.id) {
        recordHover(e.target.id, e.clientX, e.clientY);
      }
    }, true);

    // Rastrear scroll
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        recordScroll(window.scrollY);
      }, 500);
    });

    // Rastrear visualização de página
    recordPageView(window.location.pathname);
  }

  // ===== PUBLIC API =====

  return {
    init,
    isFeatureEnabled,
    setFeatureFlag,
    getAllFlags,
    getEnabledFeaturesForUser,
    recordClick,
    recordHover,
    recordScroll,
    recordPageView,
    getHeatmapForPage,
    getMostClickedElements,
    getAverageScrollDepth,
    exportHeatmapData
  };
})();

// Exportar globalmente
window.LifeOSFeatureFlags = FeatureFlagsEngine;
