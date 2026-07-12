import type { Handler } from '@netlify/functions';
import { createSession, json, passwordDigest, safeEqual, sessionCookie } from './_auth.js';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });

  const configuredUser = process.env.LIFEOS_ADMIN_USER;
  const configuredHash = process.env.LIFEOS_ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.LIFEOS_SESSION_SECRET;
  if (!configuredUser || !configuredHash || !sessionSecret) {
    return json(503, { ok: false, error: 'Autenticação ainda não configurada' });
  }

  let input: { username?: string; password?: string } = {};
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Requisição inválida' });
  }

  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  const valid = safeEqual(username, configuredUser) && safeEqual(passwordDigest(password), configuredHash);
  if (!valid) return json(401, { ok: false, error: 'Credenciais inválidas' });

  const token = createSession(configuredUser, sessionSecret);
  return json(200, { ok: true, user: { username: configuredUser, role: 'admin' } }, { 'set-cookie': sessionCookie(token) });
};
