// LifeOS Enterprise — Agenda API
// Cloudflare Pages Function: GET/POST/DELETE /api/agenda
// Storage: KV (LIFEOS_KV)

import { json } from '../_auth.js';

export async function onRequest(request) {
  const env = request.env;
  const path = new URL(request.url).pathname;

  // GET /api/agenda — Listar eventos
  if (request.method === 'GET') {
    try {
      const events = await env.LIFEOS_KV.get('agenda:events', { type: 'json' });
      return json(200, { ok: true, events: events || [] });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  // POST /api/agenda — Criar evento
  if (request.method === 'POST') {
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
      return json(201, { ok: true, event });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  // DELETE /api/agenda/:id — Excluir evento
  if (request.method === 'DELETE' && path.startsWith('/api/agenda/')) {
    try {
      const id = path.replace('/api/agenda/', '');
      const events = await env.LIFEOS_KV.get('agenda:events', { type: 'json' }) || [];
      const filtered = events.filter(e => e.id !== id);
      await env.LIFEOS_KV.put('agenda:events', JSON.stringify(filtered));
      return json(200, { ok: true });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  return json(405, { ok: false, error: 'Método não permitido' });
}
