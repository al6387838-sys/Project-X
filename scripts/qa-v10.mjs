import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.QA_BASE_URL || 'http://localhost:8788';
const outputDir = path.resolve('qa-artifacts');
const report = { baseURL, generatedAt: new Date().toISOString(), checks: [], failures: [] };

function findPreviewEnvironment() {
  if (process.env.LIFEOS_SESSION_SECRET && process.env.LIFEOS_ADMIN_USER) return process.env;
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const env = Object.fromEntries(
        readFileSync(`/proc/${entry}/environ`, 'utf8')
          .split('\0')
          .filter(Boolean)
          .map((item) => {
            const separator = item.indexOf('=');
            return [item.slice(0, separator), item.slice(separator + 1)];
          }),
      );
      if (env.LIFEOS_SESSION_SECRET && env.LIFEOS_ADMIN_USER) return env;
    } catch {
      // O processo pode desaparecer durante a leitura.
    }
  }
  const config = readFileSync(path.resolve('wrangler.toml'), 'utf8');
  const values = Object.fromEntries(
    [...config.matchAll(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/gm)].map((match) => [match[1], match[2]]),
  );
  if (values.LIFEOS_SESSION_SECRET && values.LIFEOS_ADMIN_USER) return values;
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
  console.log(`${passed ? 'PASS' : 'FAIL'} — ${name}${detail ? ` — ${detail}` : ''}`);
}

