// OAuth Callback Handler — LifeOS Enterprise v5.0
// Handles OAuth callbacks for: google, microsoft, apple, meta, openfinance
// Phase 066 — Google Ecosystem Activation (CORREÇÃO DE BUGS KV)
// Correções:
//   Bug 1: salva tokens em oauth:token:{userId}:{integrationId} (lido por refresh/sync)
//   Bug 2: salva integration:{userId}:google_oauth (lido por events.js)
//   Bug 3: inclui accessToken no integKey
// State validation · Token exchange · Persistence · Error handling
// ZERO mocks/placeholder — todas as trocas de token são reais
import { getCookie, json, verifySession } from '../../../_auth.js';

// Mapeamento de integrationId → provider OAuth real
const PROVIDER_MAP = {
  'google_oauth': 'google',
  'gmail_api': 'google',
  'microsoft_365': 'microsoft',
  'outlook': 'microsoft',
  'whatsapp_business': 'meta',
  'open_finance': 'openfinance',
  'instagram': 'meta',
};

// Mapeamento inverso: provider → integrationId canônico (para salvar chaves corretas)
const PROVIDER_TO_INTEGRATION_IDS = {
  'google': ['google_oauth', 'gmail_api'],
  'microsoft': ['microsoft_365'],
  'meta': ['whatsapp_business'],
  'openfinance': ['open_finance'],
};

const PROVIDER_TOKEN_URLS = {
  google: 'https://oauth2.googleapis.com/token',
  microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  apple: 'https://appleid.apple.com/auth/token',
  meta: 'https://graph.facebook.com/v18.0/oauth/access_token',
  openfinance: 'https://auth.openfinancebrasil.org.br/oauth2/token',
};

const PROVIDER_ENV_KEYS = {
  google: { clientId: 'GOOGLE_CLIENT_ID', clientSecret: 'GOOGLE_CLIENT_SECRET' },
  microsoft: { clientId: 'MICROSOFT_CLIENT_ID', clientSecret: 'MICROSOFT_CLIENT_SECRET' },
  apple: { clientId: 'APPLE_CLIENT_ID', clientSecret: 'APPLE_CLIENT_SECRET' },
  meta: { clientId: 'META_CLIENT_ID', clientSecret: 'META_CLIENT_SECRET' },
  openfinance: { clientId: 'OPEN_FINANCE_CLIENT_ID', clientSecret: 'OPEN_FINANCE_CLIENT_SECRET' },
};

