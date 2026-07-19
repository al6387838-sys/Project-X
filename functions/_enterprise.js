// LifeOS Enterprise — organização, RBAC e escopo de workspace
// Utilidade interna reutilizada pelas Functions já publicadas.

const ROLE_ALIASES = {
  member: 'employee',
  viewer: 'guest',
};

export const ENTERPRISE_PERMISSIONS = {
  'org.read': 'Visualizar organização',
  'org.update': 'Editar organização',
  'org.delete': 'Excluir organização',
  'members.read': 'Visualizar membros e convites',
  'members.invite': 'Convidar membros',
  'members.remove': 'Remover membros',
  'members.roles': 'Alterar cargos',
  'workspaces.read': 'Visualizar workspaces autorizados',
  'workspaces.create': 'Criar workspaces',
  'workspaces.update': 'Editar workspaces autorizados',
  'workspaces.delete': 'Excluir workspaces',
  'workspace.members': 'Gerenciar membros do workspace',
  'crm.read': 'Visualizar CRM',
  'crm.write': 'Criar e editar CRM',
  'crm.delete': 'Excluir dados do CRM',
  'agenda.read': 'Visualizar agenda comercial',
  'agenda.write': 'Criar e editar agenda comercial',
  'agenda.delete': 'Excluir agenda comercial',
  'analytics.read': 'Visualizar analytics',
  'billing.read': 'Visualizar billing',
  'billing.manage': 'Gerenciar billing',
  'integrations.read': 'Visualizar integrações',
  'integrations.manage': 'Gerenciar integrações',
  'audit.read': 'Visualizar auditoria',
  'security.read': 'Visualizar segurança',
  'security.manage': 'Gerenciar segurança',
  'settings.manage': 'Gerenciar configurações enterprise',
};

export const ENTERPRISE_ROLES = {
  owner: {
    id: 'owner',
    name: 'Owner',
    description: 'Controle integral e irremovível da organização.',
    immutable: true,
    permissions: ['*'],
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    description: 'Administração operacional, membros e workspaces.',
    permissions: [
      'org.read', 'org.update', 'members.read', 'members.invite', 'members.remove', 'members.roles',
      'workspaces.read', 'workspaces.create', 'workspaces.update', 'workspaces.delete', 'workspace.members',
      'crm.read', 'crm.write', 'crm.delete', 'agenda.read', 'agenda.write', 'agenda.delete',
      'analytics.read', 'billing.read', 'billing.manage', 'integrations.read', 'integrations.manage',
      'audit.read', 'security.read', 'security.manage', 'settings.manage',
    ],
  },
  manager: {
    id: 'manager',
    name: 'Manager',
    description: 'Gestão de dados e workspaces aos quais pertence.',
    permissions: [
      'org.read', 'members.read', 'workspaces.read', 'workspaces.create', 'workspaces.update', 'workspace.members',
      'crm.read', 'crm.write', 'crm.delete', 'agenda.read', 'agenda.write', 'agenda.delete',
      'analytics.read', 'audit.read', 'integrations.read',
    ],
  },
  employee: {
    id: 'employee',
    name: 'Employee',
    description: 'Operação comercial nos workspaces aos quais pertence.',
    permissions: ['org.read', 'workspaces.read', 'crm.read', 'crm.write', 'agenda.read', 'agenda.write', 'integrations.read'],
  },
  guest: {
    id: 'guest',
    name: 'Guest',
    description: 'Acesso somente leitura aos workspaces autorizados.',
    permissions: ['org.read', 'workspaces.read', 'crm.read', 'agenda.read'],
  },
};

const ROLE_RANK = { guest: 1, employee: 2, manager: 3, admin: 4, owner: 5 };
const ORG_INDEX_PREFIX = 'user:orgs:';

export function generateEnterpriseId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function normalizeText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normalizeRole(value) {
  const key = normalizeText(String(value || ''), 40).toLowerCase();
  const role = ROLE_ALIASES[key] || key;
  return ENTERPRISE_ROLES[role] ? role : 'guest';
}

