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

  // Store the OAuth connection in KV
  if (kv) {
    try {
      const connKey = `oauth:${userId}:${provider}`;
      const existing = await kv.get(connKey);
      const conn = existing ? JSON.parse(existing) : {};
      conn.provider = provider;
      conn.code = code; // In production, exchange for token here
      conn.connectedAt = new Date().toISOString();
      conn.status = 'connected';
      await kv.put(connKey, JSON.stringify(conn));

      // Also update integration status
      const integKey = `integration:${userId}:${provider}`;
      const integExisting = await kv.get(integKey);
      const integ = integExisting ? JSON.parse(integExisting) : { provider };
      integ.connected = true;
      integ.connectedAt = new Date().toISOString();
      integ.status = 'active';
      await kv.put(integKey, JSON.stringify(integ));
    } catch { /* */ }
  }

  // Redirect back to app with success
  return Response.redirect(`/app?oauth_success=1&provider=${provider}`, 302);
}
