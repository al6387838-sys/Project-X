// LifeOS Enterprise — Health Check v19.0
// Cloudflare Pages Function: GET /api/health
export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    service: 'lifeos-enterprise',
    version: '19.0.0',
    environment: 'production',
    platform: 'cloudflare-pages',
    timestamp: new Date().toISOString(),
    status: 'operational',
    phases: '178-184',
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
export async function onRequest({ request }) {
  if (request.method === 'GET') return onRequestGet();
  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'GET' },
  });
}