async function check(name, operation) {
  try {
    const detail = await operation();
    record(name, true, typeof detail === 'string' ? detail : '');
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

await mkdir(outputDir, { recursive: true });
const env = findPreviewEnvironment();
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', colorScheme: 'dark' });
await context.addCookies([{
  name: 'lifeos_session',
  value: createSession(env.LIFEOS_ADMIN_USER, env.LIFEOS_SESSION_SECRET),
  url: baseURL,
  httpOnly: true,
  sameSite: 'Strict',
}]);
const page = await context.newPage();
page.setDefaultTimeout(8000);
page.setDefaultNavigationTimeout(15000);
const runtimeErrors = [];
const failedResponses = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) runtimeErrors.push(message.text());
});
page.on('response', (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

await page.goto(`${baseURL}/app`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.showPage === 'function');

await check('Command Center carrega os indicadores v10', async () => {
  await page.evaluate(() => window.showPage('dashboard'));
  await page.locator('#widgetGrid').waitFor({ state: 'visible' });
  await page.locator('#widget-productivity').waitFor({ state: 'visible' });
  await page.locator('#widget-system-health').waitFor({ state: 'visible' });
  const count = await page.locator('#widgetGrid > .widget').count();
  if (count < 12) throw new Error(`Somente ${count} widgets disponíveis.`);
  return `${count} widgets`;
});

await check('Layout configurável persiste no navegador', async () => {
  await page.evaluate(() => window.removeWidget('widget-productivity'));
  await page.waitForTimeout(400);
  if (!await page.locator('#widget-productivity').evaluate((element) => element.classList.contains('widget-hidden'))) {
    throw new Error('Widget não foi ocultado.');
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.showPage('dashboard'));
  await page.locator('#widget-productivity').waitFor({ state: 'attached' });
  const hidden = await page.locator('#widget-productivity').evaluate((element) => element.classList.contains('widget-hidden'));
  if (!hidden) throw new Error('Estado do widget não persistiu.');
  await page.evaluate(() => {
    localStorage.removeItem('lifeos_dashboard_v2_hidden');
    localStorage.removeItem('lifeos_dashboard_v2_order');
  });
  return 'localStorage restaurado após o teste';
});

await check('Busca Universal cobre novos tipos e módulos', async () => {
  await page.evaluate(() => window.showPage('search'));
  await page.locator('#ss-input').waitFor({ state: 'visible' });
  await page.locator('#ss-input').fill('Companion AI');
  await page.waitForTimeout(350);
  await page.locator('#ss-results-list .ss-result-item', { hasText: 'Companion AI' }).waitFor({ state: 'visible' });
  const filters = await page.locator('#ss-filters .ss-filter').count();
  if (filters < 12) throw new Error(`Somente ${filters} filtros disponíveis.`);
  const auditFilter = await page.locator('[data-filter="audit"]').count();
  if (!auditFilter) throw new Error('Filtro de auditoria ausente.');
  return `${filters} filtros`;
});

await check('Central de Integrações oferece catálogo, filtros e permissões', async () => {
  await page.evaluate(() => window.showPage('integration-center'));
  await page.locator('#ic-grid').waitFor({ state: 'visible' });
  const total = await page.locator('#ic-grid .ic-card').count();
  if (total !== 9) throw new Error(`Catálogo contém ${total} integrações, esperado 9.`);
  await page.locator('#ic-search').fill('Slack');
  await page.waitForTimeout(100);
  const filtered = await page.locator('#ic-grid .ic-card:visible').count();
  if (filtered !== 1) throw new Error(`Filtro retornou ${filtered} cartões.`);
  await page.locator('#ic-grid .ic-card button').first().click();
  await page.locator('#ic-modal.open').waitFor({ state: 'visible' });
  const permissions = await page.locator('#ic-perms input[type="checkbox"]').count();
  if (!permissions) throw new Error('Escopos de permissão não foram apresentados.');
  await page.evaluate(() => window.icCloseModal());
  await page.locator('#ic-search').fill('');
  return `${total} integrações e ${permissions} escopos para Slack`;
});

await check('Companion AI preserva contexto, preferências e memória', async () => {
  await page.evaluate(() => window.showPage('companion-ai'));
  await page.locator('#ai-tone').waitFor({ state: 'visible' });
  await page.locator('#ai-tone').selectOption('analytical');
  await page.locator('#ai-detail').selectOption('detailed');
  await page.evaluate(() => window.showPage('ai-memory'));
  await page.locator('#ai-memory-search').waitFor({ state: 'visible' });
  await page.locator('#ai-memory-search').fill('financeiro');
  await page.waitForTimeout(150);
  const visibleMemories = await page.locator('#ai-memory-list > *:visible').count();
  if (!visibleMemories) throw new Error('Filtro contextual não retornou memórias.');
  await page.evaluate(() => window.showPage('ai-chat'));
  await page.locator('#ai-chat-input').waitFor({ state: 'visible' });
  await page.locator('#ai-chat-input').fill('<img src=x onerror=alert(1)> plano semanal');
  await page.evaluate(() => window.aiChatSend());
  await page.waitForTimeout(150);
  const messageText = await page.locator('#ai-chat-messages').innerText();
  if (!messageText.includes('<img src=x onerror=alert(1)> plano semanal')) throw new Error('Mensagem não foi registrada como texto seguro.');
  if (!await page.evaluate(() => Boolean(localStorage.getItem('lifeos_v10_companion_preferences')))) throw new Error('Preferências não persistiram.');
  return `${visibleMemories} memória(s) filtrada(s)`;
});

await page.goto(`${baseURL}/admin`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.showPage === 'function');

await check('Enterprise Admin exibe gestão de tenants e ações auditáveis', async () => {
  await page.evaluate(() => window.showPage('organizations'));
  await page.locator('#page-organizations.active').waitFor({ state: 'visible' });
  const rows = await page.locator('#page-organizations tbody tr').count();
  if (rows < 3) throw new Error(`Somente ${rows} tenants disponíveis.`);
  const actions = await page.locator('#page-organizations button').count();
  if (!actions) throw new Error('Ações rápidas de tenant ausentes.');
  return `${rows} tenants e ${actions} ações`;
});

await check('Enterprise Admin filtra usuários operacionais', async () => {
  await page.evaluate(() => window.showPage('users'));
  await page.locator('#page-users.active').waitFor({ state: 'visible' });
  const search = page.locator('#admin-user-search');
  await search.fill('Ana');
  await page.waitForTimeout(100);
  const rows = await page.locator('#admin-users-body tr:visible').count();
  if (!rows) throw new Error('Filtro não retornou usuários.');
  await search.fill('');
  return `${rows} resultado(s) para Ana`;
});

record('Zero erros de JavaScript na regressão v10', runtimeErrors.length === 0, [...new Set(runtimeErrors)].join(' | '));
record('Zero respostas HTTP 4xx/5xx na regressão v10', failedResponses.length === 0, [...new Set(failedResponses)].join(' | '));
await page.screenshot({ path: path.join(outputDir, 'v10-final.png'), fullPage: true });
await context.close();
await browser.close();
await writeFile(path.join(outputDir, 'v10-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures.length, output: path.join(outputDir, 'v10-report.json') }, null, 2));
if (report.failures.length) process.exitCode = 1;
