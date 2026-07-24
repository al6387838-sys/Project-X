// LifeOS Enterprise — Photos API
// Cloudflare Pages Function: GET/POST /api/photos
// Persistência: Cloudflare KV (metadados) + R2 (imagens binárias)

import { getCookie, json, verifySession } from '../_auth.js';

async function lifeosLogError(env, operation, error, details = {}) {
  try {
    if (!env?.LIFEOS_KV) return;
    const raw = await env.LIFEOS_KV.get('error-logs');
    let previous = [];
    try { previous = raw ? JSON.parse(raw) : []; } catch { previous = []; }
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      error: error?.message || String(error),
      ...details,
    };
    await env.LIFEOS_KV.put('error-logs', JSON.stringify([logEntry, ...previous].slice(0, 100)));
  } catch { /* O registro não deve interromper a operação principal. */ }
}

const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB per photo
const ALLOWED_PHOTO_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic', 'image/heif',
]);
const BLOCKED_PHOTO_EXTENSIONS = new Set(['svg']); // SVGs can contain scripts

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function now() {
  return new Date().toISOString();
}

function safeText(value, max = 240) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max);
}

function safePhotoName(value) {
  const name = safeText(value || 'foto', 180)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '');
  return name || 'foto';
}

function validatePhotoUpload(file) {
  const mime = String(file.type || '').split(';')[0].trim().toLowerCase();
  const extension = safePhotoName(file.name).split('.').pop().toLowerCase();
  if (!ALLOWED_PHOTO_MIMES.has(mime)) throw new Error(`Tipo de imagem não suportado: ${mime}`);
  if (BLOCKED_PHOTO_EXTENSIONS.has(extension)) throw new Error(`Extensão de imagem não permitida: .${extension}`);
  return mime;
}

function photoKey(userId, photoId, name) {
  return `photos/${encodeURIComponent(userId)}/${photoId}/${name}`;
}

function photoUrl(request, photoId) {
  const url = new URL(request.url);
  return `${url.origin}/api/photos?view=content&photoId=${encodeURIComponent(photoId)}`;
}

function thumbnailUrl(request, photoId) {
  const url = new URL(request.url);
  return `${url.origin}/api/photos?view=thumbnail&photoId=${encodeURIComponent(photoId)}`;
}

