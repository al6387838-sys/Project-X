// LifeOS Enterprise — WhatsApp Cloud API Webhook Handler v1.1
// Cloudflare Pages Function: GET/POST /api/webhooks/whatsapp
// Recebe mensagens inbound, status updates, e eventos de mídia via WhatsApp Cloud API
// Fase 750 — Integração WhatsApp Real: Receptivo + Sincronização + Notificações
// NAMESPACE COMPATÍVEL: msg:conversations:{userId}, msg:messages:{userId}:{convId}

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

// ─── Configurações ────────────────────────────────────────────────────────────
// WhatsApp usa um número business único. Todas as mensagens inbound
// pertencem ao proprietário desse número. O userId associado é o owner
// do WhatsApp (definido nas variáveis do Cloudflare).
// Estratégia: armazenar no namespace do owner (system-wide para WA).
// O frontend filtra por canal "whatsapp" nas conversas.

const WA_OWNER_KEY = 'comm:whatsapp:owner'; // Armazena o userId do owner

async function getWaOwner(kv) {
  // Se não há owner definido, usar 'system' como fallback
  const owner = await kv.get(WA_OWNER_KEY);
  return owner || 'system';
}

// ─── Verificação do Webhook (GET) ─────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const challenge = url.searchParams.get('hub.challenge');
  const verifyToken = url.searchParams.get('hub.verify_token');

  if (mode === 'subscribe' && challenge) {
    const expectedToken = env.WHATSAPP_VERIFY_TOKEN || env.WHATSAPP_WEBHOOK_SECRET || 'lifeos-whatsapp-verify';
    if (verifyToken === expectedToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  return new Response('OK', { status: 200 });
}

// ─── Recebimento de Webhook (POST) ────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const kv = env.LIFEOS_KV;
  if (!kv) return new Response('Service Unavailable', { status: 503 });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // WhatsApp Cloud API structure
  if (!body || !body.entry || !Array.isArray(body.entry)) {
    return new Response('OK', { status: 200 });
  }

  const owner = await getWaOwner(kv);
  const results = [];

  for (const entry of body.entry) {
    const changes = entry.changes || [];

    for (const change of changes) {
      const changeValue = change.value || {};

      // Status Update (delivery, read, failed)
      if (changeValue.statuses && Array.isArray(changeValue.statuses)) {
        for (const status of changeValue.statuses) {
          const result = await handleStatusUpdate(kv, owner, status);
          results.push(result);
        }
      }

      // Mensagem Recebida
      if (changeValue.messages && Array.isArray(changeValue.messages)) {
        for (const msg of changeValue.messages) {
          const contact = changeValue.contacts?.[0] || {};
          const result = await handleInboundMessage(kv, env, owner, msg, contact);
          results.push(result);
        }
      }

      // Call Events
      if (changeValue.calls && Array.isArray(changeValue.calls)) {
        for (const call of changeValue.calls) {
          const result = await handleCallEvent(kv, owner, call);
          results.push(result);
        }
      }
    }
  }

  // Log do processamento
  const logEntry = {
    id: generateId(),
    type: 'webhook_processed',
    provider: 'whatsapp',
    eventsProcessed: results.length,
    processedAt: now(),
    summary: results.map(r => r.type).filter(Boolean).join(', '),
  };

  try {
    const logsKey = `comm:logs:${owner}`;
    const logsRaw = await kv.get(logsKey);
    const logs = logsRaw ? JSON.parse(logsRaw) : [];
    logs.unshift(logEntry);
    await kv.put(logsKey, JSON.stringify(logs.slice(0, 500)));
  } catch { /* ignorar erro de log */ }

  return new Response('OK', { status: 200 });
}

