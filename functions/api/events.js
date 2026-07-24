// LifeOS Enterprise — Events API v3.0 (FASE 2 — Certificação Completa)
// Cloudflare Pages Function: GET/POST/PUT/PATCH/DELETE /api/events
// Funcionalidades: CRUD, recorrência, lembretes, busca, filtros, anexos R2,
//                  Google Calendar sync, Microsoft Outlook sync
// Storage: KV (LIFEOS_KV) + R2 (LIFEOS_R2/LIFEOS_FILES)
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_LOCATION_LENGTH = 300;
const ALLOWED_REPEAT = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const ALLOWED_REMINDER = [0, 5, 10, 15, 30, 60, 120, 1440];

function sanitize(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim()
    .slice(0, max);
}

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
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

function resolveBucket(env) {
  return env.LIFEOS_R2 || env.LIFEOS_FILES || env.R2_BUCKET || null;
}

async function getEvents(kv, userId) {
  try {
    const raw = await kv.get(`events:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveEvents(kv, userId, events) {
  await kv.put(`events:${userId}`, JSON.stringify(events));
}

// Expandir eventos recorrentes para um intervalo de datas
function expandRecurring(event, from, to) {
  if (!event.repeat || event.repeat === 'none') return [event];
  const results = [];
  const start = new Date(event.date + 'T12:00:00');
  const end = to ? new Date(to + 'T12:00:00') : new Date(start.getTime() + 365 * 24 * 3600 * 1000);
  const repeatUntil = event.repeatUntil ? new Date(event.repeatUntil + 'T12:00:00') : end;
  const fromDate = from ? new Date(from + 'T12:00:00') : start;
  let cur = new Date(start);
  let count = 0;
  while (cur <= end && cur <= repeatUntil && count < 500) {
    const dateStr = cur.toISOString().split('T')[0];
    if (cur >= fromDate) {
      results.push({ ...event, date: dateStr, _recurring: true, _originalId: event.id, id: count === 0 ? event.id : `${event.id}_${dateStr}` });
    }
    count++;
    switch (event.repeat) {
      case 'daily': cur.setDate(cur.getDate() + 1); break;
      case 'weekly': cur.setDate(cur.getDate() + 7); break;
      case 'monthly': cur.setMonth(cur.getMonth() + 1); break;
      case 'yearly': cur.setFullYear(cur.getFullYear() + 1); break;
      default: break;
    }
    if (!['daily','weekly','monthly','yearly'].includes(event.repeat)) break;
  }
  return results;
}

// GET /api/events
export async function onRequestGet({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const events = await getEvents(kv, session.sub);
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    const view = url.searchParams.get('view') || 'day';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const category = url.searchParams.get('category') || '';
    const color = url.searchParams.get('color') || '';

    // Busca por texto
    if (q) {
      const results = events.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q)
      );
      return json(200, { ok: true, events: results, total: results.length, query: q });
    }

    // Todos os eventos (sem expansão de recorrência)
    if (view === 'all') {
      return json(200, { ok: true, events, total: events.length });
    }

    // Intervalo de datas (com expansão de recorrência)
    if (from || to) {
      let expanded = [];
      for (const e of events) {
        expanded.push(...expandRecurring(e, from, to));
      }
      if (category) expanded = expanded.filter(e => (e.category || '') === category);
      if (color) expanded = expanded.filter(e => (e.color || '') === color);
      expanded.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      return json(200, { ok: true, events: expanded, total: expanded.length });
    }

    // Filtro por data específica (padrão: hoje)
    const today = new Date().toISOString().split('T')[0];
    const filterDate = date || today;
    let expanded = [];
    for (const e of events) {
      const recurring = expandRecurring(e, filterDate, filterDate);
      expanded.push(...recurring.filter(r => r.date === filterDate));
    }
    if (category) expanded = expanded.filter(e => (e.category || '') === category);
    expanded.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return json(200, { ok: true, events: expanded, all: events, total: events.length, date: filterDate });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao carregar eventos: ' + e.message });
  }
}

// POST /api/events — criar evento ou ação especial
export async function onRequestPost({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { action } = body;

  // ── Ação: Sincronizar com Google Calendar ────────────────────────────────
  if (action === 'google-sync') {
    try {
      const integRaw = await kv.get(`integration:${session.sub}:google_oauth`);
      const integ = integRaw ? JSON.parse(integRaw) : null;
      if (!integ || !integ.accessToken) {
        return json(400, { ok: false, error: 'Google Calendar não conectado. Conecte em Integrações.' });
      }
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
      const gcalRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
        { headers: { Authorization: `Bearer ${integ.accessToken}` } }
      );
      if (!gcalRes.ok) {
        const err = await gcalRes.json().catch(() => ({}));
        return json(502, { ok: false, error: 'Erro ao acessar Google Calendar: ' + (err.error?.message || gcalRes.status) });
      }
      const gcalData = await gcalRes.json();
      const gcalEvents = (gcalData.items || []).map(item => ({
        id: 'gcal_' + (item.id || generateId()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16),
        title: sanitize(item.summary || 'Sem título', MAX_TITLE_LENGTH),
        description: sanitize(item.description || '', MAX_DESCRIPTION_LENGTH),
        date: (item.start?.date || item.start?.dateTime || '').split('T')[0],
        time: item.start?.dateTime ? item.start.dateTime.split('T')[1]?.slice(0, 5) : '',
        endTime: item.end?.dateTime ? item.end.dateTime.split('T')[1]?.slice(0, 5) : '',
        location: sanitize(item.location || '', MAX_LOCATION_LENGTH),
        color: '#4285F4',
        allDay: !!item.start?.date,
        repeat: 'none',
        reminder: 0,
        timezone: item.start?.timeZone || 'America/Sao_Paulo',
        category: 'google',
        source: 'google',
        googleId: item.id,
        attachments: [],
        createdAt: item.created || new Date().toISOString(),
        updatedAt: item.updated || new Date().toISOString(),
        createdBy: session.sub,
      })).filter(e => e.date);
      const localEvents = await getEvents(kv, session.sub);
      const localNonGoogle = localEvents.filter(e => e.source !== 'google');
      const merged = [...localNonGoogle, ...gcalEvents];
      await saveEvents(kv, session.sub, merged);
      return json(200, { ok: true, synced: gcalEvents.length, total: merged.length });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro na sincronização Google: ' + e.message });
    }
  }

  // ── Ação: Sincronizar com Microsoft Outlook ──────────────────────────────
  if (action === 'outlook-sync') {
    try {
      const integRaw = await kv.get(`integration:${session.sub}:microsoft_365`);
      const integ = integRaw ? JSON.parse(integRaw) : null;
      if (!integ || !integ.accessToken) {
        return json(400, { ok: false, error: 'Microsoft Outlook não conectado. Conecte em Integrações.' });
      }
      const now = new Date();
      const startDateTime = now.toISOString();
      const endDateTime = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
      const outlookRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$top=100&$select=id,subject,body,start,end,location,isAllDay`,
        { headers: { Authorization: `Bearer ${integ.accessToken}`, 'Content-Type': 'application/json' } }
      );
      if (!outlookRes.ok) {
        const err = await outlookRes.json().catch(() => ({}));
        return json(502, { ok: false, error: 'Erro ao acessar Outlook: ' + (err.error?.message || outlookRes.status) });
      }
      const outlookData = await outlookRes.json();
      const outlookEvents = (outlookData.value || []).map(item => ({
        id: 'outlook_' + (item.id || generateId()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16),
        title: sanitize(item.subject || 'Sem título', MAX_TITLE_LENGTH),
        description: sanitize((item.body?.content || '').replace(/<[^>]*>/g, ''), MAX_DESCRIPTION_LENGTH),
        date: (item.start?.dateTime || '').split('T')[0],
        time: item.start?.dateTime ? item.start.dateTime.split('T')[1]?.slice(0, 5) : '',
        endTime: item.end?.dateTime ? item.end.dateTime.split('T')[1]?.slice(0, 5) : '',
        location: sanitize(item.location?.displayName || '', MAX_LOCATION_LENGTH),
        color: '#0078D4',
        allDay: item.isAllDay || false,
        repeat: 'none',
        reminder: 0,
        timezone: item.start?.timeZone || 'America/Sao_Paulo',
        category: 'outlook',
        source: 'outlook',
        outlookId: item.id,
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: session.sub,
      })).filter(e => e.date);
      const localEvents = await getEvents(kv, session.sub);
      const localNonOutlook = localEvents.filter(e => e.source !== 'outlook');
      const merged = [...localNonOutlook, ...outlookEvents];
      await saveEvents(kv, session.sub, merged);
      return json(200, { ok: true, synced: outlookEvents.length, total: merged.length });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro na sincronização Outlook: ' + e.message });
    }
  }

  // ── Ação: Adicionar anexo a evento ───────────────────────────────────────
  if (action === 'attach') {
    const { eventId, fileName, fileType, fileData } = body;
    if (!eventId || !fileName || !fileData) {
      return json(400, { ok: false, error: 'eventId, fileName e fileData são obrigatórios' });
    }
    const bucket = resolveBucket(env);
    if (!bucket) return json(503, { ok: false, error: 'Armazenamento de arquivos indisponível' });
    try {
      const events = await getEvents(kv, session.sub);
      const idx = events.findIndex(e => e.id === eventId);
      if (idx === -1) return json(404, { ok: false, error: 'Evento não encontrado' });
      const binaryStr = atob(fileData);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const attachId = generateId();
      const key = `events/${session.sub}/${eventId}/${attachId}_${sanitize(fileName, 100)}`;
      await bucket.put(key, bytes, {
        httpMetadata: { contentType: fileType || 'application/octet-stream' },
        customMetadata: { ownerId: session.sub, eventId, fileName },
      });
      if (!events[idx].attachments) events[idx].attachments = [];
      events[idx].attachments.push({ id: attachId, name: sanitize(fileName, 100), type: fileType || 'application/octet-stream', key, uploadedAt: new Date().toISOString() });
      events[idx].updatedAt = new Date().toISOString();
      await saveEvents(kv, session.sub, events);
      return json(200, { ok: true, attachment: events[idx].attachments[events[idx].attachments.length - 1] });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao anexar arquivo: ' + e.message });
    }
  }

  // ── Criar novo evento ────────────────────────────────────────────────────
  const { title, date, time, endTime, duration, location, color, description, repeat, repeatUntil, reminder, timezone, allDay, category, attendees } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }
  if (!date) return json(400, { ok: false, error: 'Data obrigatória' });

  const event = {
    id: generateId(),
    title: sanitize(title, MAX_TITLE_LENGTH),
    date: sanitize(date, 10),
    time: sanitize(time || '09:00', 5),
    endTime: sanitize(endTime || '', 5),
    duration: sanitize(duration || '1h', 20),
    location: sanitize(location || '', MAX_LOCATION_LENGTH),
    color: sanitize(color || '#6366F1', 30),
    description: sanitize(description || '', MAX_DESCRIPTION_LENGTH),
    repeat: ALLOWED_REPEAT.includes(repeat) ? repeat : 'none',
    repeatUntil: sanitize(repeatUntil || '', 10) || null,
    reminder: ALLOWED_REMINDER.includes(Number(reminder)) ? Number(reminder) : 0,
    timezone: sanitize(timezone || 'America/Sao_Paulo', 50),
    allDay: Boolean(allDay),
    category: sanitize(category || 'personal', 50),
    attendees: Array.isArray(attendees) ? attendees.slice(0, 50).map(a => sanitize(String(a), 100)) : [],
    attachments: [],
    source: 'local',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: session.sub,
  };

  try {
    const events = await getEvents(kv, session.sub);
    events.push(event);
    events.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    await saveEvents(kv, session.sub, events);
    return json(201, { ok: true, event });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao salvar evento: ' + e.message });
  }
}

