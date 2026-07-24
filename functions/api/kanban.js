// LifeOS Enterprise — Kanban API
// Storage: KV (LIFEOS_KV)

export async function onRequest(request) {
  const env = request.env;
  const path = new URL(request.url).pathname;

  // GET /api/kanban — Listar board
  if (request.method === 'GET') {
    try {
      const board = await env.LIFEOS_KV.get('kanban:board', { type: 'json' });
      const defaultBoard = {
        columns: [
          { id: 'todo', name: 'A fazer', color: '#6366F1' },
          { id: 'doing', name: 'Em andamento', color: '#F59E0B' },
          { id: 'done', name: 'Concluído', color: '#10B981' }
        ],
        cards: []
      };
      return new Response(JSON.stringify({ ok: true, board: board || defaultBoard }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // PUT /api/kanban — Salvar board
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      await env.LIFEOS_KV.put('kanban:board', JSON.stringify(body));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), {
    status: 405,
    headers: { 'content-type': 'application/json' }
  });
}
