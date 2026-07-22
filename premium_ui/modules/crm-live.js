/* LifeOS Enterprise — CRM UI v48.0.0
 * Superfícies CRM carregadas pelo módulo de produtividade.
 * Todas as leituras e mutações utilizam /api/crm, sem dados locais simulados.
 */
(() => {
  'use strict';
  if (window.LifeOSCRM) return;

  const state = {
    data: null,
    loading: false,
    clientQuery: '',
    clientStatus: '',
    agendaType: '',
    agendaStatus: '',
  };

  const roleCapabilities = {
    owner: { write: true, remove: true, workspace: true },
    admin: { write: true, remove: true, workspace: true },
    manager: { write: true, remove: true, workspace: true },
    employee: { write: true, remove: false, workspace: false },
    guest: { write: false, remove: false, workspace: false },
  };

  const statusLabels = { lead: 'Lead', prospect: 'Prospect', customer: 'Cliente', inactive: 'Inativo' };
  const typeLabels = { meeting: 'Reunião', task: 'Tarefa', followup: 'Follow-up', reminder: 'Lembrete' };
  const agendaStatusLabels = { scheduled: 'Agendado', completed: 'Concluído', cancelled: 'Cancelado' };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

  function money(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  function shortDate(value) {
    if (!value) return '—';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  function dateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return shortDate(value);
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  function capabilities() {
    return roleCapabilities[state.data?.membership?.role] || roleCapabilities.guest;
  }

  function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
  }

  function icons() {
    try { window.lucide?.createIcons?.(); } catch (_) { /* ícones não impedem interação */ }
  }

  function selectedContext() {
    return { orgId: state.data?.organization?.id || '', workspaceId: state.data?.workspace?.id || '' };
  }

  async function request(action, payload = {}) {
    const response = await fetch('/api/crm', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
    state.data = result.data;
    renderAll();
    return result.data;
  }

  async function load(context = {}) {
    state.loading = true;
    renderAll();
    const params = new URLSearchParams();
    if (context.orgId) params.set('orgId', context.orgId);
    if (context.workspaceId) params.set('workspaceId', context.workspaceId);
    try {
      const response = await fetch(`/api/crm${params.toString() ? `?${params}` : ''}`, { credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível carregar o CRM.');
      state.data = result.data;
    } catch (error) {
      state.data = { error: error.message, organizations: [], contacts: [], deals: [], agenda: [], history: [], stages: [], metrics: {} };
    } finally {
      state.loading = false;
      renderAll();
    }
  }

  function optionList(items, valueKey, label, selected, blankLabel = '') {
    const blank = blankLabel ? `<option value="">${escapeHtml(blankLabel)}</option>` : '';
    return `${blank}${(items || []).map((item) => `<option value="${escapeAttr(item[valueKey])}" ${String(item[valueKey]) === String(selected || '') ? 'selected' : ''}>${escapeHtml(label(item))}</option>`).join('')}`;
  }

  function scopeBar() {
    const data = state.data;
    if (!data?.organization) return '';
    const organizations = data.organizations || [];
    const workspaceOptions = data.workspaces || (data.workspace ? [data.workspace] : []);
    return `<div class="card" style="padding:12px 14px;margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;gap:10px">
      <div style="font-size:12px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em">Escopo comercial</div>
      <select id="crm-org-select" class="form-input" style="width:auto;min-width:190px" aria-label="Organização">
        ${optionList(organizations, 'id', (organization) => `${organization.name} · ${organization.role}`, data.organization.id)}
      </select>
      <select id="crm-workspace-select" class="form-input" style="width:auto;min-width:190px" aria-label="Workspace">
        ${optionList(workspaceOptions, 'id', (workspace) => workspace.name, data.workspace?.id)}
      </select>
      ${capabilities().workspace ? '<button id="crm-new-workspace" class="btn btn-ghost" style="margin-left:auto"><i data-lucide="plus" class="pg-icon" aria-hidden="true"></i> Workspace</button>' : ''}
    </div>`;
  }

  function emptyState(title, copy, actionLabel, action) {
    return `<div style="padding:34px 18px;text-align:center;color:var(--text-muted)">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:6px">${escapeHtml(title)}</div>
      <div style="font-size:13px;max-width:430px;margin:0 auto 16px">${escapeHtml(copy)}</div>
      ${actionLabel && capabilities().write ? `<button class="btn btn-primary" data-action="${escapeAttr(action)}"><i data-lucide="plus" class="pg-icon" aria-hidden="true"></i> ${escapeHtml(actionLabel)}</button>` : ''}
    </div>`;
  }

  function loadingView() {
    return '<div class="card" style="padding:28px;color:var(--text-muted);font-size:13px">Carregando dados reais do CRM…</div>';
  }

  function errorView() {
    return `<div class="card" style="padding:28px;border-color:rgba(239,68,68,.45)"><div style="font-weight:700;color:var(--red);margin-bottom:8px">CRM indisponível</div><div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">${escapeHtml(state.data?.error || 'Não foi possível carregar os dados comerciais.')}</div><button id="crm-retry" class="btn btn-ghost">Tentar novamente</button></div>`;
  }

  function onboardingView() {
    return `<div class="page-header"><div><div class="page-title"><i data-lucide="building-2" class="pg-icon" aria-hidden="true"></i> CRM Enterprise</div><div class="page-subtitle">Crie uma organização para iniciar o espaço comercial colaborativo.</div></div></div>
      <div class="card" style="max-width:700px;padding:28px"><div style="font-size:18px;font-weight:800;margin-bottom:8px">Seu CRM está pronto para uma organização real</div><p style="margin:0 0 18px;color:var(--text-secondary);font-size:13px;line-height:1.6">Clientes, oportunidades, agenda e histórico serão armazenados somente após a criação de uma organização e de seu workspace inicial.</p><button class="btn btn-primary" data-action="create-organization"><i data-lucide="plus" class="pg-icon" aria-hidden="true"></i> Criar organização</button></div>`;
  }

  function statusChip(status) {
    const colors = { lead: ['rgba(99,102,241,.15)', 'var(--accent)'], prospect: ['rgba(245,158,11,.15)', 'var(--amber)'], customer: ['rgba(16,185,129,.15)', 'var(--green)'], inactive: ['rgba(148,163,184,.15)', 'var(--text-muted)'] };
    const [background, color] = colors[status] || colors.lead;
    return `<span style="background:${background};color:${color};padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">${escapeHtml(statusLabels[status] || status)}</span>`;
  }

  function clientRows() {
    const contacts = (state.data?.contacts || []).filter((contact) => {
      const query = state.clientQuery.trim().toLowerCase();
      const matchesQuery = !query || [contact.name, contact.email, contact.company, ...(contact.tags || [])].join(' ').toLowerCase().includes(query);
      return matchesQuery && (!state.clientStatus || contact.status === state.clientStatus);
    });
    if (!contacts.length) return `<tr><td colspan="6">${emptyState('Nenhum cliente encontrado', state.clientQuery || state.clientStatus ? 'Ajuste os filtros para ver os registros cadastrados.' : 'Cadastre o primeiro cliente para iniciar seu histórico comercial.', 'Novo cliente', 'new-contact')}</td></tr>`;
    return contacts.map((contact) => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 8px"><div style="font-weight:700">${escapeHtml(contact.name)}</div><div style="font-size:11px;color:var(--text-muted)">${escapeHtml(contact.email || 'Sem e-mail')}</div></td>
      <td style="padding:10px 8px;font-size:13px">${escapeHtml(contact.company || '—')}</td>
      <td style="padding:10px 8px">${statusChip(contact.status)}</td>
      <td style="padding:10px 8px;font-size:13px;font-weight:700;color:var(--green)">${money(contact.value)}</td>
      <td style="padding:10px 8px;font-size:12px;color:var(--text-muted)">${shortDate(contact.lastContactAt)}</td>
      <td style="padding:10px 8px;white-space:nowrap"><button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" data-action="view-contact" data-id="${escapeAttr(contact.id)}">Ver</button>${capabilities().remove ? `<button class="btn btn-ghost" style="font-size:11px;padding:4px 8px;color:var(--red)" data-action="delete-contact" data-id="${escapeAttr(contact.id)}" aria-label="Excluir ${escapeAttr(contact.name)}">Excluir</button>` : ''}</td>
    </tr>`).join('');
  }

  function historyRows() {
    const history = (state.data?.history || []).slice(0, 8);
    if (!history.length) return '<div style="font-size:13px;color:var(--text-muted);padding:8px 0">O histórico será registrado a cada ação comercial.</div>';
    return history.map((item) => `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)"><div style="width:7px;height:7px;background:var(--accent);border-radius:50%;margin-top:6px;flex:none"></div><div style="min-width:0"><div style="font-size:12px;color:var(--text-primary)">${escapeHtml(item.detail)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:3px">${escapeHtml(item.actor || 'Sistema')} · ${dateTime(item.createdAt)}</div></div></div>`).join('');
  }

  function renderClients() {
    const root = document.getElementById('crm-client-view');
    if (!root) return;
    if (state.loading && !state.data) { root.innerHTML = loadingView(); return; }
    if (state.data?.error) { root.innerHTML = errorView(); bindPageEvents(); return; }
    if (!state.data?.organization) { root.innerHTML = onboardingView(); bindPageEvents(); icons(); return; }
    const metrics = state.data.metrics || {};
    root.innerHTML = `${scopeBar()}
      <div class="page-header"><div><div class="page-title"><i data-lucide="users-round" class="pg-icon" aria-hidden="true"></i> CRM</div><div class="page-subtitle">Clientes, histórico e relacionamento comercial de ${escapeHtml(state.data.organization.name)}</div></div><div style="display:flex;gap:8px"><button class="btn btn-ghost" data-action="show-agenda"><i data-lucide="calendar-days" class="pg-icon" aria-hidden="true"></i> Agenda</button><button class="btn btn-ghost" data-action="show-pipeline">Pipeline</button>${capabilities().write ? '<button class="btn btn-primary" data-action="new-contact"><i data-lucide="plus" class="pg-icon" aria-hidden="true"></i> Cliente</button>' : ''}</div></div>
      <div class="grid-4" style="margin-bottom:20px">
        <div class="card kpi-card"><div class="kpi-icon" style="background:rgba(99,102,241,.15);color:var(--accent)"><i data-lucide="users-round" class="pg-icon"></i></div><div class="kpi-value">${metrics.contactCount || 0}</div><div class="kpi-label">Clientes</div></div>
        <div class="card kpi-card"><div class="kpi-icon" style="background:rgba(16,185,129,.15);color:var(--green)"><i data-lucide="briefcase-business" class="pg-icon"></i></div><div class="kpi-value">${metrics.opportunityCount || 0}</div><div class="kpi-label">Oportunidades</div></div>
        <div class="card kpi-card"><div class="kpi-icon" style="background:rgba(245,158,11,.15);color:var(--amber)"><i data-lucide="wallet-cards" class="pg-icon"></i></div><div class="kpi-value" style="font-size:18px">${money(metrics.pipelineTotal)}</div><div class="kpi-label">Pipeline aberto</div></div>
        <div class="card kpi-card"><div class="kpi-icon" style="background:rgba(16,185,129,.15);color:var(--green)"><i data-lucide="trophy" class="pg-icon"></i></div><div class="kpi-value" style="font-size:18px">${money(metrics.wonTotal)}</div><div class="kpi-label">Fechado ganho</div></div>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:start">
        <div class="card"><div style="display:flex;gap:8px;margin-bottom:16px"><input id="crm-client-query" type="search" class="form-input" placeholder="Pesquisar por nome, empresa, e-mail ou etiqueta" style="flex:1" value="${escapeAttr(state.clientQuery)}"><select id="crm-client-status" class="form-input" style="width:auto"><option value="">Todos os status</option>${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${state.clientStatus === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:720px"><thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Cliente</th><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Empresa</th><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Status</th><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Valor</th><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Último contato</th><th style="padding:8px"></th></tr></thead><tbody>${clientRows()}</tbody></table></div></div>
        <aside class="card" style="padding:16px"><div style="font-weight:800;font-size:14px;margin-bottom:8px"><i data-lucide="history" class="pg-icon" aria-hidden="true"></i> Histórico comercial</div>${historyRows()}</aside>
      </div>`;
    bindPageEvents();
    icons();
  }

  function dealCard(deal, stage) {
    const contact = (state.data.contacts || []).find((item) => item.id === deal.contactId);
    const person = (state.data.members || []).find((member) => member.userId === deal.responsibleId || member.email === deal.responsibleId);
    return `<article class="kanban-card" draggable="${capabilities().write ? 'true' : 'false'}" data-deal-id="${escapeAttr(deal.id)}" style="cursor:${capabilities().write ? 'grab' : 'pointer'};margin-bottom:9px" data-action="view-deal" aria-label="Oportunidade ${escapeAttr(deal.title)}"><div class="kanban-card-title">${escapeHtml(deal.title)}</div><div style="font-size:12px;color:var(--green);font-weight:700;margin:6px 0">${money(deal.value)}</div>${contact ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${escapeHtml(contact.name)}</div>` : ''}<div class="kanban-card-footer"><span style="font-size:11px;color:var(--text-muted);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(person?.name || deal.responsibleId || 'Sem responsável')}</span><span style="font-size:11px;color:var(--text-muted)">${Number(deal.probability || stage.probability)}%</span></div>${deal.expectedDate ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Previsão: ${shortDate(deal.expectedDate)}</div>` : ''}</article>`;
  }

  function renderPipeline() {
    const root = document.getElementById('crm-pipeline-view');
    if (!root) return;
    if (state.loading && !state.data) { root.innerHTML = loadingView(); return; }
    if (state.data?.error) { root.innerHTML = errorView(); bindPageEvents(); return; }
    if (!state.data?.organization) { root.innerHTML = onboardingView(); bindPageEvents(); icons(); return; }
    const stages = state.data.stages || [];
    root.innerHTML = `${scopeBar()}<div class="page-header"><div><div class="page-title"><i data-lucide="briefcase-business" class="pg-icon" aria-hidden="true"></i> Pipeline de Vendas</div><div class="page-subtitle">Arraste uma oportunidade entre os estágios para atualizar o pipeline.</div></div><div style="display:flex;gap:8px"><button class="btn btn-ghost" data-action="show-crm"><i data-lucide="arrow-left" class="pg-icon"></i> CRM</button><button class="btn btn-ghost" data-action="show-agenda"><i data-lucide="calendar-days" class="pg-icon"></i> Agenda</button>${capabilities().write ? '<button class="btn btn-primary" data-action="new-deal"><i data-lucide="plus" class="pg-icon"></i> Oportunidade</button>' : ''}</div></div><div style="display:grid;grid-template-columns:repeat(${Math.max(stages.length, 1)},minmax(235px,1fr));gap:10px;min-height:calc(100vh - 240px);overflow-x:auto;padding-bottom:4px">${stages.map((stage) => { const deals = (state.data.deals || []).filter((deal) => deal.stage === stage.id); return `<section class="kanban-col" data-stage-id="${escapeAttr(stage.id)}" style="min-width:235px"><div class="kanban-col-header" style="border-top-color:${escapeAttr(stage.color)}"><span>${escapeHtml(stage.name)}</span><span class="kanban-count">${deals.length}</span></div><div class="kanban-cards crm-dropzone" data-stage-id="${escapeAttr(stage.id)}" style="min-height:170px">${deals.map((deal) => dealCard(deal, stage)).join('') || `<div style="font-size:12px;color:var(--text-muted);padding:12px 2px">Sem oportunidades</div>`}</div>${capabilities().write ? `<button class="kanban-add-btn" data-action="new-deal" data-stage="${escapeAttr(stage.id)}"><i data-lucide="plus" class="pg-icon"></i> Adicionar</button>` : ''}</section>`; }).join('')}</div>`;
    bindPageEvents();
    bindPipelineDnd();
    icons();
  }

  function agendaRows() {
    const items = (state.data?.agenda || []).filter((item) => (!state.agendaType || item.type === state.agendaType) && (!state.agendaStatus || item.status === state.agendaStatus));
    if (!items.length) return `<tr><td colspan="7">${emptyState('Nenhum compromisso comercial', 'Reuniões, tarefas, follow-ups e lembretes aparecerão aqui quando forem cadastrados.', 'Novo compromisso', 'new-agenda')}</td></tr>`;
    return items.map((item) => {
      const contact = (state.data.contacts || []).find((entry) => entry.id === item.contactId);
      return `<tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 8px"><div style="font-weight:700">${escapeHtml(item.title)}</div><div style="font-size:11px;color:var(--text-muted)">${escapeHtml(contact?.name || 'Sem cliente vinculado')}</div></td><td style="padding:10px 8px;font-size:12px">${escapeHtml(typeLabels[item.type] || item.type)}</td><td style="padding:10px 8px;font-size:12px">${shortDate(item.date)}${item.time ? `<div style="font-size:11px;color:var(--text-muted)">${escapeHtml(item.time)}</div>` : ''}</td><td style="padding:10px 8px;font-size:12px">${escapeHtml(agendaStatusLabels[item.status] || item.status)}</td><td style="padding:10px 8px;font-size:12px;color:var(--text-muted)">${item.reminderAt ? escapeHtml(item.reminderAt) : '—'}</td><td style="padding:10px 8px;white-space:nowrap">${capabilities().write ? `<button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" data-action="view-agenda" data-id="${escapeAttr(item.id)}">Editar</button>${item.status === 'scheduled' ? `<button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" data-action="complete-agenda" data-id="${escapeAttr(item.id)}">Concluir</button>` : ''}` : '<span style="font-size:11px;color:var(--text-muted)">Somente leitura</span>'}${capabilities().remove ? `<button class="btn btn-ghost" style="font-size:11px;padding:4px 8px;color:var(--red)" data-action="delete-agenda" data-id="${escapeAttr(item.id)}">Excluir</button>` : ''}</td></tr>`;
    }).join('');
  }

  function renderAgenda() {
    const root = document.getElementById('crm-agenda-view');
    if (!root) return;
    if (state.loading && !state.data) { root.innerHTML = loadingView(); return; }
    if (state.data?.error) { root.innerHTML = errorView(); bindPageEvents(); return; }
    if (!state.data?.organization) { root.innerHTML = onboardingView(); bindPageEvents(); icons(); return; }
    root.innerHTML = `${scopeBar()}<div class="page-header"><div><div class="page-title"><i data-lucide="calendar-days" class="pg-icon"></i> Agenda Comercial</div><div class="page-subtitle">Reuniões, tarefas, follow-ups e lembretes vinculados ao CRM.</div></div><div style="display:flex;gap:8px"><button class="btn btn-ghost" data-action="show-crm"><i data-lucide="arrow-left" class="pg-icon"></i> CRM</button><button class="btn btn-ghost" data-action="show-pipeline">Pipeline</button>${capabilities().write ? '<button class="btn btn-primary" data-action="new-agenda"><i data-lucide="plus" class="pg-icon"></i> Compromisso</button>' : ''}</div></div><div class="card"><div style="display:flex;gap:8px;margin-bottom:16px"><select id="crm-agenda-type" class="form-input" style="width:auto"><option value="">Todos os tipos</option>${Object.entries(typeLabels).map(([value, label]) => `<option value="${value}" ${state.agendaType === value ? 'selected' : ''}>${label}</option>`).join('')}</select><select id="crm-agenda-status" class="form-input" style="width:auto"><option value="">Todos os status</option>${Object.entries(agendaStatusLabels).map(([value, label]) => `<option value="${value}" ${state.agendaStatus === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:760px"><thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Compromisso</th><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Tipo</th><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Data</th><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Status</th><th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted)">Lembrete</th><th style="padding:8px"></th></tr></thead><tbody>${agendaRows()}</tbody></table></div></div>`;
    bindPageEvents();
    icons();
  }

  function renderAll() { renderClients(); renderPipeline(); renderAgenda(); }

  function modal(title, content, onReady) {
    document.getElementById('crm-dialog')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'crm-dialog';
    overlay.className = 'modal-overlay active';
    overlay.style.cssText = 'display:flex;position:fixed;inset:0;z-index:10020;align-items:center;justify-content:center;background:rgba(2,6,23,.72);padding:18px;overflow:auto';
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}" style="display:block;width:min(720px,100%);max-height:calc(100vh - 36px);overflow:auto;background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:20px;box-shadow:0 24px 64px rgba(0,0,0,.45)"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px"><div style="font-size:18px;font-weight:800">${escapeHtml(title)}</div><button type="button" class="btn btn-ghost" style="padding:4px 8px" data-dialog-close aria-label="Fechar">×</button></div>${content}</div>`;
    overlay.addEventListener('click', (event) => { if (event.target === overlay || event.target.closest('[data-dialog-close]')) overlay.remove(); });
    document.body.appendChild(overlay);
    onReady?.(overlay);
    icons();
    return overlay;
  }

  function field(label, name, value = '', options = {}) {
    const type = options.type || 'text';
    const required = options.required ? 'required' : '';
    const rows = options.rows || 4;
    if (type === 'textarea') return `<label style="display:block;font-size:12px;font-weight:700;margin-bottom:12px">${escapeHtml(label)}<textarea class="form-input" name="${escapeAttr(name)}" rows="${rows}" style="margin-top:6px;resize:vertical" ${required}>${escapeHtml(value || '')}</textarea></label>`;
    if (type === 'select') return `<label style="display:block;font-size:12px;font-weight:700;margin-bottom:12px">${escapeHtml(label)}<select class="form-input" name="${escapeAttr(name)}" style="margin-top:6px" ${required}>${options.items.map((item) => `<option value="${escapeAttr(item.value)}" ${String(item.value) === String(value ?? '') ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label>`;
    return `<label style="display:block;font-size:12px;font-weight:700;margin-bottom:12px">${escapeHtml(label)}<input class="form-input" name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${escapeAttr(value || '')}" style="margin-top:6px" ${required}></label>`;
  }

  function tagField(value) { return field('Etiquetas (separadas por vírgula)', 'tags', (value || []).join(', ')); }
  function parseTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
  function formValue(form, name) { return new FormData(form).get(name); }

  function contactForm(contact = null) {
    const item = contact || {};
    return `<form id="crm-contact-form"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${field('Nome', 'name', item.name, { required: true })}${field('E-mail', 'email', item.email, { type: 'email' })}${field('Telefone', 'phone', item.phone)}${field('Empresa', 'company', item.company)}${field('Cargo', 'position', item.position)}${field('Status', 'status', item.status || 'lead', { type: 'select', items: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) })}${field('Valor potencial', 'value', item.value || 0, { type: 'number' })}${field('Último contato', 'lastContactAt', item.lastContactAt, { type: 'date' })}</div>${tagField(item.tags)}${field('Observações', 'notes', item.notes, { type: 'textarea' })}<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button><button class="btn btn-primary" type="submit">${contact ? 'Salvar alterações' : 'Cadastrar cliente'}</button></div></form>`;
  }

  function openContact(contact = null) {
    if (!capabilities().write && !contact) return;
    const canEdit = capabilities().write;
    const histories = contact ? (state.data.history || []).filter((history) => history.entity === 'contact' && history.entityId === contact.id).slice(0, 12) : [];
    const body = canEdit ? contactForm(contact) : `<div style="font-size:13px;line-height:1.7;color:var(--text-secondary)"><div><strong>Empresa:</strong> ${escapeHtml(contact?.company || '—')}</div><div><strong>E-mail:</strong> ${escapeHtml(contact?.email || '—')}</div><div><strong>Telefone:</strong> ${escapeHtml(contact?.phone || '—')}</div><div style="margin-top:12px"><strong>Observações:</strong><br>${escapeHtml(contact?.notes || 'Sem observações.')}</div></div>`;
    const historyHtml = contact ? `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)"><div style="font-size:13px;font-weight:800;margin-bottom:8px">Histórico do cliente</div>${histories.length ? histories.map((history) => `<div style="font-size:12px;padding:7px 0;border-bottom:1px solid var(--border)">${escapeHtml(history.detail)}<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(history.actor)} · ${dateTime(history.createdAt)}</div></div>`).join('') : '<div style="font-size:12px;color:var(--text-muted)">Ainda não há eventos para este cliente.</div>'}${canEdit ? `<form id="crm-history-form" style="display:flex;gap:8px;margin-top:12px"><input class="form-input" name="detail" required placeholder="Registrar uma interação"><button class="btn btn-ghost" type="submit">Adicionar</button></form>` : ''}</div>` : '';
    const overlay = modal(contact ? `Cliente: ${contact.name}` : 'Novo cliente', `${body}${historyHtml}`);
    const form = overlay.querySelector('#crm-contact-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = { ...selectedContext(), id: contact?.id, name: formValue(form, 'name'), email: formValue(form, 'email'), phone: formValue(form, 'phone'), company: formValue(form, 'company'), position: formValue(form, 'position'), status: formValue(form, 'status'), value: Number(formValue(form, 'value') || 0), lastContactAt: formValue(form, 'lastContactAt'), tags: parseTags(formValue(form, 'tags')), notes: formValue(form, 'notes') };
      try { await request(contact ? 'contact.update' : 'contact.create', payload); overlay.remove(); toast(contact ? 'Cliente atualizado.' : 'Cliente cadastrado.', 'success'); } catch (error) { toast(error.message, 'error'); }
    });
    const historyForm = overlay.querySelector('#crm-history-form');
    historyForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try { await request('history.create', { ...selectedContext(), entity: 'contact', entityId: contact.id, detail: formValue(historyForm, 'detail') }); overlay.remove(); openContact((state.data.contacts || []).find((item) => item.id === contact.id)); toast('Histórico registrado.', 'success'); } catch (error) { toast(error.message, 'error'); }
    });
  }

  function dealForm(deal = null, stageHint = '') {
    const item = deal || { stage: stageHint || 'lead', probability: '' };
    const stageOptions = (state.data.stages || []).map((stage) => ({ value: stage.id, label: `${stage.name} (${stage.probability}%)` }));
    const contactOptions = [{ value: '', label: 'Sem cliente vinculado' }, ...(state.data.contacts || []).map((contact) => ({ value: contact.id, label: `${contact.name}${contact.company ? ` — ${contact.company}` : ''}` }))];
    const memberOptions = (state.data.members || []).map((member) => ({ value: member.userId, label: `${member.name} · ${member.role}` }));
    return `<form id="crm-deal-form"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${field('Título da oportunidade', 'title', item.title, { required: true })}${field('Cliente vinculado', 'contactId', item.contactId, { type: 'select', items: contactOptions })}${field('Empresa', 'company', item.company)}${field('Estágio', 'stage', item.stage, { type: 'select', items: stageOptions })}${field('Probabilidade (%)', 'probability', item.probability, { type: 'number' })}${field('Valor', 'value', item.value || 0, { type: 'number' })}${field('Responsável', 'responsibleId', item.responsibleId || state.data.members?.[0]?.userId || '', { type: 'select', items: memberOptions })}${field('Data prevista', 'expectedDate', item.expectedDate, { type: 'date' })}</div>${tagField(item.tags)}${field('Descrição', 'description', item.description, { type: 'textarea' })}<div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button><button class="btn btn-primary" type="submit">${deal ? 'Salvar alterações' : 'Criar oportunidade'}</button></div></form>`;
  }

  function openDeal(deal = null, stageHint = '') {
    if (!capabilities().write && !deal) return;
    const canEdit = capabilities().write;
    const readOnly = deal && !canEdit;
    const body = readOnly ? `<div style="font-size:13px;line-height:1.7;color:var(--text-secondary)"><div><strong>Estágio:</strong> ${escapeHtml((state.data.stages || []).find((stage) => stage.id === deal.stage)?.name || deal.stage)}</div><div><strong>Valor:</strong> ${money(deal.value)}</div><div><strong>Probabilidade:</strong> ${Number(deal.probability || 0)}%</div><div><strong>Data prevista:</strong> ${shortDate(deal.expectedDate)}</div><div style="margin-top:12px"><strong>Descrição:</strong><br>${escapeHtml(deal.description || 'Sem descrição.')}</div></div>` : dealForm(deal, stageHint);
    const overlay = modal(deal ? `Oportunidade: ${deal.title}` : 'Nova oportunidade', body);
    const form = overlay.querySelector('#crm-deal-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = { ...selectedContext(), id: deal?.id, title: formValue(form, 'title'), contactId: formValue(form, 'contactId'), company: formValue(form, 'company'), stage: formValue(form, 'stage'), probability: Number(formValue(form, 'probability') || 0), value: Number(formValue(form, 'value') || 0), responsibleId: formValue(form, 'responsibleId'), expectedDate: formValue(form, 'expectedDate'), tags: parseTags(formValue(form, 'tags')), description: formValue(form, 'description') };
      try { await request(deal ? 'deal.update' : 'deal.create', payload); overlay.remove(); toast(deal ? 'Oportunidade atualizada.' : 'Oportunidade criada.', 'success'); } catch (error) { toast(error.message, 'error'); }
    });
  }

  function agendaForm(item = null) {
    const agenda = item || { type: 'followup', status: 'scheduled', date: new Date().toISOString().slice(0, 10), responsibleId: state.data.members?.[0]?.userId || '' };
    const contacts = [{ value: '', label: 'Sem cliente vinculado' }, ...(state.data.contacts || []).map((contact) => ({ value: contact.id, label: contact.name }))];
    const deals = [{ value: '', label: 'Sem oportunidade vinculada' }, ...(state.data.deals || []).map((deal) => ({ value: deal.id, label: deal.title }))];
    const people = (state.data.members || []).map((member) => ({ value: member.userId, label: `${member.name} · ${member.role}` }));
    return `<form id="crm-agenda-form"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${field('Título', 'title', agenda.title, { required: true })}${field('Tipo', 'type', agenda.type, { type: 'select', items: Object.entries(typeLabels).map(([value, label]) => ({ value, label })) })}${field('Data', 'date', agenda.date, { type: 'date', required: true })}${field('Hora', 'time', agenda.time, { type: 'time' })}${field('Duração', 'duration', agenda.duration)}${field('Status', 'status', agenda.status, { type: 'select', items: Object.entries(agendaStatusLabels).map(([value, label]) => ({ value, label })) })}${field('Cliente vinculado', 'contactId', agenda.contactId, { type: 'select', items: contacts })}${field('Oportunidade vinculada', 'dealId', agenda.dealId, { type: 'select', items: deals })}${field('Responsável', 'responsibleId', agenda.responsibleId, { type: 'select', items: people })}${field('Lembrete', 'reminderAt', agenda.reminderAt)}</div>${tagField(agenda.tags)}${field('Local', 'location', agenda.location)}${field('Descrição', 'description', agenda.description, { type: 'textarea' })}<div style="font-size:11px;color:var(--text-muted);margin:-2px 0 14px">Reuniões são sincronizadas à agenda pessoal. Tarefas, follow-ups e lembretes são sincronizados às tarefas do responsável.</div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button><button class="btn btn-primary" type="submit">${item ? 'Salvar alterações' : 'Agendar'}</button></div></form>`;
  }

  function openAgenda(item = null) {
    if (!capabilities().write && !item) return;
    const canEdit = capabilities().write;
    const body = item && !canEdit ? `<div style="font-size:13px;line-height:1.7;color:var(--text-secondary)"><div><strong>Tipo:</strong> ${escapeHtml(typeLabels[item.type] || item.type)}</div><div><strong>Data:</strong> ${shortDate(item.date)} ${escapeHtml(item.time || '')}</div><div><strong>Status:</strong> ${escapeHtml(agendaStatusLabels[item.status] || item.status)}</div><div style="margin-top:12px"><strong>Descrição:</strong><br>${escapeHtml(item.description || 'Sem descrição.')}</div></div>` : agendaForm(item);
    const overlay = modal(item ? `Compromisso: ${item.title}` : 'Novo compromisso comercial', body);
    const form = overlay.querySelector('#crm-agenda-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = { ...selectedContext(), id: item?.id, title: formValue(form, 'title'), type: formValue(form, 'type'), date: formValue(form, 'date'), time: formValue(form, 'time'), duration: formValue(form, 'duration'), status: formValue(form, 'status'), contactId: formValue(form, 'contactId'), dealId: formValue(form, 'dealId'), responsibleId: formValue(form, 'responsibleId'), reminderAt: formValue(form, 'reminderAt'), tags: parseTags(formValue(form, 'tags')), location: formValue(form, 'location'), description: formValue(form, 'description') };
      try { await request(item ? 'agenda.update' : 'agenda.create', payload); overlay.remove(); toast(item ? 'Compromisso atualizado.' : 'Compromisso agendado e sincronizado.', 'success'); } catch (error) { toast(error.message, 'error'); }
    });
  }

  function openOrganization() {
    const overlay = modal('Criar organização', `<form id="crm-org-form">${field('Nome da organização', 'name', '', { required: true })}${field('Descrição', 'description', '', { type: 'textarea' })}<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-ghost" type="button" data-dialog-close>Cancelar</button><button class="btn btn-primary" type="submit">Criar organização</button></div></form>`);
    overlay.querySelector('#crm-org-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try { await request('organization.create', { name: formValue(form, 'name'), description: formValue(form, 'description') }); overlay.remove(); toast('Organização e workspace inicial criados.', 'success'); } catch (error) { toast(error.message, 'error'); }
    });
  }

  function openWorkspace() {
    const overlay = modal('Novo workspace', `<form id="crm-workspace-form">${field('Nome do workspace', 'name', '', { required: true })}${field('Tipo', 'type', 'general')}${field('Descrição', 'description', '', { type: 'textarea' })}<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-ghost" type="button" data-dialog-close>Cancelar</button><button class="btn btn-primary" type="submit">Criar workspace</button></div></form>`);
    overlay.querySelector('#crm-workspace-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try { await request('workspace.create', { orgId: state.data.organization.id, name: formValue(form, 'name'), type: formValue(form, 'type'), description: formValue(form, 'description') }); overlay.remove(); toast('Workspace criado.', 'success'); } catch (error) { toast(error.message, 'error'); }
    });
  }

  async function deleteItem(kind, id) {
    const labels = { contact: 'cliente', deal: 'oportunidade', agenda: 'compromisso' };
    if (!window.confirm(`Excluir este ${labels[kind]}? Esta operação não pode ser desfeita.`)) return;
    try { await request(`${kind}.delete`, { ...selectedContext(), id }); toast(`${labels[kind][0].toUpperCase()}${labels[kind].slice(1)} excluído.`, 'success'); } catch (error) { toast(error.message, 'error'); }
  }

  function bindPipelineDnd() {
    let draggedId = '';
    document.querySelectorAll('[data-deal-id]').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        if (!capabilities().write) { event.preventDefault(); return; }
        draggedId = card.dataset.dealId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedId);
      });
      card.addEventListener('dragend', () => { draggedId = ''; document.querySelectorAll('.crm-dropzone').forEach((zone) => zone.style.outline = ''); });
    });
    document.querySelectorAll('.crm-dropzone').forEach((zone) => {
      zone.addEventListener('dragover', (event) => { if (capabilities().write) { event.preventDefault(); zone.style.outline = '2px dashed var(--accent)'; } });
      zone.addEventListener('dragleave', () => { zone.style.outline = ''; });
      zone.addEventListener('drop', async (event) => {
        event.preventDefault();
        zone.style.outline = '';
        const id = event.dataTransfer.getData('text/plain') || draggedId;
        const stage = zone.dataset.stageId;
        const deal = (state.data.deals || []).find((item) => item.id === id);
        if (!id || !stage || !deal || deal.stage === stage) return;
        try { await request('deal.move', { ...selectedContext(), id, stage }); toast('Estágio do pipeline atualizado.', 'success'); } catch (error) { toast(error.message, 'error'); }
      });
    });
  }

  function bindPageEvents() {
    document.querySelectorAll('#crm-org-select').forEach((select) => select.addEventListener('change', () => load({ orgId: select.value })));
    document.querySelectorAll('#crm-workspace-select').forEach((select) => select.addEventListener('change', () => load({ orgId: state.data.organization.id, workspaceId: select.value })));
    document.querySelectorAll('#crm-client-query').forEach((input) => input.addEventListener('input', () => { state.clientQuery = input.value; renderClients(); }));
    document.querySelectorAll('#crm-client-status').forEach((select) => select.addEventListener('change', () => { state.clientStatus = select.value; renderClients(); }));
    document.querySelectorAll('#crm-agenda-type').forEach((select) => select.addEventListener('change', () => { state.agendaType = select.value; renderAgenda(); }));
    document.querySelectorAll('#crm-agenda-status').forEach((select) => select.addEventListener('change', () => { state.agendaStatus = select.value; renderAgenda(); }));
    document.querySelectorAll('[data-action]').forEach((button) => {
      if (button.dataset.crmBound) return;
      button.dataset.crmBound = 'true';
      button.addEventListener('click', async (event) => {
        const action = event.currentTarget.dataset.action;
        const id = event.currentTarget.dataset.id;
        if (action === 'create-organization') return openOrganization();
        if (action === 'new-contact') return openContact();
        if (action === 'view-contact') return openContact((state.data.contacts || []).find((item) => item.id === id));
        if (action === 'delete-contact') return deleteItem('contact', id);
        if (action === 'new-deal') return openDeal(null, event.currentTarget.dataset.stage || '');
        if (action === 'view-deal') return openDeal((state.data.deals || []).find((item) => item.id === event.currentTarget.dataset.dealId));
        if (action === 'delete-deal') return deleteItem('deal', id);
        if (action === 'new-agenda') return openAgenda();
        if (action === 'view-agenda') return openAgenda((state.data.agenda || []).find((item) => item.id === id));
        if (action === 'delete-agenda') return deleteItem('agenda', id);
        if (action === 'complete-agenda') {
          const item = (state.data.agenda || []).find((entry) => entry.id === id);
          if (!item) return;
          try { await request('agenda.update', { ...selectedContext(), ...item, status: 'completed' }); toast('Compromisso concluído.', 'success'); } catch (error) { toast(error.message, 'error'); }
          return;
        }
        if (action === 'show-crm') return window.showPage?.('crm');
        if (action === 'show-pipeline') return window.showPage?.('crm-pipeline');
        if (action === 'show-agenda') return window.showPage?.('crm-agenda');
      });
    });
    document.querySelectorAll('#crm-retry').forEach((button) => button.addEventListener('click', () => load(selectedContext())));
    document.querySelectorAll('#crm-new-workspace').forEach((button) => button.addEventListener('click', openWorkspace));
  }

  window.LifeOSCRM = { load, refresh: () => load(selectedContext()), state };
  window.setTimeout(() => load(), 0);
})();
