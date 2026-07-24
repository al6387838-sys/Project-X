// LifeOS Enterprise — Goals API v3.0 (FASE 2 — Certificação Completa)
// Cloudflare Pages Function: GET/POST/PUT/PATCH/DELETE /api/goals
// Funcionalidades: CRUD, subtarefas, marcos, progresso, anexos R2, histórico, compartilhamento
// Storage: KV (LIFEOS_KV) + R2 (LIFEOS_R2/LIFEOS_FILES)
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const ALLOWED_STATUS = ['active', 'paused', 'done', 'cancelled'];
const ALLOWED_CATEGORIES = ['personal', 'health', 'finance', 'career', 'education', 'relationships', 'travel', 'other'];

function sanitize(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim()
    .slice(0, max);
}

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
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

function resolveBucket(env) {
  return env.LIFEOS_R2 || env.LIFEOS_FILES || env.R2_BUCKET || null;
}

async function getGoals(kv, userId) {
  try {
    const raw = await kv.get(`goals:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveGoals(kv, userId, goals) {
  await kv.put(`goals:${userId}`, JSON.stringify(goals));
}

// Recalcular progresso baseado em subtarefas e valor atual
function recalcProgress(goal) {
  // Se tem subtarefas, progresso = % de subtarefas concluídas
  if (goal.subtasks && goal.subtasks.length > 0) {
    const done = goal.subtasks.filter(s => s.done).length;
    return Math.round((done / goal.subtasks.length) * 100);
  }
  // Se tem targetValue e currentValue, calcular
  if (goal.targetValue && goal.currentValue !== undefined) {
    return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  }
  // Usar progresso manual
  return Math.min(100, Math.max(0, Number(goal.progress) || 0));
}

// Adicionar entrada ao histórico
function addHistory(goal, action, userId, details = {}) {
  if (!goal.history) goal.history = [];
  goal.history.unshift({
    id: generateId(),
    action,
    userId,
    details,
    at: new Date().toISOString(),
  });
  if (goal.history.length > 200) goal.history = goal.history.slice(0, 200);
}

// GET /api/goals
export async function onRequestGet({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const goals = await getGoals(kv, session.sub);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const view = url.searchParams.get('view') || 'list';
    const status = url.searchParams.get('status') || '';
    const category = url.searchParams.get('category') || '';

    // Detalhes de uma meta específica
    if (id) {
      const goal = goals.find(g => g.id === id);
      if (!goal) return json(404, { ok: false, error: 'Meta não encontrada' });
      return json(200, { ok: true, goal });
    }

    // Estatísticas gerais
    if (view === 'stats') {
      const active = goals.filter(g => g.status === 'active');
      const done = goals.filter(g => g.status === 'done');
      const avgProgress = active.length > 0
        ? Math.round(active.reduce((s, g) => s + (g.progress || 0), 0) / active.length)
        : 0;
      return json(200, {
        ok: true,
        stats: {
          total: goals.length,
          active: active.length,
          done: done.length,
          paused: goals.filter(g => g.status === 'paused').length,
          avgProgress,
          overdue: active.filter(g => g.targetDate && g.targetDate < new Date().toISOString().split('T')[0]).length,
        },
      });
    }

    let filtered = goals;
    if (status) filtered = filtered.filter(g => g.status === status);
    if (category) filtered = filtered.filter(g => g.category === category);
    return json(200, { ok: true, goals: filtered });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao carregar metas: ' + e.message });
  }
}

// POST /api/goals — criar meta ou ação especial
export async function onRequestPost({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { action, id: goalId } = body;

  // ── Ação: Adicionar subtarefa ────────────────────────────────────────────
  if (action === 'add-subtask') {
    if (!goalId) return json(400, { ok: false, error: 'id obrigatório' });
    const { subtaskTitle } = body;
    if (!subtaskTitle) return json(400, { ok: false, error: 'subtaskTitle obrigatório' });
    try {
      const goals = await getGoals(kv, session.sub);
      const idx = goals.findIndex(g => g.id === goalId);
      if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });
      if (!goals[idx].subtasks) goals[idx].subtasks = [];
      const subtask = { id: generateId(), title: sanitize(subtaskTitle, MAX_TITLE_LENGTH), done: false, createdAt: new Date().toISOString() };
      goals[idx].subtasks.push(subtask);
      goals[idx].progress = recalcProgress(goals[idx]);
      goals[idx].updatedAt = new Date().toISOString();
      addHistory(goals[idx], 'subtask-added', session.sub, { subtaskTitle });
      await saveGoals(kv, session.sub, goals);
      return json(200, { ok: true, goal: goals[idx], subtask });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao adicionar subtarefa: ' + e.message });
    }
  }

  // ── Ação: Toggle subtarefa ───────────────────────────────────────────────
  if (action === 'toggle-subtask') {
    const { subtaskId } = body;
    if (!goalId || !subtaskId) return json(400, { ok: false, error: 'id e subtaskId obrigatórios' });
    try {
      const goals = await getGoals(kv, session.sub);
      const idx = goals.findIndex(g => g.id === goalId);
      if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });
      const sidx = (goals[idx].subtasks || []).findIndex(s => s.id === subtaskId);
      if (sidx === -1) return json(404, { ok: false, error: 'Subtarefa não encontrada' });
      goals[idx].subtasks[sidx].done = !goals[idx].subtasks[sidx].done;
      goals[idx].subtasks[sidx].doneAt = goals[idx].subtasks[sidx].done ? new Date().toISOString() : null;
      goals[idx].progress = recalcProgress(goals[idx]);
      if (goals[idx].progress === 100 && goals[idx].status === 'active') {
        goals[idx].status = 'done';
        goals[idx].completedAt = new Date().toISOString();
        addHistory(goals[idx], 'completed', session.sub, { auto: true });
      }
      goals[idx].updatedAt = new Date().toISOString();
      addHistory(goals[idx], 'subtask-toggled', session.sub, { subtaskId, done: goals[idx].subtasks[sidx].done });
      await saveGoals(kv, session.sub, goals);
      return json(200, { ok: true, goal: goals[idx] });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao atualizar subtarefa: ' + e.message });
    }
  }

  // ── Ação: Adicionar marco ────────────────────────────────────────────────
  if (action === 'add-milestone') {
    if (!goalId) return json(400, { ok: false, error: 'id obrigatório' });
    const { milestoneTitle, milestoneDate, milestoneValue } = body;
    if (!milestoneTitle) return json(400, { ok: false, error: 'milestoneTitle obrigatório' });
    try {
      const goals = await getGoals(kv, session.sub);
      const idx = goals.findIndex(g => g.id === goalId);
      if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });
      if (!goals[idx].milestones) goals[idx].milestones = [];
      const milestone = {
        id: generateId(),
        title: sanitize(milestoneTitle, MAX_TITLE_LENGTH),
        date: sanitize(milestoneDate || '', 10),
        value: Number(milestoneValue) || null,
        done: false,
        createdAt: new Date().toISOString(),
      };
      goals[idx].milestones.push(milestone);
      goals[idx].updatedAt = new Date().toISOString();
      addHistory(goals[idx], 'milestone-added', session.sub, { milestoneTitle });
      await saveGoals(kv, session.sub, goals);
      return json(200, { ok: true, goal: goals[idx], milestone });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao adicionar marco: ' + e.message });
    }
  }

  // ── Ação: Toggle marco ───────────────────────────────────────────────────
  if (action === 'toggle-milestone') {
    const { milestoneId } = body;
    if (!goalId || !milestoneId) return json(400, { ok: false, error: 'id e milestoneId obrigatórios' });
    try {
      const goals = await getGoals(kv, session.sub);
      const idx = goals.findIndex(g => g.id === goalId);
      if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });
      const midx = (goals[idx].milestones || []).findIndex(m => m.id === milestoneId);
      if (midx === -1) return json(404, { ok: false, error: 'Marco não encontrado' });
      goals[idx].milestones[midx].done = !goals[idx].milestones[midx].done;
      goals[idx].milestones[midx].doneAt = goals[idx].milestones[midx].done ? new Date().toISOString() : null;
      goals[idx].updatedAt = new Date().toISOString();
      addHistory(goals[idx], 'milestone-toggled', session.sub, { milestoneId, done: goals[idx].milestones[midx].done });
      await saveGoals(kv, session.sub, goals);
      return json(200, { ok: true, goal: goals[idx] });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao atualizar marco: ' + e.message });
    }
  }

  // ── Ação: Atualizar progresso manual ────────────────────────────────────
  if (action === 'update-progress') {
    if (!goalId) return json(400, { ok: false, error: 'id obrigatório' });
    const { progress, currentValue } = body;
    try {
      const goals = await getGoals(kv, session.sub);
      const idx = goals.findIndex(g => g.id === goalId);
      if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });
      if (currentValue !== undefined) goals[idx].currentValue = Number(currentValue);
      if (progress !== undefined) goals[idx].progress = Math.min(100, Math.max(0, Number(progress)));
      goals[idx].progress = recalcProgress(goals[idx]);
      if (goals[idx].progress === 100 && goals[idx].status === 'active') {
        goals[idx].status = 'done';
        goals[idx].completedAt = new Date().toISOString();
        addHistory(goals[idx], 'completed', session.sub, { auto: true });
      }
      goals[idx].updatedAt = new Date().toISOString();
      addHistory(goals[idx], 'progress-updated', session.sub, { progress: goals[idx].progress, currentValue: goals[idx].currentValue });
      await saveGoals(kv, session.sub, goals);
      return json(200, { ok: true, goal: goals[idx] });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao atualizar progresso: ' + e.message });
    }
  }

  // ── Ação: Compartilhar meta ──────────────────────────────────────────────
  if (action === 'share') {
    if (!goalId) return json(400, { ok: false, error: 'id obrigatório' });
    try {
      const goals = await getGoals(kv, session.sub);
      const idx = goals.findIndex(g => g.id === goalId);
      if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });
      const shareToken = generateId();
      goals[idx].shareToken = shareToken;
      goals[idx].sharedAt = new Date().toISOString();
      goals[idx].updatedAt = new Date().toISOString();
      addHistory(goals[idx], 'shared', session.sub, {});
      await saveGoals(kv, session.sub, goals);
      return json(200, { ok: true, shareUrl: `/goals/shared/${shareToken}`, shareToken });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao compartilhar meta: ' + e.message });
    }
  }

  // ── Ação: Anexar documento/imagem ────────────────────────────────────────
  if (action === 'attach') {
    const { fileName, fileType, fileData } = body;
    if (!goalId || !fileName || !fileData) {
      return json(400, { ok: false, error: 'id, fileName e fileData são obrigatórios' });
    }
    const bucket = resolveBucket(env);
    if (!bucket) return json(503, { ok: false, error: 'Armazenamento de arquivos indisponível' });
    try {
      const goals = await getGoals(kv, session.sub);
      const idx = goals.findIndex(g => g.id === goalId);
      if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });
      const binaryStr = atob(fileData);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const attachId = generateId();
      const key = `goals/${session.sub}/${goalId}/${attachId}_${sanitize(fileName, 100)}`;
      await bucket.put(key, bytes, {
        httpMetadata: { contentType: fileType || 'application/octet-stream' },
        customMetadata: { ownerId: session.sub, goalId, fileName },
      });
      if (!goals[idx].attachments) goals[idx].attachments = [];
      const attachment = { id: attachId, name: sanitize(fileName, 100), type: fileType || 'application/octet-stream', key, uploadedAt: new Date().toISOString() };
      goals[idx].attachments.push(attachment);
      goals[idx].updatedAt = new Date().toISOString();
      addHistory(goals[idx], 'attachment-added', session.sub, { fileName });
      await saveGoals(kv, session.sub, goals);
      return json(200, { ok: true, attachment });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao anexar arquivo: ' + e.message });
    }
  }

  // ── Criar nova meta ──────────────────────────────────────────────────────
  const { title, description, category, targetDate, targetValue, unit, milestones, icon, color } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }

  const goal = {
    id: generateId(),
    title: sanitize(title, MAX_TITLE_LENGTH),
    description: sanitize(description || '', MAX_DESCRIPTION_LENGTH),
    category: ALLOWED_CATEGORIES.includes(category) ? category : 'personal',
    targetDate: sanitize(targetDate || '', 10) || null,
    targetValue: targetValue ? Number(targetValue) : null,
    currentValue: 0,
    unit: sanitize(unit || '', 50),
    progress: 0,
    status: 'active',
    icon: sanitize(icon || 'target', 50),
    color: sanitize(color || '#6366F1', 30),
    milestones: Array.isArray(milestones) ? milestones.slice(0, 50).map(m => ({
      id: generateId(),
      title: sanitize(String(m.title || m), MAX_TITLE_LENGTH),
      date: sanitize(m.date || '', 10),
      value: m.value ? Number(m.value) : null,
      done: false,
      createdAt: new Date().toISOString(),
    })) : [],
    subtasks: [],
    attachments: [],
    history: [],
    sharedWith: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: session.sub,
  };

  // Registrar criação no histórico
  addHistory(goal, 'created', session.sub, { title: goal.title });

  try {
    const goals = await getGoals(kv, session.sub);
    goals.unshift(goal);
    await saveGoals(kv, session.sub, goals);
    return json(201, { ok: true, goal });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao salvar meta: ' + e.message });
  }
}

// PUT /api/goals — editar meta
export async function onRequestPut({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { id, ...updates } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const goals = await getGoals(kv, session.sub);
    const idx = goals.findIndex(g => g.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });

    const oldValues = {};
    const allowed = ['title', 'description', 'category', 'targetDate', 'targetValue', 'currentValue', 'unit', 'progress', 'status', 'icon', 'color', 'milestones', 'subtasks'];
    for (const key of allowed) {
      if (key in updates) {
        oldValues[key] = goals[idx][key];
        if (key === 'title') goals[idx][key] = sanitize(updates[key], MAX_TITLE_LENGTH);
        else if (key === 'description') goals[idx][key] = sanitize(updates[key], MAX_DESCRIPTION_LENGTH);
        else if (key === 'category') goals[idx][key] = ALLOWED_CATEGORIES.includes(updates[key]) ? updates[key] : goals[idx][key];
        else if (key === 'status') goals[idx][key] = ALLOWED_STATUS.includes(updates[key]) ? updates[key] : goals[idx][key];
        else if (key === 'targetValue' || key === 'currentValue') goals[idx][key] = Number(updates[key]) || 0;
        else if (key === 'progress') goals[idx][key] = Math.min(100, Math.max(0, Number(updates[key]) || 0));
        else goals[idx][key] = updates[key];
      }
    }
    // Recalcular progresso automaticamente
    goals[idx].progress = recalcProgress(goals[idx]);
    // Auto-completar se progresso = 100
    if (goals[idx].progress === 100 && goals[idx].status === 'active') {
      goals[idx].status = 'done';
      goals[idx].completedAt = new Date().toISOString();
    }
    goals[idx].updatedAt = new Date().toISOString();
    addHistory(goals[idx], 'edited', session.sub, { changes: Object.keys(updates).filter(k => allowed.includes(k)) });
    await saveGoals(kv, session.sub, goals);
    return json(200, { ok: true, goal: goals[idx] });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao atualizar meta: ' + e.message });
  }
}

// DELETE /api/goals
export async function onRequestDelete({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  const url = new URL(request.url);
  let id = url.searchParams.get('id');
  if (!id) {
    try { const b = await request.json(); id = b.id; } catch { /* */ }
  }
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const goals = await getGoals(kv, session.sub);
    const filtered = goals.filter(g => g.id !== id);
    if (filtered.length === goals.length) return json(404, { ok: false, error: 'Meta não encontrada' });
    await saveGoals(kv, session.sub, filtered);
    return json(200, { ok: true, deleted: id });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao excluir meta: ' + e.message });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'PUT') return onRequestPut({ request, env });
  if (request.method === 'PATCH') return onRequestPut({ request, env });
  if (request.method === 'DELETE') return onRequestDelete({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
