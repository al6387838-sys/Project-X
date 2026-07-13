// LifeOS Enterprise — Admin Login
// Cloudflare Pages Function: POST /api/admin-login

import { createSession, json, passwordDigest, safeEqual, sessionCookie } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const configuredUser = env.LIFEOS_ADMIN_USER;
  const configuredHash = env.LIFEOS_ADMIN_PASSWORD_HASH;
  const sessionSecret = env.LIFEOS_SESSION_SECRET;

  if (!configuredUser || !configuredHash || !sessionSecret) {
    return json(503, { ok: false, error: 'Autenticação ainda não configurada' });
  }

  let input = {};
  try {
    input = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Requisição inválida' });
  }

  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  const inputHash = await passwordDigest(password);

  const valid = safeEqual(username, configuredUser) && safeEqual(inputHash, configuredHash);
  if (!valid) return json(401, { ok: false, error: 'Credenciais inválidas' });

  const token = await createSession(configuredUser, sessionSecret);
  return json(200, { ok: true, user: { username: configuredUser, role: 'admin' } }, {
    'set-cookie': sessionCookie(token),
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
}

export async function onRequest() {
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
