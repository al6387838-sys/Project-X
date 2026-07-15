// LifeOS Enterprise — Google OAuth v1.0
// Cloudflare Pages Function: GET /api/auth/google
// Phase 132 — Real Authentication
// Inicia fluxo OAuth 2.0 com Google
import { json } from '../../_auth.js';

export async function onRequestGet({ request, env }) {
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return json(503, {
      ok: false,
      error: 'Google OAuth não configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas variáveis de ambiente do Cloudflare Pages.',
      setup_required: true,
    });
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
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // Redirecionar para Google
  return Response.redirect(authUrl, 302);
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
