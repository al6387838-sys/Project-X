// LifeOS Enterprise — Documents API v2.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/documents
// Phase 142 — Document Center
// Upload, versionamento, busca, compartilhamento, favoritos, histórico, permissões, auditoria
import { getCookie, json, verifySession, hasPermission } from '../_auth.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function auditLog(kv, userId, action, documentId, details = {}) {
  try {
    const raw = await kv.get(`docs:audit:${userId}`);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({
      id: generateId(),
      userId,
      action,
      documentId,
      details,
      timestamp: new Date().toISOString(),
    });
    await kv.put(`docs:audit:${userId}`, JSON.stringify(log.slice(0, 500)));
  } catch { /* ignorar erros de auditoria */ }
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'list';
  const kv = env.LIFEOS_KV;

  if (!kv) return json(200, { ok: true, documents: [], source: 'unavailable' });

  try {
    switch (view) {
      case 'list': {
        const folderId = url.searchParams.get('folderId') || 'root';
        const raw = await kv.get(`docs:files:${session.sub}`);
        const allDocs = raw ? JSON.parse(raw) : [];
        const docs = allDocs.filter(d => d.folderId === folderId && !d.deleted);
        return json(200, { ok: true, documents: docs, total: docs.length });
      }

      case 'search': {
        const q = url.searchParams.get('q') || '';
        if (!q) return json(400, { ok: false, error: 'Parâmetro q obrigatório' });
        const raw = await kv.get(`docs:files:${session.sub}`);
        const allDocs = raw ? JSON.parse(raw) : [];
        const results = allDocs.filter(d =>
          !d.deleted && (
            d.name.toLowerCase().includes(q.toLowerCase()) ||
            (d.tags || []).some(t => t.toLowerCase().includes(q.toLowerCase())) ||
            (d.description || '').toLowerCase().includes(q.toLowerCase())
          )
        );
        return json(200, { ok: true, documents: results, query: q });
      }

      case 'favorites': {
        const raw = await kv.get(`docs:files:${session.sub}`);
        const allDocs = raw ? JSON.parse(raw) : [];
        const favs = allDocs.filter(d => d.favorite && !d.deleted);
        return json(200, { ok: true, documents: favs });
      }

      case 'versions': {
        const docId = url.searchParams.get('docId');
        if (!docId) return json(400, { ok: false, error: 'docId obrigatório' });
        const raw = await kv.get(`docs:versions:${session.sub}:${docId}`);
        const versions = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, versions });
      }

      case 'shared': {
        const raw = await kv.get(`docs:shared:${session.sub}`);
        const shared = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, shared });
      }

      case 'audit': {
        if (!hasPermission(session, 'manager')) {
          return json(403, { ok: false, error: 'Permissão insuficiente' });
        }
        const raw = await kv.get(`docs:audit:${session.sub}`);
        const audit = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, audit: audit.slice(0, 100) });
      }

      case 'stats': {
        const raw = await kv.get(`docs:files:${session.sub}`);
        const allDocs = raw ? JSON.parse(raw) : [];
        const active = allDocs.filter(d => !d.deleted);
        const totalSize = active.reduce((s, d) => s + (d.size || 0), 0);
        const byType = {};
        active.forEach(d => {
          const ext = d.name.split('.').pop()?.toLowerCase() || 'other';
          byType[ext] = (byType[ext] || 0) + 1;
        });
        return json(200, { ok: true, stats: {
          total: active.length,
          totalSize,
          favorites: active.filter(d => d.favorite).length,
          byType,
        }});
      }

      default:
        return json(400, { ok: false, error: 'view inválido' });
    }
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar documentos' });
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

  // ─── Registrar documento (metadados — o arquivo real vai para R2/S3) ───
  if (action === 'upload') {
    const { name, size, mimeType, folderId, tags, description, storageUrl } = body;
    if (!name) return json(400, { ok: false, error: 'Nome obrigatório' });

    const doc = {
      id: generateId(),
      name,
      size: size || 0,
      mimeType: mimeType || 'application/octet-stream',
      folderId: folderId || 'root',
      tags: Array.isArray(tags) ? tags : [],
      description: description || '',
      storageUrl: storageUrl || null,
      favorite: false,
      deleted: false,
      version: 1,
      permissions: { owner: session.sub, viewers: [], editors: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: session.sub,
    };

    const raw = await kv.get(`docs:files:${session.sub}`);
    const docs = raw ? JSON.parse(raw) : [];
    docs.unshift(doc);
    await kv.put(`docs:files:${session.sub}`, JSON.stringify(docs));

    // Versão inicial
    await kv.put(`docs:versions:${session.sub}:${doc.id}`, JSON.stringify([{
      version: 1,
      storageUrl: storageUrl || null,
      size: size || 0,
      uploadedBy: session.sub,
      uploadedAt: doc.createdAt,
      comment: 'Versão inicial',
    }]));

    await auditLog(kv, session.sub, 'upload', doc.id, { name, size });
    return json(201, { ok: true, document: doc });
  }

  // ─── Nova versão de documento ───
  if (action === 'new-version') {
    const { docId, storageUrl, size, comment } = body;
    if (!docId) return json(400, { ok: false, error: 'docId obrigatório' });

    const raw = await kv.get(`docs:files:${session.sub}`);
    const docs = raw ? JSON.parse(raw) : [];
    const idx = docs.findIndex(d => d.id === docId);
    if (idx === -1) return json(404, { ok: false, error: 'Documento não encontrado' });

    docs[idx].version += 1;
    docs[idx].size = size || docs[idx].size;
    docs[idx].storageUrl = storageUrl || docs[idx].storageUrl;
    docs[idx].updatedAt = new Date().toISOString();
    await kv.put(`docs:files:${session.sub}`, JSON.stringify(docs));

    const versRaw = await kv.get(`docs:versions:${session.sub}:${docId}`);
    const versions = versRaw ? JSON.parse(versRaw) : [];
    versions.unshift({
      version: docs[idx].version,
      storageUrl: storageUrl || null,
      size: size || 0,
      uploadedBy: session.sub,
      uploadedAt: new Date().toISOString(),
      comment: comment || `Versão ${docs[idx].version}`,
    });
    await kv.put(`docs:versions:${session.sub}:${docId}`, JSON.stringify(versions.slice(0, 50)));

    await auditLog(kv, session.sub, 'new-version', docId, { version: docs[idx].version });
    return json(200, { ok: true, document: docs[idx] });
  }

  // ─── Favoritar/desfavoritar ───
  if (action === 'toggle-favorite') {
    const { docId } = body;
    if (!docId) return json(400, { ok: false, error: 'docId obrigatório' });

    const raw = await kv.get(`docs:files:${session.sub}`);
    const docs = raw ? JSON.parse(raw) : [];
    const idx = docs.findIndex(d => d.id === docId);
    if (idx === -1) return json(404, { ok: false, error: 'Documento não encontrado' });

    docs[idx].favorite = !docs[idx].favorite;
    docs[idx].updatedAt = new Date().toISOString();
    await kv.put(`docs:files:${session.sub}`, JSON.stringify(docs));
    await auditLog(kv, session.sub, docs[idx].favorite ? 'favorited' : 'unfavorited', docId, {});
    return json(200, { ok: true, favorite: docs[idx].favorite });
  }

  // ─── Compartilhar documento ───
  if (action === 'share') {
    const { docId, targetUserId, permission } = body;
    if (!docId || !targetUserId) return json(400, { ok: false, error: 'docId e targetUserId obrigatórios' });
    const validPerms = ['view', 'edit'];
    if (!validPerms.includes(permission)) return json(400, { ok: false, error: 'permission deve ser view ou edit' });

    const raw = await kv.get(`docs:files:${session.sub}`);
    const docs = raw ? JSON.parse(raw) : [];
    const idx = docs.findIndex(d => d.id === docId);
    if (idx === -1) return json(404, { ok: false, error: 'Documento não encontrado' });

    if (permission === 'view' && !docs[idx].permissions.viewers.includes(targetUserId)) {
      docs[idx].permissions.viewers.push(targetUserId);
    }
    if (permission === 'edit' && !docs[idx].permissions.editors.includes(targetUserId)) {
      docs[idx].permissions.editors.push(targetUserId);
    }
    docs[idx].updatedAt = new Date().toISOString();
    await kv.put(`docs:files:${session.sub}`, JSON.stringify(docs));

    // Registrar no shared do destinatário
    const sharedRaw = await kv.get(`docs:shared:${targetUserId}`);
    const shared = sharedRaw ? JSON.parse(sharedRaw) : [];
    if (!shared.find(s => s.docId === docId && s.ownerId === session.sub)) {
      shared.unshift({
        docId,
        ownerId: session.sub,
        permission,
        sharedAt: new Date().toISOString(),
        docName: docs[idx].name,
      });
      await kv.put(`docs:shared:${targetUserId}`, JSON.stringify(shared.slice(0, 200)));
    }

    await auditLog(kv, session.sub, 'shared', docId, { targetUserId, permission });
    return json(200, { ok: true, shared: true });
  }

  // ─── Atualizar permissões ───
  if (action === 'update-permissions') {
    const { docId, viewers, editors } = body;
    if (!docId) return json(400, { ok: false, error: 'docId obrigatório' });

    const raw = await kv.get(`docs:files:${session.sub}`);
    const docs = raw ? JSON.parse(raw) : [];
    const idx = docs.findIndex(d => d.id === docId);
    if (idx === -1) return json(404, { ok: false, error: 'Documento não encontrado' });
    if (docs[idx].permissions.owner !== session.sub && !hasPermission(session, 'admin')) {
      return json(403, { ok: false, error: 'Sem permissão para alterar permissões' });
    }

    if (Array.isArray(viewers)) docs[idx].permissions.viewers = viewers;
    if (Array.isArray(editors)) docs[idx].permissions.editors = editors;
    docs[idx].updatedAt = new Date().toISOString();
    await kv.put(`docs:files:${session.sub}`, JSON.stringify(docs));
    await auditLog(kv, session.sub, 'permissions-updated', docId, { viewers, editors });
    return json(200, { ok: true, permissions: docs[idx].permissions });
  }

  // ─── Excluir (soft delete) ───
  if (action === 'delete') {
    const { docId } = body;
    if (!docId) return json(400, { ok: false, error: 'docId obrigatório' });

    const raw = await kv.get(`docs:files:${session.sub}`);
    const docs = raw ? JSON.parse(raw) : [];
    const idx = docs.findIndex(d => d.id === docId);
    if (idx === -1) return json(404, { ok: false, error: 'Documento não encontrado' });

    docs[idx].deleted = true;
    docs[idx].deletedAt = new Date().toISOString();
    docs[idx].updatedAt = new Date().toISOString();
    await kv.put(`docs:files:${session.sub}`, JSON.stringify(docs));
    await auditLog(kv, session.sub, 'deleted', docId, { name: docs[idx].name });
    return json(200, { ok: true, deleted: docId });
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
