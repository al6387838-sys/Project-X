import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createSession } from '../functions/_auth.js';

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:8788';
const secret = process.env.LIFEOS_SESSION_SECRET || 'qa-local-session-secret';
const userId = `crud.ui.${Date.now()}@lifeos.test`;
const token = await createSession(userId, 'user', secret);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
const page = await context.newPage();
const runtimeErrors = [];
const failedResponses = [];

page.on('pageerror', error => runtimeErrors.push(error.stack || error.message));
page.on('console', message => {
  if (message.type() === 'error') runtimeErrors.push(message.text());
});
page.on('response', response => {
  if (response.status() >= 400 && response.url().startsWith(baseURL)) failedResponses.push(`${response.status()} ${response.url()}`);
});

async function waitForApiPost(path, trigger) {
  let responseError = null;
  const responsePromise = page.waitForResponse(response => response.url().includes(path) && response.request().method() === 'POST', { timeout: 10_000 })
    .catch(error => { responseError = error; return null; });
  await trigger();
  const response = await responsePromise;
  if (!response) {
    console.log(JSON.stringify({
      apiTimeoutPath: path,
      url: page.url(),
      activePages: await page.locator('.page.active').evaluateAll(nodes => nodes.map(node => node.id)),
      visibleModals: await page.locator('.modal').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').map(node => node.id)),
      albumForm: await page.locator('#photos-album-form').count() ? await page.locator('#photos-album-form').innerText() : null,
      runtimeErrors,
    }));
    throw responseError;
  }
  const data = await response.json().catch(() => ({}));
  assert.equal(response.ok(), true, `${path} retornou ${response.status()}: ${data.error || ''}`);
  assert.equal(data.ok, true, `${path} não confirmou sucesso: ${data.error || ''}`);
  return data;
}

async function chooseFile(trigger, file) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), trigger()]);
  await chooser.setFiles(file);
}

try {
  await context.addCookies([{ name: 'lifeos_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Strict' }]);
  await page.goto(`${baseURL}/app`, { waitUntil: 'networkidle' });

  await page.locator('.nav-item[data-page="documents"]').click();
  await page.locator('#page-documents.active').waitFor({ state: 'visible', timeout: 10_000 });

  page.once('dialog', dialog => dialog.accept('Pasta UI QA'));
  const folder = await waitForApiPost('/api/documents', () => page.getByRole('button', { name: 'Nova Pasta' }).click());
  assert.equal(folder.folder.name, 'Pasta UI QA');

  const documentUploadPromise = page.waitForResponse(response => response.url().includes('/api/documents') && response.request().method() === 'POST');
  await chooseFile(() => page.getByRole('button', { name: 'Upload' }).click(), {
    name: 'interface.txt', mimeType: 'text/plain', buffer: Buffer.from('conteúdo inicial da interface'),
  });
  const documentUploadResponse = await documentUploadPromise;
  const documentUpload = await documentUploadResponse.json();
  assert.equal(documentUpload.ok, true, documentUpload.error || 'Upload de documento falhou.');
  await page.locator('.doc-file-card').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('.doc-file-card').first().click();
  await page.locator('#page-document-viewer.active').waitFor({ state: 'visible', timeout: 10_000 });

  const versionResponsePromise = page.waitForResponse(response => response.url().includes('/api/documents') && response.request().method() === 'POST');
  await chooseFile(() => page.getByRole('button', { name: 'Nova versão' }).click(), {
    name: 'interface-v2.txt', mimeType: 'text/plain', buffer: Buffer.from('conteúdo revisado da interface'),
  });
  const versionResponse = await versionResponsePromise;
  const versionData = await versionResponse.json();
  assert.equal(versionData.ok, true, versionData.error || 'Nova versão falhou.');
  assert.equal(versionData.document.version, 2);

  page.once('dialog', dialog => dialog.accept('interface-renomeado.txt'));
  const renamed = await waitForApiPost('/api/documents', () => page.getByRole('button', { name: 'Renomear' }).click());
  assert.equal(renamed.document.name, 'interface-renomeado.txt');

  const copied = await waitForApiPost('/api/documents', () => page.getByRole('button', { name: 'Copiar' }).click());
  assert.notEqual(copied.document.id, versionData.document.id);

  const shareDialogs = [userId.replace('crud.ui', 'recipient.ui'), true];
  const shareHandler = dialog => {
    const answer = shareDialogs.shift();
    if (dialog.type() === 'prompt') dialog.accept(String(answer));
    else dialog.accept();
  };
  page.on('dialog', shareHandler);
  const shared = await waitForApiPost('/api/documents', () => page.getByRole('button', { name: 'Compartilhar' }).click());
  page.off('dialog', shareHandler);
  assert.equal(shared.shared, true);

  await page.locator('.nav-item[data-page="photos"]').click();
  await page.locator('#page-photos.active').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Álbuns' }).click();
  await page.locator('#page-photos-albums').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Novo Álbum' }).click();
  await page.locator('#photos-album-name').fill('Álbum UI QA');
  const album = await waitForApiPost('/api/photos', () => page.getByRole('button', { name: 'Criar Álbum' }).click());
  assert.equal(album.album.name, 'Álbum UI QA');

  await page.getByRole('button', { name: 'Galeria' }).click();
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.locator('#photos-upload-album').selectOption(album.album.id);
  const photoUploadPromise = page.waitForResponse(response => response.url().includes('/api/photos') && response.request().method() === 'POST');
  await page.locator('#photos-upload-files').setInputFiles({
    name: 'interface.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('imagem simulada para teste de interface'),
  });
  await page.getByRole('button', { name: 'Upload', exact: true }).last().click();
  const photoUploadResponse = await photoUploadPromise;
  const photoUpload = await photoUploadResponse.json();
  assert.equal(photoUpload.ok, true, photoUpload.error || 'Upload de foto falhou.');
  await page.locator('.photo-thumb').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('.photo-thumb').first().click();
  await page.locator('#modal-photo-viewer').waitFor({ state: 'visible', timeout: 10_000 });

  const editDialogs = ['foto-editada.jpg', 'Descrição editada', 'interface, qa'];
  const editHandler = dialog => dialog.accept(editDialogs.shift());
  page.on('dialog', editHandler);
  const edited = await waitForApiPost('/api/photos', () => page.getByTitle('Editar').click());
  page.off('dialog', editHandler);
  assert.equal(edited.photo.name, 'foto-editada.jpg');

  page.once('dialog', dialog => dialog.accept('1'));
  const moved = await waitForApiPost('/api/photos', () => page.getByTitle('Mover para álbum').click());
  assert.equal(moved.ok, true);

  page.once('dialog', dialog => dialog.accept());
  const deleted = await waitForApiPost('/api/photos', () => page.locator('#modal-photo-viewer [title="Excluir"]').click());
  assert.equal(deleted.ok, true);

  assert.deepEqual(runtimeErrors, [], `Erros JavaScript: ${runtimeErrors.join(' | ')}`);
  assert.deepEqual(failedResponses, [], `Respostas HTTP com erro: ${failedResponses.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, userId, document: { uploaded: true, versioned: true, renamed: true, copied: true, shared: true }, photos: { album: true, uploaded: true, edited: true, moved: true, deleted: true } }));
} finally {
  await context.close();
  await browser.close();
}
