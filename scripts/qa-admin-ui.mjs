import { readFileSync, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.QA_BASE_URL || 'http://localhost:8788';
const outputDir = path.resolve('qa-artifacts');

function environment() {
  if (process.env.LIFEOS_SESSION_SECRET && process.env.LIFEOS_ADMIN_USER) return process.env;
  const configPath = path.resolve('wrangler.toml');
  if (!existsSync(configPath)) throw new Error('wrangler.toml não encontrado para a prévia de QA.');
  const config = readFileSync(configPath, 'utf8');
  const values = Object.fromEntries([...config.matchAll(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/gm)].map((match) => [match[1], match[2]]));
  if (!values.LIFEOS_SESSION_SECRET || !values.LIFEOS_ADMIN_USER) throw new Error('Bindings locais de sessão administrativa não encontrados.');
  return values;
}

function sessionToken(username, secret) {
  const payload = Buffer.from(JSON.stringify({ sub: username, role: 'admin', jti: `qa-admin-ui-${Date.now()}`, iat: Date.now(), exp: Date.now() + 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

const env = environment();
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
await context.addCookies([{ name: 'lifeos_session', value: sessionToken(env.LIFEOS_ADMIN_USER, env.LIFEOS_SESSION_SECRET), url: baseURL, httpOnly: true, sameSite: 'Strict' }]);
const page = await context.newPage();
const runtimeErrors = [];
const failures = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });

const checks = [];
async function check(name, action) {
  try { await action(); checks.push({ name, ok: true }); console.log(`PASS — ${name}`); }
  catch (error) { checks.push({ name, ok: false, error: error.message }); console.error(`FAIL — ${name}: ${error.message}`); }
}

await check('Carrega a superfície administrativa concluída', async () => {
  await page.goto(`${baseURL}/admin#overview`, { waitUntil: 'networkidle' });
  await page.locator('#lifeos-admin-root h1').filter({ hasText: 'Dashboard executivo' }).waitFor({ state: 'visible' });
});

await check('Navega para usuários e renderiza controles operacionais', async () => {
  await page.locator('[data-action="navigate"][data-page="users"]').click();
  await page.locator('#lifeos-admin-root h1').filter({ hasText: 'Usuários' }).waitFor({ state: 'visible' });
  await page.locator('#lifeos-admin-search').waitFor({ state: 'visible' });
  await page.locator('[data-action="invite-user"]').waitFor({ state: 'visible' });
});

await check('Abre e fecha o formulário de convite de usuário', async () => {
  await page.locator('[data-action="invite-user"]').click();
  await page.locator('#lifeos-admin-dialog').waitFor({ state: 'visible' });
  await page.locator('#la-field-email').fill('ui-qa@lifeos.test');
  await page.locator('[data-action="close-dialog"]').first().click();
  await page.locator('#lifeos-admin-dialog').waitFor({ state: 'detached' });
});

await check('Navega para organizações, workspaces e planos', async () => {
  for (const target of ['organizations', 'workspaces', 'plans']) {
    await page.locator(`[data-action="navigate"][data-page="${target}"]`).click();
    await page.locator('#lifeos-admin-root h1').filter({ hasText: target === 'organizations' ? 'Organizações' : target === 'workspaces' ? 'Workspaces' : 'Planos' }).waitFor({ state: 'visible' });
  }
});

await check('Renderiza auditoria, sistema e integrações com estados profissionais', async () => {
  for (const target of ['audit', 'system', 'integrations']) {
    await page.locator(`[data-action="navigate"][data-page="${target}"]`).click();
    await page.locator('#lifeos-admin-root h1').waitFor({ state: 'visible' });
  }
});

await page.screenshot({ path: path.join(outputDir, 'admin-v43-desktop.png'), fullPage: true });
await browser.close();

const allFailures = [...checks.filter((item) => !item.ok), ...runtimeErrors.map((error) => ({ name: 'Erro de runtime', ok: false, error })), ...failures.map((error) => ({ name: 'Resposta HTTP inválida', ok: false, error }))];
console.log(JSON.stringify({ checks: checks.length, failures: allFailures.length, runtimeErrors, failedResponses: failures, output: path.join(outputDir, 'admin-v43-desktop.png') }, null, 2));
if (allFailures.length) process.exitCode = 1;
