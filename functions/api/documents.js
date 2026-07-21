// LifeOS Enterprise — Documents API v43.0
// Cloudflare Pages Function: GET/POST /api/documents
// Persistência: Cloudflare KV (metadados/auditoria) + R2 oficial (conteúdo binário).
import { getCookie, json, verifySession, hasPermission } from '../_auth.js';

function lifeosLogError(env, operation, error, details = {}) {
  try {
    if (!env?.LIFEOS_KV) return;
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      error: error?.message || String(error),
      stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
      ...details,
    };
    env.LIFEOS_KV.put('error-logs', JSON.stringify([logEntry, ...JSON.parse(env.LIFEOS_KV.get('error-logs') || '[]').slice(0, 99)]));
  } catch { /* silent */ }
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_AUDIT = 500;
// Hardening v46.0.0 (Fase 328): allowlist de tipos MIME e extensões bloqueadas
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/zip', 'application/json', 'application/octet-stream',
]);
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'sh', 'bat', 'cmd', 'ps1', 'vbs', 'jar', 'dll', 'so',
  'dylib', 'msi', 'dmg', 'app', 'com', 'scr', 'pif', 'hta', 'wsf',
]);
function validateFileUpload(file) {
  const ext = String(file.name || '').split('.').pop().toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) throw new Error(`Tipo de arquivo não permitido: .${ext}`);
  const mime = String(file.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) throw new Error(`Tipo MIME não permitido: ${mime}`);
}

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function now() {
  return new Date().toISOString();
}

function safeText(value, max = 240) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max);
}

function safeFileName(value) {
  const fallback = 'documento';
  const text = safeText(value, 180)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '');
  return text || fallback;
}

function resolveBucket(env) {
  return [env.LIFEOS_R2, env.LIFEOS_FILES, env.R2_BUCKET]
    .find((candidate) => candidate && typeof candidate.get === 'function' && typeof candidate.put === 'function') || null;
}

function documentKey(userId, documentId, version, name) {
  return `documents/${encodeURIComponent(userId)}/${documentId}/v${version}/${safeFileName(name)}`;
}

function contentUrl(request, docId) {
  const url = new URL(request.url);
  return `${url.origin}/api/documents?view=content&docId=${encodeURIComponent(docId)}`;
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

async function auditLog(kv, userId, action, documentId, details = {}) {
  try {
    const key = `docs:audit:${userId}`;
    const log = await readJson(kv, key, []);
    log.unshift({
      id: generateId(), userId, action, documentId, details, timestamp: now(),
    });
    await writeJson(kv, key, log.slice(0, MAX_AUDIT));
  } catch { /* auditoria não deve bloquear a operação principal */ }
}

async function notify(kv, userId, title, message, type = 'document') {
  if (!userId) return;
  try {
    const key = `notifications:${userId}`;
    const records = await readJson(kv, key, []);
    records.unshift({
      id: `doc_${generateId()}`, type, title: safeText(title, 160), message: safeText(message, 500),
      read: false, createdAt: now(),
    });
    await writeJson(kv, key, records.slice(0, 200));
  } catch { /* notificação é complementar */ }
}

async function authenticate(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return { error: json(503, { ok: false, error: 'Serviço indisponível' }) };
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return { error: json(401, { ok: false, error: 'Não autenticado' }) };
  if (!env.LIFEOS_KV) return { error: json(503, { ok: false, error: 'Armazenamento de metadados indisponível' }) };
  return { session, kv: env.LIFEOS_KV, bucket: resolveBucket(env) };
}

async function getDocuments(kv, userId) {
  const docs = await readJson(kv, `docs:files:${userId}`, []);
  return Array.isArray(docs) ? docs : [];
}

async function saveDocuments(kv, userId, docs) {
  await writeJson(kv, `docs:files:${userId}`, docs);
}

function findDocument(docs, id) {
  return docs.find((document) => document.id === String(id || '')) || null;
}

function documentPayload(request, doc) {
  if (!doc) return null;
  return {
    ...doc,
    downloadUrl: doc.storageKey || doc.storageUrl ? contentUrl(request, doc.id) : null,
  };
}

async function parseInput(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return { type: 'form', form, action: safeText(form.get('action') || 'upload', 40) };
  }
  try {
    const body = await request.json();
    return { type: 'json', body: body && typeof body === 'object' ? body : {}, action: safeText(body?.action, 40) };
  } catch {
    throw new Error('JSON inválido');
  }
}

