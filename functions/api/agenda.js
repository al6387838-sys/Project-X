// LifeOS Enterprise — Agenda API
// Storage: KV (LIFEOS_KV)

export async function onRequest(request) {
  const env = request.env;
  const path = new URL(request.url).pathname;

  // GET /api/agenda — Listar eventos
  if (request.method === 'GET' && path === '/api/agenda') {
    try {
      const events = await env.LIFEOS_KV.get('agenda:events', { type: 'json' });
      return new Response(JSON.stringify({ ok: true, events: events || [] }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // POST /api/agenda — Criar evento
  if (request.method === 'POST' && path === '/api/agenda') {
    try {
      const input = await request.json();
      const events = await env.LIFEOS_KV.get('agenda:events', { type: 'json' }) || [];
      const event = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: new Date().toISOString()
      };
      events.push(event);
      await env.LIFEOS_KV.put('agenda:events', JSON.stringify(events));
      return new Response(JSON.stringify({ ok: true, event }), {
        status: 201,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // DELETE /api/agenda/:id — Excluir evento
  if (request.method === 'DELETE' && path.startsWith('/api/agenda/')) {
    try {
      const id = path.replace('/api/agenda/', '');
      const events = await env.LIFEOS_KV.get('agenda:events', { type: 'json' }) || [];
      const filtered = events.filter(e => e.id !== id);
      await env.LIFEOS_KV.put('agenda:events', JSON.stringify(filtered));
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
