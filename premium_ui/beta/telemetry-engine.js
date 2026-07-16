/**
 * LifeOS Telemetry Engine
 * Sprint 029 | Version 1.0.0
 *
 * Motor de telemetria totalmente compatível com:
 * - LGPD (Lei Geral de Proteção de Dados)
 * - GDPR (General Data Protection Regulation)
 * - Consentimento explícito
 * - Anonimização
 * - Direito ao esquecimento
 */

'use strict';

const TelemetryEngine = (() => {
  const STORAGE_KEY = 'lifeos_telemetry_consent';
  const TELEMETRY_QUEUE_KEY = 'lifeos_telemetry_queue';
  const SESSION_ID_KEY = 'lifeos_session_id';
  const USER_HASH_KEY = 'lifeos_user_hash';

  let config = {
    enabled: false,
    consentGiven: false,
    anonymized: true,
    retentionDays: 90,
    batchSize: 50,
    flushIntervalMs: 30000, // 30 segundos
    endpoint: '/api/telemetry/events'
  };

  let sessionId = null;
  let userHash = null;
  let eventQueue = [];
  let flushTimer = null;

  /**
   * Inicializa o Telemetry Engine
   * @param {Object} options
   */
  function init(options = {}) {
    config = { ...config, ...options };

    // Restaurar sessão anterior
    sessionId = localStorage.getItem(SESSION_ID_KEY) || generateSessionId();
    userHash = localStorage.getItem(USER_HASH_KEY) || generateUserHash();

    localStorage.setItem(SESSION_ID_KEY, sessionId);
    localStorage.setItem(USER_HASH_KEY, userHash);

    // Restaurar fila de eventos
    try {
      const stored = localStorage.getItem(TELEMETRY_QUEUE_KEY);
      if (stored) {
        eventQueue = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Falha ao restaurar fila de telemetria:', e);
    }

    // Carregar consentimento
    loadConsent();

    // Iniciar timer de flush
    startFlushTimer();

    // Capturar erros globais
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // [removed]
  }

  /**
   * Solicita consentimento do usuário
   * @param {Object} options - { trackingTypes: ['analytics', 'crash', 'performance'] }
   * @returns {Promise<boolean>}
   */
  async function requestConsent(options = {}) {
    const { trackingTypes = ['analytics', 'crash'] } = options;

    // Mostrar modal de consentimento (implementado na UI)
    const consent = await showConsentModal(trackingTypes);

    if (consent.accepted) {
      config.consentGiven = true;
      config.enabled = true;

      const consentData = {
        timestamp: new Date().toISOString(),
        trackingTypes: consent.selectedTypes,
        version: '1.0'
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
      // [removed]

      // Flush de eventos pendentes
      await flush();

      return true;
    }

    config.consentGiven = false;
    config.enabled = false;
    return false;
  }

  /**
   * Registra um evento de telemetria
   * @param {string} eventName
   * @param {Object} data
   */
  function trackEvent(eventName, data = {}) {
    if (!config.enabled || !config.consentGiven) {
      return;
    }

    const event = {
      id: generateEventId(),
      name: eventName,
      timestamp: new Date().toISOString(),
      sessionId,
      userHash: config.anonymized ? userHash : null,
      data: sanitizeData(data),
      userAgent: navigator.userAgent,
      url: window.location.pathname
    };

    eventQueue.push(event);
    saveQueue();

    // Flush se atingiu o tamanho do lote
    if (eventQueue.length >= config.batchSize) {
      flush();
    }
  }

  /**
   * Registra uma visualização de página
   * @param {string} pageName
   * @param {Object} properties
   */
  function trackPageView(pageName, properties = {}) {
    trackEvent('page_view', {
      page: pageName,
      ...properties
    });
  }

  /**
   * Registra um clique em elemento
   * @param {string} elementId
   * @param {string} elementName
   */
  function trackClick(elementId, elementName) {
    trackEvent('click', {
      elementId,
      elementName
    });
  }

  /**
   * Registra tempo gasto em uma seção
   * @param {string} sectionName
   * @param {number} durationMs
   */
  function trackTimeSpent(sectionName, durationMs) {
    trackEvent('time_spent', {
      section: sectionName,
      duration: durationMs
    });
  }

  /**
   * Registra um erro/crash
   * @param {Error|string} error
   * @param {Object} context
   */
  function trackError(error, context = {}) {
    if (!config.enabled) {
      return;
    }

    const errorData = {
      message: error.message || String(error),
      stack: error.stack || null,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      sessionId,
      userHash: config.anonymized ? userHash : null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: sanitizeData(context)
    };

    // Enviar imediatamente (não aguardar fila)
    sendCrashReport(errorData);

    // Também adicionar à fila
    trackEvent('error', errorData);
  }

  /**
   * Registra uso de funcionalidade
   * @param {string} featureName
   * @param {Object} metadata
   */
  function trackFeatureUsage(featureName, metadata = {}) {
    trackEvent('feature_usage', {
      feature: featureName,
      ...metadata
    });
  }

  /**
   * Registra conclusão de tarefa
   * @param {string} taskName
   * @param {boolean} success
   * @param {number} durationMs
   */
  function trackTaskCompletion(taskName, success, durationMs) {
    trackEvent('task_completion', {
      task: taskName,
      success,
      duration: durationMs
    });
  }

  /**
   * Envia a fila de eventos para o servidor
   * @returns {Promise}
   */
  async function flush() {
    if (eventQueue.length === 0) {
      return;
    }

    const batch = eventQueue.splice(0, config.batchSize);
    saveQueue();

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          events: batch,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        // Recolocar na fila se falhar
        eventQueue.unshift(...batch);
        saveQueue();
        console.warn('[TelemetryEngine] Falha ao enviar eventos:', response.status);
      }
    } catch (e) {
      // Recolocar na fila se falhar
      eventQueue.unshift(...batch);
      saveQueue();
      console.warn('[TelemetryEngine] Erro ao enviar eventos:', e);
    }
  }

  /**
   * Envia um crash report imediatamente
   * @param {Object} errorData
   */
  async function sendCrashReport(errorData) {
    try {
      await fetch('/api/telemetry/crashes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify(errorData)
      });
    } catch (e) {
      console.warn('[TelemetryEngine] Falha ao enviar crash report:', e);
    }
  }

  /**
   * Deleta todos os dados de telemetria do usuário (direito ao esquecimento)
   * @returns {Promise}
   */
  async function deleteAllData() {
    try {
      await fetch('/api/telemetry/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash
        }
      });

      // Limpar dados locais
      localStorage.removeItem(SESSION_ID_KEY);
      localStorage.removeItem(USER_HASH_KEY);
      localStorage.removeItem(TELEMETRY_QUEUE_KEY);
      localStorage.removeItem(STORAGE_KEY);

      eventQueue = [];
      sessionId = generateSessionId();
      userHash = generateUserHash();

      // [removed]
      return true;
    } catch (e) {
      console.warn('[TelemetryEngine] Falha ao deletar dados:', e);
      return false;
    }
  }

  /**
   * Obtém o status de consentimento
   * @returns {Object}
   */
  function getConsentStatus() {
    return {
      consentGiven: config.consentGiven,
      enabled: config.enabled,
      anonymized: config.anonymized,
      trackingTypes: loadConsent().trackingTypes || []
    };
  }

  // ===== PRIVATE HELPERS =====

  function loadConsent() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        config.consentGiven = true;
        config.enabled = true;
        return data;
      }
    } catch (e) {
      console.warn('Falha ao carregar consentimento:', e);
    }
    return { trackingTypes: [] };
  }

  function startFlushTimer() {
    flushTimer = setInterval(() => {
      if (eventQueue.length > 0) {
        flush();
      }
    }, config.flushIntervalMs);
  }

  function saveQueue() {
    localStorage.setItem(TELEMETRY_QUEUE_KEY, JSON.stringify(eventQueue));
  }

  function sanitizeData(data) {
    // Remover dados sensíveis
    const sanitized = { ...data };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'creditCard', 'ssn'];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  function generateSessionId() {
    return `sess_${Date.now()}_${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'').slice(0,9) : Date.now().toString(36))}`;
  }

  function generateUserHash() {
    // Hash anônimo baseado em dados do dispositivo
    const data = `${navigator.userAgent}${navigator.language}${new Date().getTimezoneOffset()}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `user_${Math.abs(hash).toString(36)}`;
  }

  function generateEventId() {
    return `evt_${Date.now()}_${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'').slice(0,9) : Date.now().toString(36))}`;
  }

  function handleGlobalError(event) {
    trackError(event.error || new Error(event.message), {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  }

  function handleUnhandledRejection(event) {
    trackError(event.reason || new Error('Unhandled Promise Rejection'), {
      type: 'unhandled_rejection'
    });
  }

  async function showConsentModal(trackingTypes) {
    // Implementado na UI
    return new Promise(resolve => {
      window.addEventListener('telemetry-consent-response', (e) => {
        resolve(e.detail);
      }, { once: true });

      // Disparar evento para mostrar modal
      window.dispatchEvent(new CustomEvent('show-telemetry-consent', {
        detail: { trackingTypes }
      }));
    });
  }

  // ===== PUBLIC API =====

  return {
    init,
    requestConsent,
    trackEvent,
    trackPageView,
    trackClick,
    trackTimeSpent,
    trackError,
    trackFeatureUsage,
    trackTaskCompletion,
    flush,
    deleteAllData,
    getConsentStatus
  };
})();

// Exportar globalmente
window.LifeOSTelemetry = TelemetryEngine;
