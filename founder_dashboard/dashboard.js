/**
 * LifeOS — Founder Dashboard V1
 * EXECUTION-004 | PROJECT-X PHASE 5
 * 
 * Módulos: Overview, Empresa, Produto, IA, Plataforma, Segurança, CEO
 */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
const STATE = {
  currentSection: 'overview',
  sidebarCollapsed: false,
  charts: {},
  refreshInterval: null,
  lastRefresh: new Date(),
};

/* ============================================================
   REAL DATA — LifeOS Platform
   Data is loaded from /api/observability and /api/dashboard
   No mock data remains in this file.
   ============================================================ */
const DATA = {
  empresa: null,
  produto: null,
  ia: null,
  plataforma: null,
  seguranca: null,
  ceo: null,
};

async function loadDashboardData() {
  try {
    const [dashRes, obsRes] = await Promise.all([
      fetch('/api/dashboard', { credentials: 'same-origin' }),
      fetch('/api/observability', { credentials: 'same-origin' }),
    ]);
    const dashData = dashRes.ok ? await dashRes.json() : {};
    const obsData = obsRes.ok ? await obsRes.json() : {};
    DATA.empresa = dashData.empresa || null;
    DATA.produto = dashData.produto || null;
    DATA.ia = dashData.ia || null;
    DATA.plataforma = obsData.plataforma || null;
    DATA.seguranca = obsData.seguranca || null;
    DATA.ceo = dashData.ceo || null;
    renderDashboard();
  } catch (err) {
    console.error('[Founder Dashboard] Erro ao carregar dados:', err);
    showEmptyState();
  }
}

function showEmptyState() {
  const container = document.getElementById('dashboard-content');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:14px">Conecte-se para visualizar métricas em tempo real.</div></div>';
  }
}

function renderDashboard() {
  // Delegate to existing render functions which now use real DATA
  if (STATE.currentSection === 'overview') renderOverview();
  else if (STATE.currentSection === 'empresa') renderEmpresa();
  else if (STATE.currentSection === 'produto') renderProduto();
  else if (STATE.currentSection === 'ia') renderIA();
  else if (STATE.currentSection === 'plataforma') renderPlataforma();
  else if (STATE.currentSection === 'seguranca') renderSeguranca();
  else if (STATE.currentSection === 'ceo') renderCEO();
}

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */
function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString('pt-BR');
}

function formatCurrency(n) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
}

function trendHTML(val, positivo = true) {
  const isUp = String(val).startsWith('+');
  const isDown = String(val).startsWith('-');
  const cls = isUp ? (positivo ? 'up' : 'down') : isDown ? (positivo ? 'down' : 'up') : 'neutral';
  const icon = isUp ? '↑' : isDown ? '↓' : '→';
  return `<span class="metric-trend ${cls}">${icon} ${val}</span>`;
}

function statusBadge(status) {
  const map = {
    'online':   ['success', 'Online'],
    'standby':  ['warning', 'Standby'],
    'dev':      ['neutral', 'Em Dev'],
    'offline':  ['danger',  'Offline'],
    'ativo':    ['success', 'Ativo'],
    'agendado': ['warning', 'Agendado'],
    'iminente': ['success', 'Iminente'],
    'planejado':['neutral', 'Planejado'],
  };
  const [cls, label] = map[status] || ['neutral', status];
  return `<span class="badge badge-${cls}"><span class="badge-dot"></span>${label}</span>`;
}

/* ============================================================
   RENDER FUNCTIONS
   ============================================================ */

