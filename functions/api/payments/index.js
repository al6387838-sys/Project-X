// LifeOS Enterprise — Payments API v1.0
// Cloudflare Pages Function: GET/POST /api/payments
// Phase 147 — Real Payment Platform
// Stripe + Mercado Pago · Assinaturas · Planos · Invoices · Webhooks · Histórico
import { getCookie, json, verifySession, hasPermission } from '../../_auth.js';

function lifeosLogError(env, operation, error, details = {}) {
  try {
    if (!env?.LIFEOS_KV) return;
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      error: error?.message || String(error),
      stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
      ...details,
    };
    env.LIFEOS_KV.put('error-logs', JSON.stringify([logEntry, ...JSON.parse(env.LIFEOS_KV.get('error-logs') || '[]').slice(0, 99)]));
  } catch { /* silent */ }
}

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

// ─── Planos disponíveis ───────────────────────────────────────────────────────
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Para uso pessoal básico',
    price: { brl: 0, usd: 0 },
    interval: 'month',
    features: ['1 usuário', '1 GB armazenamento', 'Módulos básicos', 'Suporte por e-mail'],
    limits: { users: 1, storage_gb: 1, api_calls: 1000 },
    stripe: { price_id_brl: null, price_id_usd: null },
    mercadopago: { plan_id: null },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Para freelancers e pequenas equipes',
    price: { brl: 4900, usd: 990 }, // centavos
    interval: 'month',
    features: ['5 usuários', '10 GB armazenamento', 'Todos os módulos', 'Suporte prioritário', 'API básica'],
    limits: { users: 5, storage_gb: 10, api_calls: 10000 },
    stripe: { price_id_brl: process?.env?.STRIPE_PRICE_STARTER_BRL || null, price_id_usd: process?.env?.STRIPE_PRICE_STARTER_USD || null },
    mercadopago: { plan_id: process?.env?.MP_PLAN_STARTER || null },
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Para empresas em crescimento',
    price: { brl: 14900, usd: 2990 },
    interval: 'month',
    features: ['25 usuários', '100 GB armazenamento', 'Todos os módulos', 'AI Orchestrator', 'API completa', 'Suporte 24/7', 'SLA 99.9%'],
    limits: { users: 25, storage_gb: 100, api_calls: 100000 },
    stripe: { price_id_brl: process?.env?.STRIPE_PRICE_PRO_BRL || null, price_id_usd: process?.env?.STRIPE_PRICE_PRO_USD || null },
    mercadopago: { plan_id: process?.env?.MP_PLAN_PRO || null },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Para grandes organizações',
    price: { brl: 49900, usd: 9990 },
    interval: 'month',
    features: ['Usuários ilimitados', '1 TB armazenamento', 'Todos os módulos', 'AI Orchestrator', 'API ilimitada', 'Suporte dedicado', 'SLA 99.99%', 'SSO/SAML', 'Compliance'],
    limits: { users: -1, storage_gb: 1000, api_calls: -1 },
    stripe: { price_id_brl: process?.env?.STRIPE_PRICE_ENT_BRL || null, price_id_usd: process?.env?.STRIPE_PRICE_ENT_USD || null },
    mercadopago: { plan_id: process?.env?.MP_PLAN_ENT || null },
  },
};

// ─── Stripe helper ────────────────────────────────────────────────────────────
async function stripeRequest(method, path, body, apiKey) {
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY não configurada');
  const url = `https://api.stripe.com/v1${path}`;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = new URLSearchParams(flattenObject(body)).toString();
  }
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Erro Stripe');
  return data;
}

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else if (value !== null && value !== undefined) {
      result[fullKey] = String(value);
    }
  }
  return result;
}

