// LifeOS Enterprise — WhatsApp Bridge API v1.0
// Cloudflare Pages Function: GET/POST /api/whatsapp-bridge
// Fase 750 — Ponte entre WhatsApp Cloud API e /api/messages
// Sincroniza envio de mensagens WhatsApp com persistência no KV (msg:conversations, msg:messages)
// Suporta: envio, recebimento, histórico, anexos, templates, notificações

import { getCookie, json, verifySession } from '../_auth.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function now() {
  return new Date().toISOString();
}

function safeText(value, max = 2000) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max) || '';
}

function safeFileName(value) {
  const text = safeText(value, 180)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '');
  return text || 'arquivo';
}

// ─── Enviar mensagem WhatsApp e persistir no KV ──────────────────────────────
async function sendAndPersist(env, kv, userId, payload) {
  const { phoneId, accessToken, to, type, text, mediaUrl, fileName, caption, convId } = payload;

  // 1. Enviar via WhatsApp Cloud API
  const messagePayload = {
    messaging_product: 'whatsapp',
    to,
    type: type || 'text',
  };

  if (type === 'image') {
    messagePayload.image = { link: mediaUrl, caption: text || caption || '' };
  } else if (type === 'document') {
    messagePayload.document = { link: mediaUrl, filename: fileName || 'arquivo', caption: text || caption || '' };
  } else if (type === 'video') {
    messagePayload.video = { link: mediaUrl, caption: text || caption || '' };
  } else if (type === 'audio') {
    messagePayload.audio = { link: mediaUrl };
  } else if (type === 'sticker') {
    messagePayload.sticker = { link: mediaUrl };
  } else if (type === 'template') {
    messagePayload.template = {
      name: payload.templateName,
      language: { code: payload.templateLang || 'pt_BR' },
      components: payload.templateComponents || [],
    };
  } else {
    messagePayload.text = { body: text || '' };
  }

  const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messagePayload),
  });

  const data = await resp.json();

  if (!resp.ok) {
    // Registrar falha no KV
    if (kv && convId) {
      const msgKey = `msg:messages:system:${convId}`;
      const messages = JSON.parse(await kv.get(msgKey) || '[]');
      const tempMsg = messages.find(m => m.sending && m.type === type);
      if (tempMsg) {
        tempMsg.sending = false;
        tempMsg.sendError = data.error?.message || 'Falha ao enviar';
        tempMsg.sendStatus = 'failed';
        await kv.put(msgKey, JSON.stringify(messages));
      }
    }
    return { ok: false, error: data.error?.message || 'Erro WhatsApp', status: 'failed' };
  }

  const waMessageId = data.messages?.[0]?.id;

  // 2. Persistir mensagem enviada no KV (msg:messages)
  if (kv && convId) {
    const msgKey = `msg:messages:${userId}:${convId}`;
    const messages = JSON.parse(await kv.get(msgKey) || '[]');

    // Substituir mensagem temporária ou adicionar nova
    const tempIdx = messages.findIndex(m => m.sending && m.type === type);
    const message = {
      id: waMessageId || generateId(),
      convId,
      sender: userId,
      senderName: 'Eu',
      senderPhone: phoneId,
      text: safeText(text || caption || ''),
      attachments: mediaUrl ? [{
        id: generateId(),
        name: safeFileName(fileName || `${type || 'media'}.file`),
        size: 0,
        type: mediaUrl.split('.').pop()?.split('?')[0] || 'application/octet-stream',
        storageKey: null,
        externalUrl: mediaUrl,
        externalSource: 'whatsapp_sent',
      }] : [],
      createdAt: now(),
      edited: false,
      deleted: false,
      channel: 'whatsapp',
      provider: 'whatsapp',
      externalId: waMessageId,
      type: type || 'text',
      read: true,
      sending: false,
      sendStatus: 'sent',
    };

    if (tempIdx !== -1) {
      messages[tempIdx] = message;
    } else {
      messages.push(message);
    }
    await kv.put(msgKey, JSON.stringify(messages.slice(-500)));

    // Atualizar conversa
    const convKey = `msg:conversations:${userId}`;
    const convs = JSON.parse(await kv.get(convKey) || '[]');
    const conv = convs.find(c => c.id === convId);
    if (conv) {
      conv.lastMessage = safeText(text || caption || `[${type}]`).slice(0, 100);
      conv.lastAt = now();
      conv.messageCount = (conv.messageCount || 0) + 1;
      await kv.put(convKey, JSON.stringify(convs));
    }

    // Histórico de comunicação
    const histKey = `comm:history:${userId}`;
    const history = JSON.parse(await kv.get(histKey) || '[]');
    history.unshift({
      id: generateId(),
      provider: 'whatsapp',
      direction: 'outbound',
      to,
      subject: (text || caption || '').slice(0, 80),
      body: text || '',
      status: 'sent',
      sentAt: now(),
      sentBy: userId,
      messageId: waMessageId,
      msgType: type || 'text',
      conversationId: convId,
    });
    await kv.put(histKey, JSON.stringify(history.slice(0, 500)));
  }

  return { ok: true, messageId: waMessageId, status: 'sent' };
}

