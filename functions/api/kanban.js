// LifeOS Enterprise — Kanban API
// Cloudflare Pages Function: GET/PUT /api/kanban
// Storage: KV (LIFEOS_KV)

import { json, verifySession, getCookie } from '../_auth.js';

const DEFAULT_BOARD = {
  columns: [
    { id: 'todo', name: 'A fazer', color: '#6366F1' },
    { id: 'doing', name: 'Em andamento', color: '#F59E0B' },
    { id: 'done', name: 'Concluído', color: '#10B981' }
  ],
  cards: []
};

export async function onRequest(request) {
  const env = request.env;
  const path = new URL(request.url).pathname;

  // GET /api/kanban — Listar board
  if (request.method === 'GET') {
    try {
      const board = await env.LIFEOS_KV.get('kanban:board', { type: 'json' });
      return json(200, { ok: true, board: board || DEFAULT_BOARD });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  // PUT /api/kanban — Salvar board
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      await env.LIFEOS_KV.put('kanban:board', JSON.stringify(body));
      return json(200, { ok: true });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  return json(405, { ok: false, error: 'Método não permitido' });
}
