// LifeOS Enterprise — Version Endpoint v32.1
// Cloudflare Pages Function: GET /api/version
export async function onRequestGet({ env } = {}) {
  const version = (env && env.LIFEOS_VERSION) || '32.1.0';
  return new Response(JSON.stringify({
    ok: true,
    application: 'LifeOS Enterprise',
    service: 'lifeos-enterprise',
    version,
    releaseVersion: `v${version}`,
    buildId: `lifeos-v${version}-production`,
    environment: 'production',
    platform: 'cloudflare-pages',
    phases: '250-254',
    timestamp: new Date().toISOString(),
    status: 'operational',
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
