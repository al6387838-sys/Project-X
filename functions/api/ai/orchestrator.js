// LifeOS Enterprise — AI Orchestrator API v1.0
// Cloudflare Pages Function: GET/POST /api/ai/orchestrator
// Phase 143 — AI Orchestrator
// Organiza tarefas, sugere prioridades, relaciona módulos, encontra informações, recomenda ações
import { getCookie, json, verifySession } from '../../_auth.js';

// Regras de priorização de tarefas (sem substituir funcionalidades existentes)
function prioritizeTasks(tasks) {
  if (!tasks || tasks.length === 0) return [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  return tasks
    .filter(t => t.status !== 'done')
    .map(t => {
      let score = 0;
      // Urgência por data
      if (t.dueDate) {
        const due = new Date(t.dueDate);
        const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) score += 100; // atrasada
        else if (daysLeft === 0) score += 80; // hoje
        else if (daysLeft <= 3) score += 60; // próximos 3 dias
        else if (daysLeft <= 7) score += 40; // próxima semana
      }
      // Prioridade declarada
      const priorityScore = { urgent: 40, high: 30, medium: 20, low: 10 };
      score += priorityScore[t.priority] || 20;

      return { ...t, aiScore: score, aiReason: getTaskReason(t, score) };
    })
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 10);
}

function getTaskReason(task, score) {
  if (score >= 100) return 'Tarefa atrasada — ação imediata necessária';
  if (score >= 80) return 'Vence hoje — prioridade máxima';
  if (score >= 60) return 'Vence em breve — atenção necessária';
  if (task.priority === 'urgent') return 'Marcada como urgente';
  if (task.priority === 'high') return 'Alta prioridade';
  return 'Prioridade normal';
}

function generateInsights(userData) {
  const insights = [];
  const { tasks, habits, goals, finance } = userData;

  // Insights de tarefas
  if (tasks) {
    const overdue = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]);
    if (overdue.length > 0) {
      insights.push({
        id: 'tasks-overdue',
        type: 'alert',
        module: 'tasks',
        title: `${overdue.length} tarefa(s) atrasada(s)`,
        description: `Você tem ${overdue.length} tarefa(s) com prazo vencido. Revise e atualize os prazos ou marque como concluídas.`,
        action: { label: 'Ver Tarefas', page: 'tasks' },
        priority: 'high',
      });
    }

    const todayTasks = tasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0] && t.status !== 'done');
    if (todayTasks.length > 0) {
      insights.push({
        id: 'tasks-today',
        type: 'info',
        module: 'tasks',
        title: `${todayTasks.length} tarefa(s) para hoje`,
        description: `Você tem ${todayTasks.length} tarefa(s) programadas para hoje.`,
        action: { label: 'Ver Hoje', page: 'tasks' },
        priority: 'medium',
      });
    }
  }

  // Insights de hábitos
  if (habits) {
    const today = new Date().toISOString().split('T')[0];
    const notDoneToday = habits.filter(h => h.active && !(h.completions || []).includes(today));
    if (notDoneToday.length > 0) {
      insights.push({
        id: 'habits-pending',
        type: 'reminder',
        module: 'habits',
        title: `${notDoneToday.length} hábito(s) pendente(s) hoje`,
        description: `Mantenha sua sequência! ${notDoneToday.length} hábito(s) ainda não foram marcados hoje.`,
        action: { label: 'Ver Hábitos', page: 'habits' },
        priority: 'medium',
      });
    }

    const highStreak = habits.filter(h => h.streak >= 7);
    if (highStreak.length > 0) {
      insights.push({
        id: 'habits-streak',
        type: 'achievement',
        module: 'habits',
        title: `Sequência de ${highStreak[0].streak} dias!`,
        description: `Parabéns! Você mantém "${highStreak[0].title}" por ${highStreak[0].streak} dias consecutivos.`,
        action: { label: 'Ver Hábitos', page: 'habits' },
        priority: 'low',
      });
    }
  }

  // Insights de metas
  if (goals) {
    const nearDeadline = goals.filter(g => {
      if (!g.targetDate || g.status !== 'active') return false;
      const daysLeft = Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
      return daysLeft > 0 && daysLeft <= 14;
    });
    if (nearDeadline.length > 0) {
      insights.push({
        id: 'goals-deadline',
        type: 'alert',
        module: 'goals',
        title: `Meta com prazo próximo`,
        description: `"${nearDeadline[0].title}" vence em breve. Progresso atual: ${nearDeadline[0].progress || 0}%.`,
        action: { label: 'Ver Meta', page: 'goals' },
        priority: 'high',
      });
    }
  }

  // Insights financeiros
  if (finance && finance.monthlyExpenses && finance.monthlyIncome) {
    const ratio = finance.monthlyExpenses / finance.monthlyIncome;
    if (ratio > 0.8) {
      insights.push({
        id: 'finance-expenses',
        type: 'alert',
        module: 'finance',
        title: 'Despesas elevadas este mês',
        description: `Suas despesas representam ${Math.round(ratio * 100)}% da receita. Considere revisar o orçamento.`,
        action: { label: 'Ver Finanças', page: 'finance-hub' },
        priority: 'high',
      });
    }
  }

  return insights;
}

