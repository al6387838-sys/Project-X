with open('/home/ubuntu/lifeos/premium_ui/modules/dashboard-v11.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir o load() para incluir auto-refresh e todos os dados Enterprise
old_load = """    async function load() {
      render();
      try {
        const [briefResponse, analyticsResponse, financeResponse] = await Promise.all([fetch('/api/briefing',{credentials:'same-origin'}),fetch('/api/analytics-pro?module=all&period=7d',{credentials:'same-origin'}),fetch('/api/finance/hub?view=summary',{credentials:'same-origin'})]);
        const [briefResult, analyticsResult, financeResult] = await Promise.all([briefResponse.json().catch(() => ({})),analyticsResponse.json().catch(() => ({})),financeResponse.json().catch(() => ({}))]);
        if (!briefResponse.ok || !briefResult.ok) throw new Error(briefResult.error || 'Não foi possível carregar o briefing.');
        state.briefing = briefResult.briefing;
        state.analytics = analyticsResponse.ok && analyticsResult.ok ? analyticsResult.data : null;
        state.finance = financeResponse.ok && financeResult.ok ? (financeResult.summary || financeResult.data || {}) : {};
      } catch (error) {
        state.briefing = { source:'empty', metrics:{}, agenda:[], habits:[], insights:[], priorities:[] };
        set('dv11-status', `<span class="dv11-pill">Dados indisponíveis no momento</span>`);
      }
      render();
    }
    restoreLayout(); window.LifeOSCommandCenter = { load, state }; window.setTimeout(load,0);
    const date = byId('d11-date'); if (date) date.textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});"""

new_load = """    async function load() {
      render();
      try {
        const [briefResponse, analyticsResponse, financeResponse] = await Promise.all([
          fetch('/api/briefing',{credentials:'same-origin'}),
          fetch('/api/analytics-pro?module=all&period=7d',{credentials:'same-origin'}),
          fetch('/api/finance/hub?view=summary',{credentials:'same-origin'})
        ]);
        const [briefResult, analyticsResult, financeResult] = await Promise.all([
          briefResponse.json().catch(() => ({})),
          analyticsResponse.json().catch(() => ({})),
          financeResponse.json().catch(() => ({}))
        ]);
        if (!briefResponse.ok || !briefResult.ok) throw new Error(briefResult.error || 'Não foi possível carregar o briefing.');
        state.briefing = briefResult.briefing;
        state.analytics = analyticsResponse.ok && analyticsResult.ok ? analyticsResult.data : null;
        state.finance = financeResponse.ok && financeResult.ok ? (financeResult.summary || financeResult.data || {}) : {};
      } catch (error) {
        state.briefing = { source:'empty', metrics:{}, agenda:[], habits:[], goals:[], insights:[], priorities:[], messages:[], emails:[], recentDocs:[], recentProjects:[] };
        set('dv11-status', `<span class="dv11-pill">Dados indisponíveis no momento</span>`);
      }
      render();
      renderEnterpriseWidgets();
    }
    // Auto-atualização a cada 5 minutos
    let _dv11RefreshTimer = null;
    function startAutoRefresh() {
      if (_dv11RefreshTimer) clearInterval(_dv11RefreshTimer);
      _dv11RefreshTimer = setInterval(() => { load(); }, 5 * 60 * 1000);
    }
    // Renderizar widgets Enterprise adicionais com dados reais
    function renderEnterpriseWidgets() {
      const b = state.briefing || {};
      const m = b.metrics || {};
      // ── Widget: Hábitos de hoje (interativo) ──
      const habitsContainer = byId('dv11-habits-container');
      if (habitsContainer) {
        const habits = b.habits || [];
        if (!habits.length) {
          habitsContainer.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px 0">Nenhum hábito ativo. <a href="#" onclick="showPage(\'habits\');return false;" style="color:var(--accent)">Criar hábito</a></div>';
        } else {
          habitsContainer.innerHTML = habits.map(h => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="toggleHabitReal('${h.id}',this)">
              <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${h.done ? 'var(--green)' : 'var(--border)'};background:${h.done ? 'var(--green)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:#fff">${h.done ? '✓' : ''}</div>
              <span style="font-size:12px;flex:1;${h.done ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${h.name}</span>
              <span style="font-size:10px;color:var(--amber)">🔥${h.streak}d</span>
            </div>`).join('');
        }
      }
      // ── Widget: Metas ──
      const goalsContainer = byId('dv11-goals-container');
      if (goalsContainer) {
        const goals = b.goals || [];
        if (!goals.length) {
          goalsContainer.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px 0">Nenhuma meta ativa. <a href="#" onclick="showPage(\'goals\');return false;" style="color:var(--accent)">Criar meta</a></div>';
        } else {
          goalsContainer.innerHTML = goals.map(g => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showPage('goals')">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                <span style="font-weight:500">${g.title}</span>
                <span style="color:var(--accent-light);font-weight:700">${g.progress}%</span>
              </div>
              <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
                <div style="height:100%;width:${g.progress}%;background:${g.color || 'var(--accent)'};border-radius:2px;transition:width 0.6s"></div>
              </div>
            </div>`).join('');
        }
      }
      // ── Widget: Agenda de hoje (com eventos reais) ──
      const agendaContainer = byId('dv11-agenda');
      if (agendaContainer) {
        const agenda = b.agenda || [];
        if (!agenda.length) {
          agendaContainer.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px 0">Nenhum evento hoje. <a href="#" onclick="showPage(\'agenda\');return false;" style="color:var(--accent)">Adicionar evento</a></div>';
        } else {
          agendaContainer.innerHTML = agenda.map(e => `
            <div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showPage('agenda')">
              <div style="font-size:10px;color:var(--text-muted);font-family:monospace;width:40px;padding-top:1px">${e.time || (e.allDay ? 'Dia todo' : '—')}</div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:500">${e.source === 'google' ? '🔵 ' : e.source === 'outlook' ? '🟦 ' : ''}${e.title}</div>
                ${e.location ? `<div style="font-size:10px;color:var(--text-muted)">📍 ${e.location}</div>` : ''}
              </div>
              <div style="width:3px;height:30px;border-radius:2px;background:${e.color || 'var(--accent)'};flex-shrink:0"></div>
            </div>`).join('');
        }
      }
      // ── Widget: Mensagens não lidas ──
      const msgContainer = byId('dv11-messages');
      if (msgContainer) {
        const msgs = b.messages || [];
        if (!msgs.length) {
          msgContainer.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px 0">Nenhuma mensagem não lida</div>';
        } else {
          msgContainer.innerHTML = msgs.map(m => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showPage('messages')">
              <div style="font-size:12px;font-weight:500">${m.from}</div>
              <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.subject}</div>
            </div>`).join('');
        }
      }
      // ── Widget: Emails não lidos ──
      const emailContainer = byId('dv11-emails');
      if (emailContainer) {
        const emails = b.emails || [];
        if (!emails.length) {
          emailContainer.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px 0">Nenhum email não lido</div>';
        } else {
          emailContainer.innerHTML = emails.map(e => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showPage('email')">
              <div style="font-size:12px;font-weight:500">${e.from}</div>
              <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.subject}</div>
            </div>`).join('');
        }
      }
      // ── Widget: Projetos ativos ──
      const projContainer = byId('dv11-projects');
      if (projContainer) {
        const projs = b.recentProjects || [];
        if (!projs.length) {
          projContainer.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px 0">Nenhum projeto ativo. <a href="#" onclick="showPage(\'projects\');return false;" style="color:var(--accent)">Criar projeto</a></div>';
        } else {
          projContainer.innerHTML = projs.map(p => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showPage('projects')">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                <span style="font-weight:500">${p.title}</span>
                <span style="color:var(--text-muted);font-size:10px">${p.progress || 0}%</span>
              </div>
              <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden">
                <div style="height:100%;width:${p.progress || 0}%;background:var(--accent);border-radius:2px"></div>
              </div>
            </div>`).join('');
        }
      }
      // ── Widget: Documentos recentes ──
      const docsContainer = byId('dv11-docs');
      if (docsContainer) {
        const docs = b.recentDocs || [];
        if (!docs.length) {
          docsContainer.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px 0">Nenhum documento recente</div>';
        } else {
          docsContainer.innerHTML = docs.map(d => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showPage('documents')">
              <div style="font-size:12px;font-weight:500">${d.title}</div>
              <div style="font-size:10px;color:var(--text-muted)">${d.type} · ${d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('pt-BR') : ''}</div>
            </div>`).join('');
        }
      }
      // ── Métricas do cabeçalho ──
      const setMetric = (id, val) => { const el = byId(id); if (el) el.textContent = val; };
      setMetric('dv11-metric-tasks', m.tasksPending || 0);
      setMetric('dv11-metric-habits', `${m.habitsCompleted || 0}/${m.habitsActive || 0}`);
      setMetric('dv11-metric-goals', m.goalsActive || 0);
      setMetric('dv11-metric-events', m.eventsToday || 0);
      setMetric('dv11-metric-messages', (m.unreadMessages || 0) + (m.unreadEmails || 0));
      setMetric('dv11-metric-projects', m.projectsActive || 0);
      // Atualizar timestamp
      const ts = byId('dv11-last-updated');
      if (ts) ts.textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      refreshIcons();
    }
    restoreLayout(); window.LifeOSCommandCenter = { load, state }; window.setTimeout(load,0); startAutoRefresh();
    const date = byId('d11-date'); if (date) date.textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});"""

if old_load in content:
    content = content.replace(old_load, new_load, 1)
    print("✓ load() replaced with Enterprise version")
else:
    print("✗ load() NOT found")

# Agora adicionar os novos widgets HTML no painel "today" e "command"
# Adicionar widget de mensagens, emails, projetos, documentos na seção command
old_command_section = """  <section id="panel-command" class="dv11-panel"><div id="commandGrid" class="dv11-widget-grid">
    <article id="w11-prod-kpis" class="dv11-widget dv11-w6" draggable="true"><button class="dv11-remove-btn" type="button" onclick="dv11RemoveWidget('w11-prod-kpis')" aria-label="Ocultar produtividade">×</button><div class="dv11-widget-header"><div class="dv11-widget-title">Indicadores de produtividade</div><span class="dv11-widget-action" onclick="showPage('analytics')">Analytics</span></div><div id="dv11-productivity" class="dv11-kpi-row"></div></article>
    <article id="w11-finance-widget" class="dv11-widget dv11-w6" draggable="true"><button class="dv11-remove-btn" type="button" onclick="dv11RemoveWidget('w11-finance-widget')" aria-label="Ocultar finanças">×</button><div class="dv11-widget-header"><div class="dv11-widget-title">Resumo financeiro</div><span class="dv11-widget-action" onclick="showPage('finance')">Finance Hub</span></div><div id="dv11-finance" class="dv11-kpi-row"></div></article>
  </div></section>"""

new_command_section = """  <section id="panel-command" class="dv11-panel"><div id="commandGrid" class="dv11-widget-grid">
    <article id="w11-prod-kpis" class="dv11-widget dv11-w6" draggable="true"><button class="dv11-remove-btn" type="button" onclick="dv11RemoveWidget('w11-prod-kpis')" aria-label="Ocultar produtividade">×</button><div class="dv11-widget-header"><div class="dv11-widget-title">Indicadores de produtividade</div><span class="dv11-widget-action" onclick="showPage('analytics')">Analytics</span></div><div id="dv11-productivity" class="dv11-kpi-row"></div></article>
    <article id="w11-finance-widget" class="dv11-widget dv11-w6" draggable="true"><button class="dv11-remove-btn" type="button" onclick="dv11RemoveWidget('w11-finance-widget')" aria-label="Ocultar finanças">×</button><div class="dv11-widget-header"><div class="dv11-widget-title">Resumo financeiro</div><span class="dv11-widget-action" onclick="showPage('finance')">Finance Hub</span></div><div id="dv11-finance" class="dv11-kpi-row"></div></article>
    <article id="w11-messages-widget" class="dv11-widget dv11-w4" draggable="true"><button class="dv11-remove-btn" type="button" onclick="dv11RemoveWidget('w11-messages-widget')" aria-label="Ocultar mensagens">×</button><div class="dv11-widget-header"><div class="dv11-widget-title">💬 Mensagens</div><span class="dv11-widget-action" onclick="showPage('messages')">Ver todas</span></div><div id="dv11-messages" class="dv11-list"></div></article>
    <article id="w11-emails-widget" class="dv11-widget dv11-w4" draggable="true"><button class="dv11-remove-btn" type="button" onclick="dv11RemoveWidget('w11-emails-widget')" aria-label="Ocultar emails">×</button><div class="dv11-widget-header"><div class="dv11-widget-title">📧 Emails</div><span class="dv11-widget-action" onclick="showPage('email')">Ver todos</span></div><div id="dv11-emails" class="dv11-list"></div></article>
    <article id="w11-projects-widget" class="dv11-widget dv11-w4" draggable="true"><button class="dv11-remove-btn" type="button" onclick="dv11RemoveWidget('w11-projects-widget')" aria-label="Ocultar projetos">×</button><div class="dv11-widget-header"><div class="dv11-widget-title">📁 Projetos ativos</div><span class="dv11-widget-action" onclick="showPage('projects')">Ver todos</span></div><div id="dv11-projects" class="dv11-list"></div></article>
    <article id="w11-docs-widget" class="dv11-widget dv11-w4" draggable="true"><button class="dv11-remove-btn" type="button" onclick="dv11RemoveWidget('w11-docs-widget')" aria-label="Ocultar documentos">×</button><div class="dv11-widget-header"><div class="dv11-widget-title">📄 Documentos recentes</div><span class="dv11-widget-action" onclick="showPage('documents')">Ver todos</span></div><div id="dv11-docs" class="dv11-list"></div></article>
  </div></section>"""

if old_command_section in content:
    content = content.replace(old_command_section, new_command_section, 1)
    print("✓ Command section expanded with new widgets")
else:
    print("✗ Command section NOT found")

# Adicionar métricas rápidas no header do Command Center
old_header_area = """  <div id="dv11CatalogOverlay" """

new_header_area = """  <!-- Métricas rápidas Enterprise -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding:0 4px">
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:12px"><span style="color:var(--text-muted)">📋 Tarefas</span><span id="dv11-metric-tasks" style="font-weight:700;color:var(--accent)">—</span></div>
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:12px"><span style="color:var(--text-muted)">🔥 Hábitos</span><span id="dv11-metric-habits" style="font-weight:700;color:var(--green)">—</span></div>
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:12px"><span style="color:var(--text-muted)">🎯 Metas</span><span id="dv11-metric-goals" style="font-weight:700;color:var(--purple)">—</span></div>
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:12px"><span style="color:var(--text-muted)">📅 Eventos</span><span id="dv11-metric-events" style="font-weight:700;color:var(--cyan)">—</span></div>
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:12px"><span style="color:var(--text-muted)">💬 Msgs</span><span id="dv11-metric-messages" style="font-weight:700;color:var(--amber)">—</span></div>
    <div style="display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:12px"><span style="color:var(--text-muted)">📁 Projetos</span><span id="dv11-metric-projects" style="font-weight:700;color:var(--pink)">—</span></div>
    <div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text-muted)"><span id="dv11-last-updated">Carregando...</span><button style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:10px;color:var(--text-muted);cursor:pointer" onclick="window.LifeOSCommandCenter?.load()">↻ Atualizar</button></div>
  </div>
  <div id="dv11CatalogOverlay" """

if old_header_area in content:
    content = content.replace(old_header_area, new_header_area, 1)
    print("✓ Enterprise metrics bar added")
else:
    print("✗ Header area NOT found")

with open('/home/ubuntu/lifeos/premium_ui/modules/dashboard-v11.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File saved. Lines: {content.count(chr(10))}")
