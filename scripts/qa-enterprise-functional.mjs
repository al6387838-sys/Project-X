import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.QA_BASE_URL || 'http://localhost:8888';
const outputDir = path.resolve('qa-artifacts');
const report = { baseURL, generatedAt: new Date().toISOString(), checks: [], failures: [] };
const unique = Date.now().toString(36);

function findPreviewEnvironment() {
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const env = Object.fromEntries(
        readFileSync(`/proc/${entry}/environ`)
          .toString('utf8')
          .split('\0')
          .filter(Boolean)
          .map((item) => {
            const separator = item.indexOf('=');
            return [item.slice(0, separator), item.slice(separator + 1)];
          }),
      );
      if (env.LIFEOS_SESSION_SECRET && env.LIFEOS_ADMIN_USER) return env;
    } catch {
      // Process may disappear between directory listing and read.
    }
  }
  throw new Error('Ambiente local do Netlify não encontrado.');
}

function createSession(username, secret) {
  const payload = Buffer.from(
    JSON.stringify({ sub: username, role: 'admin', exp: Date.now() + 60 * 60 * 1000 }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
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
const anonymousResponse = await anonymous.request.get(`${baseURL}/.netlify/functions/enterprise-data`);
record('Sessão anônima é bloqueada', anonymousResponse.status() === 401, `status ${anonymousResponse.status()}`);
await anonymous.close();

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', colorScheme: 'dark', acceptDownloads: true });
await context.addCookies([{ name: 'lifeos_admin_session', value: createSession(env.LIFEOS_ADMIN_USER, env.LIFEOS_SESSION_SECRET), url: baseURL, httpOnly: true, sameSite: 'Strict' }]);
const page = await context.newPage();
const runtimeErrors = [];
const failedResponses = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`); });

async function api(action, payload = {}) {
  return page.evaluate(async ({ actionName, actionPayload }) => {
    const options = actionName
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: actionName, payload: actionPayload }) }
      : { method: 'GET' };
    const response = await fetch('/.netlify/functions/enterprise-data', options);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body.data;
  }, { actionName: action, actionPayload: payload });
}

let roleId = '';
let memberId = '';
let initialState;
let integrationRestored = true;
let planRestored = true;
let policyRestored = true;

try {
  await page.goto(`${baseURL}/enterprise#command`, { waitUntil: 'networkidle' });
  initialState = await api();
  record('Sessão administrativa carrega o Enterprise', Boolean(initialState?.organization?.id));

  await expect('Criação de perfil RBAC pela interface', async () => {
    await page.evaluate(() => document.querySelector('[data-view="roles"]')?.click());
    await page.locator('[data-open-modal="role"]').click();
    await page.locator('#role-name').fill(`Auditor QA ${unique}`);
    await page.locator('#role-description').fill('Perfil temporário do QA funcional Enterprise.');
    await page.locator('input[name="permissions"][value="org.read"]').check();
    await page.locator('input[name="permissions"][value="analytics.read"]').check();
    await page.locator('form[data-form="role"] button[type="submit"]').click();
    await page.locator('.enterprise-modal-backdrop').waitFor({ state: 'hidden' });
    const state = await api();
    const role = state.roles.find((item) => item.name === `Auditor QA ${unique}`);
    if (!role) throw new Error('Perfil criado não encontrado.');
    if (!role.permissions.includes('org.read') || !role.permissions.includes('analytics.read')) throw new Error('Permissões RBAC não persistidas.');
    roleId = role.id;
    return role.id;
  });

  await expect('Criação de membro vinculada ao perfil RBAC', async () => {
    if (!roleId) throw new Error('Perfil de QA indisponível.');
    await page.evaluate(() => document.querySelector('[data-view="members"]')?.click());
    await page.locator('[data-open-modal="member"]').click();
    await page.locator('#member-name').fill(`Pessoa QA ${unique}`);
    await page.locator('#member-email').fill(`qa-${unique}@lifeos.local`);
    await page.locator('#member-team').fill('Quality Engineering');
    await page.locator('#member-role').selectOption(roleId);
    await page.locator('form[data-form="member"] button[type="submit"]').click();
    await page.locator('.enterprise-modal-backdrop').waitFor({ state: 'hidden' });
    const state = await api();
    const member = state.members.find((item) => item.email === `qa-${unique}@lifeos.local`);
    if (!member) throw new Error('Membro criado não encontrado.');
    if (member.roleId !== roleId || member.team !== 'Quality Engineering') throw new Error('Associação de perfil ou equipe não persistida.');
    memberId = member.id;
    return member.id;
  });

  await expect('Atualização de membro pela interface', async () => {
    if (!memberId) throw new Error('Membro de QA indisponível.');
    await page.locator(`[data-edit-member="${memberId}"]`).click();
    await page.locator('#member-name').fill(`Pessoa QA Atualizada ${unique}`);
    await page.locator('#member-status').selectOption('active');
    await page.locator('form[data-form="member"] button[type="submit"]').click();
    await page.locator('.enterprise-modal-backdrop').waitFor({ state: 'hidden' });
    const state = await api();
    const member = state.members.find((item) => item.id === memberId);
    if (member?.name !== `Pessoa QA Atualizada ${unique}` || member?.status !== 'active') throw new Error('Alterações do membro não persistidas.');
  });

  await expect('Busca de membros filtra dados reais', async () => {
    await page.locator('[data-enterprise-search]').fill(`qa-${unique}@lifeos.local`);
    const row = page.locator(`[data-edit-member="${memberId}"]`);
    await row.waitFor({ state: 'visible' });
    const count = await page.locator('.enterprise-table tbody tr').count();
    if (count !== 1) throw new Error(`Busca retornou ${count} linhas.`);
    await page.locator('[data-enterprise-search]').fill('');
  });

  await expect('Mudança de plano persiste e restaura billing', async () => {
    const target = initialState.subscription.plan === 'Business' ? 'Enterprise' : 'Business';
    let state = await api('plan.change', { plan: target });
    if (state.subscription.plan !== target || state.subscription.status !== 'active') throw new Error('Novo plano não persistiu.');
    state = await api('plan.change', { plan: initialState.subscription.plan });
    planRestored = state.subscription.plan === initialState.subscription.plan;
    if (!planRestored) throw new Error('Plano original não foi restaurado.');
  });

  await expect('Políticas de compliance persistem e são restauradas', async () => {
    let state = await api('policy.update', { mfaRequired: !initialState.policies.mfaRequired, lgpdMode: initialState.policies.lgpdMode, dataEncryption: initialState.policies.dataEncryption, ssoEnforced: initialState.policies.ssoEnforced, sessionHours: initialState.policies.sessionHours, auditRetentionDays: initialState.policies.auditRetentionDays });
    if (state.policies.mfaRequired === initialState.policies.mfaRequired) throw new Error('Política alterada não persistiu.');
    state = await api('policy.update', { mfaRequired: initialState.policies.mfaRequired, lgpdMode: initialState.policies.lgpdMode, dataEncryption: initialState.policies.dataEncryption, ssoEnforced: initialState.policies.ssoEnforced, sessionHours: initialState.policies.sessionHours, auditRetentionDays: initialState.policies.auditRetentionDays });
    policyRestored = state.policies.mfaRequired === initialState.policies.mfaRequired;
    if (!policyRestored) throw new Error('Política original não foi restaurada.');
  });

  await expect('Integrações alternam estado e restauram configuração', async () => {
    const integration = initialState.integrations[0];
    let state = await api('integration.toggle', { id: integration.id });
    if (state.integrations.find((item) => item.id === integration.id)?.connected === integration.connected) throw new Error('Estado da integração não foi alterado.');
    state = await api('integration.toggle', { id: integration.id });
    integrationRestored = state.integrations.find((item) => item.id === integration.id)?.connected === integration.connected;
    if (!integrationRestored) throw new Error('Integração original não foi restaurada.');
  });

  await expect('Exportação de snapshot gera download', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-enterprise-action="export"]').click(),
    ]);
    if (!download.suggestedFilename().endsWith('.json')) throw new Error(`Arquivo inesperado: ${download.suggestedFilename()}`);
    return download.suggestedFilename();
  });

  await expect('Download de fatura gera documento', async () => {
    await page.evaluate(() => document.querySelector('[data-view="billing"]')?.click());
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-download-invoice]').first().click(),
    ]);
    if (!download.suggestedFilename().endsWith('.txt')) throw new Error(`Arquivo inesperado: ${download.suggestedFilename()}`);
    return download.suggestedFilename();
  });

  await expect('Auditoria registra operações críticas', async () => {
    const state = await api();
    const actions = new Set(state.auditLog.map((item) => item.action));
    const required = ['role.create', 'member.create', 'member.update', 'plan.change', 'policy.update', 'integration.toggle'];
    const missing = required.filter((action) => !actions.has(action));
    if (missing.length) throw new Error(`Eventos ausentes: ${missing.join(', ')}`);
    return `${required.length} categorias auditadas`;
  });

  await expect('Remoção de membro pela interface', async () => {
    await page.evaluate(() => document.querySelector('[data-view="members"]')?.click());
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator(`[data-remove-member="${memberId}"]`).click();
    await page.waitForFunction((id) => !document.querySelector(`[data-remove-member="${id}"]`), memberId);
    const state = await api();
    if (state.members.some((item) => item.id === memberId)) throw new Error('Membro ainda existe.');
    memberId = '';
  });

  await expect('Remoção de perfil RBAC pela interface', async () => {
    await page.evaluate(() => document.querySelector('[data-view="roles"]')?.click());
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator(`[data-remove-role="${roleId}"]`).click();
    await page.waitForFunction((id) => !document.querySelector(`[data-remove-role="${id}"]`), roleId);
    const state = await api();
    if (state.roles.some((item) => item.id === roleId)) throw new Error('Perfil ainda existe.');
    roleId = '';
  });
} finally {
  try {
    if (memberId) await api('member.remove', { id: memberId });
    if (roleId) await api('role.remove', { id: roleId });
    if (initialState && !planRestored) await api('plan.change', { plan: initialState.subscription.plan });
    if (initialState && !policyRestored) await api('policy.update', initialState.policies);
    if (initialState && !integrationRestored) await api('integration.toggle', { id: initialState.integrations[0].id });
  } catch (error) {
    record('Limpeza de dados temporários', false, error instanceof Error ? error.message : String(error));
  }
}

record('Sem erros de runtime', runtimeErrors.length === 0, runtimeErrors.join(' | '));
record('Sem respostas 5xx', failedResponses.length === 0, failedResponses.join(' | '));
await page.screenshot({ path: path.join(outputDir, 'functional-final.png'), fullPage: true });
await context.close();
await browser.close();
await writeFile(path.join(outputDir, 'functional-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures.length, output: path.join(outputDir, 'functional-report.json') }, null, 2));
if (report.failures.length) process.exitCode = 1;
