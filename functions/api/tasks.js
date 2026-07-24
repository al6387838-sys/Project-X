// LifeOS Enterprise — Tasks API v3.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/tasks
// Phase 3 Certification — Full CRUD, subtasks, recurrence, assignees, attachments, comments, history
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_COMMENT_LENGTH = 2000;
const MAX_TASKS_PER_USER = 2000;

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function sanitize(value, maxLen = 2000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim()
    .slice(0, maxLen);
}

function normalizeStatus(s) {
  const valid = ['todo', 'progress', 'review', 'done', 'backlog', 'cancelled'];
  return valid.includes(s) ? s : 'todo';
}

function normalizePriority(p) {
  const valid = ['low', 'medium', 'high', 'urgent'];
  return valid.includes(p) ? p : 'medium';
}

function normalizeRecurrence(r) {
  if (!r || typeof r !== 'object') return null;
  const valid = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
  if (!valid.includes(r.frequency)) return null;
  return {
    frequency: r.frequency,
    interval: Math.max(1, parseInt(r.interval) || 1),
    endDate: r.endDate || null,
    daysOfWeek: Array.isArray(r.daysOfWeek) ? r.daysOfWeek.filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : [],
  };
}

function buildTask(body, userId) {
  const titleVal = sanitize(String(body.title || ''), MAX_TITLE_LENGTH);
  if (!titleVal) throw new Error('Título obrigatório');
  return {
    id: generateId(),
    title: titleVal,
    description: sanitize(String(body.description || ''), MAX_DESCRIPTION_LENGTH),
    status: normalizeStatus(body.status),
    priority: normalizePriority(body.priority),
    dueDate: body.dueDate || null,
    startDate: body.startDate || null,
    endDate: body.endDate || body.dueDate || null,
    tags: Array.isArray(body.tags) ? body.tags.map(t => sanitize(String(t), 50)).filter(Boolean).slice(0, 20) : [],
    assignees: Array.isArray(body.assignees) ? body.assignees.map(a => sanitize(String(a), 100)).filter(Boolean).slice(0, 20) : [],
    subtasks: [],
    comments: [],
    attachments: [],
    history: [],
    recurrence: normalizeRecurrence(body.recurrence),
    projectId: body.projectId ? sanitize(String(body.projectId), 50) : null,
    workspaceId: body.workspaceId ? sanitize(String(body.workspaceId), 50) : null,
    dependencies: Array.isArray(body.dependencies) ? body.dependencies.filter(d => typeof d === 'string').slice(0, 10) : [],
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
  };
}

function addHistory(task, actor, action, detail) {
  if (!Array.isArray(task.history)) task.history = [];
  task.history.unshift({
    id: generateId(),
    actor,
    action,
    detail,
    createdAt: new Date().toISOString(),
  });
  if (task.history.length > 100) task.history = task.history.slice(0, 100);
}

async function getTasks(kv, userId) {
  const raw = await kv.get(`tasks:${userId}`);
  return raw ? JSON.parse(raw) : [];
}

