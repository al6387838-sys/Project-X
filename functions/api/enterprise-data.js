// LifeOS Enterprise — fachada de compatibilidade do shell Enterprise v32.1
// Cloudflare Pages Function: GET/POST /api/enterprise-data
// Não usa dados sem fonte: todas as entidades vêm de organizações reais em LIFEOS_KV.

import { getCookie, json, verifySession } from '../_auth.js';
import {
  ENTERPRISE_PERMISSIONS,
  ENTERPRISE_ROLES,
  accessibleWorkspaces,
  allRoleDefinitions,
  appendOrganizationAudit,
  assertPermission,
  assertWorkspacePermission,
  canInviteRole,
  canManageRole,
  createOrganization,
  createOrganizationInvite,
  generateEnterpriseId,
  getMembership,
  listOrganizationsForUser,
  loadOrganization,
  normalizeRole,
  normalizeText,
  readJson,
  removeUserOrganization,
  saveOrganization,
} from '../_enterprise.js';

function activeMember(member) {
  return member?.status === 'active';
}

function publicMember(member) {
  return {
    id: member.userId,
    userId: member.userId,
    name: member.name || member.email,
    email: member.email,
    roleId: normalizeRole(member.role),
    team: '',
    status: member.status,
    lastActiveAt: member.joinedAt || null,
    joinedAt: member.joinedAt || null,
    invitedBy: member.invitedBy || null,
  };
}

function publicWorkspace(workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    type: workspace.type,
    description: workspace.description,
    status: workspace.status,
    members: workspace.members || [],
    preferences: workspace.preferences || { notifications: true, defaultView: 'overview' },
    activity: Array.isArray(workspace.activity) ? workspace.activity : [],
    protected: Boolean(workspace.protected),
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

async function authenticate(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) {
    const error = new Error('Autenticação ainda não configurada.');
    error.status = 503;
    throw error;
  }
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) {
    const error = new Error('Sessão administrativa necessária.');
    error.status = 401;
    throw error;
  }
  if (!env.LIFEOS_KV) {
    const error = new Error('Armazenamento Cloudflare KV indisponível.');
    error.status = 503;
    throw error;
  }
  return { actor: session.sub, kv: env.LIFEOS_KV };
}

async function resolveOrganization(kv, actor, requestedOrgId = '') {
  const organizations = await listOrganizationsForUser(kv, actor);
  if (!organizations.length) return { organization: null, membership: null, organizations };
  const id = normalizeText(requestedOrgId, 80);
  const selectedSummary = id ? organizations.find((organization) => organization.id === id) : organizations[0];
  if (!selectedSummary) throw new Error('Sem acesso à organização solicitada.');
  const organization = await loadOrganization(kv, selectedSummary.id);
  const membership = getMembership(organization, actor);
  if (!organization || !membership || !activeMember(membership)) throw new Error('Sem acesso a esta organização.');
  return { organization, membership, organizations };
}

async function organizationInvites(kv, orgId) {
  const invites = await readJson(kv, `org:invites:${orgId}`, []);
  return (Array.isArray(invites) ? invites : []).map((invite) => ({
    token: invite.token,
    email: invite.email,
    roleId: normalizeRole(invite.role),
    role: normalizeRole(invite.role),
    workspaceId: invite.workspaceId || null,
    workspaceName: invite.workspaceName || null,
    invitedBy: invite.invitedBy || null,
    status: invite.status || 'pending',
    createdAt: invite.createdAt || null,
    expiresAt: invite.expiresAt || null,
    acceptedAt: invite.acceptedAt || null,
  }));
}

