// LifeOS Enterprise — Integrations Connect v3.0
// Cloudflare Pages Function: POST /api/integrations/connect
// Phase 066 — Google Ecosystem Activation
// Correções:
//   - Escopos Google Calendar incluem openid email profile (necessário para refresh token)
//   - Escopos Gmail incluem gmail.modify (necessário para marcar como lido, mover para lixeira)
//   - Disconnect limpa todas as chaves KV relacionadas (google_oauth, gmail_api, google)
import { getCookie, json, verifySession } from '../../_auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Serviço temporariamente indisponível.' });
  }

  const kv = env.LIFEOS_KV;
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

  const { provider, type } = body;
  if (!provider) return json(400, { ok: false, error: 'provider é obrigatório' });

  const origin = new URL(request.url).origin;

  // Verificar se o provider OAuth está configurado
  const oauthProviders = {
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
    apple: env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET,
    microsoft: env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET,
    outlook: env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET,
    meta: env.META_CLIENT_ID && env.META_CLIENT_SECRET,
    facebook: env.META_CLIENT_ID && env.META_CLIENT_SECRET,
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
  const state = btoa(JSON.stringify({ provider, type, userId: session.sub, ts: Date.now() }));

  if (providerKey === 'google') {
    // Escopos mínimos sempre incluem openid email profile para garantir refresh_token
    // e identificação do usuário. Escopos adicionais por tipo.
    let scope;
    if (type === 'calendar') {
      scope = 'openid email profile https://www.googleapis.com/auth/calendar';
    } else if (type === 'email') {
      scope = 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify';
    } else {
      // Tipo genérico: apenas autenticação + perfil
      scope = 'openid email profile';
    }

    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(`${origin}/api/oauth/callback/google`)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}&` +
      `access_type=offline&prompt=consent`;
  }

  if ((providerKey === 'microsoft' || providerKey === 'outlook') && env.MICROSOFT_CLIENT_ID) {
    const scope = type === 'calendar'
      ? 'openid email profile offline_access https://graph.microsoft.com/Calendars.ReadWrite'
      : type === 'email'
      ? 'openid email profile offline_access Mail.Read Mail.Send Mail.ReadWrite User.Read'
      : 'openid email profile offline_access User.Read';

    authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(env.MICROSOFT_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(`${origin}/api/oauth/callback/microsoft`)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}&` +
      `prompt=consent`;
  }

  if (providerKey === 'apple' && env.APPLE_CLIENT_ID) {
    authUrl = `https://appleid.apple.com/auth/authorize?` +
      `client_id=${encodeURIComponent(env.APPLE_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(`${origin}/api/oauth/callback/apple`)}&` +
      `response_type=code&` +
      `response_mode=form_post&` +
      `scope=${encodeURIComponent('email name')}&` +
      `state=${encodeURIComponent(state)}`;
  }

  if ((providerKey === 'meta' || providerKey === 'facebook') && env.META_CLIENT_ID) {
    authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${encodeURIComponent(env.META_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(`${origin}/api/oauth/callback/meta`)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('email,public_profile,user_friends')}&` +
      `state=${encodeURIComponent(state)}`;
  }

  if (authUrl) {
    // Salvar state no KV para validação no callback
    await kv.put(`oauth:state:${state}`, JSON.stringify({ userId: session.sub, provider: providerKey, type, redirectUri: `${origin}/api/oauth/callback/${providerKey}` }), { expirationTtl: 600 });
    return json(200, { ok: true, authUrl, provider, type });
  }

  // Handle disconnect
  if (providerKey && type === 'disconnect') {
    try {
      // Para Google, limpar todas as chaves relacionadas
      const keysToDelete = providerKey === 'google'
        ? [
            `oauth:${session.sub}:google`,
            `oauth:token:${session.sub}:google_oauth`,
            `oauth:token:${session.sub}:gmail_api`,
            `integration:${session.sub}:google`,
            `integration:${session.sub}:google_oauth`,
            `integration:${session.sub}:gmail_api`,
          ]
        : [
            `oauth:${session.sub}:${providerKey}`,
            `integration:${session.sub}:${providerKey}`,
          ];

      for (const key of keysToDelete) {
        await kv.delete(key).catch(() => {});
      }
      return json(200, { ok: true, provider: providerKey, disconnected: true });
    } catch {
      return json(200, { ok: false, error: 'Erro ao desconectar', provider: providerKey });
    }
  }

  return json(200, {
    ok: false,
    error: `Não foi possível gerar URL de autorização para ${provider}.`,
    provider,
    type,
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' || request.method === 'DELETE') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST, OPTIONS' });
}
