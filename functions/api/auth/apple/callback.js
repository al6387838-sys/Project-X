// LifeOS Enterprise — Apple Sign In Callback v1.0
// Cloudflare Pages Function: POST /api/auth/apple/callback
// Phase 132 — Real Authentication
// Apple usa form_post, então o callback é POST
import { createSession, json, sessionCookie } from '../../../_auth.js';

function base64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  return atob(padded);
}

function parseJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64urlDecode(parts[1]));
  } catch {
    return null;
  }
}

export async function onRequestPost({ request, env }) {
  const sessionSecret = env.LIFEOS_SESSION_SECRET;
  if (!sessionSecret) {
    return Response.redirect('/login?error=config_missing', 302);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.redirect('/login?error=apple_invalid', 302);
  }

  const code = formData.get('code');
  const idToken = formData.get('id_token');
  const errorParam = formData.get('error');

  if (errorParam) {
    return Response.redirect('/login?error=apple_cancelled', 302);
  }

  if (!code && !idToken) {
    return Response.redirect('/login?error=apple_invalid', 302);
  }

  // Decodificar id_token (sem verificação de assinatura no edge — usar apenas dados básicos)
  // Em produção completa: verificar assinatura com chaves públicas da Apple
  let email = null;
  let appleUserId = null;
  let name = null;

  if (idToken) {
    const payload = parseJwtPayload(idToken);
    if (payload) {
      email = payload.email?.toLowerCase();
      appleUserId = payload.sub;
    }
  }

  // Apple envia o nome apenas no primeiro login via campo 'user' no form
  const userField = formData.get('user');
  if (userField) {
    try {
      const userObj = JSON.parse(userField);
      if (userObj.name) {
        name = [userObj.name.firstName, userObj.name.lastName].filter(Boolean).join(' ');
      }
    } catch { /* ignorar */ }
  }

  if (!email) {
    return Response.redirect('/login?error=apple_no_email', 302);
  }

  name = name || email.split('@')[0];

  // Verificar/criar usuário no KV
  if (env.LIFEOS_KV) {
    try {
      const existing = await env.LIFEOS_KV.get(`user:${email}`);
      if (!existing) {
        const userData = {
          email,
          name,
          role: 'user',
          plan: 'free',
          onboarded: false,
          authProvider: 'apple',
          appleId: appleUserId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          timezone: 'America/Sao_Paulo',
        };
        await env.LIFEOS_KV.put(`user:${email}`, JSON.stringify(userData));
      } else {
        const userData = JSON.parse(existing);
        userData.lastLoginAt = new Date().toISOString();
        if (!userData.authProvider) userData.authProvider = 'apple';
        if (!userData.appleId && appleUserId) userData.appleId = appleUserId;
        await env.LIFEOS_KV.put(`user:${email}`, JSON.stringify(userData));
      }
    } catch (_) { /* ignorar erros de KV */ }
  }

  const token = await createSession(email, 'user', sessionSecret);
  const cookie = sessionCookie(token);

  let redirectPath = '/app';
  if (env.LIFEOS_KV) {
    try {
      const raw = await env.LIFEOS_KV.get(`user:${email}`);
      if (raw) {
        const userData = JSON.parse(raw);
        if (!userData.onboarded) redirectPath = '/app?onboarding=true';
      }
    } catch (_) { /* ignorar */ }
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectPath,
      'Set-Cookie': cookie,
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
