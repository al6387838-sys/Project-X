// LifeOS Enterprise — Notifications API v1.0
// Cloudflare Pages Function: GET/POST /api/notifications
// Phase 131 — Real Data Foundation
// Notificações persistidas no Cloudflare KV
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let notifications = [];
  if (env.LIFEOS_KV) {
    try {
      const raw = await env.LIFEOS_KV.get(`notifications:${session.sub}`);
      if (raw) notifications = JSON.parse(raw);
    } catch (_) { /* KV indisponível */ }
  }

  return json(200, { ok: true, notifications, unread: notifications.filter(n => !n.read).length });
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const action = String(input.action || '');

  if (action === 'mark_read') {
    const notifId = String(input.id || '');
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`notifications:${session.sub}`);
        let notifications = raw ? JSON.parse(raw) : [];
        if (notifId === 'all') {
          notifications = notifications.map(n => ({ ...n, read: true }));
        } else {
          notifications = notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
        }
        await env.LIFEOS_KV.put(`notifications:${session.sub}`, JSON.stringify(notifications));
      } catch (_) { /* ignorar */ }
    }
    return json(200, { ok: true, message: 'Notificações marcadas como lidas' });
  }

  if (action === 'dismiss') {
    const notifId = String(input.id || '');
    if (env.LIFEOS_KV && notifId) {
      try {
        const raw = await env.LIFEOS_KV.get(`notifications:${session.sub}`);
        let notifications = raw ? JSON.parse(raw) : [];
        notifications = notifications.filter(n => n.id !== notifId);
        await env.LIFEOS_KV.put(`notifications:${session.sub}`, JSON.stringify(notifications));
      } catch (_) { /* ignorar */ }
    }
    return json(200, { ok: true, message: 'Notificação removida' });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
