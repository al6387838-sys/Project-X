// LifeOS Enterprise — Health Check
// Cloudflare Pages Function: GET /api/health

export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    service: 'lifeos-enterprise',
    version: '9.1.0',
    environment: 'production',
    timestamp: new Date().toISOString(),
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
