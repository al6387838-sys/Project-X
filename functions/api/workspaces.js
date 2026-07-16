// LifeOS Enterprise — Workspaces API v1.0
// Cloudflare Pages Function: GET/POST /api/workspaces
// Phase 131 — Real Data Foundation
// Workspaces persistidos no Cloudflare KV
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let workspaces = [];
  if (env.LIFEOS_KV) {
    try {
      const raw = await env.LIFEOS_KV.get(`workspaces:${session.sub}`);
      if (raw) workspaces = JSON.parse(raw);
    } catch (_) { /* KV indisponível */ }
  }

  return json(200, { ok: true, workspaces });
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  if (!env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Armazenamento não disponível' });
  }

  const action = String(input.action || 'create');

  if (action === 'create') {
    const name = String(input.name || '').trim();
    const description = String(input.description || '').trim();
    const icon = String(input.icon || '📁').trim();
    const color = String(input.color || '#3B82F6').trim();

    if (!name || name.length < 2 || name.length > 100) {
      return json(400, { ok: false, error: 'Nome deve ter entre 2 e 100 caracteres' });
    }

    try {
      const raw = await env.LIFEOS_KV.get(`workspaces:${session.sub}`);
      const workspaces = raw ? JSON.parse(raw) : [];

      if (workspaces.length >= 20) {
        return json(429, { ok: false, error: 'Limite de 20 workspaces atingido' });
      }

      const workspace = {
        id: `ws_${crypto.randomUUID().replace(/-/g,'').slice(0,16)}`,
        name,
        description,
        icon,
        color,
        ownerId: session.sub,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDefault: workspaces.length === 0,
      };

      workspaces.push(workspace);
      await env.LIFEOS_KV.put(`workspaces:${session.sub}`, JSON.stringify(workspaces));
      return json(201, { ok: true, workspace });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao criar workspace' });
    }
  }

  if (action === 'update') {
    const id = String(input.id || '');
    if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

    try {
      const raw = await env.LIFEOS_KV.get(`workspaces:${session.sub}`);
      let workspaces = raw ? JSON.parse(raw) : [];
      const idx = workspaces.findIndex(w => w.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'Workspace não encontrado' });

      const { action: _, id: __, ...updates } = input;
      workspaces[idx] = { ...workspaces[idx], ...updates, updatedAt: new Date().toISOString() };
      await env.LIFEOS_KV.put(`workspaces:${session.sub}`, JSON.stringify(workspaces));
      return json(200, { ok: true, workspace: workspaces[idx] });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao atualizar workspace' });
    }
  }

  if (action === 'delete') {
    const id = String(input.id || '');
    if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

    try {
      const raw = await env.LIFEOS_KV.get(`workspaces:${session.sub}`);
      let workspaces = raw ? JSON.parse(raw) : [];
      const ws = workspaces.find(w => w.id === id);
      if (!ws) return json(404, { ok: false, error: 'Workspace não encontrado' });
      if (ws.isDefault) return json(400, { ok: false, error: 'Não é possível excluir o workspace padrão' });

      workspaces = workspaces.filter(w => w.id !== id);
      await env.LIFEOS_KV.put(`workspaces:${session.sub}`, JSON.stringify(workspaces));
      return json(200, { ok: true, message: 'Workspace excluído' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao excluir workspace' });
    }
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
