// LifeOS Enterprise — Goals API v1.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/goals
// Phase 139 — Real Backend Completion
import { getCookie, json, verifySession } from '../_auth.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, goals: [] });

  try {
    const raw = await kv.get(`goals:${session.sub}`);
    const goals = raw ? JSON.parse(raw) : [];
    return json(200, { ok: true, goals });
  } catch {
    return json(500, { ok: false, error: 'Erro ao carregar metas' });
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

  const { title, description, category, targetDate, targetValue, unit, milestones } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }

  const goal = {
    id: generateId(),
    title: title.trim(),
    description: description?.trim() || '',
    category: category || 'personal',
    targetDate: targetDate || null,
    targetValue: targetValue || null,
    currentValue: 0,
    unit: unit || '',
    progress: 0,
    status: 'active',
    milestones: Array.isArray(milestones) ? milestones : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const raw = await kv.get(`goals:${session.sub}`);
    const goals = raw ? JSON.parse(raw) : [];
    goals.unshift(goal);
    await kv.put(`goals:${session.sub}`, JSON.stringify(goals));
    return json(201, { ok: true, goal });
  } catch {
    return json(500, { ok: false, error: 'Erro ao salvar meta' });
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
    const raw = await kv.get(`goals:${session.sub}`);
    const goals = raw ? JSON.parse(raw) : [];
    const idx = goals.findIndex(g => g.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Meta não encontrada' });

    const allowed = ['title', 'description', 'category', 'targetDate', 'targetValue', 'currentValue', 'unit', 'progress', 'status', 'milestones'];
    for (const key of allowed) {
      if (key in updates) goals[idx][key] = updates[key];
    }

    // Recalcular progresso automaticamente se targetValue e currentValue fornecidos
    if (goals[idx].targetValue && goals[idx].currentValue !== undefined) {
      goals[idx].progress = Math.min(100, Math.round((goals[idx].currentValue / goals[idx].targetValue) * 100));
    }

    goals[idx].updatedAt = new Date().toISOString();
    await kv.put(`goals:${session.sub}`, JSON.stringify(goals));
    return json(200, { ok: true, goal: goals[idx] });
  } catch {
    return json(500, { ok: false, error: 'Erro ao atualizar meta' });
  }
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    case 'PUT': return onRequestPut(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST, PUT' });
  }
}
