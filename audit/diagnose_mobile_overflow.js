const { chromium } = require('playwright');

const cases = [
  ['Memory Center', 'http://localhost:4173/premium_ui/memory_center.html'],
  ['Marketplace', 'http://localhost:4173/ecosystem/marketplace/marketplace.html'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [name, url] of cases) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    const offenders = await page.evaluate(() => [...document.querySelectorAll('body *')]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id,
          className: typeof el.className === 'string' ? el.className : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          display: style.display,
          position: style.position,
          whiteSpace: style.whiteSpace,
          minWidth: style.minWidth,
        };
      })
      .filter((item) => item.display !== 'none' && (item.right > document.documentElement.clientWidth + 2 || item.left < -2))
      .sort((a, b) => b.right - a.right)
      .slice(0, 30));
    console.log(`\n--- ${name} ---`);
    console.log(JSON.stringify({ viewport: 390, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), offenders }, null, 2));
    await page.close();
  }
  await browser.close();
})();
