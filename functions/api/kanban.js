// LifeOS Enterprise — Kanban API v2.0
// Cloudflare Pages Function: GET/POST/PUT/PATCH/DELETE /api/kanban
// Storage: KV (LIFEOS_KV)
import { getCookie, json, verifySession } from '../_auth.js';

const DEFAULT_BOARD = {
  columns: [
    { id: 'todo', name: 'A fazer', color: '#6366F1' },
    { id: 'doing', name: 'Em andamento', color: '#F59E0B' },
    { id: 'done', name: 'Concluído', color: '#10B981' },
  ],
  cards: [],
};

function safeText(value, max = 240) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max);
}

async function getBoard(kv, userId) {
  try {
    const raw = await kv.get(`kanban:${userId}`);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_BOARD));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_BOARD));
  }
}

async function saveBoard(kv, userId, board) {
  await kv.put(`kanban:${userId}`, JSON.stringify(board));
}

// GET /api/kanban
export async function onRequestGet({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const board = await getBoard(env.LIFEOS_KV, session.sub);
    return json(200, { ok: true, board });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// POST /api/kanban — Adicionar card
export async function onRequestPost({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const input = await request.json();
    const board = await getBoard(env.LIFEOS_KV, session.sub);

    // Adicionar coluna
    if (input.action === 'add-column') {
      const col = {
        id: crypto.randomUUID(),
        name: safeText(input.name || 'Nova coluna', 100),
        color: safeText(input.color || '#6366F1', 20),
      };
      board.columns.push(col);
      await saveBoard(env.LIFEOS_KV, session.sub, board);
      return json(201, { ok: true, column: col });
    }

    // Adicionar card
    const card = {
      id: crypto.randomUUID(),
      title: safeText(input.title || 'Novo card', 200),
      description: safeText(input.description || '', 1000),
      columnId: safeText(input.columnId || 'todo', 100),
      priority: safeText(input.priority || 'medium', 20),
      dueDate: safeText(input.dueDate || '', 20),
      tags: Array.isArray(input.tags) ? input.tags.map(t => safeText(t, 40)).slice(0, 10) : [],
      assignee: safeText(input.assignee || '', 100),
      ownerId: session.sub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    board.cards.push(card);
    await saveBoard(env.LIFEOS_KV, session.sub, board);
    return json(201, { ok: true, card });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// PUT /api/kanban — Salvar board completo ou mover card
export async function onRequestPut({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const input = await request.json();

    // Salvar board completo
    if (input.board) {
      await saveBoard(env.LIFEOS_KV, session.sub, input.board);
      return json(200, { ok: true });
    }

    // Atualizar card específico
    if (input.cardId) {
      const board = await getBoard(env.LIFEOS_KV, session.sub);
      const idx = board.cards.findIndex(c => c.id === input.cardId);
      if (idx === -1) return json(404, { ok: false, error: 'Card não encontrado' });

      const fields = ['title', 'description', 'columnId', 'priority', 'dueDate', 'tags', 'assignee'];
      fields.forEach(f => { if (input[f] !== undefined) board.cards[idx][f] = input[f]; });
      board.cards[idx].updatedAt = new Date().toISOString();

      await saveBoard(env.LIFEOS_KV, session.sub, board);
      return json(200, { ok: true, card: board.cards[idx] });
    }

    return json(400, { ok: false, error: 'Dados inválidos' });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// PATCH /api/kanban
export async function onRequestPatch({ request, env }) {
  return onRequestPut({ request, env });
}

// DELETE /api/kanban
export async function onRequestDelete({ request, env }) {
  try {
    const token = getCookie(request.headers.get('cookie'));
    const session = env.LIFEOS_SESSION_SECRET
      ? await verifySession(token, env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV)
      : { sub: 'default', role: 'user' };
    if (!session) return json(401, { ok: false, error: 'Sessão inválida' });

    const url = new URL(request.url);
    let cardId = url.searchParams.get('cardId');
    let columnId = url.searchParams.get('columnId');
    if (!cardId && !columnId) {
      try {
        const body = await request.clone().json();
        cardId = body.cardId || body.id;
        columnId = body.columnId;
      } catch { /* */ }
    }

    const board = await getBoard(env.LIFEOS_KV, session.sub);

    if (cardId) {
      board.cards = board.cards.filter(c => c.id !== cardId);
    } else if (columnId) {
      board.columns = board.columns.filter(c => c.id !== columnId);
      board.cards = board.cards.filter(c => c.columnId !== columnId);
    } else {
      return json(400, { ok: false, error: 'cardId ou columnId é obrigatório' });
    }

    await saveBoard(env.LIFEOS_KV, session.sub, board);
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// Roteador genérico
export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST') return onRequestPost({ request, env });
  if (method === 'PUT') return onRequestPut({ request, env });
  if (method === 'PATCH') return onRequestPatch({ request, env });
  if (method === 'DELETE') return onRequestDelete({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
