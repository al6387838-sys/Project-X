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
    JSON.stringify({ sub: username, role: 'admin', jti: `qa-v11-${Date.now()}`, iat: Date.now(), exp: Date.now() + 60 * 60 * 1000 }),
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

async function openModule(page, route, rootSelector) {
  await page.evaluate((target) => window.showPage(target), route);
  await page.locator(rootSelector).waitFor({ state: 'visible' });
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
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
});

await page.goto(`${baseURL}/app`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.showPage === 'function');

await check('Universal Command Center carrega widgets essenciais e quatro contextos', async () => {
  await openModule(page, 'command-center', '#module-dashboard-v11');
  const widgets = await page.locator('#module-dashboard-v11 .dv11-widget').count();
  const tabs = await page.locator('#module-dashboard-v11 .dv11-tab').count();
  if (widgets < 6) throw new Error(`Somente ${widgets} widgets disponíveis.`);
  if (tabs !== 4) throw new Error(`${tabs} abas encontradas; esperado 4.`);
  for (const tab of ['week', 'priorities', 'command', 'today']) {
    await page.evaluate((target) => window.dv11SwitchTab(target), tab);
    await page.locator(`#panel-${tab}.active`).waitFor({ state: 'visible' });
  }
  return `${widgets} widgets e ${tabs} contextos`;
});

await check('Layout do Command Center persiste no navegador', async () => {
  await page.evaluate(() => window.dv11RemoveWidget('w11-today-ai'));
  const hidden = await page.locator('#w11-today-ai').evaluate((element) => element.classList.contains('hidden'));
  if (!hidden) throw new Error('Widget removido não foi ocultado.');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeos_dv11_hidden') || '[]'));
  if (!stored.includes('w11-today-ai')) throw new Error('Widget oculto não foi persistido.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openModule(page, 'command-center', '#module-dashboard-v11');
  const persisted = await page.locator('#w11-today-ai').evaluate((element) => element.classList.contains('hidden'));
  if (!persisted) throw new Error('Layout não foi restaurado após recarregar.');
  await page.evaluate(() => {
    localStorage.removeItem('lifeos_dv11_hidden');
    localStorage.removeItem('lifeos_dv11_order');
  });
  return 'ocultação e ordem armazenadas em localStorage';
});

await check('Digital Identity Center alterna cinco áreas de segurança', async () => {
  await openModule(page, 'identity', '#module-identity');
  const tabs = await page.locator('#page-identity .dv11-tab').count();
  if (tabs !== 5) throw new Error(`${tabs} abas encontradas; esperado 5.`);
  for (const tab of ['sessions', 'devices', 'mfa', 'audit', 'profiles']) {
    await page.locator(`#page-identity [onclick="identityTab('${tab}')"]`).click();
    await page.locator(`#identity-${tab}-tab`).waitFor({ state: 'visible' });
  }
  return `${tabs} áreas de identidade e segurança`;
});

await check('Enterprise File Center exibe documentos persistidos ou estado vazio profissional', async () => {
  await openModule(page, 'file-center', '#module-file-center');
  await page.waitForFunction(() => {
    const content = document.getElementById('fc-content');
    return content && !content.textContent.includes('Carregando documentos persistidos...');
  });
  const content = await page.locator('#page-file-center').innerText();
  const cards = await page.locator('#fc-content article').count();
  const emptyState = content.includes('Nenhum documento registrado.');
  if (!emptyState && cards === 0) throw new Error('Nenhum documento persistido ou estado vazio profissional foi exibido.');
  await page.locator('#fc-btn-list').click();
  await page.locator('#fc-btn-grid').click();
  if (cards > 0) {
    await page.locator('#fc-content article').first().dblclick();
    await page.locator('#page-file-viewer').waitFor({ state: 'visible' });
  }
  return emptyState ? 'estado vazio profissional validado' : `${cards} documentos persistidos disponíveis`;
});

await check('Automation Studio exibe dados persistidos ou estado vazio profissional', async () => {
  await openModule(page, 'automation', '#module-automation');
  await page.waitForFunction(() => {
    const container = document.getElementById('automation-list-container');
    return container && !container.textContent.includes('Carregando automações...');
  });
  const listText = await page.locator('#automation-list-container').innerText();
  const controls = await page.locator('#automation-list-container [onclick*="automationExecute"], #automation-list-container [onclick*="automationToggle"]').count();
  const emptyState = listText.includes('Nenhuma automacao criada');
  if (!emptyState && controls === 0) throw new Error('Nenhum dado persistido ou estado vazio profissional foi exibido.');
  for (const tab of ['list', 'logs', 'types']) {
    await page.locator(`#auto-tab-${tab}`).click();
    await page.waitForFunction((targetTab) => document.getElementById(`auto-tab-content-${targetTab}`)?.style.display !== 'none', tab);
  }
  return emptyState ? 'estado vazio profissional validado' : `${controls} controles de automações persistidas`;
});

await check('Analytics Center alterna cinco dashboards executivos', async () => {
  await openModule(page, 'analytics', '#module-analytics');
  const tabs = await page.locator('#page-analytics .dv11-tab').count();
  if (tabs !== 5) throw new Error(`${tabs} dashboards encontrados; esperado 5.`);
  for (const tab of ['habits', 'finance', 'goals', 'summary', 'productivity']) {
    await page.locator(`#page-analytics [onclick="analyticsTab('${tab}')"]`).click();
    await page.locator(`#analytics-${tab}-tab`).waitFor({ state: 'visible' });
  }
  return `${tabs} dashboards analíticos`;
});

record('Zero erros de JavaScript na regressão v11', runtimeErrors.length === 0, [...new Set(runtimeErrors)].join(' | '));
record('Zero respostas HTTP 4xx/5xx na regressão v11', failedResponses.length === 0, [...new Set(failedResponses)].join(' | '));
await page.screenshot({ path: path.join(outputDir, 'v11-final.png'), fullPage: true });
await context.close();
await browser.close();
await writeFile(path.join(outputDir, 'v11-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures.length, output: path.join(outputDir, 'v11-report.json') }, null, 2));
if (report.failures.length) process.exitCode = 1;