function requireDocument(docs, docId) {
  const document = findDocument(docs, docId);
  if (!document) throw new Error('Documento não encontrado');
  return document;
}

function assertEditable(document, session) {
  const userId = session.sub;
  if (document.permissions?.owner === userId) return;
  if (hasPermission(session, 'admin')) return;
  if ((document.permissions?.editors || []).includes(userId)) return;
  throw new Error('Sem permissão para alterar este documento');
}

function activeDocuments(docs) {
  return docs.filter((document) => !document.deleted);
}

async function appendVersion(kv, userId, docId, version) {
  const key = `docs:versions:${userId}:${docId}`;
  const versions = await readJson(kv, key, []);
  versions.unshift(version);
  await writeJson(kv, key, versions.slice(0, 50));
}

async function createDocumentFromFile({ request, kv, bucket, session, input }) {
  const form = input.form;
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function' || !safeText(file.name)) throw new Error('Selecione um arquivo válido');
  if (Number(file.size || 0) > MAX_FILE_SIZE) throw new Error('O arquivo excede o limite de 25 MB');
  validateFileUpload(file); // Hardening v46.0.0: validação de tipo MIME e extensão
  if (!bucket) throw new Error('Armazenamento R2 pronto para ativação. Configure o binding oficial de arquivos.');

  const docs = await getDocuments(kv, session.sub);
  const id = generateId();
  const name = safeFileName(file.name);
  const storageKey = documentKey(session.sub, id, 1, name);
  await bucket.put(storageKey, file.stream ? file.stream() : await file.arrayBuffer(), {
    httpMetadata: { contentType: safeText(file.type, 160) || 'application/octet-stream' },
    customMetadata: { ownerId: session.sub, documentId: id, version: '1', name },
  });

  const timestamp = now();
  const document = {
    id, name, size: Number(file.size || 0), mimeType: safeText(file.type, 160) || 'application/octet-stream',
    folderId: safeText(form.get('folderId') || 'root', 120) || 'root',
    tags: safeText(form.get('tags'), 500).split(',').map((tag) => safeText(tag, 40)).filter(Boolean).slice(0, 16),
    description: safeText(form.get('description'), 1000), storageKey, storageUrl: null, favorite: false, deleted: false,
    version: 1, permissions: { owner: session.sub, viewers: [], editors: [] }, createdAt: timestamp,
    updatedAt: timestamp, createdBy: session.sub, updatedBy: session.sub,
  };
  docs.unshift(document);
  await saveDocuments(kv, session.sub, docs);
  await appendVersion(kv, session.sub, id, {
    version: 1, storageKey, size: document.size, mimeType: document.mimeType,
    uploadedBy: session.sub, uploadedAt: timestamp, comment: 'Versão inicial',
  });
  await auditLog(kv, session.sub, 'upload', id, { name, size: document.size, storageKey });
  return json(201, { ok: true, document: documentPayload(request, document) });
}

