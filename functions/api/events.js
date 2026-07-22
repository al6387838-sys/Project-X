// LifeOS Enterprise — Events/Agenda API v2.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/events
// Phase 409 — Certificação: edição, repetição, lembretes, busca, timezone
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_STRING_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

function sanitizeInput(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .slice(0, MAX_STRING_LENGTH);
}

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function safeStr(v, max = 200) {
  return String(v ?? '').trim().slice(0, max);
}

async function getAuth(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return { error: json(503, { ok: false, error: 'Serviço indisponível' }) };
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return { error: json(401, { ok: false, error: 'Não autenticado' }) };
  const kv = env.LIFEOS_KV;
  if (!kv) return { error: json(503, { ok: false, error: 'Armazenamento indisponível' }) };
  return { session, kv };
}

export async function onRequestGet({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const raw = await kv.get(`events:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const view = url.searchParams.get('view') || '';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    // Busca por texto
    if (q) {
      const results = events.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q)
      );
      return json(200, { ok: true, events: results, total: results.length, query: q });
    }
    // Todos os eventos
    if (view === 'all') {
      return json(200, { ok: true, events, total: events.length });
    }
    // Intervalo de datas
    if (from || to) {
      const filtered = events.filter(e => {
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        return true;
      });
      return json(200, { ok: true, events: filtered, total: filtered.length });
    }
    // Filtro por data específica
    const today = new Date().toISOString().split('T')[0];
    const filterDate = date || today;
    const todayEvents = events.filter(e => e.date === filterDate);
    return json(200, { ok: true, events: todayEvents, all: events, total: events.length });
  } catch {
    return json(500, { ok: false, error: 'Erro ao carregar eventos' });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { title, date, time, duration, location, color, description, repeat, reminder, timezone } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }
  if (!date) return json(400, { ok: false, error: 'Data obrigatória' });

  const event = {
    id: generateId(),
    title: safeStr(title, MAX_TITLE_LENGTH),
    date: safeStr(date, 10),
    time: safeStr(time || '09:00', 5),
    duration: safeStr(duration || '1h', 20),
    location: safeStr(location || '', 200),
    color: safeStr(color || 'var(--accent)', 30),
    description: sanitizeInput(safeStr(description || '', MAX_DESCRIPTION_LENGTH)),
    // Repetição: none | daily | weekly | monthly | yearly
    repeat: ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(repeat) ? repeat : 'none',
    repeatUntil: safeStr(body.repeatUntil || '', 10) || null,
    // Lembrete em minutos antes: 0, 5, 10, 15, 30, 60, 120, 1440
    reminder: Number.isInteger(Number(reminder)) ? Number(reminder) : 0,
    // Timezone: ex "America/Sao_Paulo"
    timezone: safeStr(timezone || 'America/Sao_Paulo', 50),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: session.sub,
  };

  try {
    const raw = await kv.get(`events:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    events.push(event);
    events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    await kv.put(`events:${session.sub}`, JSON.stringify(events));
    return json(201, { ok: true, event });
  } catch {
    return json(500, { ok: false, error: 'Erro ao salvar evento' });
  }
}

export async function onRequestPut({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { id, ...updates } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const raw = await kv.get(`events:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Evento não encontrado' });

    const allowed = ['title', 'date', 'time', 'duration', 'location', 'color', 'description', 'repeat', 'repeatUntil', 'reminder', 'timezone'];
    for (const key of allowed) {
      if (key in updates) {
        if (key === 'title') events[idx][key] = safeStr(updates[key], MAX_TITLE_LENGTH);
        else if (key === 'description') events[idx][key] = sanitizeInput(safeStr(updates[key], MAX_DESCRIPTION_LENGTH));
        else if (key === 'repeat') events[idx][key] = ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(updates[key]) ? updates[key] : 'none';
        else if (key === 'reminder') events[idx][key] = Number.isInteger(Number(updates[key])) ? Number(updates[key]) : 0;
        else events[idx][key] = safeStr(String(updates[key] ?? ''), 200);
      }
    }
    events[idx].updatedAt = new Date().toISOString();
    events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    await kv.put(`events:${session.sub}`, JSON.stringify(events));
    return json(200, { ok: true, event: events[idx] });
  } catch {
    return json(500, { ok: false, error: 'Erro ao atualizar evento' });
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
  try {
    const raw = await kv.get(`events:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) return json(404, { ok: false, error: 'Evento não encontrado' });
    await kv.put(`events:${session.sub}`, JSON.stringify(filtered));
    return json(200, { ok: true, deleted: id });
  } catch {
    return json(500, { ok: false, error: 'Erro ao deletar evento' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'PUT') return onRequestPut({ request, env });
  if (request.method === 'DELETE') return onRequestDelete({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST, PUT, DELETE' });
}
