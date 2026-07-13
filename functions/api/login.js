// LifeOS Enterprise — Login Unificado v6.0
// Cloudflare Pages Function: POST /api/login
// RBAC: redireciona ADMIN → /admin, USER → /app
import { createSession, json, passwordDigest, safeEqual, sessionCookie } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const configuredAdminUser = env.LIFEOS_ADMIN_USER;
  const configuredAdminHash = env.LIFEOS_ADMIN_PASSWORD_HASH;
  const sessionSecret = env.LIFEOS_SESSION_SECRET;

  if (!configuredAdminUser || !configuredAdminHash || !sessionSecret) {
    return json(503, { ok: false, error: 'Autenticação ainda não configurada' });
  }

  let input = {};
  try {
    input = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Requisição inválida' });
  }

  const username = String(input.username || '').trim().toLowerCase();
  const password = String(input.password || '');

  if (!username || !password) {
    return json(400, { ok: false, error: 'E-mail e senha são obrigatórios' });
  }

  // Verificar credenciais de ADMIN
  const inputHash = await passwordDigest(password);
  const isAdmin =
    safeEqual(username, configuredAdminUser.toLowerCase()) &&
    safeEqual(inputHash, configuredAdminHash);

  if (isAdmin) {
    const token = await createSession(configuredAdminUser, 'admin', sessionSecret);
    return json(200, {
      ok: true,
      user: { username: configuredAdminUser, role: 'admin' },
      redirect: '/admin',
    }, { 'set-cookie': sessionCookie(token) });
  }

  // Verificar usuários comuns (KV Store)
  if (env.LIFEOS_KV) {
    try {
      const userKey = `user:${username}`;
      const userDataRaw = await env.LIFEOS_KV.get(userKey);
      if (userDataRaw) {
        const userData = JSON.parse(userDataRaw);
        const userHash = await passwordDigest(password);
        if (safeEqual(userHash, userData.passwordHash)) {
          const token = await createSession(userData.email, 'user', sessionSecret);
          return json(200, {
            ok: true,
            user: { username: userData.email, role: 'user', name: userData.name },
            redirect: '/app',
          }, { 'set-cookie': sessionCookie(token) });
        }
      }
    } catch (_) { /* KV error — continuar */ }
  }

  return json(401, { ok: false, error: 'Credenciais inválidas. Verifique e tente novamente.' });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return onRequestOptions();
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
