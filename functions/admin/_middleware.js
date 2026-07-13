// LifeOS Enterprise — Middleware /admin
// Protege todas as rotas /admin/* — requer role = 'admin'
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

  if (session.role !== 'admin') {
    // Usuário comum tentando acessar /admin → redirecionar para /app
    return Response.redirect(new URL('/app', request.url), 302);
  }

  return next();
}
