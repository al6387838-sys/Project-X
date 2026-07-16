// LifeOS Enterprise — Search API v1.0
// Cloudflare Pages Function: GET /api/search
// Phase 200 — Real Data Migration (zero mocks)
// Busca global em todos os dados reais do KV
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').toLowerCase().trim();
  if (!q) return json(200, { ok: true, results: [], total: 0 });
  if (!kv) return json(200, { ok: true, results: [], total: 0, source: 'empty' });
  const results = [];
  try {
    // Buscar em tarefas
    const tasksRaw = await kv.get(`tasks:${session.sub}`);
    if (tasksRaw) {
      const tasks = JSON.parse(tasksRaw);
      tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
        .slice(0, 5).forEach(t => results.push({
          type: 'Tarefa', icon: '✅', title: t.title,
          desc: t.status === 'done' ? 'Concluída' : t.dueDate ? `Prazo: ${t.dueDate}` : 'Pendente',
          id: t.id, category: 'tasks',
        }));
    }
    // Buscar em hábitos
    const habitsRaw = await kv.get(`habits:${session.sub}`);
    if (habitsRaw) {
      const habits = JSON.parse(habitsRaw);
      habits.filter(h => h.title.toLowerCase().includes(q))
        .slice(0, 5).forEach(h => results.push({
          type: 'Hábito', icon: '🔄', title: h.title,
          desc: h.streak ? `Streak de ${h.streak} dias` : 'Ativo',
          id: h.id, category: 'habits',
        }));
    }
    // Buscar em metas
    const goalsRaw = await kv.get(`goals:${session.sub}`);
    if (goalsRaw) {
      const goals = JSON.parse(goalsRaw);
      goals.filter(g => g.title.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q))
        .slice(0, 5).forEach(g => results.push({
          type: 'Meta', icon: '🎯', title: g.title,
          desc: `${g.progress || 0}% completo`,
          id: g.id, category: 'goals',
        }));
    }
    // Buscar em notas
    const notesRaw = await kv.get(`notes:${session.sub}`);
    if (notesRaw) {
      const notes = JSON.parse(notesRaw);
      notes.filter(n => n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
        .slice(0, 5).forEach(n => {
          const date = new Date(n.createdAt);
          const dateStr = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
          results.push({
            type: 'Nota', icon: '📝', title: n.title,
            desc: dateStr,
            id: n.id, category: 'notes',
          });
        });
    }
    // Buscar em projetos
    const projectsRaw = await kv.get(`projects:${session.sub}`);
    if (projectsRaw) {
      const projects = JSON.parse(projectsRaw);
      projects.filter(p => p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
        .slice(0, 3).forEach(p => results.push({
          type: 'Projeto', icon: '🚀', title: p.title,
          desc: `${p.progress || 0}% completo`,
          id: p.id, category: 'projects',
        }));
    }
    return json(200, { ok: true, results: results.slice(0, 15), total: results.length });
  } catch {
    return json(500, { ok: false, error: 'Erro na busca' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
