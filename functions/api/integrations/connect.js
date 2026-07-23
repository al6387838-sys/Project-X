// LifeOS Enterprise — Integrations Connect v1.0
// Cloudflare Pages Function: POST /api/integrations/connect
// Delega para /api/integrations com action=connect
import { getCookie, json, verifySession } from '../../_auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Serviço temporariamente indisponível.' });
  }

  const token = getCookie(request, 'lifeos_session');
  if (!token) return json(401, { ok: false, error: 'Não autenticado' });

  let session;
  try {
    session = await verifySession(token, env.LIFEOS_SESSION_SECRET);
  } catch {
    return json(401, { ok: false, error: 'Sessão inválida' });
  }

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const { provider, type } = body;
  if (!provider) return json(400, { ok: false, error: 'provider é obrigatório' });

  // Verificar se o provider OAuth está configurado
  const oauthProviders = {
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
    apple: env.APPLE_CLIENT_ID && env.APPLE_PRIVATE_KEY,
    microsoft: false, // Não implementado ainda
  };

  const providerKey = provider.toLowerCase();

  if (oauthProviders[providerKey] === false) {
    return json(200, {
      ok: false,
      error: `Integração com ${provider} requer configuração das variáveis de ambiente (${providerKey.toUpperCase()}_CLIENT_ID, ${providerKey.toUpperCase()}_CLIENT_SECRET).`,
      requiresConfig: true,
      provider,
      type,
    });
  }

  if (!oauthProviders[providerKey]) {
    return json(200, {
      ok: false,
      error: `Provedor "${provider}" não configurado. Configure as credenciais OAuth no painel Cloudflare.`,
      requiresConfig: true,
      provider,
      type,
    });
  }

  // Gerar URL de autorização OAuth baseada no tipo
  let authUrl = null;
  const state = Buffer.from(JSON.stringify({ provider, type, userId: session.sub, ts: Date.now() })).toString('base64');

  if (providerKey === 'google') {
    const scope = type === 'calendar'
      ? 'https://www.googleapis.com/auth/calendar'
      : type === 'email'
      ? 'https://mail.google.com/'
      : 'https://www.googleapis.com/auth/userinfo.email';

    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent('https://lifeos-enterprise.pages.dev/api/auth/google/callback')}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}&` +
      `access_type=offline&prompt=consent`;
  }

  if (authUrl) {
    return json(200, { ok: true, authUrl, provider, type });
  }

  return json(200, {
    ok: false,
    error: `Não foi possível gerar URL de autorização para ${provider}.`,
    provider,
    type,
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST, OPTIONS' });
}
