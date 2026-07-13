// LifeOS Enterprise — Login Unificado v7.0
// Cloudflare Pages Function: POST /api/login
// RBAC: redireciona ADMIN → /admin, USER → /app
// Rate limiting: máx 10 tentativas/min por IP
import { createSession, json, passwordDigest, safeEqual, sessionCookie } from '../_auth.js';

const MAX_LOGIN_ATTEMPTS = 10;
const WINDOW_SECONDS = 60;

async function checkRateLimit(kv, ip) {
  if (!kv) return { allowed: true };
  try {
    const rlKey = `rl:login:${ip}`;
    const raw = await kv.get(rlKey);
    const data = raw ? JSON.parse(raw) : { count: 0, resetAt: Date.now() + WINDOW_SECONDS * 1000 };
    if (Date.now() > data.resetAt) { data.count = 0; data.resetAt = Date.now() + WINDOW_SECONDS * 1000; }
    data.count += 1;
    await kv.put(rlKey, JSON.stringify(data), { expirationTtl: WINDOW_SECONDS });
    return { allowed: data.count <= MAX_LOGIN_ATTEMPTS, remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - data.count) };
  } catch (_) { return { allowed: true }; }
}

export async function onRequestPost({ request, env }) {
  const configuredAdminUser = env.LIFEOS_ADMIN_USER;
  const configuredAdminHash = env.LIFEOS_ADMIN_PASSWORD_HASH;
  const sessionSecret = env.LIFEOS_SESSION_SECRET;

  if (!configuredAdminUser || !configuredAdminHash || !sessionSecret) {
    return json(503, { ok: false, error: 'Autenticação ainda não configurada' });
  }

  // Rate limiting por IP
  const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const rl = await checkRateLimit(env.LIFEOS_KV, clientIP);
  if (!rl.allowed) {
    return json(429, { ok: false, error: 'Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.' }, {
      'retry-after': String(WINDOW_SECONDS),
      'x-ratelimit-limit': String(MAX_LOGIN_ATTEMPTS),
      'x-ratelimit-remaining': '0',
    });
  }

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const username = String(input.email || input.username || '').trim().toLowerCase();
  const password = String(input.password || '');

  if (!username || !password) {
    return json(400, { ok: false, error: 'E-mail e senha são obrigatórios' });
  }

  const inputHash = await passwordDigest(password);

  // Verificar admin
  const isAdmin =
    safeEqual(username, configuredAdminUser.toLowerCase()) &&
    safeEqual(inputHash, configuredAdminHash);

  if (isAdmin) {
    const token = await createSession(configuredAdminUser, 'admin', sessionSecret);
    return json(200, {
      ok: true,
      user: { username: configuredAdminUser, role: 'admin', name: 'Administrador' },
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
            redirect: userData.onboarded ? '/app' : '/app?onboarding=true',
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
