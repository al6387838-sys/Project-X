import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { getCookie, json, verifySession } from './_auth.js';

type Member = { id: string; name: string; email: string; roleId: string; team: string; status: 'active' | 'invited' | 'suspended'; lastActiveAt: string };
type Role = { id: string; name: string; description: string; permissions: string[]; system?: boolean };
type EnterpriseState = {
  version: number;
  organization: Record<string, unknown>;
  members: Member[];
  roles: Role[];
  teams: Array<Record<string, unknown>>;
  subscription: Record<string, unknown>;
  invoices: Array<Record<string, unknown>>;
  integrations: Array<Record<string, unknown>>;
  devices: Array<Record<string, unknown>>;
  policies: Record<string, unknown>;
  intelligence: Array<Record<string, unknown>>;
  auditLog: Array<Record<string, unknown>>;
  system: Record<string, unknown>;
};

const STORE_NAME = 'lifeos-enterprise-v21';
const STATE_KEY = 'primary-state';
let developmentState: EnterpriseState | null = null;

function isLocalDevelopment() {
  return process.env.NETLIFY_DEV === 'true' || process.env.CONTEXT === 'dev';
}

function seedState(): EnterpriseState {
  const now = new Date().toISOString();
  return {
    version: 1,
    organization: {
      id: 'org_lifeos', name: 'LifeOS Enterprise', slug: 'lifeos-enterprise', domain: 'lifeos.app',
      timezone: 'America/Sao_Paulo', locale: 'pt-BR', dataRegion: 'sa-east-1', createdAt: now,
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
      plan: 'Enterprise', status: 'active', cycle: 'annual', seats: 25, seatsUsed: 3,
      monthlyValue: 2490, renewalAt: '2027-07-01', paymentMethod: 'Visa •••• 4242',
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
      mfaRequired: true, sessionHours: 12, passwordMinLength: 12, auditRetentionDays: 365,
      dataEncryption: true, ssoEnforced: false, ipAllowlist: [], lgpdMode: true,
    },
    intelligence: [
      { id: 'ins_1', type: 'risk', title: 'Capacidade de Produto em atenção', summary: 'A demanda projetada supera a capacidade do time em 18% nas próximas duas semanas.', impact: 'high', confidence: 0.92, status: 'open', action: 'Repriorizar backlog', createdAt: now },
      { id: 'ins_2', type: 'opportunity', title: 'Automação de briefing disponível', summary: 'A consolidação automática pode economizar cerca de 6 horas por semana.', impact: 'medium', confidence: 0.87, status: 'open', action: 'Ativar automação', createdAt: now },
      { id: 'ins_3', type: 'anomaly', title: 'Aumento de engajamento', summary: 'Uso semanal cresceu 14% após a nova cadência de missões.', impact: 'positive', confidence: 0.95, status: 'open', action: 'Ver análise', createdAt: now },
    ],
    auditLog: [
      { id: randomUUID(), actor: 'system', action: 'enterprise.initialized', target: 'organization', detail: 'Ambiente Enterprise v2.1 inicializado.', createdAt: now },
    ],
    system: {
      status: 'operational', uptime: 99.99, apiP95: 142, errorRate: 0.08, activeSessions: 3,
      storageGb: 18.4, storageLimitGb: 100, region: 'sa-east-1', lastBackupAt: now,
    },
  };
}

async function loadState() {
  if (isLocalDevelopment() && developmentState) return developmentState;
  try {
    const store = getStore(STORE_NAME);
    const stored = await store.get(STATE_KEY, { type: 'json' }) as EnterpriseState | null;
    if (stored) return stored;
    const initial = seedState();
    await store.setJSON(STATE_KEY, initial);
    return initial;
  } catch (error) {
    if (!isLocalDevelopment()) throw error;
    developmentState = seedState();
    return developmentState;
  }
}

async function saveState(state: EnterpriseState) {
  state.version += 1;
  if (isLocalDevelopment()) {
    developmentState = state;
    return;
  }
  await getStore(STORE_NAME).setJSON(STATE_KEY, state);
}

function audit(state: EnterpriseState, actor: string, action: string, target: string, detail: string) {
  state.auditLog.unshift({ id: randomUUID(), actor, action, target, detail, createdAt: new Date().toISOString() });
  state.auditLog = state.auditLog.slice(0, 500);
}

function normalizeText(value: unknown, max = 160) {
  return String(value || '').trim().slice(0, max);
}

