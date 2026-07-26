// LifeOS Enterprise — Payments Webhook Handler v1.0
// Cloudflare Pages Function: POST /api/payments/webhook
// Phase 147 — Real Payment Platform
// Processa eventos de Stripe e Mercado Pago de forma segura
import { json } from '../../_auth.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

// Verificar assinatura do webhook Stripe
async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  try {
    const parts = sigHeader.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const signature = parts.find(p => p.startsWith('v1='))?.split('=')[1];
    if (!timestamp || !signature) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === signature;
  } catch { return false; }
}

async function handleStripeEvent(event, kv) {
  const { type, data } = event;
  const obj = data?.object;

  switch (type) {
    case 'checkout.session.completed': {
      const userId = obj.client_reference_id || obj.metadata?.userId;
      const planId = obj.metadata?.planId;
      if (!userId || !planId) break;

      const sub = {
        plan: planId,
        status: 'active',
        provider: 'stripe',
        stripeCustomerId: obj.customer,
        stripeSubscriptionId: obj.subscription,
        activatedAt: new Date().toISOString(),
        currentPeriodEnd: null,
      };
      await kv.put(`payments:subscription:${userId}`, JSON.stringify(sub));

      // Registrar invoice
      const invoice = {
        id: generateId(),
        userId,
        stripeInvoiceId: obj.id,
        amount: obj.amount_total,
        currency: obj.currency?.toUpperCase() || 'BRL',
        status: 'paid',
        description: `Assinatura ${planId} — LifeOS Enterprise`,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const invRaw = await kv.get(`payments:invoices:${userId}`);
      const invoices = invRaw ? JSON.parse(invRaw) : [];
      invoices.unshift(invoice);
      await kv.put(`payments:invoices:${userId}`, JSON.stringify(invoices.slice(0, 100)));

      // Histórico
      const histRaw = await kv.get(`payments:history:${userId}`);
      const history = histRaw ? JSON.parse(histRaw) : [];
      history.unshift({
        id: generateId(),
        type: 'payment',
        planId,
        amount: obj.amount_total,
        currency: obj.currency?.toUpperCase() || 'BRL',
        status: 'paid',
        provider: 'stripe',
        description: `Pagamento recebido — ${planId}`,
        timestamp: new Date().toISOString(),
      });
      await kv.put(`payments:history:${userId}`, JSON.stringify(history.slice(0, 200)));
      break;
    }

    case 'customer.subscription.updated': {
      const userId = obj.metadata?.userId;
      if (!userId) break;
      const raw = await kv.get(`payments:subscription:${userId}`);
      const sub = raw ? JSON.parse(raw) : {};
      sub.status = obj.status === 'active' ? 'active' : obj.status;
      sub.currentPeriodEnd = new Date(obj.current_period_end * 1000).toISOString();
      await kv.put(`payments:subscription:${userId}`, JSON.stringify(sub));
      break;
    }

    case 'customer.subscription.deleted': {
      const userId = obj.metadata?.userId;
      if (!userId) break;
      const raw = await kv.get(`payments:subscription:${userId}`);
      const sub = raw ? JSON.parse(raw) : {};
      sub.status = 'cancelled';
      sub.cancelledAt = new Date().toISOString();
      await kv.put(`payments:subscription:${userId}`, JSON.stringify(sub));
      break;
    }

    case 'invoice.payment_failed': {
      const userId = obj.subscription_details?.metadata?.userId || obj.metadata?.userId;
      if (!userId) break;
      const raw = await kv.get(`payments:subscription:${userId}`);
      const sub = raw ? JSON.parse(raw) : {};
      sub.status = 'past_due';
      sub.lastPaymentFailedAt = new Date().toISOString();
      await kv.put(`payments:subscription:${userId}`, JSON.stringify(sub));
      break;
    }

    default:
      break;
  }
}

async function verifyMercadoPagoSignature(requestBody, signature, secret) {
  if (!secret || !signature) return false;
  try {
    // Mercado Pago usa header x-signature com formato: t=TIMESTAMP,v1=SIGNATURE
    const parts = typeof signature === 'string' ? signature.split(',') : [];
    const ts = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];
    if (!ts || !v1) return false;

    // Verificar timestamp (max 5 min)
    if (Date.now() - parseInt(ts) * 1000 > 5 * 60 * 1000) return false;

    // Verificar assinatura HMAC-SHA256
    const signedPayload = `${ts}:${requestBody}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === v1;
  } catch { return false; }
}

async function handleMercadoPagoEvent(event, kv, env) {
  const { action, data } = event;

  if (action === 'payment.created' || action === 'payment.updated') {
    const paymentId = data?.id;
    if (!paymentId) return;

    // Buscar detalhes do pagamento na API do MP
    try {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` }
      });
      if (mpRes.ok) {
        const payment = await mpRes.json();
        const userId = payment.metadata?.userId || payment.external_reference;
        if (userId) {
          const subRaw = await kv.get(`payments:subscription:${userId}`);
          if (subRaw) {
            const sub = JSON.parse(subRaw);
            sub.status = payment.status === 'approved' ? 'active' : payment.status === 'rejected' ? 'cancelled' : sub.status;
            await kv.put(`payments:subscription:${userId}`, JSON.stringify(sub));
          }
          if (payment.status === 'approved') {
            const invoice = {
              id: generateId(),
              userId,
              mpPaymentId: paymentId,
              amount: payment.transaction_amount,
              currency: (payment.currency_id || 'BRL').toUpperCase(),
              status: 'paid',
              description: `Pagamento Mercado Pago — ${paymentId}`,
              paidAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            const invRaw = await kv.get(`payments:invoices:${userId}`);
            const invoices = invRaw ? JSON.parse(invRaw) : [];
            invoices.unshift(invoice);
            await kv.put(`payments:invoices:${userId}`, JSON.stringify(invoices.slice(0, 100)));
          }
        }
      }
    } catch { /* API call failed, still log event */ }

    const histEntry = {
      id: generateId(),
      type: 'mp-event',
      action,
      paymentId,
      status: 'received',
      provider: 'mercadopago',
      timestamp: new Date().toISOString(),
    };

    const logRaw = await kv.get('payments:webhook-log');
    const log = logRaw ? JSON.parse(logRaw) : [];
    log.unshift(histEntry);
    await kv.put('payments:webhook-log', JSON.stringify(log.slice(0, 500)));
  }
}

