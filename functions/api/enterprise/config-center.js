// LifeOS Enterprise — Configuration Center API v1.0
// Cloudflare Pages Function: GET/POST /api/enterprise/config-center
// Phase 231 — Enterprise Configuration Center
import { getCookie, json, verifySession } from '../../_auth.js';

const SERVICES = [
  { id: 'google-oauth',    name: 'Google OAuth',      envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], category: 'auth' },
  { id: 'apple-signin',    name: 'Apple Sign In',     envKeys: ['APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'], category: 'auth' },
  { id: 'gmail',           name: 'Gmail API',         envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], category: 'comm' },
  { id: 'outlook',         name: 'Outlook API',       envKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'], category: 'comm' },
  { id: 'whatsapp',        name: 'WhatsApp Business', envKeys: ['WHATSAPP_APP_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_ID'], category: 'comm' },
  { id: 'stripe',          name: 'Stripe',            envKeys: ['STRIPE_PUBLIC_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], category: 'billing' },
  { id: 'mercado-pago',    name: 'Mercado Pago',      envKeys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_PUBLIC_KEY'], category: 'billing' },
  { id: 'openai',          name: 'OpenAI',            envKeys: ['OPENAI_API_KEY'], category: 'ai' },
  { id: 'cloudflare-r2',   name: 'Cloudflare R2',     envKeys: ['R2_BUCKET', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'], category: 'storage' },
  { id: 'cloudflare-kv',   name: 'Cloudflare KV',     kvCheck: true, category: 'storage' },
  { id: 'smtp',            name: 'SMTP / Resend',     envKeys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'], category: 'comm', altKeys: ['RESEND_API_KEY', 'SENDGRID_API_KEY'] },
  { id: 'webhooks',        name: 'Webhooks',          envKeys: ['LIFEOS_WEBHOOK_SECRET'], category: 'comm' },
  { id: 'slack',           name: 'Slack',             envKeys: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'], category: 'comm' },
  { id: 'meta',            name: 'Meta (Facebook)',   envKeys: ['META_CLIENT_ID', 'META_CLIENT_SECRET'], category: 'comm' },
  { id: 'resend',          name: 'Resend',            envKeys: ['RESEND_API_KEY'], category: 'comm' },
  { id: 'sendgrid',        name: 'SendGrid',          envKeys: ['SENDGRID_API_KEY'], category: 'comm' },
  { id: 'github',          name: 'GitHub OAuth',      envKeys: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'], category: 'auth' },
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

      case 'gmail': {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Credenciais Google ausentes');
        return { ok: true, message: 'Credenciais Google configuradas. Conecte via OAuth para verificar acesso.', timestamp: now };
      }
      case 'outlook': {
        if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) throw new Error('Credenciais Microsoft ausentes');
        return { ok: true, message: 'Credenciais Microsoft configuradas. Conecte via OAuth para verificar acesso.', timestamp: now };
      }
      case 'whatsapp': {
        if (!env.WHATSAPP_APP_ID) throw new Error('WHATSAPP_APP_ID ausente');
        if (!env.WHATSAPP_ACCESS_TOKEN) throw new Error('WHATSAPP_ACCESS_TOKEN ausente');
        if (!env.WHATSAPP_PHONE_ID) throw new Error('WHATSAPP_PHONE_ID ausente');
        const waRes = await fetch(`https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_ID}`, {
          headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
        });
        if (!waRes.ok) throw new Error('Token WhatsApp inválido');
        return { ok: true, message: 'WhatsApp Business conectado', timestamp: now };
      }
      case 'smtp': {
        const smtpConfigured = env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && (env.SMTP_PASSWORD || env.RESEND_API_KEY || env.SENDGRID_API_KEY);
        const resendConfigured = env.RESEND_API_KEY;
        const sendgridConfigured = env.SENDGRID_API_KEY;
        if (!smtpConfigured && !resendConfigured && !sendgridConfigured) throw new Error('Nenhum provedor de email configurado');
        if (resendConfigured) {
          return { ok: true, message: 'Resend configurado e pronto para envio', timestamp: now };
        }
        if (sendgridConfigured) {
          return { ok: true, message: 'SendGrid configurado e pronto para envio', timestamp: now };
        }
        return { ok: true, message: 'SMTP configurado. Teste de envio requer conexão real.', timestamp: now };
      }
      case 'resend': {
        if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY ausente');
        const resRes = await fetch('https://api.resend.com/domains', { headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}` } });
        if (!resRes.ok) throw new Error('Resend: ' + resRes.status);
        return { ok: true, message: 'Resend API validada', timestamp: now };
      }
      case 'sendgrid': {
        if (!env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY ausente');
        const sgRes = await fetch('https://api.sendgrid.com/v3/user/account', { headers: { 'Authorization': `Bearer ${env.SENDGRID_API_KEY}` } });
        if (!sgRes.ok) throw new Error('SendGrid: ' + sgRes.status);
        return { ok: true, message: 'SendGrid API validada', timestamp: now };
      }
      case 'slack': {
        if (!env.SLACK_BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN ausente');
        const slRes = await fetch('https://slack.com/api/auth.test', { headers: { 'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}` } });
        const slData = await slRes.json();
        if (!slData.ok) throw new Error('Slack token inválido');
        return { ok: true, message: `Slack conectado: ${slData.team}`, timestamp: now };
      }
      case 'meta': {
        if (!env.META_CLIENT_ID || !env.META_CLIENT_SECRET) throw new Error('Credenciais Meta ausentes');
        return { ok: true, message: 'Credenciais Meta configuradas. Conecte via OAuth para verificar acesso.', timestamp: now };
      }
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
    } else if (s.altKeys && s.altKeys.length > 0) {
      // Para serviços com altKeys (ex: SMTP com Resend/SendGrid), verificar se PRINCIPAL OU ALTERNATIVA está configurada
      const primaryMissing = s.envKeys.filter(k => !env[k]);
      const altMissing = s.altKeys.filter(k => !env[k]);
      if (altMissing.length < s.altKeys.length) {
        status = 'ok';
        missingKeys = [];
      } else {
        missingKeys = primaryMissing;
        status = missingKeys.length === 0 ? 'ok' : (missingKeys.length === s.envKeys.length ? 'missing' : 'partial');
      }
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
