// LifeOS Enterprise — Communication Hub API v2.0
// Cloudflare Pages Function: GET/POST /api/communication/hub
// Phase 140 — Real Communication Hub
// Gerencia: conexões, sincronização, logs, fila, monitor de status
import { getCookie, json, verifySession } from '../../_auth.js';

const PROVIDERS = {
  gmail: {
    name: 'Gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiBase: 'https://gmail.googleapis.com/gmail/v1',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    icon: 'mail',
    color: '#EA4335',
    type: 'oauth2',
  },
  outlook: {
    name: 'Microsoft Outlook',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    apiBase: 'https://graph.microsoft.com/v1.0',
    scopes: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite', 'offline_access'],
    envKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    icon: 'mail',
    color: '#0078D4',
    type: 'oauth2',
  },
  whatsapp: {
    name: 'WhatsApp Business',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    apiBase: 'https://graph.facebook.com/v18.0',
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    envKeys: ['WHATSAPP_APP_ID', 'WHATSAPP_APP_SECRET'],
    icon: 'smartphone',
    color: '#25D366',
    type: 'oauth2',
  },
};

function getProviderStatus(key, env, connections) {
  const p = PROVIDERS[key];
  if (!p) return null;
  const configured = p.envKeys.every(k => !!env[k]);
  const conn = connections?.[key] || null;
  return {
    id: key,
    name: p.name,
    icon: p.icon,
    color: p.color,
    type: p.type,
    configured,
    connected: !!conn?.accessToken,
    connectedAt: conn?.connectedAt || null,
    lastSync: conn?.lastSync || null,
    syncStatus: conn?.syncStatus || 'idle',
    setupRequired: !configured,
    setupInstructions: configured ? null : `Configure ${p.envKeys.join(' e ')} nas variáveis de ambiente do Cloudflare Pages.`,
    scopes: p.scopes,
  };
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'status';

  const kv = env.LIFEOS_KV;
  let connections = {};
  let logs = [];
  let queue = [];

  if (kv) {
    try {
      const connRaw = await kv.get(`comm:connections:${session.sub}`);
      if (connRaw) connections = JSON.parse(connRaw);

      const logsRaw = await kv.get(`comm:logs:${session.sub}`);
      if (logsRaw) logs = JSON.parse(logsRaw);

      const queueRaw = await kv.get(`comm:queue:${session.sub}`);
      if (queueRaw) queue = JSON.parse(queueRaw);
    } catch { /* KV indisponível */ }
  }

  const providers = Object.keys(PROVIDERS).map(k => getProviderStatus(k, env, connections));

  if (view === 'logs') {
    return json(200, { ok: true, logs: logs.slice(0, 100) });
  }
  if (view === 'queue') {
    return json(200, { ok: true, queue });
  }
  if (view === 'monitor') {
    return json(200, {
      ok: true,
      monitor: {
        providers,
        totalConnected: providers.filter(p => p.connected).length,
        totalConfigured: providers.filter(p => p.configured).length,
        queueSize: queue.length,
        recentLogs: logs.slice(0, 10),
        lastCheck: new Date().toISOString(),
      },
    });
  }

  return json(200, { ok: true, providers, connections: Object.keys(connections) });
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

  const { action, provider } = body;

  // Iniciar fluxo OAuth
  if (action === 'connect') {
    if (!provider || !PROVIDERS[provider]) {
      return json(400, { ok: false, error: 'Provider inválido' });
    }
    const p = PROVIDERS[provider];
    const configured = p.envKeys.every(k => !!env[k]);
    if (!configured) {
      return json(400, {
        ok: false,
        error: 'Provider não configurado',
        setupInstructions: `Configure ${p.envKeys.join(' e ')} nas variáveis de ambiente do Cloudflare Pages.`,
      });
    }

    const state = btoa(JSON.stringify({ provider, userId: session.sub, ts: Date.now() }));
    const clientId = env[p.envKeys[0]];
    const redirectUri = `${new URL(request.url).origin}/api/connectors/communication/callback/${provider}`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: p.scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `${p.authUrl}?${params.toString()}`;

    // Log da tentativa de conexão
    await appendLog(kv, session.sub, {
      type: 'connect_initiated',
      provider,
      timestamp: new Date().toISOString(),
    });

    return json(200, { ok: true, authUrl, provider });
  }

  // Desconectar provider
  if (action === 'disconnect') {
    if (!provider || !PROVIDERS[provider]) {
      return json(400, { ok: false, error: 'Provider inválido' });
    }

    try {
      const connRaw = await kv.get(`comm:connections:${session.sub}`);
      const connections = connRaw ? JSON.parse(connRaw) : {};
      delete connections[provider];
      await kv.put(`comm:connections:${session.sub}`, JSON.stringify(connections));

      await appendLog(kv, session.sub, {
        type: 'disconnected',
        provider,
        timestamp: new Date().toISOString(),
      });

      return json(200, { ok: true, disconnected: provider });
    } catch {
      return json(500, { ok: false, error: 'Erro ao desconectar' });
    }
  }

  // Sincronizar mensagens
  if (action === 'sync') {
    if (!provider || !PROVIDERS[provider]) {
      return json(400, { ok: false, error: 'Provider inválido' });
    }

    try {
      const connRaw = await kv.get(`comm:connections:${session.sub}`);
      const connections = connRaw ? JSON.parse(connRaw) : {};

      if (!connections[provider]?.accessToken) {
        return json(400, { ok: false, error: 'Provider não conectado' });
      }

      // Adicionar à fila de sincronização
      const queueRaw = await kv.get(`comm:queue:${session.sub}`);
      const queue = queueRaw ? JSON.parse(queueRaw) : [];
      const jobId = Date.now().toString(36);
      queue.push({
        id: jobId,
        provider,
        action: 'sync',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      await kv.put(`comm:queue:${session.sub}`, JSON.stringify(queue.slice(-50)));

      // Atualizar status de sync
      connections[provider].syncStatus = 'syncing';
      connections[provider].lastSyncAttempt = new Date().toISOString();
      await kv.put(`comm:connections:${session.sub}`, JSON.stringify(connections));

      await appendLog(kv, session.sub, {
        type: 'sync_queued',
        provider,
        jobId,
        timestamp: new Date().toISOString(),
      });

      return json(200, { ok: true, jobId, status: 'queued' });
    } catch {
      return json(500, { ok: false, error: 'Erro ao enfileirar sincronização' });
    }
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: connect, disconnect, sync' });
}

async function appendLog(kv, userId, entry) {
  try {
    const raw = await kv.get(`comm:logs:${userId}`);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift(entry);
    await kv.put(`comm:logs:${userId}`, JSON.stringify(logs.slice(0, 200)));
  } catch { /* ignorar erros de log */ }
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
  }
}
