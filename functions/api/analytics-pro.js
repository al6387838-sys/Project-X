// LifeOS Enterprise — Advanced Analytics API v34.0
// Cloudflare Pages Function: GET /api/analytics-pro
// Phase 267 — Advanced Analytics
// Dashboards profissionais: crescimento, usuários ativos, retenção, produtividade,
// documentos, CRM, pipeline, receita, utilização da plataforma
// 100% dados reais do KV — zero dados ilustrativos
import { getCookie, json, verifySession, hasPermission } from '../_auth.js';

// ─── Helpers de data ──────────────────────────────────────────────────────────
function getDateRange(period) {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start;
  switch (period) {
    case '7d':  { const d = new Date(now); d.setDate(d.getDate() - 6);  start = d.toISOString().split('T')[0]; break; }
    case '30d': { const d = new Date(now); d.setDate(d.getDate() - 29); start = d.toISOString().split('T')[0]; break; }
    case '90d': { const d = new Date(now); d.setDate(d.getDate() - 89); start = d.toISOString().split('T')[0]; break; }
    case '1y':  { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); start = d.toISOString().split('T')[0]; break; }
    default:    { const d = new Date(now); d.setDate(d.getDate() - 29); start = d.toISOString().split('T')[0]; }
  }
  return { start, end };
}