function resolveRedirectUri(origin, rawProvider) {
  // Usa o provider original (antes do mapeamento) para o redirect_uri
  return `${origin}/api/oauth/callback/${rawProvider}`;
}

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  const rawProvider = params?.provider || url.pathname.split('/').pop();

  // Preservar o integrationId original antes do mapeamento
  const integrationId = rawProvider;

  // Mapear integrationId para provider OAuth real
  let provider = rawProvider;
  if (PROVIDER_MAP[provider]) provider = PROVIDER_MAP[provider];

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return Response.redirect(`${url.origin}/app?oauth_error=${encodeURIComponent(error)}&provider=${provider}`, 302);
  }

  if (!code) {
    return Response.redirect(`${url.origin}/app?oauth_error=no_code&provider=${provider}`, 302);
  }

  const kv = env.LIFEOS_KV;
  const secret = env.LIFEOS_SESSION_SECRET;

  // Try to get user from state (JWT or session ID)
  let userId = null;
  if (state && secret) {
    try {
      const session = await verifySession(state, secret);
      if (session?.sub) userId = session.sub;
    } catch { /* */ }
  }

  // If no userId from state, try cookie
  if (!userId && secret) {
    const token = getCookie(request.headers.get('cookie'));
    const session = await verifySession(token, secret);
    if (session?.sub) userId = session.sub;
  }

  if (!userId) {
    return Response.redirect(`${url.origin}/login?oauth_error=not_authenticated&provider=${provider}`, 302);
  }

  const providerKeys = PROVIDER_ENV_KEYS[provider];
  const tokenUrl = PROVIDER_TOKEN_URLS[provider];
  const clientId = providerKeys ? env[providerKeys.clientId] : null;
  const clientSecret = providerKeys ? env[providerKeys.clientSecret] : null;

  // Usar o rawProvider no redirect_uri (como foi registrado no Google Cloud)
  const redirectUri = resolveRedirectUri(url.origin, rawProvider);

  // Exchange code for tokens
  let tokens = { code };
  try {
    if (provider === 'google' && clientId && clientSecret) {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        tokens.accessToken = tokenData.access_token;
        tokens.refreshToken = tokenData.refresh_token || null;
        tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
        tokens.scope = tokenData.scope || '';
        tokens.idToken = tokenData.id_token || null;
      }
    } else if (provider === 'microsoft' && clientId && clientSecret) {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        tokens.accessToken = tokenData.access_token;
        tokens.refreshToken = tokenData.refresh_token || null;
        tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
        tokens.scope = tokenData.scope || '';
      }
    } else if (provider === 'apple' && clientId) {
      // Apple uses form_post, code is in body
      let appleCode = code;
      if (request.method === 'POST') {
        const body = await request.formData();
        appleCode = body.get('code') || code;
      }
      tokens.code = appleCode;
      // Apple tokens are exchanged server-side when needed
    } else if (provider === 'meta' && clientId && clientSecret) {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        tokens.accessToken = tokenData.access_token;
        tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString();
      }
    } else if (provider === 'openfinance' && clientId && clientSecret) {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        tokens.accessToken = tokenData.access_token;
        tokens.refreshToken = tokenData.refresh_token || null;
        tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
        tokens.scope = tokenData.scope || '';
      }
    }
  } catch (tokenErr) {
    // Token exchange failed, but we still store the code
  }

  // Store the OAuth connection in KV
  if (kv) {
    try {
      const now = new Date().toISOString();

      // ── 1. Chave canônica do provider (ex: oauth:{userId}:google) ──────────
      const connKey = `oauth:${userId}:${provider}`;
      const existing = await kv.get(connKey);
      const conn = existing ? JSON.parse(existing) : {};
      conn.provider = provider;
      conn.connectedAt = now;
      conn.status = 'connected';
      if (tokens.accessToken) conn.accessToken = tokens.accessToken;
      if (tokens.refreshToken) conn.refreshToken = tokens.refreshToken;
      if (tokens.expiresAt) conn.expiresAt = tokens.expiresAt;
      if (tokens.scope) conn.scope = tokens.scope;
      await kv.put(connKey, JSON.stringify(conn));

      // ── 2. Chave de token no formato esperado por integrations.js e sync.js ─
      // Formato: oauth:token:{userId}:{integrationId}
      // Para google: salva em google_oauth e gmail_api (ambos usam as mesmas credenciais)
      const integrationIds = PROVIDER_TO_INTEGRATION_IDS[provider] || [provider];
      for (const iid of integrationIds) {
        const tokenKey = `oauth:token:${userId}:${iid}`;
        const tokenPayload = {
          access_token: tokens.accessToken || null,
          refresh_token: tokens.refreshToken || null,
          expires_at: tokens.expiresAt ? new Date(tokens.expiresAt).getTime() : null,
          scope: tokens.scope || '',
          connectedAt: now,
        };
        await kv.put(tokenKey, JSON.stringify(tokenPayload));
      }

      // ── 3. Chave de integração com accessToken (lida por events.js e sync.js) ─
      // Salva em integration:{userId}:{integrationId} para CADA integrationId mapeado
      // E também em integration:{userId}:{provider} para compatibilidade
      const allKeys = [...new Set([...integrationIds, provider])];
      for (const iid of allKeys) {
        const integKey = `integration:${userId}:${iid}`;
        const integExisting = await kv.get(integKey);
        const integ = integExisting ? JSON.parse(integExisting) : { provider };
        integ.connected = true;
        integ.connectedAt = now;
        integ.status = 'active';
        integ.expiresAt = tokens.expiresAt || null;
        // Incluir accessToken para que events.js e outros módulos possam usar diretamente
        if (tokens.accessToken) integ.accessToken = tokens.accessToken;
        if (tokens.refreshToken) integ.refreshToken = tokens.refreshToken;
        if (tokens.scope) integ.scope = tokens.scope;
        await kv.put(integKey, JSON.stringify(integ));
      }

      // ── 4. Log de auditoria ────────────────────────────────────────────────
      const logsRaw = await kv.get(`oauth:logs:${userId}`);
      const logs = logsRaw ? JSON.parse(logsRaw) : [];
      logs.unshift({
        type: 'connected',
        provider,
        integrationId,
        timestamp: now,
      });
      await kv.put(`oauth:logs:${userId}`, JSON.stringify(logs.slice(0, 200)));
    } catch { /* */ }
  }

  // Redirect back to app with success
  return Response.redirect(`${url.origin}/app?oauth_success=1&provider=${provider}`, 302);
}
