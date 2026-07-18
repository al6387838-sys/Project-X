// LifeOS Enterprise — Communication Hub API v3.0
// Cloudflare Pages Function: GET/POST /api/communication/hub
// Phase 225 — Communication Hub Real
// Gmail · Outlook · SMTP · WhatsApp Business · Webhooks
// OAuth 2.0 real · Tokens persistidos · Refresh Token · Revogação · Reconexão · Logs · Status
import { getCookie, json, verifySession } from '../../_auth.js';

const PROVIDERS = {
  gmail: {
    name: 'Gmail',
    description: 'Leitura e envio de e-mails via Google Gmail API',
    icon: 'mail', color: '#EA4335', type: 'oauth2',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    scopes: ['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/gmail.modify'],
    extraParams: { access_type: 'offline', prompt: 'consent' },
  },
  outlook: {
    name: 'Microsoft Outlook',
    description: 'E-mail e calendário via Microsoft Graph API',
    icon: 'mail', color: '#0078D4', type: 'oauth2',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    revokeUrl: null,
    envKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    scopes: ['Mail.Read','Mail.Send','offline_access','User.Read'],
    extraParams: {},
  },
  smtp: {
    name: 'SMTP Personalizado',
    description: 'Envio de e-mails via servidor SMTP próprio',
    icon: 'send', color: '#6366F1', type: 'credentials',
    envKeys: ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS'],
    scopes: [], extraParams: {},
  },
  whatsapp: {
    name: 'WhatsApp Business',
    description: 'Mensagens e automação via WhatsApp Cloud API',
    icon: 'smartphone', color: '#25D366', type: 'oauth2',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    revokeUrl: null,
    envKeys: ['WHATSAPP_APP_ID','WHATSAPP_APP_SECRET','WHATSAPP_PHONE_ID'],
    scopes: ['whatsapp_business_messaging','whatsapp_business_management'],
    extraParams: {},
  },
  webhooks: {
    name: 'Webhooks',
    description: 'Receba e envie eventos via HTTP Webhooks',
    icon: 'webhook', color: '#F59E0B', type: 'webhook',
    envKeys: ['LIFEOS_WEBHOOK_SECRET'],
    scopes: [], extraParams: {},
  },
};

function getProviderStatus(key, env, connections) {
  const p = PROVIDERS[key];
  if (!p) return null;
  const configured = p.envKeys.every(k => !!env[k]);
  const conn = connections?.[key] || null;
  const now = Date.now();
  const tokenExpired = conn?.expiresAt ? new Date(conn.expiresAt).getTime() < now : false;
  const connected = !!conn?.accessToken && !tokenExpired;
  return {
    id: key, name: p.name, description: p.description, icon: p.icon, color: p.color, type: p.type,
    configured, connected, needsRefresh: !!conn?.refreshToken && tokenExpired,
    connectedAt: conn?.connectedAt || null, lastSync: conn?.lastSync || null,
    syncStatus: conn?.syncStatus || 'idle', accountName: conn?.accountName || null,
    accountEmail: conn?.accountEmail || null, tokenExpiry: conn?.expiresAt || null,
    setupRequired: !configured,
    setupMessage: configured ? null : `Serviço aguardando configuração. Configure: ${p.envKeys.join(', ')}`,
    scopes: p.scopes,
  };
}

async function appendLog(kv, userId, entry) {
  try {
    const raw = await kv.get(`comm:logs:${userId}`);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({ ...entry, id: crypto.randomUUID().slice(0, 8) });
    await kv.put(`comm:logs:${userId}`, JSON.stringify(logs.slice(0, 500)));
  } catch { /* ignorar */ }
}

async function refreshOAuthToken(provider, conn, env) {
  const p = PROVIDERS[provider];
  if (!p || !conn?.refreshToken) return null;
  const clientId = env[p.envKeys[0]];
  const clientSecret = env[p.envKeys[1]];
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(p.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refreshToken, client_id: clientId, client_secret: clientSecret }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token || conn.refreshToken, expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString() };
  } catch { return null; }
}

