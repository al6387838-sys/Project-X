// LifeOS Enterprise — Admin Login v7.0
// Cloudflare Pages Function: POST /api/admin-login
// FASE 332 — Zero Block Login: mensagens de erro claras e acionáveis
import { createSession, json, passwordDigest, safeEqual, sessionCookie } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const configuredUser = env.LIFEOS_ADMIN_USER;
  const configuredHash = env.LIFEOS_ADMIN_PASSWORD_HASH;
  const sessionSecret = env.LIFEOS_SESSION_SECRET;

  if (!sessionSecret) {
    return json(503, {
      ok: false,
      code: 'SESSION_SECRET_MISSING',
      error: 'Serviço de autenticação indisponível. Configure LIFEOS_SESSION_SECRET no painel Cloudflare Pages → Settings → Environment Variables.',
    });
  }
  if (!configuredUser || !configuredHash) {
    return json(503, {
      ok: false,
      code: 'ADMIN_CREDENTIALS_MISSING',
      error: 'Credenciais administrativas não configuradas. Configure LIFEOS_ADMIN_USER e LIFEOS_ADMIN_PASSWORD_HASH no painel Cloudflare Pages.',
    });
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

  const token = await createSession(configuredUser, 'admin', sessionSecret);
  return json(200, { ok: true, user: { username: configuredUser, role: 'admin' }, redirect: '/admin' }, {
    'set-cookie': sessionCookie(token),
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return onRequestOptions();
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
