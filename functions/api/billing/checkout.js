// LifeOS Enterprise — Billing Checkout Proxy
// Cloudflare Pages Function: POST /api/billing/checkout
// Proxy para /api/payments/billing com action=create-checkout-stripe
import { getCookie, json, verifySession } from '../../_auth.js';

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { plan } = body;
  if (!plan) return json(400, { ok: false, error: 'Plano obrigatório' });

  // Verificar se Stripe está configurado
  const stripeKey = env.STRIPE_SECRET_KEY;
  const mpKey = env.MERCADOPAGO_ACCESS_TOKEN;

  if (!stripeKey && !mpKey) {
    // Sem gateway configurado — redirecionar para contato comercial
    return json(200, { ok: false, error: 'Entre em contato: sales@lifeos.app', contactEmail: 'sales@lifeos.app' });
  }

  // Redirecionar para o endpoint real de billing
  const provider = stripeKey ? 'stripe' : 'mercadopago';
  const action = provider === 'stripe' ? 'create-checkout-stripe' : 'create-checkout-mp';

  const kv = env.LIFEOS_KV;
  const origin = new URL(request.url).origin;

  // Chamar o endpoint de billing internamente
  const billingReq = new Request(`${origin}/api/payments/billing`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cookie': request.headers.get('cookie') || '' },
    body: JSON.stringify({ action, planId: plan, currency: 'brl' }),
  });

  try {
    const billingResp = await fetch(billingReq);
    const d = await billingResp.json();
    return json(billingResp.status, d);
  } catch {
    return json(500, { ok: false, error: 'Erro ao processar checkout' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
