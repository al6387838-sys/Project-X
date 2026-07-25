// Feedback Handler — LifeOS Enterprise
// Stores user feedback in KV
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
    // Token format: payload.sig (2 parts)
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

export async function onRequestGet({ request, env }) {
  const kv = env.LIFEOS_KV;
  const secret = env.LIFEOS_SESSION_SECRET;
  const token = getCookie(request.headers.get('cookie'));
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const raw = kv ? await kv.get(`feedback:${session.sub}`) : null;
  const feedbacks = raw ? JSON.parse(raw) : [];
  return json(200, { ok: true, feedbacks, total: feedbacks.length });
}

export async function onRequestPost({ request, env }) {
  const kv = env.LIFEOS_KV;
  const secret = env.LIFEOS_SESSION_SECRET;
  const token = getCookie(request.headers.get('cookie'));
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let body = {};
  try { body = await request.json(); } catch { /* */ }

  const { type = 'general', message, rating, module: mod } = body;
  if (!message && !rating) return json(400, { ok: false, error: 'message ou rating obrigatório' });

  const feedback = {
    id: crypto.randomUUID().slice(0, 12),
    type,
    message: message || '',
    rating: rating || null,
    module: mod || null,
    userId: session.sub,
    createdAt: new Date().toISOString(),
  };

  if (kv) {
    try {
      // Store user feedback
      const key = `feedback:${session.sub}`;
      const existing = await kv.get(key);
      const feedbacks = existing ? JSON.parse(existing) : [];
      feedbacks.unshift(feedback);
      await kv.put(key, JSON.stringify(feedbacks.slice(0, 100)));

      // Store in global feedback list (for admin)
      const globalKey = 'feedback:all';
      const globalRaw = await kv.get(globalKey);
      const globalFeedbacks = globalRaw ? JSON.parse(globalRaw) : [];
      globalFeedbacks.unshift(feedback);
      await kv.put(globalKey, JSON.stringify(globalFeedbacks.slice(0, 1000)));
    } catch { /* */ }
  }

  return json(201, { ok: true, feedback, message: 'Feedback enviado com sucesso' });
}

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST') return onRequestPost({ request, env });
  if (method === 'PUT') return onRequestPost({ request, env });
  if (method === 'PATCH') return onRequestPost({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