async function buildData(kv, actor, requestedOrgId = '') {
  const { organization, membership, organizations } = await resolveOrganization(kv, actor, requestedOrgId);
  const roleDefinitions = allRoleDefinitions();
  if (!organization) {
    return {
      version: '32.1.0',
      organizations,
      organization: null,
      currentMembership: null,
      roles: roleDefinitions,
      members: [],
      workspaces: [],
      invites: [],
      auditLog: [],
      permissions: [],
      teams: [],
      subscription: { plan: 'Unassigned', status: 'not_configured', seats: null, seatsUsed: 0 },
      invoices: [], integrations: [], devices: [], policies: {}, intelligence: [], tasks: [], notifications: [], notificationPreferences: {}, mfa: {},
      system: { status: 'not_monitored', version: '32.1.0', environment: 'Cloudflare Pages', telemetryAvailable: false, telemetryReason: 'Telemetria de infraestrutura não configurada.', activeMembers: 0 },
    };
  }
  const audit = await readJson(kv, `org:audit:${organization.id}`, []);
  const invites = await organizationInvites(kv, organization.id);
  const accessible = accessibleWorkspaces(organization, membership, actor);
  const permissions = membership.role === 'owner' ? ['*'] : (ENTERPRISE_ROLES[normalizeRole(membership.role)]?.permissions || []);
  return {
    version: '32.1.0',
    organizations,
    organization: {
      id: organization.id,
      name: organization.name,
      description: organization.description,
      plan: organization.plan,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      ownerId: organization.ownerId,
    },
    currentMembership: { id: membership.userId, email: membership.email, roleId: membership.role, role: membership.role },
    roles: roleDefinitions,
    members: organization.members.map(publicMember),
    workspaces: accessible.map(publicWorkspace),
    invites,
    auditLog: Array.isArray(audit) ? audit : [],
    permissions,
    allPermissions: ENTERPRISE_PERMISSIONS,
    teams: [],
    subscription: { plan: organization.plan || 'Unassigned', status: 'not_configured', seats: organization.settings?.maxMembers || null, seatsUsed: organization.members.filter(activeMember).length },
    invoices: [], integrations: [], devices: [], policies: {}, intelligence: [], tasks: [], notifications: [], notificationPreferences: {}, mfa: {},
    system: {
      status: 'not_monitored', version: '32.1.0', environment: 'Cloudflare Pages', telemetryAvailable: false,
      telemetryReason: 'Telemetria de infraestrutura não configurada.', activeMembers: organization.members.filter(activeMember).length,
      lastCheckedAt: new Date().toISOString(), region: 'cloudflare-pages', uptime: null, apiP95: null, errorRate: null, activeSessions: null,
    },
  };
}

function recordWorkspaceActivity(workspace, actor, action, detail) {
  const timestamp = new Date().toISOString();
  const entry = { id: generateEnterpriseId('activity'), actor, action, detail, createdAt: timestamp };
  workspace.activity = [entry, ...(Array.isArray(workspace.activity) ? workspace.activity : [])].slice(0, 100);
  workspace.updatedAt = timestamp;
  return entry;
}

function normalizedInvitationRole(value) {
  const raw = normalizeText(value, 40).toLowerCase();
  const aliases = { member: 'employee', viewer: 'guest' };
  const role = aliases[raw] || raw;
  if (!ENTERPRISE_ROLES[role]) throw new Error('Cargo inválido.');
  return role;
}

async function getWritableOrganization(kv, actor, payload) {
  const { organization, membership } = await resolveOrganization(kv, actor, payload.orgId);
  if (!organization) throw new Error('Crie ou selecione uma organização antes de continuar.');
  return { organization, membership };
}

async function updateOrganization(kv, actor, payload) {
  const { organization } = await getWritableOrganization(kv, actor, payload);
  assertPermission(organization, actor, 'org.update', organization.roles || []);
  const name = payload.name !== undefined ? normalizeText(payload.name, 120) : organization.name;
  if (!name) throw new Error('Nome da organização é obrigatório.');
  organization.name = name;
  if (payload.description !== undefined) organization.description = normalizeText(payload.description, 500);
  await saveOrganization(kv, organization);
  await appendOrganizationAudit(kv, organization.id, { actor, action: 'organization.update', resourceId: organization.id, detail: `Organização "${organization.name}" atualizada.` });
}

async function inviteMember(kv, actor, payload) {
  const { organization, membership } = await getWritableOrganization(kv, actor, payload);
  assertPermission(organization, actor, 'members.invite', organization.roles || []);
  const role = normalizedInvitationRole(payload.roleId || payload.role);
  if (!canInviteRole(membership.role, role)) throw new Error('Sem permissão para convidar com este cargo.');
  const workspaceId = normalizeText(payload.workspaceId, 80) || null;
  if (workspaceId) assertWorkspacePermission(organization, actor, workspaceId, 'workspace.members', organization.roles || []);
  await createOrganizationInvite(kv, { organization, inviter: actor, email: payload.email, role, workspaceId, origin: payload.origin || 'https://lifeos.app' });
}

async function updateMember(kv, actor, payload) {
  const { organization, membership } = await getWritableOrganization(kv, actor, payload);
  const targetId = normalizeText(payload.id || payload.targetUserId, 254);
  const target = organization.members.find((member) => member.userId === targetId || member.email === targetId);
  if (!target) throw new Error('Membro não encontrado.');
  const requestedRole = payload.roleId || payload.newRole;
  if (requestedRole !== undefined && normalizedInvitationRole(requestedRole) !== target.role) {
    assertPermission(organization, actor, 'members.roles', organization.roles || []);
    const nextRole = normalizedInvitationRole(requestedRole);
    if (!canManageRole(membership.role, target.role, nextRole)) throw new Error('Sem permissão para alterar este cargo.');
    const previousRole = target.role;
    target.role = nextRole;
    target.roleChangedAt = new Date().toISOString();
    target.roleChangedBy = actor;
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'member.changeRole', resourceId: target.userId, detail: `Cargo de ${target.email} alterado de ${previousRole} para ${nextRole}.` });
  }
  if (payload.name !== undefined) {
    if (target.userId !== actor) assertPermission(organization, actor, 'members.roles', organization.roles || []);
    target.name = normalizeText(payload.name, 120);
  }
  if (payload.status !== undefined) {
    assertPermission(organization, actor, 'members.remove', organization.roles || []);
    if (target.role === 'owner') throw new Error('Owner não pode ser suspenso.');
    if (!['active', 'suspended'].includes(payload.status)) throw new Error('Status inválido.');
    target.status = payload.status;
  }
  await saveOrganization(kv, organization);
}

