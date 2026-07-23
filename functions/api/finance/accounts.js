// LifeOS Enterprise — Finance Accounts v1.0
// Cloudflare Pages Function: GET/POST /api/finance/accounts
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

  const raw = await env.LIFEOS_KV.get(`finance:accounts:${session.sub}`);
  const accounts = raw ? JSON.parse(raw) : [];
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  return json(200, { ok: true, accounts, totalBalance, count: accounts.length });
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

  const { name, type, bank, balance, currency } = body;
  if (!name) return json(400, { ok: false, error: 'name é obrigatório' });

  const raw = await env.LIFEOS_KV.get(`finance:accounts:${session.sub}`);
  const accounts = raw ? JSON.parse(raw) : [];

  const account = {
    id: randomId(),
    name,
    type: type || 'checking',
    bank: bank || '',
    balance: parseFloat(balance) || 0,
    currency: currency || 'BRL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  accounts.push(account);
  await env.LIFEOS_KV.put(`finance:accounts:${session.sub}`, JSON.stringify(accounts));

  return json(201, { ok: true, account });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
