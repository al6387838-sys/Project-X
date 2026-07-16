// LifeOS Enterprise — Tasks API v1.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/tasks
// Phase 139 — Real Backend Completion
import { getCookie, json, verifySession } from '../_auth.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, tasks: [], source: 'empty' });

  try {
    const raw = await kv.get(`tasks:${session.sub}`);
    const tasks = raw ? JSON.parse(raw) : [];

    // Filtros via query params
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const date = url.searchParams.get('date');
    const priority = url.searchParams.get('priority');

    let filtered = tasks;
    if (status) filtered = filtered.filter(t => t.status === status);
    if (date) filtered = filtered.filter(t => t.dueDate === date);
    if (priority) filtered = filtered.filter(t => t.priority === priority);

    return json(200, { ok: true, tasks: filtered, total: tasks.length });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar tarefas' });
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

  const { title, description, dueDate, priority, tags, workspaceId } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }

  const task = {
    id: generateId(),
    title: title.trim(),
    description: description?.trim() || '',
    dueDate: dueDate || null,
    priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
    status: 'todo',
    tags: Array.isArray(tags) ? tags : [],
    workspaceId: workspaceId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: session.sub,
  };

  try {
    const raw = await kv.get(`tasks:${session.sub}`);
    const tasks = raw ? JSON.parse(raw) : [];
    tasks.unshift(task);
    await kv.put(`tasks:${session.sub}`, JSON.stringify(tasks));
    return json(201, { ok: true, task });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao salvar tarefa' });
  }
}

export async function onRequestPut({ request, env }) {
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

  const { id, ...updates } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const raw = await kv.get(`tasks:${session.sub}`);
    const tasks = raw ? JSON.parse(raw) : [];
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });

    // Campos permitidos para atualização
    const allowed = ['title', 'description', 'dueDate', 'priority', 'status', 'tags', 'workspaceId'];
    for (const key of allowed) {
      if (key in updates) tasks[idx][key] = updates[key];
    }
    tasks[idx].updatedAt = new Date().toISOString();

    await kv.put(`tasks:${session.sub}`, JSON.stringify(tasks));
    return json(200, { ok: true, task: tasks[idx] });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao atualizar tarefa' });
  }
}

export async function onRequestDelete({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const raw = await kv.get(`tasks:${session.sub}`);
    const tasks = raw ? JSON.parse(raw) : [];
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length === tasks.length) return json(404, { ok: false, error: 'Tarefa não encontrada' });

    await kv.put(`tasks:${session.sub}`, JSON.stringify(filtered));
    return json(200, { ok: true, deleted: id });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao excluir tarefa' });
  }
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    case 'PUT': return onRequestPut(ctx);
    case 'DELETE': return onRequestDelete(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST, PUT, DELETE' });
  }
}
