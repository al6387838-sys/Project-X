// LifeOS Enterprise — Briefing API v1.0
// Cloudflare Pages Function: GET /api/briefing
// Phase 200 — Real Data Migration (zero mocks)
// Gera briefing dinâmico a partir de dados reais do KV
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  const now = new Date();
  const hour = now.getHours();
  const isMorning = hour < 18;
  const today = now.toISOString().split('T')[0];
  const briefing = {
    period: isMorning ? 'morning' : 'evening',
    date: today,
    headline: isMorning
      ? 'Bom dia! Aqui está seu plano para hoje.'
      : 'Boa noite! Aqui está seu resumo do dia.',
    priorities: [],
    agenda: [],
    habits: [],
    insights: [],
    metrics: {},
    source: 'real',
  };
  if (!kv) {
    briefing.source = 'empty';
    return json(200, { ok: true, briefing });
  }
  try {
    // Tarefas reais
    const tasksRaw = await kv.get(`tasks:${session.sub}`);
    const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
    const todayTasks = tasks.filter(t => t.dueDate === today && t.status !== 'done');
    const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
    const completedToday = tasks.filter(t => t.status === 'done' && t.updatedAt && t.updatedAt.startsWith(today));
    briefing.priorities = todayTasks.slice(0, 5).map(t => ({
      title: t.title,
      meta: `${t.category || 'Geral'} · ${t.priority === 'high' ? 'Alta prioridade' : t.priority === 'medium' ? 'Média prioridade' : 'Prazo hoje'}`,
      done: false,
    }));
    if (overdueTasks.length > 0) {
      briefing.priorities.push({
        title: `${overdueTasks.length} tarefa(s) em atraso`,
        meta: 'Atenção necessária',
        done: false,
        urgent: true,
      });
    }
    // Hábitos reais
    const habitsRaw = await kv.get(`habits:${session.sub}`);
    const habits = habitsRaw ? JSON.parse(habitsRaw) : [];
    const activeHabits = habits.filter(h => h.active !== false);
    const completedHabits = activeHabits.filter(h => h.completions && h.completions.includes(today));
    briefing.habits = activeHabits.slice(0, 5).map(h => ({
      name: h.name,
      streak: h.streak || 0,
      done: h.completions ? h.completions.includes(today) : false,
    }));
    // Metas reais
    const goalsRaw = await kv.get(`goals:${session.sub}`);
    const goals = goalsRaw ? JSON.parse(goalsRaw) : [];
    const activeGoals = goals.filter(g => g.status === 'active');
    // Insights baseados em dados reais
    if (completedToday.length > 0) {
      briefing.insights.push({
        type: 'success',
        text: `${completedToday.length} tarefa(s) concluída(s) hoje`,
      });
    }
    if (completedHabits.length > 0) {
      briefing.insights.push({
        type: 'habit',
        text: `${completedHabits.length}/${activeHabits.length} hábitos concluídos hoje`,
      });
    }
    const maxStreak = activeHabits.reduce((max, h) => Math.max(max, h.streak || 0), 0);
    if (maxStreak >= 3) {
      briefing.insights.push({
        type: 'streak',
        text: `Sequência de ${maxStreak} dias mantida`,
      });
    }
    if (activeGoals.length > 0) {
      const avgProgress = Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length);
      briefing.insights.push({
        type: 'goal',
        text: `${activeGoals.length} meta(s) ativa(s) — progresso médio: ${avgProgress}%`,
      });
    }
    // Métricas do dia
    briefing.metrics = {
      tasksToday: todayTasks.length,
      tasksCompleted: completedToday.length,
      habitsActive: activeHabits.length,
      habitsCompleted: completedHabits.length,
      goalsActive: activeGoals.length,
      streak: maxStreak,
    };
    // Agenda: tarefas de hoje ordenadas por prioridade
    briefing.agenda = todayTasks.slice(0, 6).map(t => ({
      title: t.title,
      time: t.dueTime || null,
      category: t.category || 'Geral',
    }));
    return json(200, { ok: true, briefing });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao gerar briefing' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
