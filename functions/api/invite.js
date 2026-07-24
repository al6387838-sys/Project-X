// LifeOS Enterprise — Invite API v7.0
// Cloudflare Pages Function: POST /api/invite
// Gerencia convites de usuários (admin only)
import { getCookie, json, verifySession } from '../_auth.js';

function generateInviteToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor((crypto.getRandomValues(new Uint8Array(1))[0]) % chars.length));
  }
  return token;
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (session.role !== 'admin') return json(403, { ok: false, error: 'Acesso negado — apenas administradores podem convidar usuários' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const action = String(input.action || 'invite.create');

  if (action === 'invite.create') {
    const email = String(input.email || '').trim().toLowerCase();
    const role = String(input.role || 'user');
    const name = String(input.name || '').trim();

    if (!email || !email.includes('@')) return json(400, { ok: false, error: 'E-mail inválido' });
    if (!['user', 'admin', 'manager', 'viewer'].includes(role)) return json(400, { ok: false, error: 'Papel inválido' });

    const inviteToken = generateInviteToken();
    const invite = {
      id: `inv_${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      role,
      token: inviteToken,
      status: 'pending',
      invitedBy: session.sub,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
    };

    if (env.LIFEOS_KV) {
      try {
        // Verificar se e-mail já existe
        const existing = await env.LIFEOS_KV.get(`user:${email}`);
        if (existing) return json(409, { ok: false, error: 'Este e-mail já possui uma conta' });

        // Salvar convite
        await env.LIFEOS_KV.put(`invite:${inviteToken}`, JSON.stringify(invite), { expirationTtl: 7 * 24 * 60 * 60 });

        // Adicionar à lista de convites pendentes
        const listRaw = await env.LIFEOS_KV.get('invites:pending') || '[]';
        const list = JSON.parse(listRaw);
        list.push({ id: invite.id, email, role, status: 'pending', createdAt: invite.createdAt });
        await env.LIFEOS_KV.put('invites:pending', JSON.stringify(list));
      } catch (_) { /* KV error */ }
    }

    // Em produção: enviar e-mail via SendGrid/Mailgun
    const inviteUrl = `${new URL(request.url).origin}/register?invite=${inviteToken}`;

    return json(201, {
      ok: true,
      invite: { id: invite.id, email, role, status: 'pending', inviteUrl },
      message: `Convite enviado para ${email}`,
    });
  }

  if (action === 'invite.list') {
    if (env.LIFEOS_KV) {
      try {
        const listRaw = await env.LIFEOS_KV.get('invites:pending') || '[]';
        return json(200, { ok: true, invites: JSON.parse(listRaw) });
      } catch (_) { /* KV error */ }
    }
    return json(200, { ok: true, invites: [] });
  }

  if (action === 'invite.revoke') {
    const inviteId = String(input.id || '');
    if (!inviteId) return json(400, { ok: false, error: 'ID do convite obrigatório' });

    if (env.LIFEOS_KV) {
      try {
        const listRaw = await env.LIFEOS_KV.get('invites:pending') || '[]';
        const list = JSON.parse(listRaw);
        const updated = list.filter(i => i.id !== inviteId);
        await env.LIFEOS_KV.put('invites:pending', JSON.stringify(updated));
      } catch (_) { /* KV error */ }
    }
    return json(200, { ok: true, message: 'Convite revogado' });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (session.role !== 'admin') return json(403, { ok: false, error: 'Acesso negado' });

  if (env.LIFEOS_KV) {
    try {
      const listRaw = await env.LIFEOS_KV.get('invites:pending') || '[]';
      return json(200, { ok: true, invites: JSON.parse(listRaw) });
    } catch (_) { /* KV error */ }
  }
  return json(200, { ok: true, invites: [] });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
