// LifeOS Enterprise — Messages/Conversations API v1.0
// Cloudflare Pages Function: GET/POST /api/messages
// Fase 733 — Persistência real de conversas, histórico e anexos
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_STRING_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;
const MAX_CONVERSATIONS = 200;
const MAX_MESSAGES_PER_CONV = 500;
const MAX_ATTACHMENT_NAME = 180;
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function now() {
  return new Date().toISOString();
}

function sanitizeInput(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .slice(0, MAX_STRING_LENGTH);
}

function safeText(value, max = MAX_TITLE_LENGTH) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max) || '—';
}

function safeFileName(value) {
  const text = safeText(value, MAX_ATTACHMENT_NAME)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '');
  return text || 'arquivo';
}

function resolveBucket(env) {
  return [env.LIFEOS_R2, env.LIFEOS_FILES, env.R2_BUCKET]
    .find((c) => c && typeof c.get === 'function' && typeof c.put === 'function') || null;
}

async function readJson(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

async function getAuth(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return { error: json(503, { ok: false, error: 'Serviço indisponível' }) };
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return { error: json(401, { ok: false, error: 'Não autenticado' }) };
  const kv = env.LIFEOS_KV;
  if (!kv) return { error: json(503, { ok: false, error: 'Armazenamento indisponível' }) };
  return { session, kv, bucket: resolveBucket(env) };
}

// ─── CONVERSATIONS ────────────────────────────────────────────────────────────
function getConversationsKey(userId) {
  return `msg:conversations:${userId}`;
}

function getMessagesKey(userId, convId) {
  return `msg:messages:${userId}:${convId}`;
}

// GET /api/messages
// view=conversations (default): list all conversations
// view=conversation&convId={id}: get messages for a conversation
// view=stats: conversation statistics
export async function onRequestGet({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'conversations';

    if (view === 'stats') {
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      let totalMessages = 0;
      let totalAttachments = 0;
      for (const c of convs) {
        totalMessages += c.messageCount || 0;
        totalAttachments += c.attachmentCount || 0;
      }
      return json(200, {
        ok: true,
        stats: {
          conversations: convs.length,
          totalMessages,
          totalAttachments,
          unread: convs.filter(c => (c.unread || 0) > 0).length,
        }
      });
    }

    if (view === 'conversation') {
      const convId = url.searchParams.get('convId');
      if (!convId) return json(400, { ok: false, error: 'ID da conversa obrigatório' });
      const messages = await readJson(kv, getMessagesKey(session.sub, convId), []);
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      const conv = convs.find(c => c.id === convId);
      return json(200, {
        ok: true,
        conversation: conv || null,
        messages: messages.slice(0, MAX_MESSAGES_PER_CONV),
        total: messages.length
      });
    }

    if (view === 'search') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      if (!q) return json(400, { ok: false, error: 'Termo de busca obrigatório' });
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      const results = convs.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q) ||
        (c.participants || []).some(p => p.toLowerCase().includes(q))
      );
      return json(200, { ok: true, results, total: results.length, query: q });
    }

    // Default: list all conversations
    const convs = await readJson(kv, getConversationsKey(session.sub), []);
    return json(200, {
      ok: true,
      conversations: convs,
      total: convs.length
    });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar mensagens' });
  }
}

