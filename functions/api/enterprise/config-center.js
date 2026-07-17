// LifeOS Enterprise — Configuration Center API v1.0
// Cloudflare Pages Function: GET/POST /api/enterprise/config-center
// Phase 231 — Enterprise Configuration Center
import { getCookie, json, verifySession } from '../../_auth.js';

const SERVICES = [
  { id: 'google-oauth',    name: 'Google OAuth',      envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], category: 'auth' },
  { id: 'apple-signin',    name: 'Apple Sign In',     envKeys: ['APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'], category: 'auth' },
  { id: 'gmail',           name: 'Gmail API',         envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], category: 'comm' },
  { id: 'outlook',         name: 'Outlook API',       envKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'], category: 'comm' },
  { id: 'whatsapp',        name: 'WhatsApp Business', envKeys: ['WHATSAPP_APP_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_PHONE_ID'], category: 'comm' },
  { id: 'stripe',          name: 'Stripe',            envKeys: ['STRIPE_PUBLIC_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], category: 'billing' },
  { id: 'mercado-pago',    name: 'Mercado Pago',      envKeys: ['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_PUBLIC_KEY'], category: 'billing' },
  { id: 'openai',          name: 'OpenAI',            envKeys: ['OPENAI_API_KEY'], category: 'ai' },
  { id: 'cloudflare-r2',   name: 'Cloudflare R2',     envKeys: ['R2_BUCKET', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'], category: 'storage' },
  { id: 'cloudflare-kv',   name: 'Cloudflare KV',     kvCheck: true, category: 'storage' },
  { id: 'smtp',            name: 'SMTP',              envKeys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'], category: 'comm' },
  { id: 'webhooks',        name: 'Webhooks',          envKeys: ['LIFEOS_WEBHOOK_SECRET'], category: 'comm' },
];

async function testConnection(serviceId, env) {
  const now = new Date().toISOString();
  try {
    switch (serviceId) {
      case 'openai':
        if (!env.OPENAI_API_KEY) throw new Error('Chave ausente');
        const aiRes = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` }
        });
        if (!aiRes.ok) throw new Error(`OpenAI: ${aiRes.status}`);
        return { ok: true, message: 'Conexão estabelecida com sucesso', timestamp: now };
      
      case 'cloudflare-kv':
        if (!env.LIFEOS_KV) throw new Error('KV não configurado');
        await env.LIFEOS_KV.put('sys:test', 'ok', { expirationTtl: 60 });
        return { ok: true, message: 'Escrita e leitura no KV OK', timestamp: now };

      case 'stripe':
        if (!env.STRIPE_SECRET_KEY) throw new Error('Chave secreta ausente');
        const stripeRes = await fetch('https://api.stripe.com/v1/balance', {
          headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
        });
        if (!stripeRes.ok) throw new Error(`Stripe: ${stripeRes.status}`);
        return { ok: true, message: 'API do Stripe validada', timestamp: now };

      default:
        return { ok: false, message: 'Teste automático não implementado para este serviço. Verifique logs manuais.', timestamp: now };
    }
  } catch (e) {
    return { ok: false, message: e.message, timestamp: now };
  }
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  
  const isAdmin = session.sub === env.LIFEOS_ADMIN_USER || session.role === 'admin' || session.role === 'owner';
  if (!isAdmin) return json(403, { ok: false, error: 'Acesso restrito' });

  const kv = env.LIFEOS_KV;
  const configStatus = await Promise.all(SERVICES.map(async (s) => {
    let status = 'missing';
    let missingKeys = [];
    
    if (s.kvCheck) {
      status = kv ? 'ok' : 'missing';
    } else {
      missingKeys = s.envKeys.filter(k => !env[k]);
      status = missingKeys.length === 0 ? 'ok' : (missingKeys.length === s.envKeys.length ? 'missing' : 'partial');
    }

    const lastTestRaw = kv ? await kv.get(`sys:test:${s.id}`) : null;
    const lastTest = lastTestRaw ? JSON.parse(lastTestRaw) : null;

    return {
      ...s,
      status,
      missingKeys,
      environment: env.LIFEOS_ENV || 'production',
      lastTest,
      lastSync: lastTest?.timestamp || null,
    };
  }));

  return json(200, { ok: true, services: configStatus, timestamp: new Date().toISOString() });
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  
  const isAdmin = session.sub === env.LIFEOS_ADMIN_USER || session.role === 'admin' || session.role === 'owner';
  if (!isAdmin) return json(403, { ok: false, error: 'Acesso restrito' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  
  if (body.action === 'test-connection') {
    const { serviceId } = body;
    if (!serviceId) return json(400, { ok: false, error: 'serviceId obrigatório' });
    
    const result = await testConnection(serviceId, env);
    if (env.LIFEOS_KV) {
      await env.LIFEOS_KV.put(`sys:test:${serviceId}`, JSON.stringify(result));
    }
    return json(200, { ok: true, result });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