async function createBlankDocument({ request, kv, bucket, session, body }) {
  const name = safeFileName(body.name);
  if (!name) throw new Error('Nome obrigatório');
  if (!bucket) throw new Error('Armazenamento R2 pronto para ativação. Configure o binding oficial de arquivos.');
  const docs = await getDocuments(kv, session.sub);
  const id = generateId();
  const mimeType = 'text/plain;charset=utf-8';
  const storageKey = documentKey(session.sub, id, 1, `${name}.txt`);
  const content = safeText(body.content || '', 200000);
  await bucket.put(storageKey, content, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { ownerId: session.sub, documentId: id, version: '1', name },
  });
  const timestamp = now();
  const document = {
    id, name, size: new TextEncoder().encode(content).byteLength, mimeType, folderId: safeText(body.folderId || 'root', 120) || 'root',
    tags: Array.isArray(body.tags) ? body.tags.map((tag) => safeText(tag, 40)).filter(Boolean).slice(0, 16) : [],
    description: safeText(body.description, 1000), storageKey, storageUrl: null, favorite: false, deleted: false,
    version: 1, permissions: { owner: session.sub, viewers: [], editors: [] }, createdAt: timestamp,
    updatedAt: timestamp, createdBy: session.sub, updatedBy: session.sub,
  };
  docs.unshift(document);
  await saveDocuments(kv, session.sub, docs);
  await appendVersion(kv, session.sub, id, { version: 1, storageKey, size: document.size, mimeType, uploadedBy: session.sub, uploadedAt: timestamp, comment: 'Documento criado' });
  await auditLog(kv, session.sub, 'create', id, { name, storageKey });
  return json(201, { ok: true, document: documentPayload(request, document) });
}

async function uploadNewVersion({ request, kv, bucket, session, input }) {
  const form = input.form;
  const docId = safeText(form.get('docId'), 80);
  const file = form.get('file');
  if (!docId) throw new Error('docId obrigatório');
  if (!file || typeof file.arrayBuffer !== 'function' || !safeText(file.name)) throw new Error('Selecione um arquivo válido');
  if (!bucket) throw new Error('Armazenamento R2 pronto para ativação. Configure o binding oficial de arquivos.');
  if (Number(file.size || 0) > MAX_FILE_SIZE) throw new Error('O arquivo excede o limite de 25 MB');
  validateFileUpload(file); // Hardening v46.0.0: validação de tipo MIME e extensão
  const docs = await getDocuments(kv, session.sub);
  const document = requireDocument(docs, docId);
  assertEditable(document, session);
  if (document.deleted) throw new Error('Restaure o documento antes de enviar uma nova versão');
  const version = Number(document.version || 0) + 1;
  const storageKey = documentKey(session.sub, document.id, version, safeFileName(file.name));
  await bucket.put(storageKey, file.stream ? file.stream() : await file.arrayBuffer(), {
    httpMetadata: { contentType: safeText(file.type, 160) || document.mimeType || 'application/octet-stream' },
    customMetadata: { ownerId: session.sub, documentId: document.id, version: String(version), name: safeFileName(file.name) },
  });
  document.version = version;
  document.size = Number(file.size || 0);
  document.mimeType = safeText(file.type, 160) || document.mimeType;
  document.storageKey = storageKey;
  document.storageUrl = null;
  document.updatedAt = now();
  document.updatedBy = session.sub;
  await saveDocuments(kv, session.sub, docs);
  await appendVersion(kv, session.sub, document.id, { version, storageKey, size: document.size, mimeType: document.mimeType, uploadedBy: session.sub, uploadedAt: document.updatedAt, comment: safeText(form.get('comment'), 500) || `Versão ${version}` });
  await auditLog(kv, session.sub, 'new-version', document.id, { version, storageKey });
  return json(200, { ok: true, document: documentPayload(request, document) });
}

