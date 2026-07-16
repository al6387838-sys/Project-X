// LifeOS Enterprise — Register v16.5
// Cloudflare Pages Function: POST /api/register
import { EMAIL_CONFIRMATION_TTL_SECONDS, randomToken } from '../_account.js';
import { json, passwordDigest } from '../_auth.js';
import { confirmationEmail, sendTransactionalEmail } from '../_email.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const MAX_REGISTER_ATTEMPTS = 5;
const WINDOW_SECONDS = 3600;

async function checkRateLimit(kv, ip) {
  if (!kv) return { allowed: false };
  const key = `rl:register:${ip}`;
  const raw = await kv.get(key);
  const data = raw ? JSON.parse(raw) : { count: 0, resetAt: Date.now() + WINDOW_SECONDS * 1000 };
  if (Date.now() > data.resetAt) {
    data.count = 0;
    data.resetAt = Date.now() + WINDOW_SECONDS * 1000;
  }
  data.count += 1;
  await kv.put(key, JSON.stringify(data), { expirationTtl: WINDOW_SECONDS });
  return { allowed: data.count <= MAX_REGISTER_ATTEMPTS };
}

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento não disponível' });

  const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimit = await checkRateLimit(env.LIFEOS_KV, clientIP);
  if (!rateLimit.allowed) {
    return json(429, { ok: false, error: 'Limite de registros excedido. Tente novamente em 1 hora.' }, { 'retry-after': String(WINDOW_SECONDS) });
  }

  let input;
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');

  if (name.length < 2 || name.length > 100) return json(400, { ok: false, error: 'Nome deve ter entre 2 e 100 caracteres' });
  if (!EMAIL_REGEX.test(email) || email.length > 254) return json(400, { ok: false, error: 'E-mail inválido' });
  if (password.length < 8 || password.length > 128) return json(400, { ok: false, error: 'Senha deve ter entre 8 e 128 caracteres' });

  const existingRaw = await env.LIFEOS_KV.get(`user:${email}`);
  if (existingRaw) {
    const existing = JSON.parse(existingRaw);
    return json(409, {
      ok: false,
      code: existing.emailVerified ? 'EMAIL_ALREADY_REGISTERED' : 'EMAIL_CONFIRMATION_REQUIRED',
      error: existing.emailVerified
        ? 'Este e-mail já está cadastrado'
        : 'Conta criada, mas o e-mail ainda não foi confirmado. Solicite um novo link.',
    });
  }

  const now = new Date().toISOString();
  const userData = {
    email,
    name,
    passwordHash: await passwordDigest(password),
    role: 'user',
    plan: 'free',
    status: 'pending_verification',
    emailVerified: false,
    emailVerifiedAt: null,
    onboarded: false,
    createdAt: now,
    updatedAt: now,
    lifeScore: 0,
    timezone: 'America/Sao_Paulo',
  };
  await env.LIFEOS_KV.put(`user:${email}`, JSON.stringify(userData));

  const token = randomToken();
  await env.LIFEOS_KV.put(`email-confirm:${token}`, JSON.stringify({ email, createdAt: now }), {
    expirationTtl: EMAIL_CONFIRMATION_TTL_SECONDS,
  });
  const origin = new URL(request.url).origin;
  const delivery = await sendTransactionalEmail(env, confirmationEmail(email, `${origin}/confirm-email?token=${token}`));
  if (!delivery.ok) {
    await env.LIFEOS_KV.delete(`email-confirm:${token}`);
    return json(503, {
      ok: false,
      code: delivery.error,
      error: 'Conta criada, mas o serviço de e-mail ainda não está disponível. Solicite um novo link após a configuração do provedor.',
    });
  }

  return json(201, {
    ok: true,
    requiresEmailConfirmation: true,
    message: 'Conta criada. Confirme seu e-mail para ativar o acesso.',
    redirect: `/confirm-email?email=${encodeURIComponent(email)}`,
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST, OPTIONS' });
}
