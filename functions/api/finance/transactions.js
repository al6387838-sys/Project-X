// LifeOS Enterprise — Finance Transactions API v3.0
// Cloudflare Pages Function: /api/finance/transactions
// Receitas, despesas, categorias, centros de custo, relatórios, exportação CSV
import { getCookie, json, verifySession } from '../../_auth.js';

const CATEGORIES = {
  // Receitas
  salary: { label: 'Salário', type: 'credit', icon: 'briefcase' },
  freelance: { label: 'Freelance', type: 'credit', icon: 'laptop' },
  investment_income: { label: 'Renda de Investimentos', type: 'credit', icon: 'trending-up' },
  rental_income: { label: 'Aluguel Recebido', type: 'credit', icon: 'home' },
  sale: { label: 'Venda', type: 'credit', icon: 'shopping-bag' },
  other_income: { label: 'Outras Receitas', type: 'credit', icon: 'plus-circle' },
  // Despesas
  food: { label: 'Alimentação', type: 'debit', icon: 'utensils' },
  transport: { label: 'Transporte', type: 'debit', icon: 'car' },
  housing: { label: 'Moradia', type: 'debit', icon: 'home' },
  health: { label: 'Saúde', type: 'debit', icon: 'heart-pulse' },
  education: { label: 'Educação', type: 'debit', icon: 'graduation-cap' },
  entertainment: { label: 'Lazer', type: 'debit', icon: 'gamepad-2' },
  shopping: { label: 'Compras', type: 'debit', icon: 'shopping-cart' },
  utilities: { label: 'Contas e Serviços', type: 'debit', icon: 'zap' },
  taxes: { label: 'Impostos', type: 'debit', icon: 'file-text' },
  insurance: { label: 'Seguros', type: 'debit', icon: 'shield' },
  investment: { label: 'Investimentos', type: 'debit', icon: 'trending-up' },
  other: { label: 'Outros', type: 'both', icon: 'circle' },
};

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function sanitize(v, maxLen = 500) {
  if (typeof v !== 'string') return '';
  return v.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

function normalizeAmount(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 1e9) throw new Error('Valor inválido');
  return Math.round(n * 100) / 100;
}