async function removeMember(kv, actor, payload) {
  const { organization, membership } = await getWritableOrganization(kv, actor, payload);
  assertPermission(organization, actor, 'members.remove', organization.roles || []);
  const targetId = normalizeText(payload.id || payload.targetUserId, 254);
  const target = organization.members.find((member) => member.userId === targetId || member.email === targetId);
  if (!target) throw new Error('Membro não encontrado.');
  if (!canManageRole(membership.role, target.role, target.role)) throw new Error('Sem permissão para remover este membro.');
  organization.members = organization.members.filter((member) => member.userId !== target.userId);
  organization.workspaces.forEach((workspace) => { workspace.members = (workspace.members || []).filter((id) => id !== target.userId && id !== target.email); workspace.updatedAt = new Date().toISOString(); });
  await saveOrganization(kv, organization);
  await removeUserOrganization(kv, target.userId, organization.id);
  await appendOrganizationAudit(kv, organization.id, { actor, action: 'member.remove', resourceId: target.userId, detail: `${target.email} removido da organização e de todos os workspaces.` });
}

async function createWorkspace(kv, actor, payload) {
  const { organization } = await getWritableOrganization(kv, actor, payload);
  assertPermission(organization, actor, 'workspaces.create', organization.roles || []);
  const name = normalizeText(payload.name, 120);
  if (!name) throw new Error('Nome do workspace é obrigatório.');
  if (organization.workspaces.some((workspace) => workspace.name.toLowerCase() === name.toLowerCase())) throw new Error('Já existe um workspace com este nome.');
  const timestamp = new Date().toISOString();
  const workspace = { id: generateEnterpriseId('ws'), name, type: normalizeText(payload.type, 40) || 'general', description: normalizeText(payload.description, 500), status: 'active', members: [actor], preferences: { notifications: true, defaultView: 'overview' }, activity: [], protected: false, createdAt: timestamp, updatedAt: timestamp };
  const detail = `Workspace "${workspace.name}" criado.`;
  recordWorkspaceActivity(workspace, actor, 'workspace.create', detail);
  organization.workspaces.push(workspace);
  await saveOrganization(kv, organization);
  await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.create', resourceId: workspace.id, detail });
}

async function updateWorkspace(kv, actor, payload) {
  const { organization } = await getWritableOrganization(kv, actor, payload);
  const { workspace } = assertWorkspacePermission(organization, actor, normalizeText(payload.id || payload.workspaceId, 80), 'workspaces.update', organization.roles || []);
  const name = payload.name !== undefined ? normalizeText(payload.name, 120) : workspace.name;
  if (!name) throw new Error('Nome do workspace é obrigatório.');
  workspace.name = name;
  if (payload.description !== undefined) workspace.description = normalizeText(payload.description, 500);
  if (payload.type !== undefined) workspace.type = normalizeText(payload.type, 40) || 'general';
  if (['active', 'archived'].includes(payload.status)) workspace.status = payload.status;
  if (payload.preferences && typeof payload.preferences === 'object') workspace.preferences = { ...workspace.preferences, notifications: payload.preferences.notifications !== false, defaultView: ['overview', 'members', 'activity', 'preferences'].includes(payload.preferences.defaultView) ? payload.preferences.defaultView : workspace.preferences?.defaultView || 'overview' };
  const detail = `Workspace "${workspace.name}" atualizado.`;
  recordWorkspaceActivity(workspace, actor, 'workspace.update', detail);
  await saveOrganization(kv, organization);
  await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.update', resourceId: workspace.id, detail });
}