export function allRoleDefinitions(customRoles = []) {
  const system = Object.values(ENTERPRISE_ROLES).map((role) => ({ ...role, system: true }));
  const custom = Array.isArray(customRoles)
    ? customRoles
      .filter((role) => role && typeof role.id === 'string' && !ENTERPRISE_ROLES[role.id])
      .map((role) => ({
        id: normalizeText(role.id, 80),
        name: normalizeText(role.name, 80),
        description: normalizeText(role.description, 300),
        system: false,
        permissions: Array.isArray(role.permissions) ? role.permissions.map((item) => normalizeText(String(item), 80)).filter(Boolean).slice(0, 60) : [],
      }))
    : [];
  return [...system, ...custom];
}

export function rolePermissions(roleId, customRoles = []) {
  const normalized = normalizeRole(roleId);
  if (ENTERPRISE_ROLES[normalized] && (normalized === roleId || ROLE_ALIASES[roleId] || !roleId)) {
    return ENTERPRISE_ROLES[normalized].permissions;
  }
  const custom = allRoleDefinitions(customRoles).find((role) => role.id === roleId && !role.system);
  return custom?.permissions || ENTERPRISE_ROLES.guest.permissions;
}

export function hasPermission(member, permission, customRoles = []) {
  if (!member || !permission) return false;
  const permissions = rolePermissions(member.role, customRoles);
  return permissions.includes('*') || permissions.includes(permission);
}

export function canManageRole(requesterRole, targetRole, nextRole) {
  const requester = normalizeRole(requesterRole);
  const target = normalizeRole(targetRole);
  const next = normalizeRole(nextRole);
  if (next === 'owner' || target === 'owner') return false;
  if (requester === 'owner') return true;
  if (requester !== 'admin') return false;
  return (ROLE_RANK[target] || 0) < ROLE_RANK.admin && (ROLE_RANK[next] || 0) < ROLE_RANK.admin;
}

export function canInviteRole(requesterRole, invitedRole) {
  const requester = normalizeRole(requesterRole);
  const invited = normalizeRole(invitedRole);
  if (invited === 'owner') return false;
  if (requester === 'owner') return true;
  if (requester === 'admin') return ['manager', 'employee', 'guest'].includes(invited);
  if (requester === 'manager') return ['employee', 'guest'].includes(invited);
  return false;
}

export async function readJson(kv, key, fallback = null) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function getUserOrganizationIds(kv, userId) {
  const ids = await readJson(kv, `${ORG_INDEX_PREFIX}${userId}`, []);
  return Array.isArray(ids) ? [...new Set(ids.filter((id) => typeof id === 'string' && id))] : [];
}

export async function addUserOrganization(kv, userId, orgId) {
  const ids = await getUserOrganizationIds(kv, userId);
  if (!ids.includes(orgId)) {
    ids.push(orgId);
    await kv.put(`${ORG_INDEX_PREFIX}${userId}`, JSON.stringify(ids));
  }
  return ids;
}

export async function removeUserOrganization(kv, userId, orgId) {
  const ids = (await getUserOrganizationIds(kv, userId)).filter((id) => id !== orgId);
  await kv.put(`${ORG_INDEX_PREFIX}${userId}`, JSON.stringify(ids));
  return ids;
}

