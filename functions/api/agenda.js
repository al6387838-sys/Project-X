// LifeOS Enterprise — Agenda API v2.0
// Cloudflare Pages Function: GET/POST/PUT/PATCH/DELETE /api/agenda
// Storage: KV (LIFEOS_KV)
import { getCookie, json, verifySession } from '../_auth.js';

function safeText(value, max = 240) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max);
}

async function getEvents(kv, userId) {
  try {
    const raw = await kv.get(`agenda:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveEvents(kv, userId, events) {
  await kv.put(`agenda:${userId}`, JSON.stringify(events));
}

// GET /api/agenda
export async function onRequestGet({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const url = new URL(request.url);
    const events = await getEvents(env.LIFEOS_KV, session.sub);

    // Filtros opcionais
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    let filtered = events;
    if (start) filtered = filtered.filter(e => e.date >= start);
    if (end) filtered = filtered.filter(e => e.date <= end);

    return json(200, { ok: true, events: filtered });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// POST /api/agenda
export async function onRequestPost({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const input = await request.json();
    if (!input.title) return json(400, { ok: false, error: 'Título do evento é obrigatório' });

    const events = await getEvents(env.LIFEOS_KV, session.sub);
    const event = {
      id: crypto.randomUUID(),
      title: safeText(input.title, 200),
      description: safeText(input.description || '', 1000),
      date: safeText(input.date || new Date().toISOString().split('T')[0], 20),
      startTime: safeText(input.startTime || '', 10),
      endTime: safeText(input.endTime || '', 10),
      location: safeText(input.location || '', 300),
      type: safeText(input.type || 'event', 40),
      color: safeText(input.color || '#6366F1', 20),
      allDay: Boolean(input.allDay),
      recurring: input.recurring || null,
      ownerId: session.sub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    events.push(event);
    await saveEvents(env.LIFEOS_KV, session.sub, events);
    return json(201, { ok: true, event });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// PUT /api/agenda
export async function onRequestPut({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const input = await request.json();
    if (!input.id) return json(400, { ok: false, error: 'ID do evento é obrigatório' });

    const events = await getEvents(env.LIFEOS_KV, session.sub);
    const idx = events.findIndex(e => e.id === input.id);
    if (idx === -1) return json(404, { ok: false, error: 'Evento não encontrado' });

    const fields = ['title', 'description', 'date', 'startTime', 'endTime', 'location', 'type', 'color', 'allDay', 'recurring'];
    fields.forEach(f => { if (input[f] !== undefined) events[idx][f] = input[f]; });
    events[idx].updatedAt = new Date().toISOString();

    await saveEvents(env.LIFEOS_KV, session.sub, events);
    return json(200, { ok: true, event: events[idx] });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// PATCH /api/agenda
export async function onRequestPatch({ request, env }) {
  return onRequestPut({ request, env });
}

// DELETE /api/agenda
export async function onRequestDelete({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const url = new URL(request.url);
    let id = url.searchParams.get('id') || url.pathname.split('/').pop();
    if (!id || id === 'agenda') {
      try { const body = await request.clone().json(); id = body.id; } catch { /* */ }
    }
    if (!id || id === 'agenda') return json(400, { ok: false, error: 'ID do evento é obrigatório' });

    const events = await getEvents(env.LIFEOS_KV, session.sub);
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) return json(404, { ok: false, error: 'Evento não encontrado' });

    await saveEvents(env.LIFEOS_KV, session.sub, filtered);
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
