import { onRequest as rbacRequest } from '../functions/api/enterprise/rbac.js';
import { onRequest as enterpriseDataRequest } from '../functions/api/enterprise-data.js';
import { onRequest as inviteRequest } from '../functions/api/enterprise/invite.js';
import { createSession } from '../functions/_auth.js';

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.has(key) ? this.values.get(key) : null; }
  async put(key, value) { this.values.set(key, String(value)); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '' } = {}) { return { keys: [...this.values.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })), list_complete: true, cursor: '' }; }
}

const secret = 'qa-enterprise-rbac-32.1';
const kv = new MemoryKV();
const env = { LIFEOS_SESSION_SECRET: secret, LIFEOS_KV: kv };
let assertions = 0;

function check(value, message) {
  assertions += 1;
  if (!value) throw new Error(`Falhou: ${message}`);
}

async function session(user) { return createSession(user, 'user', secret); }

async function invoke(handler, user, input = null, method = 'POST', query = {}) {
  const token = await session(user);
  const url = new URL('https://lifeos.test/api/test');
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== null) url.searchParams.set(key, value); });
  const request = new Request(url, {
    method,
    headers: { cookie: `lifeos_session=${token}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify(input || {}) } : {}),
  });
  const response = await handler({ request, env });
  return { status: response.status, body: await response.json() };
}

async function rbacOk(user, action, body = {}) {
  const result = await invoke(rbacRequest, user, { action, ...body });
  check(result.status >= 200 && result.status < 300 && result.body.ok, `${action} deve ser autorizado: ${result.body.error || result.status}`);
  return result.body;
}

async function rbacError(user, action, body = {}, phrase = '') {
  const result = await invoke(rbacRequest, user, { action, ...body });
  check(result.status >= 400 && !result.body.ok, `${action} deve rejeitar operação inválida`);
  if (phrase) check(String(result.body.error).includes(phrase), `${action} deve explicar a rejeição esperada`);
  return result.body;
}

async function rbacGet(user, view, orgId) {
  const result = await invoke(rbacRequest, user, null, 'GET', { view, orgId });
  check(result.status === 200 && result.body.ok, `GET ${view} deve retornar sucesso: ${result.body.error || result.status}`);
  return result.body;
}

async function dataOk(user, action = '', payload = {}, method = 'POST') {
  const result = await invoke(enterpriseDataRequest, user, method === 'GET' ? null : { action, payload }, method);
  check(result.status === 200 && result.body.ok, `enterprise-data ${action || 'GET'} deve retornar dados reais: ${result.body.error || result.status}`);
  return result.body.data;
}

async function acceptInvite(user, token) { return rbacOk(user, 'accept-invite', { token }); }

async function main() {
  const owner = 'owner@enterprise.test';
  const admin = 'admin@enterprise.test';
  const manager = 'manager@enterprise.test';
  const employee = 'employee@enterprise.test';
  const guest = 'guest@enterprise.test';
  const outsider = 'outsider@enterprise.test';

  const created = await rbacOk(owner, 'create-org', { name: 'Org Enterprise QA', description: 'Validação de RBAC e isolamento.' });
  const orgId = created.organization.id;
  const principalWorkspace = created.organization.workspaces[0].id;
  check(created.organization.members[0].role === 'owner', 'criador deve ser Owner da organização');

  const restrictedWorkspace = (await rbacOk(owner, 'create-workspace', { orgId, name: 'Workspace Restrito', type: 'security' })).workspace.id;
  const adminInvite = await rbacOk(owner, 'invite-member', { orgId, email: admin, role: 'admin', workspaceId: principalWorkspace });
  check(Boolean(adminInvite.invite.token), 'convite deve persistir token real');
  await acceptInvite(admin, adminInvite.invite.token);

  const managerInvite = await rbacOk(owner, 'invite-member', { orgId, email: manager, role: 'manager', workspaceId: principalWorkspace });
  await acceptInvite(manager, managerInvite.invite.token);
  const employeeInvite = await rbacOk(owner, 'invite-member', { orgId, email: employee, role: 'employee', workspaceId: principalWorkspace });
  await acceptInvite(employee, employeeInvite.invite.token);
  const guestInvite = await rbacOk(owner, 'invite-member', { orgId, email: guest, role: 'guest', workspaceId: principalWorkspace });
  await acceptInvite(guest, guestInvite.invite.token);

  const ownerMembers = await rbacGet(owner, 'members', orgId);
  check(ownerMembers.members.length === 5, 'membros aceitos devem ser persistidos na organização');
  const employeeMember = ownerMembers.members.find((member) => member.email === employee);
  const guestMember = ownerMembers.members.find((member) => member.email === guest);
  check(employeeMember.role === 'employee' && guestMember.role === 'guest', 'papéis Enterprise devem ser preservados');

  const employeeWorkspaces = await rbacGet(employee, 'workspaces', orgId);
  check(employeeWorkspaces.workspaces.length === 1 && employeeWorkspaces.workspaces[0].id === principalWorkspace, 'Employee não pode listar workspace não atribuído');
  const guestWorkspaces = await rbacGet(guest, 'workspaces', orgId);
  check(guestWorkspaces.workspaces.length === 1, 'Guest pode visualizar somente workspace atribuído');

  await rbacError(employee, 'create-workspace', { orgId, name: 'Tentativa Employee' }, 'Sem permissão');
  await rbacError(guest, 'invite-member', { orgId, email: 'x@enterprise.test', role: 'employee' }, 'Sem permissão');
  await rbacError(manager, 'invite-member', { orgId, email: 'admin-attempt@enterprise.test', role: 'admin', workspaceId: principalWorkspace }, 'Sem permissão');
  await rbacError(manager, 'change-role', { orgId, targetUserId: employee, newRole: 'manager' }, 'Sem permissão');
  await rbacError(outsider, 'create-workspace', { orgId, name: 'Workspace Invasão' }, 'Sem acesso');

  await rbacOk(admin, 'workspace-member-add', { orgId, workspaceId: restrictedWorkspace, targetUserId: employee });
  const employeeWorkspacesAfterAdd = await rbacGet(employee, 'workspaces', orgId);
  check(employeeWorkspacesAfterAdd.workspaces.some((workspace) => workspace.id === restrictedWorkspace), 'Admin deve conseguir conceder acesso explícito ao workspace');
  await rbacOk(admin, 'workspace-member-remove', { orgId, workspaceId: restrictedWorkspace, targetUserId: employee });
  const employeeWorkspacesAfterRemoval = await rbacGet(employee, 'workspaces', orgId);
  check(!employeeWorkspacesAfterRemoval.workspaces.some((workspace) => workspace.id === restrictedWorkspace), 'remoção de membro deve revogar acesso ao workspace imediatamente');

  await rbacOk(admin, 'change-role', { orgId, targetUserId: employee, newRole: 'manager' });
  const permissions = await rbacGet(employee, 'permissions', orgId);
  check(permissions.role === 'manager' && permissions.permissions.includes('workspaces.create'), 'alteração de cargo deve controlar permissões efetivas');
  await rbacOk(employee, 'create-workspace', { orgId, name: 'Workspace de Manager' });

  const data = await dataOk(owner, '', {}, 'GET');
  check(data.organization.id === orgId, 'shell Enterprise deve usar organização real em KV');
  check(data.members.every((member) => !member.email.endsWith('@lifeos.app')), 'shell Enterprise não pode expor membros fictícios de seed');
  check(data.workspaces.every((workspace) => workspace.id !== 'ws_001'), 'shell Enterprise não pode expor workspaces fictícios de seed');
  check(data.roles.map((role) => role.id).join(',') === 'owner,admin,manager,employee,guest', 'shell Enterprise deve expor apenas os cinco papéis Enterprise');
  const facadeData = await dataOk(owner, 'workspace.create', { orgId, name: 'Workspace por Fachada', type: 'general', description: 'Histórico real da fachada.' });
  const facadeWorkspace = facadeData.workspaces.find((workspace) => workspace.name === 'Workspace por Fachada');
  check(Boolean(facadeWorkspace), 'fachada Enterprise deve criar workspace real');
  check(facadeWorkspace.activity?.[0]?.action === 'workspace.create', 'criação pela fachada deve registrar atividade persistida');
  const updatedFacadeData = await dataOk(owner, 'workspace.update', { orgId, id: facadeWorkspace.id, description: 'Descrição persistida atualizada.' });
  const updatedFacadeWorkspace = updatedFacadeData.workspaces.find((workspace) => workspace.id === facadeWorkspace.id);
  check(updatedFacadeWorkspace.activity?.[0]?.action === 'workspace.update', 'edição pela fachada deve registrar atividade persistida');

  const secondOrg = await rbacOk(owner, 'create-org', { name: 'Outra Organização QA' });
  const secondOrgId = secondOrg.organization.id;
  await rbacError(employee, 'create-workspace', { orgId: secondOrgId, name: 'Tentativa Cross-Org' }, 'Sem acesso');

  const legacyTarget = 'legacy-invite@enterprise.test';
  const legacyInviteResult = await invoke(inviteRequest, owner, { action: 'send', orgId, email: legacyTarget, role: 'guest', workspaceId: principalWorkspace });
  check(legacyInviteResult.status === 201 && legacyInviteResult.body.ok, 'rota publicada deve criar convite no modelo Enterprise real');
  check(legacyInviteResult.body.invite.orgId === orgId && legacyInviteResult.body.invite.role === 'guest', 'convite publicado deve manter organização e cargo reais');
  const legacyView = await invoke(inviteRequest, legacyTarget, null, 'GET', { token: legacyInviteResult.body.invite.token });
  check(legacyView.status === 200 && legacyView.body.invite.email === legacyTarget, 'destinatário deve poder consultar seu convite publicado');
  const legacyAccept = await invoke(inviteRequest, legacyTarget, { action: 'accept', token: legacyInviteResult.body.invite.token });
  check(legacyAccept.status === 200 && legacyAccept.body.ok, 'aceite publicado deve concluir convite');
  const legacyMembership = await rbacGet(legacyTarget, 'workspaces', orgId);
  check(legacyMembership.workspaces.some((workspace) => workspace.id === principalWorkspace), 'aceite publicado deve conceder somente o workspace convidado');
  const legacyEscalation = await invoke(inviteRequest, manager, { action: 'send', orgId, email: 'escalation@enterprise.test', role: 'admin', workspaceId: principalWorkspace });
  check(legacyEscalation.status === 403 && !legacyEscalation.body.ok, 'rota publicada deve bloquear escalonamento de privilégio por convite');

  const secondInvite = await rbacOk(owner, 'invite-member', { orgId, email: 'pending@enterprise.test', role: 'guest' });
  const pending = await rbacGet(owner, 'invites', orgId);
  check(pending.invites.some((invite) => invite.token === secondInvite.invite.token && invite.status === 'pending'), 'convite pendente deve permanecer auditável');
  await rbacOk(owner, 'revoke-invite', { token: secondInvite.invite.token });
  const revoked = await rbacGet(owner, 'invites', orgId);
  check(revoked.invites.some((invite) => invite.token === secondInvite.invite.token && invite.status === 'revoked'), 'revogação deve ser persistida na lista de convites');

  await rbacOk(admin, 'remove-member', { orgId, targetUserId: guestMember.userId });
  const deniedAfterRemoval = await invoke(rbacRequest, guest, null, 'GET', { view: 'workspaces', orgId });
  check(deniedAfterRemoval.status === 403, 'membro removido não pode acessar recursos do workspace anterior');

  const audit = await rbacGet(owner, 'audit', orgId);
  check(audit.audit.length >= 12, 'operações administrativas devem produzir histórico de auditoria persistido');

  console.log(`QA Enterprise RBAC concluído: ${assertions} asserções aprovadas.`);
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
