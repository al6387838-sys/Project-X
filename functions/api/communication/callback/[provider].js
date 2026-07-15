// LifeOS Enterprise — Communication Hub OAuth Callback v2.0
// Cloudflare Pages Function: GET /api/communication/callback/[provider]
// Phase 140 — Real Communication Hub
import { getCookie, json, verifySession } from '../../../_auth.js';

const TOKEN_ENDPOINTS = {
  gmail: 'https://oauth2.googleapis.com/token',
  outlook: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  whatsapp: 'https://graph.facebook.com/v18.0/oauth/access_token',
};

const CLIENT_ID_KEYS = {
  gmail: 'GOOGLE_CLIENT_ID',
  outlook: 'MICROSOFT_CLIENT_ID',
  whatsapp: 'WHATSAPP_APP_ID',
};

const CLIENT_SECRET_KEYS = {
  gmail: 'GOOGLE_CLIENT_SECRET',
  outlook: 'MICROSOFT_CLIENT_SECRET',
  whatsapp: 'WHATSAPP_APP_SECRET',
};

export async function onRequestGet({ request, env, params }) {
  const provider = params.provider;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !state || !TOKEN_ENDPOINTS[provider]) {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=invalid_callback`, 302);
  }

  let stateData;
  try {
    stateData = JSON.parse(atob(state));
  } catch {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=invalid_state`, 302);
  }

  // Validar state (máx 10 minutos)
  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=state_expired`, 302);
  }

  const clientId = env[CLIENT_ID_KEYS[provider]];
  const clientSecret = env[CLIENT_SECRET_KEYS[provider]];

  if (!clientId || !clientSecret) {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=not_configured`, 302);
  }

  const redirectUri = `${url.origin}/api/communication/callback/${provider}`;

  try {
    // Trocar code por access_token
    const tokenRes = await fetch(TOKEN_ENDPOINTS[provider], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return Response.redirect(`${url.origin}/app/modules/communication.html?error=token_failed`, 302);
    }

    // Salvar conexão no KV
    const kv = env.LIFEOS_KV;
    if (kv) {
      const connRaw = await kv.get(`comm:connections:${stateData.userId}`);
      const connections = connRaw ? JSON.parse(connRaw) : {};
      connections[provider] = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
        scope: tokenData.scope || '',
        connectedAt: new Date().toISOString(),
        lastSync: null,
        syncStatus: 'idle',
      };
      await kv.put(`comm:connections:${stateData.userId}`, JSON.stringify(connections));

      // Log
      const logsRaw = await kv.get(`comm:logs:${stateData.userId}`);
      const logs = logsRaw ? JSON.parse(logsRaw) : [];
      logs.unshift({
        type: 'connected',
        provider,
        timestamp: new Date().toISOString(),
      });
      await kv.put(`comm:logs:${stateData.userId}`, JSON.stringify(logs.slice(0, 200)));
    }

    return Response.redirect(`${url.origin}/app/modules/communication.html?connected=${provider}`, 302);
  } catch (err) {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=callback_error`, 302);
  }
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
