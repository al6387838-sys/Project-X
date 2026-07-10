/**
 * LifeOS Feedback Center
 * Sprint 029 | Version 1.0.0
 *
 * Sistema de feedback integrado:
 * - Reportar Bug
 * - Enviar Sugestão
 * - Avaliar Funcionalidade
 * - Rastreamento de feedback
 */

'use strict';

const FeedbackCenter = (() => {
  const STORAGE_KEY = 'lifeos_feedback_data';
  const ENDPOINT = '/api/feedback';

  let feedbackData = {
    bugs: [],
    suggestions: [],
    ratings: [],
    userFeedback: {} // userId -> { bugCount, suggestionCount, ratingCount }
  };

  /**
   * Inicializa o Feedback Center
   */
  function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        feedbackData = JSON.parse(stored);
      } catch (e) {
        console.warn('Falha ao carregar dados de feedback:', e);
      }
    }
    console.log('[FeedbackCenter] Inicializado');
  }

  /**
   * Reporta um bug
   * @param {Object} bugReport - { title, description, severity, screenshot, userAgent, url }
   * @param {string} userId
   * @returns {Object} { success, message, bugId }
   */
  function reportBug(bugReport, userId) {
    // Validação básica
    if (!bugReport.title || bugReport.title.trim().length < 5) {
      return { success: false, message: 'Título do bug deve ter pelo menos 5 caracteres' };
    }

    if (!bugReport.description || bugReport.description.trim().length < 10) {
      return { success: false, message: 'Descrição deve ter pelo menos 10 caracteres' };
    }

    const severity = ['low', 'medium', 'high', 'critical'].includes(bugReport.severity)
      ? bugReport.severity
      : 'medium';

    const bug = {
      id: generateId('bug'),
      userId,
      title: bugReport.title.trim(),
      description: bugReport.description.trim(),
      severity,
      screenshot: bugReport.screenshot || null,
      userAgent: bugReport.userAgent || navigator.userAgent,
      url: bugReport.url || window.location.href,
      timestamp: new Date().toISOString(),
      status: 'open', // open, acknowledged, in-progress, resolved, wontfix
      votes: 0,
      comments: []
    };

    feedbackData.bugs.push(bug);
    updateUserFeedbackCount(userId, 'bug');
    save();

    // Enviar para servidor
    sendToServer('bugs', bug);

    return {
      success: true,
      message: 'Bug reportado com sucesso. Obrigado!',
      bugId: bug.id
    };
  }

  /**
   * Envia uma sugestão de funcionalidade
   * @param {Object} suggestion - { title, description, category, impact }
   * @param {string} userId
   * @returns {Object} { success, message, suggestionId }
   */
  function submitSuggestion(suggestion, userId) {
    // Validação básica
    if (!suggestion.title || suggestion.title.trim().length < 5) {
      return { success: false, message: 'Título da sugestão deve ter pelo menos 5 caracteres' };
    }

    if (!suggestion.description || suggestion.description.trim().length < 10) {
      return { success: false, message: 'Descrição deve ter pelo menos 10 caracteres' };
    }

    const category = ['feature', 'improvement', 'ui', 'performance', 'other'].includes(suggestion.category)
      ? suggestion.category
      : 'feature';

    const impact = ['low', 'medium', 'high'].includes(suggestion.impact)
      ? suggestion.impact
      : 'medium';

    const sug = {
      id: generateId('sug'),
      userId,
      title: suggestion.title.trim(),
      description: suggestion.description.trim(),
      category,
      impact,
      timestamp: new Date().toISOString(),
      status: 'open', // open, under-review, planned, implemented, declined
      votes: 0,
      comments: []
    };

    feedbackData.suggestions.push(sug);
    updateUserFeedbackCount(userId, 'suggestion');
    save();

    // Enviar para servidor
    sendToServer('suggestions', sug);

    return {
      success: true,
      message: 'Sugestão enviada com sucesso!',
      suggestionId: sug.id
    };
  }

  /**
   * Avalia uma funcionalidade
   * @param {Object} rating - { featureName, score, comment }
   * @param {string} userId
   * @returns {Object} { success, message, ratingId }
   */
  function rateFeature(rating, userId) {
    // Validação
    if (!rating.featureName || rating.featureName.trim().length === 0) {
      return { success: false, message: 'Nome da funcionalidade é obrigatório' };
    }

    if (typeof rating.score !== 'number' || rating.score < 1 || rating.score > 5) {
      return { success: false, message: 'Avaliação deve ser entre 1 e 5' };
    }

    const ratingEntry = {
      id: generateId('rating'),
      userId,
      featureName: rating.featureName.trim(),
      score: Math.round(rating.score),
      comment: rating.comment ? rating.comment.trim() : '',
      timestamp: new Date().toISOString()
    };

    feedbackData.ratings.push(ratingEntry);
    updateUserFeedbackCount(userId, 'rating');
    save();

    // Enviar para servidor
    sendToServer('ratings', ratingEntry);

    return {
      success: true,
      message: 'Obrigado pela avaliação!',
      ratingId: ratingEntry.id
    };
  }

  /**
   * Vota em um bug ou sugestão
   * @param {string} type - 'bug' ou 'suggestion'
   * @param {string} id
   * @returns {boolean}
   */
  function vote(type, id) {
    const collection = type === 'bug' ? feedbackData.bugs : feedbackData.suggestions;
    const item = collection.find(i => i.id === id);

    if (item) {
      item.votes++;
      save();
      return true;
    }

    return false;
  }

  /**
   * Adiciona um comentário a um bug ou sugestão
   * @param {string} type - 'bug' ou 'suggestion'
   * @param {string} id
   * @param {string} comment
   * @param {string} userId
   * @returns {boolean}
   */
  function addComment(type, id, comment, userId) {
    if (!comment || comment.trim().length === 0) {
      return false;
    }

    const collection = type === 'bug' ? feedbackData.bugs : feedbackData.suggestions;
    const item = collection.find(i => i.id === id);

    if (item) {
      item.comments.push({
        id: generateId('comment'),
        userId,
        text: comment.trim(),
        timestamp: new Date().toISOString()
      });
      save();
      return true;
    }

    return false;
  }

  /**
   * Obtém todos os bugs reportados
   * @param {Object} filters - { severity, status, userId }
   * @returns {Array}
   */
  function getBugs(filters = {}) {
    let bugs = feedbackData.bugs;

    if (filters.severity) {
      bugs = bugs.filter(b => b.severity === filters.severity);
    }

    if (filters.status) {
      bugs = bugs.filter(b => b.status === filters.status);
    }

    if (filters.userId) {
      bugs = bugs.filter(b => b.userId === filters.userId);
    }

    return bugs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Obtém todas as sugestões
   * @param {Object} filters - { category, status, userId }
   * @returns {Array}
   */
  function getSuggestions(filters = {}) {
    let suggestions = feedbackData.suggestions;

    if (filters.category) {
      suggestions = suggestions.filter(s => s.category === filters.category);
    }

    if (filters.status) {
      suggestions = suggestions.filter(s => s.status === filters.status);
    }

    if (filters.userId) {
      suggestions = suggestions.filter(s => s.userId === filters.userId);
    }

    return suggestions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Obtém todas as avaliações
   * @param {string} featureName - opcional
   * @returns {Array}
   */
  function getRatings(featureName = null) {
    let ratings = feedbackData.ratings;

    if (featureName) {
      ratings = ratings.filter(r => r.featureName === featureName);
    }

    return ratings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Obtém estatísticas de feedback
   * @returns {Object}
   */
  function getStats() {
    const openBugs = feedbackData.bugs.filter(b => b.status === 'open').length;
    const criticalBugs = feedbackData.bugs.filter(b => b.severity === 'critical').length;

    const avgRating = feedbackData.ratings.length > 0
      ? (feedbackData.ratings.reduce((sum, r) => sum + r.score, 0) / feedbackData.ratings.length).toFixed(2)
      : 0;

    const featureRatings = {};
    feedbackData.ratings.forEach(r => {
      if (!featureRatings[r.featureName]) {
        featureRatings[r.featureName] = { scores: [], count: 0 };
      }
      featureRatings[r.featureName].scores.push(r.score);
      featureRatings[r.featureName].count++;
    });

    const topRatedFeatures = Object.entries(featureRatings)
      .map(([name, data]) => ({
        name,
        avgScore: (data.scores.reduce((a, b) => a + b, 0) / data.count).toFixed(2),
        count: data.count
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    return {
      totalBugs: feedbackData.bugs.length,
      openBugs,
      criticalBugs,
      totalSuggestions: feedbackData.suggestions.length,
      totalRatings: feedbackData.ratings.length,
      averageRating: parseFloat(avgRating),
      topRatedFeatures,
      bugsBySeverity: {
        low: feedbackData.bugs.filter(b => b.severity === 'low').length,
        medium: feedbackData.bugs.filter(b => b.severity === 'medium').length,
        high: feedbackData.bugs.filter(b => b.severity === 'high').length,
        critical: criticalBugs
      }
    };
  }

  /**
   * Obtém feedback de um usuário específico
   * @param {string} userId
   * @returns {Object}
   */
  function getUserFeedback(userId) {
    return {
      bugs: getBugs({ userId }),
      suggestions: getSuggestions({ userId }),
      ratings: feedbackData.ratings.filter(r => r.userId === userId),
      stats: feedbackData.userFeedback[userId] || { bugCount: 0, suggestionCount: 0, ratingCount: 0 }
    };
  }

  // ===== PRIVATE HELPERS =====

  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function updateUserFeedbackCount(userId, type) {
    if (!feedbackData.userFeedback[userId]) {
      feedbackData.userFeedback[userId] = { bugCount: 0, suggestionCount: 0, ratingCount: 0 };
    }

    if (type === 'bug') {
      feedbackData.userFeedback[userId].bugCount++;
    } else if (type === 'suggestion') {
      feedbackData.userFeedback[userId].suggestionCount++;
    } else if (type === 'rating') {
      feedbackData.userFeedback[userId].ratingCount++;
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feedbackData));
  }

  async function sendToServer(type, data) {
    try {
      await fetch(`${ENDPOINT}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.warn('[FeedbackCenter] Falha ao enviar feedback:', e);
    }
  }

  // ===== PUBLIC API =====

  return {
    init,
    reportBug,
    submitSuggestion,
    rateFeature,
    vote,
    addComment,
    getBugs,
    getSuggestions,
    getRatings,
    getStats,
    getUserFeedback
  };
})();

// Exportar globalmente
window.LifeOSFeedback = FeedbackCenter;
FeedbackCenter.init();
