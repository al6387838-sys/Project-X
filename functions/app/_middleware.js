// LifeOS Enterprise — Middleware /app v7.1
// Protege todas as rotas /app/* — requer sessão válida (user ou admin)
// v7.1: passa LIFEOS_KV ao verifySession para verificar blocklist de revogação
import { getCookie, verifySession } from '../_auth.js';

export async function onRequest({ request, env, next }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return Response.redirect(new URL('/login/', request.url), 302);

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret, env.LIFEOS_KV);

  if (!session) {
    return Response.redirect(new URL('/login/', request.url), 302);
  }

  // Admins também podem acessar /app
  return next();
}
