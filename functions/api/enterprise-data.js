// LifeOS Enterprise — Enterprise Data API
// Cloudflare Pages Function: GET/POST /api/enterprise-data
// Persistência via Cloudflare KV

import { getCookie, json, verifySession } from '../_auth.js';

const KV_KEY = 'lifeos-enterprise-state-v21';

function seedState() {
  const now = new Date().toISOString();
  return {
    version: 1,
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
      { id: 'usr_owner', name: 'Anderson Castro', email: 'al6387838@gmail.com', roleId: 'owner', team: 'Estratégia', status: 'active', lastActiveAt: now },
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
      { id: 'ins_001', type: 'risk', severity: 'high', title: 'Dispositivos sem MFA', description: '2 membros não ativaram autenticação multifator.', status: 'open', createdAt: now },
      { id: 'ins_002', type: 'opportunity', severity: 'medium', title: 'Expansão de equipe', description: 'Capacidade disponível para 22 novos membros.', status: 'open', createdAt: now },
      { id: 'ins_003', type: 'compliance', severity: 'low', title: 'Revisão de políticas LGPD', description: 'Políticas de retenção de dados vencem em 30 dias.', status: 'open', createdAt: now },
    ],
    auditLog: [
      { id: 'aud_001', actor: 'al6387838@gmail.com', action: 'system.init', resourceId: 'system', description: 'Sistema inicializado em produção.', timestamp: now },
    ],
    system: {
      status: 'operational',
      version: '3.0.0',
      environment: 'production',
      lastCheckedAt: now,
      uptime: '99.98%',
      region: 'sa-east-1',
    },
  };
}

async function loadState(kv) {
  if (!kv) return seedState();
  try {
    const raw = await kv.get(KV_KEY);
    if (!raw) return seedState();
    return JSON.parse(raw);
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

function audit(state, actor, action, resourceId, description) {
  state.auditLog.unshift({
    id: generateId(),
    actor,
    action,
    resourceId,
    description,
    timestamp: new Date().toISOString(),
  });
  if (state.auditLog.length > 500) state.auditLog = state.auditLog.slice(0, 500);
}

function applyAction(state, action, payload, actor) {
  if (action === 'member.invite') {
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
    audit(state, actor, action, String(payload.id), `Insight ${insight.title} tratado.`);
  } else if (action === 'system.refresh') {
    state.system = { ...state.system, lastCheckedAt: new Date().toISOString() };
    audit(state, actor, action, 'system', 'Diagnóstico operacional atualizado.');
  } else {
    throw new Error('Ação não suportada.');
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
