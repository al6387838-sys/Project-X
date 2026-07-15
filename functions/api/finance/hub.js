// LifeOS Enterprise — Finance Hub API v2.0
// Cloudflare Pages Function: GET/POST /api/finance/hub
// Phase 141 — Finance Hub Foundation
// Contas bancárias, Open Finance, PIX, pagamentos, recebimentos, histórico
import { getCookie, json, verifySession } from '../../_auth.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const OPEN_FINANCE_INSTITUTIONS = {
  itau: { name: 'Itaú', color: '#EC7000', logo: 'building-2' },
  bradesco: { name: 'Bradesco', color: '#CC092F', logo: 'building-2' },
  santander: { name: 'Santander', color: '#EC0000', logo: 'building-2' },
  bb: { name: 'Banco do Brasil', color: '#F9C300', logo: 'building-2' },
  caixa: { name: 'Caixa', color: '#005CA9', logo: 'building-2' },
  nubank: { name: 'Nubank', color: '#820AD1', logo: 'credit-card' },
  inter: { name: 'Banco Inter', color: '#FF7A00', logo: 'credit-card' },
  c6: { name: 'C6 Bank', color: '#1A1A1A', logo: 'credit-card' },
  picpay: { name: 'PicPay', color: '#21C25E', logo: 'wallet' },
  mercadopago: { name: 'Mercado Pago', color: '#009EE3', logo: 'wallet' },
};

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'summary';
  const kv = env.LIFEOS_KV;

  if (!kv) {
    return json(200, { ok: true, data: {}, source: 'unavailable' });
  }

  try {
    switch (view) {
      case 'accounts': {
        const raw = await kv.get(`finance:accounts:${session.sub}`);
        const accounts = raw ? JSON.parse(raw) : [];
        const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
        return json(200, { ok: true, accounts, totalBalance });
      }

      case 'transactions': {
        const raw = await kv.get(`finance:transactions:${session.sub}`);
        const transactions = raw ? JSON.parse(raw) : [];
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const accountId = url.searchParams.get('accountId');
        const type = url.searchParams.get('type');
        let filtered = transactions;
        if (accountId) filtered = filtered.filter(t => t.accountId === accountId);
        if (type) filtered = filtered.filter(t => t.type === type);
        return json(200, { ok: true, transactions: filtered.slice(0, limit), total: filtered.length });
      }

      case 'pix': {
        const raw = await kv.get(`finance:pix:${session.sub}`);
        const pixData = raw ? JSON.parse(raw) : { keys: [], history: [] };
        return json(200, { ok: true, ...pixData });
      }

      case 'open-finance': {
        const raw = await kv.get(`finance:open-finance:${session.sub}`);
        const connections = raw ? JSON.parse(raw) : {};
        const institutions = Object.keys(OPEN_FINANCE_INSTITUTIONS).map(k => ({
          id: k,
          ...OPEN_FINANCE_INSTITUTIONS[k],
          connected: !!connections[k],
          connectedAt: connections[k]?.connectedAt || null,
          lastSync: connections[k]?.lastSync || null,
        }));
        return json(200, { ok: true, institutions, totalConnected: Object.keys(connections).length });
      }

      case 'summary':
      default: {
        const [accountsRaw, txRaw, pixRaw] = await Promise.all([
          kv.get(`finance:accounts:${session.sub}`),
          kv.get(`finance:transactions:${session.sub}`),
          kv.get(`finance:pix:${session.sub}`),
        ]);

        const accounts = accountsRaw ? JSON.parse(accountsRaw) : [];
        const transactions = txRaw ? JSON.parse(txRaw) : [];
        const pixData = pixRaw ? JSON.parse(pixRaw) : { keys: [], history: [] };

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const monthTx = transactions.filter(t => t.date >= monthStart);
        const income = monthTx.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
        const expenses = monthTx.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
        const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

        return json(200, {
          ok: true,
          summary: {
            totalBalance,
            monthlyIncome: income,
            monthlyExpenses: expenses,
            netBalance: income - expenses,
            accountCount: accounts.length,
            pixKeyCount: pixData.keys?.length || 0,
            recentTransactions: transactions.slice(0, 5),
            currency: 'BRL',
          },
        });
      }
    }
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar dados financeiros' });
  }
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { action } = body;

  // ─── Contas bancárias ───
  if (action === 'add-account') {
    const { name, type, institution, balance, currency } = body;
    if (!name || !type) return json(400, { ok: false, error: 'Nome e tipo obrigatórios' });

    const account = {
      id: generateId(),
      name,
      type, // checking, savings, investment, credit
      institution: institution || '',
      balance: typeof balance === 'number' ? balance : 0,
      currency: currency || 'BRL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const raw = await kv.get(`finance:accounts:${session.sub}`);
    const accounts = raw ? JSON.parse(raw) : [];
    accounts.push(account);
    await kv.put(`finance:accounts:${session.sub}`, JSON.stringify(accounts));
    return json(201, { ok: true, account });
  }

  // ─── Transação manual ───
  if (action === 'add-transaction') {
    const { accountId, type, amount, description, category, date } = body;
    if (!accountId || !type || !amount) return json(400, { ok: false, error: 'accountId, type e amount obrigatórios' });
    if (!['credit', 'debit'].includes(type)) return json(400, { ok: false, error: 'type deve ser credit ou debit' });

    const tx = {
      id: generateId(),
      accountId,
      type,
      amount: Math.abs(amount),
      description: description || '',
      category: category || 'other',
      date: date || new Date().toISOString(),
      source: 'manual',
      createdAt: new Date().toISOString(),
    };

    const raw = await kv.get(`finance:transactions:${session.sub}`);
    const transactions = raw ? JSON.parse(raw) : [];
    transactions.unshift(tx);

    // Atualizar saldo da conta
    const accRaw = await kv.get(`finance:accounts:${session.sub}`);
    const accounts = accRaw ? JSON.parse(accRaw) : [];
    const accIdx = accounts.findIndex(a => a.id === accountId);
    if (accIdx !== -1) {
      accounts[accIdx].balance += type === 'credit' ? amount : -amount;
      accounts[accIdx].updatedAt = new Date().toISOString();
      await kv.put(`finance:accounts:${session.sub}`, JSON.stringify(accounts));
    }

    await kv.put(`finance:transactions:${session.sub}`, JSON.stringify(transactions.slice(0, 1000)));
    return json(201, { ok: true, transaction: tx });
  }

  // ─── Chave PIX ───
  if (action === 'add-pix-key') {
    const { keyType, keyValue } = body;
    const validTypes = ['cpf', 'cnpj', 'email', 'phone', 'random'];
    if (!keyType || !validTypes.includes(keyType)) {
      return json(400, { ok: false, error: `keyType deve ser: ${validTypes.join(', ')}` });
    }
    if (!keyValue) return json(400, { ok: false, error: 'keyValue obrigatório' });

    const raw = await kv.get(`finance:pix:${session.sub}`);
    const pixData = raw ? JSON.parse(raw) : { keys: [], history: [] };

    if (pixData.keys.find(k => k.value === keyValue)) {
      return json(400, { ok: false, error: 'Chave PIX já cadastrada' });
    }

    pixData.keys.push({
      id: generateId(),
      type: keyType,
      value: keyValue,
      createdAt: new Date().toISOString(),
    });

    await kv.put(`finance:pix:${session.sub}`, JSON.stringify(pixData));
    return json(201, { ok: true, message: 'Chave PIX cadastrada' });
  }

  // ─── Pagamento PIX ───
  if (action === 'pix-payment') {
    const { targetKey, amount, description, accountId } = body;
    if (!targetKey || !amount || !accountId) {
      return json(400, { ok: false, error: 'targetKey, amount e accountId obrigatórios' });
    }

    // Verificar saldo
    const accRaw = await kv.get(`finance:accounts:${session.sub}`);
    const accounts = accRaw ? JSON.parse(accRaw) : [];
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return json(404, { ok: false, error: 'Conta não encontrada' });
    if (acc.balance < amount) return json(400, { ok: false, error: 'Saldo insuficiente' });

    // Registrar transação
    const tx = {
      id: generateId(),
      accountId,
      type: 'debit',
      amount,
      description: description || `PIX para ${targetKey}`,
      category: 'pix',
      date: new Date().toISOString(),
      source: 'pix',
      pixKey: targetKey,
      createdAt: new Date().toISOString(),
    };

    const txRaw = await kv.get(`finance:transactions:${session.sub}`);
    const transactions = txRaw ? JSON.parse(txRaw) : [];
    transactions.unshift(tx);
    await kv.put(`finance:transactions:${session.sub}`, JSON.stringify(transactions.slice(0, 1000)));

    // Atualizar saldo
    acc.balance -= amount;
    acc.updatedAt = new Date().toISOString();
    await kv.put(`finance:accounts:${session.sub}`, JSON.stringify(accounts));

    // Histórico PIX
    const pixRaw = await kv.get(`finance:pix:${session.sub}`);
    const pixData = pixRaw ? JSON.parse(pixRaw) : { keys: [], history: [] };
    pixData.history.unshift({
      id: tx.id,
      type: 'payment',
      amount,
      targetKey,
      description: tx.description,
      date: tx.date,
      status: 'completed',
    });
    await kv.put(`finance:pix:${session.sub}`, JSON.stringify(pixData));

    return json(200, { ok: true, transaction: tx, newBalance: acc.balance });
  }

  // ─── Open Finance: conectar banco ───
  if (action === 'connect-bank') {
    const { institutionId } = body;
    if (!institutionId || !OPEN_FINANCE_INSTITUTIONS[institutionId]) {
      return json(400, { ok: false, error: 'Instituição inválida' });
    }

    const openFinanceClientId = env.OPEN_FINANCE_CLIENT_ID;
    if (!openFinanceClientId) {
      return json(400, {
        ok: false,
        error: 'Open Finance não configurado',
        setupInstructions: 'Configure OPEN_FINANCE_CLIENT_ID e OPEN_FINANCE_CLIENT_SECRET nas variáveis de ambiente do Cloudflare Pages.',
      });
    }

    const state = btoa(JSON.stringify({ institutionId, userId: session.sub, ts: Date.now() }));
    const redirectUri = `${new URL(request.url).origin}/api/finance/open-finance/callback`;
    const authUrl = `https://openfinance.brasil.gov.br/oauth2/authorize?` +
      `client_id=${openFinanceClientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=accounts+transactions+pix&` +
      `state=${state}&` +
      `institution=${institutionId}`;

    return json(200, { ok: true, authUrl, institutionId });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
  }
}
