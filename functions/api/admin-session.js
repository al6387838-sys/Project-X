// LifeOS Enterprise — Admin Session Check v7.1
// Cloudflare Pages Function: GET /api/admin-session
// v7.1: passa LIFEOS_KV ao verifySession para verificar blocklist de revogação

import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Autenticação ainda não configurada' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret, env.LIFEOS_KV);
  if (!session) return json(401, { ok: false, error: 'Sessão inválida ou expirada' });

  return json(200, {
    ok: true,
    user: { username: session.sub, role: session.role },
    redirect: session.role === 'admin' ? '/admin' : '/app',
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
