/* LIFEOS Enterprise v43.0 — conclusão operacional do painel administrativo.
 * Camada progressiva sobre /admin: utiliza exclusivamente /api/admin-data e não
 * introduz armazenamento paralelo nem dados de demonstração.
 */
(() => {
  'use strict';

  const NAVIGATION = [
    ['overview', 'dashboard', 'Dashboard'],
    ['analytics', 'dashboard', 'Analytics'],
    ['crm', 'crm', 'CRM'],
    ['users', 'users', 'Usuários'],
    ['organizations', 'organizations', 'Organizações'],
    ['billing', 'billing', 'Billing'],
    ['subscriptions', 'subscriptions', 'Assinaturas'],
    ['plans', 'plans', 'Planos'],
    ['workspaces', 'workspaces', 'Workspaces'],
    ['audit', 'audit', 'Auditoria'],
    ['logs', 'logs', 'Logs'],
    ['security', 'security', 'Segurança'],
    ['system', 'system', 'Sistema'],
    ['integrations', 'integrations', 'Integrações'],
    ['features', 'featureFlags', 'Feature flags'],
  ];

  const ICONS = {
    overview: '▦', analytics: '◔', crm: '◎', users: '♙', organizations: '◫', billing: '◈',
    subscriptions: '↻', plans: '◇', workspaces: '▤', audit: '◷', logs: '≡', security: '◇',
    system: '⚙', integrations: '↔', features: '⚑', refresh: '↻', download: '↓', add: '+',
    edit: '✎', archive: '⌫', suspend: '⏸', activate: '▶', undo: '↶', close: '×',
  };

  const state = {
    page: 'overview',
    query: '',
    status: '',
    plan: '',
    pageNumber: 1,
    pageSize: 25,
    loading: false,
    payload: null,
    cache: { organizations: [], plans: [], users: [], workspaces: [] },
  };

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
  const text = (value, fallback = '—') => value === null || value === undefined || value === '' ? fallback : String(value);
  const array = (value) => Array.isArray(value) ? value : [];
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const route = (id) => NAVIGATION.find((item) => item[0] === id) || NAVIGATION[0];
  const statusClass = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (['active', 'ready', 'connected', 'healthy', 'paid', 'completed', 'verified'].includes(normalized)) return 'is-positive';
    if (['suspended', 'cancelled', 'archived', 'deleted', 'error', 'critical', 'past_due'].includes(normalized)) return 'is-negative';
    if (['pending', 'trialing', 'warning', 'paused', 'not_configured'].includes(normalized)) return 'is-warning';
    return 'is-neutral';
  };
  const badge = (value) => `<span class="la-badge ${statusClass(value)}">${esc(text(value))}</span>`;
  const formatDate = (value) => {
    if (!value) return 'Sem registro';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? esc(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };
  const formatNumber = (value) => value === null || value === undefined ? '—' : Number(value).toLocaleString('pt-BR');
  const formatMoney = (cents) => cents === null || cents === undefined ? 'Não disponível' : (Number(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const el = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  function injectStyle() {
    if (el('#lifeos-admin-v43-style')) return;
    const style = document.createElement('style');
    style.id = 'lifeos-admin-v43-style';
    style.textContent = `
      .la-shell{display:grid;grid-template-columns:minmax(206px,250px) minmax(0,1fr);min-height:100vh;background:#f7f8fc;color:#182033;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .la-sidebar{background:#111827;color:#e5e7eb;padding:22px 14px;position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid #273449}
      .la-brand{padding:5px 10px 21px;border-bottom:1px solid #283447;margin-bottom:15px}.la-brand b{color:#fff;font-size:15px;letter-spacing:.04em}.la-brand span{display:block;color:#98a8c1;font-size:11px;margin-top:5px}
      .la-nav{width:100%;border:0;background:transparent;color:#c6d1e2;text-align:left;padding:10px 11px;border-radius:8px;font-size:13px;margin:2px 0;cursor:pointer;display:flex;gap:9px;align-items:center}.la-nav:hover,.la-nav.active{background:#273449;color:#fff}.la-nav-icon{width:15px;text-align:center;color:#9ab1fa}.la-nav.active .la-nav-icon{color:#fff}
      .la-content{min-width:0;padding:28px 30px 48px}.la-topbar{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:22px}.la-topbar h1{font-size:24px;line-height:1.15;margin:0;color:#111827}.la-topbar p{margin:6px 0 0;color:#667085;font-size:13px}.la-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .la-btn{appearance:none;border:1px solid #d0d5dd;background:#fff;color:#344054;border-radius:7px;padding:8px 11px;font:600 12px/1.2 inherit;cursor:pointer;transition:.16s;display:inline-flex;align-items:center;gap:7px}.la-btn:hover{border-color:#98a2b3;background:#f9fafb}.la-btn:disabled{opacity:.55;cursor:not-allowed}.la-btn.primary{background:#3846c8;border-color:#3846c8;color:#fff}.la-btn.primary:hover{background:#2f3db5}.la-btn.danger{color:#b42318;border-color:#fecdca}.la-btn.danger:hover{background:#fff4f2}.la-btn.ghost{background:transparent;border-color:transparent}.la-btn.small{padding:6px 8px;font-size:11px}
      .la-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 1px 2px rgba(16,24,40,.035)}.la-card.pad{padding:18px}.la-grid{display:grid;gap:14px}.la-grid.metrics{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px}.la-grid.split{grid-template-columns:1.1fr .9fr}.la-grid.thirds{grid-template-columns:repeat(3,minmax(0,1fr))}
      .la-metric-label{color:#667085;font-size:12px;margin-bottom:10px}.la-metric-value{font-size:25px;font-weight:700;color:#101828;letter-spacing:-.03em}.la-metric-meta{color:#98a2b3;font-size:11px;margin-top:7px}.la-section-title{margin:0;font-size:15px;color:#182230}.la-section-note{margin:5px 0 14px;color:#667085;font-size:12px}
      .la-toolbar{display:flex;gap:9px;align-items:center;justify-content:space-between;margin-bottom:13px;flex-wrap:wrap}.la-toolbar-left,.la-toolbar-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.la-input,.la-select,.la-textarea{border:1px solid #d0d5dd;background:#fff;border-radius:7px;padding:8px 10px;color:#101828;font:13px inherit;min-height:35px}.la-input{min-width:220px}.la-select{min-width:132px}.la-textarea{width:100%;min-height:84px;resize:vertical}.la-input:focus,.la-select:focus,.la-textarea:focus{outline:2px solid rgba(56,70,200,.16);border-color:#6673e5}
      .la-table-wrap{overflow:auto}.la-table{border-collapse:collapse;width:100%;font-size:12px}.la-table th{color:#667085;background:#f9fafb;text-align:left;font-weight:600;padding:10px;border-bottom:1px solid #eaecf0;white-space:nowrap}.la-table td{padding:10px;border-bottom:1px solid #f0f1f4;vertical-align:middle;max-width:260px}.la-table tr:last-child td{border-bottom:0}.la-table tbody tr:hover{background:#fcfcfd}.la-table-actions{display:flex;gap:5px;align-items:center;white-space:nowrap}.la-name{font-weight:650;color:#182230}.la-sub{font-size:11px;color:#667085;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .la-badge{display:inline-flex;align-items:center;border-radius:99px;padding:3px 7px;font-size:10px;font-weight:650;text-transform:capitalize;white-space:nowrap}.la-badge.is-positive{background:#ecfdf3;color:#027a48}.la-badge.is-negative{background:#fff1f3;color:#c01048}.la-badge.is-warning{background:#fffaeb;color:#b54708}.la-badge.is-neutral{background:#f2f4f7;color:#475467}
      .la-empty{padding:38px 20px;text-align:center}.la-empty-icon{font-size:22px;color:#98a2b3;margin-bottom:10px}.la-empty h3{font-size:15px;margin:0 0 6px}.la-empty p{color:#667085;font-size:13px;max-width:440px;margin:0 auto 15px}.la-error{border-color:#fecdca;background:#fff7f6}.la-error h3{color:#b42318}.la-loading{padding:26px}.la-skeleton{height:13px;border-radius:5px;background:linear-gradient(90deg,#f2f4f7 25%,#eaecf0 37%,#f2f4f7 63%);background-size:400% 100%;animation:la-shimmer 1.3s ease infinite;margin:9px 0}.la-skeleton.w75{width:75%}.la-skeleton.w45{width:45%}@keyframes la-shimmer{0%{background-position:100% 0}100%{background-position:0 0}}
      .la-pagination{display:flex;justify-content:space-between;align-items:center;padding:12px 10px;border-top:1px solid #eaecf0;color:#667085;font-size:12px}.la-pagination-controls{display:flex;gap:6px}.la-list{list-style:none;padding:0;margin:0}.la-list li{padding:11px 0;border-bottom:1px solid #f0f1f4;display:flex;align-items:center;justify-content:space-between;gap:12px}.la-list li:last-child{border-bottom:0}.la-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border-top:1px solid #edf0f3}.la-kv div{padding:11px;border-bottom:1px solid #edf0f3}.la-kv span{display:block;font-size:11px;color:#667085;margin-bottom:4px}.la-kv b{font-size:13px;color:#182230;word-break:break-word}
      .la-dialog-backdrop{position:fixed;inset:0;background:rgba(16,24,40,.48);display:flex;align-items:center;justify-content:center;padding:16px;z-index:10020}.la-dialog{background:#fff;border-radius:12px;box-shadow:0 20px 55px rgba(16,24,40,.3);width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto}.la-dialog-head{padding:18px 20px;border-bottom:1px solid #eaecf0;display:flex;align-items:center;justify-content:space-between}.la-dialog-head h2{font-size:16px;margin:0}.la-dialog-body{padding:20px}.la-field{display:block;margin-bottom:14px}.la-field>span{display:block;font-size:12px;font-weight:600;color:#344054;margin-bottom:6px}.la-field small{display:block;color:#667085;font-size:11px;margin-top:4px}.la-dialog-footer{padding:14px 20px;border-top:1px solid #eaecf0;display:flex;justify-content:flex-end;gap:8px}.la-checkbox{display:flex!important;gap:8px;align-items:center}.la-checkbox span{margin:0!important}.la-toast-stack{position:fixed;right:18px;bottom:18px;z-index:10030;width:min(410px,calc(100vw - 36px));display:grid;gap:9px}.la-toast{padding:12px;border-radius:9px;box-shadow:0 10px 24px rgba(16,24,40,.16);display:flex;align-items:center;justify-content:space-between;gap:9px;font-size:12px;background:#fff;border:1px solid #d0d5dd}.la-toast.success{border-color:#abefc6}.la-toast.error{border-color:#fecdca}.la-toast.info{border-color:#b2ddff}.la-toast-message{line-height:1.4}.la-link{color:#3846c8;text-decoration:none;font-weight:600}.la-link:hover{text-decoration:underline}.la-warning{padding:12px 14px;background:#fffaeb;border:1px solid #fedf89;border-radius:8px;color:#7a2e0e;font-size:12px;line-height:1.45;margin-bottom:14px}
      @media (max-width:1050px){.la-grid.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.la-grid.split,.la-grid.thirds{grid-template-columns:1fr}.la-content{padding:22px 18px}}@media (max-width:760px){.la-shell{grid-template-columns:1fr}.la-sidebar{position:static;height:auto;padding:13px;display:flex;gap:6px;overflow:auto}.la-brand{display:none}.la-nav{width:auto;white-space:nowrap;margin:0;padding:9px}.la-nav-icon{display:none}.la-content{padding:18px 13px}.la-topbar{display:block}.la-actions{justify-content:flex-start;margin-top:13px}.la-grid.metrics{grid-template-columns:1fr 1fr}.la-input{min-width:0;width:100%}.la-toolbar-left,.la-toolbar-right{width:100%}.la-toolbar-right .la-input{flex:1}.la-table{min-width:680px}}
    `;
    document.head.appendChild(style);
  }

  function toast(message, type = 'info', undo = null) {
    let stack = el('#lifeos-admin-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'lifeos-admin-toast-stack';
      stack.className = 'la-toast-stack';
      document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    item.className = `la-toast ${type}`;
    item.innerHTML = `<div class="la-toast-message">${esc(message)}</div>`;
    if (undo) {
      const button = document.createElement('button');
      button.className = 'la-btn small';
      button.type = 'button';
      button.textContent = 'Desfazer';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const response = await post({ action: 'rollback', token: undo.token });
          toast(`Rollback concluído: ${response.result?.restored || 0} registro(s) restaurado(s).`, 'success');
          item.remove();
          await load();
        } catch (error) { toast(error.message, 'error'); button.disabled = false; }
      });
      item.appendChild(button);
    }
    stack.appendChild(item);
    window.setTimeout(() => item.remove(), undo ? 60_000 : 6_000);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({ ok: false, error: 'Resposta inválida do servidor.' }));
    if (!response.ok || !payload.ok) throw new Error(payload.error || `Erro ${response.status}.`);
    return payload;
  }

  async function post(body) {
    return request('/api/admin-data', { method: 'POST', body: JSON.stringify(body) });
  }

  function pageTitle(id) {
    return route(id)[2];
  }

  function renderSidebar() {
    const sidebar = el('.sidebar') || el('.la-sidebar');
    if (!sidebar) return;
    sidebar.className = 'la-sidebar';
    sidebar.innerHTML = `<div class="la-brand"><b>LIFEOS ENTERPRISE</b><span>Admin Control Plane · v43.0</span></div>${NAVIGATION.map(([id, , label]) => `<button class="la-nav ${state.page === id ? 'active' : ''}" type="button" data-action="navigate" data-page="${id}"><span class="la-nav-icon">${ICONS[id] || '•'}</span><span>${label}</span></button>`).join('')}`;
  }

  function shell() {
    const content = el('.content') || el('main');
    if (!content) throw new Error('Superfície administrativa indisponível.');
    content.className = 'la-content';
    content.innerHTML = '<div id="lifeos-admin-root" aria-live="polite"></div>';
    const layout = content.closest('.admin-layout') || content.parentElement;
    if (layout) layout.className = 'la-shell';
    renderSidebar();
  }

  function stat(label, value, note = '') {
    return `<div class="la-card pad"><div class="la-metric-label">${esc(label)}</div><div class="la-metric-value">${esc(text(value))}</div>${note ? `<div class="la-metric-meta">${esc(note)}</div>` : ''}</div>`;
  }

  function loadingView() {
    return `<div class="la-card la-loading"><div class="la-skeleton w45"></div><div class="la-skeleton"></div><div class="la-skeleton w75"></div><div class="la-skeleton"></div></div>`;
  }

  function emptyView(title, description, action = null) {
    return `<div class="la-card la-empty"><div class="la-empty-icon">◇</div><h3>${esc(title)}</h3><p>${esc(description)}</p>${action ? `<button type="button" class="la-btn primary" data-action="${esc(action.action)}">${esc(action.label)}</button>` : ''}</div>`;
  }

  function errorView(error) {
    return `<div class="la-card la-empty la-error"><div class="la-empty-icon">!</div><h3>Não foi possível carregar esta tela</h3><p>${esc(error?.message || 'Ocorreu uma falha de comunicação.')}</p><button type="button" class="la-btn primary" data-action="refresh">Tentar novamente</button></div>`;
  }

  function topbar(title, description, actions = '') {
    return `<div class="la-topbar"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="la-actions"><button type="button" class="la-btn" data-action="refresh">${ICONS.refresh} Atualizar</button>${actions}</div></div>`;
  }

  function listToolbar({ search = true, status = true, plan = false, create = null, bulk = null, exportable = true } = {}) {
    return `<div class="la-toolbar"><div class="la-toolbar-left">${create ? `<button class="la-btn primary" type="button" data-action="${create.action}">${ICONS.add} ${esc(create.label)}</button>` : ''}${bulk ? `<button class="la-btn" type="button" data-action="bulk" data-bulk="${bulk}">Ação em lote</button>` : ''}</div><div class="la-toolbar-right">${search ? `<input class="la-input" id="lifeos-admin-search" value="${esc(state.query)}" placeholder="Pesquisar registros" aria-label="Pesquisar registros">` : ''}${status ? `<select class="la-select" id="lifeos-admin-status" aria-label="Filtrar por status"><option value="">Todos os status</option><option value="active" ${state.status === 'active' ? 'selected' : ''}>Ativos</option><option value="suspended" ${state.status === 'suspended' ? 'selected' : ''}>Suspensos</option><option value="archived" ${state.status === 'archived' ? 'selected' : ''}>Arquivados</option><option value="pending" ${state.status === 'pending' ? 'selected' : ''}>Pendentes</option></select>` : ''}${plan ? `<select class="la-select" id="lifeos-admin-plan" aria-label="Filtrar por plano"><option value="">Todos os planos</option>${state.cache.plans.map((item) => `<option value="${esc(item.name || item.id)}" ${state.plan === (item.name || item.id) ? 'selected' : ''}>${esc(item.name || item.id)}</option>`).join('')}</select>` : ''}${exportable ? `<button class="la-btn" type="button" data-action="export">${ICONS.download} Exportar</button>` : ''}</div></div>`;
  }

  function pagination(payload) {
    const page = payload?.pagination;
    if (!page) return '';
    return `<div class="la-pagination"><span>${page.total} registro(s) · página ${page.page} de ${page.totalPages}</span><div class="la-pagination-controls"><button class="la-btn small" type="button" data-action="page" data-direction="previous" ${page.hasPrevious ? '' : 'disabled'}>Anterior</button><button class="la-btn small" type="button" data-action="page" data-direction="next" ${page.hasNext ? '' : 'disabled'}>Próxima</button></div></div>`;
  }

  function table(headers, rows, payload) {
    if (!rows.length) return emptyView('Nenhum registro encontrado', 'Não há dados para os filtros atuais. Ajuste a pesquisa ou crie o primeiro registro.');
    return `<div class="la-card"><div class="la-table-wrap"><table class="la-table"><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>${pagination(payload)}</div>`;
  }

  function dashboard(data) {
    const metrics = object(data?.metrics || data);
    const audit = array(data?.recentAudit);
    return `${topbar('Dashboard executivo', 'Visão consolidada da operação enterprise com dados persistidos no Cloudflare KV.')}<div class="la-grid metrics">${stat('Usuários ativos', formatNumber(metrics.activeUsers), `${formatNumber(metrics.totalUsers)} usuários não excluídos`)}${stat('Organizações', formatNumber(metrics.totalOrganizations), `${formatNumber(metrics.totalWorkspaces)} workspaces ativos`)}${stat('CRM em operação', formatNumber(metrics.crmOpenDeals), `${formatNumber(metrics.crmContacts)} contatos`)}${stat('MRR', formatMoney(metrics.mrr), metrics.arr === null || metrics.arr === undefined ? 'ARR não disponível' : `ARR ${formatMoney(metrics.arr)}`)}</div><div class="la-grid split"><section class="la-card pad"><h2 class="la-section-title">Atividade auditável recente</h2><p class="la-section-note">Ações administrativas e organizacionais persistidas.</p>${audit.length ? `<ul class="la-list">${audit.slice(0, 8).map((item) => `<li><div><div class="la-name">${esc(item.action || 'Operação')}</div><div class="la-sub">${esc(item.detail || item.target || '')}</div></div><div class="la-sub">${formatDate(item.at)}</div></li>`).join('')}</ul>` : emptyView('Sem atividade registrada', 'As próximas ações realizadas na plataforma aparecerão nesta trilha.')}</section><section class="la-card pad"><h2 class="la-section-title">Prontidão de infraestrutura</h2><p class="la-section-note">Status calculado a partir dos bindings disponíveis na execução atual.</p><div class="la-kv"><div><span>Cloudflare KV</span><b>${metrics.systemMetrics ? 'Disponível para telemetria' : 'Sem telemetria registrada'}</b></div><div><span>Pipeline</span><b>Cloudflare Pages</b></div><div><span>Dados coletados</span><b>${formatDate(metrics.collectedAt)}</b></div><div><span>Receita total</span><b>${formatMoney(metrics.totalRevenue)}</b></div></div></section></div>`;
  }

  function analytics(data) {
    const metrics = object(data?.metrics || data);
    const plans = object(metrics.plans);
    const rows = Object.entries(plans).map(([name, count]) => `<tr><td><span class="la-name">${esc(name)}</span></td><td>${formatNumber(count)}</td></tr>`);
    return `${topbar('Analytics', 'Métricas calculadas a partir das entidades persistidas, sem linhas de demonstração.')}<div class="la-grid metrics">${stat('Contatos CRM', formatNumber(metrics.crmContacts))}${stat('Oportunidades abertas', formatNumber(metrics.crmOpenDeals))}${stat('Pipeline comercial', (Number(metrics.crmPipelineValue || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}${stat('Churn', metrics.churnRate === null || metrics.churnRate === undefined ? 'Não disponível' : `${metrics.churnRate}%`)}</div><section class="la-card pad"><h2 class="la-section-title">Distribuição de planos</h2><p class="la-section-note">Contagem efetiva de planos atribuídos a usuários e assinaturas ativas.</p>${rows.length ? table(['Plano', 'Contagem'], rows, null) : emptyView('Sem distribuição disponível', 'Os dados aparecerão após a criação de usuários ou assinaturas com plano associado.', { action: 'create-plan', label: 'Criar plano' })}</section>`;
  }

  function users(payload) {
    const items = array(payload.data);
    const rows = items.map((user) => `<tr><td><input type="checkbox" data-select="user" data-value="${esc(user.email)}" aria-label="Selecionar ${esc(user.email)}"></td><td><div class="la-name">${esc(user.name)}</div><div class="la-sub">${esc(user.email)}</div></td><td>${badge(user.status)}</td><td>${esc(text(user.role))}</td><td>${esc(text(user.plan))}</td><td>${formatDate(user.lastLoginAt || user.createdAt)}</td><td><div class="la-table-actions"><button class="la-btn small" data-action="edit-user" data-email="${esc(user.email)}">${ICONS.edit} Editar</button><button class="la-btn small" data-action="toggle-user" data-email="${esc(user.email)}" data-status="${esc(user.status)}">${user.status === 'suspended' ? ICONS.activate + ' Reativar' : ICONS.suspend + ' Suspender'}</button><button class="la-btn small danger" data-action="delete-user" data-email="${esc(user.email)}">${ICONS.archive}</button></div></td></tr>`);
    return `${topbar('Usuários', 'Gestão integral de contas, status, perfis e acesso à plataforma.')}<section>${listToolbar({ plan: true, create: { action: 'invite-user', label: 'Convidar usuário' }, bulk: 'users' })}${table(['', 'Usuário', 'Status', 'Papel', 'Plano', 'Última atividade', 'Ações'], rows, payload)}</section>`;
  }

  function organizations(payload) {
    const rows = array(payload.data).map((organization) => `<tr><td><input type="checkbox" data-select="organization" data-value="${esc(organization.id)}" aria-label="Selecionar ${esc(organization.name)}"></td><td><div class="la-name">${esc(organization.name)}</div><div class="la-sub">${esc(organization.id)}</div></td><td>${badge(organization.status)}</td><td>${esc(text(organization.plan))}</td><td>${formatNumber(organization.activeMemberCount)} / ${formatNumber(organization.memberCount)}</td><td>${formatNumber(organization.workspaceCount)}</td><td><div class="la-table-actions"><button class="la-btn small" data-action="edit-org" data-id="${esc(organization.id)}">${ICONS.edit}</button><button class="la-btn small" data-action="toggle-org" data-id="${esc(organization.id)}" data-status="${esc(organization.status)}">${organization.status === 'suspended' ? ICONS.activate : ICONS.suspend}</button><button class="la-btn small danger" data-action="archive-org" data-id="${esc(organization.id)}">${ICONS.archive}</button></div></td></tr>`);
    return `${topbar('Organizações', 'CRUD empresarial de tenants, planos, capacidade e estado operacional.')}<section>${listToolbar({ plan: true, create: { action: 'create-org', label: 'Nova organização' }, bulk: 'organizations' })}${table(['', 'Organização', 'Status', 'Plano', 'Membros ativos', 'Workspaces', 'Ações'], rows, payload)}</section>`;
  }

  function workspaces(payload) {
    const rows = array(payload.data).map((workspace) => `<tr><td><input type="checkbox" data-select="workspace" data-value="${esc(`${workspace.organizationId}|${workspace.id}`)}" aria-label="Selecionar ${esc(workspace.name)}"></td><td><div class="la-name">${esc(workspace.name)}</div><div class="la-sub">${esc(workspace.organizationName)}</div></td><td>${badge(workspace.status)}</td><td>${esc(text(workspace.type))}</td><td>${formatNumber(workspace.memberCount)}</td><td>${formatDate(workspace.updatedAt)}</td><td><div class="la-table-actions"><button class="la-btn small" data-action="edit-workspace" data-org="${esc(workspace.organizationId)}" data-id="${esc(workspace.id)}">${ICONS.edit}</button><button class="la-btn small danger" data-action="archive-workspace" data-org="${esc(workspace.organizationId)}" data-id="${esc(workspace.id)}" ${workspace.protected ? 'disabled title="Workspace principal protegido"' : ''}>${ICONS.archive}</button></div></td></tr>`);
    return `${topbar('Workspaces', 'Gerenciamento de espaços de trabalho organizacionais, com auditoria e rollback.')}<section>${listToolbar({ create: { action: 'create-workspace', label: 'Novo workspace' }, bulk: 'workspaces' })}${table(['', 'Workspace', 'Status', 'Tipo', 'Membros', 'Atualizado em', 'Ações'], rows, payload)}</section>`;
  }

  function plans(payload) {
    const rows = array(payload.data).map((plan) => `<tr><td><div class="la-name">${esc(plan.name)}</div><div class="la-sub">${esc(plan.id)}</div></td><td>${plan.amountCents === null || plan.amountCents === undefined ? 'Não informado' : formatMoney(plan.amountCents)}</td><td>${esc(text(plan.interval))}</td><td>${badge(plan.active === false ? 'archived' : 'active')}</td><td>${formatNumber(array(plan.features).length)}</td><td><div class="la-table-actions"><button class="la-btn small" data-action="edit-plan" data-id="${esc(plan.id)}">${ICONS.edit}</button><button class="la-btn small danger" data-action="archive-plan" data-id="${esc(plan.id)}">${ICONS.archive}</button></div></td></tr>`);
    return `${topbar('Planos', 'Catálogo interno de planos e recursos, persistido e versionado.')}<section>${listToolbar({ status: false, create: { action: 'create-plan', label: 'Novo plano' } })}${table(['Plano', 'Preço', 'Periodicidade', 'Status', 'Recursos', 'Ações'], rows, payload)}</section>`;
  }

  function subscriptions(payload) {
    const rows = array(payload.data).map((subscription) => `<tr><td><div class="la-name">${esc(subscription.organizationId)}</div><div class="la-sub">${esc(subscription.id)}</div></td><td>${esc(text(subscription.planId))}</td><td>${badge(subscription.status)}</td><td>${subscription.seats ?? '—'}</td><td>${esc(text(subscription.provider))}</td><td>${formatDate(subscription.currentPeriodEnd)}</td><td><div class="la-table-actions"><button class="la-btn small" data-action="edit-subscription" data-id="${esc(subscription.id)}">${ICONS.edit}</button><button class="la-btn small danger" data-action="cancel-subscription" data-id="${esc(subscription.id)}">Cancelar</button></div></td></tr>`);
    return `${topbar('Assinaturas', 'Controle de estados, assentos e referências de cobrança. Cobrança externa permanece pronta para ativação.')}<section>${listToolbar({ status: true, create: { action: 'create-subscription', label: 'Nova assinatura' } })}${table(['Organização', 'Plano', 'Status', 'Assentos', 'Origem', 'Fim do período', 'Ações'], rows, payload)}</section>`;
  }

  function billing(payload) {
    const data = object(payload.data);
    const stats = object(data.stats);
    const subscriptionsList = array(data.subscriptions);
    return `${topbar('Billing', 'Visão financeira baseada em estatísticas e assinaturas realmente persistidas.')}<div class="la-grid metrics">${stat('MRR', formatMoney(stats.mrr))}${stat('ARR', formatMoney(stats.arr))}${stat('Receita total', formatMoney(stats.totalRevenue))}${stat('Assinaturas ativas', formatNumber(subscriptionsList.filter((item) => item.status === 'active').length))}</div><div class="la-warning"><b>Pronto para ativação.</b> Cobrança automática, webhooks e conciliação dependem exclusivamente de credenciais oficiais do provedor de pagamentos.</div><section class="la-card pad"><h2 class="la-section-title">Assinaturas persistidas</h2><p class="la-section-note">Use a área de assinaturas para criação, alteração e cancelamento auditável.</p><button type="button" class="la-btn primary" data-action="navigate" data-page="subscriptions">Gerenciar assinaturas</button></section>`;
  }

  function crm(payload) {
    const rows = array(payload.data).map((item) => `<tr><td><div class="la-name">${esc(item.organizationName)}</div><div class="la-sub">${esc(item.workspaceName)}</div></td><td>${formatNumber(item.contacts)}</td><td>${formatNumber(item.openDeals)} / ${formatNumber(item.deals)}</td><td>${Number(item.pipelineValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>${formatNumber(item.agendaItems)}</td><td>${formatDate(item.updatedAt)}</td></tr>`);
    return `${topbar('CRM', 'Consolidação do CRM operacional por organização e workspace.')}<div class="la-toolbar"><div class="la-toolbar-left"><a class="la-btn primary" href="/app#crm">Abrir CRM operacional</a></div><div class="la-toolbar-right"><button type="button" class="la-btn" data-action="export">${ICONS.download} Exportar</button></div></div>${table(['Organização / workspace', 'Contatos', 'Oportunidades', 'Pipeline', 'Agenda', 'Atualizado em'], rows, payload)}`;
  }

  function audit(payload) {
    const rows = array(payload.data).map((entry) => `<tr><td><div class="la-name">${esc(entry.action)}</div><div class="la-sub">${esc(entry.source || '')}</div></td><td>${esc(text(entry.actor))}</td><td>${esc(text(entry.target))}</td><td>${esc(text(entry.detail))}</td><td>${formatDate(entry.at)}</td></tr>`);
    return `${topbar('Auditoria', 'Trilha imutável de ações administrativas e organizacionais, com exportação.')}<section>${listToolbar({ status: false, exportable: true })}${table(['Ação', 'Ator', 'Destino', 'Detalhe', 'Data'], rows, payload)}</section>`;
  }

  function logs(payload) {
    const rows = array(payload.data).map((entry) => `<tr><td>${badge(entry.level)}</td><td><div class="la-name">${esc(entry.message)}</div><div class="la-sub">${esc(entry.service)}</div></td><td>${formatDate(entry.at)}</td><td>${esc(Object.keys(object(entry.metadata)).join(', ') || '—')}</td></tr>`);
    return `${topbar('Logs', 'Eventos operacionais persistidos e pesquisáveis.')}<section>${listToolbar({ status: false, exportable: true })}<div class="la-toolbar"><div class="la-toolbar-left"></div><div class="la-toolbar-right"><button class="la-btn danger" type="button" data-action="clear-logs">Limpar logs persistidos</button></div></div>${table(['Nível', 'Mensagem / Serviço', 'Data', 'Metadados'], rows, payload)}</section>`;
  }

  function security(payload) {
    const rows = array(payload.data).map((entry) => `<tr><td>${badge(entry.severity)}</td><td><div class="la-name">${esc(entry.type)}</div><div class="la-sub">${esc(entry.detail)}</div></td><td>${esc(text(entry.userEmail))}</td><td>${formatDate(entry.at)}</td><td>${entry.userEmail ? `<button class="la-btn small danger" type="button" data-action="revoke-sessions" data-email="${esc(entry.userEmail)}">Revogar sessões</button>` : '—'}</td></tr>`);
    return `${topbar('Segurança', 'Eventos de segurança, auditoria de dispositivos e revogação efetiva de sessões.')}<section>${listToolbar({ status: false, exportable: true })}${table(['Severidade', 'Evento', 'Usuário', 'Data', 'Ação'], rows, payload)}</section>`;
  }

  function system(payload) {
    const data = object(payload.data);
    const settings = object(data.settings);
    const infra = object(data.infrastructure);
    return `${topbar('Sistema', 'Configurações persistidas, bindings ativos e operações de manutenção.')}<div class="la-grid thirds">${stat('Ambiente', data.environment || 'Não configurado')}${stat('Versão em execução', data.version || 'Não configurada')}${stat('Cloudflare KV', infra.kvBound ? 'Vinculado' : 'Indisponível')}</div><div class="la-grid split"><section class="la-card pad"><h2 class="la-section-title">Configurações persistidas</h2><p class="la-section-note">Alterações são auditadas e podem ser desfeitas dentro da janela de rollback.</p><div class="la-kv">${Object.keys(settings).filter((key) => !['updatedAt', 'updatedBy'].includes(key)).length ? Object.entries(settings).filter(([key]) => !['updatedAt', 'updatedBy'].includes(key)).map(([key, value]) => `<div><span>${esc(key)}</span><b>${esc(typeof value === 'object' ? JSON.stringify(value) : String(value))}</b></div>`).join('') : '<div><span>Estado</span><b>Nenhuma configuração persistida.</b></div>'}</div><div style="margin-top:14px"><button type="button" class="la-btn primary" data-action="edit-system">${ICONS.edit} Atualizar configurações</button></div></section><section class="la-card pad"><h2 class="la-section-title">Operações controladas</h2><p class="la-section-note">Ações reais disponíveis para o ambiente atual.</p><div class="la-actions" style="justify-content:flex-start"><button type="button" class="la-btn danger" data-action="clear-cache">Limpar cache</button><button type="button" class="la-btn" data-action="deploy-ready">Iniciar publicação</button></div><div class="la-warning" style="margin-top:14px"><b>Pronto para ativação.</b> O disparo remoto de publicação requer token oficial do Cloudflare configurado no ambiente.</div></section></div>`;
  }

  function integrations(payload) {
    const data = object(payload.data);
    const connected = array(data.connected);
    const infrastructure = object(data.infrastructure);
    const rows = connected.map((integration) => `<tr><td><div class="la-name">${esc(integration.integrationId || integration.id || integration.key)}</div><div class="la-sub">${esc(integration.key)}</div></td><td>${badge(integration.status)}</td><td>${esc(text(integration.userId))}</td><td>${formatDate(integration.connectedAt)}</td><td><button class="la-btn small danger" type="button" data-action="disconnect-integration" data-key="${esc(integration.key)}">Desconectar</button></td></tr>`);
    return `${topbar('Integrações', 'Conexões persistidas e estado dos bindings da plataforma.')}<div class="la-grid thirds">${stat('KV', infrastructure.kvBound ? 'Vinculado' : 'Indisponível')}${stat('R2', infrastructure.r2Bound ? 'Vinculado' : 'Pronto para ativação')}${stat('Conexões ativas', formatNumber(connected.length))}</div><div class="la-warning"><b>Pronto para ativação.</b> As conexões que exigem OAuth, pagamento, e-mail, IA ou webhooks serão ativadas automaticamente após a configuração das credenciais oficiais externas.</div>${table(['Integração', 'Status', 'Usuário', 'Conectada em', 'Ação'], rows, payload)}`;
  }

  function features(payload) {
    const rows = array(payload.data).map((flag) => `<tr><td><div class="la-name">${esc(flag.key || flag.id)}</div><div class="la-sub">${esc(flag.description || '')}</div></td><td>${badge(flag.enabled ? 'active' : 'paused')}</td><td>${formatDate(flag.updatedAt)}</td><td><div class="la-table-actions"><button class="la-btn small" data-action="toggle-flag" data-key="${esc(flag.key || flag.id)}" data-enabled="${flag.enabled ? 'true' : 'false'}">${flag.enabled ? 'Desativar' : 'Ativar'}</button><button class="la-btn small danger" data-action="delete-flag" data-key="${esc(flag.key || flag.id)}">${ICONS.archive}</button></div></td></tr>`);
    return `${topbar('Feature flags', 'Controles de lançamento persistidos, auditados e reversíveis.')}<section>${listToolbar({ status: false, create: { action: 'create-flag', label: 'Nova feature flag' } })}${table(['Chave', 'Estado', 'Atualizado em', 'Ações'], rows, payload)}</section>`;
  }

  function pageView(payload) {
    const page = state.page;
    if (page === 'overview') return dashboard(payload.data);
    if (page === 'analytics') return analytics(payload.data);
    if (page === 'users') return users(payload);
    if (page === 'organizations') return organizations(payload);
    if (page === 'workspaces') return workspaces(payload);
    if (page === 'plans') return plans(payload);
    if (page === 'subscriptions') return subscriptions(payload);
    if (page === 'billing') return billing(payload);
    if (page === 'crm') return crm(payload);
    if (page === 'audit') return audit(payload);
    if (page === 'logs') return logs(payload);
    if (page === 'security') return security(payload);
    if (page === 'system') return system(payload);
    if (page === 'integrations') return integrations(payload);
    if (page === 'features') return features(payload);
    return dashboard(payload.data);
  }

  function root() { return el('#lifeos-admin-root'); }

  function updateCache(payload) {
    const resource = payload.resource;
    if (resource === 'organizations') state.cache.organizations = array(payload.data);
    if (resource === 'plans') state.cache.plans = array(payload.data);
    if (resource === 'users') state.cache.users = array(payload.data);
    if (resource === 'workspaces') state.cache.workspaces = array(payload.data);
    const legacy = payload || {};
    if (array(legacy.users).length) state.cache.users = legacy.users;
  }

  async function warmCache() {
    const missing = !state.cache.organizations.length || !state.cache.plans.length;
    if (!missing) return;
    const [organizations, plans] = await Promise.all([
      request('/api/admin-data?resource=organizations&pageSize=100').catch(() => null),
      request('/api/admin-data?resource=plans&pageSize=100').catch(() => null),
    ]);
    if (organizations?.ok) state.cache.organizations = array(organizations.data);
    if (plans?.ok) state.cache.plans = array(plans.data);
  }

  async function load() {
    const target = root();
    if (!target) return;
    state.loading = true;
    target.innerHTML = loadingView();
    const [, resource] = route(state.page);
    const params = new URLSearchParams({ resource, page: String(state.pageNumber), pageSize: String(state.pageSize) });
    if (state.query) params.set('q', state.query);
    if (state.status) params.set('status', state.status);
    if (state.plan) params.set('plan', state.plan);
    try {
      const payload = await request(`/api/admin-data?${params.toString()}`);
      state.payload = payload;
      updateCache(payload);
      target.innerHTML = pageView(payload);
      renderSidebar();
      if (['users', 'organizations', 'workspaces', 'plans', 'subscriptions'].includes(state.page)) warmCache().catch(() => {});
    } catch (error) {
      target.innerHTML = errorView(error);
    } finally {
      state.loading = false;
    }
  }

  function readCurrent(type, id) {
    const list = type === 'user' ? state.cache.users : type === 'organization' ? state.cache.organizations : type === 'workspace' ? state.cache.workspaces : type === 'plan' ? state.cache.plans : [];
    return list.find((item) => item.id === id || item.email === id) || null;
  }

  function fieldHtml(field) {
    const id = `la-field-${field.name}`;
    const attrs = `${field.required ? 'required' : ''} ${field.readonly ? 'readonly' : ''}`;
    if (field.type === 'textarea') return `<label class="la-field"><span>${esc(field.label)}</span><textarea id="${id}" class="la-textarea" name="${esc(field.name)}" ${attrs}>${esc(field.value ?? '')}</textarea>${field.help ? `<small>${esc(field.help)}</small>` : ''}</label>`;
    if (field.type === 'select') return `<label class="la-field"><span>${esc(field.label)}</span><select id="${id}" class="la-select" name="${esc(field.name)}" ${attrs}>${array(field.options).map((option) => `<option value="${esc(option.value)}" ${String(option.value) === String(field.value ?? '') ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}</select>${field.help ? `<small>${esc(field.help)}</small>` : ''}</label>`;
    if (field.type === 'checkbox') return `<label class="la-field la-checkbox"><input id="${id}" type="checkbox" name="${esc(field.name)}" ${field.value ? 'checked' : ''}><span>${esc(field.label)}</span>${field.help ? `<small>${esc(field.help)}</small>` : ''}</label>`;
    return `<label class="la-field"><span>${esc(field.label)}</span><input id="${id}" class="la-input" style="width:100%" type="${esc(field.type || 'text')}" name="${esc(field.name)}" value="${esc(field.value ?? '')}" ${attrs}>${field.help ? `<small>${esc(field.help)}</small>` : ''}</label>`;
  }

  function openForm({ title, fields, submitLabel = 'Salvar', onSubmit }) {
    const previous = el('#lifeos-admin-dialog');
    if (previous) previous.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'lifeos-admin-dialog';
    backdrop.className = 'la-dialog-backdrop';
    backdrop.innerHTML = `<div class="la-dialog" role="dialog" aria-modal="true" aria-labelledby="lifeos-admin-dialog-title"><form id="lifeos-admin-form"><div class="la-dialog-head"><h2 id="lifeos-admin-dialog-title">${esc(title)}</h2><button type="button" class="la-btn ghost" data-action="close-dialog" aria-label="Fechar">${ICONS.close}</button></div><div class="la-dialog-body">${fields.map(fieldHtml).join('')}</div><div class="la-dialog-footer"><button type="button" class="la-btn" data-action="close-dialog">Cancelar</button><button type="submit" class="la-btn primary">${esc(submitLabel)}</button></div></form></div>`;
    document.body.appendChild(backdrop);
    const form = el('#lifeos-admin-form', backdrop);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = el('[type="submit"]', form);
      submit.disabled = true;
      const values = {};
      for (const [name, value] of new FormData(form).entries()) values[name] = value;
      fields.filter((field) => field.type === 'checkbox').forEach((field) => { values[field.name] = el(`[name="${field.name}"]`, form).checked; });
      try {
        const result = await onSubmit(values);
        backdrop.remove();
        if (result?.rollback) toast('Alteração concluída. O rollback está disponível por 1 hora.', 'success', result.rollback);
        else toast(result?.activation || 'Alteração concluída.', 'success');
        await load();
      } catch (error) { toast(error.message, 'error'); submit.disabled = false; }
    });
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });
  }

  function selected(type) {
    return all(`[data-select="${type}"]:checked`).map((input) => input.dataset.value).filter(Boolean);
  }

  async function confirmAction(message, body, target = null) {
    if (!window.confirm(message)) return null;
    if (target) target.disabled = true;
    try {
      const response = await post(body);
      const result = response.result || {};
      if (result.rollback) toast('Operação concluída. O rollback está disponível por 1 hora.', 'success', result.rollback);
      else toast(result.activation || 'Operação concluída.', 'success');
      await load();
      return result;
    } catch (error) {
      toast(error.message, 'error');
      throw error;
    } finally { if (target) target.disabled = false; }
  }

  function showUserForm(email = '') {
    const user = email ? readCurrent('user', email) : null;
    if (!user && email) return toast('Usuário não está disponível no cache atual.', 'error');
    openForm({
      title: user ? 'Editar usuário' : 'Convidar usuário',
      submitLabel: user ? 'Salvar alterações' : 'Registrar convite',
      fields: [
        { name: 'name', label: 'Nome', required: true, value: user?.name || '' },
        { name: 'email', label: 'E-mail', type: 'email', required: true, readonly: Boolean(user), value: user?.email || '' },
        { name: 'role', label: 'Papel', type: 'select', value: user?.role || 'user', options: ['admin', 'manager', 'user', 'viewer'].map((value) => ({ value, label: value })) },
        { name: 'plan', label: 'Plano', type: 'select', value: user?.plan || 'unassigned', options: [{ value: 'unassigned', label: 'Não atribuído' }, ...state.cache.plans.map((plan) => ({ value: plan.name || plan.id, label: plan.name || plan.id }))] },
        ...(user ? [{ name: 'status', label: 'Status', type: 'select', value: user.status, options: ['active', 'suspended', 'pending_verification'].map((value) => ({ value, label: value })) }] : []),
      ],
      onSubmit: async (values) => (await post(user ? { action: 'user.update', ...values } : { action: 'user.invite', ...values })).result,
    });
  }

  function showOrganizationForm(id = '') {
    const organization = id ? readCurrent('organization', id) : null;
    openForm({
      title: organization ? 'Editar organização' : 'Nova organização',
      submitLabel: organization ? 'Salvar alterações' : 'Criar organização',
      fields: [
        { name: 'name', label: 'Nome da organização', required: true, value: organization?.name || '' },
        { name: 'description', label: 'Descrição', type: 'textarea', value: organization?.description || '' },
        { name: 'plan', label: 'Plano', type: 'select', value: organization?.plan || 'Unassigned', options: [{ value: 'Unassigned', label: 'Não atribuído' }, ...state.cache.plans.map((plan) => ({ value: plan.name || plan.id, label: plan.name || plan.id }))] },
        ...(organization ? [{ name: 'status', label: 'Status', type: 'select', value: organization.status, options: ['active', 'suspended', 'archived'].map((value) => ({ value, label: value })) }] : [
          { name: 'ownerId', label: 'E-mail / ID do owner', type: 'email', required: true, value: '' },
          { name: 'ownerName', label: 'Nome do owner', required: false, value: '' },
        ]),
      ],
      onSubmit: async (values) => (await post(organization ? { action: 'organization.update', id: organization.id, ...values } : { action: 'organization.create', ...values, ownerEmail: values.ownerId })).result,
    });
  }

  function showWorkspaceForm(orgId = '', id = '') {
    const workspace = id ? readCurrent('workspace', id) : null;
    openForm({
      title: workspace ? 'Editar workspace' : 'Novo workspace',
      submitLabel: workspace ? 'Salvar alterações' : 'Criar workspace',
      fields: [
        ...(!workspace ? [{ name: 'organizationId', label: 'Organização', type: 'select', required: true, value: orgId, options: state.cache.organizations.map((organization) => ({ value: organization.id, label: organization.name })) }] : []),
        { name: 'name', label: 'Nome do workspace', required: true, value: workspace?.name || '' },
        { name: 'description', label: 'Descrição', type: 'textarea', value: workspace?.description || '' },
        { name: 'type', label: 'Tipo', type: 'select', value: workspace?.type || 'general', options: ['general', 'team', 'project', 'private'].map((value) => ({ value, label: value })) },
        ...(workspace ? [{ name: 'status', label: 'Status', type: 'select', value: workspace.status, options: ['active', 'archived'].map((value) => ({ value, label: value })) }] : []),
      ],
      onSubmit: async (values) => (await post(workspace ? { action: 'workspace.update', organizationId: workspace.organizationId, id: workspace.id, ...values } : { action: 'workspace.create', ...values })).result,
    });
  }

  function showPlanForm(id = '') {
    const plan = id ? readCurrent('plan', id) : null;
    openForm({
      title: plan ? 'Editar plano' : 'Novo plano',
      submitLabel: plan ? 'Salvar alterações' : 'Criar plano',
      fields: [
        { name: 'name', label: 'Nome', required: true, value: plan?.name || '' },
        { name: 'description', label: 'Descrição', type: 'textarea', value: plan?.description || '' },
        { name: 'amountCents', label: 'Preço em centavos', type: 'number', value: plan?.amountCents ?? '' },
        { name: 'interval', label: 'Periodicidade', type: 'select', value: plan?.interval || 'month', options: ['month', 'year', 'one_time'].map((value) => ({ value, label: value })) },
        { name: 'active', label: 'Plano ativo', type: 'checkbox', value: plan ? plan.active !== false : true },
      ],
      onSubmit: async (values) => (await post(plan ? { action: 'plan.update', id: plan.id, ...values } : { action: 'plan.create', ...values })).result,
    });
  }

  function showSubscriptionForm(id = '') {
    const current = array(state.payload?.data).find((item) => item.id === id) || null;
    openForm({
      title: current ? 'Editar assinatura' : 'Nova assinatura',
      submitLabel: current ? 'Salvar alterações' : 'Criar assinatura',
      fields: [
        { name: 'organizationId', label: 'Organização', type: 'select', required: true, value: current?.organizationId || '', options: state.cache.organizations.map((organization) => ({ value: organization.id, label: organization.name })) },
        { name: 'planId', label: 'Plano', type: 'select', value: current?.planId || '', options: [{ value: '', label: 'Não atribuído' }, ...state.cache.plans.map((plan) => ({ value: plan.id, label: plan.name }))] },
        { name: 'status', label: 'Status', type: 'select', value: current?.status || 'not_configured', options: ['active', 'trialing', 'past_due', 'paused', 'cancelled', 'not_configured'].map((value) => ({ value, label: value })) },
        { name: 'seats', label: 'Assentos', type: 'number', value: current?.seats ?? '' },
        { name: 'provider', label: 'Origem', value: current?.provider || 'manual', help: 'Use o provedor oficial somente após a configuração das credenciais.' },
        { name: 'externalReference', label: 'Referência externa', value: current?.externalReference || '' },
      ],
      onSubmit: async (values) => (await post(current ? { action: 'subscription.update', id: current.id, ...values } : { action: 'subscription.create', ...values })).result,
    });
  }

  function showFlagForm() {
    openForm({
      title: 'Nova feature flag', submitLabel: 'Criar flag',
      fields: [{ name: 'key', label: 'Chave', required: true, value: '' }, { name: 'description', label: 'Descrição', type: 'textarea', value: '' }, { name: 'enabled', label: 'Ativada', type: 'checkbox', value: false }],
      onSubmit: async (values) => (await post({ action: 'flag.upsert', ...values })).result,
    });
  }

  function showSystemForm() {
    const settings = object(state.payload?.data?.settings);
    openForm({
      title: 'Atualizar configurações do sistema', submitLabel: 'Salvar configurações',
      fields: [{ name: 'maintenanceMessage', label: 'Mensagem de manutenção', type: 'textarea', value: settings.maintenanceMessage || '' }, { name: 'allowRegistrations', label: 'Permitir novos cadastros', type: 'checkbox', value: settings.allowRegistrations !== false }],
      onSubmit: async (values) => (await post({ action: 'system.settings.update', settings: values })).result,
    });
  }

  async function performBulk(scope, target) {
    const values = selected(scope === 'users' ? 'user' : scope === 'organizations' ? 'organization' : 'workspace');
    if (!values.length) return toast('Selecione pelo menos um registro para a ação em lote.', 'info');
    const label = scope === 'users' ? 'suspender' : 'arquivar';
    if (!window.confirm(`Confirma ${label} ${values.length} registro(s) selecionado(s)?`)) return;
    target.disabled = true;
    let done = 0;
    try {
      for (const value of values) {
        if (scope === 'users') await post({ action: 'user.update', email: value, status: 'suspended' });
        if (scope === 'organizations') await post({ action: 'organization.update', id: value, status: 'archived' });
        if (scope === 'workspaces') {
          const [organizationId, id] = value.split('|');
          await post({ action: 'workspace.delete', organizationId, id });
        }
        done += 1;
      }
      toast(`${done} registro(s) processado(s) com sucesso.`, 'success');
      await load();
    } catch (error) { toast(`${done} registro(s) processado(s). ${error.message}`, 'error'); }
    finally { target.disabled = false; }
  }

  function exportCurrent() {
    const rows = array(state.payload?.data);
    const data = rows.length ? rows : [object(state.payload?.data)];
    const content = JSON.stringify({ exportedAt: new Date().toISOString(), page: state.page, records: data }, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lifeos-${state.page}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    toast('Exportação preparada com os dados reais filtrados.', 'success');
  }

  async function handleClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'navigate') {
      state.page = button.dataset.page || 'overview'; state.query = ''; state.status = ''; state.plan = ''; state.pageNumber = 1;
      history.replaceState({}, '', `#${state.page}`); await load(); return;
    }
    if (action === 'refresh') return load();
    if (action === 'export') return exportCurrent();
    if (action === 'page') { state.pageNumber += button.dataset.direction === 'next' ? 1 : -1; return load(); }
    if (action === 'close-dialog') { el('#lifeos-admin-dialog')?.remove(); return; }
    if (action === 'invite-user') return showUserForm();
    if (action === 'edit-user') return showUserForm(button.dataset.email);
    if (action === 'toggle-user') return confirmAction(`Confirma ${button.dataset.status === 'suspended' ? 'reativar' : 'suspender'} este usuário?`, { action: 'user.update', email: button.dataset.email, status: button.dataset.status === 'suspended' ? 'active' : 'suspended' }, button);
    if (action === 'delete-user') return confirmAction('Confirma mover este usuário para exclusão lógica? O rollback ficará disponível por uma hora.', { action: 'user.delete', email: button.dataset.email }, button);
    if (action === 'create-org') return showOrganizationForm();
    if (action === 'edit-org') return showOrganizationForm(button.dataset.id);
    if (action === 'toggle-org') return confirmAction(`Confirma ${button.dataset.status === 'suspended' ? 'reativar' : 'suspender'} esta organização?`, { action: 'organization.update', id: button.dataset.id, status: button.dataset.status === 'suspended' ? 'active' : 'suspended' }, button);
    if (action === 'archive-org') return confirmAction('Confirma arquivar esta organização? O rollback ficará disponível por uma hora.', { action: 'organization.delete', id: button.dataset.id }, button);
    if (action === 'create-workspace') return showWorkspaceForm();
    if (action === 'edit-workspace') return showWorkspaceForm(button.dataset.org, button.dataset.id);
    if (action === 'archive-workspace') return confirmAction('Confirma arquivar este workspace? O rollback ficará disponível por uma hora.', { action: 'workspace.delete', organizationId: button.dataset.org, id: button.dataset.id }, button);
    if (action === 'create-plan') return showPlanForm();
    if (action === 'edit-plan') return showPlanForm(button.dataset.id);
    if (action === 'archive-plan') return confirmAction('Confirma arquivar este plano? O rollback ficará disponível por uma hora.', { action: 'plan.delete', id: button.dataset.id }, button);
    if (action === 'create-subscription') return showSubscriptionForm();
    if (action === 'edit-subscription') return showSubscriptionForm(button.dataset.id);
    if (action === 'cancel-subscription') return confirmAction('Confirma cancelar esta assinatura? O rollback ficará disponível por uma hora.', { action: 'subscription.cancel', id: button.dataset.id }, button);
    if (action === 'create-flag') return showFlagForm();
    if (action === 'toggle-flag') return confirmAction('Confirma alterar o estado desta feature flag?', { action: 'flag.upsert', key: button.dataset.key, enabled: button.dataset.enabled !== 'true' }, button);
    if (action === 'delete-flag') return confirmAction('Confirma remover esta feature flag?', { action: 'flag.delete', key: button.dataset.key }, button);
    if (action === 'clear-logs') return confirmAction('Confirma limpar os logs persistidos? O rollback ficará disponível por uma hora.', { action: 'logs.clear' }, button);
    if (action === 'revoke-sessions') return confirmAction('Confirma revogar todas as sessões deste usuário?', { action: 'security.revokeSessions', email: button.dataset.email }, button);
    if (action === 'edit-system') return showSystemForm();
    if (action === 'clear-cache') return confirmAction('Confirma limpar o cache persistido da plataforma?', { action: 'system.cache.clear' }, button);
    if (action === 'deploy-ready') return toast('Pronto para ativação. A publicação remota será habilitada após a configuração do token oficial do Cloudflare.', 'info');
    if (action === 'disconnect-integration') return confirmAction('Confirma desconectar esta integração? O rollback ficará disponível por uma hora.', { action: 'integration.disconnect', key: button.dataset.key }, button);
    if (action === 'bulk') return performBulk(button.dataset.bulk, button);
  }

  function handleFilter(event) {
    const target = event.target;
    if (target.id === 'lifeos-admin-search') {
      window.clearTimeout(handleFilter.timer);
      handleFilter.timer = window.setTimeout(() => { state.query = target.value.trim(); state.pageNumber = 1; load(); }, 280);
    }
    if (target.id === 'lifeos-admin-status') { state.status = target.value; state.pageNumber = 1; load(); }
    if (target.id === 'lifeos-admin-plan') { state.plan = target.value; state.pageNumber = 1; load(); }
  }

  async function boot() {
    try {
      const session = await fetch('/api/session', { credentials: 'same-origin' }).then((response) => response.json());
      if (!session?.ok || session.user?.role !== 'admin') return;
      injectStyle(); shell();
      const hash = location.hash.replace(/^#/, '');
      if (NAVIGATION.some(([id]) => id === hash)) state.page = hash;
      document.addEventListener('click', handleClick);
      document.addEventListener('input', handleFilter);
      document.addEventListener('change', handleFilter);
      await load();
    } catch (error) {
      console.error('Admin completion boot error', error);
    }
  }

  window.LifeosAdminCompletion = { boot, load };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