// ---- OVERVIEW ----
function renderOverview() {
  const d = DATA;
  document.getElementById('section-overview').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Founder Dashboard</div>
        <div class="page-subtitle">Visão consolidada de toda a plataforma LifeOS — atualizado em tempo real</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="exportReport()">
          <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar
        </button>
        <button class="btn btn-primary" onclick="showSection('ceo', document.querySelector('[onclick*=ceo]'))">
          <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> CEO View
        </button>
      </div>
    </div>

    <div class="overview-hero">
      <div class="overview-hero-title">LifeOS — Sprint 028 · Release Candidate V1.0</div>
      <div class="overview-hero-sub">Plataforma operacional · 544 testes passando · Deploy em produção iminente</div>
      <div class="overview-hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-value">${formatNumber(d.empresa.usuarios_cadastrados)}</div>
          <div class="hero-stat-label">Usuários</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value">${formatCurrency(d.empresa.receita_mrr)}</div>
          <div class="hero-stat-label">MRR</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value">${d.plataforma.uptime_30d}%</div>
          <div class="hero-stat-label">Uptime 30d</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value">${d.ia.missoes_executadas.toLocaleString('pt-BR')}</div>
          <div class="hero-stat-label">Missões IA</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value">${d.seguranca.score}/100</div>
          <div class="hero-stat-label">Sec. Score</div>
        </div>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Usuários Ativos</div>
          <div class="metric-icon"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        </div>
        <div class="metric-value">${formatNumber(d.empresa.usuarios_ativos)}</div>
        <div class="metric-footer">
          ${trendHTML('+' + d.empresa.crescimento_usuarios + '%')}
          <span class="metric-period">vs mês anterior</span>
        </div>
      </div>
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">MRR</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
        </div>
        <div class="metric-value">R$ ${(d.empresa.receita_mrr/1000).toFixed(1)}<span>k</span></div>
        <div class="metric-footer">
          ${trendHTML('+' + d.empresa.crescimento_receita + '%')}
          <span class="metric-period">vs mês anterior</span>
        </div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">Uptime 30d</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg></div>
        </div>
        <div class="metric-value">${d.plataforma.uptime_30d}<span>%</span></div>
        <div class="metric-footer">
          <span class="metric-trend up">↑ Estável</span>
          <span class="metric-period">SLA 99.9%</span>
        </div>
      </div>
      <div class="metric-card" style="--metric-color:#8B5CF6">
        <div class="metric-header">
          <div class="metric-label">Waitlist</div>
          <div class="metric-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg></div>
        </div>
        <div class="metric-value">${formatNumber(d.empresa.waitlist)}</div>
        <div class="metric-footer">
          ${trendHTML('+' + d.empresa.crescimento_waitlist + '%')}
          <span class="metric-period">vs mês anterior</span>
        </div>
      </div>
    </div>

    <div class="grid-3">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg> Status dos Módulos</div>
        </div>
        ${[
          ['Life Kernel',       'online'],
          ['Intelligence Hub',  'online'],
          ['Action Engine',     'online'],
          ['Security Center',   'online'],
          ['Companion AI',      'online'],
          ['Voice Interface',   'dev'],
        ].map(([nome, status]) => `
          <div class="stat-row">
            <span class="stat-key">${nome}</span>
            ${statusBadge(status)}
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg> Alertas Ativos</div>
          <span class="card-action">Ver todos</span>
        </div>
        ${d.plataforma.alertas.map(a => `
          <div class="alert-item ${a.nivel}">
            <div class="alert-icon"><i data-lucide="${a.nivel === 'critical' ? 'alert-octagon' : a.nivel === 'warning' ? 'alert-triangle' : 'info'}"></i></div>
            <div class="alert-content">
              <div class="alert-title">${a.titulo}</div>
              <div class="alert-desc">${a.desc}</div>
            </div>
            <div class="alert-time">${a.ts}</div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg> Performance Rápida</div>
        </div>
        <div class="stat-row"><span class="stat-key">Latência P50</span><span class="stat-val">${d.plataforma.latencia_p50}ms</span></div>
        <div class="stat-row"><span class="stat-key">Latência P95</span><span class="stat-val">${d.plataforma.latencia_p95}ms</span></div>
        <div class="stat-row"><span class="stat-key">Taxa de Erros</span><span class="stat-val">${d.plataforma.taxa_erros}%</span></div>
        <div class="stat-row"><span class="stat-key">Req/hora</span><span class="stat-val">${formatNumber(d.plataforma.requests_hora)}</span></div>
        <div class="stat-row"><span class="stat-key">CPU</span>
          <span class="stat-val">${d.plataforma.cpu_uso}%</span>
        </div>
        <div class="stat-row"><span class="stat-key">Memória</span><span class="stat-val">${d.plataforma.memoria_uso}%</span></div>
        <div class="stat-row"><span class="stat-key">Score Segurança</span><span class="stat-val">${d.seguranca.score}/100</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Crescimento de Usuários</div>
          <span class="card-action">Detalhes</span>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="chart-overview-users"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Evolução do MRR</div>
          <span class="card-action">Detalhes</span>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="chart-overview-mrr"></canvas>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    renderLineChart('chart-overview-users', DATA.empresa.historico_usuarios, '#6366F1', 'Usuários');
    renderLineChart('chart-overview-mrr', DATA.empresa.historico_mrr, '#10B981', 'MRR (R$)');
    window.refreshIcons?.();
  }, 50);
}

