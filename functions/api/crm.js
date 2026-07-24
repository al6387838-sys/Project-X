// LifeOS Enterprise — CRM API
// Cloudflare Pages Function: /api/crm
// Clientes, pipeline, agenda comercial e histórico persistidos por organização/workspace.

import { getCookie, json, verifySession } from '../_auth.js';
import {
  accessibleWorkspaces,
  appendOrganizationAudit,
  assertPermission,
  assertWorkspacePermission,
  createOrganization,
  generateEnterpriseId,
  getMembership,
  listOrganizationsForUser,
  loadOrganization,
  normalizeText,
  readJson,
  saveOrganization,
} from '../_enterprise.js';

const STAGES = [
  { id: 'lead', name: 'Lead', probability: 20, color: '#6366F1' },
  { id: 'contact', name: 'Contato', probability: 40, color: '#F59E0B' },
  { id: 'proposal', name: 'Proposta', probability: 60, color: '#06B6D4' },
  { id: 'negotiation', name: 'Negociação', probability: 80, color: '#8B5CF6' },
  { id: 'won', name: 'Fechado ganho', probability: 100, color: '#10B981' },
  { id: 'lost', name: 'Fechado perdido', probability: 0, color: '#EF4444' },
];

const CONTACT_STATUSES = ['lead', 'prospect', 'customer', 'inactive'];
const AGENDA_TYPES = ['meeting', 'task', 'followup', 'reminder'];
const AGENDA_STATUSES = ['scheduled', 'completed', 'cancelled'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function now() {
  return new Date().toISOString();
}

function namespace(orgId, workspaceId) {
  const suffix = `${orgId}:${workspaceId}`;
  return {
    contacts: `crm:contacts:${suffix}`,
    deals: `crm:deals:${suffix}`,
    agenda: `crm:agenda:${suffix}`,
    history: `crm:history:${suffix}`,
  };
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeText(String(item), 40)).filter(Boolean))].slice(0, 16);
}

function normalizeMoney(value) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > 1000000000) return 0;
  return Math.round(number * 100) / 100;
}

