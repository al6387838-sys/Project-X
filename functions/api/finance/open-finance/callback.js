// LifeOS Enterprise — Open Finance Callback v1.0
// Cloudflare Pages Function: GET /api/finance/open-finance/callback
// Phase 134 — Open Finance Foundation
import { json } from '../../../_auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code || !state) {
    return Response.redirect(`${url.origin}/app?finance_error=openfinance_cancelled`, 302);
  }

  let stateData;
  try {
    stateData = JSON.parse(atob(state));
  } catch {
    return Response.redirect(`${url.origin}/app?finance_error=openfinance_invalid_state`, 302);
  }

  const userEmail = stateData.user;
  const institutionId = stateData.institution;

  if (!userEmail || !institutionId) {
    return Response.redirect(`${url.origin}/app?finance_error=openfinance_missing_data`, 302);
  }

  if (!env.OPENFINANCE_CLIENT_ID || !env.OPENFINANCE_CLIENT_SECRET) {
    return Response.redirect(`${url.origin}/app?finance_error=openfinance_config`, 302);
  }

  const redirectUri = `${url.origin}/api/finance/open-finance/callback`;

  try {
    // Trocar código por token de acesso
    const tokenRes = await fetch('https://auth.openfinance.com.br/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: env.OPENFINANCE_CLIENT_ID,
        client_secret: env.OPENFINANCE_CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      return Response.redirect(`${url.origin}/app?finance_error=openfinance_token_failed`, 302);
    }

    const tokenData = await tokenRes.json();

    // Obter lista de contas do usuário
    let accounts = [];
    if (tokenData.access_token) {
      try {
        const accountsRes = await fetch('https://api.openfinance.com.br/open-banking/accounts/v2/accounts', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            'x-fapi-interaction-id': crypto.randomUUID(),
          },
        });
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          accounts = (accountsData.data || []).map(acc => ({
            id: acc.accountId || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            institutionId,
            type: acc.type || 'CONTA_DEPOSITO_A_VISTA',
            subtype: acc.subtype || '',
            currency: acc.currency || 'BRL',
            number: acc.number || '',
            checkDigit: acc.checkDigit || '',
            brandName: acc.brandName || institutionId,
            connectedAt: new Date().toISOString(),
          }));
        }
      } catch (_) {
        // Se não conseguir obter contas, criar entrada básica
        accounts = [{
          id: `acc_${institutionId}_${Date.now()}`,
          institutionId,
          type: 'CONTA_DEPOSITO_A_VISTA',
          brandName: institutionId,
          connectedAt: new Date().toISOString(),
        }];
      }
    }

    // Salvar no KV
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`openfinance:${userEmail}`);
        const data = raw ? JSON.parse(raw) : { accounts: [], summary: {} };

        // Adicionar novas contas (evitar duplicatas por institutionId)
        const existingIds = new Set(data.accounts.map(a => a.institutionId));
        for (const acc of accounts) {
          if (!existingIds.has(acc.institutionId)) {
            data.accounts.push(acc);
          }
        }

        data.summary = {
          ...data.summary,
          connectedBanks: data.accounts.length,
          lastSyncAt: new Date().toISOString(),
        };

        // Armazenar token de acesso de forma segura
        data._tokens = data._tokens || {};
        data._tokens[institutionId] = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : new Date(Date.now() + 3600 * 1000).toISOString(),
        };

        await env.LIFEOS_KV.put(`openfinance:${userEmail}`, JSON.stringify(data));
      } catch (_) { /* ignorar */ }
    }

    return Response.redirect(`${url.origin}/app?finance_success=openfinance&institution=${institutionId}`, 302);
  } catch (_) {
    return Response.redirect(`${url.origin}/app?finance_error=openfinance_error`, 302);
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
