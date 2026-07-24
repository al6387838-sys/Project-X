import assert from 'node:assert/strict';
import { createSession } from '../functions/_auth.js';
import { onRequestGet, onRequestPost } from '../functions/api/photos.js';

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
    return { body: new Blob([entry.bytes]).stream(), size: entry.bytes.byteLength, httpMetadata: entry.httpMetadata, customMetadata: entry.customMetadata };
  }
  async delete(key) { this.data.delete(key); }
}

const secret = 'qa-photo-secret';
const kv = new MemoryKV();
const r2 = new MemoryR2();
const env = { LIFEOS_SESSION_SECRET: secret, LIFEOS_KV: kv, LIFEOS_R2: r2 };
const userId = 'photos@lifeos.test';
const token = await createSession(userId, 'user', secret);

function request(path, method = 'GET', payload, form = false) {
  const headers = { cookie: `lifeos_session=${token}` };
  const init = { method, headers };
  if (payload !== undefined) {
    if (form) init.body = payload;
    else { headers['content-type'] = 'application/json'; init.body = JSON.stringify(payload); }
  }
  return new Request(`https://lifeos.local${path}`, init);
}

async function payload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return response;
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function post(path, body, form = false) {
  const response = await onRequestPost({ request: request(path, 'POST', body, form), env });
  const data = await payload(response);
  assert.equal(response.status < 400, true, `${path} falhou: ${data?.error || response.status}`);
  return data;
}

async function get(path) {
  const response = await onRequestGet({ request: request(path), env });
  const data = await payload(response);
  assert.equal(response.status < 400, true, `${path} falhou: ${data?.error || response.status}`);
  return data;
}

const empty = await get('/api/photos?view=list');
assert.deepEqual(empty.photos, []);

const album = await post('/api/photos', { action: 'create-album', name: 'Viagens', description: 'Fotos de viagem' });
assert.equal(album.album.name, 'Viagens');

const form = new FormData();
form.append('file', new File(['imagem de teste'], 'praia.jpg', { type: 'image/jpeg' }));
form.append('albumId', album.album.id);
form.append('tags', 'viagem, praia');
const uploaded = await post('/api/photos', form, true);
const photoId = uploaded.photo.id;
assert.equal(r2.data.size, 1);

const list = await get('/api/photos?view=list');
assert.equal(list.total, 1);
assert.equal(list.photos[0].albumId, album.album.id);
assert.match(list.photos[0].url, /view=content/);
assert.match(list.photos[0].thumbnailUrl, /view=thumbnail/);
const search = await get('/api/photos?view=search&q=praia');
assert.equal(search.total, 1);
const blockedForm = new FormData();
blockedForm.append('file', new File(['<svg></svg>'], 'malicioso.svg', { type: 'image/svg+xml' }));
const blockedResponse = await onRequestPost({ request: request('/api/photos', 'POST', blockedForm, true), env });
assert.equal(blockedResponse.status, 400);

const contentResponse = await onRequestGet({ request: request(`/api/photos?view=content&photoId=${photoId}`), env });
assert.equal(contentResponse.status, 200);
assert.equal(await contentResponse.text(), 'imagem de teste');
const thumbnailResponse = await onRequestGet({ request: request(`/api/photos?view=thumbnail&photoId=${photoId}`), env });
assert.equal(thumbnailResponse.status, 200);
assert.equal(await thumbnailResponse.text(), 'imagem de teste');

const updated = await post('/api/photos', { action: 'update-photo', photoId, name: 'Praia ao pôr do sol', description: 'Atualizada', tags: ['viagem', 'sol'] });
assert.equal(updated.photo.name, 'Praia ao pôr do sol');
assert.equal(updated.photo.tags.length, 2);

const favorited = await post('/api/photos', { action: 'toggle-favorite', photoId });
assert.equal(favorited.favorite, true);
await post('/api/photos', { action: 'move-to-album', photoId, albumId: null });
await post('/api/photos', { action: 'delete-album', albumId: album.album.id });
const afterAlbumDelete = await get('/api/photos?view=list');
assert.equal(afterAlbumDelete.photos[0].albumId, null);

const stats = await get('/api/photos?view=stats');
assert.equal(stats.stats.totalPhotos, 1);
assert.equal(stats.stats.favoriteCount, 1);
await post('/api/photos', { action: 'delete-photo', photoId });
const afterDelete = await get('/api/photos?view=list');
assert.equal(afterDelete.total, 0);
assert.equal(r2.data.size, 0);

console.log('QA Photo Workflows: PASS');
