// LifeOS Enterprise — Enterprise Data API
// Cloudflare Pages Function: GET/POST /api/enterprise-data
// Persistência via Cloudflare KV
// v4.0.0 — Campos completos, auditLog padronizado

import { getCookie, json, verifySession } from '../_auth.js';

const KV_KEY = 'lifeos-enterprise-state-v22';

function seedState() {
  const now = new Date().toISOString();
  return {
    version: 6,
    organization: {
      id: 'org_lifeos',
      name: 'LifeOS Enterprise',
      slug: 'lifeos-enterprise',
      domain: 'lifeos.app',
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      dataRegion: 'sa-east-1',
      createdAt: now,
    },
    roles: [
      { id: 'owner', name: 'Owner', description: 'Controle integral da organização.', system: true, permissions: ['*'] },
      { id: 'admin', name: 'Administrador', description: 'Administração operacional e de usuários.', system: true, permissions: ['org.read', 'org.update', 'members.*', 'analytics.read', 'billing.read', 'security.*', 'intelligence.*'] },
      { id: 'manager', name: 'Gestor', description: 'Gestão de equipes e indicadores.', system: true, permissions: ['org.read', 'members.read', 'teams.*', 'analytics.read', 'intelligence.read'] },
      { id: 'member', name: 'Membro', description: 'Acesso aos módulos de produtividade.', system: true, permissions: ['org.read', 'workspace.*'] },
      { id: 'viewer', name: 'Leitor', description: 'Acesso somente leitura.', system: true, permissions: ['org.read', 'analytics.read'] },
    ],
    members: [
      { id: 'usr_owner', name: 'Administrador', email: 'admin@lifeos.app', roleId: 'owner', team: 'Estratégia', status: 'active', lastActiveAt: now },
      { id: 'usr_ops', name: 'Marina Costa', email: 'marina@lifeos.app', roleId: 'admin', team: 'Operações', status: 'active', lastActiveAt: now },
      { id: 'usr_product', name: 'Rafael Lima', email: 'rafael@lifeos.app', roleId: 'manager', team: 'Produto', status: 'active', lastActiveAt: now },
    ],
    teams: [
      { id: 'team_strategy', name: 'Estratégia', members: 1, ownerId: 'usr_owner' },
      { id: 'team_ops', name: 'Operações', members: 1, ownerId: 'usr_ops' },
      { id: 'team_product', name: 'Produto', members: 1, ownerId: 'usr_product' },
    ],
    subscription: {
      plan: 'Enterprise',
      status: 'active',
      cycle: 'annual',
      seats: 25,
      seatsUsed: 3,
      monthlyValue: 2490,
      renewalAt: '2027-07-01',
      paymentMethod: 'Visa •••• 4242',
    },
    invoices: [
      { id: 'INV-2026-007', date: '2026-07-01', amount: 2490, status: 'paid', url: '#invoice-2026-007' },
      { id: 'INV-2026-006', date: '2026-06-01', amount: 2490, status: 'paid', url: '#invoice-2026-006' },
      { id: 'INV-2026-005', date: '2026-05-01', amount: 2490, status: 'paid', url: '#invoice-2026-005' },
    ],
    integrations: [
      { id: 'google', name: 'Google Workspace', category: 'Produtividade', configured: false, connected: false, status: 'not_configured', config: { accountLabel: '', endpoint: '' }, permissions: [], history: [], configuredAt: null, updatedAt: now, lastConnectionAt: null, lastSyncAt: null, lastFailureAt: null, lastError: '' },
      { id: 'slack', name: 'Slack', category: 'Comunicação', configured: false, connected: false, status: 'not_configured', config: { accountLabel: '', endpoint: '' }, permissions: [], history: [], configuredAt: null, updatedAt: now, lastConnectionAt: null, lastSyncAt: null, lastFailureAt: null, lastError: '' },
      { id: 'notion', name: 'Notion', category: 'Conhecimento', configured: false, connected: false, status: 'not_configured', config: { accountLabel: '', endpoint: '' }, permissions: [], history: [], configuredAt: null, updatedAt: now, lastConnectionAt: null, lastSyncAt: null, lastFailureAt: null, lastError: '' },
      { id: 'github', name: 'GitHub', category: 'Engenharia', configured: false, connected: false, status: 'not_configured', config: { accountLabel: '', endpoint: '' }, permissions: [], history: [], configuredAt: null, updatedAt: now, lastConnectionAt: null, lastSyncAt: null, lastFailureAt: null, lastError: '' },
      { id: 'jira', name: 'Jira', category: 'Gestão', configured: false, connected: false, status: 'not_configured', config: { accountLabel: '', endpoint: '' }, permissions: [], history: [], configuredAt: null, updatedAt: now, lastConnectionAt: null, lastSyncAt: null, lastFailureAt: null, lastError: '' },
      { id: 'salesforce', name: 'Salesforce', category: 'Vendas', configured: false, connected: false, status: 'not_configured', config: { accountLabel: '', endpoint: '' }, permissions: [], history: [], configuredAt: null, updatedAt: now, lastConnectionAt: null, lastSyncAt: null, lastFailureAt: null, lastError: '' },
    ],
    devices: [
      { id: 'dev_web', name: 'Chrome · Linux', location: 'São Paulo, BR', trusted: true, current: true, lastActiveAt: now },
      { id: 'dev_mobile', name: 'Safari · iPhone', location: 'São Paulo, BR', trusted: true, current: false, lastActiveAt: '2026-07-11T21:18:00.000Z' },
    ],
    policies: {
      mfaRequired: true,
      sessionHours: 12,
      passwordMinLength: 12,
      auditRetentionDays: 365,
      dataEncryption: true,
      ssoEnforced: false,
      ipAllowlist: [],
      lgpdMode: true,
    },
    intelligence: [
      {
        id: 'ins_001',
        type: 'risk',
        severity: 'high',
        impact: 'high',
        title: 'Dispositivos sem MFA',
        summary: '2 membros não ativaram autenticação multifator, expondo a organização a riscos de acesso não autorizado.',
        description: '2 membros não ativaram autenticação multifator.',
        action: 'Exigir MFA',
        confidence: 0.97,
        status: 'open',
        createdAt: now,
      },
      {
        id: 'ins_002',
        type: 'opportunity',
        severity: 'medium',
        impact: 'medium',
        title: 'Expansão de equipe',
        summary: 'Capacidade disponível para 22 novos membros no plano atual. Considere onboarding de novas equipes.',
        description: 'Capacidade disponível para 22 novos membros.',
        action: 'Iniciar onboarding',
        confidence: 0.82,
        status: 'open',
        createdAt: now,
      },
      {
        id: 'ins_003',
        type: 'compliance',
        severity: 'low',
        impact: 'low',
        title: 'Revisão de políticas LGPD',
        summary: 'Políticas de retenção de dados vencem em 30 dias. Revisão e renovação recomendadas para conformidade.',
        description: 'Políticas de retenção de dados vencem em 30 dias.',
        action: 'Revisar políticas',
        confidence: 0.91,
        status: 'open',
        createdAt: now,
      },
    ],
    tasks: [],
    auditLog: [
      {
        id: 'aud_001',
        actor: 'admin@lifeos.app',
        action: 'system.init',
        resourceId: 'system',
        detail: 'Sistema inicializado em produção — v16.5.0.',
        createdAt: now,
      },
    ],
    workspaces: [
      { id: 'ws_001', name: 'Estratégia Corporativa', type: 'strategy', description: 'Planejamento estratégico e OKRs da organização.', status: 'active', members: ['usr_owner'], preferences: { notifications: true, defaultView: 'overview' }, activity: [], protected: true, createdAt: now, updatedAt: now },
      { id: 'ws_002', name: 'Operações', type: 'operations', description: 'Processos operacionais e indicadores.', status: 'active', members: ['usr_ops'], preferences: { notifications: true, defaultView: 'overview' }, activity: [], protected: false, createdAt: now, updatedAt: now },
      { id: 'ws_003', name: 'Produto & Tecnologia', type: 'product', description: 'Roadmap, sprints e entregas de produto.', status: 'active', members: ['usr_product'], preferences: { notifications: true, defaultView: 'overview' }, activity: [], protected: false, createdAt: now, updatedAt: now },
    ],
    notifications: [],
    notificationPreferences: {
      security: true,
      billing: true,
      people: true,
      workspaces: true,
      integrations: true,
      intelligence: true,
      system: true,
    },
    mfa: {
      enabled: true,
      totp: true,
      sms: false,
      fido2: false,
      backupCodes: 8,
    },
    healthScore: null,
    system: {
      status: 'not_monitored',
      version: '16.5.0',
      environment: 'production',
      lastCheckedAt: now,
      telemetryAvailable: false,
      telemetryReason: 'Telemetria de infraestrutura não configurada.',
      uptime: null,
      region: 'cloudflare-pages',
      apiP95: null,
      errorRate: null,
      activeSessions: null,
      activeMembers: 1,
      cpu: null,
      memory: null,
      disk: null,
      network: null,
      healthScore: null,
      lastBackupAt: null,
    },
  };
}

