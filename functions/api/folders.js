// LifeOS Enterprise — Folders API v2.0
// Cloudflare Pages Function: GET/POST/PUT/PATCH/DELETE /api/folders
// Storage: KV (LIFEOS_KV) + R2 (LIFEOS_FILES / LIFEOS_R2)
import { getCookie, json, verifySession } from '../_auth.js';

function resolveBucket(env) {
  return env.LIFEOS_FILES || env.LIFEOS_R2 || env.R2_BUCKET || null;
}

async function getFolders(kv, userId) {
  try {
    const raw = await kv.get(`folders:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveFolders(kv, userId, folders) {
  await kv.put(`folders:${userId}`, JSON.stringify(folders));
}

function safeText(value, max = 240) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max);
}

// GET /api/folders
export async function onRequestGet({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });
    const folders = await getFolders(env.LIFEOS_KV, session.sub);
    return json(200, { ok: true, folders });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// POST /api/folders
export async function onRequestPost({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const input = await request.json();
    const name = safeText(input.name || 'Nova pasta', 200);
    if (!name) return json(400, { ok: false, error: 'Nome da pasta é obrigatório' });

    const folders = await getFolders(env.LIFEOS_KV, session.sub);
    const folder = {
      id: crypto.randomUUID(),
      name,
      parentId: input.parentId || null,
      color: safeText(input.color || '#6366F1', 20),
      icon: safeText(input.icon || 'folder', 40),
      ownerId: session.sub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    folders.push(folder);
    await saveFolders(env.LIFEOS_KV, session.sub, folders);

    const bucket = resolveBucket(env);
    if (bucket) {
      try {
        await bucket.put(
          `folders/${session.sub}/${folder.id}/.folder`,
          new Uint8Array(0),
          { httpMetadata: { contentType: 'application/x-directory' }, customMetadata: { folderId: folder.id, ownerId: session.sub } }
        );
      } catch { /* R2 não crítico */ }
    }

    return json(201, { ok: true, folder });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// PUT /api/folders
export async function onRequestPut({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const input = await request.json();
    if (!input.id) return json(400, { ok: false, error: 'ID da pasta é obrigatório' });

    const folders = await getFolders(env.LIFEOS_KV, session.sub);
    const idx = folders.findIndex(f => f.id === input.id);
    if (idx === -1) return json(404, { ok: false, error: 'Pasta não encontrada' });

    if (input.name) folders[idx].name = safeText(input.name, 200);
    if (input.color) folders[idx].color = safeText(input.color, 20);
    if (input.icon) folders[idx].icon = safeText(input.icon, 40);
    if (input.parentId !== undefined) folders[idx].parentId = input.parentId;
    folders[idx].updatedAt = new Date().toISOString();

    await saveFolders(env.LIFEOS_KV, session.sub, folders);
    return json(200, { ok: true, folder: folders[idx] });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// PATCH /api/folders
export async function onRequestPatch({ request, env }) {
  return onRequestPut({ request, env });
}

// DELETE /api/folders
export async function onRequestDelete({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const url = new URL(request.url);
    let id = url.searchParams.get('id') || url.pathname.split('/').pop();
    if (!id || id === 'folders') {
      // Tentar ler do body
      try {
        const body = await request.clone().json();
        id = body.id;
      } catch { /* */ }
    }
    if (!id || id === 'folders') return json(400, { ok: false, error: 'ID da pasta é obrigatório' });

    const folders = await getFolders(env.LIFEOS_KV, session.sub);
    const filtered = folders.filter(f => f.id !== id);
    if (filtered.length === folders.length) return json(404, { ok: false, error: 'Pasta não encontrada' });

    await saveFolders(env.LIFEOS_KV, session.sub, filtered);

    const bucket = resolveBucket(env);
    if (bucket) {
      try {
        await bucket.delete(`folders/${session.sub}/${id}/.folder`);
      } catch { /* R2 não crítico */ }
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// Roteador genérico
export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST') return onRequestPost({ request, env });
  if (method === 'PUT') return onRequestPut({ request, env });
  if (method === 'PATCH') return onRequestPatch({ request, env });
  if (method === 'DELETE') return onRequestDelete({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
