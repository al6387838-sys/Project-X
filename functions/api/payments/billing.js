// LifeOS Enterprise — Billing Platform API v2.0
// Cloudflare Pages Function: GET/POST /api/payments/billing
// Phase 226 — Billing Platform Real
// Stripe · Mercado Pago · Assinaturas · Planos · Cobrança recorrente
// Invoices · Histórico financeiro · Cancelamento · Upgrade · Downgrade
import { getCookie, json, verifySession } from '../../_auth.js';

const PLANS = {
  free:         { id: 'free',         name: 'Free',         price: { brl: 0,     usd: 0    }, interval: 'month', features: ['1 usuário','1 GB armazenamento','Módulos básicos'],                                                                          limits: { users: 1,   storage_gb: 1,    api_calls: 1000   }, stripe: { price_brl: null, price_usd: null }, mp: { plan_id: null } },
  starter:      { id: 'starter',      name: 'Starter',      price: { brl: 4900,  usd: 990  }, interval: 'month', features: ['5 usuários','10 GB armazenamento','Todos os módulos','Suporte prioritário','API básica'],                                     limits: { users: 5,   storage_gb: 10,   api_calls: 10000  }, stripe: { price_brl: 'STRIPE_PRICE_STARTER_BRL', price_usd: 'STRIPE_PRICE_STARTER_USD' }, mp: { plan_id: 'MP_PLAN_STARTER' } },
  professional: { id: 'professional', name: 'Professional', price: { brl: 14900, usd: 2990 }, interval: 'month', features: ['25 usuários','100 GB armazenamento','AI Orchestrator','API completa','Suporte 24/7','SLA 99.9%'],                             limits: { users: 25,  storage_gb: 100,  api_calls: 100000 }, stripe: { price_brl: 'STRIPE_PRICE_PRO_BRL',     price_usd: 'STRIPE_PRICE_PRO_USD'     }, mp: { plan_id: 'MP_PLAN_PRO'     } },
  enterprise:   { id: 'enterprise',   name: 'Enterprise',   price: { brl: 49900, usd: 9990 }, interval: 'month', features: ['Usuários ilimitados','1 TB armazenamento','AI Orchestrator','API ilimitada','Suporte dedicado','SLA 99.99%','SSO/SAML'],      limits: { users: -1,  storage_gb: 1000, api_calls: -1     }, stripe: { price_brl: 'STRIPE_PRICE_ENT_BRL',     price_usd: 'STRIPE_PRICE_ENT_USD'     }, mp: { plan_id: 'MP_PLAN_ENT'     } },
};

function genId() { return crypto.randomUUID().replace(/-/g,'').slice(0,16); }

function getPlanStatus(planId, env) {
  const plan = PLANS[planId];
  if (!plan) return null;
  const stripeConfigured = !!(env.STRIPE_PUBLIC_KEY && env.STRIPE_SECRET_KEY);
  const mpConfigured = !!(env.MERCADO_PAGO_ACCESS_TOKEN && env.MERCADO_PAGO_PUBLIC_KEY);
  return {
    ...plan,
    available: true,
    stripeReady: stripeConfigured,
    mercadoPagoReady: mpConfigured,
    stripePriceId: plan.stripe.price_brl ? env[plan.stripe.price_brl] || null : null,
    mpPlanId: plan.mp.plan_id ? env[plan.mp.plan_id] || null : null,
  };
}

async function stripeRequest(method, path, body, apiKey) {
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY não configurada. Serviço aguardando configuração.');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body && method !== 'GET' ? new URLSearchParams(flattenObj(body)).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Erro Stripe');
  return data;
}

async function mpRequest(method, path, body, token) {
  if (!token) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado. Serviço aguardando configuração.');
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': genId() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro Mercado Pago');
  return data;
}

function flattenObj(obj, prefix = '') {
  const r = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(r, flattenObj(v, key));
    else r[key] = v;
  }
  return r;
}