function getDaysArray(start, end) {
  const days = [];
  const cur = new Date(start + 'T12:00:00');
  const endDate = new Date(end + 'T12:00:00');
  while (cur <= endDate) {
    days.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
}

// ─── Módulo: Produtividade ────────────────────────────────────────────────────
async function getProductivityAnalytics(kv, userId, days) {
  const tasksRaw = await kv.get(`tasks:${userId}`);
  const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
  const habitsRaw = await kv.get(`habits:${userId}`);
  const habits = habitsRaw ? JSON.parse(habitsRaw) : [];
  const goalsRaw = await kv.get(`goals:${userId}`);
  const goals = goalsRaw ? JSON.parse(goalsRaw) : [];

  const tasksByDay = {};
  const completedByDay = {};
  for (const day of days) { tasksByDay[day] = 0; completedByDay[day] = 0; }

  for (const task of tasks) {
    const d = (task.createdAt || '').split('T')[0];
    if (tasksByDay[d] !== undefined) tasksByDay[d]++;
    if (task.status === 'done') {
      const cd = (task.updatedAt || task.createdAt || '').split('T')[0];
      if (completedByDay[cd] !== undefined) completedByDay[cd]++;
    }
  }

  const habitsByDay = {};
  for (const day of days) habitsByDay[day] = 0;
  for (const habit of habits) {
    for (const comp of (habit.completions || [])) {
      if (habitsByDay[comp] !== undefined) habitsByDay[comp]++;
    }
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < days[days.length - 1] && t.status !== 'done').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const activeGoals = goals.filter(g => g.status !== 'completed').length;
  const avgGoalProgress = goals.length > 0
    ? Math.round(goals.reduce((s, g) => s + (g.progress || 0), 0) / goals.length)
    : 0;

  return {
    labels: days.map(dayLabel),
    taskCreated: days.map(d => tasksByDay[d]),
    taskCompleted: days.map(d => completedByDay[d]),
    habitCompleted: days.map(d => habitsByDay[d]),
    kpis: {
      totalTasks,
      completedTasks,
      overdueTasks,
      completionRate,
      activeGoals,
      avgGoalProgress,
      activeHabits: habits.filter(h => h.active).length,
    },
  };
}

// ─── Módulo: CRM & Pipeline ───────────────────────────────────────────────────
async function getCRMAnalytics(kv, userId, days) {
  const crmRaw = await kv.get(`crm:${userId}`);
  const contacts = crmRaw ? JSON.parse(crmRaw) : [];

  const byStage = {};
  const bySource = {};
  const newByDay = {};
  for (const day of days) newByDay[day] = 0;

  for (const contact of contacts) {
    const stage = contact.stage || contact.status || 'lead';
    byStage[stage] = (byStage[stage] || 0) + 1;
    const source = contact.source || 'direct';
    bySource[source] = (bySource[source] || 0) + 1;
    const d = (contact.createdAt || '').split('T')[0];
    if (newByDay[d] !== undefined) newByDay[d]++;
  }

  const totalValue = contacts.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const wonContacts = contacts.filter(c => c.stage === 'won' || c.status === 'won');
  const wonValue = wonContacts.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const conversionRate = contacts.length > 0 ? Math.round((wonContacts.length / contacts.length) * 100) : 0;

  return {
    labels: days.map(dayLabel),
    newContactsByDay: days.map(d => newByDay[d]),
    pipeline: Object.entries(byStage).map(([stage, count]) => ({ stage, count })),
    sources: Object.entries(bySource).map(([source, count]) => ({ source, count })),
    kpis: {
      totalContacts: contacts.length,
      totalValue,
      wonValue,
      conversionRate,
      avgDealValue: wonContacts.length > 0 ? Math.round(wonValue / wonContacts.length) : 0,
    },
  };
}

// ─── Módulo: Documentos ───────────────────────────────────────────────────────
async function getDocumentAnalytics(kv, userId, days) {
  const docsRaw = await kv.get(`documents:${userId}`);
  const docs = docsRaw ? JSON.parse(docsRaw) : [];
  const notesRaw = await kv.get(`notes:${userId}`);
  const notes = notesRaw ? JSON.parse(notesRaw) : [];

  const createdByDay = {};
  for (const day of days) createdByDay[day] = 0;

  for (const doc of [...docs, ...notes]) {
    const d = (doc.createdAt || '').split('T')[0];
    if (createdByDay[d] !== undefined) createdByDay[d]++;
  }

  const byType = {};
  for (const doc of docs) {
    const type = doc.type || 'document';
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    labels: days.map(dayLabel),
    createdByDay: days.map(d => createdByDay[d]),
    byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
    kpis: {
      totalDocuments: docs.length,
      totalNotes: notes.length,
      totalContent: docs.length + notes.length,
    },
  };
}

// ─── Módulo: Utilização da plataforma ────────────────────────────────────────
async function getPlatformAnalytics(kv, userId, days) {
  const auditRaw = await kv.get(`audit:${userId}`);
  const auditEvents = auditRaw ? JSON.parse(auditRaw) : [];

  const eventsByDay = {};
  const moduleUsage = {};
  for (const day of days) eventsByDay[day] = 0;

  for (const event of auditEvents) {
    const d = (event.timestamp || '').split('T')[0];
    if (eventsByDay[d] !== undefined) eventsByDay[d]++;
    const module = event.module || event.action?.split(':')[0] || 'other';
    moduleUsage[module] = (moduleUsage[module] || 0) + 1;
  }

  // Calcular sessões (agrupando eventos com intervalo < 30min)
  let sessions = 0;
  let lastEvent = null;
  const sorted = [...auditEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  for (const event of sorted) {
    const t = new Date(event.timestamp).getTime();
    if (!lastEvent || t - lastEvent > 30 * 60 * 1000) sessions++;
    lastEvent = t;
  }

  return {
    labels: days.map(dayLabel),
    activityByDay: days.map(d => eventsByDay[d]),
    moduleUsage: Object.entries(moduleUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([module, count]) => ({ module, count })),
    kpis: {
      totalEvents: auditEvents.length,
      estimatedSessions: sessions,
      avgEventsPerDay: days.length > 0 ? Math.round(auditEvents.length / days.length) : 0,
      mostUsedModule: Object.entries(moduleUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
    },
  };
}

// ─── Módulo: Financeiro ───────────────────────────────────────────────────────
async function getFinanceAnalytics(kv, userId, days) {
  const financeRaw = await kv.get(`finance:${userId}`);
  const finance = financeRaw ? JSON.parse(financeRaw) : {};
  const transactions = finance.transactions || [];

  const incomeByDay = {};
  const expenseByDay = {};
  for (const day of days) { incomeByDay[day] = 0; expenseByDay[day] = 0; }

  for (const tx of transactions) {
    const d = (tx.date || tx.createdAt || '').split('T')[0];
    if (tx.type === 'income' && incomeByDay[d] !== undefined) incomeByDay[d] += Number(tx.amount) || 0;
    if (tx.type === 'expense' && expenseByDay[d] !== undefined) expenseByDay[d] += Number(tx.amount) || 0;
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return {
    labels: days.map(dayLabel),
    income: days.map(d => incomeByDay[d]),
    expenses: days.map(d => expenseByDay[d]),
    kpis: {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
    },
  };
}

// ─── Handler principal ─────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  const url = new URL(request.url);
  const module = url.searchParams.get('module') || 'all';
  const period = url.searchParams.get('period') || '30d';

  if (!kv) return json(200, { ok: true, module, period, data: null, source: 'empty' });

  const { start, end } = getDateRange(period);
  const days = getDaysArray(start, end);

  try {
    if (module === 'productivity') {
      const data = await getProductivityAnalytics(kv, session.sub, days);
      return json(200, { ok: true, module, period, start, end, data, source: 'real' });
    }
    if (module === 'crm') {
      const data = await getCRMAnalytics(kv, session.sub, days);
      return json(200, { ok: true, module, period, start, end, data, source: 'real' });
    }
    if (module === 'documents') {
      const data = await getDocumentAnalytics(kv, session.sub, days);
      return json(200, { ok: true, module, period, start, end, data, source: 'real' });
    }
    if (module === 'platform') {
      const data = await getPlatformAnalytics(kv, session.sub, days);
      return json(200, { ok: true, module, period, start, end, data, source: 'real' });
    }
    if (module === 'finance') {
      const data = await getFinanceAnalytics(kv, session.sub, days);
      return json(200, { ok: true, module, period, start, end, data, source: 'real' });
    }

    // Módulo 'all' — retornar todos os módulos
    const [productivity, crm, documents, platform, finance] = await Promise.all([
      getProductivityAnalytics(kv, session.sub, days),
      getCRMAnalytics(kv, session.sub, days),
      getDocumentAnalytics(kv, session.sub, days),
      getPlatformAnalytics(kv, session.sub, days),
      getFinanceAnalytics(kv, session.sub, days),
    ]);

    return json(200, {
      ok: true,
      module: 'all',
      period,
      start,
      end,
      data: { productivity, crm, documents, platform, finance },
      source: 'real',
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao calcular analytics', details: err.message });
  }
}