// PUT /api/events — editar evento
export async function onRequestPut({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { id, ...updates } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const events = await getEvents(kv, session.sub);
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Evento não encontrado' });

    const allowed = ['title', 'date', 'time', 'endTime', 'duration', 'location', 'color', 'description', 'repeat', 'repeatUntil', 'reminder', 'timezone', 'allDay', 'category', 'attendees'];
    for (const key of allowed) {
      if (key in updates) {
        if (key === 'title') events[idx][key] = sanitize(updates[key], MAX_TITLE_LENGTH);
        else if (key === 'description') events[idx][key] = sanitize(updates[key], MAX_DESCRIPTION_LENGTH);
        else if (key === 'location') events[idx][key] = sanitize(updates[key], MAX_LOCATION_LENGTH);
        else if (key === 'repeat') events[idx][key] = ALLOWED_REPEAT.includes(updates[key]) ? updates[key] : 'none';
        else if (key === 'reminder') events[idx][key] = ALLOWED_REMINDER.includes(Number(updates[key])) ? Number(updates[key]) : 0;
        else if (key === 'allDay') events[idx][key] = Boolean(updates[key]);
        else if (key === 'attendees') events[idx][key] = Array.isArray(updates[key]) ? updates[key].slice(0, 50).map(a => sanitize(String(a), 100)) : [];
        else events[idx][key] = sanitize(String(updates[key] ?? ''), 200);
      }
    }
    events[idx].updatedAt = new Date().toISOString();
    events.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    await saveEvents(kv, session.sub, events);
    return json(200, { ok: true, event: events[idx] });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao atualizar evento: ' + e.message });
  }
}

// DELETE /api/events
export async function onRequestDelete({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  const url = new URL(request.url);
  let id = url.searchParams.get('id');
  if (!id) {
    try { const b = await request.json(); id = b.id; } catch { /* */ }
  }
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const events = await getEvents(kv, session.sub);
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) return json(404, { ok: false, error: 'Evento não encontrado' });
    await saveEvents(kv, session.sub, filtered);
    return json(200, { ok: true, deleted: id });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao deletar evento: ' + e.message });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'PUT') return onRequestPut({ request, env });
  if (request.method === 'PATCH') return onRequestPut({ request, env });
  if (request.method === 'DELETE') return onRequestDelete({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
