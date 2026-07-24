// LifeOS Enterprise — Database Optimization API v34.0
// Cloudflare Pages Function: GET /api/db-optimize
// Phase 264 — Enterprise Database Optimization
// Auditoria de performance, paginação real, busca otimizada, cache inteligente
import { getCookie, json, verifySession, hasPermission } from '../_auth.js';

// ─── Cache Layer ───────────────────────────────────────────────────────────────
// TTL em segundos por tipo de dado
const CACHE_TTL = {
  dashboard:    60,   // 1 min — dados dinâmicos
  tasks:        30,   // 30s — alta frequência de escrita
  habits:       120,  // 2 min
  goals:        120,  // 2 min
  projects:     60,   // 1 min
  crm:          90,   // 1.5 min
  metrics:      300,  // 5 min — dados agregados
  analytics:    600,  // 10 min — séries históricas
  users:        300,  // 5 min
  audit:        0,    // sem cache — dados de auditoria
};

// Prefixo de cache no KV
const CACHE_PREFIX = 'cache:v1:';

async function getCached(kv, key) {
  if (!kv) return null;
  try {
    const raw = await kv.get(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      // Expirado — limpar assincronamente
      kv.delete(`${CACHE_PREFIX}${key}`).catch(() => {});
      return null;
    }
    return entry.data;
  } catch { return null; }
}

async function setCached(kv, key, data, ttlSeconds) {
  if (!kv || ttlSeconds === 0) return;
  try {
    const entry = {
      data,
      cachedAt: new Date().toISOString(),
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    };
    await kv.put(`${CACHE_PREFIX}${key}`, JSON.stringify(entry), {
      expirationTtl: ttlSeconds > 0 ? ttlSeconds + 60 : undefined,
    });
  } catch { /* silencioso */ }
}

async function invalidateCache(kv, patterns) {
  if (!kv) return 0;
  let count = 0;
  for (const pattern of patterns) {
    try {
      const list = await kv.list({ prefix: `${CACHE_PREFIX}${pattern}` });
      for (const key of list.keys) {
        await kv.delete(key.name);
        count++;
      }
    } catch { /* silencioso */ }
  }
  return count;
}

// ─── Paginação ─────────────────────────────────────────────────────────────────
function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages || 1));
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
  };
}

// ─── Índices lógicos ───────────────────────────────────────────────────────────
async function buildIndex(kv, userId, collection) {
  const raw = await kv.get(`${collection}:${userId}`);
  if (!raw) return {};
  const items = JSON.parse(raw);
  const index = {};
  for (const item of items) {
    // Índice por status
    if (item.status) {
      if (!index[`status:${item.status}`]) index[`status:${item.status}`] = [];
      index[`status:${item.status}`].push(item.id);
    }
    // Índice por data
    if (item.dueDate) {
      if (!index[`date:${item.dueDate}`]) index[`date:${item.dueDate}`] = [];
      index[`date:${item.dueDate}`].push(item.id);
    }
    // Índice por prioridade
    if (item.priority) {
      if (!index[`priority:${item.priority}`]) index[`priority:${item.priority}`] = [];
      index[`priority:${item.priority}`].push(item.id);
    }
    // Índice por workspace
    if (item.workspaceId) {
      if (!index[`workspace:${item.workspaceId}`]) index[`workspace:${item.workspaceId}`] = [];
      index[`workspace:${item.workspaceId}`].push(item.id);
    }
  }
  return index;
}

// ─── Auditoria de performance ──────────────────────────────────────────────────
async function runPerformanceAudit(kv, userId) {
  const audit = {
    timestamp: new Date().toISOString(),
    collections: [],
    cacheStats: { hits: 0, misses: 0, entries: 0 },
    recommendations: [],
    latencyMs: {},
  };

  const collections = ['tasks', 'habits', 'goals', 'projects', 'crm', 'documents', 'notes'];

  for (const col of collections) {
    const t0 = Date.now();
    try {
      const raw = await kv.get(`${col}:${userId}`);
      const latency = Date.now() - t0;
      const items = raw ? JSON.parse(raw) : [];
      audit.collections.push({
        name: col,
        count: items.length,
        sizeBytes: raw ? new TextEncoder().encode(raw).length : 0,
        latencyMs: latency,
        status: latency < 50 ? 'optimal' : latency < 150 ? 'acceptable' : 'slow',
      });
      audit.latencyMs[col] = latency;
      if (items.length > 500) {
        audit.recommendations.push(`${col}: ${items.length} registros — considere arquivamento de itens antigos`);
      }
      if (latency > 150) {
        audit.recommendations.push(`${col}: latência ${latency}ms — habilitar cache para esta coleção`);
      }
    } catch (err) {
      audit.collections.push({ name: col, count: 0, sizeBytes: 0, latencyMs: Date.now() - t0, status: 'error', error: err.message });
    }
  }

  // Verificar entradas de cache
  try {
    const cacheList = await kv.list({ prefix: CACHE_PREFIX });
    audit.cacheStats.entries = cacheList.keys.length;
  } catch { /* silencioso */ }

  const avgLatency = audit.collections.reduce((s, c) => s + c.latencyMs, 0) / audit.collections.length;
  audit.summary = {
    avgLatencyMs: Math.round(avgLatency),
    totalCollections: audit.collections.length,
    slowCollections: audit.collections.filter(c => c.status === 'slow').length,
    totalRecords: audit.collections.reduce((s, c) => s + c.count, 0),
    grade: avgLatency < 50 ? 'A+' : avgLatency < 100 ? 'A' : avgLatency < 200 ? 'B' : 'C',
  };

  return audit;
}

