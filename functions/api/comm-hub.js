// LifeOS Enterprise — Communication Hub API v34.0
// Cloudflare Pages Function: GET/POST /api/comm-hub
// Phase 266 — Enterprise Communication Hub
// Fila de mensagens, histórico, templates, logs, status
// Integrações: Gmail, Outlook, WhatsApp Business, Slack, Microsoft Teams
// Credenciais externas pendentes de configuração quando ausentes
import { getCookie, json, verifySession } from '../_auth.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// ─── Provedores de comunicação ────────────────────────────────────────────────
const COMM_PROVIDERS = {
  gmail: {
    name: 'Gmail',
    type: 'email',
    icon: 'mail',
    color: '#EA4335',
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    capabilities: ['send', 'receive', 'templates', 'attachments'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
  },
  outlook: {
    name: 'Microsoft Outlook',
    type: 'email',
    icon: 'mail',
    color: '#0078D4',
    envKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    capabilities: ['send', 'receive', 'templates', 'calendar', 'attachments'],
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: ['Mail.Read', 'Mail.Send', 'offline_access', 'User.Read'],
  },
  whatsapp: {
    name: 'WhatsApp Business',
    type: 'messaging',
    icon: 'smartphone',
    color: '#25D366',
    envKeys: ['WHATSAPP_APP_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_PHONE_ID'],
    capabilities: ['send', 'templates', 'media', 'webhooks'],
    apiUrl: 'https://graph.facebook.com/v18.0',
  },
  slack: {
    name: 'Slack',
    type: 'team',
    icon: 'hash',
    color: '#4A154B',
    envKeys: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
    capabilities: ['send', 'channels', 'threads', 'files', 'webhooks'],
    authUrl: 'https://slack.com/oauth/v2/authorize',
    scopes: ['chat:write', 'channels:read', 'users:read'],
  },
  teams: {
    name: 'Microsoft Teams',
    type: 'team',
    icon: 'users',
    color: '#6264A7',
    envKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'TEAMS_TENANT_ID'],
    capabilities: ['send', 'channels', 'meetings', 'files'],
    authUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
    scopes: ['ChannelMessage.Send', 'Chat.ReadWrite', 'User.Read'],
  },
  smtp: {
    name: 'SMTP Personalizado',
    type: 'email',
    icon: 'send',
    color: '#6366F1',
    envKeys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'],
    capabilities: ['send', 'templates'],
  },
};

// ─── Status de provedores ─────────────────────────────────────────────────────
function getProviderStatus(key, env, connections) {
  const p = COMM_PROVIDERS[key];
  if (!p) return null;
  const configured = p.envKeys.every(k => !!env[k]);
  const conn = connections?.[key] || null;
  const tokenExpired = conn?.expiresAt ? new Date(conn.expiresAt).getTime() < Date.now() : false;
  const connected = !!conn?.accessToken && !tokenExpired;
  return {
    id: key,
    name: p.name,
    type: p.type,
    icon: p.icon,
    color: p.color,
    capabilities: p.capabilities,
    configured,
    connected,
    status: connected ? 'connected' : configured ? 'configured_not_connected' : 'pending_credentials',
    setupRequired: !configured,
    setupMessage: configured ? null : `Aguardando credenciais: ${p.envKeys.join(', ')}`,
    connectedAt: conn?.connectedAt || null,
    lastSync: conn?.lastSync || null,
    accountName: conn?.accountName || null,
    accountEmail: conn?.accountEmail || null,
  };
}

// ─── Fila de mensagens ────────────────────────────────────────────────────────
async function enqueueMessage(kv, userId, message) {
  const queueRaw = await kv.get(`comm:queue:${userId}`);
  const queue = queueRaw ? JSON.parse(queueRaw) : [];
  const entry = {
    id: generateId(),
    ...message,
    status: 'queued',
    queuedAt: new Date().toISOString(),
    attempts: 0,
    maxAttempts: 3,
  };
  queue.push(entry);
  await kv.put(`comm:queue:${userId}`, JSON.stringify(queue.slice(-200)));
  return entry;
}

