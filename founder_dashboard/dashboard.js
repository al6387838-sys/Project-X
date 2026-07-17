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
   MOCK DATA — LifeOS Platform
   ============================================================ */
const DATA = {
  empresa: {
    usuarios_cadastrados: 1_247,
    usuarios_ativos: 834,
    beta_testers: 112,
    receita_mrr: 4_890,
    receita_arr: 58_680,
    assinaturas_ativas: 203,
    assinaturas_trial: 89,
    waitlist: 3_412,
    churn_rate: 2.4,
    nps: 72,
    crescimento_usuarios: 18.3,
    crescimento_receita: 24.7,
    crescimento_waitlist: 31.2,
    historico_usuarios: [420, 510, 620, 710, 820, 940, 1050, 1140, 1247],
    historico_mrr: [800, 1200, 1800, 2400, 3100, 3700, 4200, 4600, 4890],
    historico_waitlist: [800, 1100, 1500, 1900, 2300, 2700, 3000, 3200, 3412],
    planos: [
      { nome: 'Free',    usuarios: 631, percentual: 50.6, cor: '#6366F1' },
      { nome: 'Pro',     usuarios: 203, percentual: 16.3, cor: '#8B5CF6' },
      { nome: 'Trial',   usuarios: 89,  percentual: 7.1,  cor: '#3B82F6' },
      { nome: 'Beta',    usuarios: 112, percentual: 9.0,  cor: '#10B981' },
      { nome: 'Waitlist',usuarios: 212, percentual: 17.0, cor: '#F59E0B' },
    ],
  },

  produto: {
    versao_atual: '1.0.0-rc',
    versao_nome: 'Release Candidate',
    versao_data: '2026-07-09',
    sprint_atual: 28,
    testes_passando: 544,
    testes_total: 544,
    cobertura_codigo: 94.2,
    bugs_abertos: 7,
    bugs_criticos: 0,
    features_concluidas: [
      { nome: 'Life Kernel — Núcleo central do sistema',       tag: 'core' },
      { nome: 'Intelligence Hub — Motor de IA',                tag: 'ai'   },
      { nome: 'Action Engine — Automação de ações',            tag: 'core' },
      { nome: 'Decision Engine — Tomada de decisão',           tag: 'ai'   },
      { nome: 'Learning Engine — Aprendizado contínuo',        tag: 'ai'   },
      { nome: 'Connector Platform — Integrações externas',     tag: 'infra'},
      { nome: 'Security Center — Segurança e auditoria',       tag: 'infra'},
      { nome: 'Observability Stack — Monitoramento',           tag: 'infra'},
      { nome: 'Premium UI — Design System v2.0',               tag: 'ux'   },
      { nome: 'OAuth System — Autenticação segura',            tag: 'infra'},
      { nome: 'Cloud Sync — Sincronização multi-device',       tag: 'infra'},
      { nome: 'Growth OS — Funil e retenção',                  tag: 'core' },
    ],
    features_em_dev: [
      { nome: 'Voice Interface — Interação por voz',           tag: 'ai',   prog: 35 },
      { nome: 'Predictive Action Engine',                      tag: 'ai',   prog: 20 },
      { nome: 'Connector Marketplace API pública',             tag: 'infra', prog: 55 },
      { nome: 'IoT Orchestration (Matter/Thread)',              tag: 'infra', prog: 10 },
      { nome: 'Financial Engine — Budget autônomo',            tag: 'core', prog: 40 },
    ],
    roadmap: [
      { fase: 'V0.9',   nome: 'Alpha Interno',         desc: 'Arquitetura base e motores core',                   status: 'done'    },
      { fase: 'V1.0-rc',nome: 'Release Candidate',     desc: 'Suite completa, 544 testes, deploy production',     status: 'active'  },
      { fase: 'V1.0.x', nome: 'Stability & Scale',     desc: 'Chaos testing, Rust extensions, DB sharding',       status: 'planned' },
      { fase: 'V1.1.0', nome: 'Intelligence Expansion', desc: 'Voice Interface, Predictive Engine, Globalization', status: 'planned' },
      { fase: 'V1.2.0', nome: 'Ecosystem Growth',      desc: 'Connector Marketplace, IoT, Financial Engine',      status: 'planned' },
      { fase: 'V2.0.0', nome: 'Decentralization',      desc: 'P2P Sync, Local LLM, Federated Learning',          status: 'planned' },
    ],
  },

  ia: {
    companion_status: 'ONLINE',
    companion_model: 'GPT-4o + Fine-tuned LifeOS',
    companion_versao: '2.4.1',
    missoes_executadas: 8_934,
    missoes_hoje: 247,
    missoes_semana: 1_823,
    taxa_sucesso: 97.8,
    aprendizado_ciclos: 1_204,
    aprendizado_ultima_atualizacao: '2026-07-09 03:00 UTC',
    aprendizado_precisao: 94.6,
    sig_status: 'ACTIVE',
    sig_versao: 'SIG-v3.2',
    sig_modelos_ativos: 7,
    sig_ultima_inferencia: '2 min atrás',
    tokens_consumidos_mes: 48_200_000,
    latencia_media_ms: 312,
    historico_missoes: [180, 210, 195, 230, 215, 240, 225, 247],
    modelos: [
      { nome: 'Companion Core',    status: 'online',  latencia: '312ms', req_dia: 4200 },
      { nome: 'Decision Engine',   status: 'online',  latencia: '89ms',  req_dia: 2100 },
      { nome: 'Learning Engine',   status: 'online',  latencia: '445ms', req_dia: 890  },
      { nome: 'Pattern Recognizer',status: 'online',  latencia: '156ms', req_dia: 3400 },
      { nome: 'Emotion Analyzer',  status: 'standby', latencia: '—',     req_dia: 0    },
      { nome: 'Voice Interface',   status: 'dev',     latencia: '—',     req_dia: 0    },
      { nome: 'Predictive Engine', status: 'dev',     latencia: '—',     req_dia: 0    },
    ],
  },

  plataforma: {
    uptime_30d: 99.94,
    uptime_7d: 100.0,
    latencia_p50: 48,
    latencia_p95: 187,
    latencia_p99: 412,
    taxa_erros: 0.08,
    requests_dia: 142_800,
    requests_hora: 5_950,
    cpu_uso: 34,
    memoria_uso: 61,
    disco_uso: 28,
    incidentes_30d: 1,
    deploys_30d: 8,
    logs_recentes: [
      { nivel: 'info',    msg: 'Deploy v1.0.0-rc concluído com sucesso',         ts: '09/07 18:42' },
      { nivel: 'info',    msg: '544 testes passando — zero falhas',              ts: '09/07 18:40' },
      { nivel: 'warning', msg: 'Latência P99 acima de 400ms por 3 minutos',      ts: '09/07 14:22' },
      { nivel: 'info',    msg: 'Backup automático concluído — 2.4 GB',           ts: '09/07 03:00' },
      { nivel: 'info',    msg: 'Certificado SSL renovado automaticamente',       ts: '08/07 22:15' },
      { nivel: 'info',    msg: 'Prometheus + Grafana stack atualizado',          ts: '08/07 16:30' },
      { nivel: 'info',    msg: 'Auto-scaling ativado — 3 instâncias',            ts: '07/07 11:00' },
      { nivel: 'warning', msg: 'Pico de CPU 78% — normalizado em 4 min',        ts: '06/07 20:45' },
    ],
    alertas: [
      { nivel: 'warning', titulo: 'Latência P99 Elevada',    desc: 'P99 atingiu 412ms às 14:22. Limiar: 400ms. Monitorando.', ts: '14:22' },
      { nivel: 'info',    titulo: 'Deploy Agendado',         desc: 'v1.0.0 estável programado para 15/07 às 02:00 UTC.',      ts: '12:00' },
      { nivel: 'info',    titulo: 'Backup Concluído',        desc: 'Snapshot diário de 2.4 GB armazenado com sucesso.',       ts: '03:00' },
    ],
    historico_latencia: [42, 45, 48, 51, 44, 47, 52, 48, 46, 49, 187, 48],
    historico_erros: [0.05, 0.06, 0.07, 0.08, 0.06, 0.09, 0.07, 0.08],
    servicos: [
      { nome: 'API Gateway',       status: 'online',  uptime: '100%' },
      { nome: 'Life Kernel',       status: 'online',  uptime: '99.9%' },
      { nome: 'Intelligence Hub',  status: 'online',  uptime: '99.9%' },
      { nome: 'Action Engine',     status: 'online',  uptime: '100%' },
      { nome: 'Database (Primary)',status: 'online',  uptime: '100%' },
      { nome: 'Database (Replica)',status: 'online',  uptime: '100%' },
      { nome: 'Redis Cache',       status: 'online',  uptime: '100%' },
      { nome: 'Object Storage',    status: 'online',  uptime: '100%' },
    ],
  },

  seguranca: {
    score: 94,
    nivel: 'ALTO',
    eventos_30d: 1_847,
    eventos_criticos: 0,
    eventos_suspeitos: 2,
    logins_suspeitos: 2,
    tentativas_bloqueadas: 34,
    ips_bloqueados: 12,
    auditoria_ultima: '2026-07-09 18:42 UTC',
    integridade_status: 'ÍNTEGRO',
    integridade_hash: 'sha256:a3f8c2d1...',
    certificados_validos: 4,
    certificados_expirando: 0,
    vulnerabilidades_criticas: 0,
    vulnerabilidades_medias: 2,
    eventos_recentes: [
      { tipo: 'info',    msg: 'Auditoria automática concluída — sem anomalias',   ts: '09/07 18:42', ip: 'sistema' },
      { tipo: 'warning', msg: 'Login de IP incomum — Brasil/SP bloqueado',        ts: '09/07 11:30', ip: '177.x.x.x' },
      { tipo: 'warning', msg: 'Múltiplas tentativas de login — conta bloqueada',  ts: '08/07 23:15', ip: '45.x.x.x' },
      { tipo: 'info',    msg: 'Certificado SSL renovado automaticamente',         ts: '08/07 22:15', ip: 'sistema' },
      { tipo: 'info',    msg: 'Scan de vulnerabilidades — 0 críticas encontradas',ts: '07/07 04:00', ip: 'sistema' },
      { tipo: 'info',    msg: 'Rate limiting ativado — 34 IPs bloqueados (24h)',  ts: '06/07 18:00', ip: 'sistema' },
    ],
    politicas: [
      { nome: 'MFA Obrigatório',          status: 'ativo' },
      { nome: 'Rate Limiting',            status: 'ativo' },
      { nome: 'Criptografia AES-256',     status: 'ativo' },
      { nome: 'TLS 1.3',                  status: 'ativo' },
      { nome: 'RBAC',                     status: 'ativo' },
      { nome: 'Audit Logging',            status: 'ativo' },
      { nome: 'IP Allowlist (Admin)',      status: 'ativo' },
      { nome: 'Pen Test Trimestral',      status: 'agendado' },
    ],
  },

  ceo: {
    kpis: [
      { nome: 'MRR',            valor: 'R$ 4.890',  tendencia: '+24.7%', positivo: true  },
      { nome: 'ARR',            valor: 'R$ 58.680', tendencia: '+24.7%', positivo: true  },
      { nome: 'Usuários Ativos',valor: '834',        tendencia: '+18.3%', positivo: true  },
      { nome: 'NPS',            valor: '72',         tendencia: '+8 pts', positivo: true  },
      { nome: 'Churn Mensal',   valor: '2.4%',       tendencia: '-0.3%',  positivo: true  },
      { nome: 'LTV/CAC',        valor: '4.2x',       tendencia: '+0.4x',  positivo: true  },
      { nome: 'Waitlist',       valor: '3.412',      tendencia: '+31.2%', positivo: true  },
      { nome: 'Uptime',         valor: '99.94%',     tendencia: '=',      positivo: true  },
    ],
    okrs: [
      {
        objetivo: 'Lançar V1.0 em produção com qualidade enterprise',
        progresso: 92,
        resultados: [
          { kr: '544 testes passando (100%)',  prog: 100 },
          { kr: 'Deploy em staging validado',  prog: 100 },
          { kr: 'Documentação completa',       prog: 85  },
          { kr: 'Deploy em produção',          prog: 80  },
        ],
      },
      {
        objetivo: 'Atingir 1.000 usuários ativos no Q3/2026',
        progresso: 83,
        resultados: [
          { kr: '1.000 usuários cadastrados',  prog: 100 },
          { kr: '834 usuários ativos (83.4%)', prog: 83  },
          { kr: '200+ assinantes pagantes',    prog: 100 },
          { kr: 'NPS ≥ 70',                   prog: 100 },
        ],
      },
      {
        objetivo: 'Construir base técnica escalável para 100k usuários',
        progresso: 70,
        resultados: [
          { kr: 'Observability Stack completo', prog: 100 },
          { kr: 'Chaos Testing implementado',   prog: 30  },
          { kr: 'DB Sharding preparado',        prog: 50  },
          { kr: 'Latência P95 < 200ms',         prog: 100 },
        ],
      },
    ],
    proximos_releases: [
      { versao: 'v1.0.0',   data: '15 Jul 2026', desc: 'Release estável para produção',         status: 'iminente' },
      { versao: 'v1.0.1',   data: 'Ago 2026',    desc: 'Hotfixes e otimizações de performance',  status: 'planejado' },
      { versao: 'v1.1.0',   data: 'Set 2026',    desc: 'Voice Interface + Predictive Engine',    status: 'planejado' },
      { versao: 'v1.2.0',   data: 'Nov 2026',    desc: 'Connector Marketplace público',          status: 'planejado' },
    ],
    metricas_estrategicas: {
      runway_meses: 18,
      burn_rate: 12_400,
      cac: 48,
      ltv: 201,
      payback_meses: 6.2,
      k_factor: 0.34,
      taxa_ativacao: 67,
      conversao_visitante: 3.8,
    },
  },
};

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
          <i data-lucide="download"></i> Exportar
        </button>
        <button class="btn btn-primary" onclick="showSection('ceo', document.querySelector('[onclick*=ceo]'))">
          <i data-lucide="target"></i> CEO View
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
          <div class="metric-icon"><i data-lucide="users"></i></div>
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
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><i data-lucide="trending-up"></i></div>
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
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><i data-lucide="activity"></i></div>
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
          <div class="metric-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6"><i data-lucide="list-ordered"></i></div>
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
          <div class="card-title"><i data-lucide="cpu"></i> Status dos Módulos</div>
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
          <div class="card-title"><i data-lucide="bell"></i> Alertas Ativos</div>
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
          <div class="card-title"><i data-lucide="zap"></i> Performance Rápida</div>
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
          <div class="card-title"><i data-lucide="bar-chart-2"></i> Crescimento de Usuários</div>
          <span class="card-action">Detalhes</span>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="chart-overview-users"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i data-lucide="dollar-sign"></i> Evolução do MRR</div>
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
    lucide.createIcons();
  }, 50);
}

