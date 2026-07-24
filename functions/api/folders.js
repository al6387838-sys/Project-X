// LifeOS Enterprise — Folders API
// Storage: KV (LIFEOS_KV) + R2 (LIFEOS_DOCUMENTS)

export async function onRequest(request) {
  const env = request.env;
  const path = new URL(request.url).pathname;

  // GET /api/folders — Listar pastas
  if (request.method === 'GET' && path === '/api/folders') {
    try {
      const folders = await env.LIFEOS_KV.get('folders:list', { type: 'json' });
      return new Response(JSON.stringify({ ok: true, folders: folders || [] }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // POST /api/folders — Criar pasta
  if (request.method === 'POST' && path === '/api/folders') {
    try {
      const input = await request.json();
      const folders = await env.LIFEOS_KV.get('folders:list', { type: 'json' }) || [];
      const folder = {
        id: crypto.randomUUID(),
        name: input.name || 'Nova pasta',
        createdAt: new Date().toISOString()
      };
      folders.push(folder);
      await env.LIFEOS_KV.put('folders:list', JSON.stringify(folders));
      // Criar placeholder no R2
      if (env.LIFEOS_DOCUMENTS) {
        await env.LIFEOS_DOCUMENTS.put(input.name + '/.folder', new Uint8Array(0), {
          httpMetadata: { contentType: 'application/x-directory' }
        });
      }
      return new Response(JSON.stringify({ ok: true, folder }), {
        status: 201,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // DELETE /api/folders/:id — Excluir pasta
  if (request.method === 'DELETE' && path.startsWith('/api/folders/')) {
    try {
      const id = path.replace('/api/folders/', '');
      const folders = await env.LIFEOS_KV.get('folders:list', { type: 'json' }) || [];
      const filtered = folders.filter(f => f.id !== id);
      await env.LIFEOS_KV.put('folders:list', JSON.stringify(filtered));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), {
    status: 405,
    headers: { 'content-type': 'application/json' }
  });
}
