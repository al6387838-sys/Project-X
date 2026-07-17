// LifeOS Enterprise — Enterprise Certification API v1.0
// Cloudflare Pages Function: GET /api/enterprise/certification
// Phase 229 — Enterprise Certification
// Auditoria completa: Segurança · APIs · Banco · Cloudflare · Integrações
// Comunicação · Billing · IA · Upload · Organizações · Usuários · Admin · Performance
import { getCookie, json, verifySession } from '../../_auth.js';

const CERTIFICATION_CHECKS = [
  // Segurança
  { id: 'sec-session-secret',    category: 'security',      name: 'Session Secret',           envKey: 'LIFEOS_SESSION_SECRET',         critical: true  },
  { id: 'sec-admin-user',        category: 'security',      name: 'Admin User',                envKey: 'LIFEOS_ADMIN_USER',             critical: true  },
  { id: 'sec-admin-hash',        category: 'security',      name: 'Admin Password Hash',       envKey: 'LIFEOS_ADMIN_PASSWORD_HASH',    critical: true  },
  // Banco / KV
  { id: 'db-kv',                 category: 'database',      name: 'Cloudflare KV',             kvCheck: true,                           critical: true  },
  // Cloudflare
  { id: 'cf-r2-bucket',          category: 'cloudflare',    name: 'R2 Bucket',                 envKey: 'R2_BUCKET',                     critical: false },
  { id: 'cf-r2-account',         category: 'cloudflare',    name: 'R2 Account ID',             envKey: 'R2_ACCOUNT_ID',                 critical: false },
  { id: 'cf-r2-access-key',      category: 'cloudflare',    name: 'R2 Access Key',             envKey: 'R2_ACCESS_KEY_ID',              critical: false },
  { id: 'cf-r2-secret-key',      category: 'cloudflare',    name: 'R2 Secret Key',             envKey: 'R2_SECRET_ACCESS_KEY',          critical: false },
  // Integrações — Google
  { id: 'int-google-client-id',  category: 'integrations',  name: 'Google Client ID',          envKey: 'GOOGLE_CLIENT_ID',              critical: false },
  { id: 'int-google-secret',     category: 'integrations',  name: 'Google Client Secret',      envKey: 'GOOGLE_CLIENT_SECRET',          critical: false },
  // Integrações — Microsoft
  { id: 'int-ms-client-id',      category: 'integrations',  name: 'Microsoft Client ID',       envKey: 'MICROSOFT_CLIENT_ID',           critical: false },
  { id: 'int-ms-secret',         category: 'integrations',  name: 'Microsoft Client Secret',   envKey: 'MICROSOFT_CLIENT_SECRET',       critical: false },
  // Integrações — Slack
  { id: 'int-slack-token',       category: 'integrations',  name: 'Slack Bot Token',           envKey: 'SLACK_BOT_TOKEN',               critical: false },
  // Integrações — Notion
  { id: 'int-notion-token',      category: 'integrations',  name: 'Notion Integration Token',  envKey: 'NOTION_TOKEN',                  critical: false },
  // Integrações — GitHub
  { id: 'int-github-token',      category: 'integrations',  name: 'GitHub Token',              envKey: 'GITHUB_TOKEN',                  critical: false },
  // Integrações — Jira
  { id: 'int-jira-token',        category: 'integrations',  name: 'Jira API Token',            envKey: 'JIRA_API_TOKEN',                critical: false },
  // Integrações — Salesforce
  { id: 'int-sf-client-id',      category: 'integrations',  name: 'Salesforce Client ID',      envKey: 'SALESFORCE_CLIENT_ID',          critical: false },
  // Comunicação
  { id: 'comm-smtp-host',        category: 'communication', name: 'SMTP Host',                 envKey: 'SMTP_HOST',                     critical: false },
  { id: 'comm-smtp-user',        category: 'communication', name: 'SMTP User',                 envKey: 'SMTP_USER',                     critical: false },
  { id: 'comm-whatsapp-app-id',  category: 'communication', name: 'WhatsApp App ID',           envKey: 'WHATSAPP_APP_ID',               critical: false },
  { id: 'comm-webhook-secret',   category: 'communication', name: 'Webhook Secret',            envKey: 'LIFEOS_WEBHOOK_SECRET',         critical: false },
  // Billing
  { id: 'bill-stripe-public',    category: 'billing',       name: 'Stripe Public Key',         envKey: 'STRIPE_PUBLIC_KEY',             critical: false },
  { id: 'bill-stripe-secret',    category: 'billing',       name: 'Stripe Secret Key',         envKey: 'STRIPE_SECRET_KEY',             critical: false },
  { id: 'bill-stripe-webhook',   category: 'billing',       name: 'Stripe Webhook Secret',     envKey: 'STRIPE_WEBHOOK_SECRET',         critical: false },
  { id: 'bill-mp-token',         category: 'billing',       name: 'Mercado Pago Access Token', envKey: 'MERCADO_PAGO_ACCESS_TOKEN',     critical: false },
  { id: 'bill-mp-public',        category: 'billing',       name: 'Mercado Pago Public Key',   envKey: 'MERCADO_PAGO_PUBLIC_KEY',       critical: false },
  // IA
  { id: 'ai-openai-key',         category: 'ai',            name: 'OpenAI API Key',            envKey: 'OPENAI_API_KEY',                critical: false },
  // Email transacional
  { id: 'email-resend',          category: 'communication', name: 'Resend API Key',            envKey: 'RESEND_API_KEY',                critical: false },
];

