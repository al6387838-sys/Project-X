// LifeOS Enterprise v43.0 — QA de workflows documentais.
import assert from 'node:assert/strict';
import { createSession } from '../functions/_auth.js';
import { onRequestGet, onRequestPost } from '../functions/api/documents.js';

class MemoryKV {
  constructor() { this.data = new Map(); }
  async get(key) { return this.data.has(key) ? this.data.get(key) : null; }
  async put(key, value) { this.data.set(key, String(value)); }
  async delete(key) { this.data.delete(key); }
}

class MemoryR2 {
  constructor() { this.data = new Map(); }
  async put(key, body, options = {}) {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    this.data.set(key, { bytes, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {} });
  }
  async get(key) {
    const entry = this.data.get(key);
    if (!entry) return null;
    return {
      body: new Blob([entry.bytes]).stream(),
      size: entry.bytes.byteLength,
      httpMetadata: entry.httpMetadata,
      customMetadata: entry.customMetadata,
    };
  }
  async delete(key) { this.data.delete(key); }
}

const secret = 'qa-document-secret-v43';
const kv = new MemoryKV();
const r2 = new MemoryR2();
const env = { LIFEOS_SESSION_SECRET: secret, LIFEOS_KV: kv, LIFEOS_R2: r2 };
const owner = 'owner@lifeos.test';
const recipient = 'recipient@lifeos.test';
const ownerToken = await createSession(owner, 'user', secret);
const recipientToken = await createSession(recipient, 'user', secret);

function request(path, method = 'GET', payload, token = ownerToken, form = false) {
  const headers = { cookie: `lifeos_session=${token}` };
  const init = { method, headers };
  if (payload !== undefined) {
    if (form) init.body = payload;
    else { headers['content-type'] = 'application/json'; init.body = JSON.stringify(payload); }
  }
  return new Request(`https://lifeos.local${path}`, init);
}

async function payload(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function post(path, body, token = ownerToken, form = false) {
  const response = await onRequestPost({ request: request(path, 'POST', body, token, form), env });
  const data = await payload(response);
  assert.equal(response.status < 400, true, `${path} falhou: ${typeof data === 'string' ? data : data.error}`);
  return data;
}

async function get(path, token = ownerToken) {
  const response = await onRequestGet({ request: request(path, 'GET', undefined, token), env });
  const data = await payload(response);
  assert.equal(response.status < 400, true, `${path} falhou: ${typeof data === 'string' ? data : data.error}`);
  return data;
}

const empty = await get('/api/documents?view=list');
assert.deepEqual(empty.documents, []);

const created = await post('/api/documents', { action: 'create', name: 'Plano v43', description: 'Documento inicial' });
assert.equal(created.ok, true);
const firstId = created.document.id;
assert.equal(r2.data.size, 1);

const uploadedForm = new FormData();
uploadedForm.append('file', new File(['conteúdo confidencial v43'], 'relatorio.txt', { type: 'text/plain' }));
uploadedForm.append('description', 'Relatório de validação');
const uploaded = await post('/api/documents', uploadedForm, ownerToken, true);
assert.equal(uploaded.ok, true);
const uploadedId = uploaded.document.id;
assert.equal(r2.data.size, 2);

await post('/api/documents', { action: 'rename', docId: uploadedId, name: 'Relatório Final.txt' });
await post('/api/documents', { action: 'move', docId: uploadedId, folderId: 'financeiro' });
const favorited = await post('/api/documents', { action: 'toggle-favorite', docId: uploadedId });
assert.equal(favorited.favorite, true);

const rootDocs = await get('/api/documents?view=list');
assert.equal(rootDocs.documents.length, 1);
const financeDocs = await get('/api/documents?view=list&folderId=financeiro');
assert.equal(financeDocs.documents.length, 1);
assert.equal(financeDocs.documents[0].name, 'Relatório Final.txt');

const secondVersion = new FormData();
secondVersion.append('action', 'new-version');
secondVersion.append('docId', uploadedId);
secondVersion.append('file', new File(['conteúdo revisado v43'], 'relatorio-revisado.txt', { type: 'text/plain' }));
secondVersion.append('comment', 'Revisão operacional');
const versioned = await post('/api/documents', secondVersion, ownerToken, true);
assert.equal(versioned.document.version, 2);
assert.equal(r2.data.size, 3);

const versions = await get(`/api/documents?view=versions&docId=${uploadedId}`);
assert.equal(versions.versions.length, 2);

const download = await get(`/api/documents?view=download&docId=${uploadedId}`);
assert.match(download.downloadUrl, /view=content/);
const contentResponse = await onRequestGet({ request: request(`/api/documents?view=content&docId=${uploadedId}`), env });
assert.equal(contentResponse.status, 200);
assert.equal(await contentResponse.text(), 'conteúdo revisado v43');

await post('/api/documents', { action: 'share', docId: uploadedId, targetUserId: recipient, permission: 'edit' });
const shared = await get('/api/documents?view=shared', recipientToken);
assert.equal(shared.shared.length, 1);
assert.equal(shared.shared[0].permission, 'edit');
const recipientNotifications = JSON.parse(await kv.get(`notifications:${recipient}`));
assert.equal(recipientNotifications.length, 1);

await post('/api/documents', { action: 'delete', docId: uploadedId });
const trash = await get('/api/documents?view=trash');
assert.equal(trash.documents.length, 1);
await post('/api/documents', { action: 'restore', docId: uploadedId });
const restored = await get('/api/documents?view=list&folderId=financeiro');
assert.equal(restored.documents.length, 1);

const audit = await get(`/api/documents?view=history&docId=${uploadedId}`);
assert.equal(audit.audit.some((entry) => entry.action === 'shared'), true);
assert.equal(audit.audit.some((entry) => entry.action === 'restored'), true);

await post('/api/documents', { action: 'delete', docId: uploadedId });
await post('/api/documents', { action: 'permanent-delete', docId: uploadedId });
const afterDelete = await get('/api/documents?view=all');
assert.equal(afterDelete.documents.some((document) => document.id === uploadedId), false);
assert.equal(r2.data.size, 1);

const stats = await get('/api/documents?view=stats');
assert.equal(stats.stats.total, 1);
assert.equal(stats.stats.r2Bound, true);
assert.equal(firstId.length > 0, true);

console.log('QA Document Workflows v43.0: PASS');
console.log('  fluxos: criação, upload, download, mover, renomear, compartilhamento, favoritos, versões, lixeira, restauração, exclusão, auditoria, logs');
