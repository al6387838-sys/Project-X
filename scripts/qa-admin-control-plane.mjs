import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { onRequest } from '../functions/api/admin-data.js';

class MemoryKV {
  constructor(seed = {}) {
    this.store = new Map(Object.entries(seed));
  }
  async get(key) { return this.store.has(key) ? this.store.get(key) : null; }
  async put(key, value) { this.store.set(key, String(value)); }
  async delete(key) { this.store.delete(key); }
  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    const keys = [...this.store.keys()].filter((key) => key.startsWith(prefix)).sort();
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    const values = keys.slice(offset, offset + limit).map((name) => ({ name }));
    const next = offset + values.length;
    return { keys: values, list_complete: next >= keys.length, cursor: next >= keys.length ? undefined : String(next) };
  }
}

const secret = 'lifeos-qa-admin-secret';
const adminEmail = 'admin@lifeos.test';
const env = {
  LIFEOS_SESSION_SECRET: secret,
  LIFEOS_KV: new MemoryKV({
    [`user:${adminEmail}`]: JSON.stringify({ email: adminEmail, name: 'Admin QA', role: 'admin', plan: 'enterprise', status: 'active', emailVerified: true, createdAt: '2026-01-01T00:00:00.000Z' }),
    'user:alice@lifeos.test': JSON.stringify({ email: 'alice@lifeos.test', name: 'Alice QA', role: 'user', plan: 'starter', status: 'active', emailVerified: true, createdAt: '2026-01-02T00:00:00.000Z' }),
    'system:logs': JSON.stringify([{ id: 'log_1', level: 'info', message: 'Inicialização de QA', service: 'qa', at: '2026-01-03T00:00:00.000Z' }]),
  }),
};

