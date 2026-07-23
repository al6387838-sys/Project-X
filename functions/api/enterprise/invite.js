// LifeOS Enterprise — convite de organização e workspace
// Cloudflare Pages Function: GET/POST /api/enterprise/invite
// Compartilha o modelo RBAC de funções/_enterprise.js.

import { getCookie, json, verifySession } from '../../_auth.js';
import {
  ENTERPRISE_ROLES,
  acceptOrganizationInvite,
  assertPermission,
  assertWorkspacePermission,
  canInviteRole,
  createOrganizationInvite,
  getMembership,
  listOrganizationsForUser,
  loadOrganization,
  normalizeText,
  readJson,
  revokeOrganizationInvite,
} from '../../_enterprise.js';

async function sendInviteEmail(toEmail, inviterName, orgName, token, origin, env) {
  if (!env.RESEND_API_KEY) return false;
  const inviteUrl = `${origin}/accept-invite?token=${encodeURIComponent(token)}`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'LifeOS <noreply@lifeos.app>',
        to: [toEmail],
        subject: `${inviterName} convidou você para ${orgName} no LifeOS Enterprise`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:12px"><h1 style="font-size:24px;font-weight:700">Você foi convidado</h1><p style="color:#bbb"><strong>${inviterName}</strong> convidou você para participar de <strong>${orgName}</strong> no LifeOS Enterprise.</p><p style="margin:24px 0"><a href="${inviteUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Aceitar convite</a></p><p style="color:#777;font-size:12px">Este convite expira em sete dias.</p></div>`,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function authenticate(request, env) {
  if (!env.LIFEOS_SESSION_SECRET) {
    const error = new Error('Serviço indisponível');
    error.status = 503;
    throw error;
  }
  if (!env.LIFEOS_KV) {
    const error = new Error('Armazenamento Cloudflare KV indisponível');
    error.status = 503;
    throw error;
  }
  const session = await verifySession(getCookie(request.headers.get('cookie')), env.LIFEOS_SESSION_SECRET);
  if (!session) {
    const error = new Error('Não autenticado');
    error.status = 401;
    throw error;
  }
  return { actor: session.sub, kv: env.LIFEOS_KV };
}

async function getOrganizationForActor(kv, actor, requestedOrgId = '') {
  const summaries = await listOrganizationsForUser(kv, actor);
  const normalizedId = normalizeText(requestedOrgId, 80);
  const summary = normalizedId ? summaries.find((item) => item.id === normalizedId) : summaries[0];
  if (!summary) throw new Error('Sem acesso à organização solicitada.');
  const organization = await loadOrganization(kv, summary.id);
  const membership = getMembership(organization, actor);
  if (!organization || !membership || membership.status !== 'active') throw new Error('Sem acesso à organização solicitada.');
  return { organization, membership };
}

function roleFromInput(value) {
  const raw = normalizeText(value, 40).toLowerCase();
  const aliases = { member: 'employee', viewer: 'guest' };
  const role = aliases[raw] || raw;
  if (!ENTERPRISE_ROLES[role]) throw new Error('Cargo inválido. Use: owner, admin, manager, employee ou guest.');
  return role;
}

function publicInvite(invite) {
  return {
    token: invite.token,
    orgId: invite.orgId,
    orgName: invite.orgName,
    workspaceId: invite.workspaceId || null,
    workspaceName: invite.workspaceName || null,
    email: invite.email,
    role: invite.role,
    invitedBy: invite.invitedBy,
    status: invite.status,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt || null,
    revokedAt: invite.revokedAt || null,
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const { actor, kv } = await authenticate(request, env);
    const token = normalizeText(new URL(request.url).searchParams.get('token'), 200);
    if (token) {
      const invite = await readJson(kv, `invite:${token}`, null);
      if (!invite) return json(404, { ok: false, error: 'Convite não encontrado ou expirado' });
      if (normalizeText(invite.email, 254).toLowerCase() !== normalizeText(actor, 254).toLowerCase()) return json(403, { ok: false, error: 'Este convite não é para sua conta' });
      if (invite.status !== 'pending') return json(400, { ok: false, error: `Convite já ${invite.status}` });
      if (Date.parse(invite.expiresAt) < Date.now()) return json(400, { ok: false, error: 'Convite expirado' });
      return json(200, { ok: true, invite: publicInvite(invite) });
    }
    const sent = await readJson(kv, `invites:sent:${actor}`, []);
    const fresh = [];
    for (const item of Array.isArray(sent) ? sent : []) {
      const invite = await readJson(kv, `invite:${item.token}`, item);
      if (invite) fresh.push(publicInvite(invite));
    }
    return json(200, { ok: true, invites: fresh });
  } catch (error) {
    return json(error?.status || 400, { ok: false, error: error instanceof Error ? error.message : 'Erro ao verificar convite' });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const { actor, kv } = await authenticate(request, env);
    const input = await request.json().catch(() => null);
    if (!input || typeof input !== 'object') return json(400, { ok: false, error: 'Requisição inválida' });
    const action = normalizeText(input.action || 'send', 40);
    if (action === 'send') {
      const { organization, membership } = await getOrganizationForActor(kv, actor, input.orgId);
      assertPermission(organization, actor, 'members.invite', organization.roles || []);
      const role = roleFromInput(input.role);
      if (!canInviteRole(membership.role, role)) throw new Error('Sem permissão para convidar com este cargo.');
      const workspaceId = normalizeText(input.workspaceId, 80) || null;
      if (workspaceId) assertWorkspacePermission(organization, actor, workspaceId, 'workspace.members', organization.roles || []);
      const origin = new URL(request.url).origin;
      const invite = await createOrganizationInvite(kv, { organization, inviter: actor, email: input.email, role, workspaceId, origin });
      const emailSent = await sendInviteEmail(invite.email, actor, organization.name, invite.token, origin, env);
      return json(201, { ok: true, invite: publicInvite(invite), emailSent, message: emailSent ? `Convite enviado para ${invite.email}` : 'Convite criado com link de aceite seguro.', inviteUrl: invite.inviteUrl });
    }
    if (action === 'accept') {
      const accepted = await acceptOrganizationInvite(kv, actor, normalizeText(input.token, 200));
      return json(200, { ok: true, invite: publicInvite(accepted.invite), organization: { id: accepted.organization.id, name: accepted.organization.name }, message: 'Convite aceito com sucesso.' });
    }
    if (action === 'revoke') {
      const invite = await revokeOrganizationInvite(kv, actor, normalizeText(input.token, 200));
      return json(200, { ok: true, invite: publicInvite(invite), message: 'Convite revogado.' });
    }
    return json(400, { ok: false, error: 'Ação inválida. Use: send, accept, revoke' });
  } catch (error) {
    const status = error?.status || (/Sem acesso|Sem permissão|não é para sua conta/i.test(error?.message || '') ? 403 : 400);
    return json(status, { ok: false, error: error instanceof Error ? error.message : 'Erro ao processar convite' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