// ─── Obter/criar conversa WhatsApp para um número ─────────────────────────────
async function getOrCreateWhatsAppConv(kv, userId, phone, name) {
  const convKey = `msg:conversations:${userId}`;
  const convs = JSON.parse(await kv.get(convKey) || '[]');
  let conv = convs.find(c => c.whatsappNumber === phone && c.channel === 'whatsapp');

  if (conv) return conv;

  conv = {
    id: generateId(),
    title: safeText(name || phone, 100),
    participants: [phone],
    whatsappNumber: phone,
    lastMessage: '',
    lastAt: now(),
    unread: 0,
    pinned: false,
    archived: false,
    createdAt: now(),
    createdBy: 'system',
    messageCount: 0,
    attachmentCount: 0,
    channel: 'whatsapp',
    provider: 'whatsapp',
    externalId: null,
  };

  convs.unshift(conv);
  await kv.put(convKey, JSON.stringify(convs.slice(0, 200)));
  return conv;
}

// ─── Listar conversas WhatsApp ────────────────────────────────────────────────
async function listWhatsAppConversations(kv, userId) {
  const convKey = `msg:conversations:${userId}`;
  const convs = JSON.parse(await kv.get(convKey) || '[]');
  return convs.filter(c => c.channel === 'whatsapp' && !c.archived);
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const secret = env.LIFEOS_SESSION_SECRET;
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret, kv);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';

  // Status do WhatsApp
  if (action === 'status') {
    const configured = !!(env.WHATSAPP_APP_ID && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_ID);
    let connected = false;
    let accountName = null;

    if (configured) {
      try {
        const res = await fetch(`https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_ID}`, {
          headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
        });
        if (res.ok) {
          connected = true;
          const data = await res.json();
          accountName = data.display_phone_number || data.verified_name || null;
        }
      } catch { /* token inválido */ }
    }

    return json(200, {
      ok: true,
      status: {
        configured,
        connected,
        accountName,
        phoneId: env.WHATSAPP_PHONE_ID ? '***' + (env.WHATSAPP_PHONE_ID.slice(-4) || '') : null,
        hasToken: !!env.WHATSAPP_ACCESS_TOKEN,
        webhookUrl: `${url.origin}/api/webhooks/whatsapp`,
        missingKeys: !configured
          ? ['WHATSAPP_APP_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_ID'].filter(k => !env[k])
          : [],
      },
    });
  }

  // Listar conversas WhatsApp
  if (action === 'conversations') {
    const convs = await listWhatsAppConversations(kv, session.sub);
    return json(200, { ok: true, conversations: convs, total: convs.length });
  }

  // Verificar webhook
  if (action === 'webhook-check') {
    return json(200, {
      ok: true,
      webhook: {
        url: `${url.origin}/api/webhooks/whatsapp`,
        verifyToken: env.WHATSAPP_VERIFY_TOKEN ? '*** configurado ***' : 'não configurado',
        configured: !!env.WHATSAPP_VERIFY_TOKEN,
        instructions: 'Configure o webhook no Meta Business Suite:\n1. Abra o WhatsApp Business Settings\n2. Em "Configurações do WhatsApp" → "Webhook"\n3. URL: ' + `${url.origin}/api/webhooks/whatsapp` + '\n4. Token: ' + (env.WHATSAPP_VERIFY_TOKEN || '(configure WHATSAPP_VERIFY_TOKEN no Cloudflare)'),
      },
    });
  }

  // Busca em conversas WhatsApp
  if (action === 'search') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    if (!q) return json(400, { ok: false, error: 'Termo de busca obrigatório' });
    const convs = JSON.parse(await kv.get('msg:conversations:system') || '[]');
    const results = convs.filter(c =>
      c.channel === 'whatsapp' &&
      ((c.title || '').toLowerCase().includes(q) ||
       (c.whatsappNumber || '').includes(q) ||
       (c.participants || []).some(p => p.toLowerCase().includes(q)))
    );
    return json(200, { ok: true, results, total: results.length, query: q });
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: status, conversations, webhook-check, search' });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const secret = env.LIFEOS_SESSION_SECRET;
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret, kv);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'send';

  // ─── Enviar mensagem WhatsApp ────────────────────────────────────────────
  if (action === 'send') {
    const { to, text, type, mediaUrl, fileName, caption, templateName, templateLang, templateComponents, phoneId: customPhoneId } = body;

    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_ID) {
      return json(503, {
        ok: false,
        error: 'WhatsApp não configurado. Configure WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_ID.',
        status: 'pending_credentials',
      });
    }

    if (!to) return json(400, { ok: false, error: 'Número de telefone obrigatório' });

    const phoneId = customPhoneId || env.WHATSAPP_PHONE_ID;

    // Obter ou criar conversa
    const conv = await getOrCreateWhatsAppConv(kv, session.sub, to, body.name);

    // Adicionar mensagem temporária (otimismo)
    const msgKey = `msg:messages:${session.sub}:${conv.id}`;
    const messages = JSON.parse(await kv.get(msgKey) || '[]');
    const tempMsg = {
      id: 'temp_' + Date.now(),
      convId: conv.id,
      sender: session.sub,
      text: safeText(text || caption || ''),
      attachments: [],
      createdAt: now(),
      edited: false,
      deleted: false,
      channel: 'whatsapp',
      provider: 'whatsapp',
      type: type || 'text',
      read: true,
      sending: true,
    };
    messages.push(tempMsg);
    await kv.put(msgKey, JSON.stringify(messages.slice(-500)));

    // Enviar via API
    const result = await sendAndPersist(env, kv, session.sub, {
      phoneId,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      to,
      type,
      text,
      mediaUrl,
      fileName,
      caption,
      convId: conv.id,
      templateName,
      templateLang,
      templateComponents,
    });

    // Log
    const logKey = `comm:logs:${session.sub}`;
    const logs = JSON.parse(await kv.get(logKey) || '[]');
    logs.unshift({
      id: generateId(),
      type: result.ok ? 'whatsapp_sent' : 'whatsapp_send_failed',
      provider: 'whatsapp',
      to,
      messageId: result.messageId || null,
      error: result.error || null,
      timestamp: now(),
    });
    await kv.put(logKey, JSON.stringify(logs.slice(0, 500)));

    return json(result.ok ? 200 : (result.status === 'auth_required' ? 401 : 500), {
      ok: result.ok,
      result,
      conversation: { id: conv.id, title: conv.title },
      messageId: result.messageId,
    });
  }

  // ─── Upload de mídia para WhatsApp ──────────────────────────────────────
  if (action === 'upload-media') {
    if (!env.WHATSAPP_ACCESS_TOKEN) {
      return json(503, { ok: false, error: 'WHATSAPP_ACCESS_TOKEN não configurado' });
    }

    const { file, fileName, mimeType } = body;
    if (!file || !fileName) return json(400, { ok: false, error: 'Arquivo obrigatório' });

    // Upload para R2
    const bucket = [env.LIFEOS_R2, env.LIFEOS_FILES, env.R2_BUCKET]
      .find((c) => c && typeof c.get === 'function' && typeof c.put === 'function') || null;

    if (!bucket) return json(503, { ok: false, error: 'R2 não disponível' });

    const safeName = safeFileName(fileName);
    const storageKey = `messages/${session.sub}/whatsapp/${generateId()}/${safeName}`;
    await bucket.put(storageKey, file, { httpMetadata: { contentType: mimeType || 'application/octet-stream' } });

    // Gerar URL pública temporária para WhatsApp
    // Nota: WhatsApp requer URL pública. Em produção, usar um domínio público.
    return json(200, {
      ok: true,
      storageKey,
      storageUrl: `${new URL(url).origin}/api/documents?action=download&key=${encodeURIComponent(storageKey)}`,
      fileName: safeName,
      message: 'Arquivo armazenado. Para enviar via WhatsApp, a URL precisa ser acessível publicamente.',
    });
  }

  // ─── Download de mídia de mensagem recebida ───────────────────────────
  if (action === 'download-media') {
    const { mediaId, convId } = body;
    if (!mediaId) return json(400, { ok: false, error: 'mediaId obrigatório' });
    if (!env.WHATSAPP_ACCESS_TOKEN) return json(503, { ok: false, error: 'Token não configurado' });

    try {
      const infoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      });
      if (!infoRes.ok) return json(infoRes.status, { ok: false, error: 'Mídia não encontrada' });
      const mediaInfo = await infoRes.json();

      const downloadRes = await fetch(mediaInfo.url, {
        headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      });
      if (!downloadRes.ok) return json(downloadRes.status, { ok: false, error: 'Erro ao baixar' });

      const buffer = await downloadRes.arrayBuffer();

      // Salvar no R2
      const bucket = [env.LIFEOS_R2, env.LIFEOS_FILES, env.R2_BUCKET]
        .find((c) => c && typeof c.get === 'function' && typeof c.put === 'function') || null;

      let storageKey = null;
      if (bucket && convId) {
        const safeName = safeFileName(mediaInfo.filename || `media_${mediaId}`);
        storageKey = `messages/${session.sub}/${convId}/${generateId()}/${safeName}`;
        await bucket.put(storageKey, buffer, {
          httpMetadata: { contentType: mediaInfo.mime_type || 'application/octet-stream' },
        });

        // Atualizar mensagem no KV
        const msgKey = `msg:messages:${session.sub}:${convId}`;
        const messages = JSON.parse(await kv.get(msgKey) || '[]');
        const msg = messages.find(m =>
          m.attachments?.some(a => a.externalUrl === mediaId)
        );
        if (msg) {
          const att = msg.attachments.find(a => a.externalUrl === mediaId);
          if (att) { att.storageKey = storageKey; att.size = mediaInfo.file_size || 0; }
          await kv.put(msgKey, JSON.stringify(messages));
        }
      }

      return json(200, { ok: true, storageKey, size: buffer.byteLength, type: mediaInfo.mime_type });
    } catch (err) {
      return json(500, { ok: false, error: 'Erro: ' + err.message });
    }
  }

  // ─── Enviar template WhatsApp ───────────────────────────────────────────
  if (action === 'send-template') {
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_ID) {
      return json(503, { ok: false, error: 'WhatsApp não configurado' });
    }
    const { to, templateName, templateLang, components } = body;
    if (!to || !templateName) return json(400, { ok: false, error: 'Número e nome do template obrigatórios' });

    const conv = await getOrCreateWhatsAppConv(kv, session.sub, to, body.name);
    const result = await sendAndPersist(env, kv, session.sub, {
      phoneId: env.WHATSAPP_PHONE_ID,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      to,
      type: 'template',
      convId: conv.id,
      templateName,
      templateLang: templateLang || 'pt_BR',
      templateComponents: components || [],
    });

    return json(result.ok ? 200 : 500, { ok: result.ok, result, conversation: { id: conv.id } });
  }

  // ─── Refresh token ─────────────────────────────────────────────────────
  if (action === 'refresh-token') {
    // WhatsApp tokens não expiram via refresh — são de longa duração
    // Mas podemos verificar se o token ainda é válido
    if (!env.WHATSAPP_ACCESS_TOKEN) return json(503, { ok: false, error: 'Token não configurado' });
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_ID}`, {
        headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      });
      const valid = res.ok;
      return json(200, { ok: valid, message: valid ? 'Token válido' : 'Token inválido ou expirado' });
    } catch (err) {
      return json(500, { ok: false, error: 'Erro ao verificar token: ' + err.message });
    }
  }

  // ─── Disconnect ────────────────────────────────────────────────────────
  if (action === 'disconnect') {
    // Remover token do KV (não revoga no Meta, apenas remove localmente)
    const connRaw = await kv.get(`comm:connections:${session.sub}`);
    const connections = connRaw ? JSON.parse(connRaw) : {};
    if (connections.whatsapp) {
      delete connections.whatsapp;
      await kv.put(`comm:connections:${session.sub}`, JSON.stringify(connections));
    }
    return json(200, { ok: true, message: 'WhatsApp desconectado localmente' });
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: send, upload-media, download-media, send-template, refresh-token, disconnect' });
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  if (ctx.request.method === 'POST') return onRequestPost(ctx);
  return json(405, { ok: false, error: 'Método não permitido' });
}
