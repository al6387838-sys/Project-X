// LifeOS Enterprise — Health Check v32.1
// Cloudflare Pages Function: GET /api/health
export async function onRequestGet({ env } = {}) {
  return new Response(JSON.stringify({
    ok: true,
    service: 'lifeos-enterprise',
    version: (env && env.LIFEOS_VERSION) || '32.1.0',
    environment: 'production',
    platform: 'cloudflare-pages',
    timestamp: new Date().toISOString(),
    status: 'operational',
    phases: '250-254',
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
  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
