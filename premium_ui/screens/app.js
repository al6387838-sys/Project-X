/**
 * LifeOS Premium — App Controller
 * Sprint 028 | Version 2.0.0
 *
 * Main application logic for all V2 screens.
 */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
const AppState = {
  user: {
    name: 'Usuário',
    values: [],
    lifeAreas: {},
    lifeScore: 0,
  },
  missions: [],
  timelineEvents: [],
  companionMessages: [],
  currentView: 'dashboard',
  onboardingStep: 0,
  isOnboarded: false,
};

/* ============================================================
   CONSTANTS
   ============================================================ */
const LIFE_AREAS = [
  { id: 'saude',          name: 'Saúde',          icon: '💪', color: '#10B981' },
  { id: 'carreira',       name: 'Carreira',        icon: '🚀', color: '#3B82F6' },
  { id: 'relacionamentos',name: 'Relacionamentos', icon: '❤️', color: '#EF4444' },
  { id: 'financas',       name: 'Finanças',        icon: '💰', color: '#F59E0B' },
  { id: 'aprendizado',    name: 'Aprendizado',     icon: '📚', color: '#8B5CF6' },
  { id: 'lazer',          name: 'Lazer',           icon: '🎨', color: '#EC4899' },
];

const VALUES = [
  '🌟 Família', '🕊️ Liberdade', '📈 Crescimento', '🌍 Impacto',
  '💚 Saúde', '🎨 Criatividade', '📖 Conhecimento', '🛡️ Segurança',
  '🏔️ Aventura', '🤝 Conexão', '⚖️ Equilíbrio', '🔥 Paixão'
];

const ONBOARDING_STEPS = [
  {
    icon: '🧠',
    title: 'Bem-vindo ao LifeOS',
    subtitle: 'Seu copiloto de vida pessoal. Vamos configurar sua experiência em menos de 2 minutos.',
    type: 'welcome',
  },
  {
    icon: '🌟',
    title: 'Seus Valores',
    subtitle: 'Selecione os valores que mais importam para você. Eles guiarão todas as decisões do LifeOS.',
    type: 'values',
  },
  {
    icon: '⚖️',
    title: 'Áreas da Vida',
    subtitle: 'Como você avalia cada área da sua vida agora? Seja honesto — isso é apenas para você.',
    type: 'areas',
  },
  {
    icon: '🎯',
    title: 'Seu Primeiro Objetivo',
    subtitle: 'Qual é a coisa mais importante que você quer alcançar nos próximos 90 dias?',
    type: 'goal',
  },
  {
    icon: '✨',
    title: 'Tudo Pronto!',
    subtitle: 'Seu LifeOS está configurado. Vamos começar sua jornada.',
    type: 'complete',
  },
];

const MOCK_MISSIONS = [
  {
    id: 1, title: 'Aprender TypeScript', category: 'aprendizado', priority: 'high',
    objective: 'Dominar TypeScript para melhorar a qualidade do código e abrir novas oportunidades.',
    progress: 65, deadline: '2026-09-30', status: 'active',
    subtasks: [
      { id: 1, text: 'Completar curso básico', done: true },
      { id: 2, text: 'Praticar com projetos pessoais', done: true },
      { id: 3, text: 'Contribuir para projeto open-source', done: false },
      { id: 4, text: 'Certificação TypeScript', done: false },
    ]
  },
  {
    id: 2, title: 'Exercitar 4x por semana', category: 'saude', priority: 'high',
    objective: 'Melhorar saúde física e mental através de exercícios regulares.',
    progress: 80, deadline: '2026-12-31', status: 'active',
    subtasks: [
      { id: 1, text: 'Definir rotina de treinos', done: true },
      { id: 2, text: 'Academia 4x semana', done: false },
      { id: 3, text: 'Correr 5km sem parar', done: false },
    ]
  },
  {
    id: 3, title: 'Reserva de Emergência', category: 'financas', priority: 'medium',
    objective: 'Construir reserva de 6 meses de despesas para segurança financeira.',
    progress: 40, deadline: '2026-12-31', status: 'active',
    subtasks: [
      { id: 1, text: 'Mapear despesas mensais', done: true },
      { id: 2, text: 'Abrir conta de investimento', done: true },
      { id: 3, text: 'Automatizar aportes mensais', done: false },
      { id: 4, text: 'Atingir meta de 6 meses', done: false },
    ]
  },
  {
    id: 4, title: 'Lançar Produto Digital', category: 'carreira', priority: 'high',
    objective: 'Criar e lançar um produto digital que gere renda passiva.',
    progress: 25, deadline: '2026-10-31', status: 'active',
    subtasks: [
      { id: 1, text: 'Validar ideia com potenciais clientes', done: true },
      { id: 2, text: 'Desenvolver MVP', done: false },
      { id: 3, text: 'Criar landing page', done: false },
      { id: 4, text: 'Lançar e coletar feedback', done: false },
    ]
  },
];

const MOCK_TIMELINE = [
  {
    id: 1, year: 2026, date: '2026-07-09', title: 'LifeOS Sprint 028 — Premium Experience',
    description: 'Implementação completa do Design System V2, Component Library e todas as UIs premium.',
    category: 'carreira', tags: ['lifeos', 'sprint', 'design'], color: '#6366F1'
  },
  {
    id: 2, year: 2026, date: '2026-06-15', title: 'Início do Projeto LifeOS',
    description: 'Primeiro commit do Project-X. Visão de criar um copiloto de vida pessoal com IA.',
    category: 'carreira', tags: ['lifeos', 'inicio'], color: '#3B82F6'
  },
  {
    id: 3, year: 2026, date: '2026-05-01', title: 'Meta de Saúde — 30 dias',
    description: 'Completei 30 dias consecutivos de exercício físico.',
    category: 'saude', tags: ['saude', 'conquista'], color: '#10B981'
  },
  {
    id: 4, year: 2026, date: '2026-03-20', title: 'Certificação TypeScript',
    description: 'Obtive certificação avançada em TypeScript após 3 meses de estudo.',
    category: 'aprendizado', tags: ['typescript', 'certificacao'], color: '#8B5CF6'
  },
  {
    id: 5, year: 2025, date: '2025-12-31', title: 'Ano de 2025 — Reflexão',
    description: 'Ano de grandes mudanças. Carreira acelerou, saúde melhorou, relacionamentos aprofundados.',
    category: 'pessoal', tags: ['reflexao', 'ano'], color: '#F59E0B'
  },
  {
    id: 6, year: 2025, date: '2025-09-10', title: 'Primeiro Investimento',
    description: 'Comecei a investir regularmente. Reserva de emergência iniciada.',
    category: 'financas', tags: ['financas', 'investimento'], color: '#F59E0B'
  },
];

