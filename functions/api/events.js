// LifeOS Enterprise — Events/Agenda API v1.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/events
// Phase 200 — Real Data Migration (zero mocks)
// Eventos da agenda do usuário persistidos no KV
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

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, events: [], source: 'empty' });
  try {
    const raw = await kv.get(`events:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const today = new Date().toISOString().split('T')[0];
    const filterDate = date || today;
    const todayEvents = events.filter(e => e.date === filterDate);
    return json(200, { ok: true, events: todayEvents, all: events, total: events.length });
  } catch {
    return json(500, { ok: false, error: 'Erro ao carregar eventos' });
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
  const { title, date, time, duration, location, color, description } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }
  if (!date) return json(400, { ok: false, error: 'Data obrigatória' });
  const event = {
    id: generateId(),
    title: title.trim(),
    date,
    time: time || '09:00',
    duration: duration || '1h',
    location: location?.trim() || '',
    color: color || 'var(--accent)',
    description: description?.trim() || '',
    createdAt: new Date().toISOString(),
  };
  try {
    const raw = await kv.get(`events:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    events.push(event);
    events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    await kv.put(`events:${session.sub}`, JSON.stringify(events));
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
    const raw = await kv.get(`events:${session.sub}`);
    const events = raw ? JSON.parse(raw) : [];
    const filtered = events.filter(e => e.id !== id);
    await kv.put(`events:${session.sub}`, JSON.stringify(filtered));
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
