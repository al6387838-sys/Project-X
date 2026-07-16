// LifeOS Enterprise — User Invite API v1.0
// Cloudflare Pages Function: POST /api/enterprise/invite
// Phase 135 — Enterprise User Management
// Convite de usuários para organizações/workspaces
import { getCookie, json, verifySession } from '../../_auth.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const INVITE_TTL = 7 * 24 * 3600; // 7 dias
const VALID_ROLES = ['admin', 'manager', 'member', 'viewer'];

function generateInviteToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendInviteEmail(toEmail, inviterName, orgName, token, origin, env) {
  const inviteUrl = `${origin}/accept-invite?token=${token}`;

  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || 'LifeOS <noreply@lifeos.app>',
          to: [toEmail],
          subject: `${inviterName} convidou você para ${orgName} no LifeOS Enterprise`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:12px">
              <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Você foi convidado!</h1>
              <p style="color:#999;margin-bottom:8px"><strong>${inviterName}</strong> convidou você para participar de <strong>${orgName}</strong> no LifeOS Enterprise.</p>
              <p style="color:#999;margin-bottom:24px">Clique no botão abaixo para aceitar o convite e criar sua conta.</p>
              <a href="${inviteUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Aceitar Convite</a>
              <p style="color:#666;font-size:12px;margin-top:24px">Este convite expira em 7 dias. Se você não esperava este convite, ignore este e-mail.</p>
            </div>
          `,
        }),
      });
      return true;
    } catch (_) { return false; }
  }

  return false;
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const inviteToken = url.searchParams.get('token');

  if (inviteToken) {
    // Verificar convite específico
    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });
    try {
      const raw = await env.LIFEOS_KV.get(`invite:${inviteToken}`);
      if (!raw) return json(404, { ok: false, error: 'Convite não encontrado ou expirado' });
      const invite = JSON.parse(raw);
      if (invite.status !== 'pending') return json(400, { ok: false, error: `Convite já ${invite.status}` });
      if (new Date(invite.expiresAt) < new Date()) return json(400, { ok: false, error: 'Convite expirado' });
      return json(200, { ok: true, invite: { ...invite, token: inviteToken } });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao verificar convite' });
    }
  }

  // Listar convites enviados pelo usuário
  if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });
  try {
    const raw = await env.LIFEOS_KV.get(`invites:sent:${session.sub}`);
    const invites = raw ? JSON.parse(raw) : [];
    return json(200, { ok: true, invites });
  } catch (_) {
    return json(500, { ok: false, error: 'Erro ao carregar convites' });
  }
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const action = String(input.action || 'send');
  const url = new URL(request.url);

  if (action === 'send') {
    const email = String(input.email || '').trim().toLowerCase();
    const role = String(input.role || 'member').toLowerCase();
    const orgName = String(input.orgName || 'LifeOS Enterprise').trim();
    const workspaceId = String(input.workspaceId || '').trim();

    if (!email || !EMAIL_REGEX.test(email)) {
      return json(400, { ok: false, error: 'E-mail inválido' });
    }
    if (!VALID_ROLES.includes(role)) {
      return json(400, { ok: false, error: `Papel inválido. Use: ${VALID_ROLES.join(', ')}` });
    }

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });

    // Verificar se já existe convite pendente para este e-mail
    try {
      const existingRaw = await env.LIFEOS_KV.get(`invites:sent:${session.sub}`);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const pending = existing.find(i => i.email === email && i.status === 'pending' && new Date(i.expiresAt) > new Date());
      if (pending) {
        return json(409, { ok: false, error: 'Já existe um convite pendente para este e-mail' });
      }
    } catch (_) { /* ignorar */ }

    // Obter dados do usuário convidante
    let inviterName = session.sub;
    try {
      const userRaw = await env.LIFEOS_KV.get(`user:${session.sub}`);
      if (userRaw) {
        const userData = JSON.parse(userRaw);
        inviterName = userData.name || session.sub;
      }
    } catch (_) { /* ignorar */ }

    const inviteToken = generateInviteToken();
    const invite = {
      token: inviteToken,
      email,
      role,
      orgName,
      workspaceId,
      invitedBy: session.sub,
      inviterName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + INVITE_TTL * 1000).toISOString(),
    };

    try {
      // Salvar convite
      await env.LIFEOS_KV.put(`invite:${inviteToken}`, JSON.stringify(invite), { expirationTtl: INVITE_TTL });

      // Atualizar lista de convites enviados
      const sentRaw = await env.LIFEOS_KV.get(`invites:sent:${session.sub}`);
      const sent = sentRaw ? JSON.parse(sentRaw) : [];
      sent.unshift({ ...invite, token: inviteToken });
      await env.LIFEOS_KV.put(`invites:sent:${session.sub}`, JSON.stringify(sent.slice(0, 100)));

      // Enviar e-mail
      const emailSent = await sendInviteEmail(email, inviterName, orgName, inviteToken, url.origin, env);

      return json(201, {
        ok: true,
        invite,
        emailSent,
        message: emailSent
          ? `Convite enviado para ${email}`
          : `Convite criado. Configure RESEND_API_KEY para envio automático de e-mails.`,
        inviteUrl: `${url.origin}/accept-invite?token=${inviteToken}`,
      });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao criar convite' });
    }
  }

  if (action === 'accept') {
    const inviteToken = String(input.token || '').trim();
    if (!inviteToken) return json(400, { ok: false, error: 'Token de convite obrigatório' });

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`invite:${inviteToken}`);
      if (!raw) return json(404, { ok: false, error: 'Convite não encontrado ou expirado' });

      const invite = JSON.parse(raw);
      if (invite.status !== 'pending') return json(400, { ok: false, error: `Convite já ${invite.status}` });
      if (new Date(invite.expiresAt) < new Date()) return json(400, { ok: false, error: 'Convite expirado' });

      // Verificar se o usuário logado é o destinatário
      if (session.sub !== invite.email) {
        return json(403, { ok: false, error: 'Este convite não é para sua conta' });
      }

      // Aceitar convite
      invite.status = 'accepted';
      invite.acceptedAt = new Date().toISOString();
      await env.LIFEOS_KV.put(`invite:${inviteToken}`, JSON.stringify(invite), { expirationTtl: 86400 });

      // Adicionar usuário ao workspace/org
      if (invite.workspaceId) {
        const wsRaw = await env.LIFEOS_KV.get(`workspace:${invite.workspaceId}`);
        if (wsRaw) {
          const ws = JSON.parse(wsRaw);
          ws.members = ws.members || [];
          if (!ws.members.find(m => m.email === session.sub)) {
            ws.members.push({ email: session.sub, role: invite.role, joinedAt: new Date().toISOString() });
            await env.LIFEOS_KV.put(`workspace:${invite.workspaceId}`, JSON.stringify(ws));
          }
        }
      }

      return json(200, { ok: true, invite, message: 'Convite aceito com sucesso!' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao aceitar convite' });
    }
  }

  if (action === 'revoke') {
    const inviteToken = String(input.token || '').trim();
    if (!inviteToken) return json(400, { ok: false, error: 'Token de convite obrigatório' });

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`invite:${inviteToken}`);
      if (!raw) return json(404, { ok: false, error: 'Convite não encontrado' });

      const invite = JSON.parse(raw);
      if (invite.invitedBy !== session.sub) return json(403, { ok: false, error: 'Sem permissão para revogar este convite' });

      invite.status = 'revoked';
      invite.revokedAt = new Date().toISOString();
      await env.LIFEOS_KV.put(`invite:${inviteToken}`, JSON.stringify(invite), { expirationTtl: 86400 });

      return json(200, { ok: true, message: 'Convite revogado' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao revogar convite' });
    }
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: send, accept, revoke' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
