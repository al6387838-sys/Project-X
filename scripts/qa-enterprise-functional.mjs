import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.QA_BASE_URL || 'http://localhost:8788';
const outputDir = path.resolve('qa-artifacts');
const report = { baseURL, generatedAt: new Date().toISOString(), checks: [], failures: [] };
const unique = Date.now().toString(36);
const views = ['command', 'analytics', 'intelligence', 'organization', 'members', 'roles', 'workspaces', 'billing', 'compliance', 'integrations', 'security', 'notifications', 'profile', 'settings'];

function findPreviewEnvironment() {
  if (process.env.LIFEOS_SESSION_SECRET && process.env.LIFEOS_ADMIN_USER) return process.env;
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const env = Object.fromEntries(readFileSync(`/proc/${entry}/environ`).toString('utf8').split('\0').filter(Boolean).map((item) => {
        const separator = item.indexOf('=');
        return [item.slice(0, separator), item.slice(separator + 1)];
      }));
      if (env.LIFEOS_SESSION_SECRET && env.LIFEOS_ADMIN_USER) return env;
    } catch {
      // Processos podem finalizar durante a leitura.
    }
  }
  const config = readFileSync(path.resolve('wrangler.toml'), 'utf8');
  const values = Object.fromEntries([...config.matchAll(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/gm)].map((match) => [match[1], match[2]]));
  if (values.LIFEOS_SESSION_SECRET && values.LIFEOS_ADMIN_USER) return values;
  throw new Error('Bindings do ambiente local Cloudflare não encontrados.');
}

function createSession(username, secret) {
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    role: 'admin',
    jti: `qa-functional-${Date.now()}`,
    iat: Date.now(),
    exp: Date.now() + 60 * 60 * 1000,
  }), 'utf8').toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

function record(name, passed, detail = '') {
  report.checks.push({ name, passed, detail });
  if (!passed) report.failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

async function expect(name, operation) {
  try {
    const detail = await operation();
    record(name, true, typeof detail === 'string' ? detail : '');
    return detail;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

await mkdir(outputDir, { recursive: true });
const env = findPreviewEnvironment();
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });

const anonymous = await browser.newContext();
const anonymousResponse = await anonymous.request.get(`${baseURL}/api/enterprise-data`);
record('Sessão anônima é bloqueada', anonymousResponse.status() === 401, `status ${anonymousResponse.status()}`);
await anonymous.close();

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', colorScheme: 'dark', acceptDownloads: true });
await context.addCookies([{
  name: 'lifeos_session',
  value: createSession(env.LIFEOS_ADMIN_USER, env.LIFEOS_SESSION_SECRET),
  url: baseURL,
  httpOnly: true,
  sameSite: 'Strict',
}]);

const page = await context.newPage();
const runtimeErrors = [];
const failedResponses = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

async function api(action = '', payload = {}) {
  return page.evaluate(async ({ actionName, actionPayload }) => {
    const options = actionName
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: actionName, payload: actionPayload }) }
      : { method: 'GET', credentials: 'same-origin' };
    const response = await fetch('/api/enterprise-data', options);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body.data;
  }, { actionName: action, actionPayload: payload });
}

let organizationId = '';
let workspaceId = '';
let invitedEmail = '';