const COMMANDS = [
  { icon: '⚡', label: 'Dashboard',       shortcut: 'G D', action: () => showView('dashboard') },
  { icon: '🤖', label: 'Companion',       shortcut: 'G C', action: () => showView('companion') },
  { icon: '🎯', label: 'Missões',         shortcut: 'G M', action: () => showView('missions') },
  { icon: '📅', label: 'Timeline',        shortcut: 'G T', action: () => showView('timeline') },
  { icon: '🕸️', label: 'Life Graph',      shortcut: 'G L', action: () => showView('lifegraph') },
  { icon: '⚙️', label: 'Configurações',   shortcut: 'G S', action: () => showView('settings') },
  { icon: '➕', label: 'Nova Missão',     shortcut: 'N M', action: () => openNewMissionModal() },
  { icon: '🎨', label: 'Alterar Tema',    shortcut: '',    action: () => toggleThemePanel() },
  { icon: '🌙', label: 'Tema Escuro',     shortcut: '',    action: () => ThemeEngine.setTheme('dark') },
  { icon: '☀️', label: 'Tema Claro',      shortcut: '',    action: () => ThemeEngine.setTheme('light') },
  { icon: '◑',  label: 'Alto Contraste',  shortcut: '',    action: () => ThemeEngine.setTheme('high-contrast') },
];

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  ThemeEngine.init();
  setupKeyboardShortcuts();
  checkOnboardingState();
});

function checkOnboardingState() {
  const onboarded = localStorage.getItem('lifeos_onboarded');
  if (onboarded) {
    const savedState = localStorage.getItem('lifeos_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        Object.assign(AppState, parsed);
      } catch(e) {}
    }
    AppState.isOnboarded = true;
    showAppShell();
  }
  // Splash is shown by default
}

/* ============================================================
   SPLASH
   ============================================================ */
function startExperience() {
  const btn = document.getElementById('btn-start');
  if (btn) {
    btn.classList.add('btn-loading');
    btn.disabled = true;
  }

  if (window.Motion?.Haptic) window.Motion.Haptic.medium();

  setTimeout(() => {
    const splash = document.getElementById('screen-splash');
    const onboarding = document.getElementById('screen-onboarding');

    if (window.Motion?.PageTransition) {
      window.Motion.PageTransition.forward(splash, onboarding);
    } else {
      splash.style.display = 'none';
      onboarding.style.display = 'flex';
    }

    renderOnboardingStep(0);
  }, 400);
}

function enterDemo() {
  // Pre-populate with demo data
  AppState.user.name = 'Demo User';
  AppState.user.values = ['🌟 Família', '📈 Crescimento', '💚 Saúde'];
  AppState.user.lifeAreas = { saude: 7, carreira: 8, relacionamentos: 6, financas: 5, aprendizado: 9, lazer: 6 };
  AppState.user.lifeScore = 73;
  AppState.missions = [...MOCK_MISSIONS];
  AppState.timelineEvents = [...MOCK_TIMELINE];
  AppState.isOnboarded = true;

  saveState();
  localStorage.setItem('lifeos_onboarded', '1');

  const splash = document.getElementById('screen-splash');
  splash.style.display = 'none';
  showAppShell();
  showToast('success', '✨ Demo carregado!', 'Explore todas as funcionalidades do LifeOS.');
}

/* ============================================================
   ONBOARDING
   ============================================================ */
