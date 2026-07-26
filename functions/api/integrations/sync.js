// LifeOS Enterprise — Integrations Sync v2.0
// Cloudflare Pages Function: POST /api/integrations/sync
// Sincroniza uma integração específica com chamadas reais à API do provider
import { getCookie, json, verifySession } from '../../_auth.js';

const SYNC_PROVIDERS = {
  google_oauth: {
    name: 'Google',
    profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  gmail_api: {
    name: 'Gmail',
    inboxUrl: 'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=1',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  microsoft_365: {
    name: 'Microsoft 365',
    profileUrl: 'https://graph.microsoft.com/v1.0/me',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
  whatsapp_business: {
    name: 'WhatsApp Business',
    apiUrl: 'https://graph.facebook.com/v18.0',
  },
  stripe: {
    name: 'Stripe',
    balanceUrl: 'https://api.stripe.com/v1/balance',
  },
  mercado_pago: {
    name: 'Mercado Pago',
    accountUrl: 'https://api.mercadopago.com/v1/account/bank_report/config',
  },
  open_finance: {
    name: 'Open Finance Brasil',
    accountsUrl: 'https://api.openfinancebrasil.org.br/open-banking/accounts/v2/accounts',
    tokenUrl: 'https://auth.openfinancebrasil.org.br/oauth2/token',
  },
};

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

  const syncConfig = SYNC_PROVIDERS[id];
  if (!syncConfig) {
    // Fallback: atualizar apenas timestamp para integrações sem sync API
    const key = `integration:${session.sub}:${id}`;
    const raw = await env.LIFEOS_KV.get(key);
    if (!raw) return json(404, { ok: false, error: `Integração "${id}" não encontrada. Conecte primeiro.` });
    const integration = JSON.parse(raw);
    integration.lastSyncAt = new Date().toISOString();
    integration.syncCount = (integration.syncCount || 0) + 1;
    integration.syncStatus = 'idle';
    await env.LIFEOS_KV.put(key, JSON.stringify(integration));
    return json(200, {
      ok: true,
      message: `Integração "${id}" registrada como sincronizada.`,
      integration: { id, lastSyncAt: integration.lastSyncAt, syncCount: integration.syncCount },
    });
  }

  // Sync REAL: chamar API do provider
  const key = `integration:${session.sub}:${id}`;
  const raw = await env.LIFEOS_KV.get(key);
  if (!raw) return json(404, { ok: false, error: `Integração "${id}" não encontrada. Conecte primeiro.` });
  const integration = JSON.parse(raw);

  try {
    let syncOk = false;
    let syncDetails = {};

    if (id === 'google_oauth' || id === 'gmail_api') {
      const tokenKey = `oauth:token:${session.sub}:${id}`;
      const tokenRaw = await env.LIFEOS_KV.get(tokenKey);
      const tokenData = tokenRaw ? JSON.parse(tokenRaw) : null;
      const accessToken = tokenData?.access_token;
      if (accessToken) {
        const url = id === 'gmail_api' ? syncConfig.inboxUrl : syncConfig.profileUrl;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (res.ok) {
          syncOk = true;
          const data = await res.json();
          if (id === 'gmail_api') syncDetails = { messageCount: data.resultSizeEstimate || 0 };
          else syncDetails = { email: data.email, name: data.name };
        } else if (res.status === 401 && tokenData?.refresh_token) {
          // Tentar refresh
          const refreshRes = await fetch(syncConfig.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: tokenData.refresh_token,
              client_id: env.GOOGLE_CLIENT_ID || '',
              client_secret: env.GOOGLE_CLIENT_SECRET || '',
            }),
          });
          if (refreshRes.ok) {
            const newToken = await refreshRes.json();
            const updated = { ...tokenData, access_token: newToken.access_token, expires_at: Date.now() + (newToken.expires_in || 3600) * 1000 };
            if (newToken.refresh_token) updated.refresh_token = newToken.refresh_token;
            await env.LIFEOS_KV.put(tokenKey, JSON.stringify(updated));
            // Retry with new token
            const retryRes = await fetch(url, { headers: { 'Authorization': `Bearer ${newToken.access_token}` } });
            if (retryRes.ok) {
              syncOk = true;
              const data = await retryRes.json();
              if (id === 'gmail_api') syncDetails = { messageCount: data.resultSizeEstimate || 0, tokenRefreshed: true };
              else syncDetails = { email: data.email, name: data.name, tokenRefreshed: true };
            }
          }
        }
      }
    } else if (id === 'microsoft_365') {
      const tokenKey = `oauth:token:${session.sub}:${id}`;
      const tokenRaw = await env.LIFEOS_KV.get(tokenKey);
      const tokenData = tokenRaw ? JSON.parse(tokenRaw) : null;
      const accessToken = tokenData?.access_token;
      if (accessToken) {
        const res = await fetch(syncConfig.profileUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (res.ok) {
          syncOk = true;
          const data = await res.json();
          syncDetails = { email: data.mail || data.userPrincipalName, name: data.displayName };
        }
      }
    } else if (id === 'whatsapp_business') {
      const phoneId = env.WHATSAPP_PHONE_ID;
      const accessToken = env.WHATSAPP_ACCESS_TOKEN;
      if (phoneId && accessToken) {
        const res = await fetch(`${syncConfig.apiUrl}/${phoneId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (res.ok) {
          syncOk = true;
          const data = await res.json();
          syncDetails = { phoneId: data.id, displayName: data.display_phone_number };
        }
      }
    } else if (id === 'stripe') {
      const res = await fetch(syncConfig.balanceUrl, {
        headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
      });
      if (res.ok) {
        syncOk = true;
        const data = await res.json();
        syncDetails = { available: data.available?.[0]?.amount || 0, currency: data.available?.[0]?.currency || 'brl' };
      }
    } else if (id === 'mercado_pago') {
      const res = await fetch(syncConfig.accountUrl, {
        headers: { 'Authorization': `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      if (res.ok) {
        syncOk = true;
        syncDetails = { verified: true };
      }
    } else if (id === 'open_finance') {
      const ofKey = `openfinance:${session.sub}`;
      const ofRaw = await env.LIFEOS_KV.get(ofKey);
      const ofData = ofRaw ? JSON.parse(ofRaw) : {};
      const accessToken = ofData.accessToken;
      if (accessToken) {
        const res = await fetch(syncConfig.accountsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (res.ok) {
          syncOk = true;
          const data = await res.json();
          syncDetails = { accountCount: (data.data || data).length || 0 };
        }
      }
    }

    integration.lastSyncAt = new Date().toISOString();
    integration.syncCount = (integration.syncCount || 0) + 1;
    integration.syncStatus = syncOk ? 'synced' : 'partial';
    integration.syncDetails = syncDetails;
    await env.LIFEOS_KV.put(key, JSON.stringify(integration));

    // Log
    const logsKey = `audit:sync:${session.sub}`;
    const logsRaw = await env.LIFEOS_KV.get(logsKey);
    const logs = logsRaw ? JSON.parse(logsRaw) : [];
    logs.unshift({
      id: crypto.randomUUID().slice(0, 8),
      integrationId: id,
      status: syncOk ? 'success' : 'partial',
      details: syncDetails,
      timestamp: new Date().toISOString(),
    });
    await env.LIFEOS_KV.put(logsKey, JSON.stringify(logs.slice(0, 100)));

    return json(200, {
      ok: true,
      message: syncOk ? `Integração "${id}" sincronizada com sucesso.` : `Sincronização parcial para "${id}".`,
      integration: { id, lastSyncAt: integration.lastSyncAt, syncCount: integration.syncCount, syncStatus: integration.syncStatus },
      details: syncDetails,
    });
  } catch (err) {
    integration.lastSyncAt = new Date().toISOString();
    integration.syncStatus = 'error';
    integration.syncError = err.message;
    await env.LIFEOS_KV.put(key, JSON.stringify(integration));
    return json(500, { ok: false, error: 'Erro ao sincronizar: ' + err.message });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' || request.method === 'DELETE') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST, OPTIONS' });
}
