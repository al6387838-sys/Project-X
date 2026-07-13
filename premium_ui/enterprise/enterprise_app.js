(() => {
  'use strict';

  const API = '/api/enterprise-data';
  const state = { data: null, view: 'command', busy: false, query: '' };
  const permissions = [
    ['org.read', 'Ler organização'], ['org.update', 'Editar organização'], ['members.read', 'Ler membros'],
    ['members.*', 'Gerenciar membros'], ['teams.*', 'Gerenciar equipes'], ['analytics.read', 'Ler analytics'],
    ['billing.read', 'Ler billing'], ['billing.*', 'Gerenciar billing'], ['security.*', 'Gerenciar segurança'],
    ['intelligence.read', 'Ler inteligência'], ['intelligence.*', 'Executar recomendações'], ['workspace.*', 'Acessar workspace'],
  ];

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const fmtDate = (value, withTime = false) => value ? new Intl.DateTimeFormat('pt-BR', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value)) : '—';
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const roleName = (id) => state.data?.roles.find(role => role.id === id)?.name || id;
  const cycleName = (cycle) => ({ annual: 'anual', monthly: 'mensal' }[cycle] || cycle);
  const statusBadge = (status) => `<span class="enterprise-badge ${status === 'active' || status === 'paid' || status === 'operational' ? 'success' : status === 'suspended' || status === 'cancel_at_period_end' ? 'danger' : 'warning'}">${esc(status)}</span>`;

  async function request(action, payload = {}) {
    const options = action ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, payload }) } : { method: 'GET' };
    const response = await fetch(API, options);
    if (response.status === 401) {
      location.replace(`/login?next=${encodeURIComponent('/enterprise')}`);
      throw new Error('Sessão expirada.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
    state.data = result.data;
    return result.data;
  }

  function toast(message, type = '') {
    const stack = document.querySelector('.enterprise-toast-stack');
    const node = document.createElement('div');
    node.className = `enterprise-toast ${type}`;
    node.textContent = message;
    stack.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function setBusy(value) {
    state.busy = value;
    document.querySelectorAll('[data-enterprise-action], .enterprise-btn').forEach(button => button.disabled = value);
  }

  async function mutate(action, payload, success) {
    if (state.busy) return;
    setBusy(true);
    try {
      await request(action, payload);
      render(state.view);
      toast(success);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function cards(items) { return `<div class="enterprise-grid">${items.join('')}</div>`; }
  function card(title, content, className = '') { return `<article class="enterprise-card ${className}"><h3>${title}</h3>${content}</article>`; }
  function toolbar(title, subtitle = '', actions = '') { return `<div class="enterprise-toolbar"><div><div class="enterprise-kicker">LifeOS Enterprise v3.0</div><h2>${title}</h2>${subtitle ? `<p class="enterprise-secondary">${subtitle}</p>` : ''}</div><div class="enterprise-actions">${actions}</div></div>`; }

  function renderCommand() {
    const sys = state.data.system;
    const sub = state.data.subscription;
    const insights = state.data.intelligence.filter(i => i.status === 'open');
    const recentAudit = state.data.auditLog.slice(0, 5);

    return `
      <div class="alert-banner animate-slide-in-down">
        <span class="alert-icon">◈</span>
        <span class="alert-text"><strong>Companion:</strong> ${insights.length > 0 ? `${insights[0].title}. Impacto: ${insights[0].impact.toUpperCase()}.` : 'Ambiente operacional estável e seguro.'}</span>
        <span class="alert-action" onclick="window.enterpriseApp.render('intelligence')">Revisar insights →</span>
      </div>
      <div class="section-header"><span class="section-title">Métricas Executivas</span><span class="section-action">Dados em tempo real</span></div>
      <div class="kpi-grid">
        <div class="kpi-card animate-fade-in" style="animation-delay: 0.1s">
          <div class="kpi-header"><div class="kpi-icon" style="background:rgba(99,102,241,0.12)">◈</div><div class="kpi-trend up">↑ ${sys.uptime}%</div></div>
          <div class="kpi-value" style="background:var(--gradient-primary);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${sys.uptime}%</div>
          <div class="kpi-label">Uptime do Sistema</div>
          <div class="kpi-sub">Região: ${sys.region}</div>
        </div>
        <div class="kpi-card animate-fade-in" style="animation-delay: 0.2s">
          <div class="kpi-header"><div class="kpi-icon" style="background:rgba(16,185,129,0.12)">◎</div><div class="kpi-trend up">Estável</div></div>
          <div class="kpi-value" style="color:var(--success-500)">${sys.apiP95}ms</div>
          <div class="kpi-label">Latência p95</div>
          <div class="kpi-sub">Taxa de erro: ${sys.errorRate}%</div>
        </div>
        <div class="kpi-card animate-fade-in" style="animation-delay: 0.3s">
          <div class="kpi-header"><div class="kpi-icon" style="background:rgba(245,158,11,0.12)">◇</div><div class="kpi-trend">${sub.plan}</div></div>
          <div class="kpi-value" style="color:var(--warning-500)">${state.data.members.length}</div>
          <div class="kpi-label">Membros Ativos</div>
          <div class="kpi-sub">Limite: ${sub.seats} assentos</div>
        </div>
        <div class="kpi-card animate-fade-in" style="animation-delay: 0.4s">
          <div class="kpi-header"><div class="kpi-icon" style="background:rgba(236,72,153,0.12)">◬</div><div class="kpi-trend">BRL</div></div>
          <div class="kpi-value" style="color:var(--danger-400)">${money(sub.monthlyValue)}</div>
          <div class="kpi-label">MRR Consolidado</div>
          <div class="kpi-sub">Renovação: ${fmtDate(sub.renewalAt)}</div>
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="enterprise-card full animate-fade-in" style="animation-delay: 0.5s">
          <h3>Atividade Recente</h3>
          <div class="enterprise-table-wrap">
            <table class="enterprise-table enterprise-audit">
              <thead><tr><th>Data</th><th>Ator</th><th>Evento</th><th>Detalhe</th></tr></thead>
              <tbody>${recentAudit.map(log => `<tr><td>${fmtDate(log.createdAt, true)}</td><td><strong>${esc(log.actor)}</strong></td><td>${esc(log.action)}</td><td>${esc(log.detail)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderOrganization() {
    const org = state.data.organization;
    const sub = state.data.subscription;
    return toolbar('Organização', 'Dados centrais, limites e estrutura corporativa.') + cards([
      card('Perfil organizacional', `<form class="enterprise-form" data-form="organization">
        <div class="enterprise-field"><label for="org-name">Nome</label><input class="enterprise-input" id="org-name" name="name" value="${esc(org.name)}" required></div>
        <div class="enterprise-field"><label for="org-domain">Domínio</label><input class="enterprise-input" id="org-domain" name="domain" value="${esc(org.domain)}" required></div>
        <div class="enterprise-field"><label for="org-timezone">Fuso horário</label><input class="enterprise-input" id="org-timezone" name="timezone" value="${esc(org.timezone)}"></div>
        <div class="enterprise-field"><label for="org-locale">Localidade</label><select class="enterprise-select" id="org-locale" name="locale"><option value="pt-BR" ${org.locale === 'pt-BR' ? 'selected' : ''}>Português (Brasil)</option><option value="en-US" ${org.locale === 'en-US' ? 'selected' : ''}>English (US)</option></select></div>
        <div class="enterprise-field full"><button class="enterprise-btn primary" type="submit">Salvar organização</button></div>
      </form>`, 'wide'),
      card('Capacidade', `<div class="enterprise-stat">${state.data.members.length}/${esc(sub.seats)}</div><p>assentos em uso</p><div class="enterprise-progress"><span style="width:${Math.min(100, state.data.members.length / Number(sub.seats) * 100)}%"></span></div><div class="enterprise-divider"></div><p>Região de dados: <strong>${esc(org.dataRegion)}</strong></p>`),
      card('Equipes', `<div class="enterprise-list">${state.data.teams.map(team => `<div class="enterprise-list-item"><div><strong>${esc(team.name)}</strong><small>${esc(team.members)} membro(s)</small></div><span class="enterprise-badge">Time</span></div>`).join('')}</div>`, 'full'),
    ]);
  }

  function renderMembers() {
    const rows = state.data.members.filter(member => !state.query || `${member.name} ${member.email} ${member.team}`.toLowerCase().includes(state.query)).map(member => `<tr>
      <td><strong>${esc(member.name)}</strong><br><span class="enterprise-secondary">${esc(member.email)}</span></td><td>${esc(member.team)}</td><td><span class="enterprise-badge">${esc(roleName(member.roleId))}</span></td><td>${statusBadge(member.status)}</td><td>${fmtDate(member.lastActiveAt, true)}</td>
      <td><div class="enterprise-actions"><button class="enterprise-btn ghost" data-edit-member="${esc(member.id)}">Editar</button>${member.roleId !== 'owner' ? `<button class="enterprise-btn danger" data-remove-member="${esc(member.id)}">Remover</button>` : ''}</div></td></tr>`).join('');
    return toolbar('Membros e convites', `${state.data.members.length} identidades vinculadas à organização.`, '<button class="enterprise-btn primary" data-open-modal="member">Convidar membro</button>') + `<div class="enterprise-table-wrap"><table class="enterprise-table"><thead><tr><th>Identidade</th><th>Equipe</th><th>Perfil</th><th>Status</th><th>Última atividade</th><th>Ações</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="enterprise-empty">Nenhum membro encontrado.</td></tr>'}</tbody></table></div>`;
  }

  function renderRoles() {
    const rows = state.data.roles.map(role => `<tr><td><strong>${esc(role.name)}</strong>${role.system ? '<br><span class="enterprise-badge">Sistema</span>' : ''}</td><td>${esc(role.description)}</td><td>${role.permissions.includes('*') ? 'Todas' : role.permissions.length}</td><td>${state.data.members.filter(member => member.roleId === role.id).length}</td><td>${role.system ? '<span class="enterprise-secondary">Protegido</span>' : `<div class="enterprise-actions"><button class="enterprise-btn ghost" data-edit-role="${esc(role.id)}">Editar</button><button class="enterprise-btn danger" data-remove-role="${esc(role.id)}">Excluir</button></div>`}</td></tr>`).join('');
    return toolbar('Perfis e permissões', 'Controle de acesso baseado em papéis com perfis corporativos.', '<button class="enterprise-btn primary" data-open-modal="role">Novo perfil</button>') + `<div class="enterprise-table-wrap"><table class="enterprise-table"><thead><tr><th>Perfil</th><th>Descrição</th><th>Permissões</th><th>Membros</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderBilling() {
    const sub = state.data.subscription;
    const invoiceRows = state.data.invoices.map(invoice => `<tr><td><strong>${esc(invoice.id)}</strong></td><td>${fmtDate(invoice.date)}</td><td>${money(invoice.amount)}</td><td>${statusBadge(invoice.status)}</td><td><button class="enterprise-btn ghost" data-download-invoice="${esc(invoice.id)}">Baixar</button></td></tr>`).join('');
    return toolbar('Billing e planos', 'Assinatura, capacidade, pagamentos e histórico financeiro.') + cards([
      card('Plano atual', `<div class="enterprise-stat">${esc(sub.plan)}</div><p>${money(sub.monthlyValue)} por mês · ciclo ${esc(cycleName(sub.cycle))}</p><div class="enterprise-divider"></div><p>Renovação: <strong>${fmtDate(sub.renewalAt)}</strong></p><p>Método: <strong>${esc(sub.paymentMethod)}</strong></p><div class="enterprise-actions" style="margin-top:16px">${sub.plan !== 'Business' ? '<button class="enterprise-btn primary" data-change-plan="Business">Migrar para Business</button>' : ''}${sub.plan !== 'Enterprise' ? '<button class="enterprise-btn primary" data-change-plan="Enterprise">Migrar para Enterprise</button>' : ''}<button class="enterprise-btn danger" data-cancel-plan>Cancelar assinatura</button></div>`, 'wide'),
      card('Assentos', `<div class="enterprise-stat">${esc(sub.seatsUsed || state.data.members.length)}/${esc(sub.seats)}</div><p>licenças provisionadas</p><div class="enterprise-progress"><span style="width:${Math.min(100, state.data.members.length / Number(sub.seats) * 100)}%"></span></div><div class="enterprise-divider"></div>${statusBadge(sub.status)}`),
      card('Faturas', `<div class="enterprise-table-wrap"><table class="enterprise-table"><thead><tr><th>Fatura</th><th>Data</th><th>Valor</th><th>Status</th><th>Documento</th></tr></thead><tbody>${invoiceRows}</tbody></table></div>`, 'full'),
    ]);
  }

  function renderIntelligence() {
    const insights = state.data.intelligence.map(insight => card(`<span class="enterprise-badge">${esc(insight.type)}</span> ${esc(insight.title)}`, `<p>${esc(insight.summary)}</p><div class="enterprise-divider"></div><p>Confiança: <strong>${Math.round(Number(insight.confidence) * 100)}%</strong> · impacto <strong>${esc(insight.impact)}</strong></p><div class="enterprise-actions" style="margin-top:14px">${insight.status === 'open' ? `<button class="enterprise-btn primary" data-resolve-insight="${esc(insight.id)}" data-status="executed">${esc(insight.action)}</button><button class="enterprise-btn ghost" data-resolve-insight="${esc(insight.id)}" data-status="dismissed">Dispensar</button>` : statusBadge(insight.status)}</div>`, `enterprise-insight ${insight.status !== 'open' ? 'resolved' : ''}" data-impact="${esc(insight.impact)}`)).join('');
    return toolbar('Business Intelligence', 'Alertas executivos explicáveis, priorizados por impacto e confiança.') + `<div class="enterprise-grid">${insights}</div>`;
  }

  function renderCompliance() {
    const policy = state.data.policies;
    const auditRows = state.data.auditLog.slice(0, 30).map(log => `<tr><td>${fmtDate(log.createdAt, true)}</td><td><strong>${esc(log.actor)}</strong></td><td>${esc(log.action)}</td><td>${esc(log.detail)}</td></tr>`).join('');
    return toolbar('Compliance e auditoria', 'Controles LGPD, retenção, rastreabilidade e evidências.', '<button class="enterprise-btn" data-enterprise-action="export-audit">Exportar trilha CSV</button>') + cards([
      card('Políticas corporativas', `<form class="enterprise-form" data-form="policies">
        <label class="enterprise-switch"><input type="checkbox" name="mfaRequired" aria-label="Exigir autenticação multifator" ${policy.mfaRequired ? 'checked' : ''}> MFA obrigatório</label>
        <label class="enterprise-switch"><input type="checkbox" name="lgpdMode" aria-label="Ativar modo LGPD" ${policy.lgpdMode ? 'checked' : ''}> Modo LGPD</label>
        <label class="enterprise-switch"><input type="checkbox" name="dataEncryption" aria-label="Ativar criptografia de dados" ${policy.dataEncryption ? 'checked' : ''}> Criptografia de dados</label>
        <label class="enterprise-switch"><input type="checkbox" name="ssoEnforced" aria-label="Exigir autenticação SSO" ${policy.ssoEnforced ? 'checked' : ''}> SSO obrigatório</label>
        <div class="enterprise-field"><label for="session-hours">Sessão (horas)</label><input class="enterprise-input" id="session-hours" name="sessionHours" type="number" min="1" max="72" value="${esc(policy.sessionHours)}"></div>
        <div class="enterprise-field"><label for="retention-days">Retenção de auditoria (dias)</label><input class="enterprise-input" id="retention-days" name="auditRetentionDays" type="number" min="30" max="3650" value="${esc(policy.auditRetentionDays)}"></div>
        <div class="enterprise-field full"><button class="enterprise-btn primary" type="submit">Aplicar políticas</button></div>
      </form>`, 'full'),
      card('Trilha de auditoria', `<div class="enterprise-table-wrap"><table class="enterprise-table enterprise-audit"><thead><tr><th>Data</th><th>Ator</th><th>Evento</th><th>Detalhe</th></tr></thead><tbody>${auditRows}</tbody></table></div>`, 'full'),
    ]);
  }

  function renderIntegrations() {
    return toolbar('Integrações', 'Conectores corporativos e estado de sincronização.') + cards(state.data.integrations.map(item => card(esc(item.name), `<p>${esc(item.category)}</p><div class="enterprise-divider"></div><p>${item.connected ? `Sincronizado em ${fmtDate(item.lastSyncAt, true)}` : 'Não conectado'}</p><button class="enterprise-btn ${item.connected ? 'danger' : 'primary'}" style="margin-top:14px" data-toggle-integration="${esc(item.id)}">${item.connected ? 'Desconectar' : 'Conectar'}</button>`)));
  }

  function renderSecurity() {
    const devices = state.data.devices.map(device => `<div class="enterprise-list-item"><div><strong>${esc(device.name)} ${device.current ? '<span class="enterprise-badge success">Atual</span>' : ''}</strong><small>${esc(device.location)} · ${fmtDate(device.lastActiveAt, true)}</small></div>${device.current ? '<span class="enterprise-secondary">Protegido</span>' : `<button class="enterprise-btn danger" data-revoke-device="${esc(device.id)}">Revogar</button>`}</div>`).join('');
    return toolbar('Segurança e dispositivos', 'Sessões confiáveis, postura de acesso e políticas ativas.') + cards([
      card('Postura', `<div class="enterprise-stat">96</div><p>Security Score</p><div class="enterprise-progress"><span style="width:96%"></span></div><div class="enterprise-divider"></div><p>MFA: <strong>${state.data.policies.mfaRequired ? 'Obrigatório' : 'Opcional'}</strong></p><p>Criptografia: <strong>${state.data.policies.dataEncryption ? 'Ativa' : 'Inativa'}</strong></p>`),
      card('Dispositivos confiáveis', `<div class="enterprise-list">${devices}</div>`, 'wide'),
    ]);
  }

  function renderAdmin() {
    const sys = state.data.system;
    return toolbar('Admin Center', 'Saúde da plataforma, uso, usuários e operação.', '<button class="enterprise-btn primary" data-refresh-system>Atualizar diagnóstico</button>') + cards([
      card('Status', `<div class="enterprise-stat">${esc(sys.uptime)}%</div><p>disponibilidade consolidada</p><div class="enterprise-divider"></div>${statusBadge(sys.status)}`),
      card('API p95', `<div class="enterprise-stat">${esc(sys.apiP95)}ms</div><p>latência de resposta</p><div class="enterprise-divider"></div><p>Taxa de erro: <strong>${esc(sys.errorRate)}%</strong></p>`),
      card('Identidades', `<div class="enterprise-stat">${state.data.members.length}</div><p>membros provisionados</p><div class="enterprise-divider"></div><p>Sessões ativas: <strong>${esc(sys.activeSessions)}</strong></p>`),
      card('Continuidade', `<div class="enterprise-stat">${esc(sys.region)}</div><p>região operacional</p><div class="enterprise-divider"></div><p>Último backup: <strong>${fmtDate(sys.lastBackupAt, true)}</strong></p>`, 'wide'),
    ]);
  }

  function renderAnalytics() {
    const active = state.data.members.filter(member => member.status === 'active').length;
    const connected = state.data.integrations.filter(item => item.connected).length;
    const openInsights = state.data.intelligence.filter(item => item.status === 'open').length;
    return toolbar('Analytics executivo', 'Métricas consolidadas de adoção, operação e governança.') + cards([
      card('Adoção', `<div class="enterprise-stat">${active}/${state.data.members.length}</div><p>membros ativos</p>`),
      card('Conectividade', `<div class="enterprise-stat">${connected}/${state.data.integrations.length}</div><p>integrações conectadas</p>`),
      card('Inteligência', `<div class="enterprise-stat">${openInsights}</div><p>recomendações em aberto</p>`),
      card('Governança', `<div class="enterprise-stat">${state.data.auditLog.length}</div><p>eventos auditáveis registrados</p>`, 'wide'),
      card('Plano', `<div class="enterprise-stat">${esc(state.data.subscription.plan)}</div><p>${esc(state.data.subscription.status)}</p>`),
    ]);
  }

  const renderers = { command: renderCommand, organization: renderOrganization, members: renderMembers, roles: renderRoles, billing: renderBilling, intelligence: renderIntelligence, compliance: renderCompliance, integrations: renderIntegrations, security: renderSecurity, admin: renderAdmin, analytics: renderAnalytics };

  function render(view) {
    state.view = view || 'command';
    const dynamic = document.getElementById('enterprise-dynamic');
    const command = document.getElementById('enterprise-command');
    document.querySelectorAll('.sidebar-nav [data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === state.view));
    document.querySelector('.topbar-title').textContent = document.querySelector(`.sidebar-nav [data-view="${state.view}"]`)?.dataset.title || 'Command Center';
    command.style.display = 'none';
    dynamic.classList.add('active');
    dynamic.innerHTML = renderers[state.view] ? renderers[state.view]() : renderCommand();
    history.replaceState(null, '', `#${state.view}`);
  }

  function openModal(type, id = '') {
    const modal = document.querySelector('.enterprise-modal-backdrop');
    const body = modal.querySelector('.enterprise-modal-body');
    const title = modal.querySelector('.enterprise-modal-head h2');
    if (type === 'member') {
      const member = state.data.members.find(item => item.id === id);
      title.textContent = member ? 'Editar membro' : 'Convidar membro';
      body.innerHTML = `<form class="enterprise-form" data-form="member"><input type="hidden" name="id" value="${esc(member?.id || '')}"><div class="enterprise-field"><label for="member-name">Nome</label><input class="enterprise-input" id="member-name" name="name" value="${esc(member?.name || '')}" required></div><div class="enterprise-field"><label for="member-email">E-mail</label><input class="enterprise-input" id="member-email" name="email" type="email" value="${esc(member?.email || '')}" ${member ? 'disabled' : 'required'}></div><div class="enterprise-field"><label for="member-team">Equipe</label><input class="enterprise-input" id="member-team" name="team" value="${esc(member?.team || 'Geral')}"></div><div class="enterprise-field"><label for="member-role">Perfil</label><select class="enterprise-select" id="member-role" name="roleId">${state.data.roles.map(role => `<option value="${esc(role.id)}" ${member?.roleId === role.id ? 'selected' : ''}>${esc(role.name)}</option>`).join('')}</select></div>${member ? `<div class="enterprise-field full"><label for="member-status">Status</label><select class="enterprise-select" id="member-status" name="status"><option value="active" ${member.status === 'active' ? 'selected' : ''}>Ativo</option><option value="invited" ${member.status === 'invited' ? 'selected' : ''}>Convidado</option><option value="suspended" ${member.status === 'suspended' ? 'selected' : ''}>Suspenso</option></select></div>` : ''}<div class="enterprise-field full"><button class="enterprise-btn primary" type="submit">${member ? 'Salvar alterações' : 'Enviar convite'}</button></div></form>`;
    } else {
      const role = state.data.roles.find(item => item.id === id);
      title.textContent = role ? 'Editar perfil' : 'Novo perfil';
      body.innerHTML = `<form class="enterprise-form" data-form="role"><input type="hidden" name="id" value="${esc(role?.id || '')}"><div class="enterprise-field full"><label for="role-name">Nome</label><input class="enterprise-input" id="role-name" name="name" value="${esc(role?.name || '')}" required></div><div class="enterprise-field full"><label for="role-description">Descrição</label><input class="enterprise-input" id="role-description" name="description" value="${esc(role?.description || '')}"></div><div class="enterprise-field full"><label>Permissões</label><div class="enterprise-permissions">${permissions.map(([code, label]) => `<label class="enterprise-permission"><input type="checkbox" name="permissions" value="${esc(code)}" ${role?.permissions.includes(code) ? 'checked' : ''}> ${esc(label)}</label>`).join('')}</div></div><div class="enterprise-field full"><button class="enterprise-btn primary" type="submit">Salvar perfil</button></div></form>`;
    }
    modal.classList.add('open');
  }

  function closeModal() { document.querySelector('.enterprise-modal-backdrop').classList.remove('open'); }
  function download(name, content, type = 'text/csv;charset=utf-8') { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
  function exportAudit() { const lines = [['data', 'ator', 'evento', 'alvo', 'detalhe'], ...state.data.auditLog.map(log => [log.createdAt, log.actor, log.action, log.target, log.detail])]; download('lifeos-auditoria-v3.0.csv', lines.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')); }
  function exportSnapshot() { download('lifeos-enterprise-snapshot-v3.0.json', JSON.stringify(state.data, null, 2), 'application/json'); }
  function downloadInvoice(id) { const invoice = state.data.invoices.find(item => item.id === id); if (!invoice) return; download(`${id}.txt`, `LifeOS Enterprise\nFatura: ${id}\nData: ${fmtDate(invoice.date)}\nValor: ${money(invoice.amount)}\nStatus: ${invoice.status}\n` , 'text/plain;charset=utf-8'); toast('Documento financeiro gerado.'); }

  async function submitForm(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (form.dataset.form === 'organization') await mutate('organization.update', data, 'Organização atualizada.');
    if (form.dataset.form === 'policies') {
      const payload = { ...data, mfaRequired: form.mfaRequired.checked, lgpdMode: form.lgpdMode.checked, dataEncryption: form.dataEncryption.checked, ssoEnforced: form.ssoEnforced.checked, sessionHours: Number(data.sessionHours), auditRetentionDays: Number(data.auditRetentionDays) };
      await mutate('policy.update', payload, 'Políticas aplicadas.');
    }
    if (form.dataset.form === 'member') {
      const action = data.id ? 'member.update' : 'member.create';
      await mutate(action, data, data.id ? 'Membro atualizado.' : 'Convite registrado.');
      closeModal();
    }
    if (form.dataset.form === 'role') {
      const permissionsList = [...form.querySelectorAll('[name="permissions"]:checked')].map(input => input.value);
      const action = data.id ? 'role.update' : 'role.create';
      await mutate(action, { ...data, permissions: permissionsList }, data.id ? 'Perfil atualizado.' : 'Perfil criado.');
      closeModal();
    }
  }

  async function click(event) {
    const target = event.target.closest('button, a, [data-view]');
    if (!target) return;
    if (target.dataset.view) { event.preventDefault(); render(target.dataset.view); return; }
    if (target.dataset.openModal) return openModal(target.dataset.openModal);
    if (target.dataset.editMember) return openModal('member', target.dataset.editMember);
    if (target.dataset.editRole) return openModal('role', target.dataset.editRole);
    if (target.dataset.closeModal !== undefined) return closeModal();
    if (target.dataset.removeMember && confirm('Remover este membro da organização?')) return mutate('member.remove', { id: target.dataset.removeMember }, 'Membro removido.');
    if (target.dataset.removeRole && confirm('Excluir este perfil personalizado?')) return mutate('role.remove', { id: target.dataset.removeRole }, 'Perfil removido.');
    if (target.dataset.changePlan) return mutate('plan.change', { plan: target.dataset.changePlan }, `Plano alterado para ${target.dataset.changePlan}.`);
    if (target.hasAttribute('data-cancel-plan')) {
      const reason = prompt('Motivo do cancelamento programado:');
      if (reason) return mutate('plan.cancel', { reason }, 'Cancelamento programado para o fim do ciclo.');
    }
    if (target.dataset.toggleIntegration) return mutate('integration.toggle', { id: target.dataset.toggleIntegration }, 'Integração atualizada.');
    if (target.dataset.revokeDevice && confirm('Revogar este dispositivo?')) return mutate('device.revoke', { id: target.dataset.revokeDevice }, 'Dispositivo revogado.');
    if (target.dataset.resolveInsight) return mutate('intelligence.resolve', { id: target.dataset.resolveInsight, status: target.dataset.status }, 'Recomendação tratada.');
    if (target.hasAttribute('data-refresh-system')) return mutate('system.refresh', {}, 'Diagnóstico atualizado.');
    if (target.dataset.downloadInvoice) return downloadInvoice(target.dataset.downloadInvoice);
    if (target.dataset.enterpriseAction === 'export-audit') return exportAudit();
    if (target.dataset.enterpriseAction === 'export') return exportSnapshot();
    if (target.dataset.enterpriseAction === 'settings') return render('organization');
    if (target.dataset.enterpriseAction === 'notifications') return render('intelligence');
    if (target.dataset.enterpriseAction === 'new-decision') return render('intelligence');
  }

  function bindSearch() {
    const search = document.querySelector('[data-enterprise-search]');
    search?.addEventListener('input', event => {
      state.query = event.target.value.trim().toLowerCase();
      render(state.view === 'members' ? 'members' : state.view);
    });
  }

  async function init() {
    document.addEventListener('click', click);
    document.addEventListener('submit', submitForm);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
    bindSearch();
    try {
      await request();
      const view = location.hash.slice(1);
      render(view && renderers[view] ? view : 'command');
      document.querySelectorAll('.org-name').forEach(node => node.textContent = state.data.organization.name);
      document.querySelectorAll('.org-avatar').forEach(node => node.textContent = state.data.organization.name.slice(0, 1).toUpperCase());
      document.querySelectorAll('.user-n').forEach(node => node.textContent = state.data.members[0]?.name || 'Administrador');
      document.querySelectorAll('.user-r').forEach(node => node.textContent = roleName(state.data.members[0]?.roleId));
      document.querySelectorAll('.topbar-subtitle').forEach(node => node.textContent = `· ${fmtDate(new Date().toISOString(), true)}`);
      const count = state.data.intelligence.filter(item => item.status === 'open').length;
      document.querySelectorAll('[data-intelligence-count]').forEach(node => node.textContent = count);
    } catch (error) {
      document.getElementById('enterprise-dynamic').innerHTML = `<div class="enterprise-error"><strong>Não foi possível carregar o ambiente Enterprise.</strong><br>${esc(error.message)}</div>`;
      document.getElementById('enterprise-dynamic').classList.add('active');
    }
  }

  window.enterpriseApp = { render };
  window.addEventListener('DOMContentLoaded', init);
})();
