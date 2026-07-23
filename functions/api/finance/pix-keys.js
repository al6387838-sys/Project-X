// LifeOS Enterprise — Finance PIX Keys v1.0
// Cloudflare Pages Function: GET/POST/DELETE /api/finance/pix-keys
import { getCookie, json, verifySession } from '../../_auth.js';

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export async function onRequestGet({ request, env }) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Serviço indisponível.' });
  }
  const token = getCookie(request, 'lifeos_session');
  if (!token) return json(401, { ok: false, error: 'Não autenticado' });
  let session;
  try { session = await verifySession(token, env.LIFEOS_SESSION_SECRET); } catch { return json(401, { ok: false, error: 'Sessão inválida' }); }

  const raw = await env.LIFEOS_KV.get(`finance:pix-keys:${session.sub}`);
  const keys = raw ? JSON.parse(raw) : [];

  return json(200, { ok: true, keys, count: keys.length });
}

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Serviço indisponível.' });
  }
  const token = getCookie(request, 'lifeos_session');
  if (!token) return json(401, { ok: false, error: 'Não autenticado' });
  let session;
  try { session = await verifySession(token, env.LIFEOS_SESSION_SECRET); } catch { return json(401, { ok: false, error: 'Sessão inválida' }); }

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const { action, keyId, type, value } = body;

  const raw = await env.LIFEOS_KV.get(`finance:pix-keys:${session.sub}`);
  let keys = raw ? JSON.parse(raw) : [];

  if (action === 'delete') {
    keys = keys.filter(k => k.id !== keyId);
    await env.LIFEOS_KV.put(`finance:pix-keys:${session.sub}`, JSON.stringify(keys));
    return json(200, { ok: true, message: 'Chave PIX removida' });
  }

  if (!type || !value) return json(400, { ok: false, error: 'type e value são obrigatórios' });

  const validTypes = ['cpf', 'cnpj', 'email', 'phone', 'random'];
  if (!validTypes.includes(type)) {
    return json(400, { ok: false, error: `Tipo inválido. Use: ${validTypes.join(', ')}` });
  }

  // Verificar duplicata
  if (keys.find(k => k.value === value)) {
    return json(409, { ok: false, error: 'Esta chave PIX já está cadastrada' });
  }

  if (keys.length >= 5) {
    return json(400, { ok: false, error: 'Limite de 5 chaves PIX atingido' });
  }

  const pixKey = {
    id: randomId(),
    type,
    value,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  keys.push(pixKey);
  await env.LIFEOS_KV.put(`finance:pix-keys:${session.sub}`, JSON.stringify(keys));

  return json(201, { ok: true, key: pixKey });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
