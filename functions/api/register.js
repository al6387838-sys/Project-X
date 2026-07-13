// LifeOS Enterprise — Register v6.0
// Cloudflare Pages Function: POST /api/register
import { createSession, json, passwordDigest, sessionCookie } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const sessionSecret = env.LIFEOS_SESSION_SECRET;
  if (!sessionSecret) {
    return json(503, { ok: false, error: 'Serviço temporariamente indisponível' });
  }

  let input = {};
  try {
    input = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Requisição inválida' });
  }

  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');

  if (!name || name.length < 2) {
    return json(400, { ok: false, error: 'Nome deve ter pelo menos 2 caracteres' });
  }
  if (!email || !email.includes('@')) {
    return json(400, { ok: false, error: 'E-mail inválido' });
  }
  if (!password || password.length < 8) {
    return json(400, { ok: false, error: 'Senha deve ter pelo menos 8 caracteres' });
  }

  if (!env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Armazenamento não disponível' });
  }

  // Verificar se e-mail já existe
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
    createdAt: new Date().toISOString(),
    lifeScore: 0,
  };

  await env.LIFEOS_KV.put(`user:${email}`, JSON.stringify(userData));

  const token = await createSession(email, 'user', sessionSecret);
  return json(201, {
    ok: true,
    user: { username: email, role: 'user', name },
    redirect: '/app',
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
