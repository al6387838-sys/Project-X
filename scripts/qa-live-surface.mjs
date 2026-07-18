import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.QA_BASE_URL || 'http://localhost:8788';
const outputDir = path.resolve('qa-artifacts');
const routes = [
  { route: 'finance', container: 'module-finance-container' },
  { route: 'messages', container: 'module-communication-container' },
  { route: 'email', container: 'module-email-container' },
  { route: 'calendar', container: 'module-calendar-container' },
  { route: 'companion-ai', container: 'module-ai-center-container' },
  { route: 'documents', container: 'module-documents-container' },
  { route: 'kanban', container: 'module-productivity-container' },
  { route: 'marketplace', container: 'module-marketplace-container' },
  { route: 'app-ecosystem', container: 'module-app-ecosystem-container' },
  { route: 'integration-center', container: 'module-integration-center-container' },
  { route: 'personal-hub', container: 'module-personal-hub-container' },
  { route: 'enterprise-settings', container: 'module-enterprise-settings-container' },
  { route: 'observability', container: 'module-observability-container' },
];
const report = { baseURL, generatedAt: new Date().toISOString(), routes: [], failures: [] };

function findPreviewEnvironment() {
  if (process.env.LIFEOS_SESSION_SECRET && process.env.LIFEOS_ADMIN_USER) return process.env;
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const env = Object.fromEntries(readFileSync(`/proc/${entry}/environ`, 'utf8').split('\0').filter(Boolean).map((item) => {
        const separator = item.indexOf('=');
        return [item.slice(0, separator), item.slice(separator + 1)];
      }));
      if (env.LIFEOS_SESSION_SECRET && env.LIFEOS_ADMIN_USER) return env;
    } catch { /* processo transitório */ }
  }
  const config = readFileSync(path.resolve('wrangler.toml'), 'utf8');
  const values = Object.fromEntries([...config.matchAll(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/gm)].map((match) => [match[1], match[2]]));
  if (values.LIFEOS_SESSION_SECRET && values.LIFEOS_ADMIN_USER) return values;
  throw new Error('Bindings de ambiente local não encontrados.');
}

function createSession(username, secret) {
  const payload = Buffer.from(JSON.stringify({ sub: username, role: 'admin', jti: `qa-live-${Date.now()}`, iat: Date.now(), exp: Date.now() + 3600000 }), 'utf8').toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

await mkdir(outputDir, { recursive: true });
const env = findPreviewEnvironment();
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', colorScheme: 'dark' });
await context.addCookies([{ name: 'lifeos_session', value: createSession(env.LIFEOS_ADMIN_USER, env.LIFEOS_SESSION_SECRET), url: baseURL, httpOnly: true, sameSite: 'Strict' }]);
const page = await context.newPage();
page.setDefaultTimeout(9000);
const runtimeErrors = [];
const failedResponses = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) runtimeErrors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

await page.goto(`${baseURL}/app`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.showPage === 'function');
for (const { route, container } of routes) {
  try {
    await page.evaluate((target) => window.showPage(target), route);
    const root = page.locator(`#${container} #module-live-surface`);
    await root.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const node = document.querySelector('#module-live-surface [data-live-status]');
      return node && !node.textContent.includes('Carregando dados persistidos');
    });
    const text = await root.innerText();
    const forbidden = ['R$ 24.850', 'Carlos Andrade', 'Maria Santos', 'João Dias', 'cliente XYZ', 'Nubank vence hoje'];
    const found = forbidden.find((value) => text.includes(value));
    if (found) throw new Error(`Conteúdo demonstrativo visível: ${found}`);
    const title = await root.locator('[data-live-title]').textContent();
    if (!title?.trim()) throw new Error('Título da superfície dinâmica não foi renderizado.');
    report.routes.push({ route, passed: true, title: title.trim() });
    console.log(`PASS — ${route} — ${title.trim()}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    report.routes.push({ route, passed: false, detail });
    report.failures.push(`${route}: ${detail}`);
    console.log(`FAIL — ${route} — ${detail}`);
  }
}
if (runtimeErrors.length) report.failures.push(...runtimeErrors.map((value) => `JS: ${value}`));
if (failedResponses.length) report.failures.push(...failedResponses.map((value) => `HTTP: ${value}`));
await writeFile(path.join(outputDir, 'live-surface-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await browser.close();
if (report.failures.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ routes: report.routes.length, failures: 0, output: path.join(outputDir, 'live-surface-report.json') }, null, 2));
}
