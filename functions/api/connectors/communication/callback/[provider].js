// LifeOS Enterprise — Communication Connectors OAuth Callback v2.0
// Cloudflare Pages Function: GET /api/connectors/communication/callback/:provider
// Phase 270 — Communication Callback Real (FINAL)
import { json } from '../../../../_auth.js';

const TOKEN_URLS = {
  whatsapp: 'https://graph.facebook.com/v18.0/oauth/access_token',
  gmail: 'https://oauth2.googleapis.com/token',
  outlook: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

const CLIENT_ID_KEYS = {
  whatsapp: 'WHATSAPP_APP_ID',
  gmail: 'GOOGLE_CLIENT_ID',
  outlook: 'MICROSOFT_CLIENT_ID',
};

const CLIENT_SECRET_KEYS = {
  whatsapp: 'WHATSAPP_APP_SECRET',
  gmail: 'GOOGLE_CLIENT_SECRET',
  outlook: 'MICROSOFT_CLIENT_SECRET',
};

const USERINFO_URLS = {
  gmail: 'https://www.googleapis.com/oauth2/v3/userinfo',
  outlook: 'https://graph.microsoft.com/v1.0/me',
};

export async function onRequestGet({ request, env, params }) {
  const providerKey = params.provider;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !state || !TOKEN_URLS[providerKey]) {
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

  const clientId = env[CLIENT_ID_KEYS[providerKey]];
  const clientSecret = env[CLIENT_SECRET_KEYS[providerKey]];

  if (!clientId || !clientSecret) {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=not_configured`, 302);
  }

  const redirectUri = `${url.origin}/api/connectors/communication/callback/${providerKey}`;

  try {
    const tokenRes = await fetch(TOKEN_URLS[providerKey], {
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

    const kv = env.LIFEOS_KV;
    if (kv) {
      const connKey = `connectors:comm:${stateData.userEmail || stateData.userId}`;
      const connRaw = await kv.get(connKey);
      const conn = connRaw ? JSON.parse(connRaw) : {};
      conn[providerKey] = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
        scope: tokenData.scope || '',
        connectedAt: new Date().toISOString(),
      };
      await kv.put(connKey, JSON.stringify(conn));

      // Log
      const logsRaw = await kv.get(`comm:logs:${stateData.userId || stateData.userEmail}`);
      const logs = logsRaw ? JSON.parse(logsRaw) : [];
      logs.unshift({
        type: 'connected',
        provider: providerKey,
        timestamp: new Date().toISOString(),
      });
      await kv.put(`comm:logs:${stateData.userId || stateData.userEmail}`, JSON.stringify(logs.slice(0, 200)));
    }

    return Response.redirect(`${url.origin}/app/modules/communication.html?connected=${providerKey}`, 302);
  } catch (err) {
    return Response.redirect(`${url.origin}/app/modules/communication.html?error=callback_error`, 302);
  }
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
