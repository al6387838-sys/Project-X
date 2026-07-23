// LifeOS Enterprise — Finance Subscriptions v1.0
// Cloudflare Pages Function: GET/POST/DELETE /api/finance/subscriptions
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

  const raw = await env.LIFEOS_KV.get(`finance:subscriptions:${session.sub}`);
  const subscriptions = raw ? JSON.parse(raw) : [];
  const totalMonthly = subscriptions.filter(s => s.active).reduce((sum, s) => {
    if (s.cycle === 'annual') return sum + (s.amount / 12);
    return sum + (s.amount || 0);
  }, 0);

  return json(200, { ok: true, subscriptions, totalMonthly, count: subscriptions.length });
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

  const { action, subscriptionId, name, amount, cycle, category, nextBillingDate } = body;

  const raw = await env.LIFEOS_KV.get(`finance:subscriptions:${session.sub}`);
  let subscriptions = raw ? JSON.parse(raw) : [];

  if (action === 'cancel') {
    const idx = subscriptions.findIndex(s => s.id === subscriptionId);
    if (idx === -1) return json(404, { ok: false, error: 'Assinatura não encontrada' });
    subscriptions[idx].active = false;
    subscriptions[idx].cancelledAt = new Date().toISOString();
    await env.LIFEOS_KV.put(`finance:subscriptions:${session.sub}`, JSON.stringify(subscriptions));
    return json(200, { ok: true, subscription: subscriptions[idx] });
  }

  if (!name || !amount) return json(400, { ok: false, error: 'name e amount são obrigatórios' });

  const subscription = {
    id: randomId(),
    name,
    amount: parseFloat(amount),
    cycle: cycle || 'monthly',
    category: category || 'serviços',
    nextBillingDate: nextBillingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    active: true,
    createdAt: new Date().toISOString(),
  };

  subscriptions.push(subscription);
  await env.LIFEOS_KV.put(`finance:subscriptions:${session.sub}`, JSON.stringify(subscriptions));

  return json(201, { ok: true, subscription });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
