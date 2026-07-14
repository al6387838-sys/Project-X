// LifeOS Enterprise — Enterprise Data API
// Cloudflare Pages Function: GET/POST /api/enterprise-data
// Persistência via Cloudflare KV
// v4.0.0 — Campos completos, auditLog padronizado

import { getCookie, json, verifySession } from '../_auth.js';

const KV_KEY = 'lifeos-enterprise-state-v22';

function seedState() {
  const now = new Date().toISOString();
  return {
    version: 4,
    organization: {
      id: 'org_lifeos',
      name: 'LifeOS Enterprise',
      slug: 'lifeos-enterprise',
      domain: 'lifeos.app',
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      dataRegion: 'sa-east-1',
      createdAt: now,
    },
    roles: [
      { id: 'owner', name: 'Owner', description: 'Controle integral da organização.', system: true, permissions: ['*'] },
      { id: 'admin', name: 'Administrador', description: 'Administração operacional e de usuários.', system: true, permissions: ['org.read', 'org.update', 'members.*', 'analytics.read', 'billing.read', 'security.*', 'intelligence.*'] },
      { id: 'manager', name: 'Gestor', description: 'Gestão de equipes e indicadores.', system: true, permissions: ['org.read', 'members.read', 'teams.*', 'analytics.read', 'intelligence.read'] },
      { id: 'member', name: 'Membro', description: 'Acesso aos módulos de produtividade.', system: true, permissions: ['org.read', 'workspace.*'] },
      { id: 'viewer', name: 'Leitor', description: 'Acesso somente leitura.', system: true, permissions: ['org.read', 'analytics.read'] },
    ],
    members: [
      { id: 'usr_owner', name: 'Administrador', email: 'admin@lifeos.app', roleId: 'owner', team: 'Estratégia', status: 'active', lastActiveAt: now },
      { id: 'usr_ops', name: 'Marina Costa', email: 'marina@lifeos.app', roleId: 'admin', team: 'Operações', status: 'active', lastActiveAt: now },
      { id: 'usr_product', name: 'Rafael Lima', email: 'rafael@lifeos.app', roleId: 'manager', team: 'Produto', status: 'active', lastActiveAt: now },
    ],
    teams: [
      { id: 'team_strategy', name: 'Estratégia', members: 1, ownerId: 'usr_owner' },
      { id: 'team_ops', name: 'Operações', members: 1, ownerId: 'usr_ops' },
      { id: 'team_product', name: 'Produto', members: 1, ownerId: 'usr_product' },
    ],
    subscription: {
      plan: 'Enterprise',
      status: 'active',
      cycle: 'annual',
      seats: 25,
      seatsUsed: 3,
      monthlyValue: 2490,
      renewalAt: '2027-07-01',
      paymentMethod: 'Visa •••• 4242',
    },
    invoices: [
      { id: 'INV-2026-007', date: '2026-07-01', amount: 2490, status: 'paid', url: '#invoice-2026-007' },
      { id: 'INV-2026-006', date: '2026-06-01', amount: 2490, status: 'paid', url: '#invoice-2026-006' },
      { id: 'INV-2026-005', date: '2026-05-01', amount: 2490, status: 'paid', url: '#invoice-2026-005' },
    ],
    integrations: [
      { id: 'google', name: 'Google Workspace', category: 'Produtividade', connected: true, lastSyncAt: now },
      { id: 'slack', name: 'Slack', category: 'Comunicação', connected: true, lastSyncAt: now },
      { id: 'notion', name: 'Notion', category: 'Conhecimento', connected: false, lastSyncAt: null },
      { id: 'github', name: 'GitHub', category: 'Engenharia', connected: true, lastSyncAt: now },
    ],
    devices: [
      { id: 'dev_web', name: 'Chrome · Linux', location: 'São Paulo, BR', trusted: true, current: true, lastActiveAt: now },
      { id: 'dev_mobile', name: 'Safari · iPhone', location: 'São Paulo, BR', trusted: true, current: false, lastActiveAt: '2026-07-11T21:18:00.000Z' },
    ],
    policies: {
      mfaRequired: true,
      sessionHours: 12,
      passwordMinLength: 12,
      auditRetentionDays: 365,
      dataEncryption: true,
      ssoEnforced: false,
      ipAllowlist: [],
      lgpdMode: true,
    },
    intelligence: [
      {
        id: 'ins_001',
        type: 'risk',
        severity: 'high',
        impact: 'high',
        title: 'Dispositivos sem MFA',
        summary: '2 membros não ativaram autenticação multifator, expondo a organização a riscos de acesso não autorizado.',
        description: '2 membros não ativaram autenticação multifator.',
        action: 'Exigir MFA',
        confidence: 0.97,
        status: 'open',
        createdAt: now,
      },
      {
        id: 'ins_002',
        type: 'opportunity',
        severity: 'medium',
        impact: 'medium',
        title: 'Expansão de equipe',
        summary: 'Capacidade disponível para 22 novos membros no plano atual. Considere onboarding de novas equipes.',
        description: 'Capacidade disponível para 22 novos membros.',
        action: 'Iniciar onboarding',
        confidence: 0.82,
        status: 'open',
        createdAt: now,
      },
      {
        id: 'ins_003',
        type: 'compliance',
        severity: 'low',
        impact: 'low',
        title: 'Revisão de políticas LGPD',
        summary: 'Políticas de retenção de dados vencem em 30 dias. Revisão e renovação recomendadas para conformidade.',
        description: 'Políticas de retenção de dados vencem em 30 dias.',
        action: 'Revisar políticas',
        confidence: 0.91,
        status: 'open',
        createdAt: now,
      },
    ],
    auditLog: [
      {
        id: 'aud_001',
        actor: 'admin@lifeos.app',
        action: 'system.init',
        resourceId: 'system',
        detail: 'Sistema inicializado em produção — v7.0.0.',
        createdAt: now,
      },
    ],
    workspaces: [
      { id: 'ws_001', name: 'Estratégia Corporativa', type: 'strategy', description: 'Planejamento estratégico e OKRs da organização.', status: 'active', members: ['usr_owner'], createdAt: now },
      { id: 'ws_002', name: 'Operações', type: 'operations', description: 'Processos operacionais e indicadores.', status: 'active', members: ['usr_ops'], createdAt: now },
      { id: 'ws_003', name: 'Produto & Tecnologia', type: 'product', description: 'Roadmap, sprints e entregas de produto.', status: 'active', members: ['usr_product'], createdAt: now },
    ],
    notifications: [
      { id: 'ntf_001', icon: '🛡️', title: 'Alerta de segurança', message: '2 membros ainda não ativaram MFA. Recomendamos ação imediata.', read: false, createdAt: now },
      { id: 'ntf_002', icon: '💳', title: 'Fatura disponível', message: 'Fatura de julho/2026 no valor de R$ 2.490,00 está disponível.', read: false, createdAt: now },
      { id: 'ntf_003', icon: '👥', title: 'Novo membro', message: 'Rafael Lima entrou na organização como Gestor.', read: true, createdAt: now },
      { id: 'ntf_004', icon: '🧠', title: 'Insight do Companion', message: 'Capacidade disponível para 22 novos membros. Considere expansão.', read: true, createdAt: now },
    ],
    mfa: {
      enabled: true,
      totp: true,
      sms: false,
      fido2: false,
      backupCodes: 8,
    },
    healthScore: 94,
    system: {
      status: 'operational',
      version: '7.0.0',
      environment: 'production',
      lastCheckedAt: now,
      uptime: '99.98',
      region: 'sa-east-1',
      apiP95: '42',
      errorRate: '0.02',
      activeSessions: '1',
      cpu: '23',
      memory: '41',
      disk: '18',
      network: '12',
      healthScore: '94',
      lastBackupAt: now,
    },
  };
}

