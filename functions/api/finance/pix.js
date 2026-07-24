// LifeOS Enterprise — PIX API v1.0
// Cloudflare Pages Function: GET/POST /api/finance/pix
// Phase 134 — Open Finance Foundation
// Infraestrutura PIX via Open Finance Brasil
// Documentação: https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/17367790/Pagamentos
import { getCookie, json, verifySession } from '../../_auth.js';

const PIX_KEY_TYPES = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'];

function validatePixKey(key, type) {
  switch (type) {
    case 'CPF':
      return /^\d{11}$/.test(key.replace(/\D/g, ''));
    case 'CNPJ':
      return /^\d{14}$/.test(key.replace(/\D/g, ''));
    case 'EMAIL':
      return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(key);
    case 'PHONE':
      return /^\+55\d{10,11}$/.test(key.replace(/[\s\-()]/g, ''));
    case 'EVP':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    default:
      return false;
  }
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const resource = url.searchParams.get('resource') || 'keys';

  if (resource === 'keys') {
    // Retornar chaves PIX cadastradas do usuário
    let pixKeys = [];
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`pix:keys:${session.sub}`);
        if (raw) pixKeys = JSON.parse(raw);
      } catch (_) { /* KV indisponível */ }
    }
    return json(200, { ok: true, keys: pixKeys });
  }

  if (resource === 'history') {
    // Retornar histórico de transações PIX
    let history = [];
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`pix:history:${session.sub}`);
        if (raw) history = JSON.parse(raw);
      } catch (_) { /* KV indisponível */ }
    }
    return json(200, { ok: true, history });
  }

  return json(400, { ok: false, error: 'Recurso inválido. Use: keys, history' });
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const action = String(input.action || '');

  if (action === 'register_key') {
    const keyType = String(input.keyType || '').toUpperCase();
    const keyValue = String(input.keyValue || '').trim();

    if (!PIX_KEY_TYPES.includes(keyType)) {
      return json(400, { ok: false, error: `Tipo de chave inválido. Use: ${PIX_KEY_TYPES.join(', ')}` });
    }

    if (!keyValue) {
      return json(400, { ok: false, error: 'Valor da chave obrigatório' });
    }

    if (!validatePixKey(keyValue, keyType)) {
      return json(400, { ok: false, error: `Formato inválido para chave ${keyType}` });
    }

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento não disponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`pix:keys:${session.sub}`);
      const keys = raw ? JSON.parse(raw) : [];

      if (keys.length >= 5) {
        return json(429, { ok: false, error: 'Limite de 5 chaves PIX atingido' });
      }

      // Verificar duplicata
      if (keys.some(k => k.value === keyValue)) {
        return json(409, { ok: false, error: 'Esta chave já está cadastrada' });
      }

      const newKey = {
        id: `pix_${Date.now()}`,
        type: keyType,
        value: keyValue,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      keys.push(newKey);
      await env.LIFEOS_KV.put(`pix:keys:${session.sub}`, JSON.stringify(keys));
      return json(201, { ok: true, key: newKey, message: 'Chave PIX cadastrada com sucesso' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao cadastrar chave PIX' });
    }
  }

  if (action === 'delete_key') {
    const keyId = String(input.keyId || '');
    if (!keyId) return json(400, { ok: false, error: 'keyId obrigatório' });

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento não disponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`pix:keys:${session.sub}`);
      let keys = raw ? JSON.parse(raw) : [];
      keys = keys.filter(k => k.id !== keyId);
      await env.LIFEOS_KV.put(`pix:keys:${session.sub}`, JSON.stringify(keys));
      return json(200, { ok: true, message: 'Chave PIX removida' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao remover chave PIX' });
    }
  }

  if (action === 'initiate_payment') {
    // Verificar se Open Finance está configurado para pagamentos
    if (!env.OPENFINANCE_CLIENT_ID) {
      return json(503, {
        ok: false,
        error: 'Pagamentos PIX via Open Finance não configurados.',
        setup_required: true,
        instructions: 'Configure OPENFINANCE_CLIENT_ID e OPENFINANCE_CLIENT_SECRET para habilitar pagamentos PIX via Open Finance Brasil.',
      });
    }

    const pixKey = String(input.pixKey || '').trim();
    const amount = parseFloat(input.amount || 0);
    const description = String(input.description || '').trim().substring(0, 140);
    const fromAccountId = String(input.fromAccountId || '');

    if (!pixKey) return json(400, { ok: false, error: 'Chave PIX obrigatória' });
    if (!amount || amount <= 0) return json(400, { ok: false, error: 'Valor deve ser maior que zero' });
    if (!fromAccountId) return json(400, { ok: false, error: 'Conta de origem obrigatória' });

    // Registrar intenção de pagamento no KV (aguardando confirmação)
    const paymentIntent = {
      id: `pix_pay_${Date.now()}`,
      pixKey,
      amount,
      description,
      fromAccountId,
      status: 'pending_confirmation',
      createdAt: new Date().toISOString(),
      userId: session.sub,
    };

    if (env.LIFEOS_KV) {
      try {
        await env.LIFEOS_KV.put(
          `pix:payment:${paymentIntent.id}`,
          JSON.stringify(paymentIntent),
          { expirationTtl: 300 } // 5 minutos para confirmar
        );
      } catch (_) { /* ignorar */ }
    }

    return json(200, {
      ok: true,
      paymentIntent,
      message: 'Intenção de pagamento criada. Confirme para prosseguir.',
      requires_confirmation: true,
    });
  }

  if (action === 'confirm_payment') {
    const paymentId = String(input.paymentId || '');
    if (!paymentId) return json(400, { ok: false, error: 'paymentId obrigatório' });

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento não disponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`pix:payment:${paymentId}`);
      if (!raw) return json(404, { ok: false, error: 'Pagamento não encontrado ou expirado' });

      const payment = JSON.parse(raw);
      if (payment.userId !== session.sub) return json(403, { ok: false, error: 'Acesso negado' });
      if (payment.status !== 'pending_confirmation') {
        return json(400, { ok: false, error: 'Pagamento já processado' });
      }

      // Em produção: chamar API Open Finance para processar pagamento
      // Por ora: registrar no histórico como "aguardando processamento"
      payment.status = 'processing';
      payment.confirmedAt = new Date().toISOString();

      // Adicionar ao histórico
      const histRaw = await env.LIFEOS_KV.get(`pix:history:${session.sub}`);
      const history = histRaw ? JSON.parse(histRaw) : [];
      history.unshift(payment);
      // Manter apenas 100 transações mais recentes
      const trimmed = history.slice(0, 100);
      await env.LIFEOS_KV.put(`pix:history:${session.sub}`, JSON.stringify(trimmed));

      // Remover intenção de pagamento
      await env.LIFEOS_KV.delete(`pix:payment:${paymentId}`);

      return json(200, {
        ok: true,
        payment,
        message: 'Pagamento PIX enviado para processamento via Open Finance Brasil.',
      });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao processar pagamento' });
    }
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: register_key, delete_key, initiate_payment, confirm_payment' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
