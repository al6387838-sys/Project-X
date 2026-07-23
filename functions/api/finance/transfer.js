// LifeOS Enterprise — Finance Transfer v1.0
// Cloudflare Pages Function: POST /api/finance/transfer
import { getCookie, json, verifySession } from '../../_auth.js';

function randomId() {
  return Math.random().toString(36).slice(2, 10);
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

  const { type, amount, fromAccount, toAccount, recipient, description, pixKey } = body;

  if (!amount || parseFloat(amount) <= 0) {
    return json(400, { ok: false, error: 'Valor inválido' });
  }

  const transferType = type || 'internal';

  // Validações por tipo
  if (transferType === 'pix' && !pixKey) {
    return json(400, { ok: false, error: 'Chave PIX é obrigatória para transferências PIX' });
  }
  if (transferType === 'ted' && !recipient) {
    return json(400, { ok: false, error: 'Dados do destinatário são obrigatórios para TED/DOC' });
  }
  if (transferType === 'internal' && (!fromAccount || !toAccount)) {
    return json(400, { ok: false, error: 'Contas de origem e destino são obrigatórias para transferência interna' });
  }

  // Registrar transferência
  const transfer = {
    id: randomId(),
    type: transferType,
    amount: parseFloat(amount),
    fromAccount,
    toAccount,
    recipient,
    description: description || '',
    pixKey,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const key = `finance:transfers:${session.sub}`;
  const raw = await env.LIFEOS_KV.get(key);
  const transfers = raw ? JSON.parse(raw) : [];
  transfers.unshift(transfer);
  await env.LIFEOS_KV.put(key, JSON.stringify(transfers.slice(0, 100)));

  // Para transferências internas, atualizar saldo das contas
  if (transferType === 'internal' && fromAccount && toAccount) {
    const accKey = `finance:accounts:${session.sub}`;
    const accRaw = await env.LIFEOS_KV.get(accKey);
    if (accRaw) {
      const accounts = JSON.parse(accRaw);
      const fromIdx = accounts.findIndex(a => a.id === fromAccount);
      const toIdx = accounts.findIndex(a => a.id === toAccount);
      if (fromIdx !== -1 && toIdx !== -1) {
        accounts[fromIdx].balance -= parseFloat(amount);
        accounts[toIdx].balance += parseFloat(amount);
        await env.LIFEOS_KV.put(accKey, JSON.stringify(accounts));
        transfer.status = 'completed';
      }
    }
  }

  return json(201, {
    ok: true,
    transfer,
    message: transferType === 'pix'
      ? 'PIX enviado com sucesso (simulação — configure credenciais reais para produção)'
      : transferType === 'ted'
      ? 'TED/DOC registrado (simulação — configure credenciais bancárias reais para produção)'
      : 'Transferência interna concluída',
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