async function loadState(kv) {
  if (!kv) return seedState();
  try {
    const raw = await kv.get(KV_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    // Migração v17.5: retirar métricas históricas sem fonte observável.
    parsed.system = {
      ...(parsed.system || {}),
      status: 'not_monitored',
      telemetryAvailable: false,
      telemetryReason: 'Telemetria de infraestrutura não configurada.',
      uptime: null,
      apiP95: null,
      errorRate: null,
      activeSessions: null,
      activeMembers: (parsed.members || []).filter(member => member.status === 'active').length,
      cpu: null,
      memory: null,
      disk: null,
      network: null,
      healthScore: null,
      lastBackupAt: parsed.system?.lastBackupAt || null,
      version: parsed.system?.version || '16.5.0',
    };
    parsed.healthScore = null;
    // Migração: normalizar auditLog (timestamp → createdAt, description → detail)
    if (parsed.auditLog) {
      parsed.auditLog = parsed.auditLog.map(log => ({
        ...log,
        createdAt: log.createdAt || log.timestamp || new Date().toISOString(),
        detail: log.detail || log.description || '',
      }));
    }
    // Migração: normalizar intelligence (adicionar campos faltantes)
    if (parsed.intelligence) {
      parsed.intelligence = parsed.intelligence.map(ins => ({
        impact: ins.severity || 'medium',
        summary: ins.description || ins.summary || '',
        action: ins.action || 'Revisar',
        confidence: ins.confidence || 0.85,
        ...ins,
      }));
    }
    // Migração v17: estrutura corporativa persistente de Workspaces.
    const migratedAt = new Date().toISOString();
    parsed.workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces.map((workspace, index) => {
      const members = Array.isArray(workspace.members) ? workspace.members.map(reference => {
        const member = (parsed.members || []).find(item => item.id === reference || item.email === reference);
        return member?.id || String(reference || '');
      }).filter(Boolean) : [];
      return {
        ...workspace,
        members,
        preferences: { notifications: true, defaultView: 'overview', ...(workspace.preferences || {}) },
        activity: Array.isArray(workspace.activity) ? workspace.activity : [],
        protected: typeof workspace.protected === 'boolean' ? workspace.protected : index === 0,
        updatedAt: workspace.updatedAt || workspace.createdAt || migratedAt,
      };
    }) : [];
    // Migração v17.5: estados de Integrações baseados apenas em configuração persistida.
    const integrationCatalog = [
      { id: 'google', name: 'Google Workspace', category: 'Produtividade' },
      { id: 'slack', name: 'Slack', category: 'Comunicação' },
      { id: 'notion', name: 'Notion', category: 'Conhecimento' },
      { id: 'github', name: 'GitHub', category: 'Engenharia' },
      { id: 'jira', name: 'Jira', category: 'Gestão' },
      { id: 'salesforce', name: 'Salesforce', category: 'Vendas' },
    ];
    parsed.integrations = integrationCatalog.map(catalogItem => {
      const current = (parsed.integrations || []).find(item => item.id === catalogItem.id) || {};
      const configured = current.configured === true || Boolean(current.configuredAt || current.config?.accountLabel);
      const connected = configured && current.connected === true;
      const status = current.status === 'failed' ? 'failed' : connected ? 'active' : configured ? 'disconnected' : 'not_configured';
      return {
        ...catalogItem,
        ...current,
        configured,
        connected,
        status,
        config: { accountLabel: '', endpoint: '', ...(current.config || {}) },
        permissions: Array.isArray(current.permissions) ? current.permissions.map(String).slice(0, 30) : [],
        history: Array.isArray(current.history) ? current.history.slice(0, 100) : [],
        configuredAt: configured ? (current.configuredAt || current.updatedAt || migratedAt) : null,
        updatedAt: current.updatedAt || migratedAt,
        lastConnectionAt: current.lastConnectionAt || null,
        lastSyncAt: configured ? (current.lastSyncAt || null) : null,
        lastFailureAt: current.lastFailureAt || null,
        lastError: configured ? normalizeText(current.lastError || '', 300) : '',
      };
    });
    // Migração v17.5: Central unificada de Notificações sem conteúdo de demonstração.
    const notificationCategories = ['security', 'billing', 'people', 'workspaces', 'integrations', 'intelligence', 'system'];
    const legacySeedIds = new Set(['ntf_001', 'ntf_002', 'ntf_003', 'ntf_004']);
    parsed.notifications = (Array.isArray(parsed.notifications) ? parsed.notifications : [])
      .filter(notification => !legacySeedIds.has(notification.id))
      .map(notification => ({
        ...notification,
        category: notificationCategories.includes(notification.category) ? notification.category : 'system',
        read: notification.read === true,
        readAt: notification.read === true ? (notification.readAt || notification.createdAt || migratedAt) : null,
        sourceAction: normalizeText(notification.sourceAction || '', 100),
        createdAt: notification.createdAt || migratedAt,
      }))
      .slice(0, 200);
    parsed.notificationPreferences = {
      security: true,
      billing: true,
      people: true,
      workspaces: true,
      integrations: true,
      intelligence: true,
      system: true,
      ...(parsed.notificationPreferences || {}),
    };
    parsed.version = Math.max(Number(parsed.version) || 0, 7);
    return parsed;
  } catch {
    return seedState();
  }
}

async function saveState(kv, state) {
  if (!kv) return;
  await kv.put(KV_KEY, JSON.stringify(state));
}

function normalizeText(value, maxLen = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function generateId() {
  return 'id_' + crypto.randomUUID().replace(/-/g,'').slice(0,11) + '_' + Date.now().toString(36);
}

function audit(state, actor, action, resourceId, detail) {
  state.auditLog.unshift({
    id: generateId(),
    actor,
    action,
    resourceId,
    detail,
    createdAt: new Date().toISOString(),
  });
  if (state.auditLog.length > 500) state.auditLog = state.auditLog.slice(0, 500);
}

function recordWorkspaceActivity(state, workspace, actor, action, detail) {
  if (!Array.isArray(workspace.activity)) workspace.activity = [];
  workspace.activity.unshift({ id: generateId(), actor, action, detail, createdAt: new Date().toISOString() });
  if (workspace.activity.length > 100) workspace.activity = workspace.activity.slice(0, 100);
  workspace.updatedAt = new Date().toISOString();
  audit(state, actor, action, workspace.id, detail);
}

function recordIntegrationEvent(state, integration, actor, action, status, detail) {
  const now = new Date().toISOString();
  if (!Array.isArray(integration.history)) integration.history = [];
  integration.history.unshift({ id: generateId(), actor, action, status, detail, createdAt: now });
  if (integration.history.length > 100) integration.history = integration.history.slice(0, 100);
  integration.updatedAt = now;
  audit(state, actor, action, integration.id, detail);
}

function createNotification(state, { category = 'system', title, message, sourceAction = '' }) {
  const allowed = ['security', 'billing', 'people', 'workspaces', 'integrations', 'intelligence', 'system'];
  const normalizedCategory = allowed.includes(category) ? category : 'system';
  if (state.notificationPreferences?.[normalizedCategory] === false) return;
  if (!Array.isArray(state.notifications)) state.notifications = [];
  state.notifications.unshift({
    id: generateId(),
    category: normalizedCategory,
    title: normalizeText(title, 160) || 'Atualização do LIFEOS',
    message: normalizeText(message, 500),
    sourceAction: normalizeText(sourceAction, 100),
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
  if (state.notifications.length > 200) state.notifications = state.notifications.slice(0, 200);
}

function applyAction(state, action, payload, actor) {
  if (action === 'organization.update') {
    const name = normalizeText(payload.name, 120);
    const domain = normalizeText(payload.domain, 253);
    const timezone = normalizeText(payload.timezone, 60);
    const locale = ['pt-BR', 'en-US'].includes(payload.locale) ? payload.locale : state.organization.locale;
    if (!name) throw new Error('Nome da organização é obrigatório.');
    state.organization = { ...state.organization, name, domain, timezone, locale, updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'organization', `Organização atualizada: ${name}.`);
  } else if (action === 'member.invite') {
    const email = normalizeText(payload.email, 254);
    const name = normalizeText(payload.name, 120);
    const roleId = normalizeText(payload.roleId, 40);
    if (!email || !name) throw new Error('Nome e e-mail são obrigatórios.');
    if (!state.roles.find(r => r.id === roleId)) throw new Error('Perfil inválido.');
    if (state.members.find(m => m.email === email)) throw new Error('Membro já existe.');
    const member = { id: generateId(), name, email, roleId, team: normalizeText(payload.team, 80) || 'Geral', status: 'invited', lastActiveAt: new Date().toISOString() };
    state.members.push(member);
    audit(state, actor, action, member.id, `Convite enviado para ${email}.`);
    createNotification(state, { category: 'people', title: 'Convite de membro enviado', message: `${name} foi convidado para a organização como ${roleId}.`, sourceAction: action });
  } else if (action === 'member.update') {
    const member = state.members.find(m => m.id === payload.id);
    if (!member) throw new Error('Membro não encontrado.');
    if (member.roleId === 'owner' && payload.roleId && payload.roleId !== 'owner') throw new Error('Owner não pode ter o perfil alterado.');
    if (payload.name) member.name = normalizeText(payload.name, 120);
    if (payload.roleId) {
      if (!state.roles.find(r => r.id === payload.roleId)) throw new Error('Perfil inválido.');
      member.roleId = payload.roleId;
    }
    if (payload.team) member.team = normalizeText(payload.team, 80);
    if (payload.status && ['active', 'invited', 'suspended'].includes(payload.status)) member.status = payload.status;
    audit(state, actor, action, member.id, `Membro ${member.email} atualizado.`);
  } else if (action === 'member.remove') {
    const member = state.members.find(m => m.id === payload.id);
    if (!member) throw new Error('Membro não encontrado.');
    if (member.roleId === 'owner') throw new Error('Owner não pode ser removido.');
    state.members = state.members.filter(m => m.id !== payload.id);
    audit(state, actor, action, String(payload.id), `Membro ${member.email} removido.`);
    createNotification(state, { category: 'people', title: 'Membro removido', message: `${member.name} foi removido da organização.`, sourceAction: action });
  } else if (action === 'role.create') {
    const role = { id: generateId(), name: normalizeText(payload.name, 80), description: normalizeText(payload.description), permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String).slice(0, 50) : [] };
    if (!role.name) throw new Error('Nome do perfil é obrigatório.');
    state.roles.push(role);
    audit(state, actor, action, role.id, `Perfil ${role.name} criado.`);
  } else if (action === 'role.update') {
    const role = state.roles.find(r => r.id === payload.id);
    if (!role || role.system) throw new Error('Perfil de sistema não pode ser alterado.');
    role.name = normalizeText(payload.name, 80) || role.name;
    role.description = normalizeText(payload.description) || role.description;
    if (Array.isArray(payload.permissions)) role.permissions = payload.permissions.map(String).slice(0, 50);
    audit(state, actor, action, role.id, `Perfil ${role.name} atualizado.`);
  } else if (action === 'role.remove') {
    const role = state.roles.find(r => r.id === payload.id);
    if (!role || role.system || state.members.some(m => m.roleId === role.id)) throw new Error('Perfil protegido ou em uso.');
    state.roles = state.roles.filter(r => r.id !== payload.id);
    audit(state, actor, action, String(payload.id), `Perfil ${role.name} removido.`);
  } else if (action === 'plan.change') {
    const plan = normalizeText(payload.plan, 40);
    if (!['Essentials', 'Business', 'Enterprise'].includes(plan)) throw new Error('Plano inválido.');
    state.subscription = { ...state.subscription, plan, status: 'active', updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'subscription', `Plano alterado para ${plan}.`);
    createNotification(state, { category: 'billing', title: 'Plano atualizado', message: `O plano da organização foi alterado para ${plan}.`, sourceAction: action });
  } else if (action === 'plan.cancel') {
    state.subscription = { ...state.subscription, status: 'cancel_at_period_end', cancellationReason: normalizeText(payload.reason), updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'subscription', 'Cancelamento programado para o fim do ciclo.');
    createNotification(state, { category: 'billing', title: 'Cancelamento programado', message: 'A assinatura será encerrada ao fim do ciclo vigente.', sourceAction: action });
  } else if (action === 'integration.configure') {
    const integration = (state.integrations || []).find(item => item.id === payload.id);
    if (!integration) throw new Error('Integração não encontrada.');
    const accountLabel = normalizeText(payload.accountLabel, 120);
    if (!accountLabel) throw new Error('Identificação da conta ou ambiente é obrigatória.');
    const permissions = Array.isArray(payload.permissions)
      ? [...new Set(payload.permissions.map(value => normalizeText(String(value), 80)).filter(value => /^[a-z0-9.*:_-]+$/i.test(value)))].slice(0, 30)
      : [];
    integration.config = { accountLabel, endpoint: normalizeText(payload.endpoint, 500) };
    integration.permissions = permissions;
    integration.configured = true;
    integration.connected = false;
    integration.status = 'disconnected';
    integration.configuredAt = integration.configuredAt || new Date().toISOString();
    integration.lastError = '';
    recordIntegrationEvent(state, integration, actor, action, 'configured', `${integration.name} configurada para "${accountLabel}"; nenhuma sincronização externa foi executada.`);
    createNotification(state, { category: 'integrations', title: `${integration.name} configurada`, message: `A configuração administrativa de "${accountLabel}" foi salva sem executar sincronização externa.`, sourceAction: action });
  } else if (action === 'integration.disconnect') {
    const integration = (state.integrations || []).find(item => item.id === payload.id);
    if (!integration?.configured) throw new Error('Configure a integração antes de alterar a conexão.');
    integration.connected = false;
    integration.status = 'disconnected';
    recordIntegrationEvent(state, integration, actor, action, 'disconnected', `${integration.name} desconectada administrativamente.`);
    createNotification(state, { category: 'integrations', title: `${integration.name} desconectada`, message: 'A conexão administrativa foi desativada no LIFEOS.', sourceAction: action });
  } else if (action === 'integration.reconnect') {
    const integration = (state.integrations || []).find(item => item.id === payload.id);
    if (!integration?.configured || !integration.config?.accountLabel) throw new Error('Configure a integração antes de reconectar.');
    integration.connected = true;
    integration.status = 'active';
    integration.lastConnectionAt = new Date().toISOString();
    integration.lastError = '';
    recordIntegrationEvent(state, integration, actor, action, 'active', `${integration.name} reativada no LIFEOS; nenhuma sincronização externa foi executada.`);
    createNotification(state, { category: 'integrations', title: `${integration.name} reativada`, message: 'A conexão administrativa foi reativada sem executar sincronização externa.', sourceAction: action });
  } else if (action === 'integration.connection.fail') {
    const integration = (state.integrations || []).find(item => item.id === payload.id);
    if (!integration?.configured) throw new Error('Integração não configurada.');
    integration.connected = false;
    integration.status = 'failed';
    integration.lastFailureAt = new Date().toISOString();
    integration.lastError = normalizeText(payload.error, 300) || 'Falha de conexão registrada.';
    recordIntegrationEvent(state, integration, actor, action, 'failed', `${integration.name}: ${integration.lastError}`);
    createNotification(state, { category: 'integrations', title: `Falha em ${integration.name}`, message: integration.lastError, sourceAction: action });
  } else if (action === 'integration.toggle') {
    const integration = (state.integrations || []).find(item => item.id === payload.id);
    if (!integration?.configured) throw new Error('Configure a integração antes de ativá-la.');
    integration.connected = !integration.connected;
    integration.status = integration.connected ? 'active' : 'disconnected';
    if (integration.connected) integration.lastConnectionAt = new Date().toISOString();
    recordIntegrationEvent(state, integration, actor, action, integration.status, `${integration.name} ${integration.connected ? 'reativada no LIFEOS' : 'desconectada administrativamente'}; nenhuma sincronização externa foi executada.`);
  } else if (action === 'device.revoke') {
    const device = state.devices.find(d => d.id === payload.id);
    if (!device || device.current) throw new Error('Dispositivo atual não pode ser revogado.');
    state.devices = state.devices.filter(d => d.id !== payload.id);
    audit(state, actor, action, String(payload.id), `Dispositivo ${device.name} revogado.`);
    createNotification(state, { category: 'security', title: 'Sessão revogada', message: `A sessão de ${device.name} foi revogada.`, sourceAction: action });
  } else if (action === 'policy.update') {
    state.policies = { ...state.policies, ...payload, updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'security-policy', 'Políticas de segurança atualizadas.');
  } else if (action === 'intelligence.resolve') {
    const insight = state.intelligence.find(i => i.id === payload.id);
    if (!insight) throw new Error('Insight não encontrado.');
    insight.status = payload.status === 'dismissed' ? 'dismissed' : 'executed';
    insight.resolvedAt = new Date().toISOString();
    audit(state, actor, action, String(payload.id), `Insight "${insight.title}" tratado.`);
  } else if (action === 'system.refresh') {
    state.system = {
      ...state.system,
      status: 'not_monitored',
      lastCheckedAt: new Date().toISOString(),
      telemetryAvailable: false,
      telemetryReason: 'Telemetria de infraestrutura não configurada.',
      uptime: null,
      apiP95: null,
      errorRate: null,
      activeSessions: null,
      activeMembers: state.members.filter(member => member.status === 'active').length,
      cpu: null,
      memory: null,
      disk: null,
      network: null,
      healthScore: null,
    };
    audit(state, actor, action, 'system', 'Disponibilidade da telemetria verificada; métricas de infraestrutura não configuradas.');
  } else if (action === 'org.update' || action === 'organization.update') {
    const name = normalizeText(payload.name, 120);
    const domain = normalizeText(payload.domain, 120);
    if (name) state.organization.name = name;
    if (domain) state.organization.domain = domain;
    if (payload.industry) state.organization.industry = normalizeText(payload.industry, 80);
    if (payload.size) state.organization.size = normalizeText(payload.size, 20);
    state.organization.updatedAt = new Date().toISOString();
    audit(state, actor, action, 'organization', `Organização atualizada: ${state.organization.name}.`);
  } else if (action === 'member.suspend') {
    const member = state.members.find(m => m.id === payload.id);
    if (!member) throw new Error('Membro não encontrado.');
    member.status = member.status === 'suspended' ? 'active' : 'suspended';
    audit(state, actor, action, member.id, `Membro ${member.email} ${member.status === 'suspended' ? 'suspenso' : 'reativado'}.`);
    createNotification(state, { category: 'people', title: member.status === 'suspended' ? 'Membro suspenso' : 'Membro reativado', message: `${member.name} foi ${member.status === 'suspended' ? 'suspenso' : 'reativado'} na organização.`, sourceAction: action });
  } else if (action === 'workspace.create') {
    if (!Array.isArray(state.workspaces)) state.workspaces = [];
    const name = normalizeText(payload.name, 120);
    if (!name) throw new Error('Nome do workspace é obrigatório.');
    const actorMember = (state.members || []).find(member => member.email === actor || member.id === actor);
    const now = new Date().toISOString();
    const workspace = {
      id: 'ws_' + Date.now(),
      name,
      type: ['strategy', 'operations', 'product', 'engineering', 'general'].includes(payload.type) ? payload.type : 'general',
      description: normalizeText(payload.description, 300),
      status: 'active',
      members: actorMember ? [actorMember.id] : [],
      preferences: { notifications: true, defaultView: 'overview' },
      activity: [],
      protected: false,
      createdAt: now,
      updatedAt: now,
    };
    state.workspaces.push(workspace);
    recordWorkspaceActivity(state, workspace, actor, action, `Workspace "${workspace.name}" criado.`);
    createNotification(state, { category: 'workspaces', title: 'Workspace criado', message: `O workspace "${workspace.name}" está disponível para a organização.`, sourceAction: action });
  } else if (action === 'workspace.update') {
    const workspace = (state.workspaces || []).find(item => item.id === payload.id);
    if (!workspace) throw new Error('Workspace não encontrado.');
    const name = normalizeText(payload.name, 120);
    if (name) workspace.name = name;
    if (typeof payload.description === 'string') workspace.description = normalizeText(payload.description, 300);
    if (['active', 'archived'].includes(payload.status)) workspace.status = payload.status;
    if (payload.preferences && typeof payload.preferences === 'object') {
      const defaultView = ['overview', 'members', 'activity', 'preferences'].includes(payload.preferences.defaultView) ? payload.preferences.defaultView : (workspace.preferences?.defaultView || 'overview');
      workspace.preferences = { notifications: payload.preferences.notifications !== false, defaultView };
    }
    recordWorkspaceActivity(state, workspace, actor, action, `Workspace "${workspace.name}" atualizado.`);
  } else if (action === 'workspace.member.add') {
    const workspace = (state.workspaces || []).find(item => item.id === payload.id);
    const member = (state.members || []).find(item => item.id === payload.memberId);
    if (!workspace || !member) throw new Error('Workspace ou membro não encontrado.');
    if (!Array.isArray(workspace.members)) workspace.members = [];
    if (!workspace.members.includes(member.id)) workspace.members.push(member.id);
    recordWorkspaceActivity(state, workspace, actor, action, `${member.name} adicionado ao workspace.`);
    createNotification(state, { category: 'workspaces', title: 'Membro adicionado ao workspace', message: `${member.name} foi adicionado a "${workspace.name}".`, sourceAction: action });
  } else if (action === 'workspace.member.remove') {
    const workspace = (state.workspaces || []).find(item => item.id === payload.id);
    const member = (state.members || []).find(item => item.id === payload.memberId);
    if (!workspace || !member) throw new Error('Workspace ou membro não encontrado.');
    if ((workspace.members || []).length <= 1) throw new Error('O workspace deve manter ao menos um membro.');
    workspace.members = workspace.members.filter(memberId => memberId !== member.id);
    recordWorkspaceActivity(state, workspace, actor, action, `${member.name} removido do workspace.`);
    createNotification(state, { category: 'workspaces', title: 'Membro removido do workspace', message: `${member.name} foi removido de "${workspace.name}".`, sourceAction: action });
  } else if (action === 'workspace.delete') {
    const workspace = (state.workspaces || []).find(item => item.id === payload.id);
    if (!workspace) throw new Error('Workspace não encontrado.');
    if (workspace.protected) throw new Error('Este workspace é protegido e não pode ser excluído.');
    if (normalizeText(payload.confirmName, 120) !== workspace.name) throw new Error('Digite o nome exato do workspace para confirmar.');
    if ((state.workspaces || []).length <= 1) throw new Error('A organização deve manter ao menos um workspace.');
    state.workspaces = state.workspaces.filter(item => item.id !== workspace.id);
    audit(state, actor, action, workspace.id, `Workspace "${workspace.name}" excluído.`);
    createNotification(state, { category: 'workspaces', title: 'Workspace excluído', message: `O workspace "${workspace.name}" foi excluído.`, sourceAction: action });
  } else if (action === 'notification.read') {
    if (!state.notifications) state.notifications = [];
    const notif = state.notifications.find(n => n.id === payload.id);
    if (!notif) throw new Error('Notificação não encontrada.');
    notif.read = true;
    notif.readAt = new Date().toISOString();
    audit(state, actor, action, String(payload.id), 'Notificação marcada como lida.');
  } else if (action === 'notifications.markAll') {
    if (!state.notifications) state.notifications = [];
    const readAt = new Date().toISOString();
    state.notifications.forEach(n => { n.read = true; n.readAt = n.readAt || readAt; });
    audit(state, actor, action, 'notifications', 'Todas as notificações marcadas como lidas.');
  } else if (action === 'notifications.preferences.update') {
    const categories = ['security', 'billing', 'people', 'workspaces', 'integrations', 'intelligence', 'system'];
    state.notificationPreferences = categories.reduce((preferences, category) => {
      preferences[category] = payload.preferences?.[category] !== false;
      return preferences;
    }, {});
    audit(state, actor, action, 'notification-preferences', 'Preferências de categorias de notificação atualizadas.');
    createNotification(state, { category: 'system', title: 'Preferências atualizadas', message: 'As categorias da Central de Notificações foram atualizadas.', sourceAction: action });
  } else if (action === 'mfa.update') {
    if (!state.mfa) state.mfa = {};
    state.mfa = { ...state.mfa, ...payload, updatedAt: new Date().toISOString() };
    audit(state, actor, action, 'mfa', 'Configurações de MFA atualizadas.');
  } else {
    // Graceful fallback — log and return current state without error
    audit(state, actor, action, 'system', `Ação "${action}" registrada.`);
  }
}

export async function onRequest({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Autenticação ainda não configurada.' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Sessão administrativa necessária.' });

  const method = request.method;
  if (!['GET', 'POST'].includes(method)) {
    return json(405, { ok: false, error: 'Método não permitido.' }, { allow: 'GET, POST' });
  }

  const kv = env.LIFEOS_KV || null;

  try {
    const state = await loadState(kv);
    if (method === 'GET') return json(200, { ok: true, data: state });

    const input = await request.json();
    applyAction(state, String(input.action || ''), input.payload || {}, session.sub);
    await saveState(kv, state);
    return json(200, { ok: true, data: state });
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : 'Falha ao processar a solicitação.' });
  }
}
