// LifeOS Enterprise — Organization API v2.0
// Cloudflare Pages Function: GET/POST /api/organization
// Phase 336 — Commercial Audit: qualquer usuário autenticado pode criar organização
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
    // FASE 336 FIX: qualquer usuário autenticado pode criar sua organização
    const name = String(input.name || '').trim();
    const domain = String(input.domain || '').trim();
    const size = String(input.size || '6-25').trim();
    if (!name || name.length < 2 || name.length > 100) {
      return json(400, { ok: false, error: 'Nome deve ter entre 2 e 100 caracteres' });
    }
    // Admins usam org:default; usuários comuns usam org:user:<email>
    const orgKey = session.role === 'admin'
      ? 'org:default'
      : `org:user:${session.sub}`;
    const org = {
      id: `org_${Date.now()}`,
      name,
      domain,
      size,
      slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      timezone: input.timezone || 'America/Sao_Paulo',
      locale: input.locale || 'pt-BR',
      ownerId: session.sub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await env.LIFEOS_KV.put(orgKey, JSON.stringify(org));
      return json(201, { ok: true, organization: org });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao criar organização' });
    }
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
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
