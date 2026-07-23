// LifeOS Enterprise — Universal Persistence API v1.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/persistence
// Fase 731 — Persistência Real Absoluta
// Elimina localStorage/sessionStorage para dados de usuário.
// Todos os dados são persistidos em Cloudflare KV.
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_KEY_LENGTH = 120;
const MAX_VALUE_SIZE = 256000; // 256 KB per key (KV limit is 25 MB, but we're generous)
const ALLOWED_NAMESPACES = new Set([
  'prefs',        // User preferences (theme, font, sound, motion)
  'onboarding',   // Onboarding state
  'layout',       // Dashboard layout (order, hidden widgets)
  'calendar',     // Calendar visibility toggles
  'search',       // Recent searches
  'integrations', // Integration token data
  'state',        // General app state
  'ui',           // UI preferences (command palette theme)
]);

function sanitizeInput(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .slice(0, MAX_VALUE_SIZE);
}

function safeKey(key) {
  return String(key || '').trim().replace(/[^\w\-\.\/]/g, '-').slice(0, MAX_KEY_LENGTH);
}

function safeNamespace(ns) {
  return ALLOWED_NAMESPACES.has(ns) ? ns : 'prefs';
}

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function now() {
  return new Date().toISOString();
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

// GET /api/persistence?ns={namespace}&key={key}
// GET /api/persistence?ns={namespace}  (list all keys in namespace)
// GET /api/persistence?keys={key1,key2,key3} (batch read)
export async function onRequestGet({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const url = new URL(request.url);
    const ns = safeNamespace(url.searchParams.get('ns') || 'prefs');
    const key = url.searchParams.get('key');
    const keys = url.searchParams.get('keys');
    const listAll = url.searchParams.has('list');
    const prefix = `persist:${session.sub}:${ns}:`;

    // Batch read
    if (keys) {
      const requestedKeys = keys.split(',').map(k => safeKey(k)).filter(Boolean);
      const results = {};
      for (const k of requestedKeys) {
        const data = await readJson(kv, prefix + k, null);
        results[k] = data;
      }
      return json(200, { ok: true, data: results, namespace: ns });
    }

    // List all keys in namespace
    if (listAll) {
      const kvList = await kv.list({ prefix });
      const entries = [];
      for (const item of kvList.keys) {
        const shortKey = item.name.replace(prefix, '');
        const value = await kv.get(item.name);
        try { entries.push({ key: shortKey, value: JSON.parse(value) }); } catch { entries.push({ key: shortKey, value: null }); }
      }
      return json(200, { ok: true, namespace: ns, entries, total: entries.length });
    }

    // Single key read
    if (key) {
      const safe = safeKey(key);
      const data = await readJson(kv, prefix + safe, null);
      return json(200, { ok: true, namespace: ns, key: safe, value: data });
    }

    // Return all namespaces metadata
    const namespaces = {};
    for (const nsItem of ALLOWED_NAMESPACES) {
      const nsPrefix = `persist:${session.sub}:${nsItem}:`;
      try {
        const kvList = await kv.list({ prefix: nsPrefix });
        namespaces[nsItem] = kvList.keys.length;
      } catch { namespaces[nsItem] = 0; }
    }
    return json(200, { ok: true, namespaces, userId: session.sub });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao ler persistência' });
  }
}

// POST /api/persistence
// Body: { action: 'save' | 'delete' | 'migrate', ns, key, value }
export async function onRequestPost({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const body = await request.json();
    const action = safeKey(body?.action || '');
    const ns = safeNamespace(body?.ns || 'prefs');
    const key = safeKey(body?.key || '');
    const prefix = `persist:${session.sub}:${ns}:`;

    if (action === 'save') {
      if (!key) return json(400, { ok: false, error: 'Chave obrigatória' });
      const value = body?.value;
      if (value === undefined) return json(400, { ok: false, error: 'Valor obrigatório' });
      await writeJson(kv, prefix + key, value);
      return json(200, { ok: true, saved: true, namespace: ns, key, timestamp: now() });
    }

    if (action === 'delete') {
      if (!key) return json(400, { ok: false, error: 'Chave obrigatória' });
      await kv.delete(prefix + key);
      return json(200, { ok: true, deleted: true, namespace: ns, key });
    }

    if (action === 'migrate') {
      // Migrate all data from a batch of key-value pairs
      // Body: { ns, items: [{key, value}, ...] }
      const items = Array.isArray(body?.items) ? body.items : [];
      let saved = 0;
      for (const item of items) {
        const itemKey = safeKey(item?.key);
        if (!itemKey) continue;
        await writeJson(kv, prefix + itemKey, item.value);
        saved++;
      }
      return json(200, { ok: true, migrated: saved, namespace: ns, timestamp: now() });
    }

    if (action === 'migrate-local-storage') {
      // Special action: frontend sends all localStorage data to migrate
      // Body: { items: [{ns, key, value}, ...] }
      const items = Array.isArray(body?.items) ? body.items : [];
      let saved = 0;
      let errors = 0;
      for (const item of items) {
        const itemNs = safeNamespace(item?.ns);
        const itemKey = safeKey(item?.key);
        if (!itemKey) { errors++; continue; }
        const itemPrefix = `persist:${session.sub}:${itemNs}:`;
        try {
          await writeJson(kv, itemPrefix + itemKey, item.value);
          saved++;
        } catch { errors++; }
      }
      return json(200, { ok: true, migrated: saved, errors, timestamp: now() });
    }

    if (action === 'bulk-read') {
      // Body: { reads: [{ns, key}, ...] }
      const reads = Array.isArray(body?.reads) ? body.reads : [];
      const results = {};
      for (const read of reads) {
        const readNs = safeNamespace(read?.ns);
        const readKey = safeKey(read?.key);
        const readPrefix = `persist:${session.sub}:${readNs}:`;
        results[`${readNs}:${readKey}`] = await readJson(kv, readPrefix + readKey, null);
      }
      return json(200, { ok: true, data: results });
    }

    if (action === 'bulk-save') {
      // Body: { writes: [{ns, key, value}, ...] }
      const writes = Array.isArray(body?.writes) ? body.writes : [];
      let saved = 0;
      for (const write of writes) {
        const writeNs = safeNamespace(write?.ns);
        const writeKey = safeKey(write?.key);
        const writePrefix = `persist:${session.sub}:${writeNs}:`;
        await writeJson(kv, writePrefix + writeKey, write.value);
        saved++;
      }
      return json(200, { ok: true, saved, timestamp: now() });
    }

    return json(400, { ok: false, error: 'Ação inválida. Use: save, delete, migrate, migrate-local-storage, bulk-read, bulk-save' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar persistência';
    return json(400, { ok: false, error: message });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
