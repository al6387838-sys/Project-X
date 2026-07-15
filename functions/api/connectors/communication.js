// LifeOS Enterprise — Communication Connectors API v1.0
// Cloudflare Pages Function: GET/POST /api/connectors/communication
// Phase 133 — Communication Connectors
// Gerencia conexões com WhatsApp Business, Gmail e Outlook
import { getCookie, json, verifySession } from '../../_auth.js';

const PROVIDERS = {
  whatsapp: {
    name: 'WhatsApp Business',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    envKeys: ['WHATSAPP_APP_ID', 'WHATSAPP_APP_SECRET'],
    icon: 'smartphone',
    color: '#25D366',
  },
  gmail: {
    name: 'Gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    icon: 'mail',
    color: '#EA4335',
  },
  outlook: {
    name: 'Microsoft Outlook',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Mail.Read', 'Mail.Send', 'offline_access'],
    envKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    icon: 'mail',
    color: '#0078D4',
  },
};

function getConnectorStatus(providerKey, env) {
  const provider = PROVIDERS[providerKey];
  if (!provider) return null;
  const configured = provider.envKeys.every(key => !!env[key]);
  return {
    id: providerKey,
    name: provider.name,
    icon: provider.icon,
    color: provider.color,
    configured,
    connected: false, // será atualizado com dados do KV
    setupRequired: !configured,
    setupInstructions: configured ? null : `Configure ${provider.envKeys.join(' e ')} nas variáveis de ambiente do Cloudflare Pages.`,
  };
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  // Obter status de todos os conectores
  const connectors = Object.keys(PROVIDERS).map(key => getConnectorStatus(key, env));

  // Carregar conexões ativas do KV
  if (env.LIFEOS_KV) {
    try {
      const raw = await env.LIFEOS_KV.get(`connectors:comm:${session.sub}`);
      if (raw) {
        const connections = JSON.parse(raw);
        for (const connector of connectors) {
          const conn = connections[connector.id];
          if (conn) {
            connector.connected = conn.connected && new Date(conn.expiresAt) > new Date();
            connector.connectedAt = conn.connectedAt;
            connector.accountName = conn.accountName;
            connector.accountEmail = conn.accountEmail;
          }
        }
      }
    } catch (_) { /* KV indisponível */ }
  }

  return json(200, { ok: true, connectors });
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

  const action = String(input.action || '');
  const providerKey = String(input.provider || '');

  if (!PROVIDERS[providerKey]) {
    return json(400, { ok: false, error: 'Provedor inválido. Use: whatsapp, gmail ou outlook' });
  }

  const provider = PROVIDERS[providerKey];
  const url = new URL(request.url);

  if (action === 'connect') {
    // Verificar se credenciais estão configuradas
    const configured = provider.envKeys.every(key => !!env[key]);
    if (!configured) {
      return json(503, {
        ok: false,
        error: `${provider.name} requer configuração de credenciais.`,
        setup_required: true,
        missing_keys: provider.envKeys.filter(key => !env[key]),
        instructions: `Configure as seguintes variáveis no painel Cloudflare Pages → Settings → Environment Variables: ${provider.envKeys.join(', ')}`,
      });
    }

    // Gerar URL de autorização OAuth
    const clientId = env[provider.envKeys[0]];
    const redirectUri = `${url.origin}/api/connectors/communication/callback/${providerKey}`;
    const state = btoa(JSON.stringify({
      user: session.sub,
      provider: providerKey,
      ts: Date.now(),
      nonce: Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join(''),
    }));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state,
      access_type: 'offline',
    });

    const authUrl = `${provider.authUrl}?${params}`;
    return json(200, { ok: true, authUrl, provider: providerKey });
  }

  if (action === 'disconnect') {
    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento não disponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`connectors:comm:${session.sub}`);
      const connections = raw ? JSON.parse(raw) : {};
      delete connections[providerKey];
      await env.LIFEOS_KV.put(`connectors:comm:${session.sub}`, JSON.stringify(connections));
      return json(200, { ok: true, message: `${provider.name} desconectado com sucesso` });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao desconectar' });
    }
  }

  if (action === 'status') {
    const status = getConnectorStatus(providerKey, env);
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`connectors:comm:${session.sub}`);
        if (raw) {
          const connections = JSON.parse(raw);
          const conn = connections[providerKey];
          if (conn) {
            status.connected = conn.connected && new Date(conn.expiresAt) > new Date();
            status.connectedAt = conn.connectedAt;
            status.accountName = conn.accountName;
            status.accountEmail = conn.accountEmail;
          }
        }
      } catch (_) { /* ignorar */ }
    }
    return json(200, { ok: true, connector: status });
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: connect, disconnect, status' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