// ─── Status Update Handler ────────────────────────────────────────────────────
async function handleStatusUpdate(kv, userId, status) {
  const { id: messageId, status: deliveryStatus, conversation, recipient_id, timestamp } = status;

  // Atualizar mensagem no histórico de comunicação
  const histKey = `comm:history:${userId}`;
  try {
    const histRaw = await kv.get(histKey);
    const history = histRaw ? JSON.parse(histRaw) : [];
    const idx = history.findIndex(h => h.messageId === messageId);
    if (idx !== -1) {
      history[idx].deliveryStatus = deliveryStatus;
      history[idx].deliveryAt = now();
      if (timestamp) history[idx].sentAt = new Date(parseInt(timestamp) * 1000).toISOString();
      await kv.put(histKey, JSON.stringify(history));
    }
  } catch { /* ignorar */ }

  // Atualizar mensagem nas conversas (se encontrada)
  try {
    const convsRaw = await kv.get(`msg:conversations:${userId}`);
    const convs = convsRaw ? JSON.parse(convsRaw) : [];
    for (const conv of convs) {
      if (conv.channel !== 'whatsapp') continue;
      const msgKey = `msg:messages:${userId}:${conv.id}`;
      const msgRaw = await kv.get(msgKey);
      if (!msgRaw) continue;
      const messages = JSON.parse(msgRaw);
      const msg = messages.find(m => m.externalId === messageId);
      if (msg) {
        msg.sendStatus = deliveryStatus;
        msg.deliveryAt = now();
        await kv.put(msgKey, JSON.stringify(messages));
        break;
      }
    }
  } catch { /* ignorar */ }

  return { type: `status_${deliveryStatus}`, messageId, conversationId: conversation?.id };
}

