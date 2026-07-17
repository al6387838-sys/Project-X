// LifeOS Enterprise — Enterprise RBAC & Organizations API v2.0
// Cloudflare Pages Function: GET/POST /api/enterprise/rbac
// Phase 227 — Enterprise Organizations
// Múltiplas empresas · Múltiplos workspaces · Múltiplos admins
// RBAC completo · Convites · Remoção · Auditoria · Permissões granulares
import { getCookie, json, verifySession } from '../../_auth.js';

// ─── Definição de permissões granulares ──────────────────────────────────────
const PERMISSIONS = {
  // Organização
  'org:read':    'Visualizar organização',
  'org:update':  'Editar organização',
  'org:delete':  'Excluir organização',
  'org:billing': 'Gerenciar cobrança',
  // Membros
  'members:read':   'Visualizar membros',
  'members:invite': 'Convidar membros',
  'members:remove': 'Remover membros',
  'members:roles':  'Alterar papéis',
  // Workspaces
  'workspaces:read':   'Visualizar workspaces',
  'workspaces:create': 'Criar workspaces',
  'workspaces:update': 'Editar workspaces',
  'workspaces:delete': 'Excluir workspaces',
  // Dados
  'data:read':   'Visualizar dados',
  'data:write':  'Criar/editar dados',
  'data:delete': 'Excluir dados',
  'data:export': 'Exportar dados',
  // Integrações
  'integrations:read':   'Visualizar integrações',
  'integrations:manage': 'Gerenciar integrações',
  // Admin
  'admin:audit':    'Visualizar auditoria',
  'admin:settings': 'Configurações avançadas',
  'admin:security': 'Configurações de segurança',
};

// ─── Papéis e suas permissões ─────────────────────────────────────────────────
const ROLES = {
  owner: {
    name: 'Proprietário',
    description: 'Acesso total à organização',
    permissions: Object.keys(PERMISSIONS),
    immutable: true,
  },
  admin: {
    name: 'Administrador',
    description: 'Gerencia membros, workspaces e integrações',
    permissions: ['org:read','org:update','members:read','members:invite','members:remove','members:roles','workspaces:read','workspaces:create','workspaces:update','workspaces:delete','data:read','data:write','data:delete','data:export','integrations:read','integrations:manage','admin:audit','admin:settings'],
  },
  manager: {
    name: 'Gerente',
    description: 'Gerencia workspaces e dados',
    permissions: ['org:read','members:read','members:invite','workspaces:read','workspaces:create','workspaces:update','data:read','data:write','data:delete','data:export','integrations:read','admin:audit'],
  },
  member: {
    name: 'Membro',
    description: 'Acesso padrão de trabalho',
    permissions: ['org:read','members:read','workspaces:read','data:read','data:write','integrations:read'],
  },
  viewer: {
    name: 'Visualizador',
    description: 'Apenas leitura',
    permissions: ['org:read','members:read','workspaces:read','data:read'],
  },
};

function genId() { return crypto.randomUUID().replace(/-/g,'').slice(0,16); }

function hasPermission(member, permission) {
  const role = ROLES[member?.role];
  if (!role) return false;
  return role.permissions.includes(permission);
}

async function appendAudit(kv, orgId, entry) {
  try {
    const raw = await kv.get(`org:audit:${orgId}`);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({ id: genId(), ...entry, timestamp: new Date().toISOString() });
    await kv.put(`org:audit:${orgId}`, JSON.stringify(log.slice(0, 1000)));
  } catch { /* ignorar */ }
}

