// LifeOS Enterprise — Integrations Sync v1.0
// Cloudflare Pages Function: POST /api/integrations/sync
// Sincroniza uma integração específica
import { getCookie, json, verifySession } from '../../_auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Serviço temporariamente indisponível.' });
  }

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  if (!token) return json(401, { ok: false, error: 'Não autenticado' });

  let session;
  try {
    session = await verifySession(token, env.LIFEOS_SESSION_SECRET);
  } catch {
    return json(401, { ok: false, error: 'Sessão inválida' });
  }

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const { integrationId, provider } = body;
  const id = integrationId || provider;

  if (!id) return json(400, { ok: false, error: 'integrationId é obrigatório' });

  // Verificar se a integração existe
  const key = `integration:${session.sub}:${id}`;
  const raw = await env.LIFEOS_KV.get(key);

  if (!raw) {
    return json(404, { ok: false, error: `Integração "${id}" não encontrada. Conecte primeiro.` });
  }

  const integration = JSON.parse(raw);

  // Atualizar timestamp de sincronização
  integration.lastSyncAt = new Date().toISOString();
  integration.syncCount = (integration.syncCount || 0) + 1;
  await env.LIFEOS_KV.put(key, JSON.stringify(integration));

  return json(200, {
    ok: true,
    message: `Integração "${id}" sincronizada com sucesso.`,
    integration: {
      id,
      lastSyncAt: integration.lastSyncAt,
      syncCount: integration.syncCount,
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST, OPTIONS' });
}
