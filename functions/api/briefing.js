// LifeOS Enterprise — Briefing API v3.0 (FASE 2 — Certificação Completa)
// Cloudflare Pages Function: GET /api/briefing
// Gera briefing dinâmico Enterprise a partir de dados reais do KV
// Inclui: tarefas, hábitos, metas, eventos, projetos, documentos, mensagens, emails
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
    goals: [],
    insights: [],
    metrics: {},
    recentDocs: [],
    recentProjects: [],
    messages: [],
    emails: [],
    source: 'real',
  };
  if (!kv) {
    briefing.source = 'empty';
    return json(200, { ok: true, briefing });
  }
  try {
    // ── Tarefas reais ──────────────────────────────────────────────────
    const tasksRaw = await kv.get(`tasks:${session.sub}`);
    const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
    const todayTasks = tasks.filter(t => t.dueDate === today && t.status !== 'done');
    const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
    const completedToday = tasks.filter(t => t.status === 'done' && t.updatedAt && t.updatedAt.startsWith(today));
    const pendingTasks = tasks.filter(t => t.status !== 'done');
    briefing.priorities = todayTasks.slice(0, 5).map(t => ({
      title: t.title,
      meta: `${t.category || 'Geral'} · ${t.priority === 'high' ? '🔴 Alta prioridade' : t.priority === 'medium' ? '🟡 Média prioridade' : '📅 Prazo hoje'}`,
      done: false,
      id: t.id,
    }));
    if (overdueTasks.length > 0) {
      briefing.priorities.push({
        title: `${overdueTasks.length} tarefa(s) em atraso`,
        meta: '⚠️ Atenção necessária',
        done: false,
        urgent: true,
      });
    }

    // ── Hábitos reais ──────────────────────────────────────────────────
    const habitsRaw = await kv.get(`habits:${session.sub}`);
    const habits = habitsRaw ? JSON.parse(habitsRaw) : [];
    const activeHabits = habits.filter(h => h.active !== false);
    const completedHabits = activeHabits.filter(h => h.completions && h.completions.includes(today));
    briefing.habits = activeHabits.slice(0, 8).map(h => ({
      id: h.id,
      name: h.title || h.name,
      streak: h.streak || 0,
      done: h.completions ? h.completions.includes(today) : false,
      color: h.color || 'var(--accent)',
      category: h.category || 'general',
    }));

    // ── Metas reais ────────────────────────────────────────────────────
    const goalsRaw = await kv.get(`goals:${session.sub}`);
    const goals = goalsRaw ? JSON.parse(goalsRaw) : [];
    const activeGoals = goals.filter(g => g.status === 'active');
    briefing.goals = activeGoals.slice(0, 5).map(g => ({
      id: g.id,
      title: g.title,
      progress: g.progress || 0,
      color: g.color || 'var(--accent)',
      targetDate: g.targetDate,
      subtasksTotal: (g.subtasks || []).length,
      subtasksDone: (g.subtasks || []).filter(s => s.done).length,
    }));

    // ── Eventos do calendário ──────────────────────────────────────────
    const eventsRaw = await kv.get(`events:${session.sub}`);
    const events = eventsRaw ? JSON.parse(eventsRaw) : [];
    const todayEvents = events.filter(e => e.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    briefing.agenda = todayEvents.slice(0, 8).map(e => ({
      id: e.id,
      title: e.title,
      time: e.time || null,
      endTime: e.endTime || null,
      location: e.location || null,
      category: e.category || 'personal',
      color: e.color || 'var(--accent)',
      allDay: e.allDay || false,
      source: e.source || 'local',
    }));

    // ── Projetos recentes ──────────────────────────────────────────────
    const projectsRaw = await kv.get(`projects:${session.sub}`);
    const projects = projectsRaw ? JSON.parse(projectsRaw) : [];
    const activeProjects = projects.filter(p => p.status === 'active');
    briefing.recentProjects = activeProjects
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        progress: p.progress || 0,
        updatedAt: p.updatedAt,
      }));

    // ── Documentos recentes ────────────────────────────────────────────
    const docsRaw = await kv.get(`documents:${session.sub}`);
    const docs = docsRaw ? JSON.parse(docsRaw) : [];
    briefing.recentDocs = docs
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
      .slice(0, 5)
      .map(d => ({
        id: d.id,
        title: d.title,
        type: d.type || 'document',
        updatedAt: d.updatedAt || d.createdAt,
      }));

    // ── Mensagens recentes ─────────────────────────────────────────────
    const messagesRaw = await kv.get(`messages:${session.sub}`);
    const messages = messagesRaw ? JSON.parse(messagesRaw) : [];
    const unreadMessages = messages.filter(m => !m.read);
    briefing.messages = unreadMessages.slice(0, 5).map(m => ({
      id: m.id,
      from: m.from || m.senderName || 'Desconhecido',
      subject: m.subject || (m.content || '').slice(0, 60) || '',
      time: m.createdAt,
      read: m.read,
    }));

    // ── Emails recentes ────────────────────────────────────────────────
    const emailsRaw = await kv.get(`emails:${session.sub}`);
    const emails = emailsRaw ? JSON.parse(emailsRaw) : [];
    const unreadEmails = emails.filter(e => !e.read);
    briefing.emails = unreadEmails.slice(0, 5).map(e => ({
      id: e.id,
      from: e.from || e.sender || 'Desconhecido',
      subject: e.subject || '(sem assunto)',
      time: e.date || e.createdAt,
      read: e.read,
    }));

    // ── Insights baseados em dados reais ──────────────────────────────
    if (completedToday.length > 0) {
      briefing.insights.push({ type: 'success', text: `✅ ${completedToday.length} tarefa(s) concluída(s) hoje` });
    }
    if (completedHabits.length > 0) {
      briefing.insights.push({ type: 'habit', text: `🔥 ${completedHabits.length}/${activeHabits.length} hábitos concluídos hoje` });
    }
    const maxStreak = activeHabits.reduce((max, h) => Math.max(max, h.streak || 0), 0);
    if (maxStreak >= 3) {
      briefing.insights.push({ type: 'streak', text: `⚡ Sequência de ${maxStreak} dias mantida` });
    }
    if (activeGoals.length > 0) {
      const avgProgress = Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length);
      briefing.insights.push({ type: 'goal', text: `🎯 ${activeGoals.length} meta(s) ativa(s) — progresso médio: ${avgProgress}%` });
    }
    if (overdueTasks.length > 0) {
      briefing.insights.push({ type: 'warning', text: `⚠️ ${overdueTasks.length} tarefa(s) em atraso` });
    }
    if (todayEvents.length > 0) {
      briefing.insights.push({ type: 'calendar', text: `📅 ${todayEvents.length} evento(s) hoje` });
    }
    if (unreadMessages.length > 0) {
      briefing.insights.push({ type: 'message', text: `💬 ${unreadMessages.length} mensagem(ns) não lida(s)` });
    }
    if (unreadEmails.length > 0) {
      briefing.insights.push({ type: 'email', text: `📧 ${unreadEmails.length} email(s) não lido(s)` });
    }
    if (briefing.insights.length === 0) {
      briefing.insights.push({ type: 'info', text: 'Comece adicionando tarefas, hábitos e metas para ver seus insights aqui.' });
    }

    // ── Métricas consolidadas ──────────────────────────────────────────
    briefing.metrics = {
      tasksToday: todayTasks.length,
      tasksCompleted: completedToday.length,
      tasksPending: pendingTasks.length,
      tasksOverdue: overdueTasks.length,
      habitsActive: activeHabits.length,
      habitsCompleted: completedHabits.length,
      habitsRate: activeHabits.length > 0 ? Math.round((completedHabits.length / activeHabits.length) * 100) : 0,
      goalsActive: activeGoals.length,
      goalsAvgProgress: activeGoals.length > 0 ? Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length) : 0,
      streak: maxStreak,
      eventsToday: todayEvents.length,
      projectsActive: activeProjects.length,
      unreadMessages: unreadMessages.length,
      unreadEmails: unreadEmails.length,
    };

    return json(200, { ok: true, briefing });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao gerar briefing: ' + err.message });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
