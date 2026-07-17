// LifeOS Enterprise — Organizations, Workspaces & RBAC API v32.1
// Cloudflare Pages Function: /api/enterprise/rbac
// Controle de acesso por organização/workspace com persistência exclusiva em LIFEOS_KV.

import { getCookie, json, verifySession } from '../../_auth.js';
import {
  ENTERPRISE_PERMISSIONS,
  ENTERPRISE_ROLES,
  accessibleWorkspaces,
  addUserOrganization,
  allRoleDefinitions,
  appendOrganizationAudit,
  assertPermission,
  assertWorkspacePermission,
  canManageRole,
  canInviteRole,
  createOrganization,
  createOrganizationInvite,
  acceptOrganizationInvite,
  generateEnterpriseId,
  getMembership,
  listOrganizationsForUser,
  loadOrganization,
  normalizeRole,
  normalizeText,
  readJson,
  removeUserOrganization,
  revokeOrganizationInvite,
  saveOrganization,
} from '../../_enterprise.js';

function responseError(error, fallback = 'Falha ao processar a solicitação.') {
  const message = error instanceof Error ? error.message : fallback;
  const status = /Sem acesso|Sem permissão|não é possível|Apenas o proprietário/i.test(message) ? 403 : 400;
  return json(status, { ok: false, error: message });
}

function publicWorkspace(workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    type: workspace.type,
    status: workspace.status,
    members: workspace.members || [],
    preferences: workspace.preferences || {},
    protected: Boolean(workspace.protected),
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function publicMember(member) {
  return {
    userId: member.userId,
    email: member.email,
    name: member.name || '',
    role: normalizeRole(member.role),
    status: member.status,
    joinedAt: member.joinedAt,
    invitedBy: member.invitedBy || null,
    roleChangedAt: member.roleChangedAt || null,
    roleChangedBy: member.roleChangedBy || null,
  };
}

async function authenticate(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) throw new Error('Serviço indisponível.');
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) {
    const error = new Error('Não autenticado.');
    error.status = 401;
    throw error;
  }
  if (!env.LIFEOS_KV) {
    const error = new Error('Armazenamento indisponível.');
    error.status = 503;
    throw error;
  }
  return { actor: session.sub, kv: env.LIFEOS_KV };
}

async function requireOrganization(kv, actor, orgId) {
  const normalizedOrgId = normalizeText(orgId, 80);
  if (!normalizedOrgId) throw new Error('orgId é obrigatório.');
  const organization = await loadOrganization(kv, normalizedOrgId);
  if (!organization) throw new Error('Organização não encontrada.');
  const membership = getMembership(organization, actor);
  if (!membership || membership.status !== 'active') throw new Error('Sem acesso a esta organização.');
  return { organization, membership };
}

async function organizationInvites(kv, organization) {
  const raw = await readJson(kv, `org:invites:${organization.id}`, []);
  return (Array.isArray(raw) ? raw : []).map((invite) => ({
    token: invite.token,
    email: invite.email,
    role: normalizeRole(invite.role),
    workspaceId: invite.workspaceId || null,
    workspaceName: invite.workspaceName || null,
    invitedBy: invite.invitedBy,
    status: invite.status || 'pending',
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt || null,
    revokedAt: invite.revokedAt || null,
  }));
}