async function addHistory(kv, userId, entry) {
  try {
    const raw = await kv.get(`payments:history:${userId}`);
    const h = raw ? JSON.parse(raw) : [];
    h.unshift({ id: genId(), ...entry, timestamp: new Date().toISOString() });
    await kv.put(`payments:history:${userId}`, JSON.stringify(h.slice(0, 200)));
  } catch { /* ignorar */ }
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  const view = new URL(request.url).searchParams.get('view') || 'overview';

  if (view === 'plans') {
    return json(200, { ok: true, plans: Object.values(PLANS).map(p => getPlanStatus(p.id, env)) });
  }

  if (view === 'invoices') {
    const raw = kv ? await kv.get(`payments:invoices:${session.sub}`) : null;
    return json(200, { ok: true, invoices: raw ? JSON.parse(raw) : [] });
  }

  if (view === 'history') {
    const raw = kv ? await kv.get(`payments:history:${session.sub}`) : null;
    return json(200, { ok: true, history: raw ? JSON.parse(raw) : [] });
  }

  if (view === 'methods') {
    const raw = kv ? await kv.get(`payments:methods:${session.sub}`) : null;
    return json(200, { ok: true, methods: raw ? JSON.parse(raw) : [] });
  }

  // overview
  const subRaw = kv ? await kv.get(`payments:subscription:${session.sub}`) : null;
  const sub = subRaw ? JSON.parse(subRaw) : { plan: 'free', status: 'active', activatedAt: new Date().toISOString() };
  const plan = getPlanStatus(sub.plan || 'free', env);
  const invRaw = kv ? await kv.get(`payments:invoices:${session.sub}`) : null;
  const invoices = invRaw ? JSON.parse(invRaw) : [];
  const stripeConfigured = !!(env.STRIPE_PUBLIC_KEY && env.STRIPE_SECRET_KEY);
  const mpConfigured = !!(env.MERCADO_PAGO_ACCESS_TOKEN && env.MERCADO_PAGO_PUBLIC_KEY);
  return json(200, {
    ok: true,
    subscription: sub,
    plan,
    billing: {
      stripeConfigured,
      mercadoPagoConfigured: mpConfigured,
      stripeSetupMessage: stripeConfigured ? null : 'Serviço aguardando configuração. Configure: STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET',
      mpSetupMessage: mpConfigured ? null : 'Serviço aguardando configuração. Configure: MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_PUBLIC_KEY',
    },
    recentInvoices: invoices.slice(0, 5),
    totalPaid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0),
  });
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  const { action } = body;

  // ── Criar checkout Stripe ────────────────────────────────────────────────
  if (action === 'create-checkout-stripe') {
    const { planId, currency = 'brl', successUrl, cancelUrl } = body;
    if (!planId || !PLANS[planId]) return json(400, { ok: false, error: 'Plano inválido' });
    if (!env.STRIPE_SECRET_KEY) return json(400, { ok: false, error: 'Serviço aguardando configuração. Configure: STRIPE_SECRET_KEY' });
    const plan = PLANS[planId];
    const priceKey = currency === 'brl' ? plan.stripe.price_brl : plan.stripe.price_usd;
    const priceId = priceKey ? env[priceKey] : null;
    if (!priceId) return json(400, { ok: false, error: `Serviço aguardando configuração. Configure: ${priceKey || 'STRIPE_PRICE_ID'}` });
    try {
      const checkout = await stripeRequest('POST', '/checkout/sessions', {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: session.sub,
        metadata: { planId, userId: session.sub },
        success_url: successUrl || `${new URL(request.url).origin}/app?billing=success`,
        cancel_url: cancelUrl || `${new URL(request.url).origin}/app?billing=cancelled`,
      }, env.STRIPE_SECRET_KEY);
      await addHistory(kv, session.sub, { type: 'checkout_initiated', provider: 'stripe', planId, currency });
      return json(200, { ok: true, checkoutUrl: checkout.url, sessionId: checkout.id });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  // ── Criar preferência Mercado Pago ───────────────────────────────────────
  if (action === 'create-checkout-mp') {
    const { planId, successUrl, failureUrl, pendingUrl } = body;
    if (!planId || !PLANS[planId]) return json(400, { ok: false, error: 'Plano inválido' });
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) return json(400, { ok: false, error: 'Serviço aguardando configuração. Configure: MERCADO_PAGO_ACCESS_TOKEN' });
    const plan = PLANS[planId];
    try {
      const pref = await mpRequest('POST', '/checkout/preferences', {
        items: [{ title: `LifeOS ${plan.name}`, quantity: 1, unit_price: plan.price.brl / 100, currency_id: 'BRL' }],
        back_urls: {
          success: successUrl || `${new URL(request.url).origin}/app?billing=success`,
          failure: failureUrl || `${new URL(request.url).origin}/app?billing=failed`,
          pending: pendingUrl || `${new URL(request.url).origin}/app?billing=pending`,
        },
        auto_return: 'approved',
        external_reference: `${session.sub}:${planId}`,
        metadata: { userId: session.sub, planId },
      }, env.MERCADO_PAGO_ACCESS_TOKEN);
      await addHistory(kv, session.sub, { type: 'checkout_initiated', provider: 'mercadopago', planId });
      return json(200, { ok: true, checkoutUrl: pref.init_point, preferenceId: pref.id });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  // ── Cancelar assinatura ──────────────────────────────────────────────────
  if (action === 'cancel') {
    const { reason } = body;
    const subRaw = await kv.get(`payments:subscription:${session.sub}`);
    const sub = subRaw ? JSON.parse(subRaw) : null;
    if (!sub || sub.plan === 'free') return json(400, { ok: false, error: 'Nenhuma assinatura ativa para cancelar' });
    if (sub.stripeSubscriptionId && env.STRIPE_SECRET_KEY) {
      try {
        await stripeRequest('DELETE', `/subscriptions/${sub.stripeSubscriptionId}`, {}, env.STRIPE_SECRET_KEY);
      } catch { /* continuar mesmo se Stripe falhar */ }
    }
    const cancelledSub = { ...sub, status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: reason || null };
    await kv.put(`payments:subscription:${session.sub}`, JSON.stringify(cancelledSub));
    await addHistory(kv, session.sub, { type: 'subscription_cancelled', planId: sub.plan, reason: reason || null });
    return json(200, { ok: true, message: 'Assinatura cancelada com sucesso.', subscription: cancelledSub });
  }

  // ── Upgrade / Downgrade ──────────────────────────────────────────────────
  if (action === 'change-plan') {
    const { newPlanId } = body;
    if (!newPlanId || !PLANS[newPlanId]) return json(400, { ok: false, error: 'Plano inválido' });
    const subRaw = await kv.get(`payments:subscription:${session.sub}`);
    const sub = subRaw ? JSON.parse(subRaw) : { plan: 'free', status: 'active' };
    const oldPlan = sub.plan;
    if (oldPlan === newPlanId) return json(400, { ok: false, error: 'Já está neste plano' });
    const newPlan = PLANS[newPlanId];
    const oldPrice = PLANS[oldPlan]?.price?.brl || 0;
    const isUpgrade = newPlan.price.brl > oldPrice;
    if (sub.stripeSubscriptionId && env.STRIPE_SECRET_KEY) {
      const priceId = newPlan.stripe.price_brl ? env[newPlan.stripe.price_brl] : null;
      if (priceId) {
        try {
          const stripeSub = await stripeRequest('GET', `/subscriptions/${sub.stripeSubscriptionId}`, {}, env.STRIPE_SECRET_KEY);
          const itemId = stripeSub.items?.data?.[0]?.id;
          if (itemId) {
            await stripeRequest('POST', `/subscriptions/${sub.stripeSubscriptionId}`, {
              items: [{ id: itemId, price: priceId }],
              proration_behavior: isUpgrade ? 'create_prorations' : 'none',
            }, env.STRIPE_SECRET_KEY);
          }
        } catch { /* continuar */ }
      }
    }
    const updatedSub = { ...sub, plan: newPlanId, previousPlan: oldPlan, changedAt: new Date().toISOString(), status: 'active' };
    await kv.put(`payments:subscription:${session.sub}`, JSON.stringify(updatedSub));
    await addHistory(kv, session.sub, { type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded', fromPlan: oldPlan, toPlan: newPlanId });
    return json(200, { ok: true, subscription: updatedSub, message: `Plano ${isUpgrade ? 'atualizado' : 'alterado'} para ${newPlan.name}` });
  }

  // ── Gerar invoice manual ─────────────────────────────────────────────────
  if (action === 'generate-invoice') {
    const { description, amount, currency = 'BRL' } = body;
    if (!description || !amount) return json(400, { ok: false, error: 'description e amount são obrigatórios' });
    const invoice = { id: genId(), userId: session.sub, description, amount, currency, status: 'pending', createdAt: new Date().toISOString(), dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() };
    const raw = await kv.get(`payments:invoices:${session.sub}`);
    const invoices = raw ? JSON.parse(raw) : [];
    invoices.unshift(invoice);
    await kv.put(`payments:invoices:${session.sub}`, JSON.stringify(invoices.slice(0, 100)));
    return json(201, { ok: true, invoice });
  }

  // ── Adicionar método de pagamento ────────────────────────────────────────
  if (action === 'add-payment-method') {
    const { type, last4, brand, expiryMonth, expiryYear, stripePaymentMethodId } = body;
    if (!type) return json(400, { ok: false, error: 'type é obrigatório' });
    const method = { id: genId(), type, last4: last4 || null, brand: brand || null, expiryMonth: expiryMonth || null, expiryYear: expiryYear || null, stripePaymentMethodId: stripePaymentMethodId || null, isDefault: false, addedAt: new Date().toISOString() };
    const raw = await kv.get(`payments:methods:${session.sub}`);
    const methods = raw ? JSON.parse(raw) : [];
    if (methods.length === 0) method.isDefault = true;
    methods.unshift(method);
    await kv.put(`payments:methods:${session.sub}`, JSON.stringify(methods.slice(0, 10)));
    return json(201, { ok: true, method });
  }

  // ── Remover método de pagamento ──────────────────────────────────────────
  if (action === 'remove-payment-method') {
    const { methodId } = body;
    if (!methodId) return json(400, { ok: false, error: 'methodId é obrigatório' });
    const raw = await kv.get(`payments:methods:${session.sub}`);
    const methods = raw ? JSON.parse(raw) : [];
    await kv.put(`payments:methods:${session.sub}`, JSON.stringify(methods.filter(m => m.id !== methodId)));
    return json(200, { ok: true, removed: methodId });
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: create-checkout-stripe, create-checkout-mp, cancel, change-plan, generate-invoice, add-payment-method, remove-payment-method' });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