export function normalizeOrganization(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const createdAt = raw.createdAt || new Date().toISOString();
  const members = Array.isArray(raw.members) ? raw.members.map((member) => ({
    userId: normalizeText(member?.userId || member?.email, 254),
    email: normalizeText(member?.email || member?.userId, 254).toLowerCase(),
    name: normalizeText(member?.name, 120),
    role: normalizeRole(member?.role),
    status: ['active', 'invited', 'suspended'].includes(member?.status) ? member.status : 'active',
    joinedAt: member?.joinedAt || createdAt,
    invitedBy: member?.invitedBy || null,
    roleChangedAt: member?.roleChangedAt || null,
    roleChangedBy: member?.roleChangedBy || null,
  })).filter((member) => member.userId && member.email) : [];
  const memberIds = new Set(members.flatMap((member) => [member.userId, member.email]));
  const workspaces = Array.isArray(raw.workspaces) ? raw.workspaces.map((workspace) => ({
    id: normalizeText(workspace?.id, 80) || generateEnterpriseId('ws'),
    name: normalizeText(workspace?.name, 120),
    description: normalizeText(workspace?.description, 500),
    type: normalizeText(workspace?.type, 40) || 'general',
    status: workspace?.status === 'archived' ? 'archived' : 'active',
    members: [...new Set((Array.isArray(workspace?.members) ? workspace.members : [])
      .map((member) => typeof member === 'object' ? (member.userId || member.email) : member)
      .map((member) => normalizeText(String(member || ''), 254))
      .filter((member) => memberIds.has(member)))],
    preferences: {
      notifications: workspace?.preferences?.notifications !== false,
      defaultView: ['overview', 'members', 'activity', 'preferences'].includes(workspace?.preferences?.defaultView)
        ? workspace.preferences.defaultView : 'overview',
    },
    activity: Array.isArray(workspace?.activity) ? workspace.activity.slice(0, 100) : [],
    protected: Boolean(workspace?.protected),
    createdAt: workspace?.createdAt || createdAt,
    updatedAt: workspace?.updatedAt || workspace?.createdAt || createdAt,
  })).filter((workspace) => workspace.name) : [];

  return {
    id: normalizeText(raw.id, 80),
    name: normalizeText(raw.name, 120),
    description: normalizeText(raw.description, 500),
    plan: normalizeText(raw.plan, 40) || 'Unassigned',
    status: ['active', 'suspended', 'archived'].includes(raw.status) ? raw.status : 'active',
    ownerId: normalizeText(raw.ownerId, 254),
    members,
    workspaces,
    settings: { allowMemberInvites: raw.settings?.allowMemberInvites !== false, requireApproval: Boolean(raw.settings?.requireApproval), maxMembers: Number(raw.settings?.maxMembers) || 100 },
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

export async function loadOrganization(kv, orgId) {
  const raw = await readJson(kv, `org:${orgId}`, null);
  return normalizeOrganization(raw);
}

export async function saveOrganization(kv, organization) {
  const normalized = normalizeOrganization(organization);
  if (!normalized?.id || !normalized.name) throw new Error('Organização inválida.');
  normalized.updatedAt = new Date().toISOString();
  await kv.put(`org:${normalized.id}`, JSON.stringify(normalized));
  return normalized;
}

export function getMembership(organization, userId) {
  const normalized = normalizeText(userId, 254).toLowerCase();
  return organization?.members?.find((member) => member.userId === userId || member.email.toLowerCase() === normalized) || null;
}

export function workspaceHasMember(workspace, userId) {
  const expected = normalizeText(userId, 254).toLowerCase();
  return Array.isArray(workspace?.members) && workspace.members.some((member) => normalizeText(String(member), 254).toLowerCase() === expected);
}

export function canAccessWorkspace(membership, workspace, userId) {
  if (!membership || membership.status !== 'active' || !workspace || workspace.status !== 'active') return false;
  if (['owner', 'admin'].includes(normalizeRole(membership.role))) return true;
  return workspaceHasMember(workspace, userId) || workspaceHasMember(workspace, membership.email);
}

export function accessibleWorkspaces(organization, membership, userId) {
  return (organization?.workspaces || []).filter((workspace) => canAccessWorkspace(membership, workspace, userId));
}

export function assertMembership(organization, userId) {
  const membership = getMembership(organization, userId);
  if (!membership || membership.status !== 'active') throw new Error('Sem acesso a esta organização.');
  return membership;
}

export function assertPermission(organization, userId, permission, customRoles = []) {
  const membership = assertMembership(organization, userId);
  if (!hasPermission(membership, permission, customRoles)) throw new Error('Sem permissão para esta operação.');
  return membership;
}

export function assertWorkspacePermission(organization, userId, workspaceId, permission, customRoles = []) {
  const membership = assertPermission(organization, userId, permission, customRoles);
  const workspace = (organization.workspaces || []).find((item) => item.id === workspaceId);
  if (!workspace || !canAccessWorkspace(membership, workspace, userId)) throw new Error('Sem acesso a este workspace.');
  return { membership, workspace };
}

export async function appendOrganizationAudit(kv, orgId, entry) {
  const key = `org:audit:${orgId}`;
  const log = await readJson(kv, key, []);
  const record = {
    id: generateEnterpriseId('audit'),
    actor: normalizeText(entry?.actor || entry?.userId, 254),
    action: normalizeText(entry?.action || entry?.type, 100),
    resourceId: normalizeText(entry?.resourceId, 120),
    detail: normalizeText(entry?.detail, 600),
    metadata: entry?.metadata && typeof entry.metadata === 'object' ? entry.metadata : undefined,
    createdAt: new Date().toISOString(),
  };
  const next = [record, ...(Array.isArray(log) ? log : [])].slice(0, 1000);
  await kv.put(key, JSON.stringify(next));
  return record;
}

export async function createOrganization(kv, actor, input = {}) {
  const name = normalizeText(input.name, 120);
  if (!name) throw new Error('Nome da organização é obrigatório.');
  const now = new Date().toISOString();
  const orgId = generateEnterpriseId('org');
  const workspaceId = generateEnterpriseId('ws');
  const organization = {
    id: orgId,
    name,
    description: normalizeText(input.description, 500),
    plan: 'Unassigned',
    ownerId: actor,
    members: [{ userId: actor, email: actor, name: normalizeText(input.ownerName, 120), role: 'owner', status: 'active', joinedAt: now, invitedBy: null }],
    workspaces: [{ id: workspaceId, name: 'Principal', description: 'Workspace inicial da organização.', type: 'general', status: 'active', members: [actor], preferences: { notifications: true, defaultView: 'overview' }, activity: [], protected: true, createdAt: now, updatedAt: now }],
    settings: { allowMemberInvites: true, requireApproval: false, maxMembers: 100 },
    createdAt: now,
    updatedAt: now,
  };
  await saveOrganization(kv, organization);
  await addUserOrganization(kv, actor, orgId);
  await appendOrganizationAudit(kv, orgId, { actor, action: 'organization.create', resourceId: orgId, detail: `Organização "${name}" criada.` });
  return organization;
}

export async function listOrganizationsForUser(kv, userId) {
  const ids = await getUserOrganizationIds(kv, userId);
  const organizations = [];
  for (const id of ids) {
    const organization = await loadOrganization(kv, id);
    const membership = getMembership(organization, userId);
    if (!organization || !membership || membership.status !== 'active') continue;
    organizations.push({
      id: organization.id,
      name: organization.name,
      description: organization.description,
      plan: organization.plan,
      role: membership.role,
      memberCount: organization.members.length,
      workspaceCount: organization.workspaces.length,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    });
  }
  return organizations;
}

export async function createOrganizationInvite(kv, { organization, inviter, email, role, workspaceId, origin }) {
  const normalizedEmail = normalizeText(email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('E-mail inválido.');
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'owner') throw new Error('Não é possível convidar como Owner.');
  const workspace = workspaceId ? (organization.workspaces || []).find((item) => item.id === workspaceId) : null;
  if (workspaceId && !workspace) throw new Error('Workspace não encontrado.');
  if (organization.members.some((member) => member.email === normalizedEmail)) throw new Error('Usuário já é membro desta organização.');
  const token = `${generateEnterpriseId('invite')}${generateEnterpriseId('token')}`.replace(/_/g, '');
  const now = new Date().toISOString();
  const invite = {
    token,
    orgId: organization.id,
    orgName: organization.name,
    workspaceId: workspace?.id || null,
    workspaceName: workspace?.name || null,
    email: normalizedEmail,
    role: normalizedRole,
    invitedBy: inviter,
    status: 'pending',
    createdAt: now,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await kv.put(`invite:${token}`, JSON.stringify(invite), { expirationTtl: 7 * 24 * 60 * 60 });
  const orgInvites = await readJson(kv, `org:invites:${organization.id}`, []);
  await kv.put(`org:invites:${organization.id}`, JSON.stringify([invite, ...(Array.isArray(orgInvites) ? orgInvites : []).filter((item) => item.email !== normalizedEmail || item.status !== 'pending')].slice(0, 500)));
  const sent = await readJson(kv, `invites:sent:${inviter}`, []);
  await kv.put(`invites:sent:${inviter}`, JSON.stringify([invite, ...(Array.isArray(sent) ? sent : [])].slice(0, 500)));
  await appendOrganizationAudit(kv, organization.id, { actor: inviter, action: 'member.invite', resourceId: token, detail: `Convite enviado para ${normalizedEmail} como ${normalizedRole}.` });
  return { ...invite, inviteUrl: `${origin}/accept-invite?token=${encodeURIComponent(token)}` };
}

export async function acceptOrganizationInvite(kv, userId, token) {
  const invite = await readJson(kv, `invite:${token}`, null);
  if (!invite || invite.status !== 'pending') throw new Error('Convite não encontrado, expirado ou já utilizado.');
  if (Date.parse(invite.expiresAt) < Date.now()) throw new Error('Convite expirado.');
  if (normalizeText(userId, 254).toLowerCase() !== normalizeText(invite.email, 254).toLowerCase()) throw new Error('Este convite não é para sua conta.');
  const organization = await loadOrganization(kv, invite.orgId);
  if (!organization) throw new Error('Organização não encontrada.');
  if (getMembership(organization, userId)) throw new Error('Você já é membro desta organização.');
  const now = new Date().toISOString();
  organization.members.push({ userId, email: invite.email, name: '', role: normalizeRole(invite.role), status: 'active', joinedAt: now, invitedBy: invite.invitedBy });
  if (invite.workspaceId) {
    const workspace = organization.workspaces.find((item) => item.id === invite.workspaceId);
    if (workspace && !workspace.members.includes(userId)) workspace.members.push(userId);
  }
  await saveOrganization(kv, organization);
  await addUserOrganization(kv, userId, organization.id);
  invite.status = 'accepted';
  invite.acceptedAt = now;
  await kv.put(`invite:${token}`, JSON.stringify(invite), { expirationTtl: 24 * 60 * 60 });
  const orgInvites = await readJson(kv, `org:invites:${organization.id}`, []);
  await kv.put(`org:invites:${organization.id}`, JSON.stringify((Array.isArray(orgInvites) ? orgInvites : []).map((item) => item.token === token ? invite : item)));
  await appendOrganizationAudit(kv, organization.id, { actor: userId, action: 'member.acceptInvite', resourceId: token, detail: `${invite.email} aceitou o convite.` });
  return { invite, organization };
}

export async function revokeOrganizationInvite(kv, requester, token) {
  const invite = await readJson(kv, `invite:${token}`, null);
  if (!invite || invite.status !== 'pending') throw new Error('Convite não encontrado ou indisponível.');
  const organization = await loadOrganization(kv, invite.orgId);
  const membership = assertPermission(organization, requester, 'members.invite');
  if (membership.role !== 'owner' && invite.invitedBy !== requester) throw new Error('Sem permissão para revogar este convite.');
  invite.status = 'revoked';
  invite.revokedAt = new Date().toISOString();
  await kv.put(`invite:${token}`, JSON.stringify(invite), { expirationTtl: 24 * 60 * 60 });
  const orgInvites = await readJson(kv, `org:invites:${organization.id}`, []);
  await kv.put(`org:invites:${organization.id}`, JSON.stringify((Array.isArray(orgInvites) ? orgInvites : []).map((item) => item.token === token ? invite : item)));
  await appendOrganizationAudit(kv, organization.id, { actor: requester, action: 'member.revokeInvite', resourceId: token, detail: `Convite para ${invite.email} revogado.` });
  return invite;
}