async function revokeOAuthToken(provider, conn, env) {
  const p = PROVIDERS[provider];
  if (!p?.revokeUrl || !conn?.accessToken) return false;
  try {
    const res = await fetch(`${p.revokeUrl}?token=${conn.accessToken}`, { method: 'POST' });
    return res.ok;
  } catch { return false; }
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  const view = new URL(request.url).searchParams.get('view') || 'status';
  let connections = {};
  if (kv) {
    try { const r = await kv.get(`comm:connections:${session.sub}`); if (r) connections = JSON.parse(r); } catch { /* */ }
    // Auto-refresh tokens expirados
    let updated = false;
    for (const [key, conn] of Object.entries(connections)) {
      const p = PROVIDERS[key];
      if (!p || p.type !== 'oauth2') continue;
      if (conn?.expiresAt && new Date(conn.expiresAt).getTime() < Date.now() && conn?.refreshToken) {
        const refreshed = await refreshOAuthToken(key, conn, env);
        if (refreshed) { connections[key] = { ...conn, ...refreshed, syncStatus: 'idle' }; updated = true; await appendLog(kv, session.sub, { type: 'token_refreshed', provider: key, timestamp: new Date().toISOString() }); }
      }
    }
    if (updated) await kv.put(`comm:connections:${session.sub}`, JSON.stringify(connections));
  }
  if (view === 'logs') {
    const raw = kv ? await kv.get(`comm:logs:${session.sub}`) : null;
    return json(200, { ok: true, logs: raw ? JSON.parse(raw) : [] });
  }
  if (view === 'queue') {
    const raw = kv ? await kv.get(`comm:queue:${session.sub}`) : null;
    return json(200, { ok: true, queue: raw ? JSON.parse(raw) : [] });
  }
  if (view === 'webhooks') {
    const raw = kv ? await kv.get(`comm:webhooks:${session.sub}`) : null;
    return json(200, { ok: true, webhooks: raw ? JSON.parse(raw) : [] });
  }
  const providers = Object.keys(PROVIDERS).map(k => getProviderStatus(k, env, connections));
  let queueSize = 0;
  if (kv) { try { const qr = await kv.get(`comm:queue:${session.sub}`); queueSize = qr ? JSON.parse(qr).filter(j => j.status === 'pending').length : 0; } catch { /* */ } }
  return json(200, { ok: true, providers, summary: { total: providers.length, connected: providers.filter(p => p.connected).length, configured: providers.filter(p => p.configured).length, queueSize, lastCheck: new Date().toISOString() } });
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
  const { action, provider } = body;

  if (action === 'connect') {
    if (!provider || !PROVIDERS[provider]) return json(400, { ok: false, error: 'Provider inválido' });
    const p = PROVIDERS[provider];
    if (p.type === 'credentials' || p.type === 'webhook') {
      const configured = p.envKeys.every(k => !!env[k]);
      return json(configured ? 200 : 400, configured ? { ok: true, message: `${p.name} configurado via variáveis de ambiente.` } : { ok: false, error: 'Serviço aguardando configuração.', setupMessage: `Configure: ${p.envKeys.join(', ')}` });
    }
    const configured = p.envKeys.every(k => !!env[k]);
    if (!configured) return json(400, { ok: false, error: 'Serviço aguardando configuração.', setupMessage: `Configure: ${p.envKeys.join(', ')}` });
    const state = btoa(JSON.stringify({ provider, userId: session.sub, ts: Date.now() }));
    const params = new URLSearchParams({ client_id: env[p.envKeys[0]], redirect_uri: `${new URL(request.url).origin}/api/communication/callback/${provider}`, response_type: 'code', scope: p.scopes.join(' '), state, ...p.extraParams });
    await appendLog(kv, session.sub, { type: 'connect_initiated', provider, timestamp: new Date().toISOString() });
    return json(200, { ok: true, authUrl: `${p.authUrl}?${params.toString()}`, provider });
  }

  if (action === 'disconnect') {
    if (!provider || !PROVIDERS[provider]) return json(400, { ok: false, error: 'Provider inválido' });
    try {
      const connRaw = await kv.get(`comm:connections:${session.sub}`);
      const connections = connRaw ? JSON.parse(connRaw) : {};
      if (connections[provider]) { await revokeOAuthToken(provider, connections[provider], env); delete connections[provider]; await kv.put(`comm:connections:${session.sub}`, JSON.stringify(connections)); }
      await appendLog(kv, session.sub, { type: 'disconnected', provider, timestamp: new Date().toISOString() });
      return json(200, { ok: true, disconnected: provider });
    } catch { return json(500, { ok: false, error: 'Erro ao desconectar' }); }
  }

  if (action === 'sync') {
    if (!provider || !PROVIDERS[provider]) return json(400, { ok: false, error: 'Provider inválido' });
    try {
      const connRaw = await kv.get(`comm:connections:${session.sub}`);
      const connections = connRaw ? JSON.parse(connRaw) : {};
      if (!connections[provider]?.accessToken) return json(400, { ok: false, error: 'Serviço aguardando configuração.' });
      const queueRaw = await kv.get(`comm:queue:${session.sub}`);
      const queue = queueRaw ? JSON.parse(queueRaw) : [];
      const jobId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Date.now().toString(36).slice(-6));
      queue.push({ id: jobId, provider, action: 'sync', status: 'pending', createdAt: new Date().toISOString() });
      await kv.put(`comm:queue:${session.sub}`, JSON.stringify(queue.slice(-100)));
      connections[provider].syncStatus = 'syncing'; connections[provider].lastSyncAttempt = new Date().toISOString();
      await kv.put(`comm:connections:${session.sub}`, JSON.stringify(connections));
      await appendLog(kv, session.sub, { type: 'sync_queued', provider, jobId, timestamp: new Date().toISOString() });
      return json(200, { ok: true, jobId, status: 'queued' });
    } catch { return json(500, { ok: false, error: 'Erro ao enfileirar sincronização' }); }
  }

  if (action === 'test') {
    if (!provider || !PROVIDERS[provider]) return json(400, { ok: false, error: 'Provider inválido' });
    const p = PROVIDERS[provider];
    let testResult = { ok: false, message: 'Serviço aguardando configuração.' };
    if (p.type === 'credentials' || p.type === 'webhook') {
      const configured = p.envKeys.every(k => !!env[k]);
      testResult = configured ? { ok: true, message: `${p.name} configurado e pronto.` } : { ok: false, message: 'Serviço aguardando configuração.' };
    } else {
      const connRaw = await kv.get(`comm:connections:${session.sub}`);
      const connections = connRaw ? JSON.parse(connRaw) : {};
      const conn = connections[provider];
      if (!conn?.accessToken) { testResult = { ok: false, message: 'Serviço aguardando configuração.' }; }
      else if (provider === 'gmail') {
        const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${conn.accessToken}` } });
        if (res.ok) { const d = await res.json(); testResult = { ok: true, message: `Gmail conectado: ${d.emailAddress}` }; connections[provider].accountEmail = d.emailAddress; connections[provider].lastSync = new Date().toISOString(); connections[provider].syncStatus = 'ok'; await kv.put(`comm:connections:${session.sub}`, JSON.stringify(connections)); }
        else testResult = { ok: false, message: 'Token inválido. Reconecte o Gmail.' };
      } else if (provider === 'outlook') {
        const res = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${conn.accessToken}` } });
        if (res.ok) { const d = await res.json(); testResult = { ok: true, message: `Outlook conectado: ${d.mail || d.userPrincipalName}` }; connections[provider].accountEmail = d.mail || d.userPrincipalName; connections[provider].lastSync = new Date().toISOString(); connections[provider].syncStatus = 'ok'; await kv.put(`comm:connections:${session.sub}`, JSON.stringify(connections)); }
        else testResult = { ok: false, message: 'Token inválido. Reconecte o Outlook.' };
      } else if (provider === 'whatsapp') {
        const res = await fetch(`https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_ID}`, { headers: { Authorization: `Bearer ${conn.accessToken}` } });
        testResult = res.ok ? { ok: true, message: 'WhatsApp Business conectado.' } : { ok: false, message: 'Token inválido. Reconecte o WhatsApp.' };
      }
    }
    await appendLog(kv, session.sub, { type: testResult.ok ? 'test_success' : 'test_failed', provider, message: testResult.message, timestamp: new Date().toISOString() });
    return json(200, { ok: testResult.ok, ...testResult });
  }

  if (action === 'register_webhook') {
    const { url: webhookUrl, events } = body;
    if (!webhookUrl || !events?.length) return json(400, { ok: false, error: 'URL e eventos são obrigatórios' });
    try {
      const whRaw = await kv.get(`comm:webhooks:${session.sub}`);
      const webhooks = whRaw ? JSON.parse(whRaw) : [];
      const id = crypto.randomUUID().slice(0, 12);
      webhooks.push({ id, url: webhookUrl, events, active: true, createdAt: new Date().toISOString(), lastTriggered: null, deliveryCount: 0, failureCount: 0 });
      await kv.put(`comm:webhooks:${session.sub}`, JSON.stringify(webhooks.slice(-50)));
      await appendLog(kv, session.sub, { type: 'webhook_registered', webhookId: id, url: webhookUrl, events, timestamp: new Date().toISOString() });
      return json(200, { ok: true, webhookId: id });
    } catch { return json(500, { ok: false, error: 'Erro ao registrar webhook' }); }
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: connect, disconnect, sync, test, register_webhook' });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