// ---- EMPRESA ----
function renderEmpresa() {
  const d = DATA.empresa;
  document.getElementById('section-empresa').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Empresa</div>
        <div class="page-subtitle">Métricas de negócio, usuários, receita e crescimento</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><i data-lucide="filter"></i> Período</button>
        <button class="btn btn-primary"><i data-lucide="download"></i> Relatório</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Usuários Cadastrados</div>
          <div class="metric-icon"><i data-lucide="user-plus"></i></div>
        </div>
        <div class="metric-value">${formatNumber(d.usuarios_cadastrados)}</div>
        <div class="metric-footer">${trendHTML('+' + d.crescimento_usuarios + '%')}<span class="metric-period">30 dias</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Usuários Ativos</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><i data-lucide="users"></i></div>
        </div>
        <div class="metric-value">${formatNumber(d.usuarios_ativos)}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ ${((d.usuarios_ativos/d.usuarios_cadastrados)*100).toFixed(1)}%</span><span class="metric-period">taxa de ativação</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#8B5CF6">
        <div class="metric-header">
          <div class="metric-label">Beta Testers</div>
          <div class="metric-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6"><i data-lucide="flask-conical"></i></div>
        </div>
        <div class="metric-value">${d.beta_testers}</div>
        <div class="metric-footer"><span class="metric-trend neutral">→ Estável</span><span class="metric-period">programa beta</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F59E0B">
        <div class="metric-header">
          <div class="metric-label">Waitlist</div>
          <div class="metric-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B"><i data-lucide="list-ordered"></i></div>
        </div>
        <div class="metric-value">${formatNumber(d.waitlist)}</div>
        <div class="metric-footer">${trendHTML('+' + d.crescimento_waitlist + '%')}<span class="metric-period">30 dias</span></div>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">MRR</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><i data-lucide="trending-up"></i></div>
        </div>
        <div class="metric-value">R$ ${(d.receita_mrr/1000).toFixed(1)}<span>k</span></div>
        <div class="metric-footer">${trendHTML('+' + d.crescimento_receita + '%')}<span class="metric-period">30 dias</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">ARR</div>
          <div class="metric-icon"><i data-lucide="bar-chart"></i></div>
        </div>
        <div class="metric-value">R$ ${(d.receita_arr/1000).toFixed(0)}<span>k</span></div>
        <div class="metric-footer">${trendHTML('+' + d.crescimento_receita + '%')}<span class="metric-period">anualizado</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">Assinaturas Ativas</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><i data-lucide="credit-card"></i></div>
        </div>
        <div class="metric-value">${d.assinaturas_ativas}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ +12</span><span class="metric-period">este mês</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F43F5E">
        <div class="metric-header">
          <div class="metric-label">Churn Rate</div>
          <div class="metric-icon" style="background:rgba(244,63,94,0.12);color:#F43F5E"><i data-lucide="user-minus"></i></div>
        </div>
        <div class="metric-value">${d.churn_rate}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↓ -0.3%</span><span class="metric-period">melhora</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i data-lucide="pie-chart"></i> Distribuição de Planos</div>
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
          <div class="card-title"><i data-lucide="trending-up"></i> Crescimento MRR</div>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="chart-mrr-empresa"></canvas>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i data-lucide="users"></i> Crescimento de Usuários</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="chart-users-empresa"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i data-lucide="list-ordered"></i> Waitlist Growth</div>
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
    lucide.createIcons();
  }, 50);
}