function token(role = 'admin', subject = adminEmail) {
  const payload = Buffer.from(JSON.stringify({ sub: subject, role, jti: `qa-${role}-${Date.now()}-${Math.random()}`, iat: Date.now(), exp: Date.now() + 3_600_000 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

async function call(method, path = '/api/admin-data', body, role = 'admin') {
  const headers = { cookie: `lifeos_session=${token(role)}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const request = new Request(`https://lifeos.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const response = await onRequest({ request, env });
  return { status: response.status, body: await response.json() };
}

const results = [];
async function check(name, action) {
  try {
    await action();
    results.push({ name, ok: true });
    console.log(`PASS — ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.error(`FAIL — ${name}: ${error.message}`);
  }
}

await check('Rejeita acesso administrativo sem papel admin', async () => {
  const response = await call('GET', '/api/admin-data?resource=dashboard', undefined, 'user');
  assert.equal(response.status, 403);
  assert.equal(response.body.ok, false);
});

await check('Carrega dashboard exclusivamente a partir de registros persistidos', async () => {
  const response = await call('GET', '/api/admin-data?resource=dashboard');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.metrics.totalUsers, 2);
  assert.equal(response.body.data.metrics.totalOrganizations, 0);
});

let inviteRollback;
await check('Cria convite como conta real e registra rollback', async () => {
  const response = await call('POST', '/api/admin-data', { action: 'user.invite', name: 'Convidada QA', email: 'invite@lifeos.test', role: 'manager', plan: 'business' });
  assert.equal(response.status, 200);
  assert.equal(response.body.result.user.status, 'invited');
  assert.equal(JSON.parse(await env.LIFEOS_KV.get('user:invite@lifeos.test')).role, 'manager');
  inviteRollback = response.body.result.rollback.token;
});

await check('Executa rollback de convite administrativo', async () => {
  const response = await call('POST', '/api/admin-data', { action: 'rollback', token: inviteRollback });
  assert.equal(response.status, 200);
  assert.equal(await env.LIFEOS_KV.get('user:invite@lifeos.test'), null);
});

let organizationId;
await check('Cria organização, owner e workspace principal', async () => {
  const response = await call('POST', '/api/admin-data', { action: 'organization.create', name: 'Organização QA', description: 'Tenant de validação', ownerId: 'owner@lifeos.test', ownerName: 'Owner QA', plan: 'enterprise' });
  assert.equal(response.status, 200);
  organizationId = response.body.result.organization.id;
  const organization = JSON.parse(await env.LIFEOS_KV.get(`org:${organizationId}`));
  assert.equal(organization.status, 'active');
  assert.equal(organization.workspaces.length, 1);
  assert.ok(await env.LIFEOS_KV.get('user:orgs:owner@lifeos.test'));
});

let organizationUpdateRollback;
await check('Atualiza e suspende organização com rollback', async () => {
  const response = await call('POST', '/api/admin-data', { action: 'organization.update', id: organizationId, status: 'suspended', description: 'Tenant suspenso para QA' });
  assert.equal(response.status, 200);
  assert.equal(response.body.result.organization.status, 'suspended');
  organizationUpdateRollback = response.body.result.rollback.token;
});

await check('Restaura organização pelo rollback', async () => {
  const response = await call('POST', '/api/admin-data', { action: 'rollback', token: organizationUpdateRollback });
  assert.equal(response.status, 200);
  const organization = JSON.parse(await env.LIFEOS_KV.get(`org:${organizationId}`));
  assert.equal(organization.status, 'active');
});

let workspaceId;
await check('Cria workspace auditável em organização existente', async () => {
  const response = await call('POST', '/api/admin-data', { action: 'workspace.create', organizationId, name: 'Produto QA', type: 'project' });
  assert.equal(response.status, 200);
  workspaceId = response.body.result.workspace.id;
  assert.equal(response.body.result.workspace.organizationId, organizationId);
});

let planId;
await check('Cria plano persistido e reversível', async () => {
  const response = await call('POST', '/api/admin-data', { action: 'plan.create', name: 'Plano QA', amountCents: 12900, interval: 'month', features: ['Audit', 'RBAC'] });
  assert.equal(response.status, 200);
  planId = response.body.result.plan.id;
  assert.equal(JSON.parse(await env.LIFEOS_KV.get('billing:plans')).length, 1);
});

let subscriptionId;
await check('Cria e atualiza assinatura persistida', async () => {
  const created = await call('POST', '/api/admin-data', { action: 'subscription.create', organizationId, planId, status: 'active', seats: 12, provider: 'manual' });
  assert.equal(created.status, 200);
  subscriptionId = created.body.result.subscription.id;
  const updated = await call('POST', '/api/admin-data', { action: 'subscription.update', id: subscriptionId, organizationId, planId, status: 'paused', seats: 18, provider: 'manual' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.result.subscription.seats, 18);
});

await check('Cria, alterna e remove feature flag com auditoria', async () => {
  const created = await call('POST', '/api/admin-data', { action: 'flag.upsert', key: 'qa_feature', enabled: true, description: 'Flag de QA' });
  assert.equal(created.status, 200);
  const toggled = await call('POST', '/api/admin-data', { action: 'flag.upsert', key: 'qa_feature', enabled: false });
  assert.equal(toggled.status, 200);
  const removed = await call('POST', '/api/admin-data', { action: 'flag.delete', key: 'qa_feature' });
  assert.equal(removed.status, 200);
});

await check('Persiste configurações e limpa logs com rollback', async () => {
  const settings = await call('POST', '/api/admin-data', { action: 'system.settings.update', settings: { allowRegistrations: false, maintenanceMessage: 'QA' } });
  assert.equal(settings.status, 200);
  const clear = await call('POST', '/api/admin-data', { action: 'logs.clear' });
  assert.equal(clear.status, 200);
  assert.deepEqual(JSON.parse(await env.LIFEOS_KV.get('system:logs')), []);
  const restored = await call('POST', '/api/admin-data', { action: 'rollback', token: clear.body.result.rollback.token });
  assert.equal(restored.status, 200);
  assert.equal(JSON.parse(await env.LIFEOS_KV.get('system:logs')).length, 1);
});

await check('Filtra e pagina usuários reais', async () => {
  const response = await call('GET', '/api/admin-data?resource=users&q=alice&page=1&pageSize=1');
  assert.equal(response.status, 200);
  assert.equal(response.body.pagination.total, 1);
  assert.equal(response.body.data[0].email, 'alice@lifeos.test');
});

await check('Registra auditoria para operações administrativas', async () => {
  const response = await call('GET', '/api/admin-data?resource=audit&pageSize=100');
  assert.equal(response.status, 200);
  assert.ok(response.body.data.some((entry) => entry.action === 'organization.create'));
  assert.ok(response.body.data.some((entry) => entry.action === 'subscription.update'));
});

const failures = results.filter((item) => !item.ok);
console.log(JSON.stringify({ checks: results.length, failures: failures.length, results }, null, 2));
if (failures.length) process.exitCode = 1;
