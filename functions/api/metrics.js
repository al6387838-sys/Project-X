// LifeOS Enterprise — Metrics API v1.0
// Cloudflare Pages Function: GET /api/metrics
// Phase 200 — Real Data Migration (zero mocks)
// Calcula métricas reais a partir do KV
import { getCookie, json, verifySession } from '../_auth.js';

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getDayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()];
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  const days7 = getLast7Days();
  const labels7 = days7.map(getDayLabel);
  const metrics = {
    lifeScore: 0,
    lifeScoreHistory: days7.map(() => 0),
    labels: labels7,
    areas: [],
    performance: {
      labels: labels7,
      tasks: days7.map(() => 0),
      habits: days7.map(() => 0),
      goals: days7.map(() => 0),
    },
    trends: [],
    predictions: [],
    summary: {
      tasksTotal: 0,
      tasksCompleted: 0,
      habitsActive: 0,
      habitsCompleted: 0,
      goalsActive: 0,
      goalsAvgProgress: 0,
      streak: 0,
    },
    source: 'real',
  };
  if (!kv) {
    metrics.source = 'empty';
    return json(200, { ok: true, metrics });
  }
  try {
    const today = days7[days7.length - 1];
    // Tarefas reais
    const tasksRaw = await kv.get(`tasks:${session.sub}`);
    const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
    metrics.summary.tasksTotal = tasks.length;
    metrics.summary.tasksCompleted = tasks.filter(t => t.status === 'done').length;
    // Performance por dia (tarefas concluídas por dia)
    days7.forEach((day, i) => {
      metrics.performance.tasks[i] = tasks.filter(t =>
        t.status === 'done' && t.updatedAt && t.updatedAt.startsWith(day)
      ).length;
    });
    // Hábitos reais
    const habitsRaw = await kv.get(`habits:${session.sub}`);
    const habits = habitsRaw ? JSON.parse(habitsRaw) : [];
    const activeHabits = habits.filter(h => h.active !== false);
    metrics.summary.habitsActive = activeHabits.length;
    metrics.summary.habitsCompleted = activeHabits.filter(h =>
      h.completions && h.completions.includes(today)
    ).length;
    metrics.summary.streak = activeHabits.reduce((max, h) => Math.max(max, h.streak || 0), 0);
    // Performance por dia (hábitos)
    days7.forEach((day, i) => {
      metrics.performance.habits[i] = activeHabits.filter(h =>
        h.completions && h.completions.includes(day)
      ).length;
    });
    // Metas reais
    const goalsRaw = await kv.get(`goals:${session.sub}`);
    const goals = goalsRaw ? JSON.parse(goalsRaw) : [];
    const activeGoals = goals.filter(g => g.status === 'active');
    metrics.summary.goalsActive = activeGoals.length;
    if (activeGoals.length > 0) {
      metrics.summary.goalsAvgProgress = Math.round(
        activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length
      );
    }
    // Performance por dia (metas - progresso médio)
    days7.forEach((day, i) => {
      metrics.performance.goals[i] = metrics.summary.goalsAvgProgress;
    });
    // Calcular Life Score baseado em dados reais
    const taskScore = metrics.summary.tasksTotal > 0
      ? Math.round((metrics.summary.tasksCompleted / metrics.summary.tasksTotal) * 100)
      : 0;
    const habitScore = metrics.summary.habitsActive > 0
      ? Math.round((metrics.summary.habitsCompleted / metrics.summary.habitsActive) * 100)
      : 0;
    const goalScore = metrics.summary.goalsAvgProgress;
    const streakBonus = Math.min(metrics.summary.streak * 2, 20);
    metrics.lifeScore = Math.round((taskScore * 0.35 + habitScore * 0.35 + goalScore * 0.20 + streakBonus * 0.10));
    metrics.lifeScoreHistory = days7.map(() => metrics.lifeScore);
    // Áreas de vida baseadas em dados reais
    const categoryScores = {};
    tasks.forEach(t => {
      const cat = t.category || 'pessoal';
      if (!categoryScores[cat]) categoryScores[cat] = { done: 0, total: 0 };
      categoryScores[cat].total++;
      if (t.status === 'done') categoryScores[cat].done++;
    });
    const catColors = {
      carreira: '#6366F1', saude: '#10B981', financas: '#F59E0B',
      relacionamentos: '#EC4899', aprendizado: '#8B5CF6', pessoal: '#3B82F6',
    };
    const catLabels = {
      carreira: 'Carreira', saude: 'Saúde', financas: 'Finanças',
      relacionamentos: 'Relações', aprendizado: 'Aprendizado', pessoal: 'Pessoal',
    };
    if (Object.keys(categoryScores).length > 0) {
      metrics.areas = Object.entries(categoryScores).map(([cat, s]) => ({
        label: catLabels[cat] || cat,
        value: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
        color: catColors[cat] || '#6366F1',
      }));
    }
    // Tendências baseadas em dados reais
    if (metrics.summary.habitsActive > 0) {
      metrics.trends.push({
        name: 'Hábitos',
        value: `${metrics.summary.habitsCompleted}/${metrics.summary.habitsActive}`,
        pct: Math.round((metrics.summary.habitsCompleted / metrics.summary.habitsActive) * 100),
        color: '#10B981',
      });
    }
    if (metrics.summary.tasksTotal > 0) {
      metrics.trends.push({
        name: 'Tarefas',
        value: `${metrics.summary.tasksCompleted}/${metrics.summary.tasksTotal}`,
        pct: taskScore,
        color: '#6366F1',
      });
    }
    if (metrics.summary.goalsActive > 0) {
      metrics.trends.push({
        name: 'Metas',
        value: `${metrics.summary.goalsAvgProgress}%`,
        pct: metrics.summary.goalsAvgProgress,
        color: '#F59E0B',
      });
    }
    // Previsões baseadas em dados reais
    if (metrics.summary.streak >= 3) {
      metrics.predictions.push({
        text: `Sequência de ${metrics.summary.streak} dias — continue assim!`,
        confidence: '95%',
        type: 'streak',
      });
    }
    if (metrics.summary.goalsActive > 0) {
      metrics.predictions.push({
        text: `${metrics.summary.goalsActive} meta(s) ativa(s) com progresso médio de ${metrics.summary.goalsAvgProgress}%`,
        confidence: '100%',
        type: 'goal',
      });
    }
    if (metrics.lifeScore > 0) {
      metrics.predictions.push({
        text: `Life Score atual: ${metrics.lifeScore} pontos`,
        confidence: '100%',
        type: 'score',
      });
    }
    return json(200, { ok: true, metrics });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao calcular métricas' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