export async function onRequestGet({ request, env }) {
  const context = await authenticate(request, env);
  if (context.error) return context.error;
  const { session, kv, bucket } = context;
  const url = new URL(request.url);
  const view = safeText(url.searchParams.get('view') || 'list', 40);
  const docs = await getDocuments(kv, session.sub);

  try {
    if (view === 'list') {
      const folderId = safeText(url.searchParams.get('folderId') || 'root', 120) || 'root';
      const documents = activeDocuments(docs).filter((document) => document.folderId === folderId).map((document) => documentPayload(request, document));
      return json(200, { ok: true, documents, total: documents.length });
    }
    if (view === 'all') {
      const documents = activeDocuments(docs).map((document) => documentPayload(request, document));
      return json(200, { ok: true, documents, total: documents.length });
    }
    if (view === 'search') {
      const query = safeText(url.searchParams.get('q'), 120).toLowerCase();
      if (!query) return json(400, { ok: false, error: 'Parâmetro q obrigatório' });
      const documents = activeDocuments(docs).filter((document) => [document.name, document.description, ...(document.tags || [])].join(' ').toLowerCase().includes(query)).map((document) => documentPayload(request, document));
      return json(200, { ok: true, documents, query });
    }
    if (view === 'favorites') {
      const documents = activeDocuments(docs).filter((document) => document.favorite).map((document) => documentPayload(request, document));
      return json(200, { ok: true, documents });
    }
    if (view === 'trash') {
      const documents = docs.filter((document) => document.deleted).map((document) => documentPayload(request, document));
      return json(200, { ok: true, documents, total: documents.length });
    }
    if (view === 'versions') {
      const docId = safeText(url.searchParams.get('docId'), 80);
      const document = requireDocument(docs, docId);
      const versions = await readJson(kv, `docs:versions:${session.sub}:${document.id}`, []);
      return json(200, { ok: true, document: documentPayload(request, document), versions: Array.isArray(versions) ? versions : [] });
    }
    if (view === 'history' || view === 'audit') {
      const docId = safeText(url.searchParams.get('docId'), 80);
      const audit = await readJson(kv, `docs:audit:${session.sub}`, []);
      const records = (Array.isArray(audit) ? audit : []).filter((record) => !docId || record.documentId === docId).slice(0, 100);
      return json(200, { ok: true, audit: records });
    }
    if (view === 'shared') {
      const shared = await readJson(kv, `docs:shared:${session.sub}`, []);
      return json(200, { ok: true, shared: Array.isArray(shared) ? shared : [] });
    }
    if (view === 'stats') {
      const active = activeDocuments(docs);
      const totalSize = active.reduce((sum, document) => sum + Number(document.size || 0), 0);
      const byType = active.reduce((types, document) => {
        const extension = safeFileName(document.name).split('.').pop().toLowerCase() || 'other';
        types[extension] = (types[extension] || 0) + 1;
        return types;
      }, {});
      return json(200, { ok: true, stats: { total: active.length, totalSize, favorites: active.filter((document) => document.favorite).length, trash: docs.filter((document) => document.deleted).length, byType, r2Bound: Boolean(bucket) } });
    }
    if (view === 'download') {
      const document = requireDocument(docs, safeText(url.searchParams.get('docId'), 80));
      if (document.deleted) return json(410, { ok: false, error: 'Documento está na lixeira' });
      if (!document.storageKey && !document.storageUrl) return json(503, { ok: false, error: 'Conteúdo do documento pronto para ativação' });
      return json(200, { ok: true, downloadUrl: contentUrl(request, document.id), name: document.name });
    }
    if (view === 'content') {
      const document = requireDocument(docs, safeText(url.searchParams.get('docId'), 80));
      if (document.deleted) return json(410, { ok: false, error: 'Documento está na lixeira' });
      if (!document.storageKey || !bucket) {
        if (document.storageUrl) return Response.redirect(document.storageUrl, 302);
        return json(503, { ok: false, error: 'Armazenamento R2 pronto para ativação' });
      }
      const object = await bucket.get(document.storageKey);
      if (!object) return json(404, { ok: false, error: 'Conteúdo do documento não encontrado no R2' });
      const headers = new Headers();
      headers.set('content-type', object.httpMetadata?.contentType || document.mimeType || 'application/octet-stream');
      headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`);
      headers.set('cache-control', 'private, no-store');
      if (object.size !== undefined) headers.set('content-length', String(object.size));
      return new Response(object.body, { status: 200, headers });
    }
    return json(400, { ok: false, error: 'View inválida' });
  } catch (error) {
    return json(500, { ok: false, error: error instanceof Error ? error.message : 'Erro ao carregar documentos' });
  }
}

export async function onRequestPost({ request, env }) {
  const context = await authenticate(request, env);
  if (context.error) return context.error;
  const { session, kv, bucket } = context;
  let input;
  try { input = await parseInput(request); } catch (error) { return json(400, { ok: false, error: error.message || 'Requisição inválida' }); }
  const body = input.body || {};
  const action = input.action || (input.type === 'form' ? 'upload' : '');

  try {
    if (input.type === 'form' && action === 'upload') return await createDocumentFromFile({ request, kv, bucket, session, input });
    if (input.type === 'form' && action === 'new-version') return await uploadNewVersion({ request, kv, bucket, session, input });
    if (action === 'create') return await createBlankDocument({ request, kv, bucket, session, body });

    const docs = await getDocuments(kv, session.sub);
    const document = requireDocument(docs, body.docId || body.id);
    assertEditable(document, session);

    if (action === 'rename') {
      const name = safeFileName(body.name);
      if (!name) throw new Error('Nome obrigatório');
      const previousName = document.name;
      document.name = name;
      document.updatedAt = now(); document.updatedBy = session.sub;
      await saveDocuments(kv, session.sub, docs);
      await auditLog(kv, session.sub, 'renamed', document.id, { from: previousName, to: name });
      return json(200, { ok: true, document: documentPayload(request, document) });
    }
    if (action === 'move') {
      const folderId = safeText(body.folderId, 120) || 'root';
      const previousFolderId = document.folderId || 'root';
      document.folderId = folderId;
      document.updatedAt = now(); document.updatedBy = session.sub;
      await saveDocuments(kv, session.sub, docs);
      await auditLog(kv, session.sub, 'moved', document.id, { from: previousFolderId, to: folderId });
      return json(200, { ok: true, document: documentPayload(request, document) });
    }
    if (action === 'copy') {
      const copy = { ...document, id: generateId(), name: `${document.name} (cópia)`, favorite: false, createdAt: now(), updatedAt: now(), createdBy: session.sub, updatedBy: session.sub, version: 1 };
      docs.unshift(copy);
      await saveDocuments(kv, session.sub, docs);
      await auditLog(kv, session.sub, 'copied', document.id, { newId: copy.id });
      return json(200, { ok: true, document: documentPayload(request, copy) });
    }
    if (action === 'toggle-favorite') {
      document.favorite = !document.favorite;
      document.updatedAt = now(); document.updatedBy = session.sub;
      await saveDocuments(kv, session.sub, docs);
      await auditLog(kv, session.sub, document.favorite ? 'favorited' : 'unfavorited', document.id, {});
      return json(200, { ok: true, favorite: document.favorite, document: documentPayload(request, document) });
    }
    if (action === 'share') {
      const targetUserId = safeText(body.targetUserId, 254);
      const permission = safeText(body.permission, 10);
      if (!targetUserId) throw new Error('Destinatário obrigatório');
      if (!['view', 'edit'].includes(permission)) throw new Error('Permissão deve ser view ou edit');
      if (targetUserId === session.sub) throw new Error('Não é necessário compartilhar o documento com o proprietário');
      const listName = permission === 'view' ? 'viewers' : 'editors';
      const opposite = permission === 'view' ? 'editors' : 'viewers';
      document.permissions[listName] = [...new Set([...(document.permissions[listName] || []), targetUserId])];
      document.permissions[opposite] = (document.permissions[opposite] || []).filter((item) => item !== targetUserId);
      document.updatedAt = now(); document.updatedBy = session.sub;
      const shared = await readJson(kv, `docs:shared:${targetUserId}`, []);
      const entry = { docId: document.id, ownerId: session.sub, permission, docName: document.name, sharedAt: document.updatedAt };
      const filtered = (Array.isArray(shared) ? shared : []).filter((item) => !(item.docId === document.id && item.ownerId === session.sub));
      filtered.unshift(entry);
      await Promise.all([saveDocuments(kv, session.sub, docs), writeJson(kv, `docs:shared:${targetUserId}`, filtered.slice(0, 200))]);
      await auditLog(kv, session.sub, 'shared', document.id, { targetUserId, permission });
      await notify(kv, targetUserId, 'Documento compartilhado', `${session.sub} compartilhou “${document.name}” com permissão de ${permission === 'edit' ? 'edição' : 'visualização'}.`);
      return json(200, { ok: true, shared: true, document: documentPayload(request, document) });
    }
    if (action === 'update-permissions') {
      if (document.permissions.owner !== session.sub && !hasPermission(session, 'admin')) throw new Error('Sem permissão para alterar permissões');
      const viewers = Array.isArray(body.viewers) ? body.viewers.map((item) => safeText(item, 254)).filter(Boolean) : document.permissions.viewers;
      const editors = Array.isArray(body.editors) ? body.editors.map((item) => safeText(item, 254)).filter(Boolean) : document.permissions.editors;
      document.permissions = { ...document.permissions, viewers: [...new Set(viewers)], editors: [...new Set(editors)] };
      document.updatedAt = now(); document.updatedBy = session.sub;
      await saveDocuments(kv, session.sub, docs);
      await auditLog(kv, session.sub, 'permissions-updated', document.id, { viewers: document.permissions.viewers, editors: document.permissions.editors });
      return json(200, { ok: true, permissions: document.permissions });
    }
    if (action === 'delete') {
      document.deleted = true; document.deletedAt = now(); document.updatedAt = document.deletedAt; document.updatedBy = session.sub;
      await saveDocuments(kv, session.sub, docs);
      await auditLog(kv, session.sub, 'deleted', document.id, { name: document.name });
      return json(200, { ok: true, deleted: document.id });
    }
    if (action === 'restore') {
      if (!document.deleted) throw new Error('O documento já está ativo');
      document.deleted = false; delete document.deletedAt; document.updatedAt = now(); document.updatedBy = session.sub;
      await saveDocuments(kv, session.sub, docs);
      await auditLog(kv, session.sub, 'restored', document.id, { name: document.name });
      return json(200, { ok: true, document: documentPayload(request, document) });
    }
    if (action === 'permanent-delete') {
      if (!document.deleted && !hasPermission(session, 'admin')) throw new Error('Mova o documento para a lixeira antes da exclusão definitiva');
      const versions = await readJson(kv, `docs:versions:${session.sub}:${document.id}`, []);
      if (bucket) {
        await Promise.all((Array.isArray(versions) ? versions : []).map((version) => version.storageKey ? bucket.delete(version.storageKey).catch(() => {}) : Promise.resolve()));
        if (document.storageKey) await bucket.delete(document.storageKey).catch(() => {});
      }
      const index = docs.findIndex((item) => item.id === document.id);
      docs.splice(index, 1);
      await Promise.all([saveDocuments(kv, session.sub, docs), kv.delete(`docs:versions:${session.sub}:${document.id}`)]);
      await auditLog(kv, session.sub, 'permanent-deleted', document.id, { name: document.name, r2Deleted: Boolean(bucket) });
      return json(200, { ok: true, deleted: document.id, permanent: true });
    }
    if (action === 'new-version') {
      // Compatibilidade com o contrato anterior baseado em URL externa.
      const version = Number(document.version || 0) + 1;
      document.version = version;
      document.size = Number(body.size || document.size || 0);
      document.storageUrl = safeText(body.storageUrl, 2000) || document.storageUrl || null;
      document.updatedAt = now(); document.updatedBy = session.sub;
      await saveDocuments(kv, session.sub, docs);
      await appendVersion(kv, session.sub, document.id, { version, storageUrl: document.storageUrl, size: document.size, uploadedBy: session.sub, uploadedAt: document.updatedAt, comment: safeText(body.comment, 500) || `Versão ${version}` });
      await auditLog(kv, session.sub, 'new-version', document.id, { version, legacyUrl: Boolean(document.storageUrl) });
      return json(200, { ok: true, document: documentPayload(request, document) });
    }
    return json(400, { ok: false, error: 'Ação inválida' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao processar documento';
    const status = /não encontrado/i.test(message) ? 404 : /permissão/i.test(message) ? 403 : /obrigatório|inválid|limite/i.test(message) ? 400 : /pronto para ativação/i.test(message) ? 503 : 500;
    return json(status, { ok: false, error: message });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
