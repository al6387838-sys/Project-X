// LifeOS Enterprise — Apple Sign In v1.0
// Cloudflare Pages Function: GET /api/auth/apple
// Phase 132 — Real Authentication
// Inicia fluxo Sign in with Apple (OAuth 2.0 / OpenID Connect)
import { json } from '../../_auth.js';

export async function onRequestGet({ request, env }) {
  const clientId = env.APPLE_CLIENT_ID; // Apple Service ID (ex: com.lifeos.app)
  if (!clientId) {
    return json(503, {
      ok: false,
      error: 'Apple Sign In não configurado. Configure APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID e APPLE_PRIVATE_KEY nas variáveis de ambiente.',
      setup_required: true,
    });
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/apple/callback`;

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
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  });

  const authUrl = `https://appleid.apple.com/auth/authorize?${params}`;
  return Response.redirect(authUrl, 302);
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