// ---- PRODUTO ----
function renderProduto() {
  const d = DATA.produto;
  document.getElementById('section-produto').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Produto</div>
        <div class="page-subtitle">Versão atual, roadmap, funcionalidades e qualidade do código</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><i data-lucide="git-branch"></i> Changelog</button>
        <button class="btn btn-primary"><i data-lucide="rocket"></i> Deploy</button>
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
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><i data-lucide="check-circle-2"></i></div>
        </div>
        <div class="metric-value">${d.testes_passando}<span>/${d.testes_total}</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ 100%</span><span class="metric-period">pass rate</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Cobertura de Código</div>
          <div class="metric-icon"><i data-lucide="code-2"></i></div>
        </div>
        <div class="metric-value">${d.cobertura_codigo}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ Alta</span><span class="metric-period">cobertura</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F59E0B">
        <div class="metric-header">
          <div class="metric-label">Bugs Abertos</div>
          <div class="metric-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B"><i data-lucide="bug"></i></div>
        </div>
        <div class="metric-value">${d.bugs_abertos}</div>
        <div class="metric-footer"><span class="metric-trend up">↓ 0 críticos</span><span class="metric-period">todos menores</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#8B5CF6">
        <div class="metric-header">
          <div class="metric-label">Sprint Atual</div>
          <div class="metric-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6"><i data-lucide="layers"></i></div>
        </div>
        <div class="metric-value">${d.sprint_atual}</div>
        <div class="metric-footer"><span class="metric-trend neutral">→ Em andamento</span></div>
      </div>
    </div>

    <div class="grid-3-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i data-lucide="map"></i> Roadmap</div>
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
            <div class="card-title"><i data-lucide="check-square"></i> Funcionalidades Concluídas</div>
            <span class="badge badge-success">${d.features_concluidas.length}</span>
          </div>
          ${d.features_concluidas.map(f => `
            <div class="feature-item">
              <div class="feature-check done"><i data-lucide="check"></i></div>
              <span class="feature-name done">${f.nome}</span>
              <span class="feature-tag ${f.tag}">${f.tag}</span>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i data-lucide="loader"></i> Em Desenvolvimento</div>
            <span class="badge badge-neutral">${d.features_em_dev.length}</span>
          </div>
          ${d.features_em_dev.map(f => `
            <div class="feature-item" style="flex-direction:column;align-items:flex-start;gap:6px">
              <div style="display:flex;align-items:center;gap:8px;width:100%">
                <div class="feature-check wip"><i data-lucide="loader-2"></i></div>
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

  setTimeout(() => lucide.createIcons(), 50);
}

// ---- IA ----
function renderIA() {
  const d = DATA.ia;
  document.getElementById('section-ia').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">IA & Companion</div>
        <div class="page-subtitle">Status do Companion, missões executadas, aprendizado e SIG</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><i data-lucide="refresh-cw"></i> Sincronizar</button>
        <button class="btn btn-primary"><i data-lucide="brain-circuit"></i> Console IA</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#8B5CF6">
        <div class="metric-header">
          <div class="metric-label">Missões Executadas</div>
          <div class="metric-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6"><i data-lucide="zap"></i></div>
        </div>
        <div class="metric-value">${formatNumber(d.missoes_executadas)}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ ${d.missoes_hoje} hoje</span><span class="metric-period">total</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Taxa de Sucesso</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><i data-lucide="check-circle"></i></div>
        </div>
        <div class="metric-value">${d.taxa_sucesso}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ Excelente</span><span class="metric-period">missões</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Ciclos de Aprendizado</div>
          <div class="metric-icon"><i data-lucide="graduation-cap"></i></div>
        </div>
        <div class="metric-value">${formatNumber(d.aprendizado_ciclos)}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ ${d.aprendizado_precisao}%</span><span class="metric-period">precisão</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">Tokens / Mês</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><i data-lucide="cpu"></i></div>
        </div>
        <div class="metric-value">${(d.tokens_consumidos_mes/1_000_000).toFixed(1)}<span>M</span></div>
        <div class="metric-footer"><span class="metric-trend neutral">→ Normal</span><span class="metric-period">consumo</span></div>
      </div>
    </div>

    <div class="grid-1-2">
      <div>
        <div class="card companion-status-card" style="margin-bottom:16px">
          <div class="companion-orb">
            <i data-lucide="brain-circuit"></i>
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
            <div class="card-title"><i data-lucide="database"></i> SIG — Sistema de Inteligência</div>
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
            <div class="card-title"><i data-lucide="layers"></i> Modelos Ativos</div>
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
            <div class="card-title"><i data-lucide="activity"></i> Missões por Hora (últimas 8h)</div>
          </div>
          <div class="chart-container" style="height:160px">
            <canvas id="chart-missoes"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><i data-lucide="graduation-cap"></i> Aprendizado Contínuo</div>
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
    lucide.createIcons();
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
  const d = DATA.plataforma;
  document.getElementById('section-plataforma').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Plataforma</div>
        <div class="page-subtitle">Performance, disponibilidade, logs e alertas do sistema</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><i data-lucide="terminal"></i> Console</button>
        <button class="btn btn-primary"><i data-lucide="external-link"></i> Grafana</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Uptime 30 dias</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><i data-lucide="activity"></i></div>
        </div>
        <div class="metric-value">${d.uptime_30d}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ SLA 99.9%</span><span class="metric-period">cumprido</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Latência P95</div>
          <div class="metric-icon"><i data-lucide="timer"></i></div>
        </div>
        <div class="metric-value">${d.latencia_p95}<span>ms</span></div>
        <div class="metric-footer"><span class="metric-trend up">↓ Abaixo do limite</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F59E0B">
        <div class="metric-header">
          <div class="metric-label">Taxa de Erros</div>
          <div class="metric-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B"><i data-lucide="alert-triangle"></i></div>
        </div>
        <div class="metric-value">${d.taxa_erros}<span>%</span></div>
        <div class="metric-footer"><span class="metric-trend up">↓ Baixo</span><span class="metric-period">< 0.1% meta</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">Requests / Dia</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><i data-lucide="bar-chart-2"></i></div>
        </div>
        <div class="metric-value">${(d.requests_dia/1000).toFixed(0)}<span>k</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ Normal</span><span class="metric-period">hoje</span></div>
      </div>
    </div>

    <div class="grid-3">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i data-lucide="cpu"></i> Recursos do Sistema</div>
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
          <div class="card-title"><i data-lucide="server"></i> Status dos Serviços</div>
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
          <div class="card-title"><i data-lucide="bell"></i> Alertas</div>
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
          <div class="card-title"><i data-lucide="timer"></i> Latência (últimas 12h)</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="chart-latencia"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i data-lucide="scroll-text"></i> Logs Recentes</div>
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
    lucide.createIcons();
  }, 50);
}

