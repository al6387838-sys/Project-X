// LifeOS Enterprise — Timeline API v1.0
// Cloudflare Pages Function: GET/POST/DELETE /api/timeline
// Phase 200 — Real Data Migration (zero mocks)
import { getCookie, json, verifySession } from '../_auth.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, events: [], total: 0, source: 'empty' });
  try {
    const raw = await kv.get(`timeline:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const year = url.searchParams.get('year');
    let filtered = events;
    if (category && category !== 'all') filtered = filtered.filter(e => e.category === category);
    if (year) filtered = filtered.filter(e => String(e.year) === year);
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    return json(200, { ok: true, events: filtered, total: events.length });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar timeline' });
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
  const { title, description, category, date, tags } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }
  if (!date) return json(400, { ok: false, error: 'Data obrigatória' });
  const eventDate = new Date(date);
  if (isNaN(eventDate.getTime())) return json(400, { ok: false, error: 'Data inválida' });
  const event = {
    id: generateId(),
    title: title.trim(),
    description: description?.trim() || '',
    category: category || 'pessoal',
    date: eventDate.toISOString().split('T')[0],
    year: eventDate.getFullYear(),
    tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
    createdAt: new Date().toISOString(),
  };
  try {
    const raw = await kv.get(`timeline:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    events.push(event);
    await kv.put(`timeline:${session.sub}`, JSON.stringify(events));
    return json(201, { ok: true, event });
  } catch {
    return json(500, { ok: false, error: 'Erro ao salvar evento' });
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
    const raw = await kv.get(`timeline:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) return json(404, { ok: false, error: 'Evento não encontrado' });
    await kv.put(`timeline:${session.sub}`, JSON.stringify(filtered));
    return json(200, { ok: true, deleted: id });
  } catch {
    return json(500, { ok: false, error: 'Erro ao deletar evento' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'DELETE') return onRequestDelete({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
