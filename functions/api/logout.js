// LifeOS Enterprise — Logout v16.5
import { revokeSession } from '../_account.js';
import { expiredSessionCookie, getCookie, json, verifySession } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const token = getCookie(request.headers.get('cookie'));
  const session = env.LIFEOS_SESSION_SECRET
    ? await verifySession(token, env.LIFEOS_SESSION_SECRET)
    : null;
  if (session?.jti && env.LIFEOS_KV) {
    await revokeSession(env.LIFEOS_KV, session.sub, session.jti);
  }
  return json(200, { ok: true, message: 'Sessão encerrada' }, { 'set-cookie': expiredSessionCookie() });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