async function getOrgMember(kv, orgId, userId) {
  const raw = await kv.get(`org:${orgId}`);
  if (!raw) return null;
  const org = JSON.parse(raw);
  return org.members?.find(m => m.userId === userId) || null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'organizations';
  const orgId = url.searchParams.get('orgId');

  if (view === 'roles') {
    return json(200, { ok: true, roles: ROLES, permissions: PERMISSIONS });
  }

  if (view === 'organizations') {
    // Listar todas as organizações do usuário
    const raw = await kv.get(`user:orgs:${session.sub}`);
    const orgIds = raw ? JSON.parse(raw) : [];
    const orgs = [];
    for (const id of orgIds) {
      try {
        const orgRaw = await kv.get(`org:${id}`);
        if (orgRaw) {
          const org = JSON.parse(orgRaw);
          const member = org.members?.find(m => m.userId === session.sub);
          orgs.push({
            id: org.id, name: org.name, description: org.description, plan: org.plan,
            memberCount: org.members?.length || 0, workspaceCount: org.workspaces?.length || 0,
            role: member?.role || 'member', createdAt: org.createdAt, updatedAt: org.updatedAt,
          });
        }
      } catch { /* ignorar */ }
    }
    return json(200, { ok: true, organizations: orgs });
  }

  if (view === 'workspaces' && orgId) {
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const member = org.members?.find(m => m.userId === session.sub);
    if (!member) return json(403, { ok: false, error: 'Sem acesso a esta organização' });
    return json(200, { ok: true, workspaces: org.workspaces || [], orgId });
  }

  if (view === 'members' && orgId) {
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const member = org.members?.find(m => m.userId === session.sub);
    if (!member || !hasPermission(member, 'members:read')) return json(403, { ok: false, error: 'Sem permissão' });
    return json(200, { ok: true, members: org.members || [], orgId });
  }

  if (view === 'audit' && orgId) {
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const member = org.members?.find(m => m.userId === session.sub);
    if (!member || !hasPermission(member, 'admin:audit')) return json(403, { ok: false, error: 'Sem permissão' });
    const auditRaw = await kv.get(`org:audit:${orgId}`);
    return json(200, { ok: true, audit: auditRaw ? JSON.parse(auditRaw) : [], orgId });
  }

  if (view === 'permissions' && orgId) {
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const member = org.members?.find(m => m.userId === session.sub);
    if (!member) return json(403, { ok: false, error: 'Sem acesso' });
    const role = ROLES[member.role];
    return json(200, { ok: true, role: member.role, permissions: role?.permissions || [], allPermissions: PERMISSIONS });
  }

  return json(400, { ok: false, error: 'view inválida. Use: organizations, workspaces, members, audit, roles, permissions' });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  const { action } = body;

  // ── Criar organização ────────────────────────────────────────────────────
  if (action === 'create-org') {
    const { name, description, plan = 'free' } = body;
    if (!name) return json(400, { ok: false, error: 'name é obrigatório' });
    const orgId = genId();
    const org = {
      id: orgId, name, description: description || '', plan,
      ownerId: session.sub,
      members: [{ userId: session.sub, email: session.sub, role: 'owner', joinedAt: new Date().toISOString(), invitedBy: null }],
      workspaces: [{ id: genId(), name: 'Principal', description: 'Workspace padrão', createdAt: new Date().toISOString(), createdBy: session.sub }],
      settings: { allowMemberInvites: true, requireApproval: false, maxMembers: 100 },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await kv.put(`org:${orgId}`, JSON.stringify(org));
    // Adicionar org à lista do usuário
    const userOrgsRaw = await kv.get(`user:orgs:${session.sub}`);
    const userOrgs = userOrgsRaw ? JSON.parse(userOrgsRaw) : [];
    userOrgs.push(orgId);
    await kv.put(`user:orgs:${session.sub}`, JSON.stringify(userOrgs));
    await appendAudit(kv, orgId, { type: 'org_created', userId: session.sub, orgName: name });
    return json(201, { ok: true, organization: org });
  }

  // ── Atualizar organização ────────────────────────────────────────────────
  if (action === 'update-org') {
    const { orgId, name, description, settings } = body;
    if (!orgId) return json(400, { ok: false, error: 'orgId é obrigatório' });
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const member = org.members?.find(m => m.userId === session.sub);
    if (!member || !hasPermission(member, 'org:update')) return json(403, { ok: false, error: 'Sem permissão' });
    if (name) org.name = name;
    if (description !== undefined) org.description = description;
    if (settings) org.settings = { ...org.settings, ...settings };
    org.updatedAt = new Date().toISOString();
    await kv.put(`org:${orgId}`, JSON.stringify(org));
    await appendAudit(kv, orgId, { type: 'org_updated', userId: session.sub, changes: { name, description, settings } });
    return json(200, { ok: true, organization: org });
  }

  // ── Criar workspace ──────────────────────────────────────────────────────
  if (action === 'create-workspace') {
    const { orgId, name, description } = body;
    if (!orgId || !name) return json(400, { ok: false, error: 'orgId e name são obrigatórios' });
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const member = org.members?.find(m => m.userId === session.sub);
    if (!member || !hasPermission(member, 'workspaces:create')) return json(403, { ok: false, error: 'Sem permissão' });
    const workspace = { id: genId(), name, description: description || '', createdAt: new Date().toISOString(), createdBy: session.sub };
    org.workspaces = [...(org.workspaces || []), workspace];
    org.updatedAt = new Date().toISOString();
    await kv.put(`org:${orgId}`, JSON.stringify(org));
    await appendAudit(kv, orgId, { type: 'workspace_created', userId: session.sub, workspaceName: name });
    return json(201, { ok: true, workspace });
  }

  // ── Convidar membro ──────────────────────────────────────────────────────
  if (action === 'invite-member') {
    const { orgId, email, role = 'member' } = body;
    if (!orgId || !email) return json(400, { ok: false, error: 'orgId e email são obrigatórios' });
    if (!ROLES[role]) return json(400, { ok: false, error: 'Papel inválido' });
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const inviter = org.members?.find(m => m.userId === session.sub);
    if (!inviter || !hasPermission(inviter, 'members:invite')) return json(403, { ok: false, error: 'Sem permissão para convidar' });
    if (role === 'owner') return json(403, { ok: false, error: 'Não é possível convidar como proprietário' });
    const alreadyMember = org.members?.some(m => m.email === email);
    if (alreadyMember) return json(400, { ok: false, error: 'Usuário já é membro desta organização' });
    // Criar token de convite
    const token = genId() + genId();
    const invite = { token, orgId, orgName: org.name, email, role, invitedBy: session.sub, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() };
    await kv.put(`invite:${token}`, JSON.stringify(invite), { expirationTtl: 7 * 24 * 3600 });
    await appendAudit(kv, orgId, { type: 'member_invited', userId: session.sub, invitedEmail: email, role });
    return json(200, { ok: true, inviteToken: token, inviteUrl: `${new URL(request.url).origin}/accept-invite?token=${token}`, expiresAt: invite.expiresAt });
  }

  // ── Aceitar convite ──────────────────────────────────────────────────────
  if (action === 'accept-invite') {
    const { token } = body;
    if (!token) return json(400, { ok: false, error: 'token é obrigatório' });
    const inviteRaw = await kv.get(`invite:${token}`);
    if (!inviteRaw) return json(404, { ok: false, error: 'Convite inválido ou expirado' });
    const invite = JSON.parse(inviteRaw);
    if (new Date(invite.expiresAt) < new Date()) return json(400, { ok: false, error: 'Convite expirado' });
    const orgRaw = await kv.get(`org:${invite.orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const alreadyMember = org.members?.some(m => m.userId === session.sub || m.email === invite.email);
    if (alreadyMember) return json(400, { ok: false, error: 'Já é membro desta organização' });
    org.members = [...(org.members || []), { userId: session.sub, email: invite.email, role: invite.role, joinedAt: new Date().toISOString(), invitedBy: invite.invitedBy }];
    org.updatedAt = new Date().toISOString();
    await kv.put(`org:${invite.orgId}`, JSON.stringify(org));
    await kv.delete(`invite:${token}`);
    const userOrgsRaw = await kv.get(`user:orgs:${session.sub}`);
    const userOrgs = userOrgsRaw ? JSON.parse(userOrgsRaw) : [];
    if (!userOrgs.includes(invite.orgId)) { userOrgs.push(invite.orgId); await kv.put(`user:orgs:${session.sub}`, JSON.stringify(userOrgs)); }
    await appendAudit(kv, invite.orgId, { type: 'member_joined', userId: session.sub, email: invite.email, role: invite.role });
    return json(200, { ok: true, organization: { id: org.id, name: org.name }, role: invite.role });
  }

  // ── Alterar papel de membro ──────────────────────────────────────────────
  if (action === 'change-role') {
    const { orgId, targetUserId, newRole } = body;
    if (!orgId || !targetUserId || !newRole) return json(400, { ok: false, error: 'orgId, targetUserId e newRole são obrigatórios' });
    if (!ROLES[newRole]) return json(400, { ok: false, error: 'Papel inválido' });
    if (newRole === 'owner') return json(403, { ok: false, error: 'Não é possível atribuir papel de proprietário' });
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const requester = org.members?.find(m => m.userId === session.sub);
    if (!requester || !hasPermission(requester, 'members:roles')) return json(403, { ok: false, error: 'Sem permissão' });
    const target = org.members?.find(m => m.userId === targetUserId);
    if (!target) return json(404, { ok: false, error: 'Membro não encontrado' });
    if (target.role === 'owner') return json(403, { ok: false, error: 'Não é possível alterar o papel do proprietário' });
    const oldRole = target.role;
    target.role = newRole;
    target.roleChangedAt = new Date().toISOString();
    target.roleChangedBy = session.sub;
    org.updatedAt = new Date().toISOString();
    await kv.put(`org:${orgId}`, JSON.stringify(org));
    await appendAudit(kv, orgId, { type: 'role_changed', userId: session.sub, targetUserId, oldRole, newRole });
    return json(200, { ok: true, member: target });
  }

  // ── Remover membro ───────────────────────────────────────────────────────
  if (action === 'remove-member') {
    const { orgId, targetUserId } = body;
    if (!orgId || !targetUserId) return json(400, { ok: false, error: 'orgId e targetUserId são obrigatórios' });
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    const requester = org.members?.find(m => m.userId === session.sub);
    if (!requester || !hasPermission(requester, 'members:remove')) return json(403, { ok: false, error: 'Sem permissão' });
    const target = org.members?.find(m => m.userId === targetUserId);
    if (!target) return json(404, { ok: false, error: 'Membro não encontrado' });
    if (target.role === 'owner') return json(403, { ok: false, error: 'Não é possível remover o proprietário' });
    org.members = org.members.filter(m => m.userId !== targetUserId);
    org.updatedAt = new Date().toISOString();
    await kv.put(`org:${orgId}`, JSON.stringify(org));
    // Remover org da lista do usuário removido
    const removedUserOrgsRaw = await kv.get(`user:orgs:${targetUserId}`);
    if (removedUserOrgsRaw) {
      const removedUserOrgs = JSON.parse(removedUserOrgsRaw).filter(id => id !== orgId);
      await kv.put(`user:orgs:${targetUserId}`, JSON.stringify(removedUserOrgs));
    }
    await appendAudit(kv, orgId, { type: 'member_removed', userId: session.sub, removedUserId: targetUserId });
    return json(200, { ok: true, removed: targetUserId });
  }

  // ── Excluir organização ──────────────────────────────────────────────────
  if (action === 'delete-org') {
    const { orgId } = body;
    if (!orgId) return json(400, { ok: false, error: 'orgId é obrigatório' });
    const orgRaw = await kv.get(`org:${orgId}`);
    if (!orgRaw) return json(404, { ok: false, error: 'Organização não encontrada' });
    const org = JSON.parse(orgRaw);
    if (org.ownerId !== session.sub) return json(403, { ok: false, error: 'Apenas o proprietário pode excluir a organização' });
    // Remover org de todos os membros
    for (const member of (org.members || [])) {
      try {
        const userOrgsRaw = await kv.get(`user:orgs:${member.userId}`);
        if (userOrgsRaw) {
          const userOrgs = JSON.parse(userOrgsRaw).filter(id => id !== orgId);
          await kv.put(`user:orgs:${member.userId}`, JSON.stringify(userOrgs));
        }
      } catch { /* ignorar */ }
    }
    await kv.delete(`org:${orgId}`);
    await appendAudit(kv, orgId, { type: 'org_deleted', userId: session.sub, orgName: org.name });
    return json(200, { ok: true, deleted: orgId });
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: create-org, update-org, create-workspace, invite-member, accept-invite, change-role, remove-member, delete-org' });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
