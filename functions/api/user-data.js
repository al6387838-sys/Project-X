// LifeOS Enterprise — User Data API v6.0
// Cloudflare Pages Function: GET /api/user-data
// Retorna dados do usuário logado para o dashboard /app
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);

  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  // Dados do usuário (mock + KV se disponível)
  let userData = {
    username: session.sub,
    role: session.role,
    name: session.sub.split('@')[0],
    plan: 'pro',
    lifeScore: 87,
    streak: 14,
    tasksToday: 8,
    tasksCompleted: 5,
    habitsActive: 6,
    habitsCompleted: 4,
    goalsActive: 3,
    goalsProgress: 68,
    insightsCount: 12,
    notifications: 3,
  };

  if (env.LIFEOS_KV && session.role === 'user') {
    try {
      const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
      if (raw) {
        const kv = JSON.parse(raw);
        userData = { ...userData, ...kv, passwordHash: undefined };
      }
    } catch (_) { /* usar dados mock */ }
  }

  return json(200, { ok: true, user: userData });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
