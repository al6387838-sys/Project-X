import type { Handler } from '@netlify/functions';
import { getCookie, json, verifySession } from './_auth.js';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
  const secret = process.env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, authenticated: false, error: 'Autenticação ainda não configurada' });

  const session = verifySession(getCookie(event.headers.cookie), secret);
  if (!session) return json(401, { ok: false, authenticated: false });
  return json(200, { ok: true, authenticated: true, user: { username: session.sub, role: session.role } });
};
