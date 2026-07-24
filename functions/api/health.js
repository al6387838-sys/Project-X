import { getReleaseMetadata, releaseErrorResponse } from '../_release.js';

export async function onRequest(context) {
  try {
    const metadata = await getReleaseMetadata(context);
    return new Response(JSON.stringify({
      status: 'ok',
      ...metadata,
      phases: '701-705',
      timestamp: new Date().toISOString(),
    }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    
    return releaseErrorResponse(error);
  }
}
