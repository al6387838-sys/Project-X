// LifeOS Enterprise — WhatsApp Media Download Proxy v1.0
// Cloudflare Pages Function: GET /api/webhooks/whatsapp-media?id={mediaId}
// Faz download de mídia do WhatsApp Cloud API e opcionalmente armazena no R2
// Fase 750 — Integração WhatsApp: Download de imagens, vídeos, documentos, áudios

import { getCookie, json, verifySession } from '../../_auth.js';

export async function onRequestGet({ request, env }) {
  const kv = env.LIFEOS_KV;
  const url = new URL(request.url);
  const mediaId = url.searchParams.get('id');
  const convId = url.searchParams.get('convId');
  const fileName = url.searchParams.get('fileName') || 'whatsapp_media';
  const cache = url.searchParams.get('cache') === 'true';

  if (!mediaId) {
    return json(400, { ok: false, error: 'mediaId obrigatório' });
  }

  if (!env.WHATSAPP_ACCESS_TOKEN) {
    return json(503, { ok: false, error: 'WHATSAPP_ACCESS_TOKEN não configurado' });
  }

  // Autenticação opcional — permite acesso público para webhooks
  // Mas requer auth para downloads manuais
  const secret = env.LIFEOS_SESSION_SECRET;
  const token = getCookie(request.headers.get('cookie'));
  let session = null;
  if (secret) {
    try { session = await verifySession(token, secret, env.LIFEOS_KV); } catch { /* webhook access */ }
  }

  try {
    // 1. Buscar URL da mídia via WhatsApp API
    const infoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    });

    if (!infoRes.ok) {
      const errorData = await infoRes.json().catch(() => ({}));
      return json(infoRes.status, {
        ok: false,
        error: errorData.error?.message || 'Erro ao buscar mídia WhatsApp',
        status: 'failed',
      });
    }

    const mediaInfo = await infoRes.json();
    const downloadUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type || 'application/octet-stream';
    const fileSize = mediaInfo.file_size || 0;
    const sha256 = mediaInfo.sha256;
    const originalName = mediaInfo.filename || fileName;

    if (!downloadUrl) {
      return json(404, { ok: false, error: 'URL de download não disponível' });
    }

    // 2. Download da mídia
    const downloadRes = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    });

    if (!downloadRes.ok) {
      return json(downloadRes.status, { ok: false, error: 'Erro ao baixar mídia' });
    }

    const mediaBlob = await downloadRes.arrayBuffer();

    // 3. Cache no R2 (opcional)
    if (cache && kv) {
      const bucket = [env.LIFEOS_R2, env.LIFEOS_FILES, env.R2_BUCKET]
        .find((c) => c && typeof c.get === 'function' && typeof c.put === 'function') || null;

      if (bucket) {
        const safeName = String(originalName || 'media')
          .replace(/[\\/:*?"<>|]/g, '-')
          .replace(/\s+/g, ' ')
          .replace(/^\.+|\.+$/g, '');
        const storageKey = `whatsapp-media/${mediaId}/${safeName}`;

        try {
          await bucket.put(storageKey, mediaBlob, {
            httpMetadata: { contentType: mimeType },
            customMetadata: {
              mediaId,
              mimeType,
              sha256,
              originalName,
              conversationId: convId || '',
              cachedAt: new Date().toISOString(),
            },
          });

          // Atualizar referência no KV
          if (convId) {
            const msgKey = `msg:messages:system:${convId}`;
            const messages = JSON.parse(await kv.get(msgKey) || '[]');
            const msg = messages.find(m =>
              m.attachments?.some(a => a.externalUrl === mediaId)
            );
            if (msg) {
              const att = msg.attachments.find(a => a.externalUrl === mediaId);
              if (att) {
                att.storageKey = storageKey;
                att.size = fileSize;
                await kv.put(msgKey, JSON.stringify(messages));
              }
            }
          }
        } catch { /* R2 indisponível, retornar stream direto */ }
      }
    }

    // 4. Retornar a mídia
    return new Response(mediaBlob, {
      status: 200,
      headers: {
        'content-type': mimeType,
        'content-length': String(mediaBlob.byteLength),
        'content-disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao processar mídia: ' + (err.message || 'desconhecido') });
  }
}

// POST para upload de mídia do WhatsApp (para conversas internas)
export async function onRequestPost({ request, env }) {
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const secret = env.LIFEOS_SESSION_SECRET;
  const token = getCookie(request.headers.get('cookie'));
  const session = await verifySession(token, secret, kv);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { mediaId, convId, messageId } = body;
  if (!mediaId) return json(400, { ok: false, error: 'mediaId obrigatório' });
  if (!convId) return json(400, { ok: false, error: 'convId obrigatório' });

  if (!env.WHATSAPP_ACCESS_TOKEN) {
    return json(503, { ok: false, error: 'WHATSAPP_ACCESS_TOKEN não configurado' });
  }

  try {
    // Buscar info da mídia
    const infoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    });
    if (!infoRes.ok) return json(infoRes.status, { ok: false, error: 'Mídia não encontrada no WhatsApp' });
    const mediaInfo = await infoRes.json();

    // Download
    const downloadRes = await fetch(mediaInfo.url, {
      headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    });
    if (!downloadRes.ok) return json(downloadRes.status, { ok: false, error: 'Erro ao baixar mídia' });
    const mediaBlob = await downloadRes.arrayBuffer();

    // Upload para R2
    const bucket = [env.LIFEOS_R2, env.LIFEOS_FILES, env.R2_BUCKET]
      .find((c) => c && typeof c.get === 'function' && typeof c.put === 'function') || null;

    if (!bucket) {
      return json(503, { ok: false, error: 'R2 não disponível' });
    }

    const safeName = String(mediaInfo.filename || `media_${mediaId}`)
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^\.+|\.+$/g, '');
    const storageKey = `messages/${session.sub}/${convId}/${generateId()}/${safeName}`;

    await bucket.put(storageKey, mediaBlob, {
      httpMetadata: { contentType: mediaInfo.mime_type || 'application/octet-stream' },
    });

    // Atualizar mensagem com storageKey
    const msgKey = `msg:messages:${session.sub}:${convId}`;
    const messages = JSON.parse(await kv.get(msgKey) || '[]');
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      const att = msg.attachments?.find(a => a.externalUrl === mediaId);
      if (att) {
        att.storageKey = storageKey;
        att.size = mediaInfo.file_size || 0;
        att.downloadedAt = new Date().toISOString();
      }
      await kv.put(msgKey, JSON.stringify(messages));
    }

    return json(200, { ok: true, storageKey, mediaId, size: mediaBlob.byteLength });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao processar mídia: ' + err.message });
  }
}

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  if (ctx.request.method === 'POST') return onRequestPost(ctx);
  return json(405, { ok: false, error: 'Método não permitido' });
}
