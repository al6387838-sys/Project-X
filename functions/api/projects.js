// LifeOS Enterprise — Projects API v1.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/projects
// Phase 200 — Real Data Migration (zero mocks)
import { getCookie, json, verifySession } from '../_auth.js';

const MAX_STRING_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
function sanitizeInput(value) {
  if (typeof value !== 'string') return '';
  // Strip potentially dangerous HTML/JS
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .slice(0, MAX_STRING_LENGTH);
}
function validateTitle(title) {
  if (!title || typeof title !== 'string') return { valid: false, error: 'Título obrigatório' };
  const trimmed = title.trim();
  if (trimmed.length < 1) return { valid: false, error: 'Título não pode ser vazio' };
  if (trimmed.length > MAX_TITLE_LENGTH) return { valid: false, error: 'Título deve ter no máximo ' + MAX_TITLE_LENGTH + ' caracteres' };
  return { valid: true, value: trimmed };
}
function validateDescription(desc) {
  if (!desc) return { valid: true, value: '' };
  if (typeof desc !== 'string') return { valid: false, error: 'Descrição inválida' };
  const trimmed = desc.trim();
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) return { valid: false, error: 'Descrição deve ter no máximo ' + MAX_DESCRIPTION_LENGTH + ' caracteres' };
  return { valid: true, value: sanitizeInput(trimmed) };
}

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, projects: [], source: 'empty' });
  try {
    const raw = await kv.get(`projects:${session.sub}`);
    const projects = raw ? JSON.parse(raw) : [];
    // Enriquecer com contagem de tarefas
    const tasksRaw = await kv.get(`tasks:${session.sub}`);
    const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
    const enriched = projects.map(p => {
      const projectTasks = tasks.filter(t => t.workspaceId === p.id);
      const pending = projectTasks.filter(t => t.status !== 'done').length;
      return { ...p, taskCount: projectTasks.length, pendingCount: pending };
    });
    return json(200, { ok: true, projects: enriched, total: projects.length });
  } catch {
    return json(500, { ok: false, error: 'Erro ao carregar projetos' });
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
  const { title, description, color, icon, status } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json(400, { ok: false, error: 'Título obrigatório' });
  }
  const project = {
    id: generateId(),
    title: title.trim(),
    description: description?.trim() || '',
    color: color || '#6366F1',
    icon: icon || 'briefcase-business',
    status: status || 'active',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    const raw = await kv.get(`projects:${session.sub}`);
    const projects = raw ? JSON.parse(raw) : [];
    projects.unshift(project);
    await kv.put(`projects:${session.sub}`, JSON.stringify(projects));
    return json(201, { ok: true, project });
  } catch {
    return json(500, { ok: false, error: 'Erro ao salvar projeto' });
  }
}

export async function onRequestDelete({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });
  try {
    const raw = await kv.get(`projects:${session.sub}`);
    const projects = raw ? JSON.parse(raw) : [];
    const filtered = projects.filter(p => p.id !== id);
    await kv.put(`projects:${session.sub}`, JSON.stringify(filtered));
    return json(200, { ok: true, deleted: id });
  } catch {
    return json(500, { ok: false, error: 'Erro ao deletar projeto' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'DELETE') return onRequestDelete({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