function renderOnboardingStep(stepIndex) {
  AppState.onboardingStep = stepIndex;
  const step = ONBOARDING_STEPS[stepIndex];
  const container = document.getElementById('onboarding-step-content');
  if (!container || !step) return;

  // Update progress dots
  for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    dot.className = 'step-dot';
    if (i < stepIndex) dot.classList.add('step-dot-done');
    else if (i === stepIndex) dot.classList.add('step-dot-active');
  }

  let content = '';

  switch (step.type) {
    case 'welcome':
      content = `
        <div class="onboarding-icon animate-float">${step.icon}</div>
        <h2 class="onboarding-title">${step.title}</h2>
        <p class="onboarding-subtitle">${step.subtitle}</p>
        <div class="flex-col gap-3" style="margin-top:var(--space-2);">
          <div class="flex-start gap-3" style="padding:var(--space-3);background:var(--surface-100);border-radius:var(--radius-xl);">
            <span style="font-size:18px;">🧠</span>
            <span style="font-size:var(--text-sm);color:var(--text-secondary);">IA que aprende com você</span>
          </div>
          <div class="flex-start gap-3" style="padding:var(--space-3);background:var(--surface-100);border-radius:var(--radius-xl);">
            <span style="font-size:18px;">🔒</span>
            <span style="font-size:var(--text-sm);color:var(--text-secondary);">100% privado — seus dados ficam com você</span>
          </div>
          <div class="flex-start gap-3" style="padding:var(--space-3);background:var(--surface-100);border-radius:var(--radius-xl);">
            <span style="font-size:18px;">⚡</span>
            <span style="font-size:var(--text-sm);color:var(--text-secondary);">Configuração em menos de 2 minutos</span>
          </div>
        </div>
      `;
      break;

    case 'values':
      content = `
        <div class="onboarding-icon">${step.icon}</div>
        <h2 class="onboarding-title">${step.title}</h2>
        <p class="onboarding-subtitle">${step.subtitle}</p>
        <div class="value-grid" id="values-grid">
          ${VALUES.map(v => `
            <button class="value-chip" onclick="toggleValue('${v}', this)" data-value="${v}">
              <div class="value-chip-check"></div>
              <span>${v}</span>
            </button>
          `).join('')}
        </div>
        <p style="font-size:var(--text-xs);color:var(--text-tertiary);text-align:center;">
          Selecione 3 a 5 valores
        </p>
      `;
      break;

    case 'areas':
      content = `
        <div class="onboarding-icon">${step.icon}</div>
        <h2 class="onboarding-title">${step.title}</h2>
        <p class="onboarding-subtitle">${step.subtitle}</p>
        <div class="flex-col gap-3" id="areas-grid">
          ${LIFE_AREAS.map(area => `
            <div class="life-area-item">
              <div class="life-area-header">
                <div class="life-area-name">
                  <span>${area.icon}</span>
                  <span>${area.name}</span>
                </div>
                <span class="life-area-score" id="score-${area.id}">5</span>
              </div>
              <input type="range" class="range" min="1" max="10" value="5"
                oninput="updateAreaScore('${area.id}', this.value)"
                aria-label="${area.name} — nota de 1 a 10"
                style="accent-color:${area.color};"
              />
              <div class="flex-between" style="font-size:var(--text-2xs);color:var(--text-tertiary);">
                <span>Precisa de atenção</span>
                <span>Excelente</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      break;

    case 'goal':
      content = `
        <div class="onboarding-icon">${step.icon}</div>
        <h2 class="onboarding-title">${step.title}</h2>
        <p class="onboarding-subtitle">${step.subtitle}</p>
        <div class="flex-col gap-4">
          <div class="input-group">
            <label class="input-label input-label-required" for="first-goal-title">Título do objetivo</label>
            <input type="text" id="first-goal-title" class="input input-lg"
              placeholder="Ex: Lançar meu primeiro produto digital" />
          </div>
          <div class="input-group">
            <label class="input-label" for="first-goal-why">Por que isso importa?</label>
            <textarea id="first-goal-why" class="textarea"
              placeholder="Descreva o impacto que isso terá na sua vida..."></textarea>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label" for="first-goal-area">Área</label>
              <select id="first-goal-area" class="input select">
                ${LIFE_AREAS.map(a => `<option value="${a.id}">${a.icon} ${a.name}</option>`).join('')}
              </select>
            </div>
            <div class="input-group">
              <label class="input-label" for="first-goal-deadline">Prazo</label>
              <input type="date" id="first-goal-deadline" class="input"
                value="${new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0]}" />
            </div>
          </div>
        </div>
      `;
      break;

    case 'complete':
      const score = calculateLifeScore();
      content = `
        <div class="onboarding-icon animate-heartbeat">${step.icon}</div>
        <h2 class="onboarding-title">${step.title}</h2>
        <p class="onboarding-subtitle">${step.subtitle}</p>
        <div class="card" style="text-align:center;background:var(--gradient-primary-soft);border-color:rgba(99,102,241,0.2);">
          <div style="font-size:var(--text-5xl);font-weight:900;letter-spacing:-0.05em;background:var(--gradient-primary);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
            ${score}
          </div>
          <div style="font-size:var(--text-sm);color:var(--text-secondary);margin-top:var(--space-1);">
            Seu Life Score inicial
          </div>
        </div>
        <div class="flex-col gap-2" style="margin-top:var(--space-2);">
          ${AppState.user.values.slice(0,3).map(v => `
            <div class="flex-start gap-2">
              <span style="color:var(--color-success-400);">✓</span>
              <span style="font-size:var(--text-sm);color:var(--text-secondary);">${v}</span>
            </div>
          `).join('')}
        </div>
      `;
      break;
  }

  container.innerHTML = `
    <div class="animate-fade-in">
      ${content}
      <div class="flex-between" style="margin-top:var(--space-6);gap:var(--space-3);">
        ${stepIndex > 0
          ? `<button class="btn btn-ghost" onclick="renderOnboardingStep(${stepIndex - 1})">← Voltar</button>`
          : `<div></div>`
        }
        <button class="btn btn-primary ${step.type === 'complete' ? 'btn-lg' : ''}"
          onclick="${step.type === 'complete' ? 'completeOnboarding()' : `nextOnboardingStep(${stepIndex})`}"
          style="${step.type !== 'complete' ? '' : 'flex:1;'}">
          ${step.type === 'complete' ? '🚀 Entrar no LifeOS' : 'Continuar →'}
        </button>
      </div>
    </div>
  `;

  if (window.Motion?.Haptic) window.Motion.Haptic.light();
}

function toggleValue(value, el) {
  const idx = AppState.user.values.indexOf(value);
  if (idx > -1) {
    AppState.user.values.splice(idx, 1);
    el.classList.remove('value-chip-selected');
  } else {
    if (AppState.user.values.length >= 5) {
      showToast('warning', 'Limite atingido', 'Selecione no máximo 5 valores.');
      if (window.Motion?.Micro) window.Motion.Micro.shake(el);
      return;
    }
    AppState.user.values.push(value);
    el.classList.add('value-chip-selected');
    if (window.Motion?.Micro) window.Motion.Micro.pulse(el);
  }
  if (window.Motion?.Haptic) window.Motion.Haptic.light();
}

function updateAreaScore(areaId, value) {
  AppState.user.lifeAreas[areaId] = parseInt(value);
  const scoreEl = document.getElementById(`score-${areaId}`);
  if (scoreEl) scoreEl.textContent = value;
}

function nextOnboardingStep(currentStep) {
  // Validation
  if (currentStep === 1 && AppState.user.values.length < 1) {
    showToast('warning', 'Selecione pelo menos 1 valor', 'Seus valores guiarão o LifeOS.');
    return;
  }
  if (currentStep === 3) {
    const title = document.getElementById('first-goal-title')?.value?.trim();
    if (title) {
      const area = document.getElementById('first-goal-area')?.value || 'pessoal';
      const deadline = document.getElementById('first-goal-deadline')?.value;
      const why = document.getElementById('first-goal-why')?.value || '';
      AppState.missions.push({
        id: Date.now(), title, category: area, priority: 'high',
        objective: why, progress: 0, deadline, status: 'active', subtasks: []
      });
    }
  }
  renderOnboardingStep(currentStep + 1);
}

function calculateLifeScore() {
  const areas = Object.values(AppState.user.lifeAreas);
  if (!areas.length) return 72;
  const avg = areas.reduce((a, b) => a + b, 0) / areas.length;
  return Math.round(avg * 10);
}

function completeOnboarding() {
  AppState.user.lifeScore = calculateLifeScore();
  AppState.isOnboarded = true;

  // Add mock data if no missions
  if (AppState.missions.length === 0) {
    AppState.missions = [...MOCK_MISSIONS];
  }
  AppState.timelineEvents = [...MOCK_TIMELINE];

  saveState();
  localStorage.setItem('lifeos_onboarded', '1');

  const onboarding = document.getElementById('screen-onboarding');
  onboarding.style.display = 'none';

  showAppShell();
  showToast('success', '🎉 Bem-vindo ao LifeOS!', 'Sua experiência premium está pronta.');
  if (window.Motion?.Haptic) window.Motion.Haptic.success();
  if (window.Motion?.Sound) window.Motion.Sound.success();
}

/* ============================================================
   APP SHELL
   ============================================================ */
function showAppShell() {
  const shell = document.getElementById('app-shell');
  shell.style.display = 'flex';

  // Update user name
  const nameEl = document.getElementById('sidebar-user-name');
  if (nameEl) nameEl.textContent = AppState.user.name;

  // Update score
  const scoreEl = document.getElementById('sidebar-score');
  if (scoreEl) scoreEl.textContent = AppState.user.lifeScore || calculateLifeScore();

  // Init dashboard
  showView('dashboard');

  // Init theme switcher
  const container = document.getElementById('theme-switcher-container');
  if (container) ThemeEngine.buildThemeSwitcher(container);

  const panelContainer = document.getElementById('theme-panel-content');
  if (panelContainer) ThemeEngine.buildThemeSwitcher(panelContainer);

  if (window.Motion?.Entrance) {
    window.Motion.Entrance.fadeIn(shell);
  }
}

