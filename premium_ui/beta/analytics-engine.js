/**
 * LifeOS Analytics Engine
 * Sprint 029 | Version 1.0.0
 *
 * Calcula métricas de uso:
 * - DAU (Daily Active Users)
 * - WAU (Weekly Active Users)
 * - MAU (Monthly Active Users)
 * - Retenção D1, D7, D30
 * - Feature Usage
 * - Session Time
 * - Task Completion Rate
 */

'use strict';

const AnalyticsEngine = (() => {
  const STORAGE_KEY = 'lifeos_analytics_data';

  let analyticsData = {
    dailyActiveUsers: {}, // YYYY-MM-DD -> Set de userIds
    sessionData: [], // { userId, startTime, endTime, features }
    featureUsage: {}, // featureName -> count
    taskCompletions: {}, // taskName -> { completed, total }
    userRetention: {}, // userId -> { joinDate, lastActiveDate, activeDates: [] }
    crashes: [],
    performance: [] // { metric, value, timestamp }
  };

  /**
   * Inicializa o Analytics Engine
   */
  function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        analyticsData = JSON.parse(stored);
      } catch (e) {
        console.warn('Falha ao carregar dados de analytics:', e);
      }
    }
    console.log('[AnalyticsEngine] Inicializado');
  }

  /**
   * Registra um usuário como ativo hoje
   * @param {string} userId
   */
  function recordDailyActiveUser(userId) {
    const today = getDateString(new Date());

    if (!analyticsData.dailyActiveUsers[today]) {
      analyticsData.dailyActiveUsers[today] = new Set();
    }

    analyticsData.dailyActiveUsers[today].add(userId);
    save();
  }

  /**
   * Inicia uma sessão de usuário
   * @param {string} userId
   * @returns {string} sessionId
   */
  function startSession(userId) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = {
      sessionId,
      userId,
      startTime: new Date().toISOString(),
      endTime: null,
      features: [],
      pageViews: [],
      duration: null
    };

    analyticsData.sessionData.push(session);
    recordDailyActiveUser(userId);

    return sessionId;
  }

  /**
   * Finaliza uma sessão de usuário
   * @param {string} sessionId
   */
  function endSession(sessionId) {
    const session = analyticsData.sessionData.find(s => s.sessionId === sessionId);
    if (session) {
      session.endTime = new Date().toISOString();
      session.duration = new Date(session.endTime) - new Date(session.startTime);
      save();
    }
  }

  /**
   * Registra uso de uma funcionalidade
   * @param {string} featureName
   * @param {string} sessionId
   */
  function recordFeatureUsage(featureName, sessionId) {
    // Incrementar contador global
    analyticsData.featureUsage[featureName] = (analyticsData.featureUsage[featureName] || 0) + 1;

    // Adicionar à sessão
    const session = analyticsData.sessionData.find(s => s.sessionId === sessionId);
    if (session) {
      session.features.push({
        name: featureName,
        timestamp: new Date().toISOString()
      });
    }

    save();
  }

  /**
   * Registra uma visualização de página
   * @param {string} pageName
   * @param {string} sessionId
   */
  function recordPageView(pageName, sessionId) {
    const session = analyticsData.sessionData.find(s => s.sessionId === sessionId);
    if (session) {
      session.pageViews.push({
        page: pageName,
        timestamp: new Date().toISOString()
      });
    }
    save();
  }

  /**
   * Registra conclusão de tarefa
   * @param {string} taskName
   * @param {boolean} completed
   */
  function recordTaskCompletion(taskName, completed) {
    if (!analyticsData.taskCompletions[taskName]) {
      analyticsData.taskCompletions[taskName] = { completed: 0, total: 0 };
    }

    analyticsData.taskCompletions[taskName].total++;
    if (completed) {
      analyticsData.taskCompletions[taskName].completed++;
    }

    save();
  }

  /**
   * Registra um crash
   * @param {Object} crashData
   */
  function recordCrash(crashData) {
    analyticsData.crashes.push({
      ...crashData,
      timestamp: new Date().toISOString()
    });
    save();
  }

  /**
   * Registra uma métrica de performance
   * @param {string} metricName
   * @param {number} value
   */
  function recordPerformanceMetric(metricName, value) {
    analyticsData.performance.push({
      metric: metricName,
      value,
      timestamp: new Date().toISOString()
    });
    save();
  }

  /**
   * Calcula DAU (Daily Active Users)
   * @param {Date} date
   * @returns {number}
   */
  function getDAU(date = new Date()) {
    const dateStr = getDateString(date);
    const users = analyticsData.dailyActiveUsers[dateStr];
    return users ? users.size : 0;
  }

  /**
   * Calcula WAU (Weekly Active Users)
   * @param {Date} endDate
   * @returns {number}
   */
  function getWAU(endDate = new Date()) {
    const users = new Set();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = getDateString(date);

      if (analyticsData.dailyActiveUsers[dateStr]) {
        analyticsData.dailyActiveUsers[dateStr].forEach(userId => users.add(userId));
      }
    }

    return users.size;
  }

  /**
   * Calcula MAU (Monthly Active Users)
   * @param {Date} endDate
   * @returns {number}
   */
  function getMAU(endDate = new Date()) {
    const users = new Set();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = getDateString(date);

      if (analyticsData.dailyActiveUsers[dateStr]) {
        analyticsData.dailyActiveUsers[dateStr].forEach(userId => users.add(userId));
      }
    }

    return users.size;
  }

  /**
   * Calcula retenção de usuários
   * @param {number} days - 1, 7, 30
   * @returns {number} percentual de retenção
   */
  function getRetention(days = 1) {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - days);

    const targetDateStr = getDateString(targetDate);
    const todayDateStr = getDateString(now);

    const usersAtTarget = analyticsData.dailyActiveUsers[targetDateStr];
    const usersToday = analyticsData.dailyActiveUsers[todayDateStr];

    if (!usersAtTarget || usersAtTarget.size === 0) {
      return 0;
    }

    let retained = 0;
    usersAtTarget.forEach(userId => {
      if (usersToday && usersToday.has(userId)) {
        retained++;
      }
    });

    return Math.round((retained / usersAtTarget.size) * 100);
  }

  /**
   * Obtém as features mais usadas
   * @param {number} limit
   * @returns {Array}
   */
  function getTopFeatures(limit = 10) {
    return Object.entries(analyticsData.featureUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  /**
   * Obtém taxa de conclusão de tarefas
   * @returns {Object}
   */
  function getTaskCompletionRates() {
    const rates = {};

    Object.entries(analyticsData.taskCompletions).forEach(([taskName, data]) => {
      rates[taskName] = {
        completed: data.completed,
        total: data.total,
        rate: Math.round((data.completed / data.total) * 100)
      };
    });

    return rates;
  }

  /**
   * Obtém tempo médio de sessão
   * @returns {number} em milissegundos
   */
  function getAverageSessionTime() {
    const sessionsWithDuration = analyticsData.sessionData.filter(s => s.duration);

    if (sessionsWithDuration.length === 0) {
      return 0;
    }

    const totalDuration = sessionsWithDuration.reduce((sum, s) => sum + s.duration, 0);
    return Math.round(totalDuration / sessionsWithDuration.length);
  }

  /**
   * Obtém taxa de crash
   * @returns {number} percentual
   */
  function getCrashRate() {
    const totalSessions = analyticsData.sessionData.length;
    if (totalSessions === 0) {
      return 0;
    }

    return Math.round((analyticsData.crashes.length / totalSessions) * 100);
  }

  /**
   * Obtém métricas de performance
   * @param {string} metricName
   * @returns {Object} { avg, min, max, latest }
   */
  function getPerformanceMetrics(metricName) {
    const metrics = analyticsData.performance.filter(p => p.metric === metricName);

    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      avg: Math.round(sum / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
      count: values.length
    };
  }

  /**
   * Obtém um resumo completo de analytics
   * @returns {Object}
   */
  function getSummary() {
    return {
      dau: getDAU(),
      wau: getWAU(),
      mau: getMAU(),
      retentionD1: getRetention(1),
      retentionD7: getRetention(7),
      retentionD30: getRetention(30),
      averageSessionTime: getAverageSessionTime(),
      crashRate: getCrashRate(),
      totalSessions: analyticsData.sessionData.length,
      totalCrashes: analyticsData.crashes.length,
      topFeatures: getTopFeatures(5),
      taskCompletionRates: getTaskCompletionRates()
    };
  }

  /**
   * Obtém dados de uma sessão específica
   * @param {string} sessionId
   * @returns {Object}
   */
  function getSessionData(sessionId) {
    return analyticsData.sessionData.find(s => s.sessionId === sessionId);
  }

  /**
   * Obtém todas as sessões de um usuário
   * @param {string} userId
   * @returns {Array}
   */
  function getUserSessions(userId) {
    return analyticsData.sessionData.filter(s => s.userId === userId);
  }

  /**
   * Exporta dados de analytics (para relatórios)
   * @returns {Object}
   */
  function exportData() {
    return {
      summary: getSummary(),
      dailyActiveUsers: Object.entries(analyticsData.dailyActiveUsers).map(([date, users]) => ({
        date,
        count: users.size
      })),
      topFeatures: getTopFeatures(20),
      crashes: analyticsData.crashes.slice(-100), // Últimos 100 crashes
      performance: analyticsData.performance.slice(-1000) // Últimas 1000 métricas
    };
  }

  // ===== HELPERS =====

  function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function save() {
    // Converter Sets para Arrays para serialização
    const dataToSave = {
      ...analyticsData,
      dailyActiveUsers: Object.entries(analyticsData.dailyActiveUsers).reduce((acc, [date, users]) => {
        acc[date] = Array.from(users);
        return acc;
      }, {})
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }

  // ===== PUBLIC API =====

  return {
    init,
    recordDailyActiveUser,
    startSession,
    endSession,
    recordFeatureUsage,
    recordPageView,
    recordTaskCompletion,
    recordCrash,
    recordPerformanceMetric,
    getDAU,
    getWAU,
    getMAU,
    getRetention,
    getTopFeatures,
    getTaskCompletionRates,
    getAverageSessionTime,
    getCrashRate,
    getPerformanceMetrics,
    getSummary,
    getSessionData,
    getUserSessions,
    exportData
  };
})();

// Exportar globalmente
window.LifeOSAnalytics = AnalyticsEngine;
AnalyticsEngine.init();
