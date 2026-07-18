// LifeOS Enterprise — AI Insights API v1.0
// Cloudflare Pages Function: GET /api/ai-insights
// Phase 200 — Real Data Migration (zero mocks)
// Gera insights dinâmicos baseados em dados reais do KV
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  const insights = [];
  const today = new Date().toISOString().split('T')[0];
  if (!kv) {
    return json(200, { ok: true, insights: [{
      icon: 'zap', label: 'Bem-vindo', text: 'Comece adicionando hábitos, metas e tarefas para receber insights personalizados.',
    }], source: 'empty' });
  }
  try {
    // Análise de tarefas
    const tasksRaw = await kv.get(`tasks:${session.sub}`);
    const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
    const todayTasks = tasks.filter(t => t.dueDate === today);
    const completedToday = tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today));
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
    if (tasks.length > 0) {
      const completionRate = tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0;
      if (completionRate >= 80) {
        insights.push({ icon: 'chart-no-axes-combined', label: 'Produtividade', text: `Excelente! Você completou ${completionRate}% das suas tarefas. Sua consistência está acima da média — continue assim!` });
      } else if (overdue.length > 0) {
        insights.push({ icon: 'chart-no-axes-combined', label: 'Produtividade', text: `Você tem ${overdue.length} tarefa(s) em atraso. Priorize-as hoje para manter o ritmo e evitar acúmulo.` });
      } else if (todayTasks.length > 0) {
        insights.push({ icon: 'chart-no-axes-combined', label: 'Produtividade', text: `Você tem ${todayTasks.length} tarefa(s) para hoje. ${completedToday.length > 0 ? `Já completou ${completedToday.length} — ótimo começo!` : 'Comece pelas mais importantes para manter o foco.'}` });
      }
    }
    // Análise de hábitos
    const habitsRaw = await kv.get(`habits:${session.sub}`);
    const habits = habitsRaw ? JSON.parse(habitsRaw) : [];
    const activeHabits = habits.filter(h => h.active);
    const completedHabits = habits.filter(h => h.completions?.includes(today));
    if (activeHabits.length > 0) {
      const habitRate = Math.round((completedHabits.length / activeHabits.length) * 100);
      const maxStreak = Math.max(...habits.map(h => h.streak || 0), 0);
      const leastConsistent = habits.filter(h => h.active).sort((a, b) => (a.streak || 0) - (b.streak || 0))[0];
      if (habitRate >= 80) {
        insights.push({ icon: 'refresh-cw', label: 'Hábitos', text: `Incrível! Taxa de ${habitRate}% nos hábitos hoje. ${maxStreak > 0 ? `Seu maior streak é de ${maxStreak} dias.` : ''} Consistência é a chave do sucesso!` });
      } else if (leastConsistent) {
        insights.push({ icon: 'refresh-cw', label: 'Hábitos', text: `Taxa de ${habitRate}% nos hábitos hoje. "${leastConsistent.title}" precisa de atenção — ${leastConsistent.streak || 0} dias de streak. Pequenas ações diárias geram grandes resultados.` });
      }
    } else if (habits.length === 0) {
      insights.push({ icon: 'refresh-cw', label: 'Hábitos', text: 'Você ainda não tem hábitos cadastrados. Adicione seu primeiro hábito e comece a construir rotinas poderosas!' });
    }
    // Análise de metas
    const goalsRaw = await kv.get(`goals:${session.sub}`);
    const goals = goalsRaw ? JSON.parse(goalsRaw) : [];
    const activeGoals = goals.filter(g => g.status === 'active');
    if (activeGoals.length > 0) {
      const avgProgress = Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length);
      const behindGoal = activeGoals.find(g => g.targetDate && new Date(g.targetDate) < new Date(Date.now() + 30 * 86400000) && (g.progress || 0) < 70);
      if (behindGoal) {
        insights.push({ icon: 'target', label: 'Metas', text: `Sua meta "${behindGoal.title}" está com ${behindGoal.progress || 0}% de progresso e o prazo se aproxima. Foque nela esta semana!` });
      } else {
        insights.push({ icon: 'target', label: 'Metas', text: `Progresso médio de ${avgProgress}% nas suas ${activeGoals.length} meta(s) ativa(s). ${avgProgress >= 70 ? 'Você está no caminho certo!' : 'Revise suas prioridades para acelerar o progresso.'}` });
      }
    } else if (goals.length === 0) {
      insights.push({ icon: 'target', label: 'Metas', text: 'Defina suas primeiras metas para dar direção à sua jornada. Metas claras aumentam a motivação e o foco.' });
    }
    // Life Score insight
    const userRaw = await kv.get(`user:${session.sub}`);
    const user = userRaw ? JSON.parse(userRaw) : {};
    const lifeScore = user.lifeScore || 0;
    if (lifeScore > 0) {
      insights.push({ icon: 'zap', label: 'Life Score', text: `Seu Life Score atual é ${lifeScore}. ${lifeScore >= 80 ? 'Excelente performance! Continue mantendo seus hábitos e metas.' : lifeScore >= 60 ? 'Bom progresso! Foque em consistência para subir ainda mais.' : 'Há espaço para crescer. Comece com pequenas ações diárias.'}` });
    }
    if (insights.length === 0) {
      insights.push({ icon: 'zap', label: 'Bem-vindo', text: 'Adicione hábitos, metas e tarefas para receber insights personalizados baseados nos seus dados reais.' });
    }
    return json(200, { ok: true, insights, source: 'real' });
  } catch {
    return json(500, { ok: false, error: 'Erro ao gerar insights' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (action === 'log') {
      // Retornar log de ações de IA do KV
      const secret = env.LIFEOS_SESSION_SECRET;
      if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
      const token = getCookie(request.headers.get('cookie'));
      const session = await verifySession(token, secret);
      if (!session) return json(401, { ok: false, error: 'Não autenticado' });
      const kv = env.LIFEOS_KV;
      const limit = parseInt(url.searchParams.get('limit') || '5', 10);
      try {
        const raw = kv ? await kv.get(`ai:actions:${session.sub}`) : null;
        const actions = raw ? JSON.parse(raw).slice(0, limit) : [];
        return json(200, { ok: true, actions });
      } catch { return json(200, { ok: true, actions: [] }); }
    }
    return onRequestGet({ request, env });
  }
  return json(405, { ok: false, error: 'Método não permitido' });
}
