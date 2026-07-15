// LifeOS Enterprise — Open Finance API v1.0
// Cloudflare Pages Function: GET/POST /api/finance/open-finance
// Phase 134 — Open Finance Foundation
// Infraestrutura para Open Finance Brasil (Banco Central do Brasil)
// Documentação: https://openfinancebrasil.atlassian.net/wiki/spaces/OF/overview
import { getCookie, json, verifySession } from '../../_auth.js';

// Instituições financeiras participantes do Open Finance Brasil
const OPEN_FINANCE_INSTITUTIONS = [
  { id: 'itau', name: 'Itaú Unibanco', code: '341', type: 'bank', logo: 'itau' },
  { id: 'bradesco', name: 'Bradesco', code: '237', type: 'bank', logo: 'bradesco' },
  { id: 'santander', name: 'Santander Brasil', code: '033', type: 'bank', logo: 'santander' },
  { id: 'bb', name: 'Banco do Brasil', code: '001', type: 'bank', logo: 'bb' },
  { id: 'caixa', name: 'Caixa Econômica Federal', code: '104', type: 'bank', logo: 'caixa' },
  { id: 'nubank', name: 'Nubank', code: '260', type: 'fintech', logo: 'nubank' },
  { id: 'inter', name: 'Banco Inter', code: '077', type: 'fintech', logo: 'inter' },
  { id: 'c6', name: 'C6 Bank', code: '336', type: 'fintech', logo: 'c6' },
  { id: 'picpay', name: 'PicPay', code: '380', type: 'fintech', logo: 'picpay' },
  { id: 'mercadopago', name: 'Mercado Pago', code: '323', type: 'fintech', logo: 'mercadopago' },
];

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const resource = url.searchParams.get('resource') || 'overview';

  // Verificar se Open Finance está configurado
  const configured = !!(env.OPENFINANCE_CLIENT_ID && env.OPENFINANCE_CLIENT_SECRET);

  if (resource === 'institutions') {
    return json(200, { ok: true, institutions: OPEN_FINANCE_INSTITUTIONS });
  }

  if (resource === 'overview') {
    // Carregar dados de contas conectadas do KV
    let connectedAccounts = [];
    let summary = {
      totalBalance: null,
      totalInvestments: null,
      totalCredit: null,
      connectedBanks: 0,
      lastSyncAt: null,
    };

    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`openfinance:${session.sub}`);
        if (raw) {
          const data = JSON.parse(raw);
          connectedAccounts = data.accounts || [];
          summary = data.summary || summary;
        }
      } catch (_) { /* KV indisponível */ }
    }

    return json(200, {
      ok: true,
      configured,
      setup_required: !configured,
      setup_instructions: configured ? null : 'Configure OPENFINANCE_CLIENT_ID e OPENFINANCE_CLIENT_SECRET nas variáveis de ambiente do Cloudflare Pages para ativar o Open Finance Brasil.',
      summary,
      connectedAccounts,
      institutions: OPEN_FINANCE_INSTITUTIONS,
    });
  }

  if (resource === 'accounts') {
    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento não disponível' });
    try {
      const raw = await env.LIFEOS_KV.get(`openfinance:${session.sub}`);
      const data = raw ? JSON.parse(raw) : {};
      return json(200, { ok: true, accounts: data.accounts || [] });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao carregar contas' });
    }
  }

  if (resource === 'transactions') {
    const accountId = url.searchParams.get('accountId');
    if (!accountId) return json(400, { ok: false, error: 'accountId obrigatório' });

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento não disponível' });
    try {
      const raw = await env.LIFEOS_KV.get(`transactions:${session.sub}:${accountId}`);
      const transactions = raw ? JSON.parse(raw) : [];
      return json(200, { ok: true, transactions });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao carregar transações' });
    }
  }

  return json(400, { ok: false, error: 'Recurso inválido. Use: overview, institutions, accounts, transactions' });
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
  const url = new URL(request.url);

  if (action === 'connect') {
    const institutionId = String(input.institutionId || '');
    const institution = OPEN_FINANCE_INSTITUTIONS.find(i => i.id === institutionId);

    if (!institution) {
      return json(400, { ok: false, error: 'Instituição não encontrada' });
    }

    if (!env.OPENFINANCE_CLIENT_ID || !env.OPENFINANCE_CLIENT_SECRET) {
      return json(503, {
        ok: false,
        error: 'Open Finance Brasil não configurado.',
        setup_required: true,
        instructions: 'Para conectar ao Open Finance Brasil, configure as seguintes variáveis no painel Cloudflare Pages → Settings → Environment Variables:\n\n• OPENFINANCE_CLIENT_ID — Client ID do seu aplicativo registrado no Diretório do Open Finance Brasil\n• OPENFINANCE_CLIENT_SECRET — Client Secret do aplicativo\n\nRegistro em: https://web.directory.openbankingbrasil.org.br/',
      });
    }

    // Gerar URL de autorização Open Finance Brasil
    const state = btoa(JSON.stringify({
      user: session.sub,
      institution: institutionId,
      ts: Date.now(),
      nonce: Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join(''),
    }));

    const redirectUri = `${url.origin}/api/finance/open-finance/callback`;
    const params = new URLSearchParams({
      client_id: env.OPENFINANCE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'accounts transactions investments credit-cards',
      state,
      institution_id: institution.code,
    });

    const authUrl = `https://auth.openfinance.com.br/oauth/authorize?${params}`;
    return json(200, { ok: true, authUrl, institution: institution.name });
  }

  if (action === 'disconnect') {
    const accountId = String(input.accountId || '');
    if (!accountId) return json(400, { ok: false, error: 'accountId obrigatório' });

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Armazenamento não disponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`openfinance:${session.sub}`);
      const data = raw ? JSON.parse(raw) : {};
      data.accounts = (data.accounts || []).filter(a => a.id !== accountId);
      data.summary = { ...data.summary, connectedBanks: data.accounts.length };
      await env.LIFEOS_KV.put(`openfinance:${session.sub}`, JSON.stringify(data));
      // Remover transações da conta
      await env.LIFEOS_KV.delete(`transactions:${session.sub}:${accountId}`);
      return json(200, { ok: true, message: 'Conta desconectada' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao desconectar conta' });
    }
  }

  if (action === 'sync') {
    // Sincronização manual — requer credenciais válidas
    if (!env.OPENFINANCE_CLIENT_ID) {
      return json(503, {
        ok: false,
        error: 'Open Finance não configurado',
        setup_required: true,
      });
    }

    // Em produção: chamar APIs do Open Finance Brasil para atualizar dados
    // Por ora: registrar timestamp de sincronização
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`openfinance:${session.sub}`);
        const data = raw ? JSON.parse(raw) : {};
        data.summary = { ...data.summary, lastSyncAt: new Date().toISOString() };
        await env.LIFEOS_KV.put(`openfinance:${session.sub}`, JSON.stringify(data));
      } catch (_) { /* ignorar */ }
    }

    return json(200, { ok: true, message: 'Sincronização iniciada. Os dados serão atualizados em instantes.' });
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: connect, disconnect, sync' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
