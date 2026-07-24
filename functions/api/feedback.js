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
