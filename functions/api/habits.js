// LifeOS Enterprise — Habits API v1.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/habits
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
  if (!kv) return json(200, { ok: true, habits: [] });

  try {
    const raw = await kv.get(`habits:${session.sub}`);
    const habits = raw ? JSON.parse(raw) : [];
    return json(200, { ok: true, habits });
  } catch {
    return json(500, { ok: false, error: 'Erro ao carregar hábitos' });
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

  const { action, habitId, ...rest } = body;

  // Ação especial: marcar conclusão do dia
  if (action === 'complete') {
    if (!habitId) return json(400, { ok: false, error: 'habitId obrigatório' });
    try {
      const raw = await kv.get(`habits:${session.sub}`);
      const habits = raw ? JSON.parse(raw) : [];
      const idx = habits.findIndex(h => h.id === habitId);
      if (idx === -1) return json(404, { ok: false, error: 'Hábito não encontrado' });

      const today = new Date().toISOString().split('T')[0];
      if (!habits[idx].completions) habits[idx].completions = [];
      if (!habits[idx].completions.includes(today)) {
        habits[idx].completions.push(today);
        // Calcular streak
        habits[idx].streak = calculateStreak(habits[idx].completions);
      }
      habits[idx].updatedAt = new Date().toISOString();
      await kv.put(`habits:${session.sub}`, JSON.stringify(habits));
      return json(200, { ok: true, habit: habits[idx] });
    } catch {
      return json(500, { ok: false, error: 'Erro ao registrar conclusão' });
    }
  }

  // Criar novo hábito
  const { title, description, frequency, category, color } = rest;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }

  const habit = {
    id: generateId(),
    title: title.trim(),
    description: description?.trim() || '',
    frequency: frequency || 'daily',
    category: category || 'general',
    color: color || '#6366f1',
    active: true,
    streak: 0,
    completions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const raw = await kv.get(`habits:${session.sub}`);
    const habits = raw ? JSON.parse(raw) : [];
    habits.unshift(habit);
    await kv.put(`habits:${session.sub}`, JSON.stringify(habits));
    return json(201, { ok: true, habit });
  } catch {
    return json(500, { ok: false, error: 'Erro ao salvar hábito' });
  }
}

function calculateStreak(completions) {
  if (!completions || completions.length === 0) return 0;
  const sorted = [...completions].sort().reverse();
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);

  for (const dateStr of sorted) {
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((current - d) / (1000 * 60 * 60 * 24));
    if (diff === streak) {
      streak++;
      current = d;
    } else {
      break;
    }
  }
  return streak;
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
  }
}
