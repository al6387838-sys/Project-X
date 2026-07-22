/* LIFEOS ENTERPRISE v48.0.0 — User Experience Completion
 * Camada progressiva para as superfícies obrigatórias da Phase 304.
 * Reutiliza as APIs e rotas existentes sem substituir a arquitetura do dashboard.
 */
(function () {
  'use strict';

/* ═══ Offline Detection & Error Recovery ═══ */
let lifeosOffline = false;
window.addEventListener('online', () => {
  lifeosOffline = false;
  const toast = document.getElementById('lifeos-offline-toast');
  if (toast) toast.style.display = 'none';
  console.info('[LifeOS] Connection restored');
});
window.addEventListener('offline', () => {
  lifeosOffline = true;
  showOfflineToast();
  console.warn('[LifeOS] Connection lost');
});
function showOfflineToast() {
  let toast = document.getElementById('lifeos-offline-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'lifeos-offline-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-label', 'Aviso de conexão offline');
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#F59E0B;color:#1E293B;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.25);display:flex;align-items:center;gap:10px';
    toast.innerHTML = '<span style="font-size:20px">⚠</span><span>Você está offline. Dados serão sincronizados ao reconectar.</span>';
    document.body.appendChild(toast);
  }
  toast.style.display = 'flex';
}
function safeFetch(url, opts = {}) {
  if (lifeosOffline) {
    return Promise.reject(new Error('Sem conexão com a internet'));
  }
  return fetch(url, opts).catch(err => {
    if (!lifeosOffline) showOfflineToast();
    return Promise.reject(err);
  });
}
// Monkey-patch fetch for graceful offline handling
const origFetch = window.fetch;
window.fetch = function(url, opts) {
  return origFetch(url, opts).catch(err => {
    if (err.name === 'TypeError' && !lifeosOffline) {
      showOfflineToast();
    }
    throw err;
  });
};


  const ROUTES = {
    dashboard: 'dashboard',
    agenda: 'agenda',
    projects: 'projects',
    crm: 'crm',
    workspace: 'workspace',
    ai: 'ai',
    'ai-center': 'ai',
    documents: 'documents',
    profile: 'profile',
    settings: 'settings',
    notifications: 'notifications',
    goals: 'goals',
    timeline: 'history',
    history: 'history',
  };

  const TITLES = {
    dashboard: ['Dashboard', 'Visão operacional atualizada com dados da sua conta.'],
    agenda: ['Agenda', 'Compromissos e tarefas persistidos na sua conta.'],
    projects: ['Projetos', 'Planeje, acompanhe e mantenha o contexto do trabalho.'],
    crm: ['CRM', 'Relacionamentos, oportunidades e histórico comercial do workspace.'],
    workspace: ['Workspace', 'Ambientes de trabalho persistidos e organizados por contexto.'],
    ai: ['IA', 'Insights gerados a partir de dados reais e serviços habilitados.'],
    documents: ['Documentos', 'Arquivos, versões, compartilhamentos e governança documental.'],
    profile: ['Perfil', 'Dados pessoais e identidade da sua conta.'],
    settings: ['Configurações', 'Preferências, notificações, privacidade e segurança.'],
    notifications: ['Notificações', 'Eventos operacionais entregues à sua conta.'],
    goals: ['Metas', 'Objetivos pessoais e indicadores de progresso.'],
    history: ['Histórico', 'Linha do tempo dos eventos registrados na sua operação.'],
  };

  const state = { route: 'dashboard', crm: null, settings: null, profile: null };
  let legacyShowPage = null;
  let host = null;
  let modal = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function dateLabel(value, withTime) {
    if (!value) return 'Sem data';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' } : {}),
    }).format(date);
  }

  function compactMoney(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(amount) ? amount : 0);
  }

  function notification(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type || 'info');
      return;
    }
    if (typeof window.showToast === "function") window.showToast(message, "error"); else console.warn(message);
  }

  function errorText(error) {
    const message = String(error?.message || error || 'Não foi possível concluir a operação.');
    if (/credencial|configurad|oauth|integração|integration|external|extern/i.test(message)) return 'Pronto para ativação.';
    return message;
  }

  async function request(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options?.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    });
    let payload = null;
    try { payload = await response.json(); } catch (_) { payload = { ok: false, error: `Resposta inválida (${response.status})` }; }
    if (!response.ok || payload?.ok === false) {
      const error = new Error(payload?.error || payload?.message || `Falha na operação (${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload || {};
  }

  function get(path) { return request(path); }
  function post(path, data) { return request(path, { method: 'POST', body: JSON.stringify(data || {}) }); }
  function put(path, data) { return request(path, { method: 'PUT', body: JSON.stringify(data || {}) }); }
  function del(path) { return request(path, { method: 'DELETE' }); }

  function ensureHost() {
    if (host) return host;
    const content = document.querySelector('.content');
    if (!content) return null;
    host = document.createElement('section');
    host.id = 'lifeos-user-completion';
    host.className = 'page lifeos-user-completion-page';
    host.setAttribute('aria-live', 'polite');
    content.appendChild(host);
    host.addEventListener('click', handleAction);
    host.addEventListener('change', handleChange);
    return host;
  }

  function addStyles() {
    if (document.getElementById('lifeos-user-completion-styles')) return;
    const style = document.createElement('style');
    style.id = 'lifeos-user-completion-styles';
    style.textContent = `
      .lifeos-user-completion-page{display:none;min-height:calc(100vh - 72px);padding:4px 0 32px}.lifeos-user-completion-page.active{display:block}.l43-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px}.l43-grid{display:grid;gap:16px}.l43-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.l43-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.l43-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.l43-card{background:var(--bg-card,var(--bg-elevated));border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.12)}.l43-card h3{font-size:14px;margin:0 0 8px;color:var(--text-primary)}.l43-kpi{font-size:28px;font-weight:750;letter-spacing:-.03em;color:var(--text-primary)}.l43-muted{color:var(--text-muted);font-size:13px;line-height:1.55}.l43-list{display:flex;flex-direction:column;gap:8px}.l43-row{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-elevated)}.l43-row-main{min-width:0;display:flex;flex-direction:column;gap:3px}.l43-row-title{font-size:13px;font-weight:650;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.l43-row-meta{font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.l43-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.l43-status{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:650;background:rgba(99,102,241,.16);color:var(--accent-light,#a5b4fc)}.l43-status.ok{background:rgba(16,185,129,.14);color:#34d399}.l43-status.warn{background:rgba(245,158,11,.14);color:#fbbf24}.l43-status.danger{background:rgba(239,68,68,.14);color:#fca5a5}.l43-empty{border:1px dashed var(--border);border-radius:14px;padding:40px 22px;text-align:center;background:rgba(15,23,42,.18)}.l43-empty h3{font-size:16px;margin:0 0 8px}.l43-empty p{max-width:520px;margin:0 auto 18px;color:var(--text-muted);font-size:13px;line-height:1.6}.l43-loading{padding:44px;text-align:center;color:var(--text-muted);font-size:13px}.l43-error{border-color:rgba(239,68,68,.5);background:rgba(127,29,29,.14)}.l43-form{display:grid;gap:14px}.l43-form label{display:grid;gap:6px;font-size:12px;font-weight:600;color:var(--text-secondary)}.l43-form input,.l43-form textarea,.l43-form select{width:100%;box-sizing:border-box;background:var(--bg-elevated);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;padding:10px 11px;font:inherit}.l43-form textarea{min-height:90px;resize:vertical}.l43-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}.l43-modal{position:fixed;inset:0;z-index:11000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.72)}.l43-modal-card{width:min(560px,100%);max-height:calc(100vh - 36px);overflow:auto;background:var(--bg-card,#172033);border:1px solid var(--border);border-radius:16px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.48)}.l43-modal-title{font-size:17px;font-weight:720;margin:0 0 16px;color:var(--text-primary)}.l43-table-wrap{overflow:auto}.l43-table{width:100%;border-collapse:collapse;font-size:13px}.l43-table th,.l43-table td{text-align:left;padding:11px 8px;border-bottom:1px solid var(--border);vertical-align:middle}.l43-table th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)}.l43-toggle{appearance:none;width:42px;height:23px;border-radius:999px;border:1px solid var(--border);background:var(--bg-elevated);cursor:pointer;position:relative;transition:.15s}.l43-toggle:after{content:'';position:absolute;width:17px;height:17px;left:2px;top:2px;border-radius:50%;background:var(--text-muted);transition:.15s}.l43-toggle:checked{background:var(--accent);border-color:var(--accent)}.l43-toggle:checked:after{transform:translateX(18px);background:#fff}.l43-chip-row{display:flex;gap:7px;flex-wrap:wrap}.l43-chip{border:1px solid var(--border);border-radius:999px;padding:5px 9px;color:var(--text-secondary);font-size:11px}.l43-warning{border-left:3px solid #f59e0b;padding:11px 13px;background:rgba(245,158,11,.08);border-radius:6px;color:var(--text-secondary);font-size:13px;line-height:1.5}@media(max-width:860px){.l43-grid.two,.l43-grid.three,.l43-grid.four{grid-template-columns:1fr}.l43-row{align-items:flex-start;flex-direction:column}.l43-actions{justify-content:flex-start}.l43-card{padding:15px}}
    `;
    document.head.appendChild(style);
  }

  function pageHeader(route, actions) {
    const [title, subtitle] = TITLES[route] || [route, ''];
    return `<div class="page-header"><div><div class="page-title">${title}</div><div class="page-subtitle">${subtitle}</div></div>${actions || ''}</div>`;
  }

  function button(action, label, opts) {
    const classes = opts?.secondary ? 'btn btn-ghost' : 'btn btn-primary';
    const confirmText = opts?.confirm ? ` data-confirm="${escapeAttribute(opts.confirm)}"` : '';
    const extra = opts?.extra ? ` ${opts.extra}` : '';
    return `<button type="button" class="${classes}" data-action="${escapeAttribute(action)}"${confirmText}${extra}>${escapeHtml(label)}</button>`;
  }

  function empty(title, description, action, label) {
    return `<div class="l43-empty"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${action ? button(action, label || 'Começar agora') : ''}</div>`;
  }

  function loading() {
    return `<div class="l43-loading" role="status" aria-label="Carregando" style="padding:0">
      <div style="height:32px;width:45%;border-radius:8px;background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(99,102,241,.08) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;margin-bottom:18px"></div>
      <div class="l43-grid two" style="gap:14px">
        ${Array.from({length:4}).map(()=>`<div style="height:100px;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(99,102,241,.08) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite"></div>`).join('')}
      </div>
    </div>`;
  }

  function renderError(route, error) {
    if (!host) return;
    host.innerHTML = `${pageHeader(route, button('refresh', 'Tentar novamente', { secondary: true }))}<div class="l43-card l43-error"><h3>Não foi possível carregar esta área</h3><p class="l43-muted">${escapeHtml(errorText(error))}</p><div style="margin-top:14px">${button('refresh', 'Atualizar dados')}</div></div>`;
  }

  function setActiveNav(route) {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach((item) => {
      const handler = item.getAttribute('onclick') || '';
      const routeMatch = Object.entries(ROUTES).find(([source, normalized]) => normalized === route && handler.includes(`'${source}'`));
      if (routeMatch) item.classList.add('active');
    });
  }

  function hideLegacySurfaces() {
    document.querySelectorAll('.content > .page').forEach((page) => {
      if (page !== host) page.classList.remove('active');
    });
    document.querySelectorAll('.content > [id^="module-"]').forEach((container) => { container.hidden = true; });
  }

  function showRoute(route) {
    const root = ensureHost();
    if (!root) return;
    hideLegacySurfaces();
    root.classList.add('active');
    root.hidden = false;
    state.route = route;
    setActiveNav(route);
    history.replaceState({}, '', `#${route}`);
    const main = document.querySelector('.content');
    if (main) main.scrollTop = 0;
  }

  async function navigate(id) {
    const route = ROUTES[id];
    if (!route) return legacyShowPage ? legacyShowPage(id) : undefined;
    showRoute(route);
    host.innerHTML = `${pageHeader(route)}${loading()}`;
    try {
      await renderRoute(route);
    } catch (error) {
      console.warn('LifeOS user completion route error:', route, error);
      renderError(route, error);
    }
  }

  function normalizeArray(payload, property) {
    const value = payload?.[property];
    return Array.isArray(value) ? value : [];
  }

  function standardRow(title, meta, actionHtml, status) {
    return `<div class="l43-row"><div class="l43-row-main"><div class="l43-row-title">${escapeHtml(title || 'Sem título')}</div><div class="l43-row-meta">${escapeHtml(meta || 'Sem detalhes')}</div></div><div class="l43-actions">${status ? `<span class="l43-status ${status.className || ''}">${escapeHtml(status.label)}</span>` : ''}${actionHtml || ''}</div></div>`;
  }

  async function renderRoute(route) {
    if (route === 'dashboard') return renderDashboard();
    if (route === 'agenda') return renderAgenda();
    if (route === 'projects') return renderProjects();
    if (route === 'crm') return renderCrm();
    if (route === 'workspace') return renderWorkspace();
    if (route === 'ai') return renderAi();
    if (route === 'documents') return renderDocuments();
    if (route === 'profile') return renderProfile();
    if (route === 'settings') return renderSettings();
    if (route === 'notifications') return renderNotifications();
    if (route === 'goals') return renderGoals();
    if (route === 'history') return renderHistory();
  }

  async function renderDashboard() {
    const today = new Date().toISOString().slice(0, 10);
    const [tasksResult, goalsResult, projectsResult, eventsResult, metricsResult] = await Promise.all([
      get('/api/tasks').catch(() => ({ tasks: [] })),
      get('/api/goals').catch(() => ({ goals: [] })),
      get('/api/projects').catch(() => ({ projects: [] })),
      get(`/api/events?date=${today}`).catch(() => ({ events: [] })),
      get('/api/metrics').catch(() => ({ metrics: {} })),
    ]);
    const tasks = normalizeArray(tasksResult, 'tasks');
    const goals = normalizeArray(goalsResult, 'goals');
    const projects = normalizeArray(projectsResult, 'projects');
    const events = normalizeArray(eventsResult, 'events');
    const done = tasks.filter((task) => task.status === 'done').length;
    const metrics = metricsResult?.metrics || {};
    host.innerHTML = `${pageHeader('dashboard', `<div class="l43-actions">${button('new-event', 'Novo evento', { secondary: true })}${button('new-task', 'Nova tarefa')}</div>`)}
      <div class="l43-grid four"><div class="l43-card"><h3>Tarefas concluídas</h3><div class="l43-kpi">${done}/${tasks.length}</div><div class="l43-muted">Dados persistidos na sua conta.</div></div><div class="l43-card"><h3>Metas ativas</h3><div class="l43-kpi">${goals.length}</div><div class="l43-muted">Objetivos disponíveis para acompanhamento.</div></div><div class="l43-card"><h3>Projetos</h3><div class="l43-kpi">${projects.length}</div><div class="l43-muted">Contextos de trabalho cadastrados.</div></div><div class="l43-card"><h3>Eventos de hoje</h3><div class="l43-kpi">${events.length}</div><div class="l43-muted">${escapeHtml(metrics?.focusLabel || 'Agenda atualizada em tempo real.')}</div></div></div>
      <div class="l43-grid two" style="margin-top:16px"><div class="l43-card"><h3>Próximas tarefas</h3><div class="l43-list">${tasks.slice(0, 5).map((task) => standardRow(task.title, task.dueDate ? `Prazo: ${dateLabel(task.dueDate)}` : 'Sem prazo definido', task.status === 'done' ? '' : button(`task-done:${task.id}`, 'Concluir', { secondary: true }), { label: task.status === 'done' ? 'Concluída' : 'Pendente', className: task.status === 'done' ? 'ok' : 'warn' })).join('') || empty('Nenhuma tarefa pendente', 'Crie uma tarefa para iniciar seu plano operacional.', 'new-task', 'Criar tarefa')}</div></div><div class="l43-card"><h3>Próximos eventos</h3><div class="l43-list">${events.slice(0, 5).map((event) => standardRow(event.title, `${dateLabel(event.date || today)}${event.time ? ` às ${event.time}` : ''}`, '', { label: 'Agendado' })).join('') || empty('Agenda livre', 'Nenhum evento foi encontrado para hoje.', 'new-event', 'Agendar evento')}</div></div></div>`;
  }

  async function renderAgenda() {
    const today = new Date().toISOString().slice(0, 10);
    const [eventsResult, tasksResult] = await Promise.all([get(`/api/events?date=${today}`), get('/api/tasks')]);
    const events = normalizeArray(eventsResult, 'events');
    const tasks = normalizeArray(tasksResult, 'tasks').filter((task) => task.dueDate === today || !task.dueDate);
    host.innerHTML = `${pageHeader('agenda', `<div class="l43-actions">${button('new-task', 'Nova tarefa', { secondary: true })}${button('new-event', 'Novo evento')}</div>`)}
      <div class="l43-grid two"><div class="l43-card"><h3>Eventos de hoje</h3><div class="l43-list">${events.map((event) => standardRow(event.title, `${event.time || 'Sem horário'} · ${event.duration || 'Duração não definida'}`, button(`event-delete:${event.id}`, 'Remover', { secondary: true, confirm: 'Remover este evento?' }), { label: 'Agendado' })).join('') || empty('Sua agenda está livre', 'Crie um evento para registrar um compromisso, reunião ou bloco de foco.', 'new-event', 'Criar evento')}</div></div><div class="l43-card"><h3>Tarefas do dia</h3><div class="l43-list">${tasks.map((task) => standardRow(task.title, task.description || 'Sem descrição', task.status === 'done' ? '' : button(`task-done:${task.id}`, 'Concluir', { secondary: true }), { label: task.status === 'done' ? 'Concluída' : 'Pendente', className: task.status === 'done' ? 'ok' : 'warn' })).join('') || empty('Nenhuma tarefa para hoje', 'Crie uma tarefa para organizar as próximas entregas.', 'new-task', 'Criar tarefa')}</div></div></div>`;
  }

  async function renderProjects() {
    const result = await get('/api/projects');
    const projects = normalizeArray(result, 'projects');
    host.innerHTML = `${pageHeader('projects', button('new-project', 'Novo projeto'))}<div class="l43-grid three">${projects.map((project) => `<article class="l43-card"><div class="l43-toolbar"><span class="l43-status ${project.status === 'completed' ? 'ok' : ''}">${escapeHtml(project.status || 'active')}</span>${button(`project-delete:${project.id}`, 'Excluir', { secondary: true, confirm: `Excluir o projeto “${project.title}”?` })}</div><h3>${escapeHtml(project.title)}</h3><p class="l43-muted">${escapeHtml(project.description || 'Sem descrição. Use o projeto para concentrar suas tarefas e entregas.')}</p><div class="l43-chip-row" style="margin-top:14px"><span class="l43-chip">${Number(project.taskCount || 0)} tarefa(s)</span><span class="l43-chip">${Number(project.pendingCount || 0)} pendente(s)</span><span class="l43-chip">Progresso ${Number(project.progress || 0)}%</span></div></article>`).join('') || `<div style="grid-column:1/-1">${empty('Nenhum projeto criado', 'Crie o primeiro projeto para centralizar tarefas, decisões e evolução do trabalho.', 'new-project', 'Criar projeto')}</div>`}</div>`;
  }

  async function renderCrm() {
    const result = await get('/api/crm');
    const data = result?.data || {};
    state.crm = data;
    if (!data.organization) {
      host.innerHTML = `${pageHeader('crm', button('crm-create-organization', 'Criar organização'))}${empty('CRM aguardando organização', 'Crie uma organização para habilitar contatos, oportunidades, pipeline, agenda comercial e histórico auditável.', 'crm-create-organization', 'Criar organização')}`;
      return;
    }
    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    const deals = Array.isArray(data.deals) ? data.deals : [];
    const metrics = data.metrics || {};
    host.innerHTML = `${pageHeader('crm', `<div class="l43-actions">${button('crm-new-contact', 'Novo contato', { secondary: true })}${button('crm-new-deal', 'Nova oportunidade')}</div>`)}
      <div class="l43-warning">Organização: <strong>${escapeHtml(data.organization.name)}</strong> · Workspace: <strong>${escapeHtml(data.workspace?.name || 'Sem workspace')}</strong>. Todas as alterações são registradas no histórico da operação.</div>
      <div class="l43-grid four" style="margin-top:16px"><div class="l43-card"><h3>Contatos</h3><div class="l43-kpi">${Number(metrics.contactCount || contacts.length)}</div></div><div class="l43-card"><h3>Oportunidades</h3><div class="l43-kpi">${Number(metrics.opportunityCount || deals.length)}</div></div><div class="l43-card"><h3>Pipeline</h3><div class="l43-kpi" style="font-size:20px">${compactMoney(metrics.pipelineTotal)}</div></div><div class="l43-card"><h3>Fechado ganho</h3><div class="l43-kpi" style="font-size:20px">${compactMoney(metrics.wonTotal)}</div></div></div>
      <div class="l43-grid two" style="margin-top:16px"><div class="l43-card"><h3>Contatos recentes</h3><div class="l43-list">${contacts.slice(0, 6).map((contact) => standardRow(contact.name, [contact.company, contact.email].filter(Boolean).join(' · ') || 'Sem dados complementares', button(`crm-contact-delete:${contact.id}`, 'Excluir', { secondary: true, confirm: `Excluir o contato “${contact.name}”?` }), { label: contact.status || 'lead' })).join('') || empty('Nenhum contato cadastrado', 'Cadastre seu primeiro contato para construir a base do CRM.', 'crm-new-contact', 'Adicionar contato')}</div></div><div class="l43-card"><h3>Oportunidades recentes</h3><div class="l43-list">${deals.slice(0, 6).map((deal) => standardRow(deal.title, `${compactMoney(deal.value)} · ${deal.company || 'Sem empresa'}`, button(`crm-deal-next:${deal.id}`, 'Avançar', { secondary: true }), { label: deal.stage || 'lead' })).join('') || empty('Nenhuma oportunidade criada', 'Adicione uma oportunidade para iniciar o acompanhamento do pipeline.', 'crm-new-deal', 'Criar oportunidade')}</div></div></div>`;
  }

  async function renderWorkspace() {
    const result = await get('/api/workspaces');
    const workspaces = normalizeArray(result, 'workspaces');
    host.innerHTML = `${pageHeader('workspace', button('new-workspace', 'Novo workspace'))}<div class="l43-grid three">${workspaces.map((workspace) => `<article class="l43-card"><div class="l43-toolbar"><span class="l43-status ${workspace.isDefault ? 'ok' : ''}">${workspace.isDefault ? 'Padrão' : 'Ativo'}</span>${workspace.isDefault ? '' : button(`workspace-delete:${workspace.id}`, 'Excluir', { secondary: true, confirm: `Excluir o workspace “${workspace.name}”?` })}</div><h3>${escapeHtml(workspace.name)}</h3><p class="l43-muted">${escapeHtml(workspace.description || 'Sem descrição. Configure este ambiente para representar um contexto de trabalho.')}</p><div class="l43-chip-row" style="margin-top:14px"><span class="l43-chip">Atualizado ${dateLabel(workspace.updatedAt || workspace.createdAt)}</span></div></article>`).join('') || `<div style="grid-column:1/-1">${empty('Nenhum workspace criado', 'Crie um ambiente de trabalho para separar seus contextos operacionais.', 'new-workspace', 'Criar workspace')}</div>`}</div>`;
  }

  async function renderAi() {
    const result = await get('/api/ai-insights');
    const insights = normalizeArray(result, 'insights');
    host.innerHTML = `${pageHeader('ai', `<div class="l43-actions">${button('ai-request', 'Nova análise', { secondary: true })}${button('refresh', 'Atualizar')}</div>`)}<div class="l43-warning">A IA utiliza os dados da conta e só executa capacidades para as quais os serviços oficiais estejam habilitados. Recursos sem credenciais mostram o estado “Pronto para ativação”.</div><div class="l43-list" style="margin-top:16px">${insights.map((insight) => `<article class="l43-card"><div class="l43-toolbar"><span class="l43-status">${escapeHtml(insight.type || insight.category || 'Insight')}</span><span class="l43-muted">${dateLabel(insight.createdAt || insight.date, true)}</span></div><h3>${escapeHtml(insight.title || 'Insight operacional')}</h3><p class="l43-muted">${escapeHtml(insight.text || insight.content || insight.description || 'Nenhum conteúdo adicional foi retornado.')}</p></article>`).join('') || empty('Nenhum insight disponível', 'Solicite uma análise ou adicione dados à sua operação para gerar recomendações.', 'ai-request', 'Solicitar análise')}</div>`;
  }

  async function renderDocuments() {
    const [listResult, statsResult, favoritesResult] = await Promise.all([
      get('/api/documents?view=list'),
      get('/api/documents?view=stats').catch(() => ({ stats: {} })),
      get('/api/documents?view=favorites').catch(() => ({ documents: [] })),
    ]);
    const documents = normalizeArray(listResult, 'documents');
    const stats = statsResult?.stats || {};
    const favorites = normalizeArray(favoritesResult, 'documents');
    host.innerHTML = `${pageHeader('documents', `<div class="l43-actions">${button('document-trash', 'Lixeira', { secondary: true })}${button('document-upload', 'Enviar arquivo', { secondary: true })}${button('document-create', 'Novo documento')}</div>`)}
      <div class="l43-grid three"><div class="l43-card"><h3>Documentos</h3><div class="l43-kpi">${Number(stats.total || documents.length)}</div></div><div class="l43-card"><h3>Favoritos</h3><div class="l43-kpi">${Number(stats.favorites || favorites.length)}</div></div><div class="l43-card"><h3>Armazenamento</h3><div class="l43-kpi" style="font-size:20px">${Math.round(Number(stats.totalSize || 0) / 1024)} KB</div></div></div>
      <div class="l43-card" style="margin-top:16px"><h3>Arquivos ativos</h3><div class="l43-list">${documents.map((document) => standardRow(document.name, `${document.mimeType || 'Arquivo'} · v${document.version || 1} · ${dateLabel(document.updatedAt || document.createdAt, true)}`, `${button(`document-download:${document.id}`, 'Baixar', { secondary: true })}${button(`document-rename:${document.id}`, 'Renomear', { secondary: true })}${button(`document-move:${document.id}`, 'Mover', { secondary: true })}${button(`document-share:${document.id}`, 'Compartilhar', { secondary: true })}${button(`document-version:${document.id}`, 'Nova versão', { secondary: true })}${button(`document-history:${document.id}`, 'Histórico', { secondary: true })}${button(`document-favorite:${document.id}`, document.favorite ? 'Desfavoritar' : 'Favoritar', { secondary: true })}${button(`document-delete:${document.id}`, 'Mover para lixeira', { secondary: true, confirm: `Mover “${document.name}” para a lixeira?` })}`, { label: document.favorite ? 'Favorito' : 'Ativo', className: document.favorite ? 'ok' : '' })).join('') || empty('Nenhum documento ativo', 'Crie ou envie um arquivo para iniciar o workspace documental.', 'document-upload', 'Enviar arquivo')}</div></div>`;
  }

  async function renderProfile() {
    const result = await get('/api/session');
    const profile = result?.user || result?.profile || result || {};
    state.profile = profile;
    host.innerHTML = `${pageHeader('profile', button('profile-save', 'Salvar alterações'))}<div class="l43-grid two"><div class="l43-card"><h3>Dados da conta</h3><form id="l43-profile-form" class="l43-form"><label>Nome<input name="name" maxlength="100" value="${escapeAttribute(profile.name || '')}" required></label><label>E-mail<input name="email" type="email" value="${escapeAttribute(profile.email || profile.username || '')}" readonly aria-readonly="true"></label><label>Fuso horário<select name="timezone"><option value="America/Sao_Paulo" ${profile.timezone === 'America/Sao_Paulo' || !profile.timezone ? 'selected' : ''}>Brasília (GMT-3)</option><option value="UTC" ${profile.timezone === 'UTC' ? 'selected' : ''}>UTC</option><option value="Europe/Lisbon" ${profile.timezone === 'Europe/Lisbon' ? 'selected' : ''}>Lisboa</option></select></label></form></div><div class="l43-card"><h3>Segurança da conta</h3><p class="l43-muted">Use as configurações para alterar senha, revisar sessões e administrar dispositivos vinculados.</p><div class="l43-actions" style="margin-top:16px;justify-content:flex-start">${button('open-settings-security', 'Abrir segurança', { secondary: true })}${button('export-data', 'Exportar dados', { secondary: true })}</div></div></div>`;
  }

  async function renderSettings() {
    const result = await get('/api/settings');
    const settings = result?.settings || {};
    state.settings = settings;
    const notifications = settings.notifications || {};
    const display = settings.display || {};
    const privacy = settings.privacy || {};
    const security = settings.security || {};
    host.innerHTML = `${pageHeader('settings', button('settings-save', 'Salvar preferências'))}<div class="l43-grid two"><section class="l43-card"><h3>Aparência</h3><div class="l43-list"><div class="l43-row"><div class="l43-row-main"><div class="l43-row-title">Animações</div><div class="l43-row-meta">Controla efeitos visuais da interface.</div></div><input class="l43-toggle" type="checkbox" data-setting="display.animations" ${display.animations !== false ? 'checked' : ''}></div><div class="l43-row"><div class="l43-row-main"><div class="l43-row-title">Modo compacto</div><div class="l43-row-meta">Reduz o espaçamento para maior densidade de informação.</div></div><input class="l43-toggle" type="checkbox" data-setting="display.compactMode" ${display.compactMode ? 'checked' : ''}></div></div></section><section class="l43-card"><h3>Notificações</h3><div class="l43-list"><div class="l43-row"><div class="l43-row-main"><div class="l43-row-title">E-mail</div><div class="l43-row-meta">Receber avisos operacionais por e-mail.</div></div><input class="l43-toggle" type="checkbox" data-setting="notifications.email" ${notifications.email !== false ? 'checked' : ''}></div><div class="l43-row"><div class="l43-row-main"><div class="l43-row-title">Alertas de sessão</div><div class="l43-row-meta">Avisar sobre atividade de segurança da conta.</div></div><input class="l43-toggle" type="checkbox" data-setting="security.sessionAlerts" ${security.sessionAlerts !== false ? 'checked' : ''}></div></div></section><section class="l43-card"><h3>Privacidade</h3><div class="l43-list"><div class="l43-row"><div class="l43-row-main"><div class="l43-row-title">Perfil visível</div><div class="l43-row-meta">Permite apresentação do perfil nos espaços compartilhados.</div></div><input class="l43-toggle" type="checkbox" data-setting="privacy.profileVisible" ${privacy.profileVisible ? 'checked' : ''}></div><div class="l43-row"><div class="l43-row-main"><div class="l43-row-title">Atividade visível</div><div class="l43-row-meta">Expõe seu histórico quando houver colaboração autorizada.</div></div><input class="l43-toggle" type="checkbox" data-setting="privacy.activityVisible" ${privacy.activityVisible ? 'checked' : ''}></div></div></section><section class="l43-card"><h3>Segurança e dados</h3><p class="l43-muted">As ações de identidade, sessões e dispositivos executam os controles de segurança existentes da plataforma.</p><div class="l43-actions" style="justify-content:flex-start;margin-top:16px">${button('open-settings-security', 'Gerenciar segurança', { secondary: true })}${button('export-data', 'Exportar dados', { secondary: true })}</div></section></div>`;
  }

  async function renderNotifications() {
    const result = await get('/api/notifications');
    const notifications = normalizeArray(result, 'notifications');
    const unread = Number(result?.unread || notifications.filter((item) => !item.read).length);
    const count = document.getElementById('notif-count');
    if (count) count.textContent = unread ? String(unread) : '';
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = unread ? '' : 'none';
    host.innerHTML = `${pageHeader('notifications', unread ? button('notifications-read-all', 'Marcar todas como lidas') : button('refresh', 'Atualizar', { secondary: true }))}<div class="l43-list">${notifications.map((item) => standardRow(item.title || item.type || 'Notificação', item.message || item.body || dateLabel(item.createdAt || item.date, true), `${item.read ? '' : button(`notification-read:${item.id}`, 'Ler', { secondary: true })}${button(`notification-dismiss:${item.id}`, 'Remover', { secondary: true, confirm: 'Remover esta notificação?' })}`, { label: item.read ? 'Lida' : 'Não lida', className: item.read ? '' : 'warn' })).join('') || empty('Tudo em dia', 'Não há notificações pendentes na sua conta.', 'refresh', 'Atualizar')}</div>`;
  }

  async function renderGoals() {
    const result = await get('/api/goals');
    const goals = normalizeArray(result, 'goals');
    host.innerHTML = `${pageHeader('goals', button('new-goal', 'Nova meta'))}<div class="l43-grid three">${goals.map((goal) => { const progress = Math.min(100, Math.max(0, Number(goal.progress || goal.current || 0))); return `<article class="l43-card"><div class="l43-toolbar"><span class="l43-status ${goal.status === 'completed' ? 'ok' : ''}">${escapeHtml(goal.status || 'Ativa')}</span><span class="l43-muted">${progress}%</span></div><h3>${escapeHtml(goal.title || goal.name)}</h3><p class="l43-muted">${escapeHtml(goal.description || 'Sem descrição adicional.')}</p><div style="height:8px;background:var(--bg-elevated);border-radius:999px;overflow:hidden;margin-top:14px"><div style="height:100%;width:${progress}%;background:var(--accent);border-radius:inherit"></div></div><div class="l43-actions" style="justify-content:flex-start;margin-top:14px">${button(`goal-progress:${goal.id}`, 'Atualizar progresso', { secondary: true })}</div></article>`; }).join('') || `<div style="grid-column:1/-1">${empty('Nenhuma meta cadastrada', 'Defina uma meta para transformar intenção em acompanhamento mensurável.', 'new-goal', 'Criar meta')}</div>`}</div>`;
  }

  async function renderHistory() {
    const result = await get('/api/timeline');
    const events = normalizeArray(result, 'events');
    host.innerHTML = `${pageHeader('history', button('new-history', 'Registrar evento'))}<div class="l43-card"><h3>Eventos recentes</h3><div class="l43-list">${events.map((event) => standardRow(event.title || event.type || 'Evento', [event.description, dateLabel(event.createdAt || event.date, true)].filter(Boolean).join(' · '), '', { label: event.category || event.type || 'Registro' })).join('') || empty('Nenhum registro no histórico', 'Registre um evento para formar uma linha do tempo da sua operação.', 'new-history', 'Registrar evento')}</div></div>`;
  }

  function openForm(config) {
    closeModal();
    modal = document.createElement('div');
    modal.className = 'l43-modal';
    modal.innerHTML = `<div class="l43-modal-card" role="dialog" aria-modal="true" aria-labelledby="l43-modal-title"><h2 id="l43-modal-title" class="l43-modal-title">${escapeHtml(config.title)}</h2><form class="l43-form" id="l43-modal-form">${config.fields.map((field) => {
      const attrs = `${field.required ? ' required' : ''}${field.max ? ` maxlength="${field.max}"` : ''}${field.accept ? ` accept="${escapeAttribute(field.accept)}"` : ''}`;
      const value = escapeAttribute(field.value || '');
      if (field.type === 'textarea') return `<label>${escapeHtml(field.label)}<textarea name="${escapeAttribute(field.name)}"${attrs}>${value}</textarea></label>`;
      if (field.type === 'select') return `<label>${escapeHtml(field.label)}<select name="${escapeAttribute(field.name)}"${attrs}>${(field.options || []).map((option) => `<option value="${escapeAttribute(option.value)}" ${option.value === field.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
      return `<label>${escapeHtml(field.label)}<input type="${escapeAttribute(field.type || 'text')}" name="${escapeAttribute(field.name)}" value="${value}"${attrs}></label>`;
    }).join('')}<div class="l43-form-actions">${button('modal-cancel', 'Cancelar', { secondary: true })}<button type="submit" class="btn btn-primary">${escapeHtml(config.submitLabel || 'Salvar')}</button></div></form></div>`;
    modal.addEventListener('click', handleAction);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Salvando...';
      try {
        const formData = new FormData(event.currentTarget);
        await config.submit(formData);
        closeModal();
        notification(config.success || 'Operação concluída.', 'success');
        await navigate(state.route);
      } catch (error) {
        submit.disabled = false;
        submit.textContent = config.submitLabel || 'Salvar';
        notification(errorText(error), 'error');
      }
    });
    document.body.appendChild(modal);
    modal.querySelector('input,textarea,select')?.focus();
  }

  function closeModal() {
    if (modal) modal.remove();
    modal = null;
  }

  function openDocumentHistory(docId) {
    closeModal();
    const dialog = document.createElement('div');
    modal = dialog;
    dialog.className = 'l43-modal';
    dialog.innerHTML = '<div class="l43-modal-card" role="dialog" aria-modal="true"><h2 class="l43-modal-title">Histórico do documento</h2><p class="l43-muted">Carregando eventos auditáveis...</p></div>';
    dialog.addEventListener('click', handleAction);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeModal(); });
    document.body.appendChild(dialog);
    get(`/api/documents?view=history&docId=${encodeURIComponent(docId)}`).then((data) => {
      if (modal !== dialog) return;
      const events = normalizeArray(data, 'audit');
      dialog.querySelector('.l43-modal-card').innerHTML = `<h2 class="l43-modal-title">Histórico do documento</h2><div class="l43-list">${events.map((entry) => standardRow(entry.action || 'Evento', `${dateLabel(entry.at, true)} · ${entry.actor || 'sistema'}`, '', { label: 'Auditado', className: 'ok' })).join('') || empty('Nenhum evento registrado', 'O histórico será preenchido nas próximas operações.', 'modal-cancel', 'Fechar')}</div><div class="l43-form-actions">${button('modal-cancel', 'Fechar', { secondary: true })}</div>`;
    }).catch((error) => {
      if (modal !== dialog) return;
      dialog.querySelector('.l43-modal-card').innerHTML = `<h2 class="l43-modal-title">Histórico do documento</h2><p class="l43-muted">${escapeHtml(errorText(error))}</p><div class="l43-form-actions">${button('modal-cancel', 'Fechar', { secondary: true })}</div>`;
    });
  }

  function openDocumentTrash() {
    closeModal();
    const dialog = document.createElement('div');
    modal = dialog;
    dialog.className = 'l43-modal';
    dialog.innerHTML = '<div class="l43-modal-card" role="dialog" aria-modal="true"><h2 class="l43-modal-title">Lixeira de documentos</h2><p class="l43-muted">Carregando itens excluídos...</p></div>';
    dialog.addEventListener('click', handleAction);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeModal(); });
    document.body.appendChild(dialog);
    get('/api/documents?view=trash').then((data) => {
      if (modal !== dialog) return;
      const documents = normalizeArray(data, 'documents');
      dialog.querySelector('.l43-modal-card').innerHTML = `<h2 class="l43-modal-title">Lixeira de documentos</h2><div class="l43-list">${documents.map((document) => standardRow(document.name, `Excluído em ${dateLabel(document.deletedAt || document.updatedAt, true)}`, `${button(`document-restore:${document.id}`, 'Restaurar', { secondary: true })}${button(`document-permanent-delete:${document.id}`, 'Excluir definitivamente', { secondary: true, confirm: `Excluir definitivamente “${document.name}”? Esta ação não pode ser desfeita.` })}`, { label: 'Na lixeira', className: 'warn' })).join('') || empty('Lixeira vazia', 'Documentos excluídos poderão ser restaurados aqui.', 'modal-cancel', 'Fechar')}</div><div class="l43-form-actions">${button('modal-cancel', 'Fechar', { secondary: true })}</div>`;
    }).catch((error) => {
      if (modal !== dialog) return;
      dialog.querySelector('.l43-modal-card').innerHTML = `<h2 class="l43-modal-title">Lixeira de documentos</h2><p class="l43-muted">${escapeHtml(errorText(error))}</p><div class="l43-form-actions">${button('modal-cancel', 'Fechar', { secondary: true })}</div>`;
    });
  }

  function formValue(form, name) { return String(form.get(name) || '').trim(); }

  function currentCrmContext() {
    return { orgId: state.crm?.organization?.id || '', workspaceId: state.crm?.workspace?.id || '' };
  }

  async function handleAction(event) {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const action = control.dataset.action;
    if (!action) return;
    event.preventDefault();
    if (control.dataset.confirm && !window.confirm(control.dataset.confirm)) return;
    if (action === 'modal-cancel') return closeModal();
    if (action === 'refresh') return navigate(state.route);
    if (action === 'new-event') return openForm({ title: 'Novo evento', submitLabel: 'Agendar evento', fields: [{ name: 'title', label: 'Título', required: true, max: 160 }, { name: 'date', label: 'Data', type: 'date', value: new Date().toISOString().slice(0, 10), required: true }, { name: 'time', label: 'Horário', type: 'time', value: '09:00' }, { name: 'duration', label: 'Duração', value: '1h', max: 40 }, { name: 'description', label: 'Descrição', type: 'textarea', max: 1000 }], submit: async (form) => post('/api/events', { title: formValue(form, 'title'), date: formValue(form, 'date'), time: formValue(form, 'time'), duration: formValue(form, 'duration'), description: formValue(form, 'description') }), success: 'Evento agendado.' });
    if (action === 'new-task') return openForm({ title: 'Nova tarefa', submitLabel: 'Criar tarefa', fields: [{ name: 'title', label: 'Título', required: true, max: 160 }, { name: 'dueDate', label: 'Prazo', type: 'date', value: new Date().toISOString().slice(0, 10) }, { name: 'description', label: 'Descrição', type: 'textarea', max: 1000 }], submit: async (form) => post('/api/tasks', { title: formValue(form, 'title'), dueDate: formValue(form, 'dueDate'), description: formValue(form, 'description'), status: 'pending' }), success: 'Tarefa criada.' });
    if (action === 'new-project') return openForm({ title: 'Novo projeto', submitLabel: 'Criar projeto', fields: [{ name: 'title', label: 'Nome do projeto', required: true, max: 160 }, { name: 'description', label: 'Descrição', type: 'textarea', max: 1000 }], submit: async (form) => post('/api/projects', { title: formValue(form, 'title'), description: formValue(form, 'description') }), success: 'Projeto criado.' });
    if (action === 'new-workspace') return openForm({ title: 'Novo workspace', submitLabel: 'Criar workspace', fields: [{ name: 'name', label: 'Nome do workspace', required: true, max: 100 }, { name: 'description', label: 'Descrição', type: 'textarea', max: 500 }], submit: async (form) => post('/api/workspaces', { action: 'create', name: formValue(form, 'name'), description: formValue(form, 'description') }), success: 'Workspace criado.' });
    if (action === 'crm-create-organization') return openForm({ title: 'Criar organização', submitLabel: 'Criar organização', fields: [{ name: 'name', label: 'Nome da organização', required: true, max: 120 }, { name: 'description', label: 'Descrição', type: 'textarea', max: 500 }], submit: async (form) => post('/api/crm', { action: 'organization.create', name: formValue(form, 'name'), description: formValue(form, 'description') }), success: 'Organização criada e CRM habilitado.' });
    if (action === 'crm-new-contact') return openForm({ title: 'Novo contato', submitLabel: 'Salvar contato', fields: [{ name: 'name', label: 'Nome', required: true, max: 120 }, { name: 'email', label: 'E-mail', type: 'email', max: 254 }, { name: 'company', label: 'Empresa', max: 160 }, { name: 'status', label: 'Status', type: 'select', value: 'lead', options: [{ value: 'lead', label: 'Lead' }, { value: 'prospect', label: 'Prospect' }, { value: 'customer', label: 'Cliente' }, { value: 'inactive', label: 'Inativo' }] }], submit: async (form) => post('/api/crm', { action: 'contact.create', ...currentCrmContext(), name: formValue(form, 'name'), email: formValue(form, 'email'), company: formValue(form, 'company'), status: formValue(form, 'status') }), success: 'Contato cadastrado.' });
    if (action === 'crm-new-deal') return openForm({ title: 'Nova oportunidade', submitLabel: 'Criar oportunidade', fields: [{ name: 'title', label: 'Título', required: true, max: 160 }, { name: 'company', label: 'Empresa', max: 160 }, { name: 'value', label: 'Valor estimado', type: 'number', value: '0' }, { name: 'stage', label: 'Estágio', type: 'select', value: 'lead', options: (state.crm?.stages || [{ id: 'lead', name: 'Lead' }]).map((stage) => ({ value: stage.id, label: stage.name })) }], submit: async (form) => post('/api/crm', { action: 'deal.create', ...currentCrmContext(), title: formValue(form, 'title'), company: formValue(form, 'company'), value: Number(formValue(form, 'value') || 0), stage: formValue(form, 'stage') }), success: 'Oportunidade criada.' });
    if (action === 'ai-request') return openForm({ title: 'Solicitar análise de IA', submitLabel: 'Solicitar análise', fields: [{ name: 'prompt', label: 'Contexto da análise', type: 'textarea', required: true, max: 2000 }], submit: async (form) => post('/api/ai/orchestrator', { action: 'analyze', prompt: formValue(form, 'prompt') }), success: 'Solicitação enviada para processamento.' });
    if (action === 'document-create') return openForm({ title: 'Novo documento', submitLabel: 'Criar documento', fields: [{ name: 'name', label: 'Nome do documento', required: true, max: 200 }, { name: 'description', label: 'Descrição', type: 'textarea', max: 1000 }], submit: async (form) => post('/api/documents', { action: 'create', name: formValue(form, 'name'), description: formValue(form, 'description') }), success: 'Documento criado.' });
    if (action === 'document-upload') return openForm({ title: 'Enviar arquivo', submitLabel: 'Enviar arquivo', fields: [{ name: 'file', label: 'Arquivo', type: 'file', required: true, accept: '*/*' }, { name: 'description', label: 'Descrição', type: 'textarea', max: 1000 }], submit: async (form) => { const file = form.get('file'); if (!(file instanceof File) || !file.name) throw new Error('Selecione um arquivo válido.'); const body = new FormData(); body.append('file', file); body.append('description', formValue(form, 'description')); return request('/api/documents', { method: 'POST', body }); }, success: 'Arquivo enviado.' });
    if (action === 'document-trash') return openDocumentTrash();
    if (action === 'new-goal') return openForm({ title: 'Nova meta', submitLabel: 'Criar meta', fields: [{ name: 'title', label: 'Título', required: true, max: 160 }, { name: 'description', label: 'Descrição', type: 'textarea', max: 1000 }, { name: 'targetDate', label: 'Data-alvo', type: 'date' }], submit: async (form) => post('/api/goals', { title: formValue(form, 'title'), description: formValue(form, 'description'), targetDate: formValue(form, 'targetDate') }), success: 'Meta criada.' });
    if (action === 'new-history') return openForm({ title: 'Registrar evento', submitLabel: 'Registrar evento', fields: [{ name: 'title', label: 'Título', required: true, max: 160 }, { name: 'description', label: 'Descrição', type: 'textarea', max: 1000 }], submit: async (form) => post('/api/timeline', { title: formValue(form, 'title'), description: formValue(form, 'description'), type: 'manual' }), success: 'Evento registrado no histórico.' });
    if (action === 'profile-save') { const form = host.querySelector('#l43-profile-form'); if (!form) return; const data = new FormData(form); try { await post('/api/profile-update', { action: 'profile.update', name: formValue(data, 'name'), timezone: formValue(data, 'timezone') }); notification('Perfil atualizado.', 'success'); await navigate('profile'); } catch (error) { notification(errorText(error), 'error'); } return; }
    if (action === 'settings-save') { try { await post('/api/settings', state.settings || {}); notification('Preferências salvas.', 'success'); } catch (error) { notification(errorText(error), 'error'); } return; }
    if (action === 'open-settings-security') { notification('Abrindo os controles de segurança da conta.', 'info'); return legacyShowPage ? legacyShowPage('settings-security') : navigate('settings'); }
    if (action === 'export-data') { try { const data = await get('/api/user-data?action=export'); if (data.downloadUrl) window.open(data.downloadUrl, '_blank', 'noopener'); else notification('Pronto para ativação.', 'info'); } catch (error) { notification(errorText(error), 'error'); } return; }
    if (action === 'notifications-read-all') { await post('/api/notifications', { action: 'mark_read', id: 'all' }); notification('Notificações marcadas como lidas.', 'success'); return navigate('notifications'); }
    if (action.startsWith('task-done:')) { await put('/api/tasks', { id: action.slice(10), status: 'done' }); notification('Tarefa concluída.', 'success'); return navigate(state.route); }
    if (action.startsWith('event-delete:')) { await del(`/api/events?id=${encodeURIComponent(action.slice(13))}`); notification('Evento removido.', 'success'); return navigate('agenda'); }
    if (action.startsWith('project-delete:')) { await del(`/api/projects?id=${encodeURIComponent(action.slice(15))}`); notification('Projeto excluído.', 'success'); return navigate('projects'); }
    if (action.startsWith('workspace-delete:')) { await post('/api/workspaces', { action: 'delete', id: action.slice(17) }); notification('Workspace excluído.', 'success'); return navigate('workspace'); }
    if (action.startsWith('crm-contact-delete:')) { await post('/api/crm', { action: 'contact.delete', ...currentCrmContext(), id: action.slice(19) }); notification('Contato excluído.', 'success'); return navigate('crm'); }
    if (action.startsWith('crm-deal-next:')) { const id = action.slice(14); const deal = (state.crm?.deals || []).find((item) => item.id === id); const stages = state.crm?.stages || []; const current = stages.findIndex((item) => item.id === deal?.stage); const next = stages[Math.min(stages.length - 1, Math.max(0, current + 1))]; if (!deal || !next || next.id === deal.stage) { notification('A oportunidade já está no último estágio.', 'info'); return; } await post('/api/crm', { action: 'deal.move', ...currentCrmContext(), id, stage: next.id }); notification(`Oportunidade movida para ${next.name}.`, 'success'); return navigate('crm'); }
    if (action.startsWith('document-rename:')) { const id = action.slice(16); return openForm({ title: 'Renomear documento', submitLabel: 'Renomear', fields: [{ name: 'name', label: 'Novo nome', required: true, max: 200 }], submit: async (form) => post('/api/documents', { action: 'rename', docId: id, name: formValue(form, 'name') }), success: 'Documento renomeado.' }); }
    if (action.startsWith('document-move:')) { const id = action.slice(14); return openForm({ title: 'Mover documento', submitLabel: 'Mover', fields: [{ name: 'folderId', label: 'Pasta de destino', value: 'root', required: true, max: 120 }], submit: async (form) => post('/api/documents', { action: 'move', docId: id, folderId: formValue(form, 'folderId') || 'root' }), success: 'Documento movido.' }); }
    if (action.startsWith('document-share:')) { const id = action.slice(15); return openForm({ title: 'Compartilhar documento', submitLabel: 'Compartilhar', fields: [{ name: 'targetUserId', label: 'E-mail ou ID da pessoa', required: true, max: 254 }, { name: 'permission', label: 'Permissão', type: 'select', value: 'view', options: [{ value: 'view', label: 'Visualização' }, { value: 'edit', label: 'Edição' }] }], submit: async (form) => post('/api/documents', { action: 'share', docId: id, targetUserId: formValue(form, 'targetUserId'), permission: formValue(form, 'permission') || 'view' }), success: 'Documento compartilhado.' }); }
    if (action.startsWith('document-version:')) { const id = action.slice(17); return openForm({ title: 'Nova versão', submitLabel: 'Enviar versão', fields: [{ name: 'file', label: 'Arquivo da nova versão', type: 'file', required: true, accept: '*/*' }, { name: 'comment', label: 'Comentário da versão', type: 'textarea', max: 1000 }], submit: async (form) => { const file = form.get('file'); if (!(file instanceof File) || !file.name) throw new Error('Selecione um arquivo válido.'); const body = new FormData(); body.append('action', 'new-version'); body.append('docId', id); body.append('file', file); body.append('comment', formValue(form, 'comment')); return request('/api/documents', { method: 'POST', body }); }, success: 'Nova versão salva.' }); }
    if (action.startsWith('document-history:')) return openDocumentHistory(action.slice(17));
    if (action.startsWith('document-restore:')) { closeModal(); await post('/api/documents', { action: 'restore', docId: action.slice(17) }); notification('Documento restaurado.', 'success'); return navigate('documents'); }
    if (action.startsWith('document-permanent-delete:')) { closeModal(); await post('/api/documents', { action: 'permanent-delete', docId: action.slice(26) }); notification('Documento excluído definitivamente.', 'success'); return navigate('documents'); }
    if (action.startsWith('document-favorite:')) { await post('/api/documents', { action: 'toggle-favorite', docId: action.slice(18) }); notification('Favorito atualizado.', 'success'); return navigate('documents'); }
    if (action.startsWith('document-delete:')) { await post('/api/documents', { action: 'delete', docId: action.slice(16) }); notification('Documento movido para a lixeira.', 'success'); return navigate('documents'); }
    if (action.startsWith('document-download:')) { const id = action.slice(18); try { const data = await get(`/api/documents?view=download&docId=${encodeURIComponent(id)}`); if (data.downloadUrl) window.open(data.downloadUrl, '_blank', 'noopener'); else notification('Pronto para ativação.', 'info'); } catch (error) { notification(errorText(error), 'error'); } return; }
    if (action.startsWith('notification-read:')) { await post('/api/notifications', { action: 'mark_read', id: action.slice(18) }); return navigate('notifications'); }
    if (action.startsWith('notification-dismiss:')) { await post('/api/notifications', { action: 'dismiss', id: action.slice(21) }); notification('Notificação removida.', 'success'); return navigate('notifications'); }
    if (action.startsWith('goal-progress:')) { const id = action.slice(14); return openForm({ title: 'Atualizar progresso', submitLabel: 'Atualizar', fields: [{ name: 'progress', label: 'Progresso (%)', type: 'number', value: '0', required: true }], submit: async (form) => put('/api/goals', { id, progress: Math.max(0, Math.min(100, Number(formValue(form, 'progress')))) }), success: 'Progresso atualizado.' }); }
  }

  function handleChange(event) {
    const toggle = event.target.closest('[data-setting]');
    if (!toggle || !state.settings) return;
    const [section, key] = toggle.dataset.setting.split('.');
    state.settings[section] = { ...(state.settings[section] || {}), [key]: !!toggle.checked };
  }

  function addWorkspaceLink() {
    const nav = document.querySelector('aside nav');
    if (!nav || nav.querySelector('[data-lifeos-workspace-link]')) return;
    const settingsLink = Array.from(nav.querySelectorAll('.nav-item')).find((item) => (item.getAttribute('onclick') || '').includes("'settings'"));
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.lifeosWorkspaceLink = 'true';
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.innerHTML = '<div class="nav-icon"><i data-lucide="layers-3" class="pg-icon" aria-hidden="true"></i></div><span>Workspace</span>';
    const openWorkspace = (event) => {
      event?.preventDefault();
      void navigate('workspace');
    };
    item.addEventListener('click', openWorkspace);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') openWorkspace(event);
    });
    if (settingsLink) nav.insertBefore(item, settingsLink); else nav.appendChild(item);
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  function initialize() {
    addStyles();
    ensureHost();
    addWorkspaceLink();
    legacyShowPage = window.showPage;
    if (typeof legacyShowPage !== 'function') return;
    // Esta camada é complementar: não substitui o roteador principal nem seus handlers.
    // A única rota própria é Workspace, acionada diretamente pelo item dinâmico acima.
    const hash = location.hash.slice(1);
    if (hash === 'workspace') void navigate(hash);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}());
