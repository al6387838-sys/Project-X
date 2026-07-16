// LifeOS Enterprise — API Platform v1.0
// Cloudflare Pages Function: GET/POST /api/platform
// Phase 149 — API Platform
// API Keys · Documentação · Rate Limiting · Logs · Webhooks · Monitoramento
import { getCookie, json, verifySession, hasPermission } from '../../_auth.js';
import { checkRateLimit } from '../rate-limit.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

function generateApiKey() {
  const prefix = 'lifeos_';
  const random = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return prefix + random;
}

// ─── Documentação de endpoints ───
const API_DOCS = {
  '/api/tasks': {
    name: 'Tasks API',
    description: 'Gerenciar tarefas do usuário',
    methods: ['GET', 'POST'],
    rateLimit: '1000/hour',
    authentication: 'API Key',
    endpoints: [
      { method: 'GET', path: '/api/tasks', description: 'Listar tarefas' },
      { method: 'POST', path: '/api/tasks', description: 'Criar tarefa' },
    ],
  },
  '/api/habits': {
    name: 'Habits API',
    description: 'Rastreamento de hábitos',
    methods: ['GET', 'POST'],
    rateLimit: '500/hour',
    authentication: 'API Key',
  },
  '/api/goals': {
    name: 'Goals API',
    description: 'Gestão de metas',
    methods: ['GET', 'POST'],
    rateLimit: '500/hour',
    authentication: 'API Key',
  },
  '/api/documents': {
    name: 'Documents API',
    description: 'Gestão de documentos',
    methods: ['GET', 'POST'],
    rateLimit: '2000/hour',
    authentication: 'API Key',
  },
  '/api/finance/hub': {
    name: 'Finance API',
    description: 'Dados financeiros',
    methods: ['GET'],
    rateLimit: '500/hour',
    authentication: 'API Key',
  },
};

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'keys';
  const kv = env.LIFEOS_KV;

  if (!kv) return json(200, { ok: true, data: {}, source: 'unavailable' });

  try {
    switch (view) {
      case 'keys': {
        const raw = await kv.get(`platform:keys:${session.sub}`);
        const keys = raw ? JSON.parse(raw) : [];
        // Nunca retornar a chave completa, apenas últimos 4 caracteres
        const safe = keys.map(k => ({
          ...k,
          key: k.key.slice(0, 10) + '...' + k.key.slice(-4),
        }));
        return json(200, { ok: true, keys: safe });
      }

      case 'documentation':
        return json(200, { ok: true, documentation: API_DOCS });

      case 'logs': {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const raw = await kv.get(`platform:logs:${session.sub}`);
        const logs = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, logs: logs.slice(0, limit) });
      }

      case 'webhooks': {
        const raw = await kv.get(`platform:webhooks:${session.sub}`);
        const webhooks = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, webhooks });
      }

      case 'usage': {
        const raw = await kv.get(`platform:usage:${session.sub}`);
        const usage = raw ? JSON.parse(raw) : { requests: 0, errors: 0, lastReset: new Date().toISOString() };
        return json(200, { ok: true, usage });
      }

      case 'quota': {
        const subRaw = await kv.get(`payments:subscription:${session.sub}`);
        const sub = subRaw ? JSON.parse(subRaw) : { plan: 'free' };
        const quotas = {
          free: { requests_per_hour: 100, keys: 1, webhooks: 0 },
          starter: { requests_per_hour: 10000, keys: 5, webhooks: 3 },
          professional: { requests_per_hour: 100000, keys: 20, webhooks: 10 },
          enterprise: { requests_per_hour: -1, keys: -1, webhooks: -1 },
        };
        return json(200, { ok: true, quota: quotas[sub.plan] || quotas.free });
      }

      default:
        return json(400, { ok: false, error: 'view inválido' });
    }
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar dados da plataforma' });
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

  // ─── Criar API Key ───
  if (action === 'create-key') {
    const { name, scopes = ['read'] } = body;
    if (!name) return json(400, { ok: false, error: 'Nome obrigatório' });

    const key = {
      id: generateId(),
      name,
      key: generateApiKey(),
      scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
      requests: 0,
    };

    const raw = await kv.get(`platform:keys:${session.sub}`);
    const keys = raw ? JSON.parse(raw) : [];
    keys.push(key);
    await kv.put(`platform:keys:${session.sub}`, JSON.stringify(keys));

    // Retornar chave completa apenas na criação
    return json(201, { ok: true, key, message: 'Guarde a chave em local seguro. Não será exibida novamente.' });
  }

  // ─── Revogar API Key ───
  if (action === 'revoke-key') {
    const { keyId } = body;
    if (!keyId) return json(400, { ok: false, error: 'keyId obrigatório' });

    const raw = await kv.get(`platform:keys:${session.sub}`);
    const keys = raw ? JSON.parse(raw) : [];
    const idx = keys.findIndex(k => k.id === keyId);
    if (idx === -1) return json(404, { ok: false, error: 'Chave não encontrada' });

    keys[idx].revokedAt = new Date().toISOString();
    await kv.put(`platform:keys:${session.sub}`, JSON.stringify(keys));

    return json(200, { ok: true, revoked: keyId });
  }

  // ─── Registrar webhook ───
  if (action === 'register-webhook') {
    const { url: webhookUrl, events = ['*'], active = true } = body;
    if (!webhookUrl) return json(400, { ok: false, error: 'URL obrigatória' });

    // Validar URL
    try {
      new URL(webhookUrl);
    } catch {
      return json(400, { ok: false, error: 'URL inválida' });
    }

    const webhook = {
      id: generateId(),
      url: webhookUrl,
      events,
      active,
      createdAt: new Date().toISOString(),
      deliveries: 0,
      failures: 0,
      lastDeliveryAt: null,
    };

    const raw = await kv.get(`platform:webhooks:${session.sub}`);
    const webhooks = raw ? JSON.parse(raw) : [];
    webhooks.push(webhook);
    await kv.put(`platform:webhooks:${session.sub}`, JSON.stringify(webhooks));

    return json(201, { ok: true, webhook });
  }

  // ─── Deletar webhook ───
  if (action === 'delete-webhook') {
    const { webhookId } = body;
    if (!webhookId) return json(400, { ok: false, error: 'webhookId obrigatório' });

    const raw = await kv.get(`platform:webhooks:${session.sub}`);
    const webhooks = raw ? JSON.parse(raw) : [];
    const filtered = webhooks.filter(w => w.id !== webhookId);
    await kv.put(`platform:webhooks:${session.sub}`, JSON.stringify(filtered));

    return json(200, { ok: true, deleted: webhookId });
  }

  // ─── Testar webhook ───
  if (action === 'test-webhook') {
    const { webhookId } = body;
    if (!webhookId) return json(400, { ok: false, error: 'webhookId obrigatório' });

    const raw = await kv.get(`platform:webhooks:${session.sub}`);
    const webhooks = raw ? JSON.parse(raw) : [];
    const webhook = webhooks.find(w => w.id === webhookId);
    if (!webhook) return json(404, { ok: false, error: 'Webhook não encontrado' });

    // Enviar teste
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Teste de webhook' },
    };

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LifeOS-Event': 'test' },
        body: JSON.stringify(testPayload),
      });

      webhook.lastDeliveryAt = new Date().toISOString();
      if (res.ok) {
        webhook.deliveries += 1;
      } else {
        webhook.failures += 1;
      }
      await kv.put(`platform:webhooks:${session.sub}`, JSON.stringify(webhooks));

      return json(200, { ok: true, success: res.ok, status: res.status });
    } catch (err) {
      webhook.failures += 1;
      await kv.put(`platform:webhooks:${session.sub}`, JSON.stringify(webhooks));
      return json(500, { ok: false, error: err.message });
    }
  }

  // ─── Limpar logs ───
  if (action === 'clear-logs') {
    await kv.put(`platform:logs:${session.sub}`, JSON.stringify([]));
    return json(200, { ok: true, message: 'Logs limpos' });
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
