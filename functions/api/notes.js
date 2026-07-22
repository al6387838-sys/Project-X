// LifeOS Enterprise — Notes/Memory Center API v1.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/notes
// Phase 200 — Real Data Migration (zero mocks)
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_STRING_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
function sanitizeInput(value) {
  if (typeof value !== 'string') return '';
  // Strip potentially dangerous HTML/JS
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .slice(0, MAX_STRING_LENGTH);
}
function validateTitle(title) {
  if (!title || typeof title !== 'string') return { valid: false, error: 'Título obrigatório' };
  const trimmed = title.trim();
  if (trimmed.length < 1) return { valid: false, error: 'Título não pode ser vazio' };
  if (trimmed.length > MAX_TITLE_LENGTH) return { valid: false, error: 'Título deve ter no máximo ' + MAX_TITLE_LENGTH + ' caracteres' };
  return { valid: true, value: trimmed };
}
function validateDescription(desc) {
  if (!desc) return { valid: true, value: '' };
  if (typeof desc !== 'string') return { valid: false, error: 'Descrição inválida' };
  const trimmed = desc.trim();
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) return { valid: false, error: 'Descrição deve ter no máximo ' + MAX_DESCRIPTION_LENGTH + ' caracteres' };
  return { valid: true, value: sanitizeInput(trimmed) };
}

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, notes: [], source: 'empty' });
  try {
    const raw = await kv.get(`notes:${session.sub}`);
    const notes = raw ? JSON.parse(raw) : [];
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase() || '';
    const category = url.searchParams.get('category') || '';
    const view = url.searchParams.get('view') || '';
    const noteId = url.searchParams.get('id') || '';
    // Histórico de versões de uma nota específica
    if (view === 'versions' && noteId) {
      const versionsRaw = await kv.get(`notes:versions:${session.sub}:${noteId}`);
      const versions = versionsRaw ? JSON.parse(versionsRaw) : [];
      const note = notes.find(n => n.id === noteId) || null;
      return json(200, { ok: true, note, versions });
    }
    // Links internos: notas que referenciam outras notas via [[slug]]
    if (view === 'links' && noteId) {
      const note = notes.find(n => n.id === noteId);
      if (!note) return json(404, { ok: false, error: 'Nota não encontrada' });
      const linkPattern = /\[\[([^\]]+)\]\]/g;
      const linkedSlugs = [...(note.content || '').matchAll(linkPattern)].map(m => m[1].toLowerCase());
      const linked = notes.filter(n => linkedSlugs.includes((n.title || '').toLowerCase()) || linkedSlugs.includes((n.slug || '').toLowerCase()));
      return json(200, { ok: true, note, links: linked, total: linked.length });
    }
    let filtered = notes;
    if (q) filtered = filtered.filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
    if (category) filtered = filtered.filter(n => n.category === category);
    return json(200, { ok: true, notes: filtered, total: notes.length });
  } catch {
    return json(500, { ok: false, error: 'Erro ao carregar notas' });
  }
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  const { title, content, category, icon, tags } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }
  const note = {
    id: generateId(),
    title: title.trim(),
    content: content?.trim() || '',
    category: category || 'geral',
    icon: icon || 'lightbulb',
    tags: Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    const raw = await kv.get(`notes:${session.sub}`);
    const notes = raw ? JSON.parse(raw) : [];
    notes.unshift(note);
    await kv.put(`notes:${session.sub}`, JSON.stringify(notes));
    return json(201, { ok: true, note });
  } catch {
    return json(500, { ok: false, error: 'Erro ao salvar nota' });
  }
}

export async function onRequestDelete({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
  try {
    const raw = await kv.get(`notes:${session.sub}`);
    const notes = raw ? JSON.parse(raw) : [];
    const filtered = notes.filter(n => n.id !== id);
    await kv.put(`notes:${session.sub}`, JSON.stringify(filtered));
    return json(200, { ok: true, deleted: id });
  } catch {
    return json(500, { ok: false, error: 'Erro ao deletar nota' });
  }
}

export async function onRequestPut({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  const { id, title, content, category, icon, tags } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
  try {
    const raw = await kv.get(`notes:${session.sub}`);
    const notes = raw ? JSON.parse(raw) : [];
    const idx = notes.findIndex(n => n.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Nota não encontrada' });
    const existing = notes[idx];
    const updated = {
      ...existing,
      title: title?.trim() || existing.title,
      content: content?.trim() ?? existing.content,
      category: category || existing.category,
      icon: icon || existing.icon,
      tags: Array.isArray(tags) ? tags : existing.tags,
      version: (existing.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    notes[idx] = updated;
    // Versionamento: salvar snapshot da versão anterior
    const verKey = `notes:versions:${session.sub}:${id}`;
    const versionsRaw = await kv.get(verKey);
    const versions = versionsRaw ? JSON.parse(versionsRaw) : [];
    versions.unshift({
      version: existing.version || 1,
      title: existing.title,
      content: existing.content,
      savedAt: existing.updatedAt || existing.createdAt,
      savedBy: session.sub,
    });
    await Promise.all([
      kv.put(`notes:${session.sub}`, JSON.stringify(notes)),
      kv.put(verKey, JSON.stringify(versions.slice(0, 50))),
    ]);
    return json(200, { ok: true, note: updated });
  } catch {
    return json(500, { ok: false, error: 'Erro ao atualizar nota' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'PUT') return onRequestPut({ request, env });
  if (request.method === 'DELETE') return onRequestDelete({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, PUT, DELETE, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST, PUT, DELETE, OPTIONS' });
}