async function saveTasks(kv, userId, tasks) {
  await kv.put(`tasks:${userId}`, JSON.stringify(tasks));
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, tasks: [], total: 0 });

  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('id');
    const tasks = await getTasks(kv, session.sub);

    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return json(404, { ok: false, error: 'Tarefa não encontrada' });
      return json(200, { ok: true, task });
    }

    let filtered = [...tasks];
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const tag = url.searchParams.get('tag');
    const assignee = url.searchParams.get('assignee');
    const projectId = url.searchParams.get('projectId');
    const dueBefore = url.searchParams.get('dueBefore');
    const dueAfter = url.searchParams.get('dueAfter');
    const q = url.searchParams.get('q');
    const sort = url.searchParams.get('sort') || 'createdAt';
    const order = url.searchParams.get('order') || 'desc';

    if (status) filtered = filtered.filter(t => t.status === status);
    if (priority) filtered = filtered.filter(t => t.priority === priority);
    if (tag) filtered = filtered.filter(t => Array.isArray(t.tags) && t.tags.includes(tag));
    if (assignee) filtered = filtered.filter(t => Array.isArray(t.assignees) && t.assignees.includes(assignee));
    if (projectId) filtered = filtered.filter(t => t.projectId === projectId);
    if (dueBefore) filtered = filtered.filter(t => t.dueDate && t.dueDate <= dueBefore);
    if (dueAfter) filtered = filtered.filter(t => t.dueDate && t.dueDate >= dueAfter);
    if (q) {
      const lq = q.toLowerCase();
      filtered = filtered.filter(t =>
        (t.title || '').toLowerCase().includes(lq) ||
        (t.description || '').toLowerCase().includes(lq) ||
        (t.tags || []).some(tg => tg.toLowerCase().includes(lq))
      );
    }

    const sortable = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title', 'status'];
    const sortField = sortable.includes(sort) ? sort : 'createdAt';
    filtered.sort((a, b) => {
      const av = a[sortField] || '';
      const bv = b[sortField] || '';
      if (sortField === 'priority') {
        const w = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (w[bv] || 0) - (w[av] || 0);
      }
      return order === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const page = filtered.slice(offset, offset + limit);

    return json(200, { ok: true, tasks: page, total: filtered.length, offset, limit });
  } catch {
    return json(500, { ok: false, error: 'Erro ao carregar tarefas' });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const tasks = await getTasks(kv, session.sub);

  if (body.action === 'add-subtask') {
    const { taskId, title } = body;
    if (!taskId) return json(400, { ok: false, error: 'taskId obrigatório' });
    const titleVal = sanitize(String(title || ''), MAX_TITLE_LENGTH);
    if (!titleVal) return json(400, { ok: false, error: 'Título da subtarefa obrigatório' });
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });
    if (!Array.isArray(tasks[idx].subtasks)) tasks[idx].subtasks = [];
    const subtask = { id: generateId(), title: titleVal, done: false, createdAt: new Date().toISOString() };
    tasks[idx].subtasks.push(subtask);
    tasks[idx].updatedAt = new Date().toISOString();
    addHistory(tasks[idx], session.sub, 'subtask.add', `Subtarefa adicionada: "${titleVal}"`);
    await saveTasks(kv, session.sub, tasks);
    return json(201, { ok: true, subtask, taskId });
  }

  if (body.action === 'toggle-subtask') {
    const { taskId, subtaskId } = body;
    if (!taskId || !subtaskId) return json(400, { ok: false, error: 'taskId e subtaskId obrigatórios' });
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });
    const si = (tasks[idx].subtasks || []).findIndex(s => s.id === subtaskId);
    if (si === -1) return json(404, { ok: false, error: 'Subtarefa não encontrada' });
    tasks[idx].subtasks[si].done = !tasks[idx].subtasks[si].done;
    tasks[idx].updatedAt = new Date().toISOString();
    addHistory(tasks[idx], session.sub, 'subtask.toggle', `Subtarefa "${tasks[idx].subtasks[si].title}" ${tasks[idx].subtasks[si].done ? 'concluída' : 'reaberta'}`);
    await saveTasks(kv, session.sub, tasks);
    return json(200, { ok: true, subtask: tasks[idx].subtasks[si], taskId });
  }

  if (body.action === 'delete-subtask') {
    const { taskId, subtaskId } = body;
    if (!taskId || !subtaskId) return json(400, { ok: false, error: 'taskId e subtaskId obrigatórios' });
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });
    tasks[idx].subtasks = (tasks[idx].subtasks || []).filter(s => s.id !== subtaskId);
    tasks[idx].updatedAt = new Date().toISOString();
    await saveTasks(kv, session.sub, tasks);
    return json(200, { ok: true, deleted: subtaskId, taskId });
  }

  if (body.action === 'add-comment') {
    const { taskId, text } = body;
    if (!taskId) return json(400, { ok: false, error: 'taskId obrigatório' });
    const textVal = sanitize(String(text || ''), MAX_COMMENT_LENGTH);
    if (!textVal) return json(400, { ok: false, error: 'Texto do comentário obrigatório' });
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });
    if (!Array.isArray(tasks[idx].comments)) tasks[idx].comments = [];
    const comment = { id: generateId(), text: textVal, author: session.sub, createdAt: new Date().toISOString() };
    tasks[idx].comments.push(comment);
    tasks[idx].updatedAt = new Date().toISOString();
    addHistory(tasks[idx], session.sub, 'comment.add', 'Comentário adicionado');
    await saveTasks(kv, session.sub, tasks);
    return json(201, { ok: true, comment, taskId });
  }

  if (body.action === 'delete-comment') {
    const { taskId, commentId } = body;
    if (!taskId || !commentId) return json(400, { ok: false, error: 'taskId e commentId obrigatórios' });
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });
    tasks[idx].comments = (tasks[idx].comments || []).filter(c => c.id !== commentId);
    tasks[idx].updatedAt = new Date().toISOString();
    await saveTasks(kv, session.sub, tasks);
    return json(200, { ok: true, deleted: commentId, taskId });
  }

  if (body.action === 'add-attachment') {
    const { taskId, name, url: attachUrl, size, mimeType } = body;
    if (!taskId) return json(400, { ok: false, error: 'taskId obrigatório' });
    if (!name || !attachUrl) return json(400, { ok: false, error: 'name e url obrigatórios' });
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });
    if (!Array.isArray(tasks[idx].attachments)) tasks[idx].attachments = [];
    if (tasks[idx].attachments.length >= 20) return json(400, { ok: false, error: 'Máximo de 20 anexos por tarefa' });
    const attachment = {
      id: generateId(),
      name: sanitize(String(name), 200),
      url: String(attachUrl).slice(0, 2000),
      size: parseInt(size) || 0,
      mimeType: sanitize(String(mimeType || 'application/octet-stream'), 100),
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.sub,
    };
    tasks[idx].attachments.push(attachment);
    tasks[idx].updatedAt = new Date().toISOString();
    addHistory(tasks[idx], session.sub, 'attachment.add', `Anexo adicionado: "${attachment.name}"`);
    await saveTasks(kv, session.sub, tasks);
    return json(201, { ok: true, attachment, taskId });
  }

  if (body.action === 'delete-attachment') {
    const { taskId, attachmentId } = body;
    if (!taskId || !attachmentId) return json(400, { ok: false, error: 'taskId e attachmentId obrigatórios' });
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });
    tasks[idx].attachments = (tasks[idx].attachments || []).filter(a => a.id !== attachmentId);
    tasks[idx].updatedAt = new Date().toISOString();
    await saveTasks(kv, session.sub, tasks);
    return json(200, { ok: true, deleted: attachmentId, taskId });
  }

  if (body.action === 'bulk-status') {
    const { ids, status } = body;
    if (!Array.isArray(ids) || !ids.length) return json(400, { ok: false, error: 'ids obrigatório' });
    const newStatus = normalizeStatus(status);
    let updated = 0;
    for (const task of tasks) {
      if (ids.includes(task.id)) {
        task.status = newStatus;
        if (newStatus === 'done') task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        addHistory(task, session.sub, 'status.change', `Status alterado para "${newStatus}" (bulk)`);
        updated++;
      }
    }
    await saveTasks(kv, session.sub, tasks);
    return json(200, { ok: true, updated });
  }

  if (body.action === 'bulk-delete') {
    const { ids } = body;
    if (!Array.isArray(ids) || !ids.length) return json(400, { ok: false, error: 'ids obrigatório' });
    const before = tasks.length;
    const remaining = tasks.filter(t => !ids.includes(t.id));
    await saveTasks(kv, session.sub, remaining);
    return json(200, { ok: true, deleted: before - remaining.length });
  }

  if (tasks.length >= MAX_TASKS_PER_USER) {
    return json(400, { ok: false, error: `Limite de ${MAX_TASKS_PER_USER} tarefas atingido` });
  }
  try {
    const task = buildTask(body, session.sub);
    addHistory(task, session.sub, 'task.create', `Tarefa criada: "${task.title}"`);
    tasks.unshift(task);
    await saveTasks(kv, session.sub, tasks);
    return json(201, { ok: true, task });
  } catch (err) {
    return json(400, { ok: false, error: err.message || 'Erro ao criar tarefa' });
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function onRequestPut({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  const { id, ...updates } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const tasks = await getTasks(kv, session.sub);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Tarefa não encontrada' });

    const task = tasks[idx];
    const changes = [];

    if ('title' in updates) {
      const v = sanitize(String(updates.title || ''), MAX_TITLE_LENGTH);
      if (!v) return json(400, { ok: false, error: 'Título não pode ser vazio' });
      if (task.title !== v) { changes.push(`Título: "${task.title}" → "${v}"`); task.title = v; }
    }
    if ('description' in updates) {
      const v = sanitize(String(updates.description || ''), MAX_DESCRIPTION_LENGTH);
      if (task.description !== v) { changes.push('Descrição atualizada'); task.description = v; }
    }
    if ('status' in updates) {
      const v = normalizeStatus(updates.status);
      if (task.status !== v) {
        changes.push(`Status: "${task.status}" → "${v}"`);
        task.status = v;
        if (v === 'done') task.completedAt = new Date().toISOString();
        else if (task.completedAt) task.completedAt = null;
      }
    }
    if ('priority' in updates) {
      const v = normalizePriority(updates.priority);
      if (task.priority !== v) { changes.push(`Prioridade: "${task.priority}" → "${v}"`); task.priority = v; }
    }
    if ('dueDate' in updates) { task.dueDate = updates.dueDate || null; changes.push('Prazo atualizado'); }
    if ('startDate' in updates) task.startDate = updates.startDate || null;
    if ('endDate' in updates) task.endDate = updates.endDate || null;
    if ('tags' in updates) {
      task.tags = Array.isArray(updates.tags) ? updates.tags.map(t => sanitize(String(t), 50)).filter(Boolean).slice(0, 20) : [];
      changes.push('Etiquetas atualizadas');
    }
    if ('assignees' in updates) {
      task.assignees = Array.isArray(updates.assignees) ? updates.assignees.map(a => sanitize(String(a), 100)).filter(Boolean).slice(0, 20) : [];
      changes.push('Responsáveis atualizados');
    }
    if ('recurrence' in updates) {
      task.recurrence = normalizeRecurrence(updates.recurrence);
      changes.push('Recorrência atualizada');
    }
    if ('dependencies' in updates) {
      task.dependencies = Array.isArray(updates.dependencies) ? updates.dependencies.filter(d => typeof d === 'string').slice(0, 10) : [];
    }
    if ('projectId' in updates) task.projectId = updates.projectId ? sanitize(String(updates.projectId), 50) : null;
    if ('workspaceId' in updates) task.workspaceId = updates.workspaceId ? sanitize(String(updates.workspaceId), 50) : null;

    task.updatedAt = new Date().toISOString();
    if (changes.length > 0) addHistory(task, session.sub, 'task.update', changes.join('; '));

    await saveTasks(kv, session.sub, tasks);
    return json(200, { ok: true, task });
  } catch {
    return json(500, { ok: false, error: 'Erro ao atualizar tarefa' });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const tasks = await getTasks(kv, session.sub);
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length === tasks.length) return json(404, { ok: false, error: 'Tarefa não encontrada' });
    await saveTasks(kv, session.sub, filtered);
    return json(200, { ok: true, deleted: id });
  } catch {
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
    case 'OPTIONS': return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
