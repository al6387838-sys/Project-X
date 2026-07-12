import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.QA_BASE_URL || 'http://localhost:8888';
const outputDir = path.resolve('qa-artifacts');
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'laptop', width: 1024, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const views = ['command', 'members', 'billing', 'compliance', 'admin'];

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

await mkdir(outputDir, { recursive: true });
const env = findPreviewEnvironment();
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const report = { baseURL, generatedAt: new Date().toISOString(), results: [] };

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, locale: 'pt-BR', colorScheme: 'dark' });
  await context.addCookies([
    {
      name: 'lifeos_admin_session',
      value: createSession(env.LIFEOS_ADMIN_USER, env.LIFEOS_SESSION_SECRET),
      url: baseURL,
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  const page = await context.newPage();
  const runtimeErrors = [];
  const failedResponses = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${baseURL}/enterprise#command`, { waitUntil: 'networkidle' });
  await page.locator('#enterprise-command').waitFor({ state: 'visible' });
  for (const view of views) {
    if (view !== 'command') {
      await page.evaluate((targetView) => document.querySelector(`[data-view="${targetView}"]`)?.click(), view);
      await page.locator('#enterprise-dynamic').waitFor({ state: 'visible' });
      await page.waitForFunction((targetView) => location.hash === `#${targetView}`, view);
    } else {
      await page.evaluate(() => document.querySelector('[data-view="command"]')?.click());
      await page.locator('#enterprise-command').waitFor({ state: 'visible' });
    }
    const audit = await page.evaluate(() => {
      const root = document.documentElement;
      const unlabeled = [...document.querySelectorAll('button, input, select, textarea, a[href]')]
        .filter((element) => {
          if (element.matches('[aria-hidden="true"], [disabled], [type="hidden"]')) return false;
          const text = element.textContent?.trim();
          const label = element.getAttribute('aria-label') || element.getAttribute('title');
          const id = element.getAttribute('id');
          const explicitLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
          return !text && !label && !explicitLabel;
        })
        .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}.${element.className || ''}`);
      const imagesWithoutAlt = [...document.querySelectorAll('img:not([alt])')].length;
      return {
        viewport: { width: innerWidth, height: innerHeight },
        horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        unlabeled,
        imagesWithoutAlt,
        title: document.title,
        heading: document.querySelector('.enterprise-shell-panel.active h2, .enterprise-shell-panel.active .section-title')?.textContent?.trim() || '',
      };
    });
    const screenshot = path.join(outputDir, `${viewport.name}-${view}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    report.results.push({ viewport: viewport.name, view, screenshot, ...audit });
  }

  report.results.push({ viewport: viewport.name, runtimeErrors: [...new Set(runtimeErrors)], failedResponses: [...new Set(failedResponses)] });
  await context.close();
}

await browser.close();
await writeFile(path.join(outputDir, 'responsive-report.json'), JSON.stringify(report, null, 2));

const failures = report.results.filter((item) =>
  item.horizontalOverflow || item.imagesWithoutAlt > 0 || item.unlabeled?.length || item.runtimeErrors?.length || item.failedResponses?.length,
);
console.log(JSON.stringify({ checks: report.results.length, failures: failures.length, output: path.join(outputDir, 'responsive-report.json') }, null, 2));
if (failures.length) process.exitCode = 1;