async function updateWorkspaceMember(kv, actor, payload, add) {
  const { organization } = await getWritableOrganization(kv, actor, payload);
  const { workspace } = assertWorkspacePermission(organization, actor, normalizeText(payload.id || payload.workspaceId, 80), 'workspace.members', organization.roles || []);
  const targetId = normalizeText(payload.memberId || payload.targetUserId, 254);
  const target = organization.members.find((member) => member.userId === targetId || member.email === targetId);
  if (!target || !activeMember(target)) throw new Error('Membro ativo não encontrado.');
  if (add) {
    if (!workspace.members.includes(target.userId)) workspace.members.push(target.userId);
  } else {
    if (workspace.members.length <= 1) throw new Error('O workspace deve manter ao menos um membro.');
    workspace.members = workspace.members.filter((id) => id !== target.userId && id !== target.email);
  }
  const activityAction = add ? 'workspace.member.add' : 'workspace.member.remove';
  const detail = `${target.email} ${add ? 'adicionado ao' : 'removido do'} workspace "${workspace.name}".`;
  recordWorkspaceActivity(workspace, actor, activityAction, detail);
  await saveOrganization(kv, organization);
  await appendOrganizationAudit(kv, organization.id, { actor, action: activityAction, resourceId: workspace.id, detail });
}

async function deleteWorkspace(kv, actor, payload) {
  const { organization } = await getWritableOrganization(kv, actor, payload);
  assertPermission(organization, actor, 'workspaces.delete', organization.roles || []);
  const workspace = organization.workspaces.find((item) => item.id === normalizeText(payload.id || payload.workspaceId, 80));
  if (!workspace) throw new Error('Workspace não encontrado.');
  if (workspace.protected) throw new Error('Este workspace é protegido e não pode ser excluído.');
  if (payload.confirmName !== undefined && normalizeText(payload.confirmName, 120) !== workspace.name) throw new Error('Digite o nome exato do workspace para confirmar.');
  if (organization.workspaces.length <= 1) throw new Error('A organização deve manter ao menos um workspace.');
  organization.workspaces = organization.workspaces.filter((item) => item.id !== workspace.id);
  await saveOrganization(kv, organization);
  await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.delete', resourceId: workspace.id, detail: `Workspace "${workspace.name}" excluído.` });
}

async function applyAction(kv, actor, action, payload) {
  switch (action) {
    case 'organization.create':
      await createOrganization(kv, actor, { name: payload.name, description: payload.description, ownerName: payload.ownerName });
      return;
    case 'organization.update':
    case 'org.update':
      await updateOrganization(kv, actor, payload);
      return;
    case 'member.invite':
      await inviteMember(kv, actor, payload);
      return;
    case 'member.update':
      await updateMember(kv, actor, payload);
      return;
    case 'member.suspend': {
      const { organization } = await getWritableOrganization(kv, actor, payload);
      const target = organization.members.find((member) => member.userId === normalizeText(payload.id, 254));
      if (!target) throw new Error('Membro não encontrado.');
      await updateMember(kv, actor, { ...payload, status: target.status === 'suspended' ? 'active' : 'suspended' });
      return;
    }
    case 'member.remove':
      await removeMember(kv, actor, payload);
      return;
    case 'workspace.create':
      await createWorkspace(kv, actor, payload);
      return;
    case 'workspace.update':
      await updateWorkspace(kv, actor, payload);
      return;
    case 'workspace.member.add':
      await updateWorkspaceMember(kv, actor, payload, true);
      return;
    case 'workspace.member.remove':
      await updateWorkspaceMember(kv, actor, payload, false);
      return;
    case 'workspace.delete':
      await deleteWorkspace(kv, actor, payload);
      return;
    case 'invite.accept':
      throw new Error('Use o link individual de convite para aceitar esta entrada.');
    case 'role.create':
    case 'role.update':
    case 'role.remove':
      throw new Error('Os cargos Enterprise são os cinco perfis de sistema e não podem ser alterados por esta tela.');
    default:
      throw new Error('Ação não disponível para dados reais do Enterprise.');
  }
}

export async function onRequest({ request, env }) {
  try {
    const { actor, kv } = await authenticate(request, env);
    if (!['GET', 'POST'].includes(request.method)) return json(405, { ok: false, error: 'Método não permitido.' }, { allow: 'GET, POST' });
    if (request.method === 'GET') {
      const requestedOrgId = new URL(request.url).searchParams.get('orgId') || '';
      return json(200, { ok: true, data: await buildData(kv, actor, requestedOrgId) });
    }
    const input = await request.json().catch(() => null);
    if (!input || typeof input !== 'object') return json(400, { ok: false, error: 'JSON inválido.' });
    await applyAction(kv, actor, normalizeText(input.action, 100), input.payload && typeof input.payload === 'object' ? input.payload : {});
    return json(200, { ok: true, data: await buildData(kv, actor, input.payload?.orgId || '') });
  } catch (error) {
    const status = error?.status || (/Sem acesso|Sem permissão|Apenas o proprietário|não pode/i.test(error?.message || '') ? 403 : 400);
    return json(status, { ok: false, error: error instanceof Error ? error.message : 'Falha ao processar a solicitação.' });
  }
}
