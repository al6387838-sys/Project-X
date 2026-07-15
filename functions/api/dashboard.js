// LifeOS Enterprise — Dashboard Data API v1.0
// Cloudflare Pages Function: GET /api/dashboard
// Phase 139 — Real Backend Completion
// 100% dados reais do KV — zero mock data
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const userId = session.sub;
  const kv = env.LIFEOS_KV;

  // Estrutura base de dados reais (sem valores fictícios)
  let dashboard = {
    tasks: { today: 0, completed: 0, overdue: 0, total: 0 },
    habits: { active: 0, completed: 0, streak: 0 },
    goals: { active: 0, progress: 0, completed: 0 },
    finance: { balance: null, income: null, expenses: null },
    notifications: { unread: 0 },
    ai: { insights: 0, suggestions: 0 },
    lastUpdated: new Date().toISOString(),
  };

  if (!kv) return json(200, { ok: true, dashboard, source: 'base' });

  try {
    // Carregar tarefas reais
    const tasksRaw = await kv.get(`tasks:${userId}`);
    if (tasksRaw) {
      const tasks = JSON.parse(tasksRaw);
      const today = new Date().toISOString().split('T')[0];
      dashboard.tasks.total = tasks.length;
      dashboard.tasks.today = tasks.filter(t => t.dueDate === today).length;
      dashboard.tasks.completed = tasks.filter(t => t.status === 'done').length;
      dashboard.tasks.overdue = tasks.filter(t =>
        t.dueDate && t.dueDate < today && t.status !== 'done'
      ).length;
    }

    // Carregar hábitos reais
    const habitsRaw = await kv.get(`habits:${userId}`);
    if (habitsRaw) {
      const habits = JSON.parse(habitsRaw);
      const today = new Date().toISOString().split('T')[0];
      dashboard.habits.active = habits.filter(h => h.active).length;
      dashboard.habits.completed = habits.filter(h =>
        h.completions && h.completions.includes(today)
      ).length;
      // Calcular streak
      const streakHabit = habits.find(h => h.streak);
      if (streakHabit) dashboard.habits.streak = streakHabit.streak;
    }

    // Carregar metas reais
    const goalsRaw = await kv.get(`goals:${userId}`);
    if (goalsRaw) {
      const goals = JSON.parse(goalsRaw);
      dashboard.goals.active = goals.filter(g => g.status === 'active').length;
      dashboard.goals.completed = goals.filter(g => g.status === 'completed').length;
      if (goals.length > 0) {
        const totalProgress = goals.reduce((sum, g) => sum + (g.progress || 0), 0);
        dashboard.goals.progress = Math.round(totalProgress / goals.length);
      }
    }

    // Carregar dados financeiros reais (Open Finance)
    const financeRaw = await kv.get(`finance:${userId}`);
    if (financeRaw) {
      const finance = JSON.parse(financeRaw);
      dashboard.finance = {
        balance: finance.totalBalance ?? null,
        income: finance.monthlyIncome ?? null,
        expenses: finance.monthlyExpenses ?? null,
        currency: 'BRL',
      };
    }

    // Contar notificações não lidas
    const notifRaw = await kv.get(`notifications:${userId}`);
    if (notifRaw) {
      const notifs = JSON.parse(notifRaw);
      dashboard.notifications.unread = notifs.filter(n => !n.read).length;
    }

    // Insights de AI reais
    const aiRaw = await kv.get(`ai:insights:${userId}`);
    if (aiRaw) {
      const aiData = JSON.parse(aiRaw);
      dashboard.ai.insights = aiData.insights?.length || 0;
      dashboard.ai.suggestions = aiData.suggestions?.length || 0;
    }

    return json(200, { ok: true, dashboard, source: 'kv' });
  } catch (err) {
    return json(200, { ok: true, dashboard, source: 'base', warning: 'KV parcialmente indisponível' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
