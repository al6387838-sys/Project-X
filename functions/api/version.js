// LifeOS Enterprise v46.0.0 — Version endpoint (Hardening Fase 328)
// Sincronizado com CF_PAGES_COMMIT_SHA e LIFEOS_VERSION (SSOT)
export async function onRequest(context) {
  const commit = String(context.env.CF_PAGES_COMMIT_SHA || '780daaa8a8bd');
  const version = context.env.LIFEOS_VERSION || 'v46.0.0';
  const buildId = `lifeos-46.0.0-${commit.slice(0, 12)}`;
  return new Response(JSON.stringify({
    status: 'ok',
    version,
    buildId,
    commit,
    environment: context.env.LIFEOS_ENV || 'production',
    platform: 'cloudflare-pages',
    timestamp: new Date().toISOString(),
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
