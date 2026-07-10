const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:4173/premium_ui/index.html', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Explorar Demo' }).click();
  await page.waitForSelector('#app-shell', { state: 'visible' });
  await page.waitForTimeout(1200);
  const result = await page.evaluate(() => [...document.querySelectorAll('.sidebar-item')].map(el => ({
    text: el.innerText.trim(),
    className: el.className,
    inlineStyle: el.getAttribute('style'),
    background: getComputedStyle(el).background,
    backgroundColor: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
    transition: getComputedStyle(el).transition,
  })));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
