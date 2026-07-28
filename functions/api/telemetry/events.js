// Telemetry Events Handler — LifeOS Enterprise
// Stores telemetry events in KV for analytics
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

function getCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/lifeos_session=([^;]+)/);
  return match ? match[1] : null;
}

async function verifySession(token, secret, env.LIFEOS_KV) {
  if (!token || !secret) return null;
  try {
    if (!/^[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+$/.test(token)) return null;
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 0) return null;
    const payload = token.slice(0, dotIdx);
    const suppliedSig = token.slice(dotIdx + 1);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    const expectedSigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(expectedSigBuf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (expectedSig !== suppliedSig) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(decoded);
    if (!data.sub || !data.exp) return null;
    if (data.exp <= Date.now()) return null;
    return data;
  } catch { return null; }
}

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
  }

  if (method === 'POST') {
    const kv = env.LIFEOS_KV;
    const secret = env.LIFEOS_SESSION_SECRET;
    const token = getCookie(request.headers.get('cookie'));
    const session = await verifySession(token, secret, env.LIFEOS_KV);

    let body = {};
    try { body = await request.json(); } catch { /* */ }

    const event = {
      ...body,
      timestamp: new Date().toISOString(),
      userId: session?.sub || 'anonymous',
      ip: request.headers.get('cf-connecting-ip') || 'unknown',
    };

    if (kv && session?.sub) {
      try {
        const key = `telemetry:events:${session.sub}`;
        const existing = await kv.get(key);
        const events = existing ? JSON.parse(existing) : [];
        events.unshift(event);
        await kv.put(key, JSON.stringify(events.slice(0, 1000)));
      } catch { /* */ }
    }

    return json(200, { ok: true, recorded: true });
  }

  if (method === 'GET') {
    const kv = env.LIFEOS_KV;
    const secret = env.LIFEOS_SESSION_SECRET;
    const token = getCookie(request.headers.get('cookie'));
    const session = await verifySession(token, secret, env.LIFEOS_KV);
    if (!session) return json(401, { ok: false, error: 'Não autenticado' });

    const key = `telemetry:events:${session.sub}`;
    const raw = kv ? await kv.get(key) : null;
    const events = raw ? JSON.parse(raw) : [];
    return json(200, { ok: true, events: events.slice(0, 100), total: events.length });
  }

  return json(405, { ok: false, error: 'Método não permitido' });
}
