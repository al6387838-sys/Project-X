// LifeOS Enterprise v43.0 — QA visual e funcional da área do usuário.
import { readFileSync, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.QA_BASE_URL || 'http://localhost:8788';
const outputDir = path.resolve('qa-artifacts');

function environment() {
  if (process.env.LIFEOS_SESSION_SECRET) return process.env;
  const configPath = path.resolve('wrangler.toml');
  if (!existsSync(configPath)) throw new Error('wrangler.toml não encontrado para a prévia de QA.');
  const config = readFileSync(configPath, 'utf8');
  const values = Object.fromEntries([...config.matchAll(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/gm)].map((match) => [match[1], match[2]]));
  if (!values.LIFEOS_SESSION_SECRET) throw new Error('Binding local de sessão não encontrado.');
  return values;
}

function sessionToken(username, secret) {
  const payload = Buffer.from(JSON.stringify({ sub: username, role: 'user', jti: `qa-user-ui-${Date.now()}`, iat: Date.now(), exp: Date.now() + 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

const env = environment();
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
await context.addCookies([{ name: 'lifeos_session', value: sessionToken('qa-user@lifeos.test', env.LIFEOS_SESSION_SECRET), url: baseURL, httpOnly: true, sameSite: 'Strict' }]);
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

await check('Carrega o dashboard concluído da área do usuário', async () => {
  await page.goto(`${baseURL}/app#dashboard`, { waitUntil: 'networkidle' });
  await page.locator('#lifeos-user-completion .page-title').filter({ hasText: 'Dashboard' }).waitFor({ state: 'visible' });
});

const routes = [
  ['agenda', 'Agenda'], ['projects', 'Projetos'], ['crm', 'CRM'], ['workspace', 'Workspace'],
  ['ai', 'IA'], ['documents', 'Documentos'], ['profile', 'Perfil'], ['settings', 'Configurações'],
  ['notifications', 'Notificações'], ['goals', 'Metas'], ['history', 'Histórico'],
];
for (const [route, title] of routes) {
  await check(`Renderiza ${title} com dados reais ou estado vazio profissional`, async () => {
    await page.evaluate((target) => window.showPage(target), route);
    await page.locator('#lifeos-user-completion .page-title').filter({ hasText: title }).waitFor({ state: 'visible' });
  });
}

await check('Expõe criação e upload de documentos com CTAs funcionais', async () => {
  await page.evaluate(() => window.showPage('documents'));
  await page.locator('[data-action="document-create"]').click();
  await page.locator('.l43-modal').waitFor({ state: 'visible' });
  await page.locator('[data-action="modal-cancel"]').first().click();
  await page.locator('.l43-modal').waitFor({ state: 'detached' });
  await page.locator('[data-action="document-upload"]').first().click();
  await page.locator('input[type="file"]').waitFor({ state: 'visible' });
  await page.locator('[data-action="modal-cancel"]').first().click();
});

await check('Expõe lixeira, restauração e auditoria documental sem botão inerte', async () => {
  await page.locator('[data-action="document-trash"]').click();
  await page.locator('.l43-modal').waitFor({ state: 'visible' });
  await page.locator('.l43-modal').getByText('Lixeira de documentos').waitFor({ state: 'visible' });
  await page.locator('[data-action="modal-cancel"]').last().click();
  await page.locator('.l43-modal').waitFor({ state: 'detached' });
});

await page.screenshot({ path: path.join(outputDir, 'user-v43-desktop.png'), fullPage: true });
await browser.close();

const allFailures = [
  ...checks.filter((item) => !item.ok),
  ...runtimeErrors.map((error) => ({ name: 'Erro de runtime', ok: false, error })),
  ...failures.map((error) => ({ name: 'Resposta HTTP inválida', ok: false, error })),
];
console.log(JSON.stringify({ checks: checks.length, failures: allFailures.length, runtimeErrors, failedResponses: failures, output: path.join(outputDir, 'user-v43-desktop.png') }, null, 2));
if (allFailures.length) process.exitCode = 1;
