// LifeOS Enterprise — Session Check v6.0
// Cloudflare Pages Function: GET /api/session
// Retorna dados da sessão atual (admin ou user)
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Autenticação não configurada' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);

  if (!session) return json(401, { ok: false, error: 'Sessão inválida ou expirada' });

  return json(200, {
    ok: true,
    user: {
      username: session.sub,
      role: session.role,
    },
    redirect: session.role === 'admin' ? '/admin' : '/app',
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