function normalizeDate(v) {
  if (!v) return new Date().toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Data inválida (use AAAA-MM-DD)');
  return s;
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

async function getTransactions(kv, userId) {
  const raw = await kv.get(`finance:transactions:${userId}`);
  return raw ? JSON.parse(raw) : [];
}

async function saveTransactions(kv, userId, txs) {
  await kv.put(`finance:transactions:${userId}`, JSON.stringify(txs.slice(0, 5000)));
}

async function getCategories(kv, userId) {
  const raw = await kv.get(`finance:categories:${userId}`);
  const custom = raw ? JSON.parse(raw) : [];
  return { ...CATEGORIES, ...Object.fromEntries(custom.map(c => [c.id, c])) };
}

async function getCostCenters(kv, userId) {
  const raw = await kv.get(`finance:cost-centers:${userId}`);
  return raw ? JSON.parse(raw) : [];
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, transactions: [], total: 0, categories: CATEGORIES, costCenters: [] });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'list';

  try {
    if (view === 'categories') {
      const cats = await getCategories(kv, session.sub);
      return json(200, { ok: true, categories: cats });
    }

    if (view === 'cost-centers') {
      const centers = await getCostCenters(kv, session.sub);
      return json(200, { ok: true, costCenters: centers });
    }

    const txs = await getTransactions(kv, session.sub);
    let filtered = [...txs];

    // Filters
    const type = url.searchParams.get('type');
    const category = url.searchParams.get('category');
    const accountId = url.searchParams.get('accountId');
    const costCenter = url.searchParams.get('costCenter');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const q = url.searchParams.get('q');
    const minAmount = url.searchParams.get('minAmount');
    const maxAmount = url.searchParams.get('maxAmount');

    if (type) filtered = filtered.filter(t => t.type === type);
    if (category) filtered = filtered.filter(t => t.category === category);
    if (accountId) filtered = filtered.filter(t => t.accountId === accountId);
    if (costCenter) filtered = filtered.filter(t => t.costCenter === costCenter);
    if (dateFrom) filtered = filtered.filter(t => (t.date || '').slice(0, 10) >= dateFrom);
    if (dateTo) filtered = filtered.filter(t => (t.date || '').slice(0, 10) <= dateTo);
    if (q) {
      const lq = q.toLowerCase();
      filtered = filtered.filter(t => (t.description || '').toLowerCase().includes(lq) || (t.category || '').toLowerCase().includes(lq) || (t.costCenter || '').toLowerCase().includes(lq));
    }
    if (minAmount) filtered = filtered.filter(t => t.amount >= parseFloat(minAmount));
    if (maxAmount) filtered = filtered.filter(t => t.amount <= parseFloat(maxAmount));

    // Sort
    const sort = url.searchParams.get('sort') || 'date';
    const order = url.searchParams.get('order') || 'desc';
    filtered.sort((a, b) => {
      const av = a[sort] || '';
      const bv = b[sort] || '';
      return order === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

    if (view === 'report') {
      const income = filtered.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      const expenses = filtered.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
      const byCategory = {};
      for (const t of filtered) {
        if (!byCategory[t.category]) byCategory[t.category] = { income: 0, expenses: 0, count: 0 };
        if (t.type === 'credit') byCategory[t.category].income += t.amount;
        else byCategory[t.category].expenses += t.amount;
        byCategory[t.category].count++;
      }
      const byCostCenter = {};
      for (const t of filtered) {
        const cc = t.costCenter || 'Sem centro de custo';
        if (!byCostCenter[cc]) byCostCenter[cc] = { income: 0, expenses: 0, count: 0 };
        if (t.type === 'credit') byCostCenter[cc].income += t.amount;
        else byCostCenter[cc].expenses += t.amount;
        byCostCenter[cc].count++;
      }
      const byMonth = {};
      for (const t of filtered) {
        const month = (t.date || '').slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0 };
        if (t.type === 'credit') byMonth[month].income += t.amount;
        else byMonth[month].expenses += t.amount;
      }
      return json(200, { ok: true, report: { income, expenses, net: income - expenses, count: filtered.length, byCategory, byCostCenter, byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({ month, ...data })) } });
    }

    if (view === 'export-csv') {
      const cats = await getCategories(kv, session.sub);
      const lines = ['Data,Tipo,Descrição,Categoria,Centro de Custo,Valor,Conta'];
      for (const t of filtered) {
        const catLabel = cats[t.category]?.label || t.category || '';
        lines.push([
          (t.date || '').slice(0, 10),
          t.type === 'credit' ? 'Receita' : 'Despesa',
          `"${(t.description || '').replace(/"/g, '""')}"`,
          `"${catLabel}"`,
          `"${(t.costCenter || '').replace(/"/g, '""')}"`,
          String(t.amount || 0).replace('.', ','),
          `"${(t.accountId || '').replace(/"/g, '""')}"`,
        ].join(','));
      }
      return new Response(lines.join('\n'), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="transacoes-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const page = filtered.slice(offset, offset + limit);
    const cats = await getCategories(kv, session.sub);
    return json(200, { ok: true, transactions: page, total: filtered.length, offset, limit, categories: cats });
  } catch (err) {
    return json(500, { ok: false, error: err.message || 'Erro ao carregar transações' });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  // ─── Categoria personalizada ───
  if (body.action === 'add-category') {
    const name = sanitize(body.name || '', 80);
    if (!name) return json(400, { ok: false, error: 'Nome da categoria obrigatório' });
    const type = ['credit', 'debit', 'both'].includes(body.type) ? body.type : 'both';
    const raw = await kv.get(`finance:categories:${session.sub}`);
    const cats = raw ? JSON.parse(raw) : [];
    if (cats.length >= 50) return json(400, { ok: false, error: 'Máximo de 50 categorias personalizadas' });
    const cat = { id: generateId(), name, label: name, type, icon: sanitize(body.icon || 'circle', 50), createdAt: new Date().toISOString() };
    cats.push(cat);
    await kv.put(`finance:categories:${session.sub}`, JSON.stringify(cats));
    return json(201, { ok: true, category: cat });
  }

  if (body.action === 'delete-category') {
    const { id } = body;
    if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
    const raw = await kv.get(`finance:categories:${session.sub}`);
    const cats = raw ? JSON.parse(raw) : [];
    const filtered = cats.filter(c => c.id !== id);
    await kv.put(`finance:categories:${session.sub}`, JSON.stringify(filtered));
    return json(200, { ok: true, deleted: id });
  }

  // ─── Centro de custo ───
  if (body.action === 'add-cost-center') {
    const name = sanitize(body.name || '', 100);
    if (!name) return json(400, { ok: false, error: 'Nome do centro de custo obrigatório' });
    const centers = await getCostCenters(kv, session.sub);
    if (centers.length >= 50) return json(400, { ok: false, error: 'Máximo de 50 centros de custo' });
    const center = { id: generateId(), name, description: sanitize(body.description || '', 500), createdAt: new Date().toISOString() };
    centers.push(center);
    await kv.put(`finance:cost-centers:${session.sub}`, JSON.stringify(centers));
    return json(201, { ok: true, costCenter: center });
  }

  if (body.action === 'delete-cost-center') {
    const { id } = body;
    if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
    const centers = await getCostCenters(kv, session.sub);
    await kv.put(`finance:cost-centers:${session.sub}`, JSON.stringify(centers.filter(c => c.id !== id)));
    return json(200, { ok: true, deleted: id });
  }

  // ─── Criar transação ───
  try {
    const type = ['credit', 'debit'].includes(body.type) ? body.type : null;
    if (!type) return json(400, { ok: false, error: 'type deve ser credit ou debit' });
    const amount = normalizeAmount(body.amount);
    const date = normalizeDate(body.date);
    const description = sanitize(body.description || '', 500);
    if (!description) return json(400, { ok: false, error: 'Descrição obrigatória' });
    const cats = await getCategories(kv, session.sub);
    const category = body.category && cats[body.category] ? body.category : 'other';
    const costCenter = sanitize(body.costCenter || '', 100);
    const accountId = sanitize(body.accountId || '', 50);
    const attachmentUrl = sanitize(body.attachmentUrl || '', 2000);
    const attachmentName = sanitize(body.attachmentName || '', 200);
    const tx = {
      id: generateId(),
      type,
      amount,
      description,
      category,
      costCenter,
      accountId,
      date,
      attachmentUrl: attachmentUrl || null,
      attachmentName: attachmentName || null,
      source: 'manual',
      tags: Array.isArray(body.tags) ? body.tags.map(t => sanitize(String(t), 50)).filter(Boolean).slice(0, 10) : [],
      notes: sanitize(body.notes || '', 1000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const txs = await getTransactions(kv, session.sub);
    txs.unshift(tx);
    // Atualizar saldo da conta
    if (accountId) {
      const accRaw = await kv.get(`finance:accounts:${session.sub}`);
      const accounts = accRaw ? JSON.parse(accRaw) : [];
      const accIdx = accounts.findIndex(a => a.id === accountId);
      if (accIdx !== -1) {
        accounts[accIdx].balance = (accounts[accIdx].balance || 0) + (type === 'credit' ? amount : -amount);
        accounts[accIdx].updatedAt = new Date().toISOString();
        await kv.put(`finance:accounts:${session.sub}`, JSON.stringify(accounts));
      }
    }
    await saveTransactions(kv, session.sub, txs);
    return json(201, { ok: true, transaction: tx });
  } catch (err) {
    return json(400, { ok: false, error: err.message || 'Erro ao criar transação' });
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function onRequestPut({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  const { id, ...updates } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const txs = await getTransactions(kv, session.sub);
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Transação não encontrada' });
    const tx = txs[idx];
    const oldAmount = tx.amount;
    const oldType = tx.type;
    if ('description' in updates) tx.description = sanitize(String(updates.description || ''), 500);
    if ('category' in updates) tx.category = sanitize(String(updates.category || 'other'), 50);
    if ('costCenter' in updates) tx.costCenter = sanitize(String(updates.costCenter || ''), 100);
    if ('date' in updates) tx.date = normalizeDate(updates.date);
    if ('notes' in updates) tx.notes = sanitize(String(updates.notes || ''), 1000);
    if ('tags' in updates) tx.tags = Array.isArray(updates.tags) ? updates.tags.map(t => sanitize(String(t), 50)).filter(Boolean).slice(0, 10) : [];
    if ('attachmentUrl' in updates) tx.attachmentUrl = sanitize(String(updates.attachmentUrl || ''), 2000) || null;
    if ('attachmentName' in updates) tx.attachmentName = sanitize(String(updates.attachmentName || ''), 200) || null;
    // Se amount ou type mudar, atualizar saldo da conta
    if (('amount' in updates || 'type' in updates) && tx.accountId) {
      const newAmount = 'amount' in updates ? normalizeAmount(updates.amount) : oldAmount;
      const newType = 'type' in updates && ['credit', 'debit'].includes(updates.type) ? updates.type : oldType;
      const accRaw = await kv.get(`finance:accounts:${session.sub}`);
      const accounts = accRaw ? JSON.parse(accRaw) : [];
      const accIdx = accounts.findIndex(a => a.id === tx.accountId);
      if (accIdx !== -1) {
        // Reverter transação antiga
        accounts[accIdx].balance -= oldType === 'credit' ? oldAmount : -oldAmount;
        // Aplicar nova transação
        accounts[accIdx].balance += newType === 'credit' ? newAmount : -newAmount;
        accounts[accIdx].updatedAt = new Date().toISOString();
        await kv.put(`finance:accounts:${session.sub}`, JSON.stringify(accounts));
      }
      tx.amount = newAmount;
      tx.type = newType;
    }
    tx.updatedAt = new Date().toISOString();
    await saveTransactions(kv, session.sub, txs);
    return json(200, { ok: true, transaction: tx });
  } catch (err) {
    return json(400, { ok: false, error: err.message || 'Erro ao atualizar transação' });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const txs = await getTransactions(kv, session.sub);
    const tx = txs.find(t => t.id === id);
    if (!tx) return json(404, { ok: false, error: 'Transação não encontrada' });
    // Reverter saldo da conta
    if (tx.accountId) {
      const accRaw = await kv.get(`finance:accounts:${session.sub}`);
      const accounts = accRaw ? JSON.parse(accRaw) : [];
      const accIdx = accounts.findIndex(a => a.id === tx.accountId);
      if (accIdx !== -1) {
        accounts[accIdx].balance -= tx.type === 'credit' ? tx.amount : -tx.amount;
        accounts[accIdx].updatedAt = new Date().toISOString();
        await kv.put(`finance:accounts:${session.sub}`, JSON.stringify(accounts));
      }
    }
    await saveTransactions(kv, session.sub, txs.filter(t => t.id !== id));
    return json(200, { ok: true, deleted: id });
  } catch (err) {
    return json(500, { ok: false, error: err.message || 'Erro ao excluir transação' });
  }
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    case 'PUT': return onRequestPut(ctx);
    case 'DELETE': return onRequestDelete(ctx);
    case 'OPTIONS': return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
