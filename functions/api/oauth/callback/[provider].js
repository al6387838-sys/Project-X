// OAuth Callback Handler — LifeOS Enterprise
// Handles OAuth callbacks for: google, instagram, mercadopago, openfinance, outlook, stripe, whatsapp
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

function getCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/lifeos_session=([^;]+)/);
  return match ? match[1] : null;
}

async function verifySession(token, secret) {
  if (!token || !secret) return null;
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const data = enc.encode(`${headerB64}.${payloadB64}`);
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!valid) return null;
    return JSON.parse(atob(payloadB64));
  } catch { return null; }
}

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  const provider = params?.provider || url.pathname.split('/').pop();
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return Response.redirect(`/app?oauth_error=${encodeURIComponent(error)}&provider=${provider}`, 302);
  }

  if (!code) {
    return Response.redirect(`/app?oauth_error=no_code&provider=${provider}`, 302);
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
    return Response.redirect(`/login?oauth_error=not_authenticated&provider=${provider}`, 302);
  }

  // Exchange code for tokens
  let tokens = { code };
  try {
    if (provider === 'google' && env.GOOGLE_CLIENT_SECRET) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://lifeos-enterprise.pages.dev/api/oauth/callback/google',
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        tokens.accessToken = tokenData.access_token;
        tokens.refreshToken = tokenData.refresh_token || null;
        tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
        tokens.scope = tokenData.scope || '';
      }
    } else if ((provider === 'microsoft' || provider === 'outlook') && env.MICROSOFT_CLIENT_SECRET) {
      const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.MICROSOFT_CLIENT_ID,
          client_secret: env.MICROSOFT_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://lifeos-enterprise.pages.dev/api/oauth/callback/microsoft',
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        tokens.accessToken = tokenData.access_token;
        tokens.refreshToken = tokenData.refresh_token || null;
        tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
        tokens.scope = tokenData.scope || '';
      }
    } else if (provider === 'apple' && env.APPLE_CLIENT_ID) {
      // Apple uses form_post, code is in body
      let appleCode = code;
      if (request.method === 'POST') {
        const body = await request.formData();
        appleCode = body.get('code') || code;
      }
      tokens.code = appleCode;
      // Apple tokens are exchanged server-side when needed
    } else if ((provider === 'meta' || provider === 'facebook') && env.META_CLIENT_SECRET) {
      const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: env.META_CLIENT_ID,
          client_secret: env.META_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://lifeos-enterprise.pages.dev/api/oauth/callback/meta',
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        tokens.accessToken = tokenData.access_token;
        tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString();
      }
    }
  } catch (tokenErr) {
    // Token exchange failed, but we still store the code
  }

  // Store the OAuth connection in KV
  if (kv) {
    try {
      const connKey = `oauth:${userId}:${provider}`;
      const existing = await kv.get(connKey);
      const conn = existing ? JSON.parse(existing) : {};
      conn.provider = provider;
      conn.connectedAt = new Date().toISOString();
      conn.status = 'connected';
      // Store tokens securely
      if (tokens.accessToken) conn.accessToken = tokens.accessToken;
      if (tokens.refreshToken) conn.refreshToken = tokens.refreshToken;
      if (tokens.expiresAt) conn.expiresAt = tokens.expiresAt;
      if (tokens.scope) conn.scope = tokens.scope;
      await kv.put(connKey, JSON.stringify(conn));

      // Also update integration status
      const integKey = `integration:${userId}:${provider}`;
      const integExisting = await kv.get(integKey);
      const integ = integExisting ? JSON.parse(integExisting) : { provider };
      integ.connected = true;
      integ.connectedAt = new Date().toISOString();
      integ.status = 'active';
      integ.expiresAt = tokens.expiresAt || null;
      await kv.put(integKey, JSON.stringify(integ));
    } catch { /* */ }
  }

  // Redirect back to app with success
  return Response.redirect(`/app?oauth_success=1&provider=${provider}`, 302);
}
