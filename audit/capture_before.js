const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = 'http://localhost:4174';
const outputDir = path.join(__dirname, 'screenshots', 'before');
fs.mkdirSync(outputDir, { recursive: true });

async function capture(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outputDir, `${name}-desktop.png`), fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${base}/premium_ui/index.html`, { waitUntil: 'networkidle' });
  const demo = page.getByRole('button', { name: 'Explorar Demo' });
  if (await demo.count()) await demo.click();
  await page.waitForSelector('#app-shell', { state: 'visible' });
  await page.waitForTimeout(4300);
  await capture(page, 'dashboard');

  const navItems = [
    ['Companion', 'companion'],
    ['Missões', 'missions'],
    ['Timeline', 'timeline'],
    ['Life Graph', 'life-graph'],
    ['Briefing', 'briefing'],
    ['Métricas', 'analytics'],
    ['Configurações', 'settings'],
  ];
  for (const [label, slug] of navItems) {
    const item = page.getByRole('button', { name: new RegExp(`^${label}`) }).first();
    if (await item.count()) {
      await item.click();
      await capture(page, slug);
    }
  }
  await context.close();

  const independent = [
    ['/premium_ui/memory_center.html', 'memory-center'],
    ['/premium_ui/beta/admin-dashboard.html', 'admin-dashboard'],
    ['/premium_ui/enterprise/enterprise_premium.html', 'enterprise-command-center'],
    ['/ecosystem/marketplace/marketplace.html', 'marketplace'],
  ];
  for (const [url, slug] of independent) {
    const surfaceContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    const surface = await surfaceContext.newPage();
    surface.on('pageerror', error => errors.push(`${slug}: ${error.message}`));
    surface.on('console', msg => { if (msg.type() === 'error') errors.push(`${slug}: ${msg.text()}`); });
    await surface.goto(`${base}${url}`, { waitUntil: 'networkidle' });
    await capture(surface, slug);
    await surfaceContext.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'before_capture_report.json'), JSON.stringify({ captures: 12, errors }, null, 2));
  console.log(JSON.stringify({ captures: 12, errors }, null, 2));
  process.exitCode = errors.length ? 1 : 0;
})();