function normalizeProbability(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function normalizeDate(value) {
  const text = normalizeText(value, 10);
  return DATE_PATTERN.test(text) ? text : null;
}

function normalizeTime(value) {
  const text = normalizeText(value, 5);
  return TIME_PATTERN.test(text) ? text : null;
}

function stageById(id) {
  return STAGES.find((stage) => stage.id === id) || null;
}

function actorLabel(session) {
  return normalizeText(session.sub, 254) || 'system';
}

function contactKey(contact) {
  return `${normalizeText(contact?.name, 120)} ${normalizeText(contact?.email, 254)} ${normalizeText(contact?.company, 160)}`.toLowerCase();
}

function cleanContact(input, actor, existing = null) {
  const name = normalizeText(input.name ?? existing?.name, 120);
  if (!name) throw new Error('Nome do cliente é obrigatório.');
  const email = normalizeText(input.email ?? existing?.email, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail do cliente inválido.');
  const status = normalizeText(input.status ?? existing?.status, 30).toLowerCase() || 'lead';
  if (!CONTACT_STATUSES.includes(status)) throw new Error('Status de cliente inválido.');
  const timestamp = now();
  return {
    id: existing?.id || generateEnterpriseId('contact'),
    name,
    email,
    phone: normalizeText(input.phone ?? existing?.phone, 40),
    company: normalizeText(input.company ?? existing?.company, 160),
    position: normalizeText(input.position ?? existing?.position, 100),
    status,
    tags: input.tags !== undefined ? normalizeTags(input.tags) : (existing?.tags || []),
    value: input.value !== undefined ? normalizeMoney(input.value) : normalizeMoney(existing?.value),
    notes: normalizeText(input.notes ?? existing?.notes, 3000),
    ownerId: normalizeText(input.ownerId ?? existing?.ownerId, 254) || actor,
    lastContactAt: input.lastContactAt !== undefined ? (normalizeDate(input.lastContactAt) || null) : (existing?.lastContactAt || null),
    createdAt: existing?.createdAt || timestamp,
    createdBy: existing?.createdBy || actor,
    updatedAt: timestamp,
    updatedBy: actor,
  };
}

function cleanDeal(input, actor, existing = null) {
  const title = normalizeText(input.title ?? existing?.title, 160);
  if (!title) throw new Error('Título da oportunidade é obrigatório.');
  const stage = normalizeText(input.stage ?? existing?.stage, 30).toLowerCase() || 'lead';
  const stageDefinition = stageById(stage);
  if (!stageDefinition) throw new Error('Estágio do pipeline inválido.');
  const timestamp = now();
  return {
    id: existing?.id || generateEnterpriseId('deal'),
    title,
    contactId: input.contactId !== undefined ? (normalizeText(input.contactId, 80) || null) : (existing?.contactId || null),
    company: normalizeText(input.company ?? existing?.company, 160),
    stage,
    probability: input.probability !== undefined && input.probability !== ''
      ? normalizeProbability(input.probability, stageDefinition.probability)
      : (existing && input.stage !== undefined && stage !== existing.stage ? stageDefinition.probability : (existing?.probability ?? stageDefinition.probability)),
    value: input.value !== undefined ? normalizeMoney(input.value) : normalizeMoney(existing?.value),
    responsibleId: normalizeText(input.responsibleId ?? existing?.responsibleId, 254) || actor,
    expectedDate: input.expectedDate !== undefined ? (normalizeDate(input.expectedDate) || null) : (existing?.expectedDate || null),
    description: normalizeText(input.description ?? existing?.description, 3000),
    tags: input.tags !== undefined ? normalizeTags(input.tags) : (existing?.tags || []),
    createdAt: existing?.createdAt || timestamp,
    createdBy: existing?.createdBy || actor,
    updatedAt: timestamp,
    updatedBy: actor,
    wonAt: stage === 'won' ? (existing?.wonAt || timestamp) : null,
    lostAt: stage === 'lost' ? (existing?.lostAt || timestamp) : null,
  };
}

function cleanAgendaItem(input, actor, existing = null) {
  const title = normalizeText(input.title ?? existing?.title, 160);
  if (!title) throw new Error('Título do compromisso é obrigatório.');
  const type = normalizeText(input.type ?? existing?.type, 30).toLowerCase() || 'task';
  if (!AGENDA_TYPES.includes(type)) throw new Error('Tipo de compromisso inválido.');
  const date = normalizeDate(input.date ?? existing?.date);
  if (!date) throw new Error('Data do compromisso é obrigatória.');
  const status = normalizeText(input.status ?? existing?.status, 30).toLowerCase() || 'scheduled';
  if (!AGENDA_STATUSES.includes(status)) throw new Error('Status de compromisso inválido.');
  const timestamp = now();
  return {
    id: existing?.id || generateEnterpriseId('agenda'),
    title,
    type,
    status,
    date,
    time: input.time !== undefined ? normalizeTime(input.time) : (existing?.time || null),
    duration: normalizeText(input.duration ?? existing?.duration, 40),
    description: normalizeText(input.description ?? existing?.description, 3000),
    location: normalizeText(input.location ?? existing?.location, 300),
    contactId: input.contactId !== undefined ? (normalizeText(input.contactId, 80) || null) : (existing?.contactId || null),
    dealId: input.dealId !== undefined ? (normalizeText(input.dealId, 80) || null) : (existing?.dealId || null),
    responsibleId: normalizeText(input.responsibleId ?? existing?.responsibleId, 254) || actor,
    reminderAt: input.reminderAt !== undefined ? (normalizeText(input.reminderAt, 40) || null) : (existing?.reminderAt || null),
    tags: input.tags !== undefined ? normalizeTags(input.tags) : (existing?.tags || []),
    syncTaskId: existing?.syncTaskId || null,
    syncEventId: existing?.syncEventId || null,
    syncOwnerId: existing?.syncOwnerId || actor,
    createdAt: existing?.createdAt || timestamp,
    createdBy: existing?.createdBy || actor,
    updatedAt: timestamp,
    updatedBy: actor,
  };
}

function validateEntityLinks(item, contacts, deals) {
  if (item.contactId && !contacts.some((contact) => contact.id === item.contactId)) throw new Error('Cliente vinculado não encontrado neste workspace.');
  if (item.dealId && !deals.some((deal) => deal.id === item.dealId)) throw new Error('Oportunidade vinculada não encontrada neste workspace.');
}

function validateResponsible(organization, responsibleId) {
  if (!responsibleId) return;
  const member = (organization.members || []).find((item) => item.userId === responsibleId || item.email === responsibleId);
  if (!member || member.status !== 'active') throw new Error('Responsável não é um membro ativo desta organização.');
}

async function loadCrmData(kv, orgId, workspaceId) {
  const keys = namespace(orgId, workspaceId);
  const [contacts, deals, agenda, history] = await Promise.all([
    readJson(kv, keys.contacts, []),
    readJson(kv, keys.deals, []),
    readJson(kv, keys.agenda, []),
    readJson(kv, keys.history, []),
  ]);
  return {
    keys,
    contacts: Array.isArray(contacts) ? contacts : [],
    deals: Array.isArray(deals) ? deals : [],
    agenda: Array.isArray(agenda) ? agenda : [],
    history: Array.isArray(history) ? history : [],
  };
}

async function saveCrmData(kv, data, changed) {
  const operations = [];
  if (changed.contacts) operations.push(kv.put(data.keys.contacts, JSON.stringify(data.contacts)));
  if (changed.deals) operations.push(kv.put(data.keys.deals, JSON.stringify(data.deals)));
  if (changed.agenda) operations.push(kv.put(data.keys.agenda, JSON.stringify(data.agenda)));
  if (changed.history) operations.push(kv.put(data.keys.history, JSON.stringify(data.history.slice(0, 1000))));
  await Promise.all(operations);
}

function recordHistory(data, actor, event) {
  const item = {
    id: generateEnterpriseId('history'),
    actor,
    type: normalizeText(event.type, 80),
    entity: normalizeText(event.entity, 40),
    entityId: normalizeText(event.entityId, 80),
    detail: normalizeText(event.detail, 800),
    metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : null,
    createdAt: now(),
  };
  data.history.unshift(item);
  return item;
}

function crmSnapshot(organization, membership, workspace, data) {
  const contacts = [...data.contacts].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const deals = [...data.deals].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const agenda = [...data.agenda].sort((a, b) => `${a.date || ''}${a.time || ''}`.localeCompare(`${b.date || ''}${b.time || ''}`));
  const history = [...data.history].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const pipelineTotal = deals.filter((deal) => !['won', 'lost'].includes(deal.stage)).reduce((total, deal) => total + normalizeMoney(deal.value), 0);
  const wonTotal = deals.filter((deal) => deal.stage === 'won').reduce((total, deal) => total + normalizeMoney(deal.value), 0);
  return {
    organization: { id: organization.id, name: organization.name, description: organization.description, plan: organization.plan },
    workspace: { id: workspace.id, name: workspace.name, description: workspace.description, type: workspace.type, status: workspace.status },
    membership: { role: membership.role, permissions: membership.role === 'owner' ? ['*'] : undefined },
    stages: STAGES,
    members: (organization.members || []).filter((member) => member.status === 'active').map((member) => ({ userId: member.userId, email: member.email, name: member.name || member.email, role: member.role })),
    workspaces: accessibleWorkspaces(organization, membership, membership.userId || membership.email).map((item) => ({ id: item.id, name: item.name, description: item.description, type: item.type, status: item.status })),
    contacts,
    deals,
    agenda,
    history,
    metrics: {
      contactCount: contacts.length,
      opportunityCount: deals.length,
      pipelineTotal,
      wonTotal,
      scheduledAgendaCount: agenda.filter((item) => item.status === 'scheduled').length,
    },
  };
}

async function resolveContext(kv, actor, input = {}) {
  const organizations = await listOrganizationsForUser(kv, actor);
  const requestedOrgId = normalizeText(input.orgId, 80);
  const organizationSummary = requestedOrgId ? organizations.find((organization) => organization.id === requestedOrgId) : organizations[0];
  if (!organizationSummary) {
    if (requestedOrgId) throw new Error('Organização não encontrada ou sem acesso.');
    return { organizations, organization: null, membership: null, workspace: null };
  }
  const organization = await loadOrganization(kv, organizationSummary.id);
  if (!organization) throw new Error('Organização não encontrada.');
  const membership = getMembership(organization, actor);
  if (!membership || membership.status !== 'active') throw new Error('Sem acesso a esta organização.');
  const workspaces = accessibleWorkspaces(organization, membership, actor);
  const requestedWorkspaceId = normalizeText(input.workspaceId, 80);
  const workspace = requestedWorkspaceId ? workspaces.find((item) => item.id === requestedWorkspaceId) : workspaces[0];
  if (!workspace) throw new Error('Workspace não encontrado ou sem acesso.');
  return { organizations, organization, membership, workspace };
}

async function syncPersonalAgenda(kv, item, previous = null) {
  const owner = item.syncOwnerId;
  if (!owner) return item;
  if (item.type === 'meeting') {
    const events = await readJson(kv, `events:${owner}`, []);
    const event = {
      id: item.syncEventId || generateEnterpriseId('crm_event'),
      title: item.title,
      date: item.date,
      time: item.time || '09:00',
      duration: item.duration || '1h',
      location: item.location || '',
      color: 'var(--accent)',
      description: item.description || '',
      crmAgendaId: item.id,
      crmContactId: item.contactId,
      crmDealId: item.dealId,
      updatedAt: now(),
      createdAt: previous?.createdAt || now(),
    };
    const index = events.findIndex((entry) => entry.id === event.id || entry.crmAgendaId === item.id);
    if (index >= 0) events[index] = { ...events[index], ...event };
    else events.push(event);
    events.sort((a, b) => `${a.date || ''}${a.time || ''}`.localeCompare(`${b.date || ''}${b.time || ''}`));
    await kv.put(`events:${owner}`, JSON.stringify(events));
    item.syncEventId = event.id;
    item.syncTaskId = null;
    return item;
  }
  const tasks = await readJson(kv, `tasks:${owner}`, []);
  const task = {
    id: item.syncTaskId || generateEnterpriseId('crm_task'),
    title: item.title,
    description: item.description || '',
    dueDate: item.date,
    priority: item.type === 'followup' ? 'high' : 'medium',
    status: item.status === 'completed' ? 'done' : item.status === 'cancelled' ? 'cancelled' : 'todo',
    tags: [...new Set([...(item.tags || []), 'crm'])],
    workspaceId: null,
    crmAgendaId: item.id,
    crmContactId: item.contactId,
    crmDealId: item.dealId,
    createdAt: previous?.createdAt || now(),
    updatedAt: now(),
    createdBy: owner,
  };
  const index = tasks.findIndex((entry) => entry.id === task.id || entry.crmAgendaId === item.id);
  if (index >= 0) tasks[index] = { ...tasks[index], ...task };
  else tasks.unshift(task);
  await kv.put(`tasks:${owner}`, JSON.stringify(tasks));
  item.syncTaskId = task.id;
  item.syncEventId = null;
  return item;
}

async function removePersonalAgendaSync(kv, item) {
  if (!item?.syncOwnerId) return;
  if (item.syncTaskId) {
    const tasks = await readJson(kv, `tasks:${item.syncOwnerId}`, []);
    await kv.put(`tasks:${item.syncOwnerId}`, JSON.stringify((Array.isArray(tasks) ? tasks : []).filter((task) => task.id !== item.syncTaskId && task.crmAgendaId !== item.id)));
  }
  if (item.syncEventId) {
    const events = await readJson(kv, `events:${item.syncOwnerId}`, []);
    await kv.put(`events:${item.syncOwnerId}`, JSON.stringify((Array.isArray(events) ? events : []).filter((event) => event.id !== item.syncEventId && event.crmAgendaId !== item.id)));
  }
}

function ensureWorkspaceInput(input) {
  const orgId = normalizeText(input.orgId, 80);
  const workspaceId = normalizeText(input.workspaceId, 80);
  if (!orgId || !workspaceId) throw new Error('Organização e workspace são obrigatórios.');
  return { orgId, workspaceId };
}

async function requireContext(kv, actor, input, permission) {
  const { orgId, workspaceId } = ensureWorkspaceInput(input);
  const organization = await loadOrganization(kv, orgId);
  if (!organization) throw new Error('Organização não encontrada.');
  const { membership, workspace } = assertWorkspacePermission(organization, actor, workspaceId, permission, organization.roles || []);
  return { organization, membership, workspace };
}

function assertWritableResponsible(organization, data) {
  validateResponsible(organization, data.responsibleId);
}

async function actionCreateOrganization(kv, actor, payload) {
  const organization = await createOrganization(kv, actor, payload);
  const workspace = organization.workspaces[0];
  const data = await loadCrmData(kv, organization.id, workspace.id);
  return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
}

async function handleAction(kv, actor, action, payload, origin) {
  if (action === 'organization.create') return actionCreateOrganization(kv, actor, payload);

  if (action === 'contact.create') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const contact = cleanContact(payload, actor);
    if (data.contacts.some((existing) => contactKey(existing) === contactKey(contact))) throw new Error('Já existe um cliente com estes dados neste workspace.');
    assertWritableResponsible(organization, contact);
    data.contacts.unshift(contact);
    recordHistory(data, actor, { type: 'contact.created', entity: 'contact', entityId: contact.id, detail: `Cliente "${contact.name}" cadastrado.` });
    await saveCrmData(kv, data, { contacts: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.contact.create', resourceId: contact.id, detail: `Cliente "${contact.name}" cadastrado em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'contact.update') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const index = data.contacts.findIndex((contact) => contact.id === normalizeText(payload.id, 80));
    if (index < 0) throw new Error('Cliente não encontrado.');
    const contact = cleanContact(payload, actor, data.contacts[index]);
    if (data.contacts.some((existing) => existing.id !== contact.id && contactKey(existing) === contactKey(contact))) throw new Error('Já existe um cliente com estes dados neste workspace.');
    assertWritableResponsible(organization, contact);
    data.contacts[index] = contact;
    recordHistory(data, actor, { type: 'contact.updated', entity: 'contact', entityId: contact.id, detail: `Cliente "${contact.name}" atualizado.` });
    await saveCrmData(kv, data, { contacts: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.contact.update', resourceId: contact.id, detail: `Cliente "${contact.name}" atualizado em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'contact.delete') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.delete');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const contact = data.contacts.find((item) => item.id === normalizeText(payload.id, 80));
    if (!contact) throw new Error('Cliente não encontrado.');
    data.contacts = data.contacts.filter((item) => item.id !== contact.id);
    data.deals = data.deals.map((deal) => deal.contactId === contact.id ? { ...deal, contactId: null, updatedAt: now(), updatedBy: actor } : deal);
    data.agenda = data.agenda.map((item) => item.contactId === contact.id ? { ...item, contactId: null, updatedAt: now(), updatedBy: actor } : item);
    recordHistory(data, actor, { type: 'contact.deleted', entity: 'contact', entityId: contact.id, detail: `Cliente "${contact.name}" excluído; vínculos foram desvinculados.` });
    await saveCrmData(kv, data, { contacts: true, deals: true, agenda: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.contact.delete', resourceId: contact.id, detail: `Cliente "${contact.name}" excluído em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'deal.create') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const deal = cleanDeal(payload, actor);
    validateEntityLinks(deal, data.contacts, data.deals);
    assertWritableResponsible(organization, deal);
    data.deals.unshift(deal);
    recordHistory(data, actor, { type: 'deal.created', entity: 'deal', entityId: deal.id, detail: `Oportunidade "${deal.title}" criada em ${stageById(deal.stage).name}.`, metadata: { stage: deal.stage, value: deal.value } });
    await saveCrmData(kv, data, { deals: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.deal.create', resourceId: deal.id, detail: `Oportunidade "${deal.title}" criada em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'deal.update' || action === 'deal.move') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const index = data.deals.findIndex((deal) => deal.id === normalizeText(payload.id, 80));
    if (index < 0) throw new Error('Oportunidade não encontrada.');
    const previous = data.deals[index];
    const deal = cleanDeal(payload, actor, previous);
    validateEntityLinks(deal, data.contacts, data.deals);
    assertWritableResponsible(organization, deal);
    data.deals[index] = deal;
    const detail = previous.stage !== deal.stage
      ? `Oportunidade "${deal.title}" movida de ${stageById(previous.stage)?.name || previous.stage} para ${stageById(deal.stage).name}.`
      : `Oportunidade "${deal.title}" atualizada.`;
    recordHistory(data, actor, { type: previous.stage !== deal.stage ? 'deal.stageChanged' : 'deal.updated', entity: 'deal', entityId: deal.id, detail, metadata: { from: previous.stage, to: deal.stage, probability: deal.probability, value: deal.value } });
    await saveCrmData(kv, data, { deals: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: previous.stage !== deal.stage ? 'crm.deal.move' : 'crm.deal.update', resourceId: deal.id, detail });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'deal.delete') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.delete');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const deal = data.deals.find((item) => item.id === normalizeText(payload.id, 80));
    if (!deal) throw new Error('Oportunidade não encontrada.');
    data.deals = data.deals.filter((item) => item.id !== deal.id);
    data.agenda = data.agenda.map((item) => item.dealId === deal.id ? { ...item, dealId: null, updatedAt: now(), updatedBy: actor } : item);
    recordHistory(data, actor, { type: 'deal.deleted', entity: 'deal', entityId: deal.id, detail: `Oportunidade "${deal.title}" excluída; vínculos foram desvinculados.` });
    await saveCrmData(kv, data, { deals: true, agenda: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.deal.delete', resourceId: deal.id, detail: `Oportunidade "${deal.title}" excluída em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'agenda.create') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'agenda.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const item = cleanAgendaItem(payload, actor);
    validateEntityLinks(item, data.contacts, data.deals);
    assertWritableResponsible(organization, item);
    item.syncOwnerId = actor;
    await syncPersonalAgenda(kv, item);
    data.agenda.push(item);
    recordHistory(data, actor, { type: 'agenda.created', entity: 'agenda', entityId: item.id, detail: `${item.type} "${item.title}" agendado para ${item.date}.` });
    await saveCrmData(kv, data, { agenda: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.agenda.create', resourceId: item.id, detail: `Compromisso comercial "${item.title}" criado em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'agenda.update') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'agenda.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const index = data.agenda.findIndex((item) => item.id === normalizeText(payload.id, 80));
    if (index < 0) throw new Error('Compromisso comercial não encontrado.');
    const previous = data.agenda[index];
    const item = cleanAgendaItem(payload, actor, previous);
    validateEntityLinks(item, data.contacts, data.deals);
    assertWritableResponsible(organization, item);
    if (previous.type !== item.type) await removePersonalAgendaSync(kv, previous);
    await syncPersonalAgenda(kv, item, previous);
    data.agenda[index] = item;
    recordHistory(data, actor, { type: 'agenda.updated', entity: 'agenda', entityId: item.id, detail: `Compromisso comercial "${item.title}" atualizado.` });
    await saveCrmData(kv, data, { agenda: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.agenda.update', resourceId: item.id, detail: `Compromisso comercial "${item.title}" atualizado em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'agenda.delete') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'agenda.delete');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const item = data.agenda.find((entry) => entry.id === normalizeText(payload.id, 80));
    if (!item) throw new Error('Compromisso comercial não encontrado.');
    await removePersonalAgendaSync(kv, item);
    data.agenda = data.agenda.filter((entry) => entry.id !== item.id);
    recordHistory(data, actor, { type: 'agenda.deleted', entity: 'agenda', entityId: item.id, detail: `Compromisso comercial "${item.title}" excluído.` });
    await saveCrmData(kv, data, { agenda: true, history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.agenda.delete', resourceId: item.id, detail: `Compromisso comercial "${item.title}" excluído em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'history.create') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const entity = normalizeText(payload.entity, 40);
    const entityId = normalizeText(payload.entityId, 80);
    const detail = normalizeText(payload.detail, 800);
    if (!['contact', 'deal'].includes(entity) || !entityId || !detail) throw new Error('Histórico requer entidade, identificador e descrição.');
    const collection = entity === 'contact' ? data.contacts : data.deals;
    if (!collection.some((item) => item.id === entityId)) throw new Error('Entidade do histórico não encontrada.');
    recordHistory(data, actor, { type: 'note', entity, entityId, detail });
    await saveCrmData(kv, data, { history: true });
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'crm.history.create', resourceId: entityId, detail: `Registro de histórico criado em ${workspace.name}.` });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'workspace.create') {
    const orgId = normalizeText(payload.orgId, 80);
    const organization = await loadOrganization(kv, orgId);
    if (!organization) throw new Error('Organização não encontrada.');
    assertPermission(organization, actor, 'workspaces.create', organization.roles || []);
    const name = normalizeText(payload.name, 120);
    if (!name) throw new Error('Nome do workspace é obrigatório.');
    const workspace = {
      id: generateEnterpriseId('ws'),
      name,
      description: normalizeText(payload.description, 500),
      type: normalizeText(payload.type, 40) || 'general',
      status: 'active',
      members: [actor],
      preferences: { notifications: true, defaultView: 'overview' },
      activity: [],
      protected: false,
      createdAt: now(),
      updatedAt: now(),
    };
    const detail = `Workspace "${workspace.name}" criado.`;
    workspace.activity.unshift({ id: generateEnterpriseId('activity'), actor, action: 'workspace.create', detail, createdAt: workspace.createdAt });
    organization.workspaces.push(workspace);
    await saveOrganization(kv, organization);
    await appendOrganizationAudit(kv, organization.id, { actor, action: 'workspace.create', resourceId: workspace.id, detail });
    const data = await loadCrmData(kv, organization.id, workspace.id);
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  // ─── CONTACT NOTE (observação) ────────────────────────────────────────────
  if (action === 'contact.note') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const contactId = normalizeText(payload.contactId, 80);
    const detail = normalizeText(payload.detail, 3000);
    if (!contactId || !detail) throw new Error('contactId e detail são obrigatórios.');
    const contact = data.contacts.find(c => c.id === contactId);
    if (!contact) throw new Error('Cliente não encontrado.');
    if (!Array.isArray(contact.observations)) contact.observations = [];
    contact.observations.unshift({ id: generateEnterpriseId('obs'), detail, actor, createdAt: now() });
    contact.updatedAt = now();
    recordHistory(data, actor, { type: 'note', entity: 'contact', entityId: contactId, detail });
    await saveCrmData(kv, data, { contacts: true, history: true });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  // ─── CONTACT ATTACHMENT ──────────────────────────────────────────────────
  if (action === 'contact.attachment.add') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const contactId = normalizeText(payload.contactId, 80);
    const name = normalizeText(payload.name, 200);
    const url = normalizeText(payload.url, 2000);
    if (!contactId || !name || !url) throw new Error('contactId, name e url são obrigatórios.');
    const contact = data.contacts.find(c => c.id === contactId);
    if (!contact) throw new Error('Cliente não encontrado.');
    if (!Array.isArray(contact.attachments)) contact.attachments = [];
    contact.attachments.push({ id: generateEnterpriseId('att'), name, url, mimeType: normalizeText(payload.mimeType, 100) || 'application/octet-stream', size: parseInt(payload.size) || 0, uploadedBy: actor, uploadedAt: now() });
    contact.updatedAt = now();
    recordHistory(data, actor, { type: 'attachment', entity: 'contact', entityId: contactId, detail: `Anexo adicionado: "${name}"` });
    await saveCrmData(kv, data, { contacts: true, history: true });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  if (action === 'contact.attachment.delete') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const contactId = normalizeText(payload.contactId, 80);
    const attachmentId = normalizeText(payload.attachmentId, 80);
    if (!contactId || !attachmentId) throw new Error('contactId e attachmentId são obrigatórios.');
    const contact = data.contacts.find(c => c.id === contactId);
    if (!contact) throw new Error('Cliente não encontrado.');
    contact.attachments = (contact.attachments || []).filter(a => a.id !== attachmentId);
    contact.updatedAt = now();
    await saveCrmData(kv, data, { contacts: true });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  // ─── DEAL ATTACHMENT ─────────────────────────────────────────────────────
  if (action === 'deal.attachment.add') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const dealId = normalizeText(payload.dealId, 80);
    const name = normalizeText(payload.name, 200);
    const url = normalizeText(payload.url, 2000);
    if (!dealId || !name || !url) throw new Error('dealId, name e url são obrigatórios.');
    const deal = data.deals.find(d => d.id === dealId);
    if (!deal) throw new Error('Oportunidade não encontrada.');
    if (!Array.isArray(deal.attachments)) deal.attachments = [];
    deal.attachments.push({ id: generateEnterpriseId('att'), name, url, mimeType: normalizeText(payload.mimeType, 100) || 'application/octet-stream', size: parseInt(payload.size) || 0, uploadedBy: actor, uploadedAt: now() });
    deal.updatedAt = now();
    recordHistory(data, actor, { type: 'attachment', entity: 'deal', entityId: dealId, detail: `Anexo adicionado: "${name}"` });
    await saveCrmData(kv, data, { deals: true, history: true });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  // ─── CONTACT FOLLOWUP ────────────────────────────────────────────────────
  if (action === 'contact.followup') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const contactId = normalizeText(payload.contactId, 80);
    const title = normalizeText(payload.title, 160) || 'Follow-up';
    const date = normalizeDate(payload.date) || now().slice(0, 10);
    const time = normalizeTime(payload.time) || '09:00';
    if (!contactId) throw new Error('contactId é obrigatório.');
    const contact = data.contacts.find(c => c.id === contactId);
    if (!contact) throw new Error('Cliente não encontrado.');
    const agendaItem = cleanAgendaItem({ title, type: 'followup', date, time, status: 'scheduled', contactId, description: normalizeText(payload.description, 1000), responsibleId: actor, tags: payload.tags }, actor);
    data.agenda.push(agendaItem);
    contact.lastContactAt = now().slice(0, 10);
    contact.updatedAt = now();
    recordHistory(data, actor, { type: 'followup', entity: 'contact', entityId: contactId, detail: `Follow-up agendado: "${title}" para ${date}` });
    await saveCrmData(kv, data, { agenda: true, contacts: true, history: true });
    await syncPersonalAgenda(kv, agendaItem);
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  // ─── DEAL NOTE ───────────────────────────────────────────────────────────
  if (action === 'deal.note') {
    const { organization, workspace } = await requireContext(kv, actor, payload, 'crm.write');
    const data = await loadCrmData(kv, organization.id, workspace.id);
    const dealId = normalizeText(payload.dealId, 80);
    const detail = normalizeText(payload.detail, 3000);
    if (!dealId || !detail) throw new Error('dealId e detail são obrigatórios.');
    const deal = data.deals.find(d => d.id === dealId);
    if (!deal) throw new Error('Oportunidade não encontrada.');
    if (!Array.isArray(deal.notes)) deal.notes = [];
    deal.notes.unshift({ id: generateEnterpriseId('note'), detail, actor, createdAt: now() });
    deal.updatedAt = now();
    recordHistory(data, actor, { type: 'note', entity: 'deal', entityId: dealId, detail });
    await saveCrmData(kv, data, { deals: true, history: true });
    return crmSnapshot(organization, getMembership(organization, actor), workspace, data);
  }

  throw new Error('Ação CRM inválida.');
}

export async function onRequest({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Autenticação ainda não configurada.' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado.' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível.' });

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const context = await resolveContext(kv, actorLabel(session), {
        orgId: url.searchParams.get('orgId') || '',
        workspaceId: url.searchParams.get('workspaceId') || '',
      });
      if (!context.organization) return json(200, { ok: true, data: { organizations: context.organizations, organization: null, workspace: null, stages: STAGES, contacts: [], deals: [], agenda: [], history: [], members: [], metrics: { contactCount: 0, opportunityCount: 0, pipelineTotal: 0, wonTotal: 0, scheduledAgendaCount: 0 }, membership: null } });
      assertWorkspacePermission(context.organization, actorLabel(session), context.workspace.id, 'crm.read', context.organization.roles || []);
      assertWorkspacePermission(context.organization, actorLabel(session), context.workspace.id, 'agenda.read', context.organization.roles || []);
      const data = await loadCrmData(kv, context.organization.id, context.workspace.id);
      const snapshot = crmSnapshot(context.organization, context.membership, context.workspace, data);
      // Pesquisa por texto nos contatos e oportunidades via ?q=
      const q = (url.searchParams.get('q') || '').toLowerCase().trim();
      if (q) {
        snapshot.contacts = snapshot.contacts.filter(c => contactKey(c).includes(q));
        snapshot.deals = snapshot.deals.filter(d => (d.title + ' ' + (d.company || '') + ' ' + (d.description || '')).toLowerCase().includes(q));
      }
      return json(200, { ok: true, data: { ...snapshot, organizations: context.organizations } });
    }

    if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH' && request.method !== 'DELETE') return json(405, { ok: false, error: 'Método não permitido.' });
    const input = await request.json();
    const action = normalizeText(input?.action, 80);
    // Suportar payload como objeto separado OU campos diretos no body
    const payload = input?.payload && typeof input.payload === 'object'
      ? input.payload
      : { ...input };
    delete payload.action; // remover action do payload
    const data = await handleAction(kv, actorLabel(session), action, payload, new URL(request.url).origin);
    const organizations = await listOrganizationsForUser(kv, actorLabel(session));
    return json(200, { ok: true, data: { ...data, organizations } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar o CRM.';
    const status = error?.status || (/Sem acesso|Sem permissão|não encontrado ou sem acesso/i.test(message) ? 403 : 400);
    return json(status, { ok: false, error: message });
  }
}