// POST /api/messages
// action=create: create new conversation
// action=send: send a message in a conversation
// action=edit: edit a message
// action=delete-message: delete a message
// action=delete: delete a conversation
// action=pin: pin/unpin a conversation
// action=archive: archive/unarchive a conversation
// action=upload-attachment: upload a file attachment
export async function onRequestPost({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv, bucket } = auth;
  try {
    const contentType = request.headers.get('content-type') || '';
    let body;
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      body = {};
      for (const [key, value] of form.entries()) {
        body[key] = value;
      }
    } else {
      body = await request.json();
    }
    const action = sanitizeInput(body?.action || '');

    if (action === 'create') {
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      const conv = {
        id: generateId(),
        title: safeText(body?.title || body?.name || 'Nova Conversa'),
        participants: Array.isArray(body?.participants) ? body.participants.map(p => safeText(p, 100)).filter(Boolean) : [safeText(body?.participant || session.sub, 100)],
        lastMessage: '',
        lastAt: now(),
        unread: 0,
        pinned: false,
        archived: false,
        createdAt: now(),
        createdBy: session.sub,
        messageCount: 0,
        attachmentCount: 0,
      };
      convs.unshift(conv);
      await writeJson(kv, getConversationsKey(session.sub), convs.slice(0, MAX_CONVERSATIONS));
      return json(201, { ok: true, conversation: conv });
    }

    if (action === 'send') {
      const { convId, text, attachments } = body;
      if (!convId) return json(400, { ok: false, error: 'ID da conversa obrigatório' });
      const messageText = sanitizeInput(text);
      if (!messageText && !attachments) return json(400, { ok: false, error: 'Mensagem ou anexo obrigatório' });

      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      const conv = convs.find(c => c.id === convId);
      if (!conv) return json(404, { ok: false, error: 'Conversa não encontrada' });

      const messages = await readJson(kv, getMessagesKey(session.sub, convId), []);
      const msg = {
        id: generateId(),
        convId,
        sender: session.sub,
        text: messageText,
        attachments: Array.isArray(attachments) ? attachments.map(a => ({
          id: generateId(),
          name: safeFileName(a?.name || 'arquivo'),
          size: Number(a?.size || 0),
          type: sanitizeInput(a?.type || 'application/octet-stream').slice(0, 100),
          storageKey: a?.storageKey || null,
        })).filter(a => a.name) : [],
        createdAt: now(),
        edited: false,
        deleted: false,
      };
      messages.push(msg);
      await writeJson(kv, getMessagesKey(session.sub, convId), messages.slice(-MAX_MESSAGES_PER_CONV));

      // Update conversation metadata
      conv.lastMessage = messageText.slice(0, 100);
      conv.lastAt = now();
      conv.messageCount = (conv.messageCount || 0) + 1;
      conv.attachmentCount = (conv.attachmentCount || 0) + (msg.attachments.length || 0);
      await writeJson(kv, getConversationsKey(session.sub), convs);

      return json(200, { ok: true, message: msg });
    }

    if (action === 'edit') {
      const { convId, messageId, text } = body;
      if (!convId || !messageId) return json(400, { ok: false, error: 'IDs obrigatórios' });
      const messages = await readJson(kv, getMessagesKey(session.sub, convId), []);
      const msg = messages.find(m => m.id === messageId);
      if (!msg) return json(404, { ok: false, error: 'Mensagem não encontrada' });
      if (msg.sender !== session.sub) return json(403, { ok: false, error: 'Sem permissão' });
      msg.text = sanitizeInput(text);
      msg.edited = true;
      msg.editedAt = now();
      await writeJson(kv, getMessagesKey(session.sub, convId), messages);
      return json(200, { ok: true, message: msg });
    }

    if (action === 'delete-message') {
      const { convId, messageId } = body;
      if (!convId || !messageId) return json(400, { ok: false, error: 'IDs obrigatórios' });
      const messages = await readJson(kv, getMessagesKey(session.sub, convId), []);
      const msg = messages.find(m => m.id === messageId);
      if (!msg) return json(404, { ok: false, error: 'Mensagem não encontrada' });
      msg.deleted = true;
      msg.text = '';
      msg.deletedAt = now();
      await writeJson(kv, getMessagesKey(session.sub, convId), messages);
      return json(200, { ok: true, deleted: messageId });
    }

    if (action === 'delete') {
      const { convId } = body;
      if (!convId) return json(400, { ok: false, error: 'ID da conversa obrigatório' });
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      await kv.delete(getMessagesKey(session.sub, convId));
      await writeJson(kv, getConversationsKey(session.sub), convs.filter(c => c.id !== convId));
      return json(200, { ok: true, deleted: convId });
    }

    if (action === 'pin') {
      const { convId } = body;
      if (!convId) return json(400, { ok: false, error: 'ID da conversa obrigatório' });
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      const conv = convs.find(c => c.id === convId);
      if (!conv) return json(404, { ok: false, error: 'Conversa não encontrada' });
      conv.pinned = !conv.pinned;
      await writeJson(kv, getConversationsKey(session.sub), convs);
      return json(200, { ok: true, pinned: conv.pinned, conversation: conv });
    }

    if (action === 'archive') {
      const { convId } = body;
      if (!convId) return json(400, { ok: false, error: 'ID da conversa obrigatório' });
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      const conv = convs.find(c => c.id === convId);
      if (!conv) return json(404, { ok: false, error: 'Conversa não encontrada' });
      conv.archived = !conv.archived;
      await writeJson(kv, getConversationsKey(session.sub), convs);
      return json(200, { ok: true, archived: conv.archived, conversation: conv });
    }

    if (action === 'upload-attachment') {
      if (!bucket) return json(503, { ok: false, error: 'Armazenamento R2 pronto para ativação.' });
      const file = body?.file;
      const convId = body?.convId;
      if (!convId) return json(400, { ok: false, error: 'ID da conversa obrigatório' });
      if (!file || typeof file.size !== 'number' || file.size === 0) return json(400, { ok: false, error: 'Arquivo inválido' });
      if (file.size > MAX_ATTACHMENT_SIZE) return json(400, { ok: false, error: 'Arquivo excede o limite de 25 MB' });

      const fileName = safeFileName(file.name);
      const attachmentId = generateId();
      const storageKey = `messages/${encodeURIComponent(session.sub)}/${convId}/${attachmentId}/${fileName}`;
      await bucket.put(storageKey, file.stream ? file.stream() : await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });

      // Add attachment to last message or create new message
      const messages = await readJson(kv, getMessagesKey(session.sub, convId), []);
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      if (lastMsg) {
        lastMsg.attachments = lastMsg.attachments || [];
        lastMsg.attachments.push({
          id: attachmentId,
          name: fileName,
          size: file.size,
          type: file.type || 'application/octet-stream',
          storageKey,
        });
        await writeJson(kv, getMessagesKey(session.sub, convId), messages);
      }

      // Update conversation metadata
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      const conv = convs.find(c => c.id === convId);
      if (conv) {
        conv.attachmentCount = (conv.attachmentCount || 0) + 1;
        await writeJson(kv, getConversationsKey(session.sub), convs);
      }

      return json(200, {
        ok: true,
        attachment: {
          id: attachmentId,
          name: fileName,
          size: file.size,
          type: file.type,
          storageKey,
        }
      });
    }

    if (action === 'mark-read') {
      const { convId } = body;
      const convs = await readJson(kv, getConversationsKey(session.sub), []);
      const conv = convs.find(c => c.id === convId);
      if (conv) {
        conv.unread = 0;
        await writeJson(kv, getConversationsKey(session.sub), convs);
      }
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'Ação inválida' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar mensagem';
    const status = /não encontrado/i.test(message) ? 404 : /permissão/i.test(message) ? 403 : /obrigatório|inválid|limite/i.test(message) ? 400 : /pronto para ativação/i.test(message) ? 503 : 500;
    return json(status, { ok: false, error: message });
  }
}

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST') return onRequestPost({ request, env });
  if (method === 'PUT') return onRequestPost({ request, env });
  if (method === 'PATCH') return onRequestPost({ request, env });
  if (method === 'DELETE') return onRequestPost({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