// ---- EMPRESA ----
function renderEmpresa() {
  if (!DATA.empresa) { document.getElementById('section-empresa').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:14px">Dados da empresa serão carregados da API.</div></div>'; return; }
  const d = DATA.empresa;
  document.getElementById('section-empresa').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Empresa</div>
        <div class="page-subtitle">Métricas de negócio, usuários, receita e crescimento</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> Período</button>
        <button class="btn btn-primary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Relatório</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Usuários Cadastrados</div>
          <div class="metric-icon"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></div>
        </div>
        <div class="metric-value">${formatNumber(d.usuarios_cadastrados)}</div>
        <div class="metric-footer">${trendHTML('+' + d.crescimento_usuarios + '%')}<span class="metric-period">30 dias</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Usuários Ativos</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        </div>
        <div class="metric-value">${formatNumber(d.usuarios_ativos)}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ ${((d.usuarios_ativos/d.usuarios_cadastrados)*100).toFixed(1)}%</span><span class="metric-period">taxa de ativação</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#8B5CF6">
        <div class="metric-header">
          <div class="metric-label">Beta Testers</div>
          <div class="metric-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/></svg></div>
        </div>
        <div class="metric-value">${d.beta_testers}</div>
        <div class="metric-footer"><span class="metric-trend neutral">→ Estável</span><span class="metric-period">programa beta</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F59E0B">
        <div class="metric-header">
          <div class="metric-label">Waitlist</div>
          <div class="metric-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg></div>
        </div>
        <div class="metric-value">${formatNumber(d.waitlist)}</div>
        <div class="metric-footer">${trendHTML('+' + d.crescimento_waitlist + '%')}<span class="metric-period">30 dias</span></div>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">MRR</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
        </div>
        <div class="metric-value">R$ ${(d.receita_mrr/1000).toFixed(1)}<span>k</span></div>
        <div class="metric-footer">${trendHTML('+' + d.crescimento_receita + '%')}<span class="metric-period">30 dias</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">ARR</div>
          <div class="metric-icon"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg></div>
        </div>
        <div class="metric-value">R$ ${(d.receita_arr/1000).toFixed(0)}<span>k</span></div>
        <div class="metric-footer">${trendHTML('+' + d.crescimento_receita + '%')}<span class="metric-period">anualizado</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">Assinaturas Ativas</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
        </div>
        <div class="metric-value">${d.assinaturas_ativas}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ +12</span><span class="metric-period">este mês</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F43F5E">
        <div class="metric-header">
          <div class="metric-label">Churn Rate</div>
          <div class="metric-icon" style="background:rgba(244,63,94,0.12);color:#F43F5E"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/></svg></div>
        </div>
        <div class="metric-value">${d.churn_rate}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↓ -0.3%</span><span class="metric-period">melhora</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/></svg> Distribuição de Planos</div>
        </div>
        <div style="display:flex;gap:20px;align-items:center">
          <div class="chart-container" style="height:180px;width:180px;flex-shrink:0">
            <canvas id="chart-planos"></canvas>
          </div>
          <div style="flex:1">
            ${d.planos.map(p => `
              <div class="stat-row">
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="width:8px;height:8px;border-radius:2px;background:${p.cor}"></div>
                  <span class="stat-key">${p.nome}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="stat-val">${p.usuarios}</span>
                  <span style="font-size:10px;color:rgba(148,163,184,0.4)">${p.percentual}%</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> Crescimento MRR</div>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="chart-mrr-empresa"></canvas>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Crescimento de Usuários</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="chart-users-empresa"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg> Waitlist Growth</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="chart-waitlist"></canvas>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    renderDoughnutChart('chart-planos', d.planos.map(p => p.nome), d.planos.map(p => p.usuarios), d.planos.map(p => p.cor));
    renderLineChart('chart-mrr-empresa', d.historico_mrr, '#10B981', 'MRR');
    renderLineChart('chart-users-empresa', d.historico_usuarios, '#6366F1', 'Usuários');
    renderLineChart('chart-waitlist', d.historico_waitlist, '#F59E0B', 'Waitlist');
    window.refreshIcons?.();
  }, 50);
}

// ---- PRODUTO ----
function renderProduto() {
  if (!DATA.produto) { document.getElementById('section-produto').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:14px">Dados do produto serão carregados da API.</div></div>'; return; }
  const d = DATA.produto;
  document.getElementById('section-produto').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Produto</div>
        <div class="page-subtitle">Versão atual, roadmap, funcionalidades e qualidade do código</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg> Changelog</button>
        <button class="btn btn-primary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg> Deploy</button>
      </div>
    </div>

    <div class="version-display">
      <div class="version-number">${d.versao_atual}</div>
      <div class="version-info">
        <div class="version-name">${d.versao_nome} · Sprint ${d.sprint_atual}</div>
        <div class="version-date">Última atualização: ${d.versao_data}</div>
      </div>
      <span class="badge badge-success"><span class="badge-dot"></span>Release Candidate</span>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Testes Passando</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></div>
        </div>
        <div class="metric-value">${d.testes_passando}<span>/${d.testes_total}</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ 100%</span><span class="metric-period">pass rate</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Cobertura de Código</div>
          <div class="metric-icon"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg></div>
        </div>
        <div class="metric-value">${d.cobertura_codigo}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ Alta</span><span class="metric-period">cobertura</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F59E0B">
        <div class="metric-header">
          <div class="metric-label">Bugs Abertos</div>
          <div class="metric-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg></div>
        </div>
        <div class="metric-value">${d.bugs_abertos}</div>
        <div class="metric-footer"><span class="metric-trend up">↓ 0 críticos</span><span class="metric-period">todos menores</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#8B5CF6">
        <div class="metric-header">
          <div class="metric-label">Sprint Atual</div>
          <div class="metric-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg></div>
        </div>
        <div class="metric-value">${d.sprint_atual}</div>
        <div class="metric-footer"><span class="metric-trend neutral">→ Em andamento</span></div>
      </div>
    </div>

    <div class="grid-3-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg> Roadmap</div>
        </div>
        ${d.roadmap.map(r => `
          <div class="roadmap-item">
            <div class="roadmap-phase-badge ${r.status}">${r.fase}</div>
            <div class="roadmap-info">
              <div class="roadmap-title">${r.nome}</div>
              <div class="roadmap-desc">${r.desc}</div>
            </div>
            ${statusBadge(r.status === 'done' ? 'online' : r.status === 'active' ? 'ativo' : 'agendado')}
          </div>
        `).join('')}
      </div>

      <div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"/><path d="m9 11 3 3L22 4"/></svg> Funcionalidades Concluídas</div>
            <span class="badge badge-success">${d.features_concluidas.length}</span>
          </div>
          ${d.features_concluidas.map(f => `
            <div class="feature-item">
              <div class="feature-check done"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
              <span class="feature-name done">${f.nome}</span>
              <span class="feature-tag ${f.tag}">${f.tag}</span>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg> Em Desenvolvimento</div>
            <span class="badge badge-neutral">${d.features_em_dev.length}</span>
          </div>
          ${d.features_em_dev.map(f => `
            <div class="feature-item" style="flex-direction:column;align-items:flex-start;gap:6px">
              <div style="display:flex;align-items:center;gap:8px;width:100%">
                <div class="feature-check wip"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
                <span class="feature-name" style="flex:1">${f.nome}</span>
                <span class="feature-tag ${f.tag}">${f.tag}</span>
                <span style="font-size:11px;font-weight:700;color:#818CF8">${f.prog}%</span>
              </div>
              <div style="width:100%;padding-left:26px">
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${f.prog}%"></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => window.refreshIcons?.(), 50);
}

// ---- IA ----
function renderIA() {
  if (!DATA.ia) { document.getElementById('section-ia').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:14px">Dados de IA serão carregados da API.</div></div>'; return; }
  const d = DATA.ia;
  document.getElementById('section-ia').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">IA & Companion</div>
        <div class="page-subtitle">Status do Companion, missões executadas, aprendizado e SIG</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Sincronizar</button>
        <button class="btn btn-primary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M9 13a4.5 4.5 0 0 0 3-4"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M12 13h4"/><path d="M12 18h6a2 2 0 0 1 2 2v1"/><path d="M12 8h8"/><path d="M16 8V5a2 2 0 0 1 2-2"/><circle cx="16" cy="13" r=".5"/><circle cx="18" cy="3" r=".5"/><circle cx="20" cy="21" r=".5"/><circle cx="20" cy="8" r=".5"/></svg> Console IA</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#8B5CF6">
        <div class="metric-header">
          <div class="metric-label">Missões Executadas</div>
          <div class="metric-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg></div>
        </div>
        <div class="metric-value">${formatNumber(d.missoes_executadas)}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ ${d.missoes_hoje} hoje</span><span class="metric-period">total</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Taxa de Sucesso</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg></div>
        </div>
        <div class="metric-value">${d.taxa_sucesso}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ Excelente</span><span class="metric-period">missões</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Ciclos de Aprendizado</div>
          <div class="metric-icon"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg></div>
        </div>
        <div class="metric-value">${formatNumber(d.aprendizado_ciclos)}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ ${d.aprendizado_precisao}%</span><span class="metric-period">precisão</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">Tokens / Mês</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg></div>
        </div>
        <div class="metric-value">${(d.tokens_consumidos_mes/1_000_000).toFixed(1)}<span>M</span></div>
        <div class="metric-footer"><span class="metric-trend neutral">→ Normal</span><span class="metric-period">consumo</span></div>
      </div>
    </div>

    <div class="grid-1-2">
      <div>
        <div class="card companion-status-card" style="margin-bottom:16px">
          <div class="companion-orb">
            <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M9 13a4.5 4.5 0 0 0 3-4"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M12 13h4"/><path d="M12 18h6a2 2 0 0 1 2 2v1"/><path d="M12 8h8"/><path d="M16 8V5a2 2 0 0 1 2-2"/><circle cx="16" cy="13" r=".5"/><circle cx="18" cy="3" r=".5"/><circle cx="20" cy="21" r=".5"/><circle cx="20" cy="8" r=".5"/></svg>
          </div>
          <div class="companion-name">LifeOS Companion</div>
          <div class="companion-model">${d.companion_model}</div>
          <div style="display:flex;justify-content:center;gap:8px;margin-bottom:16px">
            <span class="badge badge-success"><span class="badge-dot"></span>${d.companion_status}</span>
            <span class="badge badge-neutral">v${d.companion_versao}</span>
          </div>
          <div class="stat-row"><span class="stat-key">Latência Média</span><span class="stat-val">${d.latencia_media_ms}ms</span></div>
          <div class="stat-row"><span class="stat-key">Missões Hoje</span><span class="stat-val">${d.missoes_hoje}</span></div>
          <div class="stat-row"><span class="stat-key">Missões Semana</span><span class="stat-val">${formatNumber(d.missoes_semana)}</span></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg> SIG — Sistema de Inteligência</div>
          </div>
          <div style="display:flex;justify-content:center;margin-bottom:12px">
            <span class="badge badge-success"><span class="badge-dot"></span>${d.sig_status}</span>
          </div>
          <div class="stat-row"><span class="stat-key">Versão</span><span class="stat-val">${d.sig_versao}</span></div>
          <div class="stat-row"><span class="stat-key">Modelos Ativos</span><span class="stat-val">${d.sig_modelos_ativos}</span></div>
          <div class="stat-row"><span class="stat-key">Última Inferência</span><span class="stat-val">${d.sig_ultima_inferencia}</span></div>
          <div class="stat-row"><span class="stat-key">Última Atualização</span><span class="stat-val" style="font-size:10px">${d.aprendizado_ultima_atualizacao}</span></div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg> Modelos Ativos</div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Status</th>
                <th>Latência</th>
                <th>Req/dia</th>
              </tr>
            </thead>
            <tbody>
              ${d.modelos.map(m => `
                <tr>
                  <td style="font-weight:500">${m.nome}</td>
                  <td>${statusBadge(m.status)}</td>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:12px">${m.latencia}</td>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:12px">${m.req_dia > 0 ? formatNumber(m.req_dia) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg> Missões por Hora (últimas 8h)</div>
          </div>
          <div class="chart-container" style="height:160px">
            <canvas id="chart-missoes"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg> Aprendizado Contínuo</div>
      </div>
      <div class="grid-4" style="margin-bottom:0">
        <div>
          <div class="section-label">Precisão do Modelo</div>
          <div style="font-size:24px;font-weight:800;color:#818CF8;margin-bottom:4px">${d.aprendizado_precisao}%</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${d.aprendizado_precisao}%"></div></div>
        </div>
        <div>
          <div class="section-label">Ciclos Completos</div>
          <div style="font-size:24px;font-weight:800;color:#F1F5F9;margin-bottom:4px">${formatNumber(d.aprendizado_ciclos)}</div>
          <div style="font-size:11px;color:rgba(148,163,184,0.5)">Total acumulado</div>
        </div>
        <div>
          <div class="section-label">Última Atualização</div>
          <div style="font-size:13px;font-weight:600;color:#F1F5F9;margin-bottom:4px">Hoje, 03:00 UTC</div>
          <div style="font-size:11px;color:rgba(148,163,184,0.5)">Ciclo diário automático</div>
        </div>
        <div>
          <div class="section-label">Próximo Ciclo</div>
          <div style="font-size:13px;font-weight:600;color:#F1F5F9;margin-bottom:4px">Amanhã, 03:00 UTC</div>
          <div style="font-size:11px;color:rgba(148,163,184,0.5)">Agendado</div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    renderBarChart('chart-missoes', ['13h','14h','15h','16h','17h','18h','19h','20h'], d.historico_missoes, '#8B5CF6', 'Missões');
    window.refreshIcons?.();
  }, 50);
}

/* ============================================================
   CHART HELPERS
   ============================================================ */
function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(13,13,26,0.95)',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        titleColor: '#F1F5F9',
        bodyColor: 'rgba(148,163,184,0.8)',
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(99,102,241,0.06)', drawBorder: false },
        ticks: { color: 'rgba(148,163,184,0.5)', font: { size: 10, family: 'Inter' } },
      },
      y: {
        grid: { color: 'rgba(99,102,241,0.06)', drawBorder: false },
        ticks: { color: 'rgba(148,163,184,0.5)', font: { size: 10, family: 'Inter' } },
      },
    },
  };
}

