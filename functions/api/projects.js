// LifeOS Enterprise — Projects API v3.0
// Cloudflare Pages Function: /api/projects
// Ações: create, edit, delete, archive, restore, duplicate, share, transfer, history, autosave
import { getCookie, json, verifySession } from '../_auth.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function now() {
  return new Date().toISOString();
}

function safeText(value, max = 500) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

async function getAuth(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return { error: json(503, { ok: false, error: 'Serviço indisponível' }) };
  const cookieHeader = request.headers.get('cookie') || '';
  const token = getCookie(cookieHeader);
  if (!token) return { error: json(401, { ok: false, error: 'Não autenticado' }) };
  let session;
  try {
    session = await verifySession(token, secret);
  } catch {
    return { error: json(401, { ok: false, error: 'Sessão inválida' }) };
  }
  if (!session) return { error: json(401, { ok: false, error: 'Sessão inválida' }) };
  const kv = env.LIFEOS_KV;
  if (!kv) return { error: json(503, { ok: false, error: 'Armazenamento indisponível' }) };
  return { session, kv };
}

async function getProjects(kv, userId) {
  const raw = await kv.get(`projects:${userId}`);
  return raw ? JSON.parse(raw) : [];
}

async function saveProjects(kv, userId, projects) {
  await kv.put(`projects:${userId}`, JSON.stringify(projects));
}

async function appendHistory(kv, userId, projectId, entry) {
  const key = `projects:history:${userId}:${projectId}`;
  const raw = await kv.get(key);
  const history = raw ? JSON.parse(raw) : [];
  history.unshift({ ...entry, id: generateId(), timestamp: now() });
  await kv.put(key, JSON.stringify(history.slice(0, 100)));
}

