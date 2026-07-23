// LifeOS Enterprise — Finance Bills v1.0
// Cloudflare Pages Function: GET/POST /api/finance/bills
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

  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // pending, paid, overdue

  const raw = await env.LIFEOS_KV.get(`finance:bills:${session.sub}`);
  let bills = raw ? JSON.parse(raw) : [];

  if (status) bills = bills.filter(b => b.status === status);

  const totalPending = bills.filter(b => b.status === 'pending').reduce((s, b) => s + (b.amount || 0), 0);
  const totalOverdue = bills.filter(b => b.status === 'overdue').reduce((s, b) => s + (b.amount || 0), 0);

  return json(200, { ok: true, bills, totalPending, totalOverdue, count: bills.length });
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

  const { action, billId, name, amount, dueDate, category, recurrent } = body;

  const raw = await env.LIFEOS_KV.get(`finance:bills:${session.sub}`);
  let bills = raw ? JSON.parse(raw) : [];

  if (action === 'pay') {
    const idx = bills.findIndex(b => b.id === billId);
    if (idx === -1) return json(404, { ok: false, error: 'Conta não encontrada' });
    bills[idx].status = 'paid';
    bills[idx].paidAt = new Date().toISOString();
    await env.LIFEOS_KV.put(`finance:bills:${session.sub}`, JSON.stringify(bills));
    return json(200, { ok: true, bill: bills[idx] });
  }

  if (!name || !amount || !dueDate) return json(400, { ok: false, error: 'name, amount e dueDate são obrigatórios' });

  const bill = {
    id: randomId(),
    name,
    amount: parseFloat(amount),
    dueDate,
    category: category || 'outros',
    recurrent: recurrent || false,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  bills.push(bill);
  await env.LIFEOS_KV.put(`finance:bills:${session.sub}`, JSON.stringify(bills));

  return json(201, { ok: true, bill });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