function applyAction(state: EnterpriseState, action: string, payload: Record<string, unknown>, actor: string) {
  if (action === 'organization.update') {
    state.organization = { ...state.organization, ...payload, updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'organization', 'Configurações organizacionais atualizadas.');
  } else if (action === 'member.create') {
    const email = normalizeText(payload.email, 180).toLowerCase();
    if (!email.includes('@') || state.members.some(member => member.email === email)) throw new Error('E-mail inválido ou já cadastrado.');
    const member: Member = {
      id: randomUUID(), name: normalizeText(payload.name) || email.split('@')[0], email,
      roleId: normalizeText(payload.roleId, 60) || 'member', team: normalizeText(payload.team, 80) || 'Geral',
      status: 'invited', lastActiveAt: new Date().toISOString(),
    };
    state.members.push(member);
    audit(state, actor, action, member.id, `Convite enviado para ${email}.`);
  } else if (action === 'member.update') {
    const member = state.members.find(item => item.id === payload.id);
    if (!member) throw new Error('Membro não encontrado.');
    Object.assign(member, {
      name: normalizeText(payload.name) || member.name,
      roleId: normalizeText(payload.roleId, 60) || member.roleId,
      team: normalizeText(payload.team, 80) || member.team,
      status: ['active', 'invited', 'suspended'].includes(String(payload.status)) ? payload.status : member.status,
    });
    audit(state, actor, action, member.id, `Acesso de ${member.email} atualizado.`);
  } else if (action === 'member.remove') {
    const member = state.members.find(item => item.id === payload.id);
    if (!member || member.roleId === 'owner') throw new Error('Este membro não pode ser removido.');
    state.members = state.members.filter(item => item.id !== payload.id);
    audit(state, actor, action, String(payload.id), `Membro ${member.email} removido.`);
  } else if (action === 'role.create') {
    const role: Role = { id: randomUUID(), name: normalizeText(payload.name, 80), description: normalizeText(payload.description), permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String).slice(0, 50) : [] };
    if (!role.name) throw new Error('Nome do perfil é obrigatório.');
    state.roles.push(role);
    audit(state, actor, action, role.id, `Perfil ${role.name} criado.`);
  } else if (action === 'role.update') {
    const role = state.roles.find(item => item.id === payload.id);
    if (!role || role.system) throw new Error('Perfil de sistema não pode ser alterado.');
    role.name = normalizeText(payload.name, 80) || role.name;
    role.description = normalizeText(payload.description) || role.description;
    if (Array.isArray(payload.permissions)) role.permissions = payload.permissions.map(String).slice(0, 50);
    audit(state, actor, action, role.id, `Perfil ${role.name} atualizado.`);
  } else if (action === 'role.remove') {
    const role = state.roles.find(item => item.id === payload.id);
    if (!role || role.system || state.members.some(member => member.roleId === role.id)) throw new Error('Perfil protegido ou em uso.');
    state.roles = state.roles.filter(item => item.id !== payload.id);
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
    const integration = state.integrations.find(item => item.id === payload.id);
    if (!integration) throw new Error('Integração não encontrada.');
    integration.connected = !integration.connected;
    integration.lastSyncAt = integration.connected ? new Date().toISOString() : null;
    audit(state, actor, action, String(payload.id), `${integration.name}: ${integration.connected ? 'conectada' : 'desconectada'}.`);
  } else if (action === 'device.revoke') {
    const device = state.devices.find(item => item.id === payload.id);
    if (!device || device.current) throw new Error('Dispositivo atual não pode ser revogado.');
    state.devices = state.devices.filter(item => item.id !== payload.id);
    audit(state, actor, action, String(payload.id), `Dispositivo ${device.name} revogado.`);
  } else if (action === 'policy.update') {
    state.policies = { ...state.policies, ...payload, updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'security-policy', 'Políticas de segurança atualizadas.');
  } else if (action === 'intelligence.resolve') {
    const insight = state.intelligence.find(item => item.id === payload.id);
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

export const handler: Handler = async (event) => {
  const secret = process.env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Autenticação ainda não configurada.' });
  const session = verifySession(getCookie(event.headers.cookie), secret);
  if (!session) return json(401, { ok: false, error: 'Sessão administrativa necessária.' });
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'Método não permitido.' }, { allow: 'GET, POST' });
  try {
    const state = await loadState();
    if (event.httpMethod === 'GET') return json(200, { ok: true, data: state });
    const input = JSON.parse(event.body || '{}') as { action?: string; payload?: Record<string, unknown> };
    applyAction(state, String(input.action || ''), input.payload || {}, session.sub);
    await saveState(state);
    return json(200, { ok: true, data: state });
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : 'Falha ao processar a solicitação.' });
  }
};