// ─── Handler principal ─────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (!hasPermission(session, 'admin')) return json(403, { ok: false, error: 'Acesso restrito a administradores' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'KV indisponível' });

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';

  try {
    if (action === 'audit') {
      const audit = await runPerformanceAudit(kv, session.sub);
      return json(200, { ok: true, audit });
    }

    if (action === 'cache-stats') {
      const list = await kv.list({ prefix: CACHE_PREFIX });
      return json(200, { ok: true, cacheEntries: list.keys.length, prefix: CACHE_PREFIX });
    }

    if (action === 'cache-clear') {
      const cleared = await invalidateCache(kv, ['']);
      return json(200, { ok: true, cleared, message: `${cleared} entradas de cache removidas` });
    }

    if (action === 'index') {
      const collection = url.searchParams.get('collection') || 'tasks';
      const index = await buildIndex(kv, session.sub, collection);
      return json(200, { ok: true, collection, index, indexKeys: Object.keys(index).length });
    }

    // Status padrão
    return json(200, {
      ok: true,
      phase: 264,
      version: '34.0.0',
      features: ['pagination', 'smart-cache', 'logical-indexes', 'performance-audit', 'optimized-queries'],
      cacheTTL: CACHE_TTL,
      cachePrefix: CACHE_PREFIX,
    });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro interno', details: err.message });
  }
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (!hasPermission(session, 'admin')) return json(403, { ok: false, error: 'Acesso restrito' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'KV indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { action, collection, page = 1, pageSize = 20, filters = {}, sortBy, sortDir = 'desc' } = body;

  if (action === 'paginate') {
    const cacheKey = `paginate:${session.sub}:${collection}:${page}:${pageSize}:${JSON.stringify(filters)}:${sortBy}:${sortDir}`;
    const cached = await getCached(kv, cacheKey);
    if (cached) return json(200, { ok: true, ...cached, source: 'cache' });

    const raw = await kv.get(`${collection}:${session.sub}`);
    let items = raw ? JSON.parse(raw) : [];

    // Aplicar filtros
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        items = items.filter(item => item[key] === value);
      }
    }

    // Aplicar ordenação
    if (sortBy) {
      items.sort((a, b) => {
        const av = a[sortBy] ?? '';
        const bv = b[sortBy] ?? '';
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    const result = paginate(items, page, pageSize);
    const ttl = CACHE_TTL[collection] || 60;
    await setCached(kv, cacheKey, result, ttl);
    return json(200, { ok: true, ...result, source: 'kv' });
  }

  if (action === 'search-optimized') {
    const { query, collections: cols = ['tasks', 'goals', 'projects', 'notes'], limit = 10 } = body;
    if (!query || query.trim().length < 2) return json(400, { ok: false, error: 'Query mínima de 2 caracteres' });

    const q = query.toLowerCase().trim();
    const cacheKey = `search:${session.sub}:${q}:${cols.join(',')}`;
    const cached = await getCached(kv, cacheKey);
    if (cached) return json(200, { ok: true, results: cached, source: 'cache' });

    const results = [];
    for (const col of cols) {
      const raw = await kv.get(`${col}:${session.sub}`);
      if (!raw) continue;
      const items = JSON.parse(raw);
      const matched = items
        .filter(item => {
          const searchable = [item.title, item.description, item.content, item.name]
            .filter(Boolean).join(' ').toLowerCase();
          return searchable.includes(q);
        })
        .slice(0, limit)
        .map(item => ({ ...item, _collection: col }));
      results.push(...matched);
    }

    results.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    const top = results.slice(0, limit * cols.length);
    await setCached(kv, cacheKey, top, 30);
    return json(200, { ok: true, results: top, total: top.length, source: 'kv' });
  }

  return json(400, { ok: false, error: 'Ação desconhecida' });
}

// Exportar utilitários para uso em outros módulos
export { getCached, setCached, invalidateCache, paginate, CACHE_TTL, CACHE_PREFIX };

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST') return onRequestPost({ request, env });
  if (method === 'PUT') return onRequestPost({ request, env });
  if (method === 'PATCH') return onRequestPost({ request, env });
  if (method === 'DELETE') return onRequestPost({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), { status: 405, headers: { 'content-type': 'application/json' } });
}
