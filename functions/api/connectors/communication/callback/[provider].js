// LifeOS Enterprise — Communication Connector OAuth Callback v1.0
// Cloudflare Pages Function: GET /api/connectors/communication/callback/:provider
// Phase 133 — Communication Connectors
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

  if (error || !code || !state) {
    return Response.redirect(`${url.origin}/app?connector_error=${providerKey}_cancelled`, 302);
  }

  // Decodificar state
  let stateData;
  try {
    stateData = JSON.parse(atob(state));
  } catch {
    return Response.redirect(`${url.origin}/app?connector_error=${providerKey}_invalid_state`, 302);
  }

  const userEmail = stateData.user;
  if (!userEmail) {
    return Response.redirect(`${url.origin}/app?connector_error=${providerKey}_no_user`, 302);
  }

  const clientId = env[CLIENT_ID_KEYS[providerKey]];
  const clientSecret = env[CLIENT_SECRET_KEYS[providerKey]];
  const tokenUrl = TOKEN_URLS[providerKey];

  if (!clientId || !clientSecret || !tokenUrl) {
    return Response.redirect(`${url.origin}/app?connector_error=${providerKey}_config`, 302);
  }

  const redirectUri = `${url.origin}/api/connectors/communication/callback/${providerKey}`;

  try {
    // Trocar código por token
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return Response.redirect(`${url.origin}/app?connector_error=${providerKey}_token_failed`, 302);
    }

    const tokenData = await tokenRes.json();

    // Obter informações da conta conectada
    let accountName = '';
    let accountEmail = '';

    if (USERINFO_URLS[providerKey] && tokenData.access_token) {
      try {
        const infoRes = await fetch(USERINFO_URLS[providerKey], {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (infoRes.ok) {
          const info = await infoRes.json();
          accountEmail = info.email || info.mail || info.userPrincipalName || '';
          accountName = info.name || info.displayName || accountEmail.split('@')[0] || '';
        }
      } catch (_) { /* ignorar */ }
    }

    // Salvar conexão no KV
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`connectors:comm:${userEmail}`);
        const connections = raw ? JSON.parse(raw) : {};
        connections[providerKey] = {
          connected: true,
          connectedAt: new Date().toISOString(),
          expiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : new Date(Date.now() + 3600 * 1000).toISOString(),
          accountName,
          accountEmail,
          // Armazenar tokens de forma segura (sem expor no frontend)
          _accessToken: tokenData.access_token,
          _refreshToken: tokenData.refresh_token || null,
        };
        await env.LIFEOS_KV.put(`connectors:comm:${userEmail}`, JSON.stringify(connections));
      } catch (_) { /* ignorar */ }
    }

    return Response.redirect(`${url.origin}/app?connector_success=${providerKey}`, 302);
  } catch (_) {
    return Response.redirect(`${url.origin}/app?connector_error=${providerKey}_error`, 302);
  }
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'GET') return onRequestGet({ request, env, params });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