export async function onRequestGet({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;
  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'list';
  const id = url.searchParams.get('id');

  try {
    if (view === 'history' && id) {
      const key = `projects:history:${session.sub}:${id}`;
      const raw = await kv.get(key);
      const history = raw ? JSON.parse(raw) : [];
      return json(200, { ok: true, history, projectId: id });
    }

    if (view === 'stats') {
      const projects = await getProjects(kv, session.sub);
      const active = projects.filter(p => p.status === 'active').length;
      const archived = projects.filter(p => p.status === 'archived').length;
      const completed = projects.filter(p => p.status === 'completed').length;
      return json(200, { ok: true, stats: { total: projects.length, active, archived, completed } });
    }

    const projects = await getProjects(kv, session.sub);
    // Enriquecer com contagem de tarefas
    const tasksRaw = await kv.get(`tasks:${session.sub}`);
    const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let filtered = projects;
    if (status) filtered = filtered.filter(p => p.status === status);
    if (q) filtered = filtered.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
    const enriched = filtered.map(p => {
      const projectTasks = tasks.filter(t => t.workspaceId === p.id || t.projectId === p.id);
      const pending = projectTasks.filter(t => t.status !== 'done').length;
      return { ...p, taskCount: projectTasks.length, pendingCount: pending };
    });
    return json(200, { ok: true, projects: enriched, total: enriched.length });
  } catch {
    return json(500, { ok: false, error: 'Erro ao carregar projetos' });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const action = safeText(body.action || 'create', 40);
  const id = safeText(body.id || body.projectId, 60);

  try {
    if (action === 'create' || !action) {
      const title = safeText(body.title, 200);
      if (!title) return json(400, { ok: false, error: 'Título obrigatório' });
      const project = {
        id: generateId(),
        title,
        description: safeText(body.description, 2000),
        color: safeText(body.color, 20) || '#6366F1',
        icon: safeText(body.icon, 50) || 'briefcase-business',
        status: 'active',
        progress: 0,
        ownerId: session.sub,
        ownerName: session.name || session.email || session.sub,
        members: [],
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 10).map(t => safeText(t, 50)) : [],
        dueDate: safeText(body.dueDate, 30) || null,
        createdAt: now(),
        updatedAt: now(),
      };
      const projects = await getProjects(kv, session.sub);
      projects.unshift(project);
      await saveProjects(kv, session.sub, projects);
      await appendHistory(kv, session.sub, project.id, { action: 'created', by: session.sub, title: project.title });
      return json(201, { ok: true, project });
    }

    if (action === 'edit' || action === 'update') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const idx = projects.findIndex(p => p.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
      const existing = projects[idx];
      const changes = {};
      if (body.title !== undefined) changes.title = safeText(body.title, 200);
      if (body.description !== undefined) changes.description = safeText(body.description, 2000);
      if (body.color !== undefined) changes.color = safeText(body.color, 20);
      if (body.icon !== undefined) changes.icon = safeText(body.icon, 50);
      if (body.progress !== undefined) changes.progress = Math.min(100, Math.max(0, Number(body.progress) || 0));
      if (body.dueDate !== undefined) changes.dueDate = safeText(body.dueDate, 30) || null;
      if (body.tags !== undefined) changes.tags = Array.isArray(body.tags) ? body.tags.slice(0, 10).map(t => safeText(t, 50)) : [];
      if (body.status !== undefined) changes.status = safeText(body.status, 20);
      const updated = { ...existing, ...changes, updatedAt: now(), updatedBy: session.sub };
      projects[idx] = updated;
      await saveProjects(kv, session.sub, projects);
      await appendHistory(kv, session.sub, id, { action: 'edited', by: session.sub, changes: Object.keys(changes) });
      return json(200, { ok: true, project: updated });
    }

    if (action === 'delete') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const idx = projects.findIndex(p => p.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
      const [removed] = projects.splice(idx, 1);
      await saveProjects(kv, session.sub, projects);
      await kv.delete(`projects:history:${session.sub}:${id}`);
      return json(200, { ok: true, deleted: id, title: removed.title });
    }

    if (action === 'archive') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const idx = projects.findIndex(p => p.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
      projects[idx].status = 'archived';
      projects[idx].archivedAt = now();
      projects[idx].updatedAt = now();
      projects[idx].updatedBy = session.sub;
      await saveProjects(kv, session.sub, projects);
      await appendHistory(kv, session.sub, id, { action: 'archived', by: session.sub });
      return json(200, { ok: true, project: projects[idx] });
    }

    if (action === 'restore') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const idx = projects.findIndex(p => p.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
      projects[idx].status = 'active';
      delete projects[idx].archivedAt;
      projects[idx].updatedAt = now();
      projects[idx].updatedBy = session.sub;
      await saveProjects(kv, session.sub, projects);
      await appendHistory(kv, session.sub, id, { action: 'restored', by: session.sub });
      return json(200, { ok: true, project: projects[idx] });
    }

    if (action === 'duplicate') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const original = projects.find(p => p.id === id);
      if (!original) return json(404, { ok: false, error: 'Projeto não encontrado' });
      const copy = {
        ...original,
        id: generateId(),
        title: `${original.title} (cópia)`,
        status: 'active',
        progress: 0,
        ownerId: session.sub,
        ownerName: session.name || session.email || session.sub,
        members: [],
        createdAt: now(),
        updatedAt: now(),
        duplicatedFrom: id,
      };
      delete copy.archivedAt;
      projects.unshift(copy);
      await saveProjects(kv, session.sub, projects);
      await appendHistory(kv, session.sub, copy.id, { action: 'duplicated', by: session.sub, fromId: id });
      return json(201, { ok: true, project: copy });
    }

    if (action === 'share') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const targetEmail = safeText(body.email, 200);
      const permission = safeText(body.permission, 20) || 'view';
      if (!targetEmail) return json(400, { ok: false, error: 'Email do destinatário obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const project = projects.find(p => p.id === id);
      if (!project) return json(404, { ok: false, error: 'Projeto não encontrado' });
      const shareKey = `projects:share:${id}:${targetEmail}`;
      await kv.put(shareKey, JSON.stringify({
        projectId: id,
        ownerId: session.sub,
        targetEmail,
        permission,
        sharedAt: now(),
        projectTitle: project.title,
      }));
      const idx = projects.findIndex(p => p.id === id);
      if (idx !== -1) {
        projects[idx].members = projects[idx].members || [];
        const existing = projects[idx].members.find(m => m.email === targetEmail);
        if (!existing) {
          projects[idx].members.push({ email: targetEmail, permission, addedAt: now() });
        } else {
          existing.permission = permission;
        }
        projects[idx].updatedAt = now();
        await saveProjects(kv, session.sub, projects);
      }
      await appendHistory(kv, session.sub, id, { action: 'shared', by: session.sub, with: targetEmail, permission });
      return json(200, { ok: true, shared: true, email: targetEmail, permission });
    }

    if (action === 'transfer') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const newOwnerEmail = safeText(body.newOwnerEmail || body.email, 200);
      if (!newOwnerEmail) return json(400, { ok: false, error: 'Email do novo proprietário obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const idx = projects.findIndex(p => p.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
      const previousOwner = projects[idx].ownerId;
      projects[idx].previousOwnerId = previousOwner;
      projects[idx].ownerEmail = newOwnerEmail;
      projects[idx].transferredAt = now();
      projects[idx].updatedAt = now();
      projects[idx].updatedBy = session.sub;
      await saveProjects(kv, session.sub, projects);
      await kv.put(`projects:transfer:${id}`, JSON.stringify({
        projectId: id,
        fromUserId: session.sub,
        toEmail: newOwnerEmail,
        transferredAt: now(),
        projectTitle: projects[idx].title,
      }));
      await appendHistory(kv, session.sub, id, { action: 'transferred', by: session.sub, toEmail: newOwnerEmail });
      return json(200, { ok: true, transferred: true, newOwnerEmail, projectId: id });
    }

    if (action === 'autosave') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const idx = projects.findIndex(p => p.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
      const changes = {};
      if (body.title !== undefined) changes.title = safeText(body.title, 200);
      if (body.description !== undefined) changes.description = safeText(body.description, 2000);
      if (body.progress !== undefined) changes.progress = Math.min(100, Math.max(0, Number(body.progress) || 0));
      if (body.color !== undefined) changes.color = safeText(body.color, 20);
      if (body.icon !== undefined) changes.icon = safeText(body.icon, 50);
      if (body.dueDate !== undefined) changes.dueDate = safeText(body.dueDate, 30) || null;
      projects[idx] = { ...projects[idx], ...changes, updatedAt: now(), lastAutosave: now() };
      await saveProjects(kv, session.sub, projects);
      return json(200, { ok: true, autosaved: true, projectId: id, savedAt: projects[idx].updatedAt });
    }

    if (action === 'complete') {
      if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
      const projects = await getProjects(kv, session.sub);
      const idx = projects.findIndex(p => p.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
      projects[idx].status = 'completed';
      projects[idx].progress = 100;
      projects[idx].completedAt = now();
      projects[idx].updatedAt = now();
      projects[idx].updatedBy = session.sub;
      await saveProjects(kv, session.sub, projects);
      await appendHistory(kv, session.sub, id, { action: 'completed', by: session.sub });
      return json(200, { ok: true, project: projects[idx] });
    }

    return json(400, { ok: false, error: `Ação inválida: ${action}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar projeto';
    return json(500, { ok: false, error: message });
  }
}

export async function onRequestPut({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const url = new URL(request.url);
  const id = safeText(body.id || body.projectId || url.searchParams.get('id'), 60);
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const projects = await getProjects(kv, session.sub);
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
    const existing = projects[idx];
    const updated = {
      ...existing,
      title: body.title !== undefined ? safeText(body.title, 200) : existing.title,
      description: body.description !== undefined ? safeText(body.description, 2000) : existing.description,
      color: body.color !== undefined ? safeText(body.color, 20) : existing.color,
      icon: body.icon !== undefined ? safeText(body.icon, 50) : existing.icon,
      progress: body.progress !== undefined ? Math.min(100, Math.max(0, Number(body.progress) || 0)) : existing.progress,
      dueDate: body.dueDate !== undefined ? (safeText(body.dueDate, 30) || null) : existing.dueDate,
      tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags.slice(0, 10).map(t => safeText(t, 50)) : existing.tags) : existing.tags,
      status: body.status !== undefined ? safeText(body.status, 20) : existing.status,
      updatedAt: now(),
      updatedBy: session.sub,
    };
    projects[idx] = updated;
    await saveProjects(kv, session.sub, projects);
    await appendHistory(kv, session.sub, id, { action: 'edited', by: session.sub });
    return json(200, { ok: true, project: updated });
  } catch {
    return json(500, { ok: false, error: 'Erro ao atualizar projeto' });
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await getAuth(request, env);
  if (auth.error) return auth.error;
  const { session, kv } = auth;

  const url = new URL(request.url);
  const id = safeText(url.searchParams.get('id'), 60);
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  try {
    const projects = await getProjects(kv, session.sub);
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return json(404, { ok: false, error: 'Projeto não encontrado' });
    const [removed] = projects.splice(idx, 1);
    await saveProjects(kv, session.sub, projects);
    await kv.delete(`projects:history:${session.sub}:${id}`);
    return json(200, { ok: true, deleted: id, title: removed.title });
  } catch {
    return json(500, { ok: false, error: 'Erro ao deletar projeto' });
  }
}

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST') return onRequestPost({ request, env });
  if (method === 'PUT') return onRequestPut({ request, env });
  if (method === 'DELETE') return onRequestDelete({ request, env });
  if (method === 'PATCH') return onRequestPost({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
