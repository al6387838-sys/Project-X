// LifeOS Enterprise — Folders API
// Cloudflare Pages Function: GET/POST/DELETE /api/folders
// Storage: KV (LIFEOS_KV) + R2 (LIFEOS_DOCUMENTS)

import { json } from '../_auth.js';

export async function onRequest(request) {
  const env = request.env;
  const path = new URL(request.url).pathname;

  // GET /api/folders — Listar pastas
  if (request.method === 'GET') {
    try {
      const folders = await env.LIFEOS_KV.get('folders:list', { type: 'json' });
      return json(200, { ok: true, folders: folders || [] });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  // POST /api/folders — Criar pasta
  if (request.method === 'POST') {
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
        try {
          await env.LIFEOS_DOCUMENTS.put(input.name + '/.folder', new Uint8Array(0), {
            httpMetadata: { contentType: 'application/x-directory' }
          });
        } catch (r2err) {
          // Ignorar erro de R2 se não configurado
        }
      }
      return json(201, { ok: true, folder });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  // DELETE /api/folders/:id — Excluir pasta
  if (request.method === 'DELETE' && path.startsWith('/api/folders/')) {
    try {
      const id = path.replace('/api/folders/', '');
      const folders = await env.LIFEOS_KV.get('folders:list', { type: 'json' }) || [];
      const filtered = folders.filter(f => f.id !== id);
      await env.LIFEOS_KV.put('folders:list', JSON.stringify(filtered));
      return json(200, { ok: true });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  return json(405, { ok: false, error: 'Método não permitido' });
}
