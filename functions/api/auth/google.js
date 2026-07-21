// LifeOS Enterprise — Google OAuth v2.0
// Cloudflare Pages Function: GET /api/auth/google
// FASE 332/333 — Fallback automático + Auto-detect
// - Se GOOGLE_CLIENT_ID/SECRET ausentes: redireciona para /login?oauth=google_unavailable
//   (NÃO retorna JSON bruto — nunca bloqueia o usuário)
// - Se configurado: inicia fluxo OAuth 2.0 real
// - HEAD: retorna 200 (configurado) ou 503 (não configurado) para o detector do frontend
import { json } from '../../_auth.js';

function isConfigured(env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export async function onRequestGet({ request, env }) {
  if (!isConfigured(env)) {
    // Fallback elegante: redirecionar para login com aviso — nunca bloquear
    const url = new URL(request.url);
    return Response.redirect(`${url.origin}/login?oauth=google_unavailable`, 302);
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/google/callback`;

  // Gerar state para CSRF protection
  const stateData = {
    ts: Date.now(),
    nonce: Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join(''),
  };
  const state = btoa(JSON.stringify(stateData));

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

export async function onRequestHead({ env }) {
  // HEAD: usado pelo frontend para detectar se Google OAuth está configurado
  // 200 = configurado, 503 = não configurado
  if (!isConfigured(env)) {
    return new Response(null, {
      status: 503,
      headers: {
        'x-oauth-provider': 'google',
        'x-oauth-configured': 'false',
        'cache-control': 'no-store',
      },
    });
  }
  return new Response(null, {
    status: 200,
    headers: {
      'x-oauth-provider': 'google',
      'x-oauth-configured': 'true',
      'cache-control': 'no-store',
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'HEAD') return onRequestHead({ env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, HEAD' });
}
