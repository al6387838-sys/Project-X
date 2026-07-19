// LifeOS Enterprise v43.0 — Health endpoint for Cloudflare Pages.
export async function onRequest(context) {
  const version = 'v43.0';
  const commit = String(context.env.CF_PAGES_COMMIT_SHA || 'pending');
  const buildId = `lifeos-43.0.0-${commit.slice(0, 12)}`;

  return new Response(JSON.stringify({
    status: 'ok',
    version,
    buildId,
    commit,
    environment: context.env.LIFEOS_ENV || 'production',
    platform: 'cloudflare-pages',
    phases: '303-306',
    timestamp: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
