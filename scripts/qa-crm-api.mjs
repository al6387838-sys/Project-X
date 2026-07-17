import { onRequest as crmRequest } from '../functions/api/crm.js';
import { createSession } from '../functions/_auth.js';

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.has(key) ? this.values.get(key) : null; }
  async put(key, value) { this.values.set(key, String(value)); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '', cursor } = {}) {
    const keys = [...this.values.keys()].filter((name) => name.startsWith(prefix)).sort().map((name) => ({ name }));
    return { keys, list_complete: true, cursor: cursor || '' };
  }
}

const secret = 'qa-crm-secret-32.1';
const kv = new MemoryKV();
const env = { LIFEOS_SESSION_SECRET: secret, LIFEOS_KV: kv };
let assertions = 0;

function check(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`Falhou: ${message}`);
}

async function call(user, body, method = 'POST') {
  const token = await createSession(user, 'user', secret);
  const request = new Request(`https://lifeos.test/api/crm${method === 'GET' && body ? `?${new URLSearchParams(body)}` : ''}`, {
    method,
    headers: { cookie: `lifeos_session=${token}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
  const response = await crmRequest({ request, env });
  return { status: response.status, body: await response.json() };
}

async function expectOk(user, action, payload) {
  const result = await call(user, { action, payload });
  check(result.status === 200 && result.body.ok, `${action} deve retornar sucesso: ${result.body.error || result.status}`);
  return result.body.data;
}

async function expectError(user, action, payload, expectedText) {
  const result = await call(user, { action, payload });
  check(result.status >= 400 && !result.body.ok, `${action} deve falhar para acesso inválido`);
  check(!expectedText || String(result.body.error).includes(expectedText), `${action} deve informar erro esperado`);
  return result.body;
}

async function main() {
  const owner = 'owner@lifeos.test';
  const employee = 'employee@lifeos.test';
  const guest = 'guest@lifeos.test';
  const intruder = 'intruder@lifeos.test';

  const initial = await call(owner, null, 'GET');
  check(initial.status === 200 && initial.body.ok, 'GET inicial deve retornar estrutura CRM válida');
  check(initial.body.data.organization === null, 'CRM vazio não deve fabricar organização');

  const created = await expectOk(owner, 'organization.create', { name: 'Organização QA', description: 'Organização persistida para testes.' });
  const orgId = created.organization.id;
  const workspaceId = created.workspace.id;
  check(orgId && workspaceId, 'criação deve retornar organização e workspace reais');

  const base = { orgId, workspaceId };
  let crm = await expectOk(owner, 'contact.create', {
    ...base,
    name: 'Cliente QA',
    email: 'cliente@qa.test',
    company: 'Empresa QA',
    status: 'lead',
    value: 1500.75,
    tags: ['enterprise', 'prioridade'],
  });
  const contactId = crm.contacts[0].id;
  check(crm.contacts.length === 1 && crm.contacts[0].tags.includes('enterprise'), 'cliente deve ser persistido com etiquetas');

  crm = await expectOk(owner, 'contact.update', { ...base, id: contactId, status: 'prospect', notes: 'Primeira reunião realizada.', lastContactAt: '2026-07-17' });
  const updatedContact = crm.contacts.find((contact) => contact.id === contactId);
  check(updatedContact.status === 'prospect' && updatedContact.notes.includes('reunião'), 'edição de cliente deve persistir os campos comerciais');

  crm = await expectOk(owner, 'deal.create', {
    ...base,
    title: 'Contrato Enterprise QA',
    contactId,
    company: 'Empresa QA',
    stage: 'lead',
    value: 9000,
    responsibleId: owner,
    expectedDate: '2026-08-15',
  });
  const dealId = crm.deals[0].id;
  check(crm.deals[0].stage === 'lead' && crm.deals[0].probability === 20, 'nova oportunidade deve usar probabilidade do estágio');

  crm = await expectOk(owner, 'deal.move', { ...base, id: dealId, stage: 'proposal' });
  const movedDeal = crm.deals.find((deal) => deal.id === dealId);
  check(movedDeal.stage === 'proposal' && movedDeal.probability === 60, 'movimento de Kanban deve atualizar estágio e probabilidade');
  check(crm.history.some((entry) => entry.type === 'deal.stageChanged'), 'movimento de pipeline deve gerar histórico persistente');

  crm = await expectOk(owner, 'agenda.create', {
    ...base,
    title: 'Follow-up Cliente QA',
    type: 'followup',
    date: '2026-07-20',
    contactId,
    dealId,
    responsibleId: owner,
    reminderAt: '2026-07-20 09:00',
  });
  const followupId = crm.agenda.find((item) => item.title === 'Follow-up Cliente QA').id;
  const storedTasks = JSON.parse(await kv.get(`tasks:${owner}`));
  check(storedTasks.some((task) => task.crmAgendaId === followupId), 'follow-up deve sincronizar tarefa pessoal do responsável');

  crm = await expectOk(owner, 'agenda.update', { ...base, id: followupId, status: 'completed' });
  const completedTask = JSON.parse(await kv.get(`tasks:${owner}`)).find((task) => task.crmAgendaId === followupId);
  check(completedTask.status === 'done', 'conclusão de follow-up deve sincronizar status da tarefa');

  crm = await expectOk(owner, 'agenda.create', {
    ...base,
    title: 'Reunião de proposta QA',
    type: 'meeting',
    date: '2026-07-22',
    time: '14:30',
    contactId,
    dealId,
    responsibleId: owner,
    location: 'Videoconferência',
  });
  const meeting = crm.agenda.find((item) => item.title === 'Reunião de proposta QA');
  const storedEvents = JSON.parse(await kv.get(`events:${owner}`));
  check(storedEvents.some((event) => event.crmAgendaId === meeting.id), 'reunião deve sincronizar evento pessoal do responsável');

  await expectOk(owner, 'agenda.delete', { ...base, id: followupId });
  const remainingTasks = JSON.parse(await kv.get(`tasks:${owner}`));
  check(!remainingTasks.some((task) => task.crmAgendaId === followupId), 'exclusão de agenda deve remover sincronização da tarefa');

  const organization = JSON.parse(await kv.get(`org:${orgId}`));
  organization.members.push(
    { userId: employee, email: employee, name: 'Employee QA', role: 'employee', status: 'active', joinedAt: new Date().toISOString() },
    { userId: guest, email: guest, name: 'Guest QA', role: 'guest', status: 'active', joinedAt: new Date().toISOString() },
  );
  organization.workspaces[0].members.push(employee, guest);
  await kv.put(`org:${orgId}`, JSON.stringify(organization));
  await kv.put(`user:orgs:${employee}`, JSON.stringify([orgId]));
  await kv.put(`user:orgs:${guest}`, JSON.stringify([orgId]));

  const employeeCrm = await expectOk(employee, 'contact.create', { ...base, name: 'Cliente Employee', email: 'employee-client@qa.test', status: 'lead' });
  const employeeContact = employeeCrm.contacts.find((contact) => contact.email === 'employee-client@qa.test');
  check(Boolean(employeeContact), 'Employee autorizado deve criar cliente no workspace membro');

  await expectError(guest, 'contact.create', { ...base, name: 'Tentativa Guest', email: 'guest-client@qa.test' }, 'Sem permissão');
  await expectError(employee, 'contact.delete', { ...base, id: employeeContact.id }, 'Sem permissão');
  await expectError(intruder, 'contact.create', { ...base, name: 'Intruso', email: 'intruder@qa.test' }, 'Sem acesso');

  const secondWorkspace = await expectOk(owner, 'workspace.create', { orgId, name: 'Isolado QA', type: 'operations', description: 'Workspace isolado para teste.' });
  const isolatedWorkspaceId = secondWorkspace.workspace.id;
  const organizationAfterCrmWorkspace = JSON.parse(await kv.get(`org:${orgId}`));
  const persistedCrmWorkspace = organizationAfterCrmWorkspace.workspaces.find((workspace) => workspace.id === isolatedWorkspaceId);
  check(persistedCrmWorkspace?.activity?.[0]?.action === 'workspace.create', 'workspace criado pelo CRM deve registrar atividade inicial persistida');
  const isolatedBase = { orgId, workspaceId: isolatedWorkspaceId };
  await expectOk(owner, 'contact.create', { ...isolatedBase, name: 'Cliente Isolado', email: 'isolado@qa.test' });
  await expectError(employee, 'contact.create', { ...isolatedBase, name: 'Tentativa Workspace Isolado', email: 'isolated-access@qa.test' }, 'Sem acesso');
  const isolatedRead = await call(employee, isolatedBase, 'GET');
  check(isolatedRead.status === 403 && !isolatedRead.body.ok, 'membro sem vínculo não pode ler dados de outro workspace da mesma organização');
  const secondOrganization = await expectOk(owner, 'organization.create', { name: 'Organização Cruzada QA' });
  const crossOrganizationRead = await call(employee, { orgId: secondOrganization.organization.id, workspaceId: secondOrganization.workspace.id }, 'GET');
  check(crossOrganizationRead.status === 403 && !crossOrganizationRead.body.ok, 'membro não pode ler dados de outra organização');
  await expectError(employee, 'contact.create', { orgId: secondOrganization.organization.id, workspaceId: secondOrganization.workspace.id, name: 'Tentativa Cross-Org', email: 'cross-org@qa.test' }, 'Sem acesso');

  const reloaded = await call(owner, base, 'GET');
  check(reloaded.status === 200 && reloaded.body.ok, 'GET persistido deve retornar sucesso');
  check(reloaded.body.data.contacts.some((contact) => contact.id === contactId), 'cliente deve permanecer salvo após nova leitura');
  check(reloaded.body.data.deals.some((deal) => deal.id === dealId && deal.stage === 'proposal'), 'pipeline deve permanecer salvo após nova leitura');
  check(reloaded.body.data.history.length >= 6, 'histórico de CRM deve permanecer salvo após nova leitura');

  await expectOk(owner, 'contact.delete', { ...base, id: contactId });
  const finalState = await call(owner, base, 'GET');
  const retainedDeal = finalState.body.data.deals.find((deal) => deal.id === dealId);
  check(retainedDeal.contactId === null, 'exclusão de cliente deve desvincular oportunidade sem corromper o pipeline');

  console.log(`QA CRM API concluído: ${assertions} asserções aprovadas.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