// ─── Mercado Pago helper ──────────────────────────────────────────────────────
async function mpRequest(method, path, body, accessToken) {
  if (!accessToken) throw new Error('MP_ACCESS_TOKEN não configurado');
  const url = `https://api.mercadopago.com${path}`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': generateId(),
  };
  const options = { method, headers };
  if (body && method !== 'GET') options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro Mercado Pago');
  return data;
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'subscription';
  const kv = env.LIFEOS_KV;

  if (!kv) return json(200, { ok: true, data: {}, source: 'unavailable' });

  try {
    switch (view) {
      case 'plans':
        return json(200, { ok: true, plans: Object.values(PLANS) });

      case 'subscription': {
        const raw = await kv.get(`payments:subscription:${session.sub}`);
        const sub = raw ? JSON.parse(raw) : { plan: 'free', status: 'active' };
        const plan = PLANS[sub.plan] || PLANS.free;
        return json(200, { ok: true, subscription: { ...sub, planDetails: plan } });
      }

      case 'invoices': {
        const raw = await kv.get(`payments:invoices:${session.sub}`);
        const invoices = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, invoices });
      }

      case 'payment-methods': {
        const raw = await kv.get(`payments:methods:${session.sub}`);
        const methods = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, methods });
      }

      case 'history': {
        const raw = await kv.get(`payments:history:${session.sub}`);
        const history = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, history });
      }

      case 'usage': {
        const subRaw = await kv.get(`payments:subscription:${session.sub}`);
        const sub = subRaw ? JSON.parse(subRaw) : { plan: 'free' };
        const plan = PLANS[sub.plan] || PLANS.free;
        const usageRaw = await kv.get(`payments:usage:${session.sub}`);
        const usage = usageRaw ? JSON.parse(usageRaw) : { api_calls: 0, storage_gb: 0, users: 1 };
        return json(200, {
          ok: true,
          usage: {
            current: usage,
            limits: plan.limits,
            percentages: {
              api_calls: plan.limits.api_calls > 0 ? Math.min(100, Math.round((usage.api_calls / plan.limits.api_calls) * 100)) : 0,
              storage_gb: plan.limits.storage_gb > 0 ? Math.min(100, Math.round((usage.storage_gb / plan.limits.storage_gb) * 100)) : 0,
              users: plan.limits.users > 0 ? Math.min(100, Math.round((usage.users / plan.limits.users) * 100)) : 0,
            },
          },
        });
      }

      default:
        return json(400, { ok: false, error: 'view inválido' });
    }
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar dados de pagamento' });
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

  // ─── Criar checkout Stripe ───
  if (action === 'create-checkout-stripe') {
    const { planId, currency = 'brl', successUrl, cancelUrl } = body;
    const plan = PLANS[planId];
    if (!plan) return json(400, { ok: false, error: 'Plano inválido' });
    if (plan.id === 'free') return json(400, { ok: false, error: 'Plano free não requer checkout' });

    const stripeKey = env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      // Modo pendente: salvar intenção e retornar instrução
      const pending = {
        id: generateId(),
        type: 'stripe-checkout',
        planId,
        currency,
        userId: session.sub,
        status: 'pending-credentials',
        createdAt: new Date().toISOString(),
      };
      const raw = await kv.get(`payments:pending:${session.sub}`);
      const pendings = raw ? JSON.parse(raw) : [];
      pendings.unshift(pending);
      await kv.put(`payments:pending:${session.sub}`, JSON.stringify(pendings.slice(0, 10)));
      return json(202, {
        ok: false,
        pending: true,
        message: 'Configure STRIPE_SECRET_KEY nas variáveis de ambiente do Cloudflare Pages para ativar pagamentos.',
        pendingId: pending.id,
        requiredEnvVars: ['STRIPE_SECRET_KEY', `STRIPE_PRICE_${planId.toUpperCase()}_${currency.toUpperCase()}`],
      });
    }

    try {
      const priceId = plan.stripe[`price_id_${currency}`];
      if (!priceId) return json(400, { ok: false, error: `Price ID Stripe para ${planId}/${currency} não configurado` });

      const checkoutSession = await stripeRequest('POST', '/checkout/sessions', {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: session.email || session.sub,
        client_reference_id: session.sub,
        success_url: successUrl || `${new URL(request.url).origin}/app?payment=success&plan=${planId}`,
        cancel_url: cancelUrl || `${new URL(request.url).origin}/app?payment=cancelled`,
        metadata: { userId: session.sub, planId },
        subscription_data: { metadata: { userId: session.sub, planId } },
      }, stripeKey);

      return json(200, { ok: true, checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id });
    } catch (err) {
      return json(500, { ok: false, error: err.message });
    }
  }

  // ─── Criar checkout Mercado Pago ───
  if (action === 'create-checkout-mercadopago') {
    const { planId, successUrl, failureUrl, pendingUrl } = body;
    const plan = PLANS[planId];
    if (!plan) return json(400, { ok: false, error: 'Plano inválido' });
    if (plan.id === 'free') return json(400, { ok: false, error: 'Plano free não requer checkout' });

    const mpToken = env.MP_ACCESS_TOKEN;
    if (!mpToken) {
      const pending = {
        id: generateId(),
        type: 'mp-checkout',
        planId,
        userId: session.sub,
        status: 'pending-credentials',
        createdAt: new Date().toISOString(),
      };
      const raw = await kv.get(`payments:pending:${session.sub}`);
      const pendings = raw ? JSON.parse(raw) : [];
      pendings.unshift(pending);
      await kv.put(`payments:pending:${session.sub}`, JSON.stringify(pendings.slice(0, 10)));
      return json(202, {
        ok: false,
        pending: true,
        message: 'Configure MP_ACCESS_TOKEN nas variáveis de ambiente do Cloudflare Pages para ativar pagamentos via Mercado Pago.',
        pendingId: pending.id,
        requiredEnvVars: ['MP_ACCESS_TOKEN', `MP_PLAN_${planId.toUpperCase()}`],
      });
    }

    try {
      const origin = new URL(request.url).origin;
      const preference = await mpRequest('POST', '/checkout/preferences', {
        items: [{
          id: planId,
          title: `LifeOS Enterprise — ${plan.name}`,
          description: plan.description,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: plan.price.brl / 100,
        }],
        payer: { email: session.email || session.sub },
        back_urls: {
          success: successUrl || `${origin}/app?payment=success&plan=${planId}`,
          failure: failureUrl || `${origin}/app?payment=failure`,
          pending: pendingUrl || `${origin}/app?payment=pending`,
        },
        auto_return: 'approved',
        external_reference: `${session.sub}:${planId}:${generateId()}`,
        metadata: { userId: session.sub, planId },
      }, mpToken);

      return json(200, { ok: true, checkoutUrl: preference.init_point, preferenceId: preference.id });
    } catch (err) {
      return json(500, { ok: false, error: err.message });
    }
  }

  // ─── Cancelar assinatura ───
  if (action === 'cancel-subscription') {
    const { reason } = body;
    const raw = await kv.get(`payments:subscription:${session.sub}`);
    const sub = raw ? JSON.parse(raw) : null;
    if (!sub || sub.plan === 'free') return json(400, { ok: false, error: 'Nenhuma assinatura ativa para cancelar' });

    const stripeKey = env.STRIPE_SECRET_KEY;
    if (stripeKey && sub.stripeSubscriptionId) {
      try {
        await stripeRequest('DELETE', `/subscriptions/${sub.stripeSubscriptionId}`, {}, stripeKey);
      } catch (err) {
        
      }
    }

    sub.status = 'cancelled';
    sub.cancelledAt = new Date().toISOString();
    sub.cancellationReason = reason || '';
    await kv.put(`payments:subscription:${session.sub}`, JSON.stringify(sub));

    // Registrar no histórico
    await addPaymentHistory(kv, session.sub, {
      type: 'cancellation',
      planId: sub.plan,
      amount: 0,
      status: 'cancelled',
      description: `Assinatura ${sub.plan} cancelada`,
    });

    return json(200, { ok: true, message: 'Assinatura cancelada' });
  }

  // ─── Upgrade/Downgrade de plano ───
  if (action === 'change-plan') {
    const { newPlanId } = body;
    const newPlan = PLANS[newPlanId];
    if (!newPlan) return json(400, { ok: false, error: 'Plano inválido' });

    const raw = await kv.get(`payments:subscription:${session.sub}`);
    const sub = raw ? JSON.parse(raw) : { plan: 'free', status: 'active' };
    const oldPlan = sub.plan;

    if (oldPlan === newPlanId) return json(400, { ok: false, error: 'Já está neste plano' });

    // Se upgrade para plano pago e Stripe configurado, redirecionar para checkout
    if (newPlan.price.brl > 0 && env.STRIPE_SECRET_KEY) {
      return json(200, {
        ok: true,
        requiresCheckout: true,
        message: 'Redirecionando para checkout',
        planId: newPlanId,
      });
    }

    // Downgrade para free ou sem Stripe: atualizar diretamente
    sub.plan = newPlanId;
    sub.previousPlan = oldPlan;
    sub.changedAt = new Date().toISOString();
    if (newPlan.price.brl === 0) sub.status = 'active';
    await kv.put(`payments:subscription:${session.sub}`, JSON.stringify(sub));

    await addPaymentHistory(kv, session.sub, {
      type: 'plan-change',
      fromPlan: oldPlan,
      toPlan: newPlanId,
      amount: 0,
      status: 'completed',
      description: `Plano alterado de ${oldPlan} para ${newPlanId}`,
    });

    return json(200, { ok: true, subscription: sub, message: `Plano alterado para ${newPlan.name}` });
  }

  // ─── Gerar invoice manual ───
  if (action === 'generate-invoice') {
    const { description, amount, currency = 'BRL' } = body;
    if (!description || !amount) return json(400, { ok: false, error: 'description e amount obrigatórios' });

    const invoice = {
      id: generateId(),
      userId: session.sub,
      description,
      amount,
      currency,
      status: 'pending',
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const raw = await kv.get(`payments:invoices:${session.sub}`);
    const invoices = raw ? JSON.parse(raw) : [];
    invoices.unshift(invoice);
    await kv.put(`payments:invoices:${session.sub}`, JSON.stringify(invoices.slice(0, 100)));

    return json(201, { ok: true, invoice });
  }

  // ─── Adicionar método de pagamento (tokenizado) ───
  if (action === 'add-payment-method') {
    const { type, last4, brand, expiryMonth, expiryYear, stripePaymentMethodId } = body;
    if (!type) return json(400, { ok: false, error: 'type obrigatório' });

    const method = {
      id: generateId(),
      type,
      last4: last4 || null,
      brand: brand || null,
      expiryMonth: expiryMonth || null,
      expiryYear: expiryYear || null,
      stripePaymentMethodId: stripePaymentMethodId || null,
      isDefault: false,
      addedAt: new Date().toISOString(),
    };

    const raw = await kv.get(`payments:methods:${session.sub}`);
    const methods = raw ? JSON.parse(raw) : [];
    if (methods.length === 0) method.isDefault = true;
    methods.unshift(method);
    await kv.put(`payments:methods:${session.sub}`, JSON.stringify(methods.slice(0, 10)));

    return json(201, { ok: true, method });
  }

  // ─── Remover método de pagamento ───
  if (action === 'remove-payment-method') {
    const { methodId } = body;
    if (!methodId) return json(400, { ok: false, error: 'methodId obrigatório' });

    const raw = await kv.get(`payments:methods:${session.sub}`);
    const methods = raw ? JSON.parse(raw) : [];
    const filtered = methods.filter(m => m.id !== methodId);
    await kv.put(`payments:methods:${session.sub}`, JSON.stringify(filtered));

    return json(200, { ok: true, removed: methodId });
  }

  // ─── Selecionar plano (onboarding — sem checkout imediato) ───
  if (action === 'select-plan') {
    const { planId } = body;
    const plan = PLANS[planId];
    if (!plan) return json(400, { ok: false, error: 'Plano inválido' });
    const raw = await kv.get(`payments:subscription:${session.sub}`);
    const sub = raw ? JSON.parse(raw) : {};
    const updated = {
      ...sub,
      plan: planId,
      status: plan.price.brl === 0 ? 'active' : 'pending_payment',
      selectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.put(`payments:subscription:${session.sub}`, JSON.stringify(updated));
    // Atualizar plano no perfil do usuário
    const userRaw = await kv.get(`user:${session.sub}`);
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        user.plan = planId;
        user.updatedAt = new Date().toISOString();
        await kv.put(`user:${session.sub}`, JSON.stringify(user));
      } catch { /* ignorar */ }
    }
    return json(200, {
      ok: true,
      subscription: updated,
      message: `Plano ${plan.name} selecionado. ${plan.price.brl > 0 ? 'Configure o pagamento em Billing para ativar.' : 'Plano ativo.'}`,
      requiresPayment: plan.price.brl > 0,
    });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

async function addPaymentHistory(kv, userId, entry) {
  try {
    const raw = await kv.get(`payments:history:${userId}`);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift({ id: generateId(), ...entry, timestamp: new Date().toISOString() });
    await kv.put(`payments:history:${userId}`, JSON.stringify(history.slice(0, 200)));
  } catch { /* ignorar */ }
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    case 'PUT': // fallthrough
    case 'PATCH': // fallthrough
    case 'DELETE': // fallthrough
    case 'OPTIONS': if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