function generateSuggestions(userData) {
  const suggestions = [];
  const { tasks, habits, goals, documents } = userData;

  // Sugestão: criar rotina matinal
  if (!habits || habits.length === 0) {
    suggestions.push({
      id: 'suggest-habits',
      module: 'habits',
      title: 'Crie sua rotina de hábitos',
      description: 'Adicione hábitos diários para aumentar sua produtividade e bem-estar.',
      action: { label: 'Criar Hábito', page: 'habits' },
    });
  }

  // Sugestão: definir metas
  if (!goals || goals.length === 0) {
    suggestions.push({
      id: 'suggest-goals',
      module: 'goals',
      title: 'Defina suas metas',
      description: 'Metas claras aumentam o foco e a motivação. Comece com uma meta simples.',
      action: { label: 'Criar Meta', page: 'goals' },
    });
  }

  // Sugestão: organizar documentos
  if (documents && documents.length > 10) {
    const untagged = documents.filter(d => !d.tags || d.tags.length === 0);
    if (untagged.length > 3) {
      suggestions.push({
        id: 'suggest-docs-tags',
        module: 'documents',
        title: 'Organize seus documentos',
        description: `${untagged.length} documentos sem tags. Adicione tags para facilitar a busca.`,
        action: { label: 'Organizar', page: 'document-center' },
      });
    }
  }

  return suggestions;
}

function findCrossModuleRelations(userData) {
  const relations = [];
  const { tasks, goals, documents } = userData;

  // Relacionar tarefas com metas
  if (tasks && goals) {
    goals.forEach(goal => {
      const relatedTasks = tasks.filter(t =>
        t.title?.toLowerCase().includes(goal.title?.toLowerCase().split(' ')[0]) ||
        (t.tags || []).some(tag => goal.category?.includes(tag))
      );
      if (relatedTasks.length > 0) {
        relations.push({
          type: 'task-goal',
          message: `${relatedTasks.length} tarefa(s) relacionada(s) à meta "${goal.title}"`,
          modules: ['tasks', 'goals'],
          items: { goal: goal.id, tasks: relatedTasks.map(t => t.id) },
        });
      }
    });
  }

  return relations.slice(0, 5);
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'dashboard';
  const kv = env.LIFEOS_KV;

  if (!kv) return json(200, { ok: true, data: {}, source: 'unavailable' });

  try {
    // Carregar dados de todos os módulos
    const [tasksRaw, habitsRaw, goalsRaw, financeRaw, docsRaw] = await Promise.all([
      kv.get(`tasks:${session.sub}`),
      kv.get(`habits:${session.sub}`),
      kv.get(`goals:${session.sub}`),
      kv.get(`finance:accounts:${session.sub}`),
      kv.get(`docs:files:${session.sub}`),
    ]);

    const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
    const habits = habitsRaw ? JSON.parse(habitsRaw) : [];
    const goals = goalsRaw ? JSON.parse(goalsRaw) : [];
    const accounts = financeRaw ? JSON.parse(financeRaw) : [];
    const documents = docsRaw ? JSON.parse(docsRaw) : [];

    const userData = { tasks, habits, goals, documents };

    if (view === 'priorities') {
      const prioritized = prioritizeTasks(tasks);
      return json(200, { ok: true, priorities: prioritized });
    }

    if (view === 'insights') {
      const insights = generateInsights(userData);
      return json(200, { ok: true, insights });
    }

    if (view === 'suggestions') {
      const suggestions = generateSuggestions(userData);
      return json(200, { ok: true, suggestions });
    }

    if (view === 'relations') {
      const relations = findCrossModuleRelations(userData);
      return json(200, { ok: true, relations });
    }

    // Dashboard completo do AI Orchestrator
    const insights = generateInsights(userData);
    const suggestions = generateSuggestions(userData);
    const priorities = prioritizeTasks(tasks);
    const relations = findCrossModuleRelations(userData);

    // Salvar insights no KV para uso em outros módulos
    await kv.put(`ai:insights:${session.sub}`, JSON.stringify({
      insights,
      suggestions,
      generatedAt: new Date().toISOString(),
    }));

    return json(200, {
      ok: true,
      orchestrator: {
        insights,
        suggestions,
        priorities,
        relations,
        summary: {
          totalInsights: insights.length,
          alertCount: insights.filter(i => i.type === 'alert').length,
          achievementCount: insights.filter(i => i.type === 'achievement').length,
          suggestionsCount: suggestions.length,
          prioritizedTasks: priorities.length,
          crossModuleRelations: relations.length,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro no AI Orchestrator' });
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

  const { action, query } = body;

  // Busca inteligente cross-módulo
  if (action === 'search') {
    if (!query) return json(400, { ok: false, error: 'query obrigatório' });

    const [tasksRaw, habitsRaw, goalsRaw, docsRaw] = await Promise.all([
      kv.get(`tasks:${session.sub}`),
      kv.get(`habits:${session.sub}`),
      kv.get(`goals:${session.sub}`),
      kv.get(`docs:files:${session.sub}`),
    ]);

    const q = query.toLowerCase();
    const results = [];

    const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
    tasks.filter(t => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(t => results.push({ type: 'task', id: t.id, title: t.title, module: 'tasks', page: 'tasks' }));

    const habits = habitsRaw ? JSON.parse(habitsRaw) : [];
    habits.filter(h => h.title?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(h => results.push({ type: 'habit', id: h.id, title: h.title, module: 'habits', page: 'habits' }));

    const goals = goalsRaw ? JSON.parse(goalsRaw) : [];
    goals.filter(g => g.title?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(g => results.push({ type: 'goal', id: g.id, title: g.title, module: 'goals', page: 'goals' }));

    const docs = docsRaw ? JSON.parse(docsRaw) : [];
    docs.filter(d => !d.deleted && (d.name?.toLowerCase().includes(q) || (d.tags || []).some(t => t.toLowerCase().includes(q))))
      .slice(0, 3)
      .forEach(d => results.push({ type: 'document', id: d.id, title: d.name, module: 'documents', page: 'document-center' }));

    return json(200, { ok: true, results, query, total: results.length });
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: search' });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    case 'PUT': // fallthrough
    case 'PATCH': // fallthrough
    case 'DELETE': // fallthrough
    case 'OPTIONS': if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
