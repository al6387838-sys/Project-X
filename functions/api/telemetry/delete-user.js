// Telemetry Delete-User Handler — LifeOS Enterprise
// Removes all telemetry data for a user (GDPR/LGPD compliance)
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

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'POST,DELETE,OPTIONS' } });
  }

  if (method === 'POST' || method === 'DELETE') {
    const kv = env.LIFEOS_KV;
    const secret = env.LIFEOS_SESSION_SECRET;
    const token = getCookie(request.headers.get('cookie'));
    const session = await verifySession(token, secret);
    if (!session) return json(401, { ok: false, error: 'Não autenticado' });

    const userId = session.sub;
    const deleted = [];

    if (kv) {
      const telemetryKeys = [
        `telemetry:events:${userId}`,
        `telemetry:crashes:${userId}`,
      ];
      for (const key of telemetryKeys) {
        try {
          await kv.delete(key);
          deleted.push(key);
        } catch { /* */ }
      }
    }

    return json(200, { ok: true, deleted: deleted.length, message: 'Dados de telemetria removidos com sucesso' });
  }

  return json(405, { ok: false, error: 'Método não permitido' });
}
