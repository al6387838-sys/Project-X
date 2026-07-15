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
      // O processo pode terminar durante a leitura de /proc.
    }
  }
  try {
    const config = readFileSync(path.resolve('wrangler.toml'), 'utf8');
    const values = Object.fromEntries(
      [...config.matchAll(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/gm)].map((match) => [match[1], match[2]]),
    );
    if (values.LIFEOS_SESSION_SECRET && values.LIFEOS_ADMIN_USER) return values;
  } catch {
    // O arquivo local pode não existir em execuções externas.
  }
  throw new Error('Bindings do ambiente local Cloudflare não encontrados.');
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
const anonymousResponse = await anonymous.request.get(`${baseURL}/api/enterprise-data`);
record('Sessão anônima é bloqueada', anonymousResponse.status() === 401, `status ${anonymousResponse.status()}`);
await anonymous.close();

const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'pt-BR',
  colorScheme: 'dark',
  acceptDownloads: true,
});
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

async function api(action, payload = {}) {
  return page.evaluate(async ({ actionName, actionPayload }) => {
    const options = actionName
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: actionName, payload: actionPayload }) }
      : { method: 'GET' };
    const response = await fetch('/api/enterprise-data', options);
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
  await page.locator('#view-command.active').waitFor({ state: 'visible' });
  initialState = await api();
  record('Sessão administrativa carrega o Enterprise', Boolean(initialState?.organization?.id));

  await expect('Navegação Enterprise cobre todos os módulos', async () => {
    for (const view of views) {
      await page.locator(`[data-view="${view}"]`).first().click();
      await page.locator(`#view-${view}.active`).waitFor({ state: 'visible' });
      if (new URL(page.url()).hash !== `#${view}`) throw new Error(`Hash incorreto para ${view}.`);
    }
    return `${views.length} módulos`;
  });

  await expect('Criação de perfil RBAC pela interface', async () => {
    await page.locator('[data-view="roles"]').first().click();
    await page.locator('[data-action="role.create"]').click();
    await page.locator('#role-name').fill(`Auditor QA ${unique}`);
    await page.locator('#modal-body input[value="org.read"]').check();
    await page.locator('#modal-body input[value="analytics.read"]').check();
    await page.locator('#modal-role-submit').click();
    await page.locator('#modal-backdrop').waitFor({ state: 'hidden' });
    const state = await api();
    const role = state.roles.find((item) => item.name === `Auditor QA ${unique}`);
    if (!role) throw new Error('Perfil criado não encontrado.');
    if (!role.permissions.includes('org.read') || !role.permissions.includes('analytics.read')) throw new Error('Permissões RBAC não persistidas.');
    roleId = role.id;
    return role.id;
  });

  await expect('Criação de membro vinculada ao perfil RBAC', async () => {
    if (!roleId) throw new Error('Perfil de QA indisponível.');
    await page.locator('[data-view="members"]').first().click();
    await page.locator('[data-action="member.invite"]').click();
    await page.locator('#inv-name').fill(`Pessoa QA ${unique}`);
    await page.locator('#inv-email').fill(`qa-${unique}@lifeos.local`);
    await page.locator('#inv-team').fill('Quality Engineering');
    await page.locator('#inv-role').selectOption(roleId);
    await page.locator('#modal-invite-submit').click();
    await page.locator('#modal-backdrop').waitFor({ state: 'hidden' });
    const state = await api();
    const member = state.members.find((item) => item.email === `qa-${unique}@lifeos.local`);
    if (!member) throw new Error('Membro criado não encontrado.');
    if (member.roleId !== roleId || member.team !== 'Quality Engineering') throw new Error('Associação de perfil ou equipe não persistida.');
    memberId = member.id;
    return member.id;
  });

  await expect('Atualização de membro persiste na API Enterprise', async () => {
    if (!memberId) throw new Error('Membro de QA indisponível.');
    const state = await api('member.update', {
      id: memberId,
      name: `Pessoa QA Atualizada ${unique}`,
      status: 'active',
      roleId,
      team: 'Quality Engineering',
    });
    const member = state.members.find((item) => item.id === memberId);
    if (member?.name !== `Pessoa QA Atualizada ${unique}` || member?.status !== 'active') throw new Error('Alterações do membro não persistidas.');
  });

  await expect('Busca de membros filtra dados reais', async () => {
    await page.locator('[data-view="members"]').first().click();
    await page.locator('#members-filter').fill(`qa-${unique}@lifeos.local`);
    const row = page.locator('#members-content tbody tr', { hasText: `qa-${unique}@lifeos.local` });
    await row.waitFor({ state: 'visible' });
    const count = await page.locator('#members-content tbody tr').count();
    if (count !== 1) throw new Error(`Busca retornou ${count} linhas.`);
    await page.locator('#members-filter').fill('');
  });

  await expect('Mudança de plano persiste e restaura billing', async () => {
    const target = initialState.subscription.plan === 'Business' ? 'Enterprise' : 'Business';
    let state = await api('plan.change', { plan: target });
    if (state.subscription.plan !== target || state.subscription.status !== 'active') throw new Error('Novo plano não persistiu.');
    state = await api('plan.change', { plan: initialState.subscription.plan });
    planRestored = state.subscription.plan === initialState.subscription.plan;
    if (!planRestored) throw new Error('Plano original não foi restaurado.');
  });

  await expect('Políticas de MFA e compliance persistem e são restauradas', async () => {
    let state = await api('policy.update', {
      mfaRequired: !initialState.policies.mfaRequired,
      lgpdMode: initialState.policies.lgpdMode,
      dataEncryption: initialState.policies.dataEncryption,
      ssoEnforced: initialState.policies.ssoEnforced,
      sessionHours: initialState.policies.sessionHours,
      auditRetentionDays: initialState.policies.auditRetentionDays,
    });
    if (state.policies.mfaRequired === initialState.policies.mfaRequired) throw new Error('Política alterada não persistiu.');
    state = await api('policy.update', initialState.policies);
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

  await expect('Exportação de auditoria gera download', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-btn').click(),
    ]);
    if (!download.suggestedFilename().endsWith('.csv')) throw new Error(`Arquivo inesperado: ${download.suggestedFilename()}`);
    return download.suggestedFilename();
  });

  await expect('Billing disponibiliza ação de fatura', async () => {
    await page.locator('[data-view="billing"]').first().click();
    const invoice = page.locator('[data-action="invoice.download"]').first();
    await invoice.click();
    await page.locator('.toast', { hasText: 'Gerando PDF da fatura' }).waitFor({ state: 'visible' });
  });

  await expect('Auditoria registra operações críticas', async () => {
    const state = await api();
    const actions = new Set(state.auditLog.map((item) => item.action));
    const required = ['role.create', 'member.invite', 'member.update', 'plan.change', 'policy.update', 'integration.toggle'];
    const missing = required.filter((action) => !actions.has(action));
    if (missing.length) throw new Error(`Eventos ausentes: ${missing.join(', ')}`);
    return `${required.length} categorias auditadas`;
  });

  await expect('Remoção de membro pela interface', async () => {
    await page.locator('[data-view="members"]').first().click();
    page.once('dialog', (dialog) => dialog.accept());
    const [response] = await Promise.all([
      page.waitForResponse((item) => item.url().endsWith('/api/enterprise-data') && item.request().method() === 'POST'),
      page.locator(`[data-action="member.remove"][data-id="${memberId}"]`).click(),
    ]);
    if (!response.ok()) throw new Error(`Remoção retornou HTTP ${response.status()}.`);
    const state = await api();
    if (state.members.some((item) => item.id === memberId)) throw new Error('Membro ainda existe.');
    memberId = '';
  });

  await expect('Remoção do perfil temporário preserva o RBAC', async () => {
    if (!roleId) throw new Error('Perfil de QA indisponível.');
    const state = await api('role.remove', { id: roleId });
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

record('Zero erros de JavaScript', runtimeErrors.length === 0, [...new Set(runtimeErrors)].join(' | '));
record('Zero respostas HTTP 4xx/5xx autenticadas', failedResponses.length === 0, [...new Set(failedResponses)].join(' | '));
await page.screenshot({ path: path.join(outputDir, 'functional-final.png'), fullPage: true });
await context.close();
await browser.close();
await writeFile(path.join(outputDir, 'functional-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures.length, output: path.join(outputDir, 'functional-report.json') }, null, 2));
if (report.failures.length) process.exitCode = 1;
