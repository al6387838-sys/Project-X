// LifeOS Enterprise — Login Unificado v17.0
// FASE 332 — Zero Block Login
// - LIFEOS_SESSION_SECRET + LIFEOS_KV são obrigatórios para qualquer login
// - LIFEOS_ADMIN_PASSWORD_HASH é necessário apenas para login admin
// - Mensagens de erro claras e acionáveis — nunca JSON bruto sem contexto
import { recordSession } from '../_account.js';
import { createSession, json, passwordDigest, safeEqual, sessionCookie, verifySession } from '../_auth.js';

const MAX_LOGIN_ATTEMPTS = 10;
const WINDOW_SECONDS = 60;

async function checkRateLimit(kv, ip) {
  if (!kv) return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
  const key = `rl:login:${ip}`;
  const raw = await kv.get(key);
  const data = raw ? JSON.parse(raw) : { count: 0, resetAt: Date.now() + WINDOW_SECONDS * 1000 };
  if (Date.now() > data.resetAt) {
    data.count = 0;
    data.resetAt = Date.now() + WINDOW_SECONDS * 1000;
  }
  data.count += 1;
  await kv.put(key, JSON.stringify(data), { expirationTtl: WINDOW_SECONDS });
  return { allowed: data.count <= MAX_LOGIN_ATTEMPTS, remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - data.count) };
}

async function issueSession(request, env, email, role) {
  const token = await createSession(email, role, env.LIFEOS_SESSION_SECRET);
  const session = await verifySession(token, env.LIFEOS_SESSION_SECRET);
  await recordSession(env.LIFEOS_KV, session, request);
  return token;
}

export async function onRequestPost({ request, env }) {
  // Verificar variáveis obrigatórias para qualquer login
  if (!env.LIFEOS_SESSION_SECRET) {
    return json(503, {
      ok: false,
      code: 'SESSION_SECRET_MISSING',
      error: 'Serviço de autenticação temporariamente indisponível. Configure LIFEOS_SESSION_SECRET no painel Cloudflare.',
    });
  }
  if (!env.LIFEOS_KV) {
    return json(503, {
      ok: false,
      code: 'KV_MISSING',
      error: 'Serviço de armazenamento temporariamente indisponível. Verifique o binding LIFEOS_KV no painel Cloudflare.',
    });
  }

  const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimit = await checkRateLimit(env.LIFEOS_KV, clientIP);
  if (!rateLimit.allowed) {
    return json(429, { ok: false, error: 'Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.' }, {
      'retry-after': String(WINDOW_SECONDS),
      'x-ratelimit-limit': String(MAX_LOGIN_ATTEMPTS),
      'x-ratelimit-remaining': '0',
    });
  }

  let input;
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }
  const username = String(input.email || input.username || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (!username || !password) return json(400, { ok: false, error: 'E-mail e senha são obrigatórios' });

  const inputHash = await passwordDigest(password);

  // Verificar login admin (apenas se LIFEOS_ADMIN_PASSWORD_HASH estiver configurado)
  if (env.LIFEOS_ADMIN_USER && env.LIFEOS_ADMIN_PASSWORD_HASH) {
    const isAdmin = safeEqual(username, env.LIFEOS_ADMIN_USER.toLowerCase())
      && safeEqual(inputHash, env.LIFEOS_ADMIN_PASSWORD_HASH);
    if (isAdmin) {
      const token = await issueSession(request, env, env.LIFEOS_ADMIN_USER, 'admin');
      return json(200, {
        ok: true,
        user: { username: env.LIFEOS_ADMIN_USER, role: 'admin', name: 'Administrador' },
        redirect: '/admin',
      }, { 'set-cookie': sessionCookie(token) });
    }
  }

  // Login de usuário regular via KV
  const userRaw = await env.LIFEOS_KV.get(`user:${username}`);
  if (!userRaw) return json(401, { ok: false, error: 'Credenciais inválidas. Verifique e tente novamente.' });
  const user = JSON.parse(userRaw);
  if (!safeEqual(inputHash, user.passwordHash)) {
    return json(401, { ok: false, error: 'Credenciais inválidas. Verifique e tente novamente.' });
  }
  if (!user.emailVerified) {
    return json(403, {
      ok: false,
      code: 'EMAIL_CONFIRMATION_REQUIRED',
      error: 'Confirme seu e-mail antes de entrar.',
      confirmationEmail: user.email,
    });
  }
  if (user.status && user.status !== 'active') {
    return json(403, { ok: false, error: 'Esta conta não está ativa.' });
  }

  const token = await issueSession(request, env, user.email, user.role || 'user');
  return json(200, {
    ok: true,
    user: { username: user.email, role: user.role || 'user', name: user.name },
    redirect: user.onboarded ? '/app' : '/app?onboarding=true',
  }, { 'set-cookie': sessionCookie(token) });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST, OPTIONS' });
}
