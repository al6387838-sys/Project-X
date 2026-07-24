// LifeOS Enterprise — Habits API v3.0 (FASE 2 — Certificação Completa)
// Cloudflare Pages Function: GET/POST/PUT/PATCH/DELETE /api/habits
// Funcionalidades: CRUD, streak, estatísticas, calendário, histórico, notificações
// Storage: KV (LIFEOS_KV)
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const ALLOWED_FREQUENCY = ['daily', 'weekly', 'monthly', 'weekdays', 'weekends', 'custom'];
const ALLOWED_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#84CC16'];

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

async function getHabits(kv, userId) {
  try {
    const raw = await kv.get(`habits:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveHabits(kv, userId, habits) {
  await kv.put(`habits:${userId}`, JSON.stringify(habits));
}

// Calcular streak atual
function calculateStreak(completions) {
  if (!completions || completions.length === 0) return 0;
  const sorted = [...new Set(completions)].sort().reverse();
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const dateStr of sorted) {
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
    if (diff === streak) {
      streak++;
      today.setDate(today.getDate() - 1);
    } else if (diff === 0 && streak === 0) {
      streak = 1;
      today.setDate(today.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Calcular melhor streak histórico
function calculateBestStreak(completions) {
  if (!completions || completions.length === 0) return 0;
  const sorted = [...new Set(completions)].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00');
    const cur = new Date(sorted[i] + 'T12:00:00');
    const diff = Math.round((cur - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

// Calcular estatísticas do hábito
function calculateStats(habit) {
  const completions = habit.completions || [];
  const today = new Date().toISOString().split('T')[0];
  const last30 = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last30.push(d.toISOString().split('T')[0]);
  }
  const completedLast30 = completions.filter(c => last30.includes(c)).length;
  const rate30 = Math.round((completedLast30 / 30) * 100);
  const streak = calculateStreak(completions);
  const bestStreak = calculateBestStreak(completions);
  const completedToday = completions.includes(today);
  // Calendário dos últimos 12 semanas
  const calendarData = {};
  for (let i = 0; i < 84; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    calendarData[dateStr] = completions.includes(dateStr);
  }
  return {
    streak,
    bestStreak,
    totalCompletions: completions.length,
    completedLast30,
    rate30,
    completedToday,
    calendarData,
  };
}

// GET /api/habits
export async function onRequestGet({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  try {
    const habits = await getHabits(kv, session.sub);
    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'list';
    const id = url.searchParams.get('id');

    // Detalhes de um hábito específico (com estatísticas)
    if (id) {
      const habit = habits.find(h => h.id === id);
      if (!habit) return json(404, { ok: false, error: 'Hábito não encontrado' });
      return json(200, { ok: true, habit, stats: calculateStats(habit) });
    }

    // Estatísticas gerais
    if (view === 'stats') {
      const today = new Date().toISOString().split('T')[0];
      const activeHabits = habits.filter(h => h.active !== false);
      const completedToday = activeHabits.filter(h => (h.completions || []).includes(today));
      const totalStreak = activeHabits.reduce((s, h) => s + calculateStreak(h.completions || []), 0);
      const avgStreak = activeHabits.length > 0 ? Math.round(totalStreak / activeHabits.length) : 0;
      return json(200, {
        ok: true,
        stats: {
          total: habits.length,
          active: activeHabits.length,
          completedToday: completedToday.length,
          rateToday: activeHabits.length > 0 ? Math.round((completedToday.length / activeHabits.length) * 100) : 0,
          avgStreak,
          maxStreak: activeHabits.reduce((m, h) => Math.max(m, calculateStreak(h.completions || [])), 0),
        },
      });
    }

    // Lista com estatísticas calculadas
    const habitsWithStats = habits.map(h => ({
      ...h,
      streak: calculateStreak(h.completions || []),
      completedToday: (h.completions || []).includes(new Date().toISOString().split('T')[0]),
    }));
    return json(200, { ok: true, habits: habitsWithStats });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao carregar hábitos: ' + e.message });
  }
}

// POST /api/habits — criar hábito ou ação especial
export async function onRequestPost({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { action, id: habitId } = body;

  // ── Ação: Marcar/desmarcar conclusão do dia ──────────────────────────────
  if (action === 'complete' || action === 'toggle') {
    if (!habitId) return json(400, { ok: false, error: 'id obrigatório' });
    try {
      const habits = await getHabits(kv, session.sub);
      const idx = habits.findIndex(h => h.id === habitId);
      if (idx === -1) return json(404, { ok: false, error: 'Hábito não encontrado' });
      const today = new Date().toISOString().split('T')[0];
      if (!habits[idx].completions) habits[idx].completions = [];
      const alreadyDone = habits[idx].completions.includes(today);
      if (action === 'toggle') {
        if (alreadyDone) {
          habits[idx].completions = habits[idx].completions.filter(c => c !== today);
        } else {
          habits[idx].completions.push(today);
        }
      } else {
        if (!alreadyDone) habits[idx].completions.push(today);
      }
      habits[idx].streak = calculateStreak(habits[idx].completions);
      habits[idx].updatedAt = new Date().toISOString();
      // Registrar no histórico
      if (!habits[idx].history) habits[idx].history = [];
      habits[idx].history.unshift({ date: today, action: alreadyDone ? 'uncompleted' : 'completed', at: new Date().toISOString() });
      if (habits[idx].history.length > 100) habits[idx].history = habits[idx].history.slice(0, 100);
      await saveHabits(kv, session.sub, habits);
      return json(200, { ok: true, habit: habits[idx], streak: habits[idx].streak, completedToday: !alreadyDone });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao registrar conclusão: ' + e.message });
    }
  }

  // ── Ação: Editar hábito ──────────────────────────────────────────────────
  if (action === 'edit') {
    if (!habitId) return json(400, { ok: false, error: 'id obrigatório' });
    try {
      const habits = await getHabits(kv, session.sub);
      const idx = habits.findIndex(h => h.id === habitId);
      if (idx === -1) return json(404, { ok: false, error: 'Hábito não encontrado' });
      const { title, description, frequency, category, color, active, reminderTime, reminderEnabled, targetDays } = body;
      if (title !== undefined) habits[idx].title = sanitize(title, MAX_TITLE_LENGTH);
      if (description !== undefined) habits[idx].description = sanitize(description, MAX_DESCRIPTION_LENGTH);
      if (frequency !== undefined) habits[idx].frequency = ALLOWED_FREQUENCY.includes(frequency) ? frequency : habits[idx].frequency;
      if (category !== undefined) habits[idx].category = sanitize(category, 50);
      if (color !== undefined) habits[idx].color = sanitize(color, 30);
      if (active !== undefined) habits[idx].active = Boolean(active);
      if (reminderTime !== undefined) habits[idx].reminderTime = sanitize(reminderTime, 5);
      if (reminderEnabled !== undefined) habits[idx].reminderEnabled = Boolean(reminderEnabled);
      if (targetDays !== undefined) habits[idx].targetDays = Array.isArray(targetDays) ? targetDays.slice(0, 7) : habits[idx].targetDays;
      habits[idx].updatedAt = new Date().toISOString();
      await saveHabits(kv, session.sub, habits);
      return json(200, { ok: true, habit: habits[idx] });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao editar hábito: ' + e.message });
    }
  }

  // ── Ação: Excluir hábito ─────────────────────────────────────────────────
  if (action === 'delete') {
    if (!habitId) return json(400, { ok: false, error: 'id obrigatório' });
    try {
      const habits = await getHabits(kv, session.sub);
      const filtered = habits.filter(h => h.id !== habitId);
      if (filtered.length === habits.length) return json(404, { ok: false, error: 'Hábito não encontrado' });
      await saveHabits(kv, session.sub, filtered);
      return json(200, { ok: true, deleted: habitId });
    } catch (e) {
      return json(500, { ok: false, error: 'Erro ao excluir hábito: ' + e.message });
    }
  }

  // ── Criar novo hábito ────────────────────────────────────────────────────
  const { title, description, frequency, category, color, reminderTime, reminderEnabled, targetDays, icon } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }

  const habit = {
    id: generateId(),
    title: sanitize(title, MAX_TITLE_LENGTH),
    description: sanitize(description || '', MAX_DESCRIPTION_LENGTH),
    frequency: ALLOWED_FREQUENCY.includes(frequency) ? frequency : 'daily',
    category: sanitize(category || 'general', 50),
    color: sanitize(color || '#6366F1', 30),
    icon: sanitize(icon || 'check-circle', 50),
    active: true,
    streak: 0,
    completions: [],
    history: [],
    reminderTime: sanitize(reminderTime || '08:00', 5),
    reminderEnabled: Boolean(reminderEnabled),
    targetDays: Array.isArray(targetDays) ? targetDays.slice(0, 7) : [0, 1, 2, 3, 4, 5, 6],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const habits = await getHabits(kv, session.sub);
    habits.unshift(habit);
    await saveHabits(kv, session.sub, habits);
    return json(201, { ok: true, habit });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao salvar hábito: ' + e.message });
  }
}

// PUT /api/habits — editar hábito via PUT
export async function onRequestPut({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { id, ...updates } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const habits = await getHabits(kv, session.sub);
    const idx = habits.findIndex(h => h.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Hábito não encontrado' });

    // Toggle de conclusão
    if (updates.action === 'toggle') {
      const today = new Date().toISOString().split('T')[0];
      if (!habits[idx].completions) habits[idx].completions = [];
      const alreadyDone = habits[idx].completions.includes(today);
      if (alreadyDone) {
        habits[idx].completions = habits[idx].completions.filter(c => c !== today);
      } else {
        habits[idx].completions.push(today);
      }
      habits[idx].streak = calculateStreak(habits[idx].completions);
      habits[idx].updatedAt = new Date().toISOString();
      await saveHabits(kv, session.sub, habits);
      return json(200, { ok: true, habit: habits[idx], completedToday: !alreadyDone });
    }

    const allowed = ['title', 'description', 'frequency', 'category', 'color', 'icon', 'active', 'reminderTime', 'reminderEnabled', 'targetDays'];
    for (const key of allowed) {
      if (key in updates) {
        if (key === 'title') habits[idx][key] = sanitize(updates[key], MAX_TITLE_LENGTH);
        else if (key === 'description') habits[idx][key] = sanitize(updates[key], MAX_DESCRIPTION_LENGTH);
        else if (key === 'frequency') habits[idx][key] = ALLOWED_FREQUENCY.includes(updates[key]) ? updates[key] : habits[idx][key];
        else if (key === 'active' || key === 'reminderEnabled') habits[idx][key] = Boolean(updates[key]);
        else if (key === 'targetDays') habits[idx][key] = Array.isArray(updates[key]) ? updates[key].slice(0, 7) : habits[idx][key];
        else habits[idx][key] = sanitize(String(updates[key] ?? ''), 200);
      }
    }
    habits[idx].updatedAt = new Date().toISOString();
    await saveHabits(kv, session.sub, habits);
    return json(200, { ok: true, habit: habits[idx] });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao atualizar hábito: ' + e.message });
  }
}

// DELETE /api/habits
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
    const habits = await getHabits(kv, session.sub);
    const filtered = habits.filter(h => h.id !== id);
    if (filtered.length === habits.length) return json(404, { ok: false, error: 'Hábito não encontrado' });
    await saveHabits(kv, session.sub, filtered);
    return json(200, { ok: true, deleted: id });
  } catch (e) {
    return json(500, { ok: false, error: 'Erro ao excluir hábito: ' + e.message });
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