/* ============================================================
   VIEW NAVIGATION
   ============================================================ */
function showView(viewId) {
  // Hide all views
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });

  // Show target
  const target = document.getElementById(`view-${viewId}`);
  if (!target) return;

  target.style.display = 'block';
  target.classList.add('active');

  // Update sidebar
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('sidebar-item-active');
    item.removeAttribute('aria-current');
  });
  const activeItem = document.querySelector(`[data-view="${viewId}"]`);
  if (activeItem) {
    activeItem.classList.add('sidebar-item-active');
    activeItem.setAttribute('aria-current', 'page');
  }

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard', companion: 'Companion IA', missions: 'Missões',
    timeline: 'Timeline', lifegraph: 'Life Graph', briefing: 'Morning Briefing',
    metrics: 'Métricas', settings: 'Configurações',
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[viewId] || viewId;

  AppState.currentView = viewId;

  // Animate entrance
  if (window.Motion?.Entrance) {
    window.Motion.Entrance.fadeIn(target, { duration: 250 });
  }

  // Render view-specific content
  const renderers = {
    dashboard: renderDashboard,
    missions:  renderMissions,
    timeline:  renderTimeline,
    companion: initCompanion,
    briefing:  renderBriefing,
    metrics:   renderMetrics,
  };

  if (renderers[viewId]) renderers[viewId]();

  if (window.Motion?.Haptic) window.Motion.Haptic.light();
}

/* ============================================================
   DASHBOARD V2
   ============================================================ */
function renderDashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const name = AppState.user.name !== 'Usuário' ? `, ${AppState.user.name.split(' ')[0]}` : '';

  const greetingEl = document.getElementById('dashboard-greeting');
  if (greetingEl) greetingEl.textContent = `${greeting}${name} 👋`;

  const dateEl = document.getElementById('dashboard-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Stats
  const score = AppState.user.lifeScore || calculateLifeScore();
  const scoreEl = document.getElementById('stat-life-score');
  if (scoreEl) {
    window.Motion?.Micro?.countUp(scoreEl, 0, score, 1000);
  }

  const missionsEl = document.getElementById('stat-missions');
  if (missionsEl) {
    const active = AppState.missions.filter(m => m.status === 'active').length;
    window.Motion?.Micro?.countUp(missionsEl, 0, active, 800);
  }

  // Life Score Chart
  renderLifeScoreChart(score);

  // Life Score Areas
  renderLifeScoreAreas();

  // Missions list
  renderDashboardMissions();

  // Briefing
  renderDashboardBriefing();
}

function renderLifeScoreChart(score) {
  const canvas = document.getElementById('life-score-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const areas = LIFE_AREAS.map(a => ({
    name: a.name,
    value: AppState.user.lifeAreas[a.id] || 5,
    color: a.color,
  }));

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: areas.map(a => a.name),
      datasets: [{
        data: areas.map(a => a.value),
        backgroundColor: areas.map(a => a.color + 'CC'),
        borderColor: areas.map(a => a.color),
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw}/10`
          }
        }
      },
      animation: { duration: 1000, easing: 'easeOutQuart' },
    }
  });

  const displayEl = document.getElementById('life-score-display');
  if (displayEl) {
    window.Motion?.Micro?.countUp(displayEl, 0, score, 1200);
  }

  const sidebarScore = document.getElementById('sidebar-score');
  if (sidebarScore) sidebarScore.textContent = score;
}

function renderLifeScoreAreas() {
  const container = document.getElementById('life-score-areas');
  if (!container) return;

  container.innerHTML = LIFE_AREAS.map(area => {
    const score = AppState.user.lifeAreas[area.id] || 5;
    const pct = score * 10;
    return `
      <div class="life-score-area-row">
        <div class="life-score-area-name">${area.icon} ${area.name}</div>
        <div class="life-score-area-bar">
          <div class="life-score-area-fill" style="width:${pct}%;background:${area.color};"></div>
        </div>
        <div class="life-score-area-value">${score}</div>
      </div>
    `;
  }).join('');
}

function renderDashboardMissions() {
  const container = document.getElementById('missions-list');
  if (!container) return;

  const active = AppState.missions.filter(m => m.status === 'active').slice(0, 4);
  const countText = document.getElementById('missions-count-text');
  if (countText) countText.textContent = `${active.length} missão${active.length !== 1 ? 'ões' : ''} ativa${active.length !== 1 ? 's' : ''}`;

  if (!active.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8);">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">Nenhuma missão ainda</div>
        <div class="empty-state-description">Crie sua primeira missão para começar.</div>
      </div>
    `;
    return;
  }

  const categoryColors = {
    carreira: '#3B82F6', saude: '#10B981', financas: '#F59E0B',
    relacionamentos: '#EF4444', aprendizado: '#8B5CF6', pessoal: '#EC4899'
  };
  const categoryIcons = {
    carreira: '🚀', saude: '💪', financas: '💰',
    relacionamentos: '❤️', aprendizado: '📚', pessoal: '✨'
  };

  container.innerHTML = active.map(m => `
    <div class="mission-item animate-fade-in" onclick="showView('missions')">
      <div class="mission-item-icon" style="background:${categoryColors[m.category] || '#6366F1'}22;">
        ${categoryIcons[m.category] || '🎯'}
      </div>
      <div class="mission-item-content">
        <div class="mission-item-title">${m.title}</div>
        <div class="mission-item-meta">${m.progress}% concluído</div>
      </div>
      <div class="mission-item-progress">
        <div class="progress-track progress-track-sm">
          <div class="progress-fill" style="width:${m.progress}%;background:${categoryColors[m.category] || '#6366F1'};"></div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderDashboardBriefing() {
  const timeEl = document.getElementById('briefing-time');
  if (timeEl) {
    timeEl.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const items = [
    'Você tem 2 missões com prazo esta semana.',
    `Life Score atual: ${AppState.user.lifeScore || calculateLifeScore()} — acima da média.`,
    'Área de Saúde precisa de atenção — registre uma atividade hoje.',
    'Sequência de 7 dias! Continue assim para manter o momentum.',
  ];

  const container = document.getElementById('briefing-items');
  if (container) {
    container.innerHTML = items.map(item => `
      <div class="briefing-item">
        <div class="briefing-item-dot"></div>
        <span>${item}</span>
      </div>
    `).join('');
  }
}

/* ============================================================
   MISSIONS V2
   ============================================================ */
function renderMissions(filter = 'all') {
  const container = document.getElementById('missions-grid');
  if (!container) return;

  const categoryColors = {
    carreira: '#3B82F6', saude: '#10B981', financas: '#F59E0B',
    relacionamentos: '#EF4444', aprendizado: '#8B5CF6', pessoal: '#EC4899'
  };
  const categoryIcons = {
    carreira: '🚀', saude: '💪', financas: '💰',
    relacionamentos: '❤️', aprendizado: '📚', pessoal: '✨'
  };
  const priorityBadge = {
    high: '<span class="badge badge-danger badge-sm">Alta</span>',
    medium: '<span class="badge badge-warning badge-sm">Média</span>',
    low: '<span class="badge badge-success badge-sm">Baixa</span>',
  };

  let missions = AppState.missions;
  if (filter !== 'all') missions = missions.filter(m => m.status === filter);

  if (!missions.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">Nenhuma missão encontrada</div>
        <div class="empty-state-description">Crie uma nova missão para começar.</div>
        <button class="btn btn-primary" onclick="openNewMissionModal()">+ Nova Missão</button>
      </div>
    `;
    return;
  }

  container.innerHTML = missions.map((m, i) => `
    <div class="mission-card-v2 animate-fade-in delay-${i * 50}"
         onclick="showMissionDetail(${m.id})"
         style="--delay:${i * 50}ms;"
         role="button" tabindex="0"
         aria-label="Missão: ${m.title}">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${categoryColors[m.category] || '#6366F1'};border-radius:var(--radius-full) var(--radius-full) 0 0;"></div>
      <div class="mission-card-header">
        <div class="mission-card-icon" style="background:${categoryColors[m.category] || '#6366F1'}22;">
          ${categoryIcons[m.category] || '🎯'}
        </div>
        <div class="mission-card-meta">
          <div class="mission-card-title">${m.title}</div>
          <div class="mission-card-objective">${m.objective || ''}</div>
        </div>
        ${priorityBadge[m.priority] || ''}
      </div>
      <div class="mission-card-progress-section">
        <div class="mission-card-progress-header">
          <span class="mission-card-progress-label">Progresso</span>
          <span class="mission-card-progress-value">${m.progress}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${m.progress}%;background:${categoryColors[m.category] || '#6366F1'};"></div>
        </div>
      </div>
      <div class="mission-card-footer">
        <div class="mission-card-deadline">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${m.deadline ? new Date(m.deadline).toLocaleDateString('pt-BR') : 'Sem prazo'}
        </div>
        <span class="badge badge-neutral badge-sm">${m.subtasks?.filter(s => s.done).length || 0}/${m.subtasks?.length || 0} tarefas</span>
      </div>
    </div>
  `).join('');
}