export async function onRequestPost({ request, env }) {
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const contentType = request.headers.get('content-type') || '';
  const stripeSignature = request.headers.get('stripe-signature');
  const body = await request.text();

  // ─── Stripe Webhook ───
  if (stripeSignature) {
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const valid = await verifyStripeSignature(body, stripeSignature, webhookSecret);
      if (!valid) return json(400, { ok: false, error: 'Assinatura Stripe inválida' });
    }

    try {
      const event = JSON.parse(body);
      await handleStripeEvent(event, kv);

      // Log do evento
      const logRaw = await kv.get('payments:webhook-log');
      const log = logRaw ? JSON.parse(logRaw) : [];
      log.unshift({
        id: generateId(),
        provider: 'stripe',
        type: event.type,
        eventId: event.id,
        receivedAt: new Date().toISOString(),
      });
      await kv.put('payments:webhook-log', JSON.stringify(log.slice(0, 500)));

      return json(200, { ok: true, received: true });
    } catch (err) {
      return json(400, { ok: false, error: 'Evento Stripe inválido' });
    }
  }

  // ─── Mercado Pago Webhook ───
  const mpSignature = request.headers.get('x-signature');
  const mpMpSignature = request.headers.get('x-signature-id');
  const mpConfig = env.MERCADOPAGO_WEBHOOK_SECRET || env.MERCADOPAGO_APP_ID;
  if (mpSignature || mpMpSignature) {
    // Verificar assinatura do webhook MP
    const secret = env.MERCADOPAGO_WEBHOOK_SECRET;
    if (secret) {
      const valid = await verifyMercadoPagoSignature(body, mpSignature || mpMpSignature, secret);
      if (!valid) return json(400, { ok: false, error: 'Assinatura Mercado Pago inválida' });
    }
    try {
      const event = JSON.parse(body);
      if (event.type === 'payment' || event.action) {
        await handleMercadoPagoEvent(event, kv, env);
        return json(200, { ok: true, received: true });
      }
    } catch (err) {
      return json(400, { ok: false, error: 'Evento Mercado Pago inválido' });
    }
  } else if (mpConfig) {
    // Fallback: se não há assinatura mas há config MP, aceitar (modo dev)
    try {
      const event = JSON.parse(body);
      if (event.type === 'payment' || event.action) {
        await handleMercadoPagoEvent(event, kv, env);
        return json(200, { ok: true, received: true });
      }
    } catch { /* ignorar */ }
  }

  return json(400, { ok: false, error: 'Webhook não reconhecido' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