try {
  await page.goto(`${baseURL}/enterprise#command`, { waitUntil: 'networkidle' });
  await page.locator('#view-command.active').waitFor({ state: 'visible' });

  let state = await api();
  await expect('Primeiro acesso oferece criação real de organização', async () => {
    if (state.organization?.id) return `organização existente ${state.organization.id}`;
    await page.locator('[data-view="organization"]').first().click();
    await page.locator('[data-action="organization.create"]').click();
    await page.locator('#organization-name').fill(`Organização QA ${unique}`);
    await page.locator('#organization-description').fill('Organização temporária da validação local Cloudflare KV.');
    const [response] = await Promise.all([
      page.waitForResponse((item) => item.url().endsWith('/api/enterprise-data') && item.request().method() === 'POST'),
      page.locator('#modal-organization-create').click(),
    ]);
    if (!response.ok()) throw new Error(`Criação retornou HTTP ${response.status()}.`);
    await page.locator('#modal-backdrop').waitFor({ state: 'hidden' });
    await page.locator('#organization-content', { hasText: `Organização QA ${unique}` }).waitFor({ state: 'visible' });
    state = await api();
    if (!state.organization?.id) throw new Error('Organização não persistiu no KV.');
    return state.organization.id;
  });

  state = await api();
  organizationId = state.organization?.id || '';
  await expect('Organização e workspace protegido estão persistidos', async () => {
    if (!organizationId) throw new Error('Organização não disponível.');
    const protectedWorkspace = state.workspaces.find((workspace) => workspace.protected);
    if (!protectedWorkspace) throw new Error('Workspace Principal protegido não encontrado.');
    if (!state.members.some((member) => member.email === env.LIFEOS_ADMIN_USER && member.roleId === 'owner')) throw new Error('Owner não persistido.');
    return `${organizationId} · ${protectedWorkspace.id}`;
  });

  await expect('RBAC expõe exclusivamente os cinco cargos Enterprise', async () => {
    const expected = ['owner', 'admin', 'manager', 'employee', 'guest'].sort();
    const actual = state.roles.map((role) => role.id).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Cargos inesperados: ${actual.join(', ')}`);
    if (!state.permissions.includes('*')) throw new Error('Permissões efetivas do Owner não foram carregadas.');
    return expected.join(', ');
  });

  await expect('Navegação Enterprise cobre todos os módulos', async () => {
    for (const view of views) {
      await page.locator(`[data-view="${view}"]`).first().click();
      await page.locator(`#view-${view}.active`).waitFor({ state: 'visible' });
      if (new URL(page.url()).hash !== `#${view}`) throw new Error(`Hash incorreto para ${view}.`);
    }
    return `${views.length} módulos`;
  });

  await expect('Convite de membro persiste com cargo Enterprise', async () => {
    invitedEmail = `qa-${unique}@lifeos.local`;
    await page.locator('[data-view="members"]').first().click();
    await page.locator('[data-action="member.invite"]').click();
    await page.locator('#inv-name').fill(`Pessoa QA ${unique}`);
    await page.locator('#inv-email').fill(invitedEmail);
    await page.locator('#inv-role').selectOption('employee');
    await page.locator('#modal-invite-submit').click();
    await page.locator('#modal-backdrop').waitFor({ state: 'hidden' });
    state = await api();
    const invite = state.invites.find((item) => item.email === invitedEmail);
    if (!invite || invite.role !== 'employee' || invite.status !== 'pending') throw new Error('Convite persistido incorretamente.');
    return invite.token;
  });

  await expect('Workspace criado pela interface mantém histórico persistido', async () => {
    const name = `Workspace QA ${unique}`;
    await page.locator('[data-view="workspaces"]').first().click();
    await page.locator('[data-action="workspace.create"]').first().click();
    await page.locator('#ws-name').fill(name);
    await page.locator('#ws-desc').fill('Workspace de validação local.');
    await page.locator('#modal-ws-submit').click();
    await page.locator('#modal-backdrop').waitFor({ state: 'hidden' });
    state = await api();
    const workspace = state.workspaces.find((item) => item.name === name);
    if (!workspace || !workspace.activity?.some((item) => item.action === 'workspace.create')) throw new Error('Workspace ou histórico não persistiu.');
    workspaceId = workspace.id;
    return workspace.id;
  });

  await expect('Auditoria registra organização, convite e workspace', async () => {
    state = await api();
    const actions = new Set(state.auditLog.map((item) => item.action));
    const required = ['organization.create', 'member.invite', 'workspace.create'];
    const missing = required.filter((action) => !actions.has(action));
    if (missing.length) throw new Error(`Eventos ausentes: ${missing.join(', ')}`);
    return `${required.length} categorias auditadas`;
  });

  await expect('Exportação de auditoria gera download', async () => {
    await page.locator('[data-view="compliance"]').first().click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-btn').click(),
    ]);
    if (!download.suggestedFilename().endsWith('.csv')) throw new Error(`Arquivo inesperado: ${download.suggestedFilename()}`);
    return download.suggestedFilename();
  });
} finally {
  try {
    if (workspaceId) await api('workspace.delete', { id: workspaceId, confirmName: `Workspace QA ${unique}` });
  } catch (error) {
    record('Limpeza de workspace temporário', false, error instanceof Error ? error.message : String(error));
  }
}

record('Zero erros de JavaScript', runtimeErrors.length === 0, [...new Set(runtimeErrors)].join(' | '));
record('Zero respostas HTTP 4xx/5xx autenticadas', failedResponses.length === 0, [...new Set(failedResponses)].join(' | '));
await page.screenshot({ path: path.join(outputDir, 'functional-final.png'), fullPage: true });
await context.close();
await browser.close();
await writeFile(path.join(outputDir, 'functional-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures.length, output: path.join(outputDir, 'functional-report.json') }, null, 2));
if (report.failures.length) process.exitCode = 1;
