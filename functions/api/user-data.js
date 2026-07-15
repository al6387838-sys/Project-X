// LifeOS Enterprise — User Data API v8.0
// Cloudflare Pages Function: GET /api/user-data
// Phase 131 — Real Data Foundation
// Todos os dados provêm do Cloudflare KV (sem mock)
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  // Dados base derivados da sessão (sem valores mock)
  let userData = {
    username: session.sub,
    role: session.role,
    name: session.sub.split('@')[0],
    plan: 'free',
    lifeScore: 0,
    streak: 0,
    tasksToday: 0,
    tasksCompleted: 0,
    habitsActive: 0,
    habitsCompleted: 0,
    goalsActive: 0,
    goalsProgress: 0,
    insightsCount: 0,
    notifications: 0,
    onboarded: false,
    timezone: 'America/Sao_Paulo',
    createdAt: null,
    updatedAt: null,
  };

  // Carregar dados reais do KV (usuários comuns)
  if (env.LIFEOS_KV && session.role !== 'admin') {
    try {
      const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
      if (raw) {
        const kv = JSON.parse(raw);
        const { passwordHash, ...safeKv } = kv;
        userData = { ...userData, ...safeKv };
      }
    } catch (_) { /* KV indisponível — retornar dados base */ }
  }

  // Admin: dados do perfil administrativo
  if (session.role === 'admin') {
    userData.name = 'Administrador';
    userData.plan = 'enterprise';
    userData.role = 'admin';
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`admin:${session.sub}`);
        if (raw) {
          const kv = JSON.parse(raw);
          const { passwordHash, ...safeKv } = kv;
          userData = { ...userData, ...safeKv };
        }
      } catch (_) { /* ignorar */ }
    }
  }

  return json(200, { ok: true, user: userData });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
