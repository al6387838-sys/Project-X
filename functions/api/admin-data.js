// LifeOS Enterprise — Admin Control Plane v43.0
// Cloudflare Pages Function: GET/POST /api/admin-data
// Todas as leituras vêm de Cloudflare KV. Ausência de dados é representada
// explicitamente; esta API não fornece métricas, usuários ou eventos sintéticos.
import { getCookie, json, verifySession } from '../_auth.js';
import {
  addUserOrganization,
  appendOrganizationAudit,
  generateEnterpriseId,
  loadOrganization,
  normalizeOrganization,
  normalizeText,
  readJson,
  saveOrganization,
} from '../_enterprise.js';
import { revokeAllSessions } from '../_account.js';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const ROLLBACK_TTL_SECONDS = 60 * 60;
const AUDIT_LIMIT = 1000;
const ALLOWED_USER_STATUS = new Set(['active', 'suspended', 'invited', 'pending_verification', 'deleted']);
const ALLOWED_ORG_STATUS = new Set(['active', 'suspended', 'archived']);
const ALLOWED_SUBSCRIPTION_STATUS = new Set(['active', 'trialing', 'past_due', 'cancelled', 'paused', 'not_configured']);

function now() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parsePage(value) {
  const parsed = Number.parseInt(value || '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value) {
  const parsed = Number.parseInt(value || String(DEFAULT_PAGE_SIZE), 10);
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(parsed) ? parsed : DEFAULT_PAGE_SIZE));
}

function safeComparable(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value).toLowerCase();
  return String(value).toLowerCase();
}

function paginate(items, url, searchableFields = []) {
  const page = parsePage(url.searchParams.get('page'));
  const pageSize = parsePageSize(url.searchParams.get('pageSize'));
  const query = normalizeText(url.searchParams.get('q') || url.searchParams.get('search') || '', 160).toLowerCase();
  const status = normalizeText(url.searchParams.get('status') || '', 80).toLowerCase();
  const plan = normalizeText(url.searchParams.get('plan') || '', 80).toLowerCase();
  const sort = normalizeText(url.searchParams.get('sort') || '', 80);
  const direction = url.searchParams.get('direction') === 'asc' ? 1 : -1;

  let filtered = asArray(items).filter((item) => {
    if (query) {
      const haystack = searchableFields.length
        ? searchableFields.map((field) => safeComparable(item?.[field])).join(' ')
        : safeComparable(item);
      if (!haystack.includes(query)) return false;
    }
    if (status && safeComparable(item?.status) !== status) return false;
    if (plan && safeComparable(item?.plan) !== plan) return false;
    return true;
  });

  if (sort) {
    filtered = [...filtered].sort((left, right) => safeComparable(left?.[sort]).localeCompare(safeComparable(right?.[sort])) * direction);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    pagination: { page: currentPage, pageSize, total, totalPages, hasNext: currentPage < totalPages, hasPrevious: currentPage > 1 },
    filters: { query, status, plan, sort, direction: direction === 1 ? 'asc' : 'desc' },
  };
}

async function authenticateAdmin(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) {
    const error = new Error('Autenticação administrativa não configurada.');
    error.status = 503;
    throw error;
  }
  if (!env.LIFEOS_KV) {
    const error = new Error('Cloudflare KV indisponível.');
    error.status = 503;
    throw error;
  }
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret, env.LIFEOS_KV);
  if (!session) {
    const error = new Error('Sessão administrativa necessária.');
    error.status = 401;
    throw error;
  }
  if (session.role !== 'admin') {
    const error = new Error('Acesso administrativo negado.');
    error.status = 403;
    throw error;
  }
  return { session, kv: env.LIFEOS_KV };
}