async function readJson(kv, key, fallback) {
  try {
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

function photoPayload(request, photo) {
  return {
    ...photo,
    url: photo.url || photoUrl(request, photo.id),
    thumbnailUrl: photo.thumbnailUrl || thumbnailUrl(request, photo.id),
  };
}

// ─── GET /api/photos ───
export async function onRequestGet({ request, env }) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const token = getCookie(cookieHeader);
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET)
      : null;
    if (!session) return json(401, { ok: false, error: 'Sessão expirada' });
    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento de metadados indisponível' });

    const url = new URL(request.url);
    const view = safeText(url.searchParams.get('view'), 40) || 'list';
    const albumId = safeText(url.searchParams.get('albumId'), 120);
    const query = safeText(url.searchParams.get('q'), 120).toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    // ─── LIST / SEARCH ───
    if (view === 'list' || view === 'search') {
      if (view === 'search' && !query) return json(400, { ok: false, error: 'Parâmetro q obrigatório' });
      const photos = await getPhotos(env.LIFEOS_KV, session.sub);
      const filtered = photos.filter((photo) => {
        if (photo.deleted) return false;
        if (albumId && photo.albumId !== albumId) return false;
        if (!query) return true;
        return [photo.name, photo.description, photo.location, ...(photo.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
      const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const page = sorted.slice(offset, offset + limit);
      return json(200, {
        ok: true,
        photos: page.map(p => photoPayload(request, p)),
        total: sorted.length,
        offset,
        limit,
        query: query || undefined,
      });
    }

    // ─── ALBUMS ───
    if (view === 'albums') {
      const albums = await getAlbums(env.LIFEOS_KV, session.sub);
      const photos = await getPhotos(env.LIFEOS_KV, session.sub);
      const albumList = albums.map(a => ({
        ...a,
        photoCount: photos.filter(p => p.albumId === a.id && !p.deleted).length,
      }));
      return json(200, { ok: true, albums: albumList });
    }

    // ─── CONTENT (binary download) ───
    if (view === 'content') {
      const photoId = safeText(url.searchParams.get('photoId'), 80);
      const photos = await getPhotos(env.LIFEOS_KV, session.sub);
      const photo = photos.find(p => p.id === photoId);
      if (!photo || photo.deleted) return json(404, { ok: false, error: 'Foto não encontrada' });

      const bucket = resolveBucket(env);
      if (!photo.storageKey || !bucket) return json(503, { ok: false, error: 'Armazenamento não disponível' });

      const object = await bucket.get(photo.storageKey);
      if (!object) return json(404, { ok: false, error: 'Imagem não encontrada no R2' });

      const headers = new Headers();
      headers.set('content-type', photo.mimeType || 'image/jpeg');
      headers.set('cache-control', 'private, no-store');
      headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(photo.name)}`);
      if (object.size !== undefined) headers.set('content-length', String(object.size));
      return new Response(object.body, { status: 200, headers });
    }

    // ─── THUMBNAIL (serve same as content, browser will scale) ───
    if (view === 'thumbnail') {
      const photoId = safeText(url.searchParams.get('photoId'), 80);
      const photos = await getPhotos(env.LIFEOS_KV, session.sub);
      const photo = photos.find(p => p.id === photoId);
      if (!photo || photo.deleted) return json(404, { ok: false, error: 'Foto não encontrada' });

      const bucket = resolveBucket(env);
      if (!photo.storageKey || !bucket) return json(503, { ok: false, error: 'Armazenamento não disponível' });

      const object = await bucket.get(photo.storageKey);
      if (!object) return json(404, { ok: false, error: 'Imagem não encontrada no R2' });

      const headers = new Headers();
      headers.set('content-type', photo.mimeType || 'image/jpeg');
      headers.set('cache-control', 'private, no-store');
      return new Response(object.body, { status: 200, headers });
    }

    // ─── STATS ───
    if (view === 'stats') {
      const photos = await getPhotos(env.LIFEOS_KV, session.sub);
      const albums = await getAlbums(env.LIFEOS_KV, session.sub);
      const active = photos.filter(p => !p.deleted);
      const totalSize = active.reduce((sum, p) => sum + (p.size || 0), 0);
      return json(200, {
        ok: true,
        stats: {
          totalPhotos: active.length,
          totalAlbums: albums.length,
          totalSize,
          favoriteCount: active.filter(p => p.favorite).length,
        },
      });
    }

    return json(400, { ok: false, error: 'View inválida' });
  } catch (error) {
    lifeosLogError(env, 'photos.get', error);
    return json(500, { ok: false, error: error instanceof Error ? error.message : 'Erro ao carregar fotos' });
  }
}

// ─── POST /api/photos ───
export async function onRequestPost({ request, env }) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const token = getCookie(cookieHeader);
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET)
      : null;
    if (!session) return json(401, { ok: false, error: 'Sessão expirada' });
    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento de metadados indisponível' });

    const contentType = request.headers.get('content-type') || '';
    const bucket = resolveBucket(env);

    // ─── UPLOAD PHOTO ───
    if (contentType.includes('multipart/form-data')) {
      return await uploadPhoto({ request, kv: env.LIFEOS_KV, bucket, session });
    }

    // ─── JSON ACTIONS ───
    const body = await request.json().catch(() => ({}));
    const action = safeText(body.action, 40);

    if (action === 'create-album') {
      return await createAlbum({ kv: env.LIFEOS_KV, session, body });
    }
    if (action === 'update-photo') {
      return await updatePhoto({ kv: env.LIFEOS_KV, session, body });
    }
    if (action === 'delete-photo') {
      return await deletePhoto({ request, kv: env.LIFEOS_KV, bucket, session, body });
    }
    if (action === 'toggle-favorite') {
      return await toggleFavorite({ kv: env.LIFEOS_KV, session, body });
    }
    if (action === 'move-to-album') {
      return await movePhoto({ kv: env.LIFEOS_KV, session, body });
    }
    if (action === 'delete-album') {
      return await deleteAlbum({ kv: env.LIFEOS_KV, session, body });
    }

    return json(400, { ok: false, error: 'Ação inválida' });
  } catch (error) {
    lifeosLogError(env, 'photos.post', error);
    const message = error instanceof Error ? error.message : 'Erro ao processar foto';
    const status = /selecione|excede|não suportado|não permitida|obrigatório|inválid/i.test(message)
      ? 400
      : /não encontrada/i.test(message)
        ? 404
        : 500;
    return json(status, { ok: false, error: message });
  }
}

// ─── HELPERS ───

async function getPhotos(kv, userId) {
  return readJson(kv, `photos:${userId}`, []);
}

async function savePhotos(kv, userId, photos) {
  await writeJson(kv, `photos:${userId}`, photos);
}

async function getAlbums(kv, userId) {
  return readJson(kv, `albums:${userId}`, []);
}

async function saveAlbums(kv, userId, albums) {
  await writeJson(kv, `albums:${userId}`, albums);
}

function resolveBucket(env) {
  return [env.LIFEOS_R2, env.LIFEOS_FILES, env.R2_BUCKET]
    .find((candidate) => candidate && typeof candidate.get === 'function' && typeof candidate.put === 'function') || null;
}

async function uploadPhoto({ request, kv, bucket, session }) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function' || !safeText(file.name)) {
    throw new Error('Selecione uma foto válida');
  }
  if (Number(file.size || 0) > MAX_PHOTO_SIZE) {
    throw new Error('A foto excede o limite de 10 MB');
  }

  const mime = validatePhotoUpload(file);
  if (!bucket) throw new Error('Armazenamento R2 pronto para ativação.');

  const photos = await getPhotos(kv, session.sub);
  const id = generateId();
  const name = safePhotoName(file.name || 'foto');
  const storageKey = photoKey(session.sub, id, `${id}_${name}`);

  await bucket.put(storageKey, file.stream ? file.stream() : await file.arrayBuffer(), {
    httpMetadata: { contentType: mime },
    customMetadata: { ownerId: session.sub, photoId: id, name },
  });

  const timestamp = now();
  const photo = {
    id,
    name,
    size: Number(file.size || 0),
    mimeType: mime,
    albumId: safeText(form.get('albumId'), 120) || null,
    tags: safeText(form.get('tags'), 500).split(',').map(t => safeText(t, 40)).filter(Boolean).slice(0, 16),
    description: safeText(form.get('description'), 1000),
    location: safeText(form.get('location'), 300) || null,
    storageKey,
    storageUrl: null,
    favorite: false,
    deleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: session.sub,
  };

  photos.unshift(photo);
  await savePhotos(kv, session.sub, photos);
  return json(201, { ok: true, photo: photoPayload(request, photo) });
}

async function createAlbum({ kv, session, body }) {
  const albums = await getAlbums(kv, session.sub);
  const id = generateId();
  const album = {
    id,
    name: safeText(body.name, 120) || 'Sem nome',
    description: safeText(body.description, 500),
    coverPhotoId: safeText(body.coverPhotoId, 80) || null,
    createdAt: now(),
    updatedAt: now(),
  };
  albums.unshift(album);
  await saveAlbums(kv, session.sub, albums);
  return json(201, { ok: true, album });
}

async function updatePhoto({ kv, session, body }) {
  const photos = await getPhotos(kv, session.sub);
  const photo = photos.find(p => p.id === safeText(body.photoId, 80));
  if (!photo) throw new Error('Foto não encontrada');
  if (body.name !== undefined) photo.name = safeText(body.name, 180) || photo.name;
  if (body.description !== undefined) photo.description = safeText(body.description, 1000);
  if (body.tags !== undefined) photo.tags = (Array.isArray(body.tags) ? body.tags : safeText(body.tags, 500).split(',')).map(t => safeText(t, 40)).filter(Boolean).slice(0, 16);
  if (body.location !== undefined) photo.location = safeText(body.location, 300);
  if (body.albumId !== undefined) photo.albumId = safeText(body.albumId, 120) || null;
  photo.updatedAt = now();
  await savePhotos(kv, session.sub, photos);
  return json(200, { ok: true, photo });
}

async function deletePhoto({ request, kv, bucket, session, body }) {
  const photos = await getPhotos(kv, session.sub);
  const photo = photos.find(p => p.id === safeText(body.photoId, 80));
  if (!photo) throw new Error('Foto não encontrada');

  // Delete from R2
  if (bucket && photo.storageKey) {
    try { await bucket.delete(photo.storageKey); } catch { /* best effort */ }
  }

  photo.deleted = true;
  photo.updatedAt = now();
  await savePhotos(kv, session.sub, photos);
  return json(200, { ok: true });
}

async function toggleFavorite({ kv, session, body }) {
  const photos = await getPhotos(kv, session.sub);
  const photo = photos.find(p => p.id === safeText(body.photoId, 80));
  if (!photo) throw new Error('Foto não encontrada');
  photo.favorite = !photo.favorite;
  photo.updatedAt = now();
  await savePhotos(kv, session.sub, photos);
  return json(200, { ok: true, favorite: photo.favorite });
}

async function movePhoto({ kv, session, body }) {
  const photos = await getPhotos(kv, session.sub);
  const photo = photos.find(p => p.id === safeText(body.photoId, 80));
  if (!photo) throw new Error('Foto não encontrada');
  photo.albumId = safeText(body.albumId, 120) || null;
  photo.updatedAt = now();
  await savePhotos(kv, session.sub, photos);
  return json(200, { ok: true });
}

async function deleteAlbum({ kv, session, body }) {
  const albums = await getAlbums(kv, session.sub);
  const album = albums.find(a => a.id === safeText(body.albumId, 120));
  if (!album) throw new Error('Álbum não encontrado');

  // Unlink photos from album
  const photos = await getPhotos(kv, session.sub);
  photos.forEach(p => { if (p.albumId === album.id) p.albumId = null; });
  await savePhotos(kv, session.sub, photos);

  albums.splice(albums.indexOf(album), 1);
  await saveAlbums(kv, session.sub, albums);
  return json(200, { ok: true });
}

// Roteador genérico e handlers adicionais
export async function onRequestPut({ request, env }) {
  return onRequestPost({ request, env });
}
export async function onRequestPatch({ request, env }) {
  return onRequestPost({ request, env });
}
export async function onRequestDelete({ request, env }) {
  // DELETE via query param: ?action=delete&photoId=xxx
  const url = new URL(request.url);
  const photoId = url.searchParams.get('photoId') || url.searchParams.get('id');
  const albumId = url.searchParams.get('albumId');
  if (photoId || albumId) {
    const syntheticBody = JSON.stringify({
      action: photoId ? 'delete' : 'delete-album',
      photoId,
      albumId,
    });
    const syntheticRequest = new Request(request.url, {
      method: 'POST',
      headers: { ...Object.fromEntries(request.headers.entries()), 'content-type': 'application/json' },
      body: syntheticBody,
    });
    return onRequestPost({ request: syntheticRequest, env });
  }
  return onRequestPost({ request, env });
}
export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST') return onRequestPost({ request, env });
  if (method === 'PUT') return onRequestPut({ request, env });
  if (method === 'PATCH') return onRequestPatch({ request, env });
  if (method === 'DELETE') return onRequestDelete({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), { status: 405, headers: { 'content-type': 'application/json' } });
}