// ─── Inbound Message Handler ──────────────────────────────────────────────────
async function handleInboundMessage(kv, env, userId, msg, contact) {
  const { id: messageId, type: msgType, from, timestamp } = msg;
  const senderName = contact?.profile?.name || from || 'Desconhecido';
  const senderPhone = from || 'unknown';

  // Criar timestamp da mensagem
  const msgTime = timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : now();

  // Buscar ou criar conversa para este contato
  const convKey = `msg:conversations:${userId}`;
  const convsRaw = await kv.get(convKey);
  let convs = convsRaw ? JSON.parse(convsRaw) : [];

  let conv = convs.find(c =>
    (c.whatsappNumber === senderPhone || c.participants?.includes(senderPhone))
    && c.channel === 'whatsapp'
  );

  if (!conv) {
    conv = {
      id: generateId(),
      title: safeText(senderName || senderPhone, 100),
      participants: [senderPhone],
      whatsappNumber: senderPhone,
      lastMessage: '',
      lastAt: msgTime,
      unread: 1,
      pinned: false,
      archived: false,
      createdAt: msgTime,
      createdBy: 'whatsapp-webhook',
      messageCount: 0,
      attachmentCount: 0,
      channel: 'whatsapp',
      provider: 'whatsapp',
      externalId: null,
    };
    convs.unshift(conv);
    await kv.put(convKey, JSON.stringify(convs.slice(0, 200)));
  } else {
    conv.unread = (conv.unread || 0) + 1;
  }

  // Extrair conteúdo da mensagem baseado no tipo
  let textContent = '';
  let attachments = [];

  switch (msgType) {
    case 'text':
      textContent = msg.text?.body || '';
      break;

    case 'image':
      textContent = msg.image?.caption || '[Imagem]';
      attachments = [{
        id: generateId(),
        name: safeFileName(`img_${messageId.slice(0, 8)}.jpg`),
        size: 0,
        type: msg.image?.mime_type || 'image/jpeg',
        storageKey: null,
        externalUrl: msg.image?.id || null,
        externalSource: 'whatsapp_media',
      }];
      break;

    case 'video':
      textContent = msg.video?.caption || '[Vídeo]';
      attachments = [{
        id: generateId(),
        name: safeFileName(`video_${messageId.slice(0, 8)}.mp4`),
        size: 0,
        type: msg.video?.mime_type || 'video/mp4',
        storageKey: null,
        externalUrl: msg.video?.id || null,
        externalSource: 'whatsapp_media',
      }];
      break;

    case 'document':
      textContent = msg.document?.caption || `[Documento: ${msg.document?.filename || 'arquivo'}]`;
      attachments = [{
        id: generateId(),
        name: safeFileName(msg.document?.filename || `doc_${messageId.slice(0, 8)}`),
        size: msg.document?.file_size || 0,
        type: msg.document?.mime_type || 'application/octet-stream',
        storageKey: null,
        externalUrl: msg.document?.id || null,
        externalSource: 'whatsapp_media',
      }];
      break;

    case 'audio':
      textContent = msg.audio?.mime_type?.includes('ogg') ? '[Mensagem de voz]' : '[Áudio]';
      attachments = [{
        id: generateId(),
        name: `audio_${messageId.slice(0, 8)}.ogg`,
        size: msg.audio?.file_size || 0,
        type: msg.audio?.mime_type || 'audio/ogg',
        storageKey: null,
        externalUrl: msg.audio?.id || null,
        externalSource: 'whatsapp_media',
      }];
      break;

    case 'sticker':
      textContent = '[Sticker]';
      break;

    case 'location':
      textContent = `[Localização: ${msg.location?.name || `${msg.location?.latitude}, ${msg.location?.longitude}`}]`;
      break;

    case 'contacts':
      textContent = `[Contato: ${(msg.contacts?.[0]?.formatted_name || 'Contato compartilhado')}]`;
      break;

    case 'reaction':
      textContent = `[Reação: ${msg.reaction?.emoji || '👍'}]`;
      break;

    case 'interactive':
      textContent = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Interação]';
      break;

    case 'template':
      textContent = `[Template WhatsApp]`;
      break;

    default:
      textContent = `[Mensagem ${msgType}]`;
      break;
  }

  // Criar mensagem no formato compatível com messages.js
  const message = {
    id: messageId || generateId(),
    convId: conv.id,
    sender: senderPhone,
    senderName,
    senderPhone,
    text: safeText(textContent),
    attachments,
    createdAt: msgTime,
    edited: false,
    deleted: false,
    channel: 'whatsapp',
    provider: 'whatsapp',
    externalId: messageId,
    type: msgType,
    read: false,
  };

  // Salvar mensagem
  const msgKey = `msg:messages:${userId}:${conv.id}`;
  const messagesRaw = await kv.get(msgKey);
  const messages = messagesRaw ? JSON.parse(messagesRaw) : [];
  messages.push(message);
  await kv.put(msgKey, JSON.stringify(messages.slice(-500)));

  // Atualizar conversa
  conv.lastMessage = textContent.slice(0, 100);
  conv.lastAt = msgTime;
  conv.messageCount = (conv.messageCount || 0) + 1;
  conv.attachmentCount = (conv.attachmentCount || 0) + attachments.length;
  const convIdx = convs.findIndex(c => c.id === conv.id);
  if (convIdx !== -1) {
    convs[convIdx] = conv;
    await kv.put(convKey, JSON.stringify(convs));
  }

  // Histórico de comunicação
  try {
    const histKey = `comm:history:${userId}`;
    const histRaw = await kv.get(histKey);
    const history = histRaw ? JSON.parse(histRaw) : [];
    history.unshift({
      id: generateId(),
      provider: 'whatsapp',
      direction: 'inbound',
      from: senderPhone,
      fromName: senderName,
      to: env.WHATSAPP_PHONE_ID || 'self',
      subject: textContent.slice(0, 80),
      body: textContent,
      status: 'received',
      sentAt: msgTime,
      messageId,
      msgType,
      conversationId: conv.id,
    });
    await kv.put(histKey, JSON.stringify(history.slice(0, 500)));
  } catch { /* ignorar */ }

  // Notificação interna
  try {
    const notifKey = `notifications:${userId}`;
    const notifRaw = await kv.get(notifKey);
    const notifications = notifRaw ? JSON.parse(notifRaw) : [];
    notifications.unshift({
      id: generateId(),
      type: 'whatsapp_message',
      title: `Nova mensagem de ${senderName}`,
      body: textContent.slice(0, 120),
      metadata: {
        from: senderPhone,
        fromName: senderName,
        messageId,
        conversationId: conv.id,
        msgType,
      },
      read: false,
      createdAt: now(),
    });
    await kv.put(notifKey, JSON.stringify(notifications.slice(0, 100)));
  } catch { /* ignorar */ }

  return { type: 'message_received', conversationId: conv.id, messageId, msgType, from: senderPhone };
}

// ─── Call Event Handler ───────────────────────────────────────────────────────
async function handleCallEvent(kv, userId, call) {
  const logEntry = {
    id: generateId(),
    type: 'whatsapp_call',
    callId: call.id,
    from: call.from,
    to: call.to,
    status: call.status || call.type,
    timestamp: call.timestamp ? new Date(parseInt(call.timestamp) * 1000).toISOString() : now(),
  };

  try {
    const logsKey = `comm:logs:${userId}`;
    const logsRaw = await kv.get(logsKey);
    const logs = logsRaw ? JSON.parse(logsRaw) : [];
    logs.unshift(logEntry);
    await kv.put(logsKey, JSON.stringify(logs.slice(0, 500)));
  } catch { /* ignorar */ }

  return { type: 'call_event', callId: call.id };
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  if (ctx.request.method === 'POST') return onRequestPost(ctx);
  return new Response('Method Not Allowed', { status: 405 });
}