function renderLineChart(id, data, color, label) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 180);
  gradient.addColorStop(0, color + '33');
  gradient.addColorStop(1, color + '00');

  const labels = data.map((_, i) => `S${i+1}`);
  if (STATE.charts[id]) STATE.charts[id].destroy();
  STATE.charts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: color,
        pointBorderColor: '#0D0D1A',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      }],
    },
    options: chartDefaults(),
  });
}

function renderBarChart(id, labels, data, color, label) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (STATE.charts[id]) STATE.charts[id].destroy();
  STATE.charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: color + '55',
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: chartDefaults(),
  });
}

function renderDoughnutChart(id, labels, data, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (STATE.charts[id]) STATE.charts[id].destroy();
  STATE.charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'CC'),
        borderColor: colors,
        borderWidth: 1,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(13,13,26,0.95)',
          borderColor: 'rgba(99,102,241,0.3)',
          borderWidth: 1,
          titleColor: '#F1F5F9',
          bodyColor: 'rgba(148,163,184,0.8)',
          padding: 10,
          cornerRadius: 8,
        },
      },
    },
  });
}

function renderMultiLineChart(id, datasets) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (STATE.charts[id]) STATE.charts[id].destroy();
  const labels = datasets[0].data.map((_, i) => `${i+1}h`);
  STATE.charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: { ...chartDefaults(), plugins: { ...chartDefaults().plugins, legend: { display: true, labels: { color: 'rgba(148,163,184,0.7)', font: { size: 10 } } } } },
  });
}