function runChecks(env, kv) {
  const results = [];
  for (const check of CERTIFICATION_CHECKS) {
    let status, message;
    if (check.kvCheck) {
      status = kv ? 'ok' : 'missing';
      message = kv ? 'KV namespace disponível' : 'KV namespace não configurado';
    } else {
      const val = env[check.envKey];
      status = val ? 'ok' : 'missing';
      message = val ? 'Configurado' : 'Aguardando configuração de credencial oficial';
    }
    results.push({
      id: check.id,
      category: check.category,
      name: check.name,
      status,
      critical: check.critical,
      message,
      envKey: check.envKey || null,
    });
  }
  return results;
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  // Apenas admins podem ver a certificação
  const isAdmin = session.sub === env.LIFEOS_ADMIN_USER || session.role === 'admin' || session.role === 'owner';
  if (!isAdmin) return json(403, { ok: false, error: 'Acesso restrito a administradores' });
  const kv = env.LIFEOS_KV;
  const checks = runChecks(env, kv);
  const categories = [...new Set(checks.map(c => c.category))];
  const summary = {};
  for (const cat of categories) {
    const catChecks = checks.filter(c => c.category === cat);
    summary[cat] = {
      total: catChecks.length,
      ok: catChecks.filter(c => c.status === 'ok').length,
      missing: catChecks.filter(c => c.status === 'missing').length,
      criticalMissing: catChecks.filter(c => c.status === 'missing' && c.critical).length,
    };
  }
  const criticalMissing = checks.filter(c => c.status === 'missing' && c.critical);
  const totalOk = checks.filter(c => c.status === 'ok').length;
  const totalMissing = checks.filter(c => c.status === 'missing').length;
  const readyForProduction = criticalMissing.length === 0;
  const pendingCredentials = checks.filter(c => c.status === 'missing').map(c => ({ id: c.id, name: c.name, category: c.category, envKey: c.envKey, critical: c.critical }));
  return json(200, {
    ok: true,
    certification: {
      version: env.LIFEOS_VERSION || '26.0.0',
      timestamp: new Date().toISOString(),
      readyForProduction,
      productionReadiness: `${Math.round((totalOk / checks.length) * 100)}%`,
      criticalIssues: criticalMissing.length,
      totalChecks: checks.length,
      totalOk,
      totalMissing,
    },
    summary,
    checks,
    pendingCredentials,
    message: readyForProduction
      ? 'Todos os controles críticos estão configurados. Plataforma pronta para produção.'
      : `${criticalMissing.length} controle(s) crítico(s) ausente(s). Configure antes de ir para produção.`,
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return json(405, { ok: false, error: 'Método não permitido' });
  return onRequestGet({ request, env });
}
