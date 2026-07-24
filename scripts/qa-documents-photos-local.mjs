import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createSession } from '../functions/_auth.js';

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:8788';
const secret = process.env.LIFEOS_SESSION_SECRET || 'qa-local-session-secret';
const userId = 'qa.documents.photos@lifeos.test';
const token = await createSession(userId, 'user', secret);
await writeFile('/tmp/lifeos-qa-session-token', token, { mode: 0o600 });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'pt-BR',
});
const page = await context.newPage();
const runtimeErrors = [];
const failedResponses = [];

page.on('pageerror', error => runtimeErrors.push(error.stack || error.message));
page.on('console', message => {
  if (message.type() === 'error') runtimeErrors.push(message.text());
});
page.on('response', response => {
  const url = response.url();
  if (response.status() >= 400 && url.startsWith(baseURL)) failedResponses.push(`${response.status()} ${url}`);
});

try {
  await context.addCookies([{
    name: 'lifeos_session',
    value: token,
    url: baseURL,
    httpOnly: true,
    sameSite: 'Strict',
  }]);

  const appResponse = await page.goto(`${baseURL}/app`, { waitUntil: 'networkidle' });
  console.log(JSON.stringify({
    appStatus: appResponse?.status() || null,
    url: page.url(),
    title: await page.title(),
    photosNavCount: await page.locator('.nav-item[data-page="photos"]').count(),
    loginFormCount: await page.locator('form').count(),
  }));
  const moduleProbe = await page.evaluate(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('probe-timeout'), 5_000);
    try {
      const response = await fetch('/app/modules/photos', { credentials: 'same-origin', signal: controller.signal });
      const text = await response.text();
      return { ok: response.ok, status: response.status, redirected: response.redirected, url: response.url, bytes: text.length };
    } catch (error) {
      return { error: String(error?.message || error) };
    } finally {
      clearTimeout(timer);
    }
  });
  console.log(JSON.stringify({ moduleProbe }));
  assert.equal(moduleProbe.ok, true, `A rota do módulo Fotos falhou: ${JSON.stringify(moduleProbe)}`);
  await page.locator('.nav-item[data-page="photos"]').click();
  try {
    await page.locator('#page-photos.active').waitFor({ state: 'visible', timeout: 10_000 });
  } catch (error) {
    await page.screenshot({ path: 'qa-artifacts/documents-photos-navigation-failure.png', fullPage: true });
    console.log(JSON.stringify({
      navigationTrace: await page.evaluate(() => window.__navigationTrace || []),
      visiblePages: await page.locator('.page.active').evaluateAll(nodes => nodes.map(node => node.id)),
      bodyText: (await page.locator('body').innerText()).slice(0, 2000),
    }));
    throw error;
  }
  await page.waitForFunction(() => typeof window.photosOpenUpload === 'function');
  assert.equal(await page.locator('#module-photos').count(), 1, 'Módulo Fotos não foi montado.');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.nav-item[data-page="photos"]').click();
  await page.locator('#page-photos.active').waitFor({ state: 'visible', timeout: 10_000 });
  assert.equal(await page.locator('#photos-gallery').count(), 1, 'Galeria de Fotos não foi restaurada após refresh.');

  await page.locator('.nav-item[data-page="documents"]').click();
  await page.locator('#page-documents.active').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForFunction(() => typeof window.docsUpload === 'function' && typeof window.docsCreateFolder === 'function');
  assert.equal(await page.locator('#module-documents').count(), 1, 'Módulo Documentos não foi montado.');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.nav-item[data-page="documents"]').click();
  await page.locator('#page-documents.active').waitFor({ state: 'visible', timeout: 10_000 });
  assert.equal(await page.locator('#docs-grid').count(), 1, 'Grade de Documentos não foi restaurada após refresh.');
  const folderCard = page.locator('.doc-folder-card').first();
  if (await folderCard.count()) {
    await folderCard.click();
    await page.locator('.doc-file-card').first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('.doc-file-card').first().click();
    await page.locator('#page-document-viewer.active').waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await page.getByRole('button', { name: 'Nova versão' }).count(), 1, 'Ação de nova versão não está disponível no visualizador.');
    assert.equal(await page.getByRole('button', { name: 'Copiar' }).count(), 1, 'Ação de cópia não está disponível no visualizador.');
  }

  if (runtimeErrors.length) {
    console.log(JSON.stringify({ runtimeErrors, activePages: await page.locator('.page.active').evaluateAll(nodes => nodes.map(node => node.id)) }));
  }
  assert.deepEqual(runtimeErrors, [], `Erros de JavaScript: ${runtimeErrors.join(' | ')}`);
  assert.deepEqual(failedResponses, [], `Respostas HTTP com erro: ${failedResponses.join(' | ')}`);
  console.log('QA Documents + Photos Local: PASS');
} finally {
  await context.close();
  await browser.close();
}
