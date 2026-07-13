// LifeOS Enterprise — Register v7.0
// Cloudflare Pages Function: POST /api/register
// Rate limiting: máx 5 registros/hora por IP
import { createSession, json, passwordDigest, sessionCookie } from '../_auth.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const MAX_REGISTER_ATTEMPTS = 5;
const WINDOW_SECONDS = 3600;

async function checkRateLimit(kv, ip) {
  if (!kv) return { allowed: true };
  try {
    const rlKey = `rl:register:${ip}`;
    const raw = await kv.get(rlKey);
    const data = raw ? JSON.parse(raw) : { count: 0, resetAt: Date.now() + WINDOW_SECONDS * 1000 };
    if (Date.now() > data.resetAt) { data.count = 0; data.resetAt = Date.now() + WINDOW_SECONDS * 1000; }
    data.count += 1;
    await kv.put(rlKey, JSON.stringify(data), { expirationTtl: WINDOW_SECONDS });
    return { allowed: data.count <= MAX_REGISTER_ATTEMPTS };
  } catch (_) { return { allowed: true }; }
}

export async function onRequestPost({ request, env }) {
  const sessionSecret = env.LIFEOS_SESSION_SECRET;
  if (!sessionSecret) {
    return json(503, { ok: false, error: 'Serviço temporariamente indisponível' });
  }

  const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const rl = await checkRateLimit(env.LIFEOS_KV, clientIP);
  if (!rl.allowed) {
    return json(429, { ok: false, error: 'Limite de registros excedido. Tente novamente em 1 hora.' }, { 'retry-after': String(WINDOW_SECONDS) });
  }

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');

  if (!name || name.length < 2 || name.length > 100) {
    return json(400, { ok: false, error: 'Nome deve ter entre 2 e 100 caracteres' });
  }
  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    return json(400, { ok: false, error: 'E-mail inválido' });
  }
  if (!password || password.length < 8 || password.length > 128) {
    return json(400, { ok: false, error: 'Senha deve ter entre 8 e 128 caracteres' });
  }

  if (!env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Armazenamento não disponível' });
  }

  const existing = await env.LIFEOS_KV.get(`user:${email}`);
  if (existing) {
    return json(409, { ok: false, error: 'Este e-mail já está cadastrado' });
  }

  const passwordHash = await passwordDigest(password);
  const userData = {
    email,
    name,
    passwordHash,
    role: 'user',
    plan: 'free',
    onboarded: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lifeScore: 0,
    timezone: 'America/Sao_Paulo',
  };

  await env.LIFEOS_KV.put(`user:${email}`, JSON.stringify(userData));

  const token = await createSession(email, 'user', sessionSecret);
  return json(201, {
    ok: true,
    user: { username: email, role: 'user', name },
    redirect: '/app?onboarding=true',
  }, { 'set-cookie': sessionCookie(token) });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return onRequestOptions();
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
