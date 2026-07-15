// LifeOS Enterprise — Sessions Management API v1.0
// Cloudflare Pages Function: GET/POST /api/sessions
// Phase 132 — Real Authentication
// Gerenciamento de sessões ativas persistidas no KV
import { createSession, getCookie, json, sessionCookie, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let sessions = [];
  if (env.LIFEOS_KV) {
    try {
      const raw = await env.LIFEOS_KV.get(`sessions:${session.sub}`);
      if (raw) sessions = JSON.parse(raw);
      // Filtrar sessões expiradas
      sessions = sessions.filter(s => new Date(s.expiresAt) > new Date());
    } catch (_) { /* KV indisponível */ }
  }

  return json(200, { ok: true, sessions });
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

  if (action === 'register') {
    // Registrar sessão atual
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const ua = request.headers.get('user-agent') || 'unknown';
    const country = request.headers.get('cf-ipcountry') || 'unknown';
    const city = request.cf?.city || '';
    const jti = session.jti || `sess_${Date.now()}`;

    const sessionRecord = {
      id: jti,
      ip,
      userAgent: ua.substring(0, 200),
      country,
      city,
      current: true,
      createdAt: new Date(session.iat).toISOString(),
      expiresAt: new Date(session.exp).toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`sessions:${session.sub}`);
        let sessions = raw ? JSON.parse(raw) : [];
        // Filtrar expiradas e marcar outras como não-current
        sessions = sessions
          .filter(s => new Date(s.expiresAt) > new Date())
          .map(s => ({ ...s, current: false }));
        // Evitar duplicatas
        sessions = sessions.filter(s => s.id !== jti);
        sessions.unshift(sessionRecord);
        // Manter apenas as 10 mais recentes
        sessions = sessions.slice(0, 10);
        await env.LIFEOS_KV.put(`sessions:${session.sub}`, JSON.stringify(sessions), { expirationTtl: 8 * 3600 });
      } catch (_) { /* ignorar */ }
    }

    return json(200, { ok: true, session: sessionRecord });
  }

  if (action === 'revoke') {
    const sessionId = String(input.id || '');
    if (!sessionId) return json(400, { ok: false, error: 'ID da sessão obrigatório' });

    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`sessions:${session.sub}`);
        let sessions = raw ? JSON.parse(raw) : [];
        sessions = sessions.filter(s => s.id !== sessionId);
        await env.LIFEOS_KV.put(`sessions:${session.sub}`, JSON.stringify(sessions));
      } catch (_) { /* ignorar */ }
    }

    return json(200, { ok: true, message: 'Sessão encerrada' });
  }

  if (action === 'revoke_all') {
    if (env.LIFEOS_KV) {
      try {
        await env.LIFEOS_KV.put(`sessions:${session.sub}`, JSON.stringify([]));
      } catch (_) { /* ignorar */ }
    }
    return json(200, { ok: true, message: 'Todas as sessões encerradas' });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
