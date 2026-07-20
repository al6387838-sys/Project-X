(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const paths = {
    mark: '<path d="M4 12c0-4.7 3.3-8 8-8s8 3.3 8 8-3.3 8-8 8-8-3.3-8-8Z" fill="none"/><path d="M7.5 12c1.2-3.2 2.7-4.8 4.5-4.8s3.3 1.6 4.5 4.8c-1.2 3.2-2.7 4.8-4.5 4.8S8.7 15.2 7.5 12Z" fill="none"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    companion: '<path d="M8 6.5a4 4 0 0 1 8 0"/><rect x="4" y="7" width="16" height="12" rx="4"/><path d="M9 12h.01M15 12h.01M9 16h6"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m15 9 5-5M16 4h4v4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    network: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="m10.7 6.5-4.4 9M13.3 6.5l4.4 9M7 18h10"/>',
    sunrise: '<path d="M4 18h16M6 14a6 6 0 0 1 12 0M12 2v3M4.2 6.2l2.1 2.1M19.8 6.2l-2.1 2.1"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-5-4-8-6-12 0 4-3 5-4 8-1-2-2-3-3-4 0 3-2 5-2 8 0 4 4 7 8 7Z"/><path d="M9.5 18c0-2 1.5-3.3 2.5-5 1 1.7 2.5 3 2.5 5"/>',
    bulb: '<path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 0 4v5h18v-5a2 2 0 0 0 0-4V3H3v5Z"/><path d="M13 5v2M13 10v2M13 15v2"/>',
    usercheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8M17 11l2 2 4-4"/>',
    bug: '<rect x="8" y="6" width="8" height="13" rx="4"/><path d="M12 2v4M4 13h4M16 13h4M6 7l2 2M18 7l-2 2M6 19l2-2M18 19l-2-2"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
    alert: '<path d="M10.3 3.6 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    gauge: '<path d="M4.9 19a9 9 0 1 1 14.2 0M12 13l4-4"/><path d="M8 19h8"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    building: '<path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M2 21h20"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    store: '<path d="M3 9 5 3h14l2 6M5 13v8h14v-8M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 21v-6h6v6"/>',
    sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15ZM19 13l.8 2.2 2.2.8-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    wallet: '<path d="M4 5h14a2 2 0 0 1 2 2v12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12"/><path d="M20 11h-5a2 2 0 0 0 0 4h5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M4 19.5V6.5"/>',
    code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>'
  };

  function icon(name, classes = 'bd-icon') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', classes);
    svg.innerHTML = paths[name] || paths.sparkles;
    return svg;
  }

  function replaceWithIcon(node, name, classes) {
    if (!node) return;
    node.textContent = '';
    node.append(icon(name, classes));
  }

  const path = location.pathname.toLowerCase();
  let surface = 'core';
  if (path.includes('memory_center')) surface = 'memory';
  else if (path.includes('admin-dashboard')) surface = 'admin';
  else if (path.includes('enterprise')) surface = 'enterprise';
  else if (path.includes('marketplace')) surface = 'marketplace';

  function decorateNav(selector, names) {
    document.querySelectorAll(selector).forEach((node, index) => {
      if (node.querySelector('.bd-nav-icon')) return;
      const holder = document.createElement('span');
      holder.className = 'bd-nav-icon';
      holder.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex:0 0 auto;color:var(--bd-text-3)';
      holder.append(icon(names[index % names.length], 'bd-icon bd-icon-sm'));
      node.prepend(holder);
    });
  }

  function brandMark() {
    const svg = icon('mark', 'bd-brand-mark');
    svg.setAttribute('stroke-width', '1.4');
    return svg;
  }

  function coreEnhancements() {
    const navMap = {
      dashboard: 'dashboard', companion: 'companion', missions: 'target', timeline: 'calendar',
      lifegraph: 'network', briefing: 'sunrise', metrics: 'chart', settings: 'settings'
    };
    document.querySelectorAll('.sidebar-item[data-view]').forEach(node => {
      replaceWithIcon(node.querySelector('.sidebar-item-icon'), navMap[node.dataset.view] || 'sparkles');
    });

    const settingsListIcons = ['settings', 'activity', 'alert', 'shield', 'mark'];
    document.querySelectorAll('#view-settings .list-item-icon').forEach((node, index) => replaceWithIcon(node, settingsListIcons[index] || 'settings', 'bd-icon bd-icon-sm'));
    const themeIcons = ['mark', 'sunrise', 'activity', 'shield'];
    document.querySelectorAll('#view-settings .theme-option-icon').forEach((node, index) => replaceWithIcon(node, themeIcons[index] || 'mark', 'bd-icon'));

    const logo = document.querySelector('.sidebar-logo-icon');
    if (logo) { logo.textContent = ''; logo.append(brandMark()); }

    const splash = document.querySelector('.splash-icon');
    if (splash) { splash.textContent = ''; const mark = brandMark(); mark.style.width = '70px'; mark.style.height = '70px'; splash.append(mark); }

    const greeting = document.querySelector('#dashboard-greeting');
    if (greeting) greeting.textContent = greeting.textContent.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '').trim();

    const statNames = ['activity', 'target', 'flame', 'bulb'];
    document.querySelectorAll('#view-dashboard .stat-card-icon').forEach((node, i) => replaceWithIcon(node, statNames[i]));
    replaceWithIcon(document.querySelector('#view-dashboard .briefing-icon'), 'sunrise');

    const quickNames = ['companion', 'target', 'calendar', 'network'];
    document.querySelectorAll('#view-dashboard .dashboard-aside .grid-2 button').forEach((button, i) => {
      const first = button.querySelector('span');
      if (first) replaceWithIcon(first, quickNames[i], 'bd-icon bd-icon-lg');
    });

    const companionAvatar = document.querySelector('.companion-avatar');
    if (companionAvatar) {
      companionAvatar.textContent = '';
      const core = document.createElement('span');
      core.className = 'bd-companion-core';
      core.innerHTML = '<i></i>';
      companionAvatar.append(core);
    }

    const companionChat = document.querySelector('#view-companion .companion-chat');
    if (companionChat && !companionChat.querySelector('.bd-companion-stage')) {
      const stage = document.createElement('div');
      stage.className = 'bd-companion-stage';
      stage.setAttribute('aria-hidden', 'true');
      stage.innerHTML = '<span class="bd-companion-halo"><i></i></span><span class="bd-companion-stage-kicker">Presença contextual</span><strong>Observando seu ritmo</strong><span class="bd-companion-stage-note">Pronto para organizar, refletir e decidir com você.</span>';
      companionChat.append(stage);
    }

    const topbar = document.querySelector('.topbar');
    const search = document.querySelector('.topbar-search');
    if (topbar && search && !topbar.querySelector('.bd-presence')) {
      const presence = document.createElement('button');
      presence.type = 'button';
      presence.className = 'bd-presence';
      presence.setAttribute('aria-label', 'Abrir Companion, estado pronto');
      presence.title = 'Companion · pronto';
      presence.innerHTML = '<span class="bd-presence-orb" aria-hidden="true"></span><span class="bd-presence-copy">Companion</span><span class="bd-presence-state" aria-hidden="true"></span>';
      presence.addEventListener('click', () => window.showView?.('companion'));
      topbar.insertBefore(presence, search);
    }

    const dashboardHeader = document.querySelector('#view-dashboard .dashboard-header');
    if (dashboardHeader && !document.querySelector('.bd-intelligence-strip')) {
      const strip = document.createElement('section');
      strip.className = 'bd-intelligence-strip animate-fade-in';
      strip.setAttribute('aria-label', 'Resumo inteligente do Companion');
      strip.innerHTML = `
        <div class="bd-intelligence-identity">
          <span class="bd-core-mini" aria-hidden="true"><i></i></span>
          <span><span class="bd-intelligence-kicker">Companion · síntese pronta</span><span class="bd-intelligence-name">Seu dia está sob controle</span></span>
        </div>
        <p class="bd-intelligence-summary"><strong>Prioridade de hoje:</strong> avance a missão com maior impacto antes das 11h. Seu ritmo está estável; há uma janela de foco de 74 minutos disponível agora.</p>
        <button class="bd-intelligence-action" type="button"><span>Revisar com o Companion</span></button>`;
      strip.querySelector('button').append(icon('arrow', 'bd-icon bd-icon-sm'));
      strip.querySelector('button').addEventListener('click', () => window.showView?.('companion'));
      dashboardHeader.insertAdjacentElement('afterend', strip);
    }

    const metricsHeader = document.querySelector('#view-metrics .section-header');
    if (metricsHeader && !document.querySelector('#view-metrics .bd-metrics-summary')) {
      const metricsSummary = document.createElement('section');
      metricsSummary.className = 'bd-metrics-summary';
      metricsSummary.setAttribute('aria-label', 'Resumo executivo das métricas');
      metricsSummary.innerHTML = `
        <article><span>Life Score</span><strong>73</strong><small>+15 desde janeiro</small></article>
        <article><span>Tendência</span><strong>+3,8%</strong><small>últimos 30 dias</small></article>
        <article><span>Área em destaque</span><strong>Aprendizado</strong><small>índice 9,0</small></article>
        <article><span>Consistência</span><strong>7 meses</strong><small>trajetória positiva</small></article>`;
      metricsHeader.insertAdjacentElement('afterend', metricsSummary);
    }

    const lifeGraphEmptyIcon = document.querySelector('#view-lifegraph .empty-state-icon');
    if (lifeGraphEmptyIcon && !lifeGraphEmptyIcon.querySelector('.bd-network-preview')) {
      lifeGraphEmptyIcon.textContent = '';
      const preview = document.createElement('span');
      preview.className = 'bd-network-preview';
      preview.innerHTML = '<i></i><i></i><i></i><i></i><i></i><b></b>';
      lifeGraphEmptyIcon.append(preview);
    }

    document.querySelectorAll('.onboarding-icon').forEach((node, i) => replaceWithIcon(node, ['mark','target','chart','companion'][i % 4], 'bd-icon bd-icon-lg'));
    document.querySelectorAll('.modal-title').forEach(node => { node.textContent = node.textContent.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '').trim(); });
  }

  function memoryEnhancements() {
    replaceWithIcon(document.querySelector('.brain-icon'), 'database', 'bd-icon bd-icon-lg');
    decorateNav('.sidebar .nav-item', ['database','search','clock','network','shield','settings']);
    document.querySelectorAll('.stat-icon').forEach((node, i) => replaceWithIcon(node, ['database','network','activity','shield'][i % 4]));
    document.querySelectorAll('.memory-type-icon').forEach((node, i) => replaceWithIcon(node, ['book','target','heart','bulb','calendar'][i % 5]));
    document.querySelectorAll('.timeline-item-icon').forEach((node, i) => replaceWithIcon(node, ['activity','book','target','heart'][i % 4]));
  }

  function adminEnhancements() {
    const logo = document.querySelector('.logo');
    if (logo && !logo.querySelector('.bd-brand-mark')) { logo.textContent = ''; logo.append(brandMark(), document.createTextNode(' LifeOS Admin')); }
    decorateNav('.sidebar .nav-link', ['dashboard','users','chart','clock','ticket','usercheck','bug','bulb','star','alert','gauge','grid']);
    document.querySelectorAll('.metric-card').forEach((card, i) => card.dataset.metric = String(i + 1));
  }

  function enterpriseEnhancements() {
    replaceWithIcon(document.querySelector('.brand-mark'), 'building', 'bd-icon bd-icon-lg');
    decorateNav('.sidebar .nav-link', ['dashboard','chart','users','activity','target','settings']);
    document.querySelectorAll('.kpi-icon').forEach((node, i) => replaceWithIcon(node, ['users','activity','chart','shield'][i % 4]));
    document.querySelectorAll('.activity-icon').forEach((node, i) => replaceWithIcon(node, ['activity','users','target','alert'][i % 4]));
  }

  function marketplaceEnhancements() {
    const names = ['sparkles','calendar','target','activity','heart','wallet','book','code','layers'];
    document.querySelectorAll('.app-icon').forEach((node, i) => replaceWithIcon(node, names[i % names.length], 'bd-icon bd-icon-lg'));
    document.querySelectorAll('.stars').forEach(node => {
      node.textContent = '';
      for (let i = 0; i < 5; i += 1) node.append(icon('star', 'bd-icon bd-icon-sm'));
      node.style.display = 'inline-flex'; node.style.gap = '2px';
    });
  }

  function polishCharts() {
    if (!window.Chart) return;
    Chart.defaults.color = '#879097';
    Chart.defaults.borderColor = 'rgba(235,241,238,.065)';
    Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    Chart.defaults.font.size = 10;
    Chart.defaults.animation.duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420;
    Chart.defaults.animation.easing = 'easeOutQuart';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 6;
    Chart.defaults.plugins.legend.labels.boxHeight = 6;
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.plugins.tooltip.backgroundColor = '#20272e';
    Chart.defaults.plugins.tooltip.titleColor = '#f0f2ef';
    Chart.defaults.plugins.tooltip.bodyColor = '#a0a8ad';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(235,241,238,.12)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.padding = 10;
    const palette = ['#a4c8c3','#8db4af','#78a09c','#658d89','#547b78','#436b68'];
    const instances = Chart.instances ? Object.values(Chart.instances) : [];
    instances.forEach(chart => {
      chart.data?.datasets?.forEach((dataset, i) => {
        const color = palette[i % palette.length];
        if (dataset.type === 'doughnut' || chart.config.type === 'doughnut' || chart.config.type === 'pie') {
          dataset.backgroundColor = dataset.data?.map((_, index) => palette[index % palette.length]);
          dataset.borderColor = '#12161a';
          dataset.borderWidth = 2;
          dataset.hoverOffset = 2;
        } else {
          dataset.borderColor = color;
          dataset.backgroundColor = chart.config.type === 'line' ? 'rgba(111,166,160,.075)' : color;
          dataset.borderWidth = 1.6;
          dataset.pointRadius = 0;
          dataset.pointHoverRadius = 3;
          dataset.tension = .38;
        }
      });
      chart.options.animation = { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420, easing: 'easeOutQuart' };
      if (chart.options.scales) Object.values(chart.options.scales).forEach(scale => {
        scale.grid = { ...(scale.grid || {}), color: 'rgba(235,241,238,.055)', drawBorder: false };
        scale.border = { ...(scale.border || {}), display: false };
        scale.ticks = { ...(scale.ticks || {}), color: '#707980', padding: 8 };
      });
      chart.update('none');
    });
  }

  function scrubEmoji(root = document.body) {
    const testRegex = /[\p{Extended_Pictographic}\uFE0F]/u;
    const replaceRegex = /[\p{Extended_Pictographic}\uFE0F]/gu;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return testRegex.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { node.nodeValue = node.nodeValue.replace(replaceRegex, '').replace(/\s{2,}/g, ' '); });
  }

  function initialize() {
    document.body.dataset.lifeosSurface = surface;
    document.documentElement.dataset.blackDiamond = 'complete';
    if (surface === 'core') coreEnhancements();
    if (surface === 'memory') memoryEnhancements();
    if (surface === 'admin') adminEnhancements();
    if (surface === 'enterprise') enterpriseEnhancements();
    if (surface === 'marketplace') marketplaceEnhancements();
    scrubEmoji();
    setTimeout(polishCharts, 250);
    setTimeout(polishCharts, 1200);
    document.addEventListener('click', event => {
      if (event.target.closest('.nav-item, .admin-nav-item, [data-section], [data-view]')) {
        setTimeout(polishCharts, 80);
        setTimeout(polishCharts, 420);
      }
    }, { passive: true });
    setTimeout(() => scrubEmoji(), 400);
    setTimeout(() => scrubEmoji(), 1400);

    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'characterData' && record.target.parentElement) scrubEmoji(record.target.parentElement);
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) scrubEmoji(node);
          if (node.nodeType === Node.TEXT_NODE && node.parentElement) scrubEmoji(node.parentElement);
        });
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