function filterMissions(filter, btn) {
  document.querySelectorAll('.timeline-filters .chip').forEach(c => c.classList.remove('chip-active'));
  if (btn) btn.classList.add('chip-active');
  renderMissions(filter);
}

function showMissionDetail(missionId) {
  const mission = AppState.missions.find(m => m.id === missionId);
  if (!mission) return;

  const panel = document.getElementById('mission-detail-panel');
  if (!panel) return;

  const categoryColors = {
    carreira: '#3B82F6', saude: '#10B981', financas: '#F59E0B',
    relacionamentos: '#EF4444', aprendizado: '#8B5CF6', pessoal: '#EC4899'
  };
  const categoryIcons = {
    carreira: '🚀', saude: '💪', financas: '💰',
    relacionamentos: '❤️', aprendizado: '📚', pessoal: '✨'
  };

  const color = categoryColors[mission.category] || '#6366F1';
  const icon = categoryIcons[mission.category] || '🎯';
  const subtasks = mission.subtasks || [];
  const done = subtasks.filter(s => s.done).length;

  panel.innerHTML = `
    <div class="mission-detail-header">
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4);">
        <div style="width:48px;height:48px;border-radius:var(--radius-xl);background:${color}22;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
          ${icon}
        </div>
        <div>
          <div style="font-size:var(--text-lg);font-weight:700;color:var(--text-primary);letter-spacing:-0.02em;">${mission.title}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary);">${mission.deadline ? new Date(mission.deadline).toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'}) : 'Sem prazo'}</div>
        </div>
      </div>
      ${mission.objective ? `<p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;margin-bottom:var(--space-4);">${mission.objective}</p>` : ''}
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
          <span style="font-size:var(--text-xs);color:var(--text-tertiary);">Progresso geral</span>
          <span style="font-size:var(--text-xs);font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">${mission.progress}%</span>
        </div>
        <div class="progress-track progress-track-lg">
          <div class="progress-fill" style="width:${mission.progress}%;background:${color};"></div>
        </div>
      </div>
    </div>
    <div class="mission-detail-body">
      <div style="font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3);">
        Subtarefas (${done}/${subtasks.length})
      </div>
      ${subtasks.length ? subtasks.map(st => `
        <div class="mission-subtask ${st.done ? 'mission-subtask-done' : ''}"
             onclick="toggleSubtask(${mission.id}, ${st.id})"
             role="checkbox" aria-checked="${st.done}" tabindex="0">
          <div class="mission-subtask-check">${st.done ? '✓' : ''}</div>
          <div class="mission-subtask-text">${st.text}</div>
        </div>
      `).join('') : `
        <div class="empty-state" style="padding:var(--space-6);">
          <div class="empty-state-description">Nenhuma subtarefa ainda.</div>
        </div>
      `}
      <div style="margin-top:var(--space-6);display:flex;gap:var(--space-2);">
        <button class="btn btn-primary btn-sm btn-full" onclick="showView('companion')">
          🤖 Pedir ajuda ao Companion
        </button>
      </div>
    </div>
  `;

  if (window.Motion?.Entrance) {
    window.Motion.Entrance.fadeIn(panel, { duration: 300 });
  }
}

function toggleSubtask(missionId, subtaskId) {
  const mission = AppState.missions.find(m => m.id === missionId);
  if (!mission) return;
  const subtask = mission.subtasks?.find(s => s.id === subtaskId);
  if (!subtask) return;

  subtask.done = !subtask.done;

  // Recalculate progress
  const total = mission.subtasks.length;
  const done = mission.subtasks.filter(s => s.done).length;
  mission.progress = total > 0 ? Math.round((done / total) * 100) : 0;

  saveState();
  showMissionDetail(missionId);
  renderMissions();

  if (subtask.done) {
    showToast('success', '✓ Subtarefa concluída!', subtask.text);
    if (window.Motion?.Haptic) window.Motion.Haptic.success();
    if (window.Motion?.Sound) window.Motion.Sound.success();
  } else {
    if (window.Motion?.Haptic) window.Motion.Haptic.light();
  }
}

/* ============================================================
   TIMELINE V2
   ============================================================ */
function renderTimeline(filter = 'all') {
  const container = document.getElementById('timeline-track');
  if (!container) return;

  let events = [...AppState.timelineEvents].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filter !== 'all') events = events.filter(e => e.category === filter);

  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <div class="empty-state-title">Nenhum evento encontrado</div>
        <div class="empty-state-description">Adicione eventos à sua timeline de vida.</div>
      </div>
    `;
    return;
  }

  // Group by year
  const byYear = {};
  events.forEach(e => {
    if (!byYear[e.year]) byYear[e.year] = [];
    byYear[e.year].push(e);
  });

  const categoryColors = {
    carreira: '#3B82F6', saude: '#10B981', financas: '#F59E0B',
    relacionamentos: '#EF4444', aprendizado: '#8B5CF6', pessoal: '#EC4899'
  };

  let html = '';
  Object.keys(byYear).sort((a, b) => b - a).forEach(year => {
    html += `
      <div class="timeline-year-marker">
        <div class="timeline-year-dot"></div>
        <span class="timeline-year-label">${year}</span>
        <div style="flex:1;height:1px;background:var(--border-subtle);"></div>
      </div>
    `;
    byYear[year].forEach((event, i) => {
      const color = event.color || categoryColors[event.category] || '#6366F1';
      html += `
        <div class="timeline-event animate-fade-in delay-${i * 50}">
          <div class="timeline-event-dot" style="background:${color};"></div>
          <div class="timeline-event-card">
            <div class="timeline-event-header">
              <div class="timeline-event-title">${event.title}</div>
              <div class="timeline-event-date">${new Date(event.date).toLocaleDateString('pt-BR', {day:'2-digit',month:'short'})}</div>
            </div>
            ${event.description ? `<div class="timeline-event-description">${event.description}</div>` : ''}
            ${event.tags?.length ? `
              <div class="timeline-event-tags">
                ${event.tags.map(t => `<span class="chip" style="font-size:10px;padding:1px 8px;">#${t}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}

function filterTimeline(filter, btn) {
  document.querySelectorAll('.timeline-filters .chip').forEach(c => c.classList.remove('chip-active'));
  if (btn) btn.classList.add('chip-active');
  renderTimeline(filter);
}

/* ============================================================
   COMPANION V2
   ============================================================ */
function initCompanion() {
  if (AppState.companionMessages.length === 0) {
    const name = AppState.user.name !== 'Usuário' ? AppState.user.name.split(' ')[0] : 'você';
    AppState.companionMessages.push({
      role: 'ai',
      text: `Olá! Sou seu Companion IA. Estou aqui para ajudar ${name} a alcançar seus objetivos e navegar pela vida com mais clareza. Como posso ajudar hoje?`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  }
  renderCompanionMessages();
}

function renderCompanionMessages() {
  const container = document.getElementById('companion-messages');
  if (!container) return;

  container.innerHTML = AppState.companionMessages.map(msg => `
    <div class="message-bubble message-bubble-${msg.role === 'ai' ? 'ai' : 'user'} animate-fade-in">
      <div class="message-bubble-avatar">
        ${msg.role === 'ai' ? '🤖' : '👤'}
      </div>
      <div class="message-content">
        <div class="message-text">${msg.text}</div>
        <div class="message-time">${msg.time}</div>
      </div>
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

function sendCompanionMessage() {
  const input = document.getElementById('companion-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  // Add user message
  AppState.companionMessages.push({
    role: 'user',
    text,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  input.value = '';
  input.style.height = 'auto';
  renderCompanionMessages();

  if (window.Motion?.Haptic) window.Motion.Haptic.light();
  if (window.Motion?.Sound) window.Motion.Sound.click();

  // Show typing indicator
  const container = document.getElementById('companion-messages');
  if (container) {
    const typing = document.createElement('div');
    typing.id = 'typing-indicator';
    typing.className = 'message-bubble message-bubble-ai animate-fade-in';
    typing.innerHTML = `
      <div class="message-bubble-avatar">🤖</div>
      <div class="message-content">
        <div class="message-text" style="padding:var(--space-3) var(--space-4);">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  }

  // Simulate AI response
  setTimeout(() => {
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl) typingEl.remove();

    const responses = generateAIResponse(text);
    AppState.companionMessages.push({
      role: 'ai',
      text: responses,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    renderCompanionMessages();
    if (window.Motion?.Sound) window.Motion.Sound.notification();
  }, 1200 + Math.random() * 800);
}

function generateAIResponse(userText) {
  const lower = userText.toLowerCase();
  const score = AppState.user.lifeScore || calculateLifeScore();
  const activeMissions = AppState.missions.filter(m => m.status === 'active');

  if (lower.includes('foco') || lower.includes('hoje')) {
    return `Com base no seu Life Score de ${score} e suas ${activeMissions.length} missões ativas, recomendo focar hoje em: <strong>${activeMissions[0]?.title || 'sua missão principal'}</strong>. Ela está com ${activeMissions[0]?.progress || 0}% de progresso — um bom momento para avançar.`;
  }
  if (lower.includes('progresso') || lower.includes('saindo')) {
    return `Você está indo muito bem! Life Score: <strong>${score}/100</strong>. Você tem ${activeMissions.length} missões ativas. A mais avançada é "${activeMissions.sort((a,b) => b.progress - a.progress)[0]?.title}" com ${activeMissions.sort((a,b) => b.progress - a.progress)[0]?.progress || 0}% concluído.`;
  }
  if (lower.includes('missão') || lower.includes('criar')) {
    return `Ótima ideia! Para criar uma missão eficaz, pense em: 1) O que você quer alcançar? 2) Por que isso importa? 3) Qual é o prazo realista? Clique em <strong>"+ Nova Missão"</strong> no topo da tela de Missões ou use o botão abaixo.`;
  }
  if (lower.includes('graph') || lower.includes('grafo')) {
    return `Seu Life Graph conecta todos os seus eventos, decisões e áreas da vida. Com ${AppState.timelineEvents.length} eventos na sua timeline, posso identificar padrões interessantes. Sua área mais forte é <strong>${LIFE_AREAS.find(a => AppState.user.lifeAreas[a.id] === Math.max(...Object.values(AppState.user.lifeAreas || {5:5})))?.name || 'Aprendizado'}</strong>.`;
  }
  if (lower.includes('obrigado') || lower.includes('valeu')) {
    return `Fico feliz em ajudar! Estou sempre aqui quando precisar. Lembre-se: pequenas ações consistentes constroem grandes resultados. 🚀`;
  }

  const defaults = [
    `Entendi sua pergunta sobre "${userText.slice(0, 30)}...". Com base no seu perfil e Life Score de ${score}, posso ajudar a criar um plano de ação específico. O que você gostaria de priorizar primeiro?`,
    `Boa pergunta! Analisando seus dados, vejo que você tem potencial para crescer especialmente nas áreas de ${LIFE_AREAS.slice(0,2).map(a => a.name).join(' e ')}. Quer que eu elabore um plano detalhado?`,
    `Baseado no seu histórico e objetivos atuais, recomendo focar em consistência. Você já tem ${activeMissions.length} missões ativas — isso é ótimo! Qual delas você quer acelerar?`,
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

function quickMessage(text) {
  const input = document.getElementById('companion-input');
  if (input) {
    input.value = text;
    sendCompanionMessage();
  }
}

function handleCompanionKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendCompanionMessage();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function clearChat() {
  AppState.companionMessages = [];
  initCompanion();
  showToast('info', 'Conversa limpa', 'Iniciando nova conversa.');
}

/* ============================================================
   BRIEFING
   ============================================================ */
function renderBriefing() {
  const dateEl = document.getElementById('briefing-full-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  const container = document.getElementById('briefing-full-content');
  if (!container) return;

  const score = AppState.user.lifeScore || calculateLifeScore();
  const active = AppState.missions.filter(m => m.status === 'active');

  container.innerHTML = `
    <div class="briefing-card animate-fade-in">
      <div class="briefing-header">
        <div class="briefing-icon">⚡</div>
        <div>
          <div class="briefing-title">Life Score</div>
          <div class="briefing-time">Atualizado agora</div>
        </div>
      </div>
      <div style="font-size:var(--text-4xl);font-weight:900;letter-spacing:-0.05em;background:var(--gradient-primary);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:var(--space-4);">
        ${score}
      </div>
      <div class="flex-col gap-2">
        ${LIFE_AREAS.map(a => {
          const s = AppState.user.lifeAreas[a.id] || 5;
          return `
            <div class="life-score-area-row">
              <div class="life-score-area-name">${a.icon} ${a.name}</div>
              <div class="life-score-area-bar">
                <div class="life-score-area-fill" style="width:${s*10}%;background:${a.color};"></div>
              </div>
              <div class="life-score-area-value">${s}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card animate-fade-in delay-100">
      <div class="section-title" style="margin-bottom:var(--space-4);">🎯 Missões em Destaque</div>
      <div class="flex-col gap-3">
        ${active.slice(0,3).map(m => `
          <div class="mission-item">
            <div class="mission-item-content">
              <div class="mission-item-title">${m.title}</div>
              <div class="mission-item-meta">${m.progress}% · Prazo: ${m.deadline ? new Date(m.deadline).toLocaleDateString('pt-BR') : 'Sem prazo'}</div>
            </div>
            <div style="width:80px;">
              <div class="progress-track progress-track-sm">
                <div class="progress-fill" style="width:${m.progress}%;"></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card animate-fade-in delay-200">
      <div class="section-title" style="margin-bottom:var(--space-4);">💡 Insights do Companion</div>
      <div class="flex-col gap-3">
        <div class="insight-item">
          <div class="insight-icon" style="background:rgba(99,102,241,0.12);">📈</div>
          <div class="insight-text">Você está consistente há 7 dias. Mantenha o ritmo para criar um hábito sólido.</div>
        </div>
        <div class="insight-item">
          <div class="insight-icon" style="background:rgba(245,158,11,0.12);">⚠️</div>
          <div class="insight-text">Área de Finanças com score baixo. Considere revisar seu orçamento esta semana.</div>
        </div>
        <div class="insight-item">
          <div class="insight-icon" style="background:rgba(16,185,129,0.12);">🎯</div>
          <div class="insight-text">Missão "Aprender TypeScript" está a 65% — você pode concluir em 2 semanas com foco.</div>
        </div>
      </div>
    </div>
  `;
}

function refreshBriefing() {
  showToast('info', '🔄 Atualizando briefing...', 'Analisando seus dados.');
  setTimeout(() => {
    renderBriefing();
    showToast('success', '✅ Briefing atualizado!', 'Dados mais recentes carregados.');
  }, 1500);
}

/* ============================================================
   METRICS
   ============================================================ */
function renderMetrics() {
  setTimeout(() => {
    const scoreCanvas = document.getElementById('metrics-chart-score');
    if (scoreCanvas) {
      const existing = Chart.getChart(scoreCanvas);
      if (existing) existing.destroy();

      new Chart(scoreCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'],
          datasets: [{
            label: 'Life Score',
            data: [58, 62, 65, 68, 70, 71, AppState.user.lifeScore || 73],
            borderColor: '#6366F1',
            backgroundColor: 'rgba(99,102,241,0.08)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#6366F1',
            pointRadius: 4,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              min: 0, max: 100,
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#64748B' }
            },
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#64748B' }
            }
          },
          animation: { duration: 1000, easing: 'easeOutQuart' }
        }
      });
    }

    const areasCanvas = document.getElementById('metrics-chart-areas');
    if (areasCanvas) {
      const existing = Chart.getChart(areasCanvas);
      if (existing) existing.destroy();

      new Chart(areasCanvas.getContext('2d'), {
        type: 'radar',
        data: {
          labels: LIFE_AREAS.map(a => a.name),
          datasets: [{
            label: 'Seu Score',
            data: LIFE_AREAS.map(a => AppState.user.lifeAreas[a.id] || 5),
            borderColor: '#6366F1',
            backgroundColor: 'rgba(99,102,241,0.15)',
            borderWidth: 2,
            pointBackgroundColor: '#6366F1',
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0, max: 10,
              grid: { color: 'rgba(255,255,255,0.08)' },
              ticks: { display: false },
              pointLabels: { color: '#94A3B8', font: { size: 11 } }
            }
          },
          animation: { duration: 1000 }
        }
      });
    }
  }, 100);
}

/* ============================================================
   MODALS
   ============================================================ */
function openNewMissionModal() {
  const modal = document.getElementById('modal-new-mission');
  if (!modal) return;
  modal.style.display = 'flex';

  // Set default deadline to 90 days
  const deadline = document.getElementById('mission-deadline');
  if (deadline) {
    deadline.value = new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0];
  }

  if (window.Motion?.ModalMotion) {
    const backdrop = modal;
    const content = modal.querySelector('.modal');
    window.Motion.ModalMotion.open(backdrop, content);
  }

  if (window.Motion?.Haptic) window.Motion.Haptic.medium();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  if (window.Motion?.ModalMotion) {
    const content = modal.querySelector('.modal');
    window.Motion.ModalMotion.close(modal, content, () => {
      modal.style.display = 'none';
    });
  } else {
    modal.style.display = 'none';
  }
}

function createMission() {
  const title = document.getElementById('mission-title')?.value?.trim();
  if (!title) {
    showToast('warning', 'Título obrigatório', 'Digite um título para a missão.');
    if (window.Motion?.Micro) window.Motion.Micro.shake(document.getElementById('mission-title'));
    return;
  }

  const mission = {
    id: Date.now(),
    title,
    category: document.getElementById('mission-category')?.value || 'pessoal',
    priority: document.getElementById('mission-priority')?.value || 'medium',
    objective: document.getElementById('mission-objective')?.value || '',
    deadline: document.getElementById('mission-deadline')?.value || '',
    progress: 0,
    status: 'active',
    subtasks: [],
  };

  AppState.missions.unshift(mission);
  saveState();
  closeModal('modal-new-mission');

  // Clear form
  ['mission-title', 'mission-objective'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  showToast('success', '🎯 Missão criada!', `"${title}" foi adicionada às suas missões.`);
  if (window.Motion?.Haptic) window.Motion.Haptic.success();
  if (window.Motion?.Sound) window.Motion.Sound.success();

  if (AppState.currentView === 'missions') renderMissions();
  if (AppState.currentView === 'dashboard') renderDashboard();
}

function openNewEventModal() {
  showToast('info', 'Em breve', 'Adicionar eventos à timeline estará disponível em breve.');
}

/* ============================================================
   THEME PANEL
   ============================================================ */
function toggleThemePanel() {
  const panel = document.getElementById('theme-panel');
  if (!panel) return;

  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'flex';
    const content = panel.querySelector('.modal');
    if (window.Motion?.ModalMotion) {
      window.Motion.ModalMotion.open(panel, content);
    }
    // Rebuild theme switcher
    const container = document.getElementById('theme-panel-content');
    if (container) ThemeEngine.buildThemeSwitcher(container);
  } else {
    closeModal('theme-panel');
  }
}

/* ============================================================
   COMMAND PALETTE
   ============================================================ */
function openCommandPalette() {
  const backdrop = document.getElementById('command-palette-backdrop');
  if (!backdrop) return;
  backdrop.style.display = 'flex';
  renderCommandResults('');
  setTimeout(() => document.getElementById('command-input')?.focus(), 50);
  if (window.Motion?.ModalMotion) {
    window.Motion.ModalMotion.open(backdrop, backdrop.querySelector('.command-palette'));
  }
}

function closeCommandPalette() {
  const backdrop = document.getElementById('command-palette-backdrop');
  if (!backdrop) return;
  backdrop.style.display = 'none';
  const input = document.getElementById('command-input');
  if (input) input.value = '';
}

function filterCommands(query) {
  renderCommandResults(query);
}

function renderCommandResults(query) {
  const container = document.getElementById('command-results');
  if (!container) return;

  const filtered = query
    ? COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS;

  container.innerHTML = filtered.map((cmd, i) => `
    <div class="command-item ${i === 0 ? 'command-item-focused' : ''}"
         onclick="executeCommand(${COMMANDS.indexOf(cmd)})"
         role="option" tabindex="0">
      <div class="command-item-icon">${cmd.icon}</div>
      <div class="command-item-label">${cmd.label}</div>
      ${cmd.shortcut ? `<span class="command-item-shortcut">${cmd.shortcut}</span>` : ''}
    </div>
  `).join('');

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8);">
        <div class="empty-state-description">Nenhum comando encontrado para "${query}"</div>
      </div>
    `;
  }
}

function executeCommand(index) {
  const cmd = COMMANDS[index];
  if (!cmd) return;
  closeCommandPalette();
  cmd.action();
  if (window.Motion?.Haptic) window.Motion.Haptic.light();
}

function handleCommandKey(e) {
  if (e.key === 'Escape') closeCommandPalette();
  if (e.key === 'Enter') {
    const focused = document.querySelector('.command-item-focused');
    if (focused) focused.click();
  }
}

/* ============================================================
   SETTINGS
   ============================================================ */
function showSettingsSection(section, btn) {
  document.querySelectorAll('.settings-section').forEach(s => s.style.display = 'none');
  const target = document.getElementById(`settings-${section}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.settings-nav .list-item').forEach(b => b.classList.remove('list-item-active'));
  if (btn) btn.classList.add('list-item-active');
}

function confirmClearData() {
  if (confirm('Tem certeza? Todos os dados serão apagados permanentemente.')) {
    localStorage.clear();
    location.reload();
  }
}

function generateLifeGraph() {
  showToast('info', '🕸️ Gerando Life Graph...', 'Analisando suas conexões.');
  setTimeout(() => {
    showToast('success', '✅ Life Graph gerado!', 'Sua rede neural pessoal está pronta.');
  }, 2000);
}

/* ============================================================
   TOAST SYSTEM
   ============================================================ */
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const id = `toast-${Date.now()}`;

  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="removeToast('${id}')" aria-label="Fechar notificação">×</button>
  `;

  container.appendChild(toast);

  if (window.Motion?.ToastMotion) {
    window.Motion.ToastMotion.show(toast);
  }

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
}

function removeToast(id) {
  const toast = document.getElementById(id);
  if (!toast) return;

  if (window.Motion?.ToastMotion) {
    window.Motion.ToastMotion.hide(toast, () => toast.remove());
  } else {
    toast.remove();
  }
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    // Close modals with Escape
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal-backdrop[style*="flex"]');
      openModals.forEach(m => {
        if (m.id !== 'command-palette-backdrop') closeModal(m.id);
        else closeCommandPalette();
      });
      return;
    }

    // Navigation shortcuts (g + key)
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
      // handled by next keypress
    }
  });
}

/* ============================================================
   PERSISTENCE
   ============================================================ */
function saveState() {
  try {
    localStorage.setItem('lifeos_state', JSON.stringify({
      user: AppState.user,
      missions: AppState.missions,
      timelineEvents: AppState.timelineEvents,
    }));
  } catch(e) {
    console.warn('[LifeOS] Could not save state:', e);
  }
}

/* ============================================================
   LOADING
   ============================================================ */
function showLoading(text = 'Processando...') {
  const overlay = document.getElementById('loading-overlay');
  const textEl = document.getElementById('loading-text');
  if (overlay) overlay.style.display = 'flex';
  if (textEl) textEl.textContent = text;
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}
