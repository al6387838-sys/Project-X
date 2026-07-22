// LifeOS Enterprise — Auth Config Detector v48.0
// Cloudflare Pages Function: GET /api/auth/config
// FASE 333 — Auto-detect: retorna quais provedores OAuth estão configurados
// SEM expor segredos. Frontend usa este endpoint para mostrar/ocultar botões.
import { json } from '../../_auth.js';

export async function onRequestGet({ env }) {
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const appleConfigured = Boolean(
    env.APPLE_CLIENT_ID &&
    env.APPLE_TEAM_ID &&
    env.APPLE_KEY_ID &&
    env.APPLE_PRIVATE_KEY
  );
  const emailConfigured = Boolean(
    env.LIFEOS_SESSION_SECRET &&
    env.LIFEOS_KV
  );
  const adminConfigured = Boolean(
    env.LIFEOS_ADMIN_USER &&
    env.LIFEOS_ADMIN_PASSWORD_HASH &&
    env.LIFEOS_SESSION_SECRET
  );

  return json(200, {
    ok: true,
    providers: {
      email: emailConfigured,
      admin: adminConfigured,
      google: googleConfigured,
      apple: appleConfigured,
    },
    // Campos de diagnóstico — sem expor valores reais
    missing: [
      !env.LIFEOS_SESSION_SECRET && 'LIFEOS_SESSION_SECRET',
      !env.LIFEOS_KV && 'LIFEOS_KV',
      !env.LIFEOS_ADMIN_USER && 'LIFEOS_ADMIN_USER',
      !env.LIFEOS_ADMIN_PASSWORD_HASH && 'LIFEOS_ADMIN_PASSWORD_HASH',
      !env.GOOGLE_CLIENT_ID && 'GOOGLE_CLIENT_ID',
      !env.GOOGLE_CLIENT_SECRET && 'GOOGLE_CLIENT_SECRET',
      !env.APPLE_CLIENT_ID && 'APPLE_CLIENT_ID',
      !env.APPLE_TEAM_ID && 'APPLE_TEAM_ID',
      !env.APPLE_KEY_ID && 'APPLE_KEY_ID',
      !env.APPLE_PRIVATE_KEY && 'APPLE_PRIVATE_KEY',
      !env.EMAIL_FROM && 'EMAIL_FROM',
      !(env.RESEND_API_KEY || env.SENDGRID_API_KEY) && 'RESEND_API_KEY ou SENDGRID_API_KEY',
    ].filter(Boolean),
  }, {
    'cache-control': 'no-store, no-cache',
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ env });
  if (request.method === 'HEAD') return onRequestGet({ env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, HEAD' });
}
