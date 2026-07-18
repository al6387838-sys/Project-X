// LifeOS Enterprise — Health Check v34.0
// Cloudflare Pages Function: GET /api/health
// Phase 269 — Gold Enterprise Release
export async function onRequestGet({ env } = {}) {
  return new Response(JSON.stringify({
    ok: true,
    service: 'lifeos-enterprise',
    version: (env && env.LIFEOS_VERSION) || '34.0.0',
    environment: 'production',
    platform: 'cloudflare-pages',
    timestamp: new Date().toISOString(),
    status: 'operational',
    phases: '264-269',
    features: [
      'enterprise-db-optimization',
      'automation-engine',
      'communication-hub',
      'advanced-analytics',
      'security-hardening',
    ],
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ env });
  return new Response(JSON.stringify({ ok: false, error: 'Metodo nao permitido' }), {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
