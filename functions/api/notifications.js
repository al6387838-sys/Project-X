// LifeOS Enterprise — Notifications API v3.0
// Cloudflare Pages Function: GET/POST/DELETE /api/notifications
// Fase 3 — Notificações em tempo real, preferências, filtros, email, persistência definitiva
import { getCookie, json, verifySession } from '../_auth.js';

const CATEGORIES = ['task', 'crm', 'finance', 'habit', 'goal', 'system', 'reminder', 'ai', 'integration'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function sanitize(v, maxLen = 500) {
  if (typeof v !== 'string') return '';
  return v.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

async function getNotifications(kv, userId) {
  const raw = await kv.get(`notifications:${userId}`);
  return raw ? JSON.parse(raw) : [];
}

async function saveNotifications(kv, userId, notifications) {
  await kv.put(`notifications:${userId}`, JSON.stringify(notifications.slice(0, 500)));
}

async function getPreferences(kv, userId) {
  const raw = await kv.get(`notifications:prefs:${userId}`);
  return raw ? JSON.parse(raw) : {
    email: false,
    emailAddress: '',
    categories: Object.fromEntries(CATEGORIES.map(c => [c, true])),
    minPriority: 'low',
    sound: true,
    desktop: true,
  };
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, notifications: [], unread: 0, categories: CATEGORIES, priorities: PRIORITIES });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'list';

  try {
    if (view === 'preferences') {
      const prefs = await getPreferences(kv, session.sub);
      return json(200, { ok: true, preferences: prefs });
    }

    let notifications = await getNotifications(kv, session.sub);
    let filtered = [...notifications];

    const category = url.searchParams.get('category');
    const priority = url.searchParams.get('priority');
    const unreadOnly = url.searchParams.get('unread') === '1';
    const q = url.searchParams.get('q');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    if (category) filtered = filtered.filter(n => n.category === category);
    if (priority) filtered = filtered.filter(n => n.priority === priority);
    if (unreadOnly) filtered = filtered.filter(n => !n.read);
    if (q) {
      const lq = q.toLowerCase();
      filtered = filtered.filter(n => (n.title || '').toLowerCase().includes(lq) || (n.body || '').toLowerCase().includes(lq));
    }
    if (dateFrom) filtered = filtered.filter(n => (n.createdAt || '') >= dateFrom);
    if (dateTo) filtered = filtered.filter(n => (n.createdAt || '') <= dateTo + 'T23:59:59');

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const page = filtered.slice(offset, offset + limit);
    const unreadCount = notifications.filter(n => !n.read).length;

    return json(200, {
      ok: true,
      notifications: page,
      total: filtered.length,
      unread: unreadCount,
      offset,
      limit,
      categories: CATEGORIES,
      priorities: PRIORITIES,
    });
  } catch (err) {
    return json(500, { ok: false, error: err.message || 'Erro ao carregar notificações' });
  }
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  const action = String(body.action || '');

  if (action === 'mark_read' || action === 'markAllRead') {
    const notifId = String(body.id || '');
    const notifications = await getNotifications(kv, session.sub);
    const updated = notifId === 'all' || action === 'markAllRead'
      ? notifications.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
      : notifications.map(n => n.id === notifId ? { ...n, read: true, readAt: new Date().toISOString() } : n);
    await saveNotifications(kv, session.sub, updated);
    return json(200, { ok: true, unread: updated.filter(n => !n.read).length, message: 'Marcado como lido' });
  }

  if (action === 'mark_unread') {
    const notifId = String(body.id || '');
    if (!notifId) return json(400, { ok: false, error: 'ID obrigatório' });
    const notifications = await getNotifications(kv, session.sub);
    const updated = notifications.map(n => n.id === notifId ? { ...n, read: false, readAt: null } : n);
    await saveNotifications(kv, session.sub, updated);
    return json(200, { ok: true, message: 'Marcado como não lido' });
  }

  if (action === 'dismiss' || action === 'delete') {
    const notifId = String(body.id || '');
    if (!notifId) return json(400, { ok: false, error: 'ID obrigatório' });
    const notifications = await getNotifications(kv, session.sub);
    await saveNotifications(kv, session.sub, notifications.filter(n => n.id !== notifId));
    return json(200, { ok: true, deleted: notifId });
  }

  if (action === 'delete_batch') {
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (!ids.length) return json(400, { ok: false, error: 'IDs obrigatórios' });
    const notifications = await getNotifications(kv, session.sub);
    await saveNotifications(kv, session.sub, notifications.filter(n => !ids.includes(n.id)));
    return json(200, { ok: true, deleted: ids.length });
  }

  if (action === 'clearHistory' || action === 'clear_all') {
    await saveNotifications(kv, session.sub, []);
    return json(200, { ok: true, message: 'Histórico limpo' });
  }

  if (action === 'clear_read') {
    const notifications = await getNotifications(kv, session.sub);
    const updated = notifications.filter(n => !n.read);
    await saveNotifications(kv, session.sub, updated);
    return json(200, { ok: true, deleted: notifications.length - updated.length });
  }

  if (action === 'create') {
    const title = sanitize(body.title || '', 200);
    if (!title) return json(400, { ok: false, error: 'Título obrigatório' });
    const category = CATEGORIES.includes(body.category) ? body.category : 'system';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'normal';
    const notif = {
      id: generateId(),
      title,
      body: sanitize(body.body || '', 1000),
      category,
      priority,
      read: false,
      readAt: null,
      actionUrl: sanitize(body.actionUrl || '', 500),
      actionLabel: sanitize(body.actionLabel || '', 100),
      icon: sanitize(body.icon || '', 50),
      createdAt: new Date().toISOString(),
      source: 'internal',
    };
    const notifications = await getNotifications(kv, session.sub);
    notifications.unshift(notif);
    await saveNotifications(kv, session.sub, notifications);
    return json(201, { ok: true, notification: notif });
  }

  if (action === 'save_preferences') {
    const prefs = await getPreferences(kv, session.sub);
    if (typeof body.email === 'boolean') prefs.email = body.email;
    if (body.emailAddress !== undefined) prefs.emailAddress = sanitize(String(body.emailAddress || ''), 200);
    if (body.categories && typeof body.categories === 'object') {
      for (const cat of CATEGORIES) {
        if (cat in body.categories) prefs.categories[cat] = Boolean(body.categories[cat]);
      }
    }
    if (PRIORITIES.includes(body.minPriority)) prefs.minPriority = body.minPriority;
    if (typeof body.sound === 'boolean') prefs.sound = body.sound;
    if (typeof body.desktop === 'boolean') prefs.desktop = body.desktop;
    await kv.put(`notifications:prefs:${session.sub}`, JSON.stringify(prefs));
    return json(200, { ok: true, preferences: prefs });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequestDelete({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const all = url.searchParams.get('all');

  if (all === '1') {
    await saveNotifications(kv, session.sub, []);
    return json(200, { ok: true, message: 'Todas as notificações removidas' });
  }

  if (!id) return json(400, { ok: false, error: 'ID ou all=1 obrigatório' });
  const notifications = await getNotifications(kv, session.sub);
  await saveNotifications(kv, session.sub, notifications.filter(n => n.id !== id));
  return json(200, { ok: true, deleted: id });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    case 'DELETE': return onRequestDelete(ctx);
    case 'PUT': return onRequestPost(ctx);
    case 'OPTIONS': return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
