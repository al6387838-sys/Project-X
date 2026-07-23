const RELEASE_ASSET_PATH = '/release.json';
const RELEASE_PATTERN = /^v\d+\.\d+\.\d+$/;
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;

/**
 * Lê o único documento de release empacotado no deploy atual.
 * O asset é gerado por scripts/build.mjs a partir de config/release.json.
 * Não há fallback de versão: uma publicação sem metadado válido falha de forma
 * explícita para que uma referência antiga nunca seja exibida.
 */
export async function getReleaseMetadata({ request, env }) {
  if (!request || !env?.ASSETS || typeof env.ASSETS.fetch !== 'function') {
    throw new Error('Release metadata asset binding is unavailable');
  }

  const assetUrl = new URL(RELEASE_ASSET_PATH, request.url);
  const assetRequest = new Request(assetUrl, {
    headers: { 'cache-control': 'no-cache' },
  });
  const response = await env.ASSETS.fetch(assetRequest);

  if (!response.ok) {
    throw new Error(`Release metadata asset returned HTTP ${response.status}`);
  }

  let metadata;
  try {
    metadata = await response.json();
  } catch {
    throw new Error('Release metadata asset is not valid JSON');
  }

  if (!metadata || !RELEASE_PATTERN.test(String(metadata.release)) ||
      !COMMIT_PATTERN.test(String(metadata.commit)) ||
      typeof metadata.buildId !== 'string' || !metadata.buildId) {
    throw new Error('Release metadata asset failed integrity validation');
  }

  return metadata;
}

export function releaseErrorResponse(error) {
  return new Response(JSON.stringify({
    status: 'error',
    error: 'Release metadata unavailable',
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