export async function onRequestGet({ request, env }) {
  try {
    const { actor, kv } = await authenticate(request, env);
    const url = new URL(request.url);
    const view = normalizeText(url.searchParams.get('view') || 'organizations', 40);
    const orgId = normalizeText(url.searchParams.get('orgId'), 80);

    if (view === 'roles') {
      return json(200, { ok: true, roles: allRoleDefinitions(), permissions: ENTERPRISE_PERMISSIONS });
    }

    if (view === 'organizations') {
      return json(200, { ok: true, organizations: await listOrganizationsForUser(kv, actor) });
    }

    const { organization, membership } = await requireOrganization(kv, actor, orgId);

    if (view === 'workspaces') {
      assertPermission(organization, actor, 'workspaces.read', organization.roles || []);
      return json(200, { ok: true, orgId: organization.id, workspaces: accessibleWorkspaces(organization, membership, actor).map(publicWorkspace) });
    }

    if (view === 'members') {
      assertPermission(organization, actor, 'members.read', organization.roles || []);
      return json(200, { ok: true, orgId: organization.id, members: organization.members.map(publicMember) });
    }

    if (view === 'invites') {
      assertPermission(organization, actor, 'members.read', organization.roles || []);
      return json(200, { ok: true, orgId: organization.id, invites: await organizationInvites(kv, organization) });
    }

    if (view === 'audit') {
      assertPermission(organization, actor, 'audit.read', organization.roles || []);
      const audit = await readJson(kv, `org:audit:${organization.id}`, []);
      return json(200, { ok: true, orgId: organization.id, audit: Array.isArray(audit) ? audit : [] });
    }

    if (view === 'permissions') {
      return json(200, {
        ok: true,
        orgId: organization.id,
        role: membership.role,
        permissions: membership.role === 'owner' ? ['*'] : (ENTERPRISE_ROLES[normalizeRole(membership.role)]?.permissions || []),
        allPermissions: ENTERPRISE_PERMISSIONS,
      });
    }

    return json(400, { ok: false, error: 'view inválida. Use: organizations, workspaces, members, invites, audit, roles, permissions.' });
  } catch (error) {
    if (error?.status) return json(error.status, { ok: false, error: error.message });
    return responseError(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const { actor, kv } = await authenticate(request, env);
    let body;
    try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido.' }); }
    const action = normalizeText(body?.action, 80);

    if (action === 'create-org') {
      const organization = await createOrganization(kv, actor, { name: body.name, description: body.description, ownerName: body.ownerName });
      return json(201, { ok: true, organization: { ...organization, members: organization.members.map(publicMember), workspaces: organization.workspaces.map(publicWorkspace) } });
    }

    if (action === 'update-org') {
      const { organization } = await requireOrganization(kv, actor, body.orgId);
      assertPermission(organization, actor, 'org.update', organization.roles || []);
      const name = body.name !== undefined ? normalizeText(body.name, 120) : organization.name;
      if (!name) throw new Error('Nome da organização é obrigatório.');
      if (body.name !== undefined) organization.name = name;
      if (body.description !== undefined) organization.description = normalizeText(body.description, 500);
      if (body.settings && typeof body.settings === 'object') {
        organization.settings = {
          ...organization.settings,
          allowMemberInvites: body.settings.allowMemberInvites !== false,
          requireApproval: Boolean(body.settings.requireApproval),
          maxMembers: Math.max(1, Math.min(10000, Number(body.settings.maxMembers) || organization.settings.maxMembers || 100)),
        };
      }
      await saveOrganization(kv, organization);
      await appendOrganizationAudit(kv, organization.id, { actor, action: 'organization.update', resourceId: organization.id, detail: `Organização "${organization.name}" atualizada.` });
      return json(200, { ok: true, organization: { ...organization, members: organization.members.map(publicMember), workspaces: organization.workspaces.map(publicWorkspace) } });
    }

    if (action === 'create-workspace') {
      const { organization } = await requireOrganization(kv, actor, body.orgId);
      assertPermission(organization, actor, 'workspaces.create', organization.roles || []);
      const name = normalizeText(body.name, 120);
      if (!name) throw new Error('Nome do workspace é obrigatório.');
      if (organization.workspaces.some((workspace) => workspace.name.toLowerCase() === name.toLowerCase())) throw new Error('Já existe um workspace com este nome.');
      const timestamp = new Date().toISOString();
      const workspace = {
        id: generateEnterpriseId('ws'),
        name,
        description: normalizeText(body.description, 500),
        type: normalizeText(body.type, 40) || 'general',
        status: 'active',
        members: [actor],
        preferences: { notifications: true, defaultView: 'overview' },
        activity: [],
        protected: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      organization.workspaces.push(workspace);
      await saveOrganization(kv, organization);
      await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.create', resourceId: workspace.id, detail: `Workspace "${workspace.name}" criado.` });
      return json(201, { ok: true, workspace: publicWorkspace(workspace) });
    }

    if (action === 'update-workspace') {
      const { organization, workspace } = await (async () => {
        const { organization } = await requireOrganization(kv, actor, body.orgId);
        return { organization, ...assertWorkspacePermission(organization, actor, normalizeText(body.workspaceId, 80), 'workspaces.update', organization.roles || []) };
      })();
      const name = body.name !== undefined ? normalizeText(body.name, 120) : workspace.name;
      if (!name) throw new Error('Nome do workspace é obrigatório.');
      if (body.name !== undefined) workspace.name = name;
      if (body.description !== undefined) workspace.description = normalizeText(body.description, 500);
      if (body.type !== undefined) workspace.type = normalizeText(body.type, 40) || 'general';
      if (body.status !== undefined && ['active', 'archived'].includes(body.status)) workspace.status = body.status;
      if (body.preferences && typeof body.preferences === 'object') workspace.preferences = { ...workspace.preferences, notifications: body.preferences.notifications !== false, defaultView: ['overview', 'members', 'activity', 'preferences'].includes(body.preferences.defaultView) ? body.preferences.defaultView : workspace.preferences?.defaultView || 'overview' };
      workspace.updatedAt = new Date().toISOString();
      await saveOrganization(kv, organization);
      await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.update', resourceId: workspace.id, detail: `Workspace "${workspace.name}" atualizado.` });
      return json(200, { ok: true, workspace: publicWorkspace(workspace) });
    }

    if (action === 'delete-workspace') {
      const { organization } = await requireOrganization(kv, actor, body.orgId);
      assertPermission(organization, actor, 'workspaces.delete', organization.roles || []);
      const workspace = organization.workspaces.find((item) => item.id === normalizeText(body.workspaceId, 80));
      if (!workspace) throw new Error('Workspace não encontrado.');
      if (workspace.protected) throw new Error('Este workspace é protegido e não pode ser excluído.');
      if (organization.workspaces.length <= 1) throw new Error('A organização deve manter ao menos um workspace.');
      organization.workspaces = organization.workspaces.filter((item) => item.id !== workspace.id);
      await saveOrganization(kv, organization);
      await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.delete', resourceId: workspace.id, detail: `Workspace "${workspace.name}" excluído.` });
      return json(200, { ok: true, deleted: workspace.id });
    }

    if (action === 'workspace-member-add' || action === 'workspace-member-remove') {
      const { organization } = await requireOrganization(kv, actor, body.orgId);
      const { workspace } = assertWorkspacePermission(organization, actor, normalizeText(body.workspaceId, 80), 'workspace.members', organization.roles || []);
      const targetUserId = normalizeText(body.targetUserId, 254);
      const target = organization.members.find((member) => member.userId === targetUserId || member.email === targetUserId);
      if (!target || target.status !== 'active') throw new Error('Membro ativo não encontrado.');
      if (action === 'workspace-member-add') {
        if (!workspace.members.includes(target.userId)) workspace.members.push(target.userId);
        workspace.updatedAt = new Date().toISOString();
        await saveOrganization(kv, organization);
        await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.member.add', resourceId: workspace.id, detail: `${target.email} adicionado ao workspace "${workspace.name}".` });
        return json(200, { ok: true, workspace: publicWorkspace(workspace) });
      }
      if (workspace.members.length <= 1) throw new Error('O workspace deve manter ao menos um membro.');
      workspace.members = workspace.members.filter((memberId) => memberId !== target.userId && memberId !== target.email);
      workspace.updatedAt = new Date().toISOString();
      await saveOrganization(kv, organization);
      await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.member.remove', resourceId: workspace.id, detail: `${target.email} removido do workspace "${workspace.name}".` });
      return json(200, { ok: true, workspace: publicWorkspace(workspace) });
    }

    if (action === 'invite-member') {
      const { organization, membership } = await requireOrganization(kv, actor, body.orgId);
      assertPermission(organization, actor, 'members.invite', organization.roles || []);
      if (organization.settings?.allowMemberInvites === false && !['owner', 'admin'].includes(membership.role)) throw new Error('Convites foram desativados para este cargo.');
      const requestedRole = normalizeText(body.role, 40).toLowerCase();
      if (!ENTERPRISE_ROLES[requestedRole]) throw new Error('Cargo de convite inválido.');
      if (!canInviteRole(membership.role, requestedRole)) throw new Error('Sem permissão para convidar com este cargo.');
      const workspaceId = normalizeText(body.workspaceId, 80) || null;
      if (workspaceId) assertWorkspacePermission(organization, actor, workspaceId, 'workspace.members', organization.roles || []);
      const invite = await createOrganizationInvite(kv, { organization, inviter: actor, email: body.email, role: requestedRole, workspaceId, origin: new URL(request.url).origin });
      return json(201, { ok: true, invite });
    }

    if (action === 'accept-invite') {
      const accepted = await acceptOrganizationInvite(kv, actor, normalizeText(body.token, 300));
      return json(200, { ok: true, organization: { id: accepted.organization.id, name: accepted.organization.name }, role: accepted.invite.role, invite: accepted.invite });
    }

    if (action === 'revoke-invite') {
      const invite = await revokeOrganizationInvite(kv, actor, normalizeText(body.token, 300));
      return json(200, { ok: true, invite });
    }

    if (action === 'change-role') {
      const { organization, membership } = await requireOrganization(kv, actor, body.orgId);
      assertPermission(organization, actor, 'members.roles', organization.roles || []);
      const targetUserId = normalizeText(body.targetUserId, 254);
      const target = organization.members.find((member) => member.userId === targetUserId || member.email === targetUserId);
      if (!target) throw new Error('Membro não encontrado.');
      const newRole = normalizeRole(body.newRole);
      if (!canManageRole(membership.role, target.role, newRole)) throw new Error('Sem permissão para alterar este cargo.');
      const oldRole = target.role;
      target.role = newRole;
      target.roleChangedAt = new Date().toISOString();
      target.roleChangedBy = actor;
      await saveOrganization(kv, organization);
      await appendOrganizationAudit(kv, organization.id, { actor, action: 'member.changeRole', resourceId: target.userId, detail: `Cargo de ${target.email} alterado de ${oldRole} para ${newRole}.` });
      return json(200, { ok: true, member: publicMember(target) });
    }

    if (action === 'remove-member') {
      const { organization, membership } = await requireOrganization(kv, actor, body.orgId);
      assertPermission(organization, actor, 'members.remove', organization.roles || []);
      const targetUserId = normalizeText(body.targetUserId, 254);
      const target = organization.members.find((member) => member.userId === targetUserId || member.email === targetUserId);
      if (!target) throw new Error('Membro não encontrado.');
      if (!canManageRole(membership.role, target.role, target.role)) throw new Error('Sem permissão para remover este membro.');
      organization.members = organization.members.filter((member) => member.userId !== target.userId);
      organization.workspaces.forEach((workspace) => { workspace.members = (workspace.members || []).filter((memberId) => memberId !== target.userId && memberId !== target.email); workspace.updatedAt = new Date().toISOString(); });
      await saveOrganization(kv, organization);
      await removeUserOrganization(kv, target.userId, organization.id);
      await appendOrganizationAudit(kv, organization.id, { actor, action: 'member.remove', resourceId: target.userId, detail: `${target.email} removido da organização e dos workspaces.` });
      return json(200, { ok: true, removed: target.userId });
    }

    if (action === 'delete-org') {
      const { organization, membership } = await requireOrganization(kv, actor, body.orgId);
      if (membership.role !== 'owner' || organization.ownerId !== actor) throw new Error('Apenas o proprietário pode excluir a organização.');
      for (const member of organization.members) await removeUserOrganization(kv, member.userId, organization.id);
      await appendOrganizationAudit(kv, organization.id, { actor, action: 'organization.delete', resourceId: organization.id, detail: `Organização "${organization.name}" excluída.` });
      await kv.delete(`org:${organization.id}`);
      return json(200, { ok: true, deleted: organization.id });
    }

    return json(400, { ok: false, error: 'Ação inválida. Use: create-org, update-org, create-workspace, update-workspace, delete-workspace, workspace-member-add, workspace-member-remove, invite-member, accept-invite, revoke-invite, change-role, remove-member, delete-org.' });
  } catch (error) {
    if (error?.status) return json(error.status, { ok: false, error: error.message });
    return responseError(error);
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido.' }, { allow: 'GET, POST' });
}