/* ============================================================
   SEGURANÇA
   ============================================================ */
function renderSeguranca() {
  const d = DATA.seguranca;
  document.getElementById('section-seguranca').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">Segurança</div>
        <div class="page-subtitle">Eventos de segurança, auditoria, logins suspeitos e integridade</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><i data-lucide="file-text"></i> Relatório</button>
        <button class="btn btn-primary"><i data-lucide="shield"></i> Auditoria</button>
      </div>
    </div>

    <div class="grid-4">
      <div class="metric-card" style="--metric-color:#10B981">
        <div class="metric-header">
          <div class="metric-label">Score de Segurança</div>
          <div class="metric-icon" style="background:rgba(16,185,129,0.12);color:#10B981"><i data-lucide="shield-check"></i></div>
        </div>
        <div class="metric-value">${d.score}<span>/100</span></div>
        <div class="metric-footer"><span class="metric-trend up">↑ ${d.nivel}</span><span class="metric-period">nível</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#6366F1">
        <div class="metric-header">
          <div class="metric-label">Eventos (30d)</div>
          <div class="metric-icon"><i data-lucide="activity"></i></div>
        </div>
        <div class="metric-value">${formatNumber(d.eventos_30d)}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ 0 críticos</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#F59E0B">
        <div class="metric-header">
          <div class="metric-label">Logins Suspeitos</div>
          <div class="metric-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B"><i data-lucide="user-x"></i></div>
        </div>
        <div class="metric-value">${d.logins_suspeitos}</div>
        <div class="metric-footer"><span class="metric-trend neutral">→ Monitorando</span></div>
      </div>
      <div class="metric-card" style="--metric-color:#3B82F6">
        <div class="metric-header">
          <div class="metric-label">IPs Bloqueados</div>
          <div class="metric-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6"><i data-lucide="ban"></i></div>
        </div>
        <div class="metric-value">${d.ips_bloqueados}</div>
        <div class="metric-footer"><span class="metric-trend up">↑ Rate limiting</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i data-lucide="shield"></i> Score & Integridade</div>
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
          <div class="card-title"><i data-lucide="shield-alert"></i> Políticas de Segurança</div>
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
        <div class="card-title"><i data-lucide="scroll-text"></i> Log de Eventos de Segurança</div>
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

  setTimeout(() => lucide.createIcons(), 50);
}

