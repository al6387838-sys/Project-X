// LifeOS Enterprise — Middleware /app
// Protege todas as rotas /app/* — requer sessão válida (user ou admin)
import { getCookie, verifySession } from '../_auth.js';

export async function onRequest({ request, env, next }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return Response.redirect(new URL('/login', request.url), 302);

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);

  if (!session) {
    return Response.redirect(new URL('/login', request.url), 302);
  }

  // Admins também podem acessar /app
  return next();
}