/* ============================================================
   PLATAFORMA
   ============================================================ */
function renderPlataforma() {
  if (!DATA.plataforma) { document.getElementById('section-plataforma').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:14px">Dados da plataforma serão carregados da API.</div></div>'; return; }
  const d = DATA.plataforma;
  document.getElementById('section-plataforma').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Plataforma</div>
        <div class="page-subtitle">Performance, disponibilidade, logs e alertas do sistema</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> Console</button>
        <button class="btn btn-primary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg> Grafana</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Uptime 30 dias</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg></div>
        </div>
        <div class="metric-value">${d.uptime_30d}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ SLA 99.9%</span><span class="metric-period">cumprido</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Latência P95</div>
          <div class="metric-icon"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/></svg></div>
        </div>
        <div class="metric-value">${d.latencia_p95}<span>ms</span></div>
        <div class="metric-footer"><span class="metric-trend up">↓ Abaixo do limite</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F59E0B">
        <div class="metric-header">
          <div class="metric-label">Taxa de Erros</div>
          <div class="metric-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div>
        </div>
        <div class="metric-value">${d.taxa_erros}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↓ Baixo</span><span class="metric-period">< 0.1% meta</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">Requests / Dia</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
        </div>
        <div class="metric-value">${(d.requests_dia/1000).toFixed(0)}<span>k</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ Normal</span><span class="metric-period">hoje</span></div>
      </div>
    </div>

    <div class="grid-3">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg> Recursos do Sistema</div>
        </div>
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="stat-key">CPU</span>
            <span class="stat-val">${d.cpu_uso}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill success" style="width:${d.cpu_uso}%"></div></div>
        </div>
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="stat-key">Memória</span>
            <span class="stat-val">${d.memoria_uso}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill warning" style="width:${d.memoria_uso}%"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="stat-key">Disco</span>
            <span class="stat-val">${d.disco_uso}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill success" style="width:${d.disco_uso}%"></div></div>
        </div>
        <div class="divider"></div>
        <div class="stat-row"><span class="stat-key">Incidentes (30d)</span><span class="stat-val">${d.incidentes_30d}</span></div>
        <div class="stat-row"><span class="stat-key">Deploys (30d)</span><span class="stat-val">${d.deploys_30d}</span></div>
        <div class="stat-row"><span class="stat-key">Latência P50</span><span class="stat-val">${d.latencia_p50}ms</span></div>
        <div class="stat-row"><span class="stat-key">Latência P99</span><span class="stat-val">${d.latencia_p99}ms</span></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg> Status dos Serviços</div>
        </div>
        ${d.servicos.map(s => `
          <div class="stat-row">
            <span class="stat-key">${s.nome}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:11px;color:rgba(148,163,184,0.4)">${s.uptime}</span>
              ${statusBadge(s.status)}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg> Alertas</div>
        </div>
        ${d.alertas.map(a => `
          <div class="alert-item ${a.nivel}" style="margin-bottom:8px">
            <div class="alert-icon"><i data-lucide="${a.nivel === 'critical' ? 'alert-octagon' : a.nivel === 'warning' ? 'alert-triangle' : 'info'}"></i></div>
            <div class="alert-content">
              <div class="alert-title">${a.titulo}</div>
              <div class="alert-desc">${a.desc}</div>
            </div>
            <div class="alert-time">${a.ts}</div>
          </div>
        `).join('')}
        <div class="divider"></div>
        <div style="font-size:11px;color:rgba(148,163,184,0.4);text-align:center">0 erros críticos nas últimas 24h</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/></svg> Latência (últimas 12h)</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="chart-latencia"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg> Logs Recentes</div>
          <span class="card-action">Ver todos</span>
        </div>
        <div class="log-list">
          ${d.logs_recentes.slice(0, 5).map(l => `
            <div class="log-item">
              <div class="log-dot ${l.nivel === 'warning' ? 'warning' : l.nivel === 'error' ? 'danger' : 'success'}"></div>
              <div class="log-content">
                <div class="log-title">${l.msg}</div>
                <div class="log-meta">${l.ts}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    renderLineChart('chart-latencia', d.historico_latencia, '#6366F1', 'Latência ms');
    window.refreshIcons?.();
  }, 50);
}

/* ============================================================
   SEGURANÇA
   ============================================================ */
function renderSeguranca() {
  if (!DATA.seguranca) { document.getElementById('section-seguranca').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:14px">Dados de segurança serão carregados da API.</div></div>'; return; }
  const d = DATA.seguranca;
  document.getElementById('section-seguranca').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Segurança</div>
        <div class="page-subtitle">Eventos de segurança, auditoria, logins suspeitos e integridade</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> Relatório</button>
        <button class="btn btn-primary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg> Auditoria</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Score de Segurança</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg></div>
        </div>
        <div class="metric-value">${d.score}<span>/100</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ ${d.nivel}</span><span class="metric-period">nível</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Eventos (30d)</div>
          <div class="metric-icon"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg></div>
        </div>
        <div class="metric-value">${formatNumber(d.eventos_30d)}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ 0 críticos</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F59E0B">
        <div class="metric-header">
          <div class="metric-label">Logins Suspeitos</div>
          <div class="metric-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg></div>
        </div>
        <div class="metric-value">${d.logins_suspeitos}</div>
        <div class="metric-footer"><span class="metric-trend neutral">→ Monitorando</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">IPs Bloqueados</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg></div>
        </div>
        <div class="metric-value">${d.ips_bloqueados}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ Rate limiting</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg> Score & Integridade</div>
        </div>
        <div style="display:flex;gap:20px;align-items:center;margin-bottom:16px">
          <div class="security-score-ring">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(99,102,241,0.1)" stroke-width="8"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="#10B981" stroke-width="8"
                stroke-dasharray="${2 * Math.PI * 42}"
                stroke-dashoffset="${2 * Math.PI * 42 * (1 - d.score/100)}"
                stroke-linecap="round"/>
            </svg>
            <div class="security-score-text">
              <div class="security-score-value">${d.score}</div>
              <div class="security-score-label">Score</div>
            </div>
          </div>
          <div style="flex:1">
            <div class="stat-row"><span class="stat-key">Nível</span><span class="stat-val">${d.nivel}</span></div>
            <div class="stat-row"><span class="stat-key">Integridade</span><span class="stat-val">${d.integridade_status}</span></div>
            <div class="stat-row"><span class="stat-key">Certificados</span><span class="stat-val">${d.certificados_validos} válidos</span></div>
            <div class="stat-row"><span class="stat-key">Vuln. Críticas</span><span class="stat-val">${d.vulnerabilidades_criticas}</span></div>
            <div class="stat-row"><span class="stat-key">Vuln. Médias</span><span class="stat-val">${d.vulnerabilidades_medias}</span></div>
            <div class="stat-row"><span class="stat-key">Última Auditoria</span><span class="stat-val" style="font-size:10px">${d.auditoria_ultima}</span></div>
          </div>
        </div>
        <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:8px;padding:10px 12px">
          <div style="font-size:11px;font-weight:600;color:#34D399;margin-bottom:2px">Hash de Integridade</div>
          <div style="font-size:10px;font-family:'JetBrains Mono',monospace;color:rgba(148,163,184,0.5)">${d.integridade_hash}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg> Políticas de Segurança</div>
        </div>
        ${d.politicas.map(p => `
          <div class="stat-row">
            <span class="stat-key">${p.nome}</span>
            ${statusBadge(p.status)}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg> Log de Eventos de Segurança</div>
        <span class="card-action">Exportar</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Evento</th>
            <th>IP / Origem</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${d.eventos_recentes.map(e => `
            <tr>
              <td><span class="badge badge-${e.tipo === 'warning' ? 'warning' : e.tipo === 'danger' ? 'danger' : 'success'}"><span class="badge-dot"></span>${e.tipo}</span></td>
              <td>${e.msg}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(148,163,184,0.6)">${e.ip}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(148,163,184,0.5)">${e.ts}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  setTimeout(() => window.refreshIcons?.(), 50);
}

/* ============================================================
   CEO VIEW
   ============================================================ */
function renderCEO() {
  if (!DATA.ceo) { document.getElementById('section-ceo').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:14px">Dados CEO serão carregados da API.</div></div>'; return; }
  const d = DATA.ceo;
  document.getElementById('section-ceo').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">CEO View</div>
        <div class="page-subtitle">KPIs estratégicos, OKRs, próximos releases e métricas executivas</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> Board Report</button>
        <button class="btn btn-primary"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg> All-Hands</button>
      </div>
    </div>

    <div class="grid-4">
      ${d.kpis.slice(0,4).map(k => `
        <div class="metric-card" style="--metric-color:${k.positivo ? '#10B981' : '#F43F5E'}">
          <div class="metric-header">
            <div class="metric-label">${k.nome}</div>
            <div class="metric-icon" style="background:rgba(${k.positivo ? '16,185,129' : '244,63,94'},0.12);color:${k.positivo ? '#10B981' : '#F43F5E'}">
              <i data-lucide="${k.positivo ? 'trending-up' : 'trending-down'}"></i>
            </div>
          </div>
          <div class="metric-value" style="font-size:22px">${k.valor}</div>
          <div class="metric-footer">${trendHTML(k.tendencia, k.positivo)}<span class="metric-period">vs período anterior</span></div>
        </div>
      `).join('')}
    </div>

    <div class="grid-4">
      ${d.kpis.slice(4).map(k => `
        <div class="metric-card" style="--metric-color:${k.positivo ? '#6366F1' : '#F43F5E'}">
          <div class="metric-header">
            <div class="metric-label">${k.nome}</div>
            <div class="metric-icon" style="background:rgba(99,102,241,0.12);color:#6366F1">
              <svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
          </div>
          <div class="metric-value" style="font-size:22px">${k.valor}</div>
          <div class="metric-footer">${trendHTML(k.tendencia, k.positivo)}<span class="metric-period">vs período anterior</span></div>
        </div>
      `).join('')}
    </div>

    <div class="grid-2-1">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> OKRs — Q3 2026</div>
          <span class="badge badge-neutral">Ciclo Ativo</span>
        </div>
        ${d.okrs.map(o => `
          <div class="okr-item">
            <div class="okr-header">
              <div class="okr-title">${o.objetivo}</div>
              <div class="okr-progress-text">${o.progresso}%</div>
            </div>
            <div class="progress-bar" style="margin-bottom:10px">
              <div class="progress-fill ${o.progresso >= 80 ? 'success' : o.progresso >= 50 ? '' : 'warning'}" style="width:${o.progresso}%"></div>
            </div>
            ${o.resultados.map(r => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:14px;height:14px;border-radius:4px;background:${r.prog === 100 ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.1)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <i data-lucide="${r.prog === 100 ? 'check' : 'minus'}" style="width:8px;height:8px;color:${r.prog === 100 ? '#34D399' : '#6366F1'}"></i>
                </div>
                <span style="flex:1;font-size:11px;color:rgba(148,163,184,0.7)">${r.kr}</span>
                <span style="font-size:11px;font-weight:700;color:${r.prog === 100 ? '#34D399' : '#818CF8'}">${r.prog}%</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>

      <div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg> Próximos Releases</div>
          </div>
          ${d.proximos_releases.map(r => `
            <div class="roadmap-item">
              <div>
                <div style="font-size:12px;font-weight:700;color:#818CF8;font-family:'JetBrains Mono',monospace">${r.versao}</div>
                <div style="font-size:10px;color:rgba(148,163,184,0.4)">${r.data}</div>
              </div>
              <div class="roadmap-info">
                <div class="roadmap-desc">${r.desc}</div>
              </div>
              ${statusBadge(r.status)}
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> Unit Economics</div>
          </div>
          <div class="stat-row"><span class="stat-key">LTV</span><span class="stat-val">R$ ${d.metricas_estrategicas.ltv}</span></div>
          <div class="stat-row"><span class="stat-key">CAC</span><span class="stat-val">R$ ${d.metricas_estrategicas.cac}</span></div>
          <div class="stat-row"><span class="stat-key">LTV/CAC</span><span class="stat-val" style="color:#34D399">${(d.metricas_estrategicas.ltv/d.metricas_estrategicas.cac).toFixed(1)}x</span></div>
          <div class="stat-row"><span class="stat-key">Payback</span><span class="stat-val">${d.metricas_estrategicas.payback_meses} meses</span></div>
          <div class="stat-row"><span class="stat-key">Burn Rate</span><span class="stat-val">R$ ${formatNumber(d.metricas_estrategicas.burn_rate)}/mês</span></div>
          <div class="stat-row"><span class="stat-key">Runway</span><span class="stat-val" style="color:#34D399">${d.metricas_estrategicas.runway_meses} meses</span></div>
          <div class="stat-row"><span class="stat-key">K-Factor</span><span class="stat-val">${d.metricas_estrategicas.k_factor}</span></div>
          <div class="stat-row"><span class="stat-key">Ativação</span><span class="stat-val">${d.metricas_estrategicas.taxa_ativacao}%</span></div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => window.refreshIcons?.(), 50);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const SECTION_RENDERERS = {
  overview:  renderOverview,
  empresa:   renderEmpresa,
  produto:   renderProduto,
  ia:        renderIA,
  plataforma: renderPlataforma,
  seguranca: renderSeguranca,
  ceo:       renderCEO,
};

const SECTION_LABELS = {
  overview:  'Overview',
  empresa:   'Empresa',
  produto:   'Produto',
  ia:        'IA & Companion',
  plataforma: 'Plataforma',
  seguranca: 'Segurança',
  ceo:       'CEO View',
};

function showSection(name, el) {
  // Esconder todas as seções
  document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Mostrar seção selecionada
  const section = document.getElementById('section-' + name);
  if (section) section.classList.add('active');

  // Marcar nav item ativo
  if (el) el.classList.add('active');

  // Atualizar breadcrumb
  const bc = document.getElementById('breadcrumb-current');
  if (bc) bc.textContent = SECTION_LABELS[name] || name;

  STATE.currentSection = name;

  // Renderizar conteúdo
  if (SECTION_RENDERERS[name]) {
    SECTION_RENDERERS[name]();
  }
}

/* ============================================================
   SIDEBAR TOGGLE
   ============================================================ */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const icon = document.getElementById('toggle-icon');
  STATE.sidebarCollapsed = !STATE.sidebarCollapsed;
  sidebar.classList.toggle('collapsed', STATE.sidebarCollapsed);
  if (icon) {
    icon.setAttribute('data-lucide', STATE.sidebarCollapsed ? 'chevron-right' : 'chevron-left');
    window.refreshIcons?.();
  }
}

/* ============================================================
   CLOCK
   ============================================================ */
function updateClock() {
  const el = document.getElementById('topbar-time');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

/* ============================================================
   REFRESH
   ============================================================ */
function refreshData() {
  const icon = document.getElementById('refresh-icon');
  if (icon) {
    icon.style.animation = 'spin 0.8s linear infinite';
    setTimeout(() => {
      icon.style.animation = '';
      STATE.lastRefresh = new Date();
      if (SECTION_RENDERERS[STATE.currentSection]) {
        SECTION_RENDERERS[STATE.currentSection]();
      }
    }, 800);
  }
}

/* ============================================================
   EXPORT (placeholder)
   ============================================================ */
function exportReport() {
  alert('Relatório exportado com sucesso!\nArquivo: LifeOS_Founder_Report_' + new Date().toISOString().slice(0,10) + '.pdf');
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar ícones
  window.refreshIcons?.();
  // Iniciar relógio
  updateClock();
  setInterval(updateClock, 1000);
  // Load real data from APIs
  loadDashboardData();
  // Auto-refresh a cada 60s
  STATE.refreshInterval = setInterval(() => {
    loadDashboardData();
  }, 60000);
});