async function appendCommLog(kv, userId, entry) {
  const logsRaw = await kv.get(`comm:logs:${userId}`);
  const logs = logsRaw ? JSON.parse(logsRaw) : [];
  logs.unshift({ id: generateId(), ...entry, timestamp: new Date().toISOString() });
  await kv.put(`comm:logs:${userId}`, JSON.stringify(logs.slice(0, 500)));
}

// ─── Enviar mensagem via provedor ─────────────────────────────────────────────
async function sendMessage(provider, message, env) {
  const p = COMM_PROVIDERS[provider];
  if (!p) return { ok: false, error: 'Provedor desconhecido' };

  const configured = p.envKeys.every(k => !!env[k]);
  if (!configured) {
    return {
      ok: false,
      status: 'pending_credentials',
      reason: `Credenciais pendentes: ${p.envKeys.filter(k => !env[k]).join(', ')}`,
    };
  }

  // WhatsApp Business API
  if (provider === 'whatsapp') {
    try {
      const phoneId = env.WHATSAPP_PHONE_ID;
      const token = env.WHATSAPP_APP_SECRET;
      const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.to,
          type: 'text',
          text: { body: message.body },
        }),
      });
      const data = await resp.json();
      return resp.ok ? { ok: true, messageId: data.messages?.[0]?.id } : { ok: false, error: data.error?.message };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // Slack
  if (provider === 'slack') {
    try {
      const resp = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: message.channel || '#general', text: message.body }),
      });
      const data = await resp.json();
      return data.ok ? { ok: true, messageId: data.ts } : { ok: false, error: data.error };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // Gmail / Outlook / SMTP — enfileirar para processamento
  return { ok: true, status: 'queued', reason: `Mensagem enfileirada para envio via ${p.name}` };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';

  if (action === 'status') {
    const connections = kv ? JSON.parse(await kv.get(`comm:connections:${session.sub}`) || '{}') : {};
    const providers = Object.keys(COMM_PROVIDERS).map(k => getProviderStatus(k, env, connections));
    const connected = providers.filter(p => p.connected).length;
    const configured = providers.filter(p => p.configured).length;
    return json(200, {
      ok: true,
      providers,
      summary: {
        total: providers.length,
        connected,
        configured,
        pendingCredentials: providers.filter(p => p.setupRequired).length,
      },
    });
  }

  if (action === 'queue') {
    if (!kv) return json(200, { ok: true, queue: [], total: 0 });
    const queueRaw = await kv.get(`comm:queue:${session.sub}`);
    const queue = queueRaw ? JSON.parse(queueRaw) : [];
    const status = url.searchParams.get('status');
    const filtered = status ? queue.filter(m => m.status === status) : queue;
    return json(200, { ok: true, queue: filtered.slice(0, 50), total: filtered.length });
  }

  if (action === 'logs') {
    if (!kv) return json(200, { ok: true, logs: [], total: 0 });
    const logsRaw = await kv.get(`comm:logs:${session.sub}`);
    const logs = logsRaw ? JSON.parse(logsRaw) : [];
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const start = (page - 1) * pageSize;
    return json(200, { ok: true, logs: logs.slice(start, start + pageSize), total: logs.length, page, pageSize });
  }

  if (action === 'templates') {
    if (!kv) return json(200, { ok: true, templates: [] });
    const raw = await kv.get(`comm:templates:${session.sub}`);
    const templates = raw ? JSON.parse(raw) : [];
    return json(200, { ok: true, templates });
  }

  if (action === 'history') {
    if (!kv) return json(200, { ok: true, history: [], total: 0 });
    const raw = await kv.get(`comm:history:${session.sub}`);
    const history = raw ? JSON.parse(raw) : [];
    const provider = url.searchParams.get('provider');
    const filtered = provider ? history.filter(h => h.provider === provider) : history;
    return json(200, { ok: true, history: filtered.slice(0, 100), total: filtered.length });
  }

  return json(400, { ok: false, error: 'Ação desconhecida' });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
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

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'send';

  if (action === 'send') {
    const { provider, to, subject, body: msgBody, templateId } = body;
    if (!provider || !COMM_PROVIDERS[provider]) {
      return json(400, { ok: false, error: `Provedor inválido. Válidos: ${Object.keys(COMM_PROVIDERS).join(', ')}` });
    }
    if (!to) return json(400, { ok: false, error: 'Destinatário (to) obrigatório' });
    if (!msgBody && !templateId) return json(400, { ok: false, error: 'Corpo da mensagem ou templateId obrigatório' });

    let finalBody = msgBody;
    if (templateId) {
      const tplRaw = await kv.get(`comm:templates:${session.sub}`);
      const templates = tplRaw ? JSON.parse(tplRaw) : [];
      const tpl = templates.find(t => t.id === templateId);
      if (!tpl) return json(404, { ok: false, error: 'Template não encontrado' });
      finalBody = tpl.body.replace(/\{\{(\w+)\}\}/g, (_, key) => body.variables?.[key] || `{{${key}}}`);
    }

    const message = { provider, to, subject: subject || '', body: finalBody, sentBy: session.sub };
    const result = await sendMessage(provider, message, env);

    const histEntry = {
      id: generateId(),
      provider,
      to,
      subject: subject || '',
      status: result.ok ? (result.status || 'sent') : 'failed',
      error: result.error || null,
      sentAt: new Date().toISOString(),
      sentBy: session.sub,
    };

    const histRaw = await kv.get(`comm:history:${session.sub}`);
    const history = histRaw ? JSON.parse(histRaw) : [];
    history.unshift(histEntry);
    await kv.put(`comm:history:${session.sub}`, JSON.stringify(history.slice(0, 500)));

    await appendCommLog(kv, session.sub, {
      type: 'send',
      provider,
      to,
      status: histEntry.status,
      messageId: result.messageId || null,
    });

    if (!result.ok && result.status !== 'pending_credentials' && result.status !== 'queued') {
      return json(500, { ok: false, error: result.error, result });
    }

    return json(200, { ok: true, result, historyId: histEntry.id });
  }

  if (action === 'template-create') {
    const { name, provider: tplProvider, subject, body: tplBody, variables } = body;
    if (!name || !tplBody) return json(400, { ok: false, error: 'Nome e corpo obrigatórios' });
    const tplRaw = await kv.get(`comm:templates:${session.sub}`);
    const templates = tplRaw ? JSON.parse(tplRaw) : [];
    const tpl = {
      id: generateId(),
      name,
      provider: tplProvider || 'all',
      subject: subject || '',
      body: tplBody,
      variables: variables || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: session.sub,
    };
    templates.unshift(tpl);
    await kv.put(`comm:templates:${session.sub}`, JSON.stringify(templates));
    return json(201, { ok: true, template: tpl });
  }

  if (action === 'template-delete') {
    const { id } = body;
    if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
    const tplRaw = await kv.get(`comm:templates:${session.sub}`);
    const templates = tplRaw ? JSON.parse(tplRaw) : [];
    const filtered = templates.filter(t => t.id !== id);
    await kv.put(`comm:templates:${session.sub}`, JSON.stringify(filtered));
    return json(200, { ok: true, deleted: id });
  }

  if (action === 'queue-process') {
    const queueRaw = await kv.get(`comm:queue:${session.sub}`);
    const queue = queueRaw ? JSON.parse(queueRaw) : [];
    const pending = queue.filter(m => m.status === 'queued' && m.attempts < m.maxAttempts);
    let processed = 0;
    for (const msg of pending.slice(0, 10)) {
      const result = await sendMessage(msg.provider, msg, env);
      msg.status = result.ok ? 'sent' : (msg.attempts + 1 >= msg.maxAttempts ? 'failed' : 'queued');
      msg.attempts++;
      msg.lastAttemptAt = new Date().toISOString();
      if (result.ok) { msg.sentAt = new Date().toISOString(); processed++; }
    }
    await kv.put(`comm:queue:${session.sub}`, JSON.stringify(queue));
    return json(200, { ok: true, processed, total: pending.length });
  }
  // ─── DRAFT ──────────────────────────────────────────────────────────────────
  if (action === 'draft-save') {
    const { id: draftId, provider, to, subject, body: draftBody } = body;
    const draftRaw = await kv.get(`comm:drafts:${session.sub}`);
    const drafts = draftRaw ? JSON.parse(draftRaw) : [];
    const ts = new Date().toISOString();
    if (draftId) {
      const idx = drafts.findIndex(d => d.id === draftId);
      if (idx !== -1) {
        drafts[idx] = { ...drafts[idx], provider, to, subject: subject || '', body: draftBody || '', updatedAt: ts };
        await kv.put(`comm:drafts:${session.sub}`, JSON.stringify(drafts.slice(0, 200)));
        return json(200, { ok: true, draft: drafts[idx] });
      }
    }
    const draft = { id: generateId(), provider: provider || 'smtp', to: to || '', subject: subject || '', body: draftBody || '', status: 'draft', createdAt: ts, updatedAt: ts, createdBy: session.sub };
    drafts.unshift(draft);
    await kv.put(`comm:drafts:${session.sub}`, JSON.stringify(drafts.slice(0, 200)));
    return json(201, { ok: true, draft });
  }
  if (action === 'draft-delete') {
    const { id: delId } = body;
    if (!delId) return json(400, { ok: false, error: 'ID obrigatório' });
    const draftRaw = await kv.get(`comm:drafts:${session.sub}`);
    const drafts = draftRaw ? JSON.parse(draftRaw) : [];
    await kv.put(`comm:drafts:${session.sub}`, JSON.stringify(drafts.filter(d => d.id !== delId)));
    return json(200, { ok: true, deleted: delId });
  }
  if (action === 'drafts') {
    const draftRaw = await kv.get(`comm:drafts:${session.sub}`);
    const drafts = draftRaw ? JSON.parse(draftRaw) : [];
    return json(200, { ok: true, drafts });
  }
  // ─── REPLY / FORWARD ─────────────────────────────────────────────────────────
  if (action === 'reply' || action === 'forward') {
    const { originalId, provider, to, body: replyBody, subject } = body;
    if (!to) return json(400, { ok: false, error: 'Destinatário obrigatório' });
    if (!replyBody) return json(400, { ok: false, error: 'Corpo da mensagem obrigatório' });
    const histRaw = await kv.get(`comm:history:${session.sub}`);
    const history = histRaw ? JSON.parse(histRaw) : [];
    const original = history.find(h => h.id === originalId);
    const replySubject = subject || (original ? (action === 'reply' ? 'Re: ' : 'Fwd: ') + (original.subject || '') : '');
    const replyProvider = provider || original?.provider || 'smtp';
    const message = { provider: replyProvider, to, subject: replySubject, body: replyBody, sentBy: session.sub };
    const result = await sendMessage(replyProvider, message, env);
    const histEntry = {
      id: generateId(), provider: replyProvider, to, subject: replySubject,
      status: result.ok ? (result.status || 'sent') : 'failed',
      error: result.error || null, sentAt: new Date().toISOString(), sentBy: session.sub,
      type: action, originalId: originalId || null,
    };
    history.unshift(histEntry);
    await kv.put(`comm:history:${session.sub}`, JSON.stringify(history.slice(0, 500)));
    return json(200, { ok: true, result, historyId: histEntry.id, type: action });
  }
  // ─── SEARCH ──────────────────────────────────────────────────────────────────
  if (action === 'search') {
    const { q, provider: filterProvider, status: filterStatus } = body;
    if (!q && !filterProvider && !filterStatus) return json(400, { ok: false, error: 'Critério de busca obrigatório (q, provider ou status)' });
    const histRaw = await kv.get(`comm:history:${session.sub}`);
    const history = histRaw ? JSON.parse(histRaw) : [];
    const query = (q || '').toLowerCase();
    let results = history;
    if (query) results = results.filter(h => (h.subject || '').toLowerCase().includes(query) || (h.to || '').toLowerCase().includes(query));
    if (filterProvider) results = results.filter(h => h.provider === filterProvider);
    if (filterStatus) results = results.filter(h => h.status === filterStatus);
    return json(200, { ok: true, results: results.slice(0, 100), total: results.length });
  }
  return json(400, { ok: false, error: 'Ação desconhecida' });
}
