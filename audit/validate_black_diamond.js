const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = 'http://localhost:4173';
const outputDir = path.join(__dirname, 'screenshots', 'after');
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const results = [];

async function inspect(page, surface, viewportName, screenshotName) {
  await page.waitForTimeout(650);
  const metrics = await page.evaluate(() => ({
    title: document.title,
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    bodyTextLength: (document.body.innerText || '').trim().length,
    activeSection: document.querySelector('.section.active')?.id || document.querySelector('.settings-panel.active')?.id || null,
    buttonsWithoutName: [...document.querySelectorAll('button')].filter((el) => !(el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText.trim())).length,
    imagesWithoutAlt: [...document.querySelectorAll('img')].filter((el) => !el.hasAttribute('alt')).length,
    blackDiamondLoaded: [...document.styleSheets].some((sheet) => String(sheet.href || '').includes('black_diamond.css')),
  }));
  const screenshotPath = path.join(outputDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  results.push({ surface, viewport: viewportName, screenshot: screenshotPath, ...metrics });
}

async function openWithErrors(browser, viewport, relativeUrl) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: 'dark' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  await page.goto(`${base}${relativeUrl}`, { waitUntil: 'networkidle' });
  return { context, page, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    const { context, page, errors } = await openWithErrors(browser, viewport, '/premium_ui/index.html');
    const demo = page.getByRole('button', { name: 'Explorar Demo' });
    if (await demo.count()) await demo.click();
    await page.waitForSelector('#app-shell', { state: 'visible' });
    await page.waitForTimeout(4300);
    await inspect(page, 'Dashboard', viewport.name, `dashboard-${viewport.name}.png`);

    if (viewport.name === 'desktop') {
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
          await inspect(page, label, viewport.name, `${slug}-${viewport.name}.png`);
        }
      }
    }
    results.push({ surface: 'Main console', viewport: viewport.name, errors });
    await context.close();
  }

  const independent = [
    ['Memory Center', '/premium_ui/memory_center.html', 'memory-center'],
    ['Admin Dashboard', '/premium_ui/beta/admin-dashboard.html', 'admin-dashboard'],
    ['Enterprise Command Center', '/premium_ui/enterprise/enterprise_premium.html', 'enterprise-command-center'],
    ['Marketplace', '/ecosystem/marketplace/marketplace.html', 'marketplace'],
  ];

  for (const viewport of viewports) {
    for (const [surface, url, slug] of independent) {
      const { context, page, errors } = await openWithErrors(browser, viewport, url);
      await inspect(page, surface, viewport.name, `${slug}-${viewport.name}.png`);
      results.push({ surface: `${surface} console`, viewport: viewport.name, errors });
      await context.close();
    }
  }

  await browser.close();
  const reportPath = path.join(__dirname, 'black_diamond_validation.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  const failures = results.filter((item) => item.overflowX || (item.errors && item.errors.length) || item.blackDiamondLoaded === false || item.bodyTextLength === 0);
  console.log(JSON.stringify({ totalChecks: results.length, failures: failures.length, failureDetails: failures }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
})();