/* ============================================================
   CEO VIEW
   ============================================================ */
function renderCEO() {
  const d = DATA.ceo;
  document.getElementById('section-ceo').innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title">CEO View</div>
        <div class="page-subtitle">KPIs estratégicos, OKRs, próximos releases e métricas executivas</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary"><i data-lucide="file-text"></i> Board Report</button>
        <button class="btn btn-primary"><i data-lucide="presentation"></i> All-Hands</button>
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
              <i data-lucide="bar-chart-2"></i>
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
          <div class="card-title"><i data-lucide="target"></i> OKRs — Q3 2026</div>
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
            <div class="card-title"><i data-lucide="rocket"></i> Próximos Releases</div>
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
            <div class="card-title"><i data-lucide="bar-chart"></i> Unit Economics</div>
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

  setTimeout(() => lucide.createIcons(), 50);
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
    lucide.createIcons();
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
  lucide.createIcons();

  // Iniciar relógio
  updateClock();
  setInterval(updateClock, 1000);

  // Renderizar overview inicial
  renderOverview();

  // Auto-refresh a cada 60s
  STATE.refreshInterval = setInterval(() => {
    if (SECTION_RENDERERS[STATE.currentSection]) {
      SECTION_RENDERERS[STATE.currentSection]();
    }
  }, 60000);

  
  
});
