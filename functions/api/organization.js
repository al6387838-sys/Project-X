// LifeOS Enterprise — Organization API v1.0
// Cloudflare Pages Function: GET/POST /api/organization
// Phase 131 — Real Data Foundation
// Organização persistida no Cloudflare KV
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let org = null;
  if (env.LIFEOS_KV) {
    try {
      // Organização do usuário (ou organização da conta admin)
      const orgKey = session.role === 'admin'
        ? 'org:default'
        : `org:user:${session.sub}`;
      const raw = await env.LIFEOS_KV.get(orgKey);
      if (raw) org = JSON.parse(raw);
    } catch (_) { /* KV indisponível */ }
  }

  return json(200, { ok: true, organization: org });
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

  const action = String(input.action || 'update');

  if (action === 'create') {
    if (session.role !== 'admin') return json(403, { ok: false, error: 'Acesso negado' });

    const name = String(input.name || '').trim();
    const domain = String(input.domain || '').trim();
    if (!name || name.length < 2) return json(400, { ok: false, error: 'Nome inválido' });

    const org = {
      id: `org_${Date.now()}`,
      name,
      domain,
      slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      timezone: input.timezone || 'America/Sao_Paulo',
      locale: input.locale || 'pt-BR',
      ownerId: session.sub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await env.LIFEOS_KV.put('org:default', JSON.stringify(org));
    return json(201, { ok: true, organization: org });
  }

  if (action === 'update') {
    const orgKey = session.role === 'admin' ? 'org:default' : `org:user:${session.sub}`;
    try {
      const raw = await env.LIFEOS_KV.get(orgKey);
      if (!raw) return json(404, { ok: false, error: 'Organização não encontrada' });

      const current = JSON.parse(raw);
      const { action: _, ...updates } = input;
      const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
      await env.LIFEOS_KV.put(orgKey, JSON.stringify(updated));
      return json(200, { ok: true, organization: updated });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao atualizar organização' });
    }
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
