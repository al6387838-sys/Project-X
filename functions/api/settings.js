// LifeOS Enterprise — Settings API v1.0
// Cloudflare Pages Function: GET/POST /api/settings
// Phase 131 — Real Data Foundation
// Configurações persistidas no Cloudflare KV
import { getCookie, json, verifySession } from '../_auth.js';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  notifications: {
    email: true,
    push: false,
    sms: false,
    digest: 'daily',
  },
  privacy: {
    profileVisible: false,
    activityVisible: false,
    dataSharing: false,
  },
  security: {
    twoFactor: false,
    sessionAlerts: true,
    loginHistory: true,
  },
  display: {
    compactMode: false,
    animations: true,
    sidebarCollapsed: false,
  },
};

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let settings = { ...DEFAULT_SETTINGS };
  if (env.LIFEOS_KV) {
    try {
      const raw = await env.LIFEOS_KV.get(`settings:${session.sub}`);
      if (raw) {
        const saved = JSON.parse(raw);
        settings = { ...DEFAULT_SETTINGS, ...saved };
      }
    } catch (_) { /* KV indisponível */ }
  }

  return json(200, { ok: true, settings });
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

  if (!env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Armazenamento não disponível' });
  }

  try {
    const raw = await env.LIFEOS_KV.get(`settings:${session.sub}`);
    const current = raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS };
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() };
    await env.LIFEOS_KV.put(`settings:${session.sub}`, JSON.stringify(updated));
    return json(200, { ok: true, message: 'Configurações salvas', settings: updated });
  } catch (_) {
    return json(500, { ok: false, error: 'Erro ao salvar configurações' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