async function listKeys(kv, prefix, max = 2500) {
  const names = [];
  let cursor;
  do {
    const page = await kv.list({ prefix, cursor, limit: 1000 });
    for (const key of asArray(page.keys)) {
      names.push(key.name);
      if (names.length >= max) return names;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return names;
}

async function readRecords(kv, keys) {
  const records = await Promise.all(asArray(keys).map(async (key) => {
    const raw = await kv.get(key);
    if (!raw) return null;
    try { return { key, raw, value: JSON.parse(raw) }; } catch { return { key, raw, value: raw }; }
  }));
  return records.filter(Boolean);
}

async function appendGlobalAudit(kv, entry) {
  const audit = asArray(await readJson(kv, 'audit:global', []));
  const record = {
    id: generateEnterpriseId('audit'),
    actor: normalizeText(entry?.actor, 254) || 'system',
    action: normalizeText(entry?.action, 120) || 'admin.operation',
    target: normalizeText(entry?.target, 254),
    detail: normalizeText(entry?.detail, 700),
    metadata: objectOrEmpty(entry?.metadata),
    at: now(),
  };
  await kv.put('audit:global', JSON.stringify([record, ...audit].slice(0, AUDIT_LIMIT)));
  return record;
}

async function createRollback(kv, actor, action, snapshots) {
  const token = generateEnterpriseId('rollback');
  const record = {
    token,
    actor,
    action,
    createdAt: now(),
    snapshots: asArray(snapshots).map((snapshot) => ({
      key: snapshot.key,
      raw: snapshot.raw === undefined ? null : snapshot.raw,
    })).filter((snapshot) => snapshot.key),
  };
  await kv.put(`admin:rollback:${token}`, JSON.stringify(record), { expirationTtl: ROLLBACK_TTL_SECONDS });
  return { token, expiresInSeconds: ROLLBACK_TTL_SECONDS, label: 'Desfazer alteração' };
}

async function executeRollback(kv, session, token) {
  const key = `admin:rollback:${normalizeText(token, 120)}`;
  const rollback = await readJson(kv, key, null);
  if (!rollback || !Array.isArray(rollback.snapshots)) throw new Error('Rollback indisponível ou expirado.');
  for (const snapshot of rollback.snapshots) {
    if (snapshot.raw === null) await kv.delete(snapshot.key);
    else await kv.put(snapshot.key, snapshot.raw);
  }
  await kv.delete(key);
  await appendGlobalAudit(kv, {
    actor: session.sub,
    action: 'admin.rollback',
    target: rollback.action,
    detail: `Rollback concluído para ${rollback.action}.`,
    metadata: { rollbackToken: rollback.token },
  });
  return { restored: rollback.snapshots.length, action: rollback.action };
}

function publicUser(value, key) {
  const user = objectOrEmpty(value);
  const email = normalizeText(user.email || key.replace(/^user:/, ''), 254).toLowerCase();
  return {
    id: email,
    email,
    name: normalizeText(user.name, 120) || email || 'Usuário sem identificação',
    role: normalizeText(user.role, 40) || 'user',
    plan: normalizeText(user.plan, 40) || 'unassigned',
    status: normalizeText(user.status, 40) || 'active',
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    lastLoginAt: user.lastLoginAt || null,
    timezone: normalizeText(user.timezone, 80) || null,
  };
}

async function getUsers(kv) {
  const keys = (await listKeys(kv, 'user:')).filter((key) => !key.slice('user:'.length).includes(':'));
  const records = await readRecords(kv, keys);
  return records.map((record) => ({ ...publicUser(record.value, record.key), _key: record.key, _raw: record.raw }));
}

function publicOrganization(organization) {
  return {
    id: organization.id,
    name: organization.name,
    description: organization.description,
    plan: organization.plan || 'Unassigned',
    status: organization.status || 'active',
    ownerId: organization.ownerId,
    memberCount: asArray(organization.members).length,
    activeMemberCount: asArray(organization.members).filter((member) => member.status === 'active').length,
    workspaceCount: asArray(organization.workspaces).length,
    createdAt: organization.createdAt || null,
    updatedAt: organization.updatedAt || null,
  };
}

async function getOrganizations(kv) {
  const keys = (await listKeys(kv, 'org:')).filter((key) => !key.slice('org:'.length).includes(':'));
  const records = await readRecords(kv, keys);
  return records.map((record) => {
    const organization = normalizeOrganization(record.value);
    return organization ? { ...publicOrganization(organization), _key: record.key, _raw: record.raw, _organization: organization } : null;
  }).filter(Boolean);
}

function publicWorkspace(organization, workspace) {
  return {
    id: workspace.id,
    organizationId: organization.id,
    organizationName: organization.name,
    name: workspace.name,
    description: workspace.description,
    type: workspace.type || 'general',
    status: workspace.status || 'active',
    memberCount: asArray(workspace.members).length,
    protected: Boolean(workspace.protected),
    createdAt: workspace.createdAt || null,
    updatedAt: workspace.updatedAt || null,
  };
}

async function getWorkspaces(kv, organizations = null) {
  const source = organizations || await getOrganizations(kv);
  return source.flatMap((item) => asArray(item._organization?.workspaces).map((workspace) => publicWorkspace(item._organization, workspace)));
}

function normalizePlan(input, existing = null) {
  const name = normalizeText(input.name ?? existing?.name, 120);
  if (!name) throw new Error('Nome do plano é obrigatório.');
  const amountCents = numberOrNull(input.amountCents ?? input.amount ?? existing?.amountCents);
  if (amountCents !== null && (amountCents < 0 || amountCents > 1000000000)) throw new Error('Valor do plano inválido.');
  const interval = normalizeText(input.interval ?? existing?.interval, 20) || 'month';
  if (!['month', 'year', 'one_time'].includes(interval)) throw new Error('Periodicidade inválida.');
  const features = input.features !== undefined
    ? asArray(input.features).map((feature) => normalizeText(String(feature), 120)).filter(Boolean).slice(0, 50)
    : asArray(existing?.features);
  const timestamp = now();
  return {
    id: existing?.id || generateEnterpriseId('plan'),
    name,
    description: normalizeText(input.description ?? existing?.description, 600),
    amountCents,
    currency: normalizeText(input.currency ?? existing?.currency, 8).toUpperCase() || 'BRL',
    interval,
    active: input.active === undefined ? (existing?.active !== false) : Boolean(input.active),
    features,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function normalizeSubscription(input, existing = null) {
  const organizationId = normalizeText(input.organizationId ?? existing?.organizationId, 80);
  if (!organizationId) throw new Error('Organização da assinatura é obrigatória.');
  const planId = normalizeText(input.planId ?? existing?.planId, 80);
  const status = normalizeText(input.status ?? existing?.status, 40) || 'not_configured';
  if (!ALLOWED_SUBSCRIPTION_STATUS.has(status)) throw new Error('Status de assinatura inválido.');
  const seats = numberOrNull(input.seats ?? existing?.seats);
  if (seats !== null && (seats < 1 || seats > 100000)) throw new Error('Número de assentos inválido.');
  const timestamp = now();
  return {
    id: existing?.id || generateEnterpriseId('sub'),
    organizationId,
    planId,
    status,
    seats,
    provider: normalizeText(input.provider ?? existing?.provider, 60) || 'manual',
    externalReference: normalizeText(input.externalReference ?? existing?.externalReference, 160),
    currentPeriodEnd: normalizeText(input.currentPeriodEnd ?? existing?.currentPeriodEnd, 80) || null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd === undefined ? Boolean(existing?.cancelAtPeriodEnd) : Boolean(input.cancelAtPeriodEnd),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

async function getBilling(kv) {
  const [plans, subscriptions, stats] = await Promise.all([
    readJson(kv, 'billing:plans', []),
    readJson(kv, 'billing:subscriptions', []),
    readJson(kv, 'billing:stats', null),
  ]);
  return {
    plans: asArray(plans),
    subscriptions: asArray(subscriptions),
    stats: stats && typeof stats === 'object' ? stats : null,
  };
}

async function getCrmSummary(kv, organizations) {
  const summary = [];
  for (const item of organizations.slice(0, 300)) {
    for (const workspace of asArray(item._organization?.workspaces).slice(0, 100)) {
      const prefix = `${item.id}:${workspace.id}`;
      const [contacts, deals, agenda] = await Promise.all([
        readJson(kv, `crm:contacts:${prefix}`, []),
        readJson(kv, `crm:deals:${prefix}`, []),
        readJson(kv, `crm:agenda:${prefix}`, []),
      ]);
      const contactRecords = asArray(contacts);
      const dealRecords = asArray(deals);
      const agendaRecords = asArray(agenda);
      summary.push({
        organizationId: item.id,
        organizationName: item.name,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        contacts: contactRecords.length,
        deals: dealRecords.length,
        openDeals: dealRecords.filter((deal) => !['won', 'lost'].includes(deal.status || deal.stage)).length,
        pipelineValue: dealRecords.reduce((total, deal) => total + (numberOrNull(deal.value) || 0), 0),
        agendaItems: agendaRecords.length,
        updatedAt: workspace.updatedAt || item.updatedAt || null,
      });
    }
  }
  return summary;
}

async function getAuditEntries(kv, organizations = null) {
  const [global, admin] = await Promise.all([
    readJson(kv, 'audit:global', []),
    readJson(kv, 'admin:audit_log', []),
  ]);
  const rows = [
    ...asArray(global).map((entry) => ({ ...entry, source: 'global' })),
    ...asArray(admin).map((entry) => ({
      id: entry.id || generateEnterpriseId('audit_legacy'),
      actor: entry.by || entry.actor || 'admin',
      action: entry.action || 'admin.operation',
      target: entry.target || '',
      detail: entry.detail || '',
      at: entry.at || entry.createdAt || null,
      source: 'legacy',
    })),
  ];
  const source = organizations || await getOrganizations(kv);
  for (const item of source.slice(0, 300)) {
    const audit = await readJson(kv, `org:audit:${item.id}`, []);
    rows.push(...asArray(audit).map((entry) => ({
      id: entry.id,
      actor: entry.actor || 'system',
      action: entry.action || 'organization.operation',
      target: entry.resourceId || item.id,
      detail: entry.detail || '',
      at: entry.createdAt || null,
      organizationId: item.id,
      organizationName: item.name,
      source: 'organization',
    })));
  }
  return rows.sort((left, right) => String(right.at || '').localeCompare(String(left.at || ''))).slice(0, AUDIT_LIMIT);
}

async function getSystemLogs(kv) {
  const [systemLogs, observabilityLogs] = await Promise.all([
    readJson(kv, 'system:logs', []),
    readJson(kv, 'observability:logs', []),
  ]);
  return [...asArray(systemLogs), ...asArray(observabilityLogs)].map((entry, index) => ({
    id: entry.id || `log_${index}`,
    level: normalizeText(entry.level, 20).toLowerCase() || 'info',
    message: normalizeText(entry.message || entry.detail || entry.action, 700),
    service: normalizeText(entry.service || entry.source, 100) || 'lifeos',
    at: entry.at || entry.createdAt || entry.timestamp || null,
    metadata: objectOrEmpty(entry.metadata),
  })).sort((left, right) => String(right.at || '').localeCompare(String(left.at || ''))).slice(0, AUDIT_LIMIT);
}

async function getSecurityEvents(kv, users = null) {
  const direct = await readJson(kv, 'security:events', []);
  const source = users || await getUsers(kv);
  const eventLists = await Promise.all(source.slice(0, 500).map((user) => readJson(kv, `security:audit:${user.email}`, [])));
  const perUser = eventLists.flatMap((events, index) => asArray(events).map((event) => ({ ...event, userEmail: source[index]?.email || '' })));
  return [...asArray(direct), ...perUser].map((event, index) => ({
    id: event.id || `security_${index}`,
    type: normalizeText(event.type || event.action, 100) || 'security.event',
    severity: normalizeText(event.severity, 20).toLowerCase() || 'info',
    userEmail: normalizeText(event.userEmail || event.actor, 254),
    detail: normalizeText(event.detail || event.message, 700),
    at: event.createdAt || event.at || null,
    metadata: objectOrEmpty(event.metadata),
  })).sort((left, right) => String(right.at || '').localeCompare(String(left.at || ''))).slice(0, AUDIT_LIMIT);
}

async function getIntegrations(kv, env) {
  const keys = await listKeys(kv, 'integration:');
  const records = await readRecords(kv, keys);
  const connected = records.map((record) => ({
    key: record.key,
    ...objectOrEmpty(record.value),
    status: objectOrEmpty(record.value).status || 'connected',
  }));
  const declared = asArray(await readJson(kv, 'system:integrations', []));
  return {
    connected,
    declared,
    infrastructure: {
      kvBound: Boolean(env.LIFEOS_KV),
      r2Bound: Boolean(env.LIFEOS_R2 || env.LIFEOS_FILES || env.R2_BUCKET),
      environment: normalizeText(env.LIFEOS_ENV, 40) || 'not_configured',
    },
  };
}

function derivePlanCounts(users, subscriptions) {
  const counts = {};
  for (const user of users) {
    const plan = (user.plan || 'unassigned').toLowerCase();
    counts[plan] = (counts[plan] || 0) + 1;
  }
  for (const subscription of subscriptions.filter((item) => item.status === 'active' && item.planId)) {
    const key = `subscription:${subscription.planId}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function buildDashboard(kv, env) {
  const [users, organizations, billing, metricsRaw] = await Promise.all([
    getUsers(kv),
    getOrganizations(kv),
    getBilling(kv),
    readJson(kv, 'system:metrics', null),
  ]);
  const workspaces = await getWorkspaces(kv, organizations);
  const crm = await getCrmSummary(kv, organizations);
  const audit = await getAuditEntries(kv, organizations);
  const today = new Date().toISOString().slice(0, 10);
  const activeUsers = users.filter((user) => user.status === 'active').length;
  const mrrFromStats = numberOrNull(objectOrEmpty(billing.stats).mrr);
  const arrFromStats = numberOrNull(objectOrEmpty(billing.stats).arr);
  const revenueFromStats = numberOrNull(objectOrEmpty(billing.stats).totalRevenue);
  const churnFromStats = numberOrNull(objectOrEmpty(billing.stats).churnRate);
  const subscribedMrr = billing.subscriptions
    .filter((subscription) => subscription.status === 'active')
    .reduce((total, subscription) => total + (numberOrNull(subscription.amountCents) || 0), 0);
  const metrics = {
    totalUsers: users.filter((user) => user.status !== 'deleted').length,
    activeUsers,
    newUsersToday: users.filter((user) => String(user.createdAt || '').slice(0, 10) === today).length,
    totalOrganizations: organizations.filter((organization) => organization.status !== 'archived').length,
    totalWorkspaces: workspaces.filter((workspace) => workspace.status !== 'archived').length,
    crmContacts: crm.reduce((total, row) => total + row.contacts, 0),
    crmOpenDeals: crm.reduce((total, row) => total + row.openDeals, 0),
    crmPipelineValue: crm.reduce((total, row) => total + row.pipelineValue, 0),
    mrr: mrrFromStats ?? (subscribedMrr > 0 ? subscribedMrr : null),
    arr: arrFromStats ?? (subscribedMrr > 0 ? subscribedMrr * 12 : null),
    totalRevenue: revenueFromStats,
    churnRate: churnFromStats,
    plans: derivePlanCounts(users, billing.subscriptions),
    systemMetrics: objectOrEmpty(metricsRaw),
    collectedAt: now(),
  };
  const integrations = await getIntegrations(kv, env);
  return { metrics, users, organizations, workspaces, billing, crm, audit, integrations };
}

async function selectResource(resource, context, url) {
  const { kv, env } = context;
  const dashboard = await buildDashboard(kv, env);
  const resourceMap = {
    dashboard: { metrics: dashboard.metrics, recentAudit: dashboard.audit.slice(0, 10), infrastructure: dashboard.integrations.infrastructure },
    users: dashboard.users.map(({ _key, _raw, ...user }) => user),
    organizations: dashboard.organizations.map(({ _key, _raw, _organization, ...organization }) => organization),
    workspaces: dashboard.workspaces,
    plans: dashboard.billing.plans,
    subscriptions: dashboard.billing.subscriptions,
    billing: { stats: dashboard.billing.stats, subscriptions: dashboard.billing.subscriptions, plans: dashboard.billing.plans },
    crm: dashboard.crm,
    audit: dashboard.audit,
    logs: await getSystemLogs(kv),
    security: await getSecurityEvents(kv, dashboard.users),
    integrations: dashboard.integrations,
    featureFlags: asArray(await readJson(kv, 'system:feature_flags', [])),
    system: {
      metrics: dashboard.metrics.systemMetrics,
      settings: objectOrEmpty(await readJson(kv, 'system:settings', {})),
      infrastructure: dashboard.integrations.infrastructure,
      version: normalizeText(env.LIFEOS_VERSION, 40) || 'not_configured',
      environment: normalizeText(env.LIFEOS_ENV, 40) || 'not_configured',
      checkedAt: now(),
    },
  };
  const data = resourceMap[resource] ?? resourceMap.dashboard;
  const pageable = ['users', 'organizations', 'workspaces', 'plans', 'subscriptions', 'crm', 'audit', 'logs', 'security', 'featureFlags'];
  const dataItems = pageable.includes(resource) ? data : null;
  const page = dataItems ? paginate(dataItems, url, ['id', 'name', 'email', 'organizationName', 'workspaceName', 'status', 'plan', 'action', 'detail', 'message', 'type']) : null;
  return {
    resource: resourceMap[resource] ? resource : 'dashboard',
    data: page ? page.items : data,
    pagination: page?.pagination || null,
    filters: page?.filters || null,
    legacy: {
      metrics: dashboard.metrics,
      users: dashboard.users.map(({ _key, _raw, ...user }) => user).slice(0, 100),
      recentAudit: dashboard.audit.slice(0, 20),
      flags: resourceMap.featureFlags,
    },
  };
}

async function getRaw(kv, key) {
  return await kv.get(key);
}

async function updateUser(kv, session, payload) {
  const email = normalizeText(payload.email || payload.userEmail || payload.id, 254).toLowerCase();
  if (!email) throw new Error('Usuário obrigatório.');
  const key = `user:${email}`;
  const raw = await getRaw(kv, key);
  if (!raw) throw new Error('Usuário não encontrado.');
  let user;
  try { user = JSON.parse(raw); } catch { throw new Error('Registro de usuário inválido.'); }
  const before = raw;
  if (payload.name !== undefined) {
    const name = normalizeText(payload.name, 120);
    if (!name) throw new Error('Nome do usuário é obrigatório.');
    user.name = name;
  }
  if (payload.role !== undefined) user.role = normalizeText(payload.role, 40) || 'user';
  if (payload.plan !== undefined) user.plan = normalizeText(payload.plan, 40) || 'unassigned';
  if (payload.status !== undefined) {
    const status = normalizeText(payload.status, 40);
    if (!ALLOWED_USER_STATUS.has(status)) throw new Error('Status de usuário inválido.');
    user.status = status;
    if (status === 'suspended') await revokeAllSessions(kv, email);
  }
  user.updatedAt = now();
  user.updatedBy = session.sub;
  await kv.put(key, JSON.stringify(user));
  const rollback = await createRollback(kv, session.sub, 'user.update', [{ key, raw: before }]);
  await appendGlobalAudit(kv, { actor: session.sub, action: 'user.update', target: email, detail: `Usuário ${email} atualizado.`, metadata: { fields: Object.keys(payload).filter((field) => !['action', 'email', 'userEmail', 'id'].includes(field)) } });
  return { user: publicUser(user, key), rollback };
}

async function inviteUser(kv, session, payload) {
  const email = normalizeText(payload.email, 254).toLowerCase();
  const name = normalizeText(payload.name, 120);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail de convite inválido.');
  if (!name) throw new Error('Nome do convidado é obrigatório.');
  const invitationKey = `admin:invitation:${email}`;
  const userKey = `user:${email}`;
  const [previousInvitation, previousUser] = await Promise.all([getRaw(kv, invitationKey), getRaw(kv, userKey)]);
  let existingUser = null;
  if (previousUser) {
    try { existingUser = JSON.parse(previousUser); } catch { throw new Error('Registro de usuário inválido.'); }
    if (existingUser.status !== 'invited') throw new Error('Já existe uma conta para este e-mail.');
  }
  const timestamp = now();
  const role = normalizeText(payload.role, 40) || 'user';
  const plan = normalizeText(payload.plan, 40) || 'unassigned';
  const invitation = {
    id: existingUser?.invitationId || generateEnterpriseId('invite'), email, name, role, plan,
    status: 'pending', createdAt: existingUser?.createdAt || timestamp, createdBy: session.sub,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const invitedUser = {
    email, name, passwordHash: null, role, plan, status: 'invited',
    emailVerified: false, emailVerifiedAt: null, onboarded: false,
    invitationId: invitation.id, invitedAt: timestamp, invitedBy: session.sub,
    createdAt: existingUser?.createdAt || timestamp, updatedAt: timestamp,
    lifeScore: existingUser?.lifeScore || 0, timezone: existingUser?.timezone || 'America/Sao_Paulo',
  };
  await Promise.all([
    kv.put(invitationKey, JSON.stringify(invitation), { expirationTtl: 7 * 24 * 60 * 60 }),
    kv.put(userKey, JSON.stringify(invitedUser)),
  ]);
  const rollback = await createRollback(kv, session.sub, 'user.invite', [{ key: invitationKey, raw: previousInvitation }, { key: userKey, raw: previousUser }]);
  await appendGlobalAudit(kv, { actor: session.sub, action: 'user.invite', target: email, detail: `Conta convidada criada para ${email}.`, metadata: { delivery: 'external_credentials_required' } });
  return { invitation, user: publicUser(invitedUser, userKey), rollback, activation: 'Pronto para ativação.' };
}

async function deleteUser(kv, session, payload) {
  const email = normalizeText(payload.email || payload.userEmail || payload.id, 254).toLowerCase();
  const key = `user:${email}`;
  const raw = await getRaw(kv, key);
  if (!raw) throw new Error('Usuário não encontrado.');
  let user;
  try { user = JSON.parse(raw); } catch { throw new Error('Registro de usuário inválido.'); }
  user.status = 'deleted';
  user.deletedAt = now();
  user.deletedBy = session.sub;
  user.updatedAt = now();
  await kv.put(key, JSON.stringify(user));
  const rollback = await createRollback(kv, session.sub, 'user.delete', [{ key, raw }]);
  await appendGlobalAudit(kv, { actor: session.sub, action: 'user.delete', target: email, detail: `Usuário ${email} movido para exclusão lógica.` });
  return { user: publicUser(user, key), rollback };
}

async function createOrganizationAdmin(kv, session, payload) {
  const name = normalizeText(payload.name, 120);
  if (!name) throw new Error('Nome da organização é obrigatório.');
  const ownerId = normalizeText(payload.ownerId || session.sub, 254).toLowerCase();
  const ownerEmail = normalizeText(payload.ownerEmail || ownerId, 254).toLowerCase();
  const id = generateEnterpriseId('org');
  const workspaceId = generateEnterpriseId('ws');
  const timestamp = now();
  const organization = normalizeOrganization({
    id, name, description: normalizeText(payload.description, 500),
    plan: normalizeText(payload.plan, 40) || 'Unassigned', status: 'active', ownerId,
    members: [{ userId: ownerId, email: ownerEmail, name: normalizeText(payload.ownerName, 120), role: 'owner', status: 'active', joinedAt: timestamp }],
    workspaces: [{ id: workspaceId, name: 'Principal', description: 'Workspace inicial da organização.', type: 'general', status: 'active', members: [ownerId], preferences: { notifications: true, defaultView: 'overview' }, activity: [], protected: true, createdAt: timestamp, updatedAt: timestamp }],
    settings: { allowMemberInvites: true, requireApproval: false, maxMembers: 100 }, createdAt: timestamp, updatedAt: timestamp,
  });
  const key = `org:${id}`;
  const ownerIndexKey = `user:orgs:${ownerId}`;
  const ownerIndexRaw = await getRaw(kv, ownerIndexKey);
  await saveOrganization(kv, organization);
  await addUserOrganization(kv, ownerId, id);
  await appendOrganizationAudit(kv, id, { actor: session.sub, action: 'organization.create', resourceId: id, detail: `Organização "${name}" criada pelo painel administrativo.` });
  await appendGlobalAudit(kv, { actor: session.sub, action: 'organization.create', target: id, detail: `Organização "${name}" criada.` });
  const rollback = await createRollback(kv, session.sub, 'organization.create', [{ key, raw: null }, { key: ownerIndexKey, raw: ownerIndexRaw }]);
  return { organization: publicOrganization(organization), rollback };
}

async function updateOrganizationAdmin(kv, session, payload) {
  const id = normalizeText(payload.id || payload.organizationId, 80);
  const key = `org:${id}`;
  const raw = await getRaw(kv, key);
  if (!raw) throw new Error('Organização não encontrada.');
  let organization;
  try { organization = normalizeOrganization(JSON.parse(raw)); } catch { throw new Error('Registro de organização inválido.'); }
  if (payload.name !== undefined) {
    const name = normalizeText(payload.name, 120);
    if (!name) throw new Error('Nome da organização é obrigatório.');
    organization.name = name;
  }
  if (payload.description !== undefined) organization.description = normalizeText(payload.description, 500);
  if (payload.plan !== undefined) organization.plan = normalizeText(payload.plan, 40) || 'Unassigned';
  if (payload.status !== undefined) {
    const status = normalizeText(payload.status, 40);
    if (!ALLOWED_ORG_STATUS.has(status)) throw new Error('Status de organização inválido.');
    organization.status = status;
  }
  if (payload.settings && typeof payload.settings === 'object') organization.settings = { ...organization.settings, ...objectOrEmpty(payload.settings) };
  await saveOrganization(kv, organization);
  await appendOrganizationAudit(kv, organization.id, { actor: session.sub, action: 'organization.update', resourceId: organization.id, detail: `Organização "${organization.name}" atualizada.` });
  const rollback = await createRollback(kv, session.sub, 'organization.update', [{ key, raw }]);
  await appendGlobalAudit(kv, { actor: session.sub, action: 'organization.update', target: id, detail: `Organização "${organization.name}" atualizada.` });
  return { organization: publicOrganization(organization), rollback };
}

async function deleteOrganizationAdmin(kv, session, payload) {
  return updateOrganizationAdmin(kv, session, { ...payload, status: 'archived' });
}

async function createWorkspaceAdmin(kv, session, payload) {
  const organizationId = normalizeText(payload.organizationId || payload.orgId, 80);
  const key = `org:${organizationId}`;
  const raw = await getRaw(kv, key);
  if (!raw) throw new Error('Organização não encontrada.');
  const organization = normalizeOrganization(JSON.parse(raw));
  const name = normalizeText(payload.name, 120);
  if (!name) throw new Error('Nome do workspace é obrigatório.');
  if (organization.workspaces.some((workspace) => workspace.name.toLowerCase() === name.toLowerCase())) throw new Error('Já existe um workspace com este nome.');
  const timestamp = now();
  const workspace = { id: generateEnterpriseId('ws'), name, description: normalizeText(payload.description, 500), type: normalizeText(payload.type, 40) || 'general', status: 'active', members: [organization.ownerId], preferences: { notifications: true, defaultView: 'overview' }, activity: [], protected: false, createdAt: timestamp, updatedAt: timestamp };
  organization.workspaces.push(workspace);
  await saveOrganization(kv, organization);
  await appendOrganizationAudit(kv, organization.id, { actor: session.sub, action: 'workspace.create', resourceId: workspace.id, detail: `Workspace "${name}" criado pelo painel administrativo.` });
  const rollback = await createRollback(kv, session.sub, 'workspace.create', [{ key, raw }]);
  await appendGlobalAudit(kv, { actor: session.sub, action: 'workspace.create', target: workspace.id, detail: `Workspace "${name}" criado em ${organization.name}.` });
  return { workspace: publicWorkspace(organization, workspace), rollback };
}

async function updateWorkspaceAdmin(kv, session, payload) {
  const organizationId = normalizeText(payload.organizationId || payload.orgId, 80);
  const workspaceId = normalizeText(payload.id || payload.workspaceId, 80);
  const key = `org:${organizationId}`;
  const raw = await getRaw(kv, key);
  if (!raw) throw new Error('Organização não encontrada.');
  const organization = normalizeOrganization(JSON.parse(raw));
  const workspace = organization.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error('Workspace não encontrado.');
  if (payload.name !== undefined) {
    const name = normalizeText(payload.name, 120);
    if (!name) throw new Error('Nome do workspace é obrigatório.');
    workspace.name = name;
  }
  if (payload.description !== undefined) workspace.description = normalizeText(payload.description, 500);
  if (payload.type !== undefined) workspace.type = normalizeText(payload.type, 40) || 'general';
  if (payload.status !== undefined) {
    const status = normalizeText(payload.status, 40);
    if (!['active', 'archived'].includes(status)) throw new Error('Status de workspace inválido.');
    if (workspace.protected && status === 'archived') throw new Error('O workspace principal protegido não pode ser arquivado.');
    workspace.status = status;
  }
  workspace.updatedAt = now();
  await saveOrganization(kv, organization);
  await appendOrganizationAudit(kv, organization.id, { actor: session.sub, action: 'workspace.update', resourceId: workspace.id, detail: `Workspace "${workspace.name}" atualizado.` });
  const rollback = await createRollback(kv, session.sub, 'workspace.update', [{ key, raw }]);
  await appendGlobalAudit(kv, { actor: session.sub, action: 'workspace.update', target: workspace.id, detail: `Workspace "${workspace.name}" atualizado.` });
  return { workspace: publicWorkspace(organization, workspace), rollback };
}

async function savePlans(kv, session, plans, rawBefore, action, target, detail) {
  await kv.put('billing:plans', JSON.stringify(plans));
  const rollback = await createRollback(kv, session.sub, action, [{ key: 'billing:plans', raw: rawBefore }]);
  await appendGlobalAudit(kv, { actor: session.sub, action, target, detail });
  return { plans, rollback };
}

async function mutatePlan(kv, session, payload) {
  const raw = await getRaw(kv, 'billing:plans');
  const plans = asArray(raw ? JSON.parse(raw) : []);
  const action = payload.action;
  if (action === 'plan.create') {
    const plan = normalizePlan(payload);
    if (plans.some((item) => item.name.toLowerCase() === plan.name.toLowerCase())) throw new Error('Já existe um plano com este nome.');
    plans.unshift(plan);
    return { plan, ...(await savePlans(kv, session, plans, raw, action, plan.id, `Plano "${plan.name}" criado.`)) };
  }
  const id = normalizeText(payload.id || payload.planId, 80);
  const index = plans.findIndex((plan) => plan.id === id);
  if (index < 0) throw new Error('Plano não encontrado.');
  if (action === 'plan.update') {
    const plan = normalizePlan(payload, plans[index]);
    plans[index] = plan;
    return { plan, ...(await savePlans(kv, session, plans, raw, action, plan.id, `Plano "${plan.name}" atualizado.`)) };
  }
  if (action === 'plan.delete') {
    const plan = { ...plans[index], active: false, archivedAt: now(), updatedAt: now() };
    plans[index] = plan;
    return { plan, ...(await savePlans(kv, session, plans, raw, action, plan.id, `Plano "${plan.name}" arquivado.`)) };
  }
  throw new Error('Ação de plano inválida.');
}

async function mutateSubscription(kv, session, payload) {
  const raw = await getRaw(kv, 'billing:subscriptions');
  const subscriptions = asArray(raw ? JSON.parse(raw) : []);
  const action = payload.action;
  if (action === 'subscription.create') {
    const subscription = normalizeSubscription(payload);
    subscriptions.unshift(subscription);
    await kv.put('billing:subscriptions', JSON.stringify(subscriptions));
    const rollback = await createRollback(kv, session.sub, action, [{ key: 'billing:subscriptions', raw }]);
    await appendGlobalAudit(kv, { actor: session.sub, action, target: subscription.id, detail: `Assinatura criada para a organização ${subscription.organizationId}.` });
    return { subscription, rollback };
  }
  const id = normalizeText(payload.id || payload.subscriptionId, 80);
  const index = subscriptions.findIndex((subscription) => subscription.id === id);
  if (index < 0) throw new Error('Assinatura não encontrada.');
  const existing = subscriptions[index];
  const subscription = action === 'subscription.cancel'
    ? { ...existing, status: 'cancelled', cancelAtPeriodEnd: Boolean(payload.cancelAtPeriodEnd), updatedAt: now() }
    : normalizeSubscription(payload, existing);
  subscriptions[index] = subscription;
  await kv.put('billing:subscriptions', JSON.stringify(subscriptions));
  const rollback = await createRollback(kv, session.sub, action, [{ key: 'billing:subscriptions', raw }]);
  await appendGlobalAudit(kv, { actor: session.sub, action, target: subscription.id, detail: action === 'subscription.cancel' ? `Assinatura ${subscription.id} cancelada.` : `Assinatura ${subscription.id} atualizada.` });
  return { subscription, rollback };
}

async function mutateFlag(kv, session, payload) {
  const raw = await getRaw(kv, 'system:feature_flags');
  const flags = asArray(raw ? JSON.parse(raw) : []);
  const key = normalizeText(payload.key || payload.id, 120);
  if (!key) throw new Error('Chave da feature flag é obrigatória.');
  const index = flags.findIndex((flag) => flag.key === key || flag.id === key);
  if (payload.action === 'flag.delete') {
    if (index < 0) throw new Error('Feature flag não encontrada.');
    flags.splice(index, 1);
  } else {
    const flag = { key, enabled: Boolean(payload.enabled), description: normalizeText(payload.description, 300), updatedAt: now(), updatedBy: session.sub };
    if (index >= 0) flags[index] = { ...flags[index], ...flag };
    else flags.unshift(flag);
  }
  await kv.put('system:feature_flags', JSON.stringify(flags));
  const rollback = await createRollback(kv, session.sub, payload.action, [{ key: 'system:feature_flags', raw }]);
  await appendGlobalAudit(kv, { actor: session.sub, action: payload.action, target: key, detail: payload.action === 'flag.delete' ? `Feature flag ${key} removida.` : `Feature flag ${key} atualizada.` });
  return { flags, rollback };
}

async function mutateSystem(kv, session, payload) {
  if (payload.action === 'system.settings.update') {
    const raw = await getRaw(kv, 'system:settings');
    const settings = { ...objectOrEmpty(raw ? JSON.parse(raw) : {}), ...objectOrEmpty(payload.settings), updatedAt: now(), updatedBy: session.sub };
    await kv.put('system:settings', JSON.stringify(settings));
    const rollback = await createRollback(kv, session.sub, payload.action, [{ key: 'system:settings', raw }]);
    await appendGlobalAudit(kv, { actor: session.sub, action: payload.action, target: 'system:settings', detail: 'Configurações do sistema atualizadas.' });
    return { settings, rollback };
  }
  if (payload.action === 'system.cache.clear') {
    const keys = await listKeys(kv, 'cache:', 1000);
    await Promise.all(keys.map((key) => kv.delete(key)));
    await appendGlobalAudit(kv, { actor: session.sub, action: payload.action, target: 'cache', detail: `${keys.length} entrada(s) de cache removida(s).` });
    return { cleared: keys.length };
  }
  if (payload.action === 'logs.clear') {
    const raw = await getRaw(kv, 'system:logs');
    await kv.put('system:logs', JSON.stringify([]));
    const rollback = await createRollback(kv, session.sub, payload.action, [{ key: 'system:logs', raw }]);
    await appendGlobalAudit(kv, { actor: session.sub, action: payload.action, target: 'system:logs', detail: 'Logs de sistema limpos.' });
    return { rollback };
  }
  throw new Error('Ação de sistema inválida.');
}

async function disconnectIntegration(kv, session, payload) {
  const key = normalizeText(payload.key, 400);
  if (!key.startsWith('integration:')) throw new Error('Integração inválida.');
  const raw = await getRaw(kv, key);
  if (!raw) throw new Error('Integração não encontrada.');
  await kv.delete(key);
  const rollback = await createRollback(kv, session.sub, 'integration.disconnect', [{ key, raw }]);
  await appendGlobalAudit(kv, { actor: session.sub, action: 'integration.disconnect', target: key, detail: 'Integração desconectada no painel administrativo.' });
  return { rollback };
}

async function revokeUserSessions(kv, session, payload) {
  const email = normalizeText(payload.email || payload.userEmail || payload.id, 254).toLowerCase();
  if (!email) throw new Error('Usuário obrigatório.');
  await revokeAllSessions(kv, email);
  await appendGlobalAudit(kv, { actor: session.sub, action: 'security.revokeSessions', target: email, detail: `Sessões revogadas para ${email}.` });
  return { revoked: true };
}

async function executeAction(kv, session, payload) {
  const action = normalizeText(payload.action, 120);
  if (!action) throw new Error('Ação administrativa obrigatória.');
  if (action === 'rollback') return executeRollback(kv, session, payload.token);
  if (action === 'user.invite') return inviteUser(kv, session, payload);
  if (action === 'user.update' || action === 'user_status') return updateUser(kv, session, { ...payload, action: 'user.update', status: payload.status });
  if (action === 'user.delete') return deleteUser(kv, session, payload);
  if (action === 'organization.create' || action === 'create_tenant') return createOrganizationAdmin(kv, session, payload);
  if (action === 'organization.update' || action === 'tenant_status') return updateOrganizationAdmin(kv, session, { ...payload, id: payload.id || payload.organizationId || payload.tenantName, status: payload.status });
  if (action === 'organization.delete') return deleteOrganizationAdmin(kv, session, payload);
  if (action === 'workspace.create') return createWorkspaceAdmin(kv, session, payload);
  if (action === 'workspace.update' || action === 'workspace.delete') return updateWorkspaceAdmin(kv, session, { ...payload, status: action === 'workspace.delete' ? 'archived' : payload.status });
  if (action.startsWith('plan.')) return mutatePlan(kv, session, payload);
  if (action.startsWith('subscription.')) return mutateSubscription(kv, session, payload);
  if (action === 'flag.upsert' || action === 'flag.delete' || action === 'create_flag') return mutateFlag(kv, session, { ...payload, action: action === 'create_flag' ? 'flag.upsert' : action });
  if (['system.settings.update', 'system.cache.clear', 'logs.clear'].includes(action)) return mutateSystem(kv, session, payload);
  if (action === 'integration.disconnect') return disconnectIntegration(kv, session, payload);
  if (action === 'security.revokeSessions') return revokeUserSessions(kv, session, payload);
  throw new Error('Ação administrativa não suportada.');
}

export async function onRequestGet({ request, env }) {
  try {
    const { session, kv } = await authenticateAdmin(request, env);
    const url = new URL(request.url);
    const resource = normalizeText(url.searchParams.get('resource') || 'dashboard', 80);
    const selected = await selectResource(resource, { kv, env }, url);
    return json(200, { ok: true, admin: session.sub, ...selected, ...selected.legacy });
  } catch (error) {
    return json(error.status || 500, { ok: false, error: error.message || 'Falha ao carregar dados administrativos.' });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const { session, kv } = await authenticateAdmin(request, env);
    let payload;
    try { payload = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido.' }); }
    const result = await executeAction(kv, session, objectOrEmpty(payload));
    return json(200, { ok: true, result });
  } catch (error) {
    return json(error.status || 400, { ok: false, error: error.message || 'Falha ao executar ação administrativa.' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido.' }, { allow: 'GET, POST, OPTIONS' });
}
