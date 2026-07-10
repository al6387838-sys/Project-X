/**
 * LifeOS Beta Program Manager
 * Sprint 029 | Version 1.0.0
 *
 * Gerencia:
 * - Lista de espera
 * - Geração de códigos de convite
 * - Validação de acesso
 * - Controle de tiers (Early Access, Standard, VIP)
 * - Rastreamento de usuários beta
 */

'use strict';

const BetaManager = (() => {
  const STORAGE_KEY = 'lifeos_beta_data';
  const INVITE_CODE_LENGTH = 12;
  const INVITE_EXPIRY_DAYS = 30;

  // Estrutura de dados
  let betaData = {
    waitlist: [],
    inviteCodes: [],
    betaUsers: [],
    tiers: {
      'early-access': { slots: 50, description: 'Acesso antecipado' },
      'standard': { slots: 200, description: 'Beta padrão' },
      'vip': { slots: 50, description: 'Beta VIP com suporte prioritário' }
    }
  };

  /**
   * Inicializa o Beta Manager
   */
  function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        betaData = JSON.parse(stored);
      } catch (e) {
        console.warn('Falha ao carregar dados de beta:', e);
      }
    }
    console.log('[BetaManager] Inicializado');
  }

  /**
   * Adiciona um usuário à lista de espera
   * @param {string} email
   * @param {string} tier - 'early-access', 'standard', 'vip'
   * @returns {Object} { success, message, position }
   */
  function addToWaitlist(email, tier = 'standard') {
    // Validar email
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Email inválido' };
    }

    // Verificar se já existe
    if (betaData.waitlist.some(w => w.email === email)) {
      return { success: false, message: 'Email já está na lista de espera' };
    }

    // Verificar se já é usuário beta
    if (betaData.betaUsers.some(u => u.email === email)) {
      return { success: false, message: 'Usuário já tem acesso ao beta' };
    }

    // Validar tier
    if (!betaData.tiers[tier]) {
      return { success: false, message: 'Tier inválido' };
    }

    const entry = {
      id: generateId(),
      email,
      tier,
      joinedAt: new Date().toISOString(),
      referralCode: generateReferralCode(),
      referrals: 0,
      position: betaData.waitlist.length + 1
    };

    betaData.waitlist.push(entry);
    save();

    return {
      success: true,
      message: 'Adicionado à lista de espera',
      position: entry.position,
      referralCode: entry.referralCode
    };
  }

  /**
   * Gera um código de convite único
   * @param {string} email - Email do usuário a ser convidado
   * @param {string} tier - Tier de acesso
   * @returns {Object} { code, expiresAt, email }
   */
  function generateInviteCode(email, tier = 'standard') {
    const code = generateRandomCode(INVITE_CODE_LENGTH);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const inviteCode = {
      code,
      email,
      tier,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
      usedAt: null,
      usedBy: null
    };

    betaData.inviteCodes.push(inviteCode);
    save();

    return inviteCode;
  }

  /**
   * Valida um código de convite
   * @param {string} code
   * @returns {Object} { valid, message, tier, email }
   */
  function validateInviteCode(code) {
    const invite = betaData.inviteCodes.find(i => i.code === code);

    if (!invite) {
      return { valid: false, message: 'Código de convite não encontrado' };
    }

    if (invite.used) {
      return { valid: false, message: 'Código já foi utilizado' };
    }

    const expiryDate = new Date(invite.expiresAt);
    if (new Date() > expiryDate) {
      return { valid: false, message: 'Código de convite expirado' };
    }

    return {
      valid: true,
      message: 'Código válido',
      tier: invite.tier,
      email: invite.email
    };
  }

  /**
   * Resgata um código de convite para um usuário
   * @param {string} code
   * @param {string} userId
   * @param {Object} userData - { name, email, ... }
   * @returns {Object} { success, message, tier }
   */
  function redeemInviteCode(code, userId, userData) {
    const validation = validateInviteCode(code);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    const invite = betaData.inviteCodes.find(i => i.code === code);
    invite.used = true;
    invite.usedAt = new Date().toISOString();
    invite.usedBy = userId;

    // Adicionar ao grupo de usuários beta
    const betaUser = {
      id: userId,
      ...userData,
      tier: invite.tier,
      inviteCode: code,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      feedbackCount: 0,
      crashReportsCount: 0,
      sessionCount: 0
    };

    betaData.betaUsers.push(betaUser);

    // Remover da lista de espera se existir
    betaData.waitlist = betaData.waitlist.filter(w => w.email !== userData.email);

    save();

    return {
      success: true,
      message: 'Bem-vindo ao beta!',
      tier: invite.tier
    };
  }

  /**
   * Verifica se um usuário tem acesso ao beta
   * @param {string} userId
   * @returns {Object} { isBetaTester, tier, joinedAt }
   */
  function isBetaTester(userId) {
    const user = betaData.betaUsers.find(u => u.id === userId);
    if (!user) {
      return { isBetaTester: false };
    }
    return {
      isBetaTester: true,
      tier: user.tier,
      joinedAt: user.joinedAt
    };
  }

  /**
   * Atualiza a atividade do usuário beta
   * @param {string} userId
   */
  function updateBetaUserActivity(userId) {
    const user = betaData.betaUsers.find(u => u.id === userId);
    if (user) {
      user.lastActiveAt = new Date().toISOString();
      user.sessionCount = (user.sessionCount || 0) + 1;
      save();
    }
  }

  /**
   * Incrementa contador de feedback
   * @param {string} userId
   */
  function incrementFeedbackCount(userId) {
    const user = betaData.betaUsers.find(u => u.id === userId);
    if (user) {
      user.feedbackCount = (user.feedbackCount || 0) + 1;
      save();
    }
  }

  /**
   * Incrementa contador de crash reports
   * @param {string} userId
   */
  function incrementCrashReportCount(userId) {
    const user = betaData.betaUsers.find(u => u.id === userId);
    if (user) {
      user.crashReportsCount = (user.crashReportsCount || 0) + 1;
      save();
    }
  }

  /**
   * Obtém estatísticas do programa beta
   * @returns {Object}
   */
  function getStats() {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeUsers = betaData.betaUsers.filter(u => {
      const lastActive = new Date(u.lastActiveAt);
      return lastActive > last7Days;
    }).length;

    return {
      waitlistCount: betaData.waitlist.length,
      betaUsersCount: betaData.betaUsers.length,
      activeUsersLast7Days: activeUsers,
      inviteCodesGenerated: betaData.inviteCodes.length,
      inviteCodesUsed: betaData.inviteCodes.filter(i => i.used).length,
      inviteCodesExpired: betaData.inviteCodes.filter(i => {
        const expiry = new Date(i.expiresAt);
        return !i.used && expiry < now;
      }).length,
      tierDistribution: {
        'early-access': betaData.betaUsers.filter(u => u.tier === 'early-access').length,
        'standard': betaData.betaUsers.filter(u => u.tier === 'standard').length,
        'vip': betaData.betaUsers.filter(u => u.tier === 'vip').length
      }
    };
  }

  /**
   * Obtém lista de usuários beta (apenas para admin)
   * @returns {Array}
   */
  function getBetaUsers() {
    return betaData.betaUsers.map(u => ({
      ...u,
      lastActiveAt: u.lastActiveAt,
      feedbackCount: u.feedbackCount || 0,
      crashReportsCount: u.crashReportsCount || 0
    }));
  }

  /**
   * Obtém lista de espera (apenas para admin)
   * @returns {Array}
   */
  function getWaitlist() {
    return betaData.waitlist.sort((a, b) => {
      // Ordenar por tier (VIP primeiro) e depois por data
      const tierOrder = { 'vip': 0, 'early-access': 1, 'standard': 2 };
      if (tierOrder[a.tier] !== tierOrder[b.tier]) {
        return tierOrder[a.tier] - tierOrder[b.tier];
      }
      return new Date(a.joinedAt) - new Date(b.joinedAt);
    });
  }

  /**
   * Promove um usuário da lista de espera para beta
   * @param {string} email
   * @returns {Object}
   */
  function promoteFromWaitlist(email) {
    const waitlistEntry = betaData.waitlist.find(w => w.email === email);
    if (!waitlistEntry) {
      return { success: false, message: 'Usuário não encontrado na lista de espera' };
    }

    const inviteCode = generateInviteCode(email, waitlistEntry.tier);
    return {
      success: true,
      message: 'Convite gerado',
      inviteCode: inviteCode.code,
      expiresAt: inviteCode.expiresAt
    };
  }

  // ===== HELPERS =====

  function generateId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function generateRandomCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function generateReferralCode() {
    return generateRandomCode(8);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(betaData));
  }

  // ===== PUBLIC API =====

  return {
    init,
    addToWaitlist,
    generateInviteCode,
    validateInviteCode,
    redeemInviteCode,
    isBetaTester,
    updateBetaUserActivity,
    incrementFeedbackCount,
    incrementCrashReportCount,
    getStats,
    getBetaUsers,
    getWaitlist,
    promoteFromWaitlist
  };
})();

// Exportar globalmente
window.LifeOSBetaManager = BetaManager;
BetaManager.init();