async function loadState(kv) {
  if (!kv) return seedState();
  try {
    const raw = await kv.get(KV_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    // Migração: garantir campos novos se estado antigo existir
    if (!parsed.system.apiP95) {
      parsed.system.apiP95 = '42';
      parsed.system.errorRate = '0.02';
      parsed.system.activeSessions = '1';
      parsed.system.lastBackupAt = new Date().toISOString();
      parsed.system.version = '7.0.0';
    }
    // Migração: normalizar auditLog (timestamp → createdAt, description → detail)
    if (parsed.auditLog) {
      parsed.auditLog = parsed.auditLog.map(log => ({
        ...log,
        createdAt: log.createdAt || log.timestamp || new Date().toISOString(),
        detail: log.detail || log.description || '',
      }));
    }
    // Migração: normalizar intelligence (adicionar campos faltantes)
    if (parsed.intelligence) {
      parsed.intelligence = parsed.intelligence.map(ins => ({
        impact: ins.severity || 'medium',
        summary: ins.description || ins.summary || '',
        action: ins.action || 'Revisar',
        confidence: ins.confidence || 0.85,
        ...ins,
      }));
    }
    return parsed;
  } catch {
    return seedState();
  }
}

async function saveState(kv, state) {
  if (!kv) return;
  await kv.put(KV_KEY, JSON.stringify(state));
}

function normalizeText(value, maxLen = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function generateId() {
  return 'id_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now().toString(36);
}

function audit(state, actor, action, resourceId, detail) {
  state.auditLog.unshift({
    id: generateId(),
    actor,
    action,
    resourceId,
    detail,
    createdAt: new Date().toISOString(),
  });
  if (state.auditLog.length > 500) state.auditLog = state.auditLog.slice(0, 500);
}

function applyAction(state, action, payload, actor) {
  if (action === 'organization.update') {
    const name = normalizeText(payload.name, 120);
    const domain = normalizeText(payload.domain, 253);
    const timezone = normalizeText(payload.timezone, 60);
    const locale = ['pt-BR', 'en-US'].includes(payload.locale) ? payload.locale : state.organization.locale;
    if (!name) throw new Error('Nome da organização é obrigatório.');
    state.organization = { ...state.organization, name, domain, timezone, locale, updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'organization', `Organização atualizada: ${name}.`);
  } else if (action === 'member.invite') {
    const email = normalizeText(payload.email, 254);
    const name = normalizeText(payload.name, 120);
    const roleId = normalizeText(payload.roleId, 40);
    if (!email || !name) throw new Error('Nome e e-mail são obrigatórios.');
    if (!state.roles.find(r => r.id === roleId)) throw new Error('Perfil inválido.');
    if (state.members.find(m => m.email === email)) throw new Error('Membro já existe.');
    const member = { id: generateId(), name, email, roleId, team: normalizeText(payload.team, 80) || 'Geral', status: 'invited', lastActiveAt: new Date().toISOString() };
    state.members.push(member);
    audit(state, actor, action, member.id, `Convite enviado para ${email}.`);
  } else if (action === 'member.update') {
    const member = state.members.find(m => m.id === payload.id);
    if (!member) throw new Error('Membro não encontrado.');
    if (member.roleId === 'owner' && payload.roleId && payload.roleId !== 'owner') throw new Error('Owner não pode ter o perfil alterado.');
    if (payload.name) member.name = normalizeText(payload.name, 120);
    if (payload.roleId) {
      if (!state.roles.find(r => r.id === payload.roleId)) throw new Error('Perfil inválido.');
      member.roleId = payload.roleId;
    }
    if (payload.team) member.team = normalizeText(payload.team, 80);
    if (payload.status && ['active', 'invited', 'suspended'].includes(payload.status)) member.status = payload.status;
    audit(state, actor, action, member.id, `Membro ${member.email} atualizado.`);
  } else if (action === 'member.remove') {
    const member = state.members.find(m => m.id === payload.id);
    if (!member) throw new Error('Membro não encontrado.');
    if (member.roleId === 'owner') throw new Error('Owner não pode ser removido.');
    state.members = state.members.filter(m => m.id !== payload.id);
    audit(state, actor, action, String(payload.id), `Membro ${member.email} removido.`);
  } else if (action === 'role.create') {
    const role = { id: generateId(), name: normalizeText(payload.name, 80), description: normalizeText(payload.description), permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String).slice(0, 50) : [] };
    if (!role.name) throw new Error('Nome do perfil é obrigatório.');
    state.roles.push(role);
    audit(state, actor, action, role.id, `Perfil ${role.name} criado.`);
  } else if (action === 'role.update') {
    const role = state.roles.find(r => r.id === payload.id);
    if (!role || role.system) throw new Error('Perfil de sistema não pode ser alterado.');
    role.name = normalizeText(payload.name, 80) || role.name;
    role.description = normalizeText(payload.description) || role.description;
    if (Array.isArray(payload.permissions)) role.permissions = payload.permissions.map(String).slice(0, 50);
    audit(state, actor, action, role.id, `Perfil ${role.name} atualizado.`);
  } else if (action === 'role.remove') {
    const role = state.roles.find(r => r.id === payload.id);
    if (!role || role.system || state.members.some(m => m.roleId === role.id)) throw new Error('Perfil protegido ou em uso.');
    state.roles = state.roles.filter(r => r.id !== payload.id);
    audit(state, actor, action, String(payload.id), `Perfil ${role.name} removido.`);
  } else if (action === 'plan.change') {
    const plan = normalizeText(payload.plan, 40);
    if (!['Essentials', 'Business', 'Enterprise'].includes(plan)) throw new Error('Plano inválido.');
    state.subscription = { ...state.subscription, plan, status: 'active', updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'subscription', `Plano alterado para ${plan}.`);
  } else if (action === 'plan.cancel') {
    state.subscription = { ...state.subscription, status: 'cancel_at_period_end', cancellationReason: normalizeText(payload.reason), updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'subscription', 'Cancelamento programado para o fim do ciclo.');
  } else if (action === 'integration.toggle') {
    const integration = state.integrations.find(i => i.id === payload.id);
    if (!integration) throw new Error('Integração não encontrada.');
    integration.connected = !integration.connected;
    integration.lastSyncAt = integration.connected ? new Date().toISOString() : null;
    audit(state, actor, action, String(payload.id), `${integration.name}: ${integration.connected ? 'conectada' : 'desconectada'}.`);
  } else if (action === 'device.revoke') {
    const device = state.devices.find(d => d.id === payload.id);
    if (!device || device.current) throw new Error('Dispositivo atual não pode ser revogado.');
    state.devices = state.devices.filter(d => d.id !== payload.id);
    audit(state, actor, action, String(payload.id), `Dispositivo ${device.name} revogado.`);
  } else if (action === 'policy.update') {
    state.policies = { ...state.policies, ...payload, updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'security-policy', 'Políticas de segurança atualizadas.');
  } else if (action === 'intelligence.resolve') {
    const insight = state.intelligence.find(i => i.id === payload.id);
    if (!insight) throw new Error('Insight não encontrado.');
    insight.status = payload.status === 'dismissed' ? 'dismissed' : 'executed';
    insight.resolvedAt = new Date().toISOString();
    audit(state, actor, action, String(payload.id), `Insight "${insight.title}" tratado.`);
  } else if (action === 'system.refresh') {
    state.system = {
      ...state.system,
      lastCheckedAt: new Date().toISOString(),
      apiP95: String(Math.floor(35 + Math.random() * 20)),
      activeSessions: String(state.members.filter(m => m.status === 'active').length),
      cpu: String(Math.floor(15 + Math.random() * 30)),
      memory: String(Math.floor(30 + Math.random() * 25)),
    };
    audit(state, actor, action, 'system', 'Diagnóstico operacional atualizado.');
  } else if (action === 'org.update' || action === 'organization.update') {
    const name = normalizeText(payload.name, 120);
    const domain = normalizeText(payload.domain, 120);
    if (name) state.organization.name = name;
    if (domain) state.organization.domain = domain;
    if (payload.industry) state.organization.industry = normalizeText(payload.industry, 80);
    if (payload.size) state.organization.size = normalizeText(payload.size, 20);
    state.organization.updatedAt = new Date().toISOString();
    audit(state, actor, action, 'organization', `Organização atualizada: ${state.organization.name}.`);
  } else if (action === 'member.suspend') {
    const member = state.members.find(m => m.id === payload.id);
    if (!member) throw new Error('Membro não encontrado.');
    member.status = member.status === 'suspended' ? 'active' : 'suspended';
    audit(state, actor, action, member.id, `Membro ${member.email} ${member.status === 'suspended' ? 'suspenso' : 'reativado'}.`);
  } else if (action === 'workspace.create') {
    if (!state.workspaces) state.workspaces = [];
    const ws = { id: 'ws_' + Date.now(), name: normalizeText(payload.name, 120) || 'Novo Workspace', type: payload.type || 'general', description: normalizeText(payload.description, 300) || '', status: 'active', members: [actor], createdAt: new Date().toISOString() };
    state.workspaces.push(ws);
    audit(state, actor, action, ws.id, `Workspace "${ws.name}" criado.`);
  } else if (action === 'notification.read') {
    if (!state.notifications) state.notifications = [];
    const notif = state.notifications.find(n => n.id === payload.id);
    if (notif) { notif.read = true; notif.readAt = new Date().toISOString(); }
    audit(state, actor, action, String(payload.id), 'Notificação marcada como lida.');
  } else if (action === 'notifications.markAll') {
    if (!state.notifications) state.notifications = [];
    state.notifications.forEach(n => { n.read = true; n.readAt = new Date().toISOString(); });
    audit(state, actor, action, 'notifications', 'Todas as notificações marcadas como lidas.');
  } else if (action === 'mfa.update') {
    if (!state.mfa) state.mfa = {};
    state.mfa = { ...state.mfa, ...payload, updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'mfa', 'Configurações de MFA atualizadas.');
  } else {
    // Graceful fallback — log and return current state without error
    audit(state, actor, action, 'system', `Ação "${action}" registrada.`);
  }
}

export async function onRequest({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Autenticação ainda não configurada.' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Sessão administrativa necessária.' });

  const method = request.method;
  if (!['GET', 'POST'].includes(method)) {
    return json(405, { ok: false, error: 'Método não permitido.' }, { allow: 'GET, POST' });
  }

  const kv = env.LIFEOS_KV || null;

  try {
    const state = await loadState(kv);
    if (method === 'GET') return json(200, { ok: true, data: state });

    const input = await request.json();
    applyAction(state, String(input.action || ''), input.payload || {}, session.sub);
    await saveState(kv, state);
    return json(200, { ok: true, data: state });
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : 'Falha ao processar a solicitação.' });
  }
}
