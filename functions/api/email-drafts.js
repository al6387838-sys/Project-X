// LifeOS Enterprise — Email Drafts API v1.0
// Cloudflare Pages Function: GET/POST /api/email-drafts
// Fase 733 — Persistência real de rascunhos de email
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_DRAFTS = 50;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 10000;

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
    .slice(0, MAX_BODY_LENGTH);
}

function safeText(value, max = MAX_SUBJECT_LENGTH) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max) || '';
}

async function getAuth(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return { error: json(503, { ok: false, error: 'Serviço indisponível' }) };
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return { error: json(401, { ok: false, error: 'Não autenticado' }) };
  const kv = env.LIFEOS_KV;
  if (!kv) return { error: json(503, { ok: false, error: 'Armazenamento indisponível' }) };
  return { session, kv };
}

async function getDrafts(kv, userId) {
  const raw = await kv.get(`email:drafts:${userId}`);
  return raw ? JSON.parse(raw) : [];
}

async function saveDrafts(kv, userId, drafts) {
  await kv.put(`email:drafts:${userId}`, JSON.stringify(drafts.slice(0, MAX_DRAFTS)));
}

export async function onRequestGet({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'list';

    if (view === 'count') {
      const drafts = await getDrafts(kv, session.sub);
      return json(200, { ok: true, count: drafts.length });
    }

    if (view === 'draft') {
      const draftId = url.searchParams.get('id');
      if (!draftId) return json(400, { ok: false, error: 'ID do rascunho obrigatório' });
      const drafts = await getDrafts(kv, session.sub);
      const draft = drafts.find(d => d.id === draftId);
      return json(200, { ok: true, draft: draft || null });
    }

    // Default: list all drafts
    const drafts = await getDrafts(kv, session.sub);
    return json(200, { ok: true, drafts, total: drafts.length });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar rascunhos' });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const body = await request.json();
    const action = sanitizeInput(body?.action || '');

    if (action === 'save') {
      const { id, to, subject, body: emailBody, provider, attachments } = body;
      const drafts = await getDrafts(kv, session.sub);
      if (id) {
        const idx = drafts.findIndex(d => d.id === id);
        if (idx >= 0) {
          drafts[idx] = {
            ...drafts[idx],
            to: safeText(to, 500),
            subject: safeText(subject),
            body: sanitizeInput(emailBody),
            provider: sanitizeInput(provider || '').slice(0, 50),
            attachments: Array.isArray(attachments) ? attachments.map(a => ({
              id: generateId(),
              name: safeText(a?.name || 'arquivo', 180),
              size: Number(a?.size || 0),
              type: sanitizeInput(a?.type || '').slice(0, 100),
            })) : [],
            updatedAt: now(),
          };
        } else {
          return json(404, { ok: false, error: 'Rascunho não encontrado' });
        }
      } else {
        drafts.unshift({
          id: generateId(),
          to: safeText(to, 500),
          subject: safeText(subject),
          body: sanitizeInput(emailBody),
          provider: sanitizeInput(provider || '').slice(0, 50),
          attachments: Array.isArray(attachments) ? attachments.map(a => ({
            id: generateId(),
            name: safeText(a?.name || 'arquivo', 180),
            size: Number(a?.size || 0),
            type: sanitizeInput(a?.type || '').slice(0, 100),
          })) : [],
          createdAt: now(),
          updatedAt: now(),
        });
      }
      await saveDrafts(kv, session.sub, drafts);
      return json(200, { ok: true, drafts });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return json(400, { ok: false, error: 'ID do rascunho obrigatório' });
      const drafts = await getDrafts(kv, session.sub);
      await saveDrafts(kv, session.sub, drafts.filter(d => d.id !== id));
      return json(200, { ok: true, deleted: id });
    }

    if (action === 'send-from-draft') {
      const { id, ...sendParams } = body;
      if (!id) return json(400, { ok: false, error: 'ID do rascunho obrigatório' });
      const drafts = await getDrafts(kv, session.sub);
      const draft = drafts.find(d => d.id === id);
      if (!draft) return json(404, { ok: false, error: 'Rascunho não encontrado' });
      // Remove draft after sending
      await saveDrafts(kv, session.sub, drafts.filter(d => d.id !== id));
      return json(200, { ok: true, sent: true, draft: draft });
    }

    return json(400, { ok: false, error: 'Ação inválida' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar rascunho';
    const status = /não encontrado/i.test(message) ? 404 : /obrigatório|inválid/i.test(message) ? 400 : 500;
    return json(status, { ok: false, error: message });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
