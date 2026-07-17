// LifeOS Enterprise — Backup & Recovery API v1.0 (Phase 212)
// Cloudflare Pages Function: GET/POST /api/backup
// Enterprise Backup: automated backup, data export, secure restore, version history,
// soft-delete protection, recovery strategy
// ZERO mock data — all data from Cloudflare KV
import { getCookie, json, verifySession, hasPermission } from '../_auth.js';

const BACKUP_VERSION = '1.0';
const MAX_BACKUPS = 30; // Keep last 30 backups per user
const BACKUP_TTL = 90 * 24 * 3600; // 90 days in seconds

// Keys that hold user data to back up
const USER_DATA_KEYS = [
  'profile', 'settings', 'workspaces', 'tasks', 'habits', 'goals',
  'notes', 'projects', 'timeline', 'notifications', 'onboarding',
];

async function getUserDataSnapshot(kv, userId) {
  if (!kv || !userId) return {};
  const snapshot = {};
  await Promise.all(
    USER_DATA_KEYS.map(async (key) => {
      try {
        const raw = await kv.get(`user:${userId}:${key}`);
        if (raw) snapshot[key] = JSON.parse(raw);
      } catch (_) {}
    })
  );
  return snapshot;
}

async function listBackups(kv, userId) {
  if (!kv || !userId) return [];
  try {
    const raw = await kv.get(`backup:index:${userId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

async function createBackup(kv, userId, triggeredBy = 'manual') {
  if (!kv || !userId) return null;

  const backupId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const snapshot = await getUserDataSnapshot(kv, userId);

  const backup = {
    id: backupId,
    userId,
    version: BACKUP_VERSION,
    triggeredBy,
    createdAt,
    dataKeys: Object.keys(snapshot),
    size: JSON.stringify(snapshot).length,
    checksum: await computeChecksum(JSON.stringify(snapshot)),
    status: 'complete',
  };

  // Store backup data
  await kv.put(`backup:data:${userId}:${backupId}`, JSON.stringify(snapshot), {
    expirationTtl: BACKUP_TTL,
  });

  // Update backup index
  const index = await listBackups(kv, userId);
  index.push({ id: backupId, createdAt, triggeredBy, size: backup.size, status: 'complete' });
  // Keep only last MAX_BACKUPS
  const trimmed = index.slice(-MAX_BACKUPS);
  await kv.put(`backup:index:${userId}`, JSON.stringify(trimmed));

  return backup;
}

async function restoreBackup(kv, userId, backupId) {
  if (!kv || !userId || !backupId) return { ok: false, error: 'Parâmetros inválidos' };

  const raw = await kv.get(`backup:data:${userId}:${backupId}`);
  if (!raw) return { ok: false, error: 'Backup não encontrado ou expirado' };

  let snapshot;
  try { snapshot = JSON.parse(raw); } catch (_) { return { ok: false, error: 'Backup corrompido' }; }

  // Create a pre-restore backup first (safety net)
  await createBackup(kv, userId, 'pre-restore');

  // Restore each key
  const restored = [];
  await Promise.all(
    Object.entries(snapshot).map(async ([key, value]) => {
      try {
        await kv.put(`user:${userId}:${key}`, JSON.stringify(value));
        restored.push(key);
      } catch (_) {}
    })
  );

  return { ok: true, restoredKeys: restored, backupId, restoredAt: new Date().toISOString() };
}

async function exportUserData(kv, userId, format = 'json') {
  if (!kv || !userId) return null;
  const snapshot = await getUserDataSnapshot(kv, userId);
  if (format === 'json') {
    return {
      contentType: 'application/json',
      data: JSON.stringify({
        exportedAt: new Date().toISOString(),
        userId,
        version: BACKUP_VERSION,
        data: snapshot,
      }, null, 2),
    };
  }
  return null;
}

async function computeChecksum(data) {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// Soft delete: mark item as deleted but keep it for 30 days
async function softDelete(kv, userId, resourceType, resourceId) {
  if (!kv || !userId) return { ok: false, error: 'Parâmetros inválidos' };
  try {
    const trashKey = `trash:${userId}:${resourceType}:${resourceId}`;
    const dataKey = `user:${userId}:${resourceType}:${resourceId}`;
    const raw = await kv.get(dataKey);
    if (!raw) return { ok: false, error: 'Recurso não encontrado' };
    // Move to trash with 30-day expiry
    await kv.put(trashKey, raw, { expirationTtl: 30 * 24 * 3600 });
    await kv.delete(dataKey);
    return { ok: true, trashedAt: new Date().toISOString(), expiresIn: '30 days', resourceId };
  } catch (e) {
    return { ok: false, error: 'Falha ao mover para lixeira' };
  }
}

async function restoreFromTrash(kv, userId, resourceType, resourceId) {
  if (!kv || !userId) return { ok: false, error: 'Parâmetros inválidos' };
  try {
    const trashKey = `trash:${userId}:${resourceType}:${resourceId}`;
    const dataKey = `user:${userId}:${resourceType}:${resourceId}`;
    const raw = await kv.get(trashKey);
    if (!raw) return { ok: false, error: 'Item não encontrado na lixeira ou já expirado' };
    await kv.put(dataKey, raw);
    await kv.delete(trashKey);
    return { ok: true, restoredAt: new Date().toISOString(), resourceId };
  } catch (_) {
    return { ok: false, error: 'Falha ao restaurar da lixeira' };
  }
}

export async function onRequest({ request, env }) {
  const kv = env?.LIFEOS_KV || null;
  const url = new URL(request.url);
  const cookieHeader = request.headers.get('cookie') || '';
  const token = getCookie(cookieHeader, 'lifeos_session');
  const session = token ? await verifySession(token, kv) : null;

  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const action = url.searchParams.get('action') || 'list';

  // GET: list backups, export data
  if (request.method === 'GET') {
    if (action === 'list') {
      const backups = await listBackups(kv, session.userId);
      return json(200, { ok: true, backups, count: backups.length, maxBackups: MAX_BACKUPS });
    }

    if (action === 'export') {
      const format = url.searchParams.get('format') || 'json';
      const result = await exportUserData(kv, session.userId, format);
      if (!result) return json(400, { ok: false, error: 'Formato não suportado. Use: json' });
      return new Response(result.data, {
        status: 200,
        headers: {
          'content-type': result.contentType,
          'content-disposition': `attachment; filename="lifeos-export-${session.userId}-${new Date().toISOString().split('T')[0]}.json"`,
          'cache-control': 'no-store',
        },
      });
    }

    return json(400, { ok: false, error: 'action inválido. Use: list, export' });
  }

  // POST: create backup, restore, soft-delete, restore from trash
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (_) { return json(400, { ok: false, error: 'JSON inválido' }); }

    const { action: postAction, backupId, resourceType, resourceId } = body;

    if (postAction === 'create') {
      const backup = await createBackup(kv, session.userId, 'manual');
      if (!backup) return json(500, { ok: false, error: 'Falha ao criar backup' });
      return json(201, { ok: true, backup });
    }

    if (postAction === 'restore') {
      if (!backupId) return json(400, { ok: false, error: 'backupId obrigatório' });
      const result = await restoreBackup(kv, session.userId, backupId);
      return json(result.ok ? 200 : 400, result);
    }

    if (postAction === 'soft-delete') {
      if (!resourceType || !resourceId) return json(400, { ok: false, error: 'resourceType e resourceId obrigatórios' });
      const result = await softDelete(kv, session.userId, resourceType, resourceId);
      return json(result.ok ? 200 : 400, result);
    }

    if (postAction === 'restore-trash') {
      if (!resourceType || !resourceId) return json(400, { ok: false, error: 'resourceType e resourceId obrigatórios' });
      const result = await restoreFromTrash(kv, session.userId, resourceType, resourceId);
      return json(result.ok ? 200 : 400, result);
    }

    return json(400, { ok: false, error: 'action inválido. Use: create, restore, soft-delete, restore-trash' });
  }

  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
