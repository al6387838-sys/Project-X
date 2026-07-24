import re

with open('/home/ubuntu/lifeos/premium_ui/app_dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Substituir openNewEventModal (versão com prompt diferente) ──
old_ev = """  function openNewEventModal() {
    const today = new Date().toISOString().split('T')[0];
    const title = prompt('Título do evento:');
    if (!title) return;
    const time = prompt('Horário (ex: 09:00):', '09:00') || '09:00';
    const duration = prompt('Duração (ex: 1h):', '1h') || '1h';
    fetch('/api/events', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date: today, time, duration }),
    }).then(r => r.json()).then(d => {
      if (d.ok) { showToast('Evento criado!', 'success'); loadAgenda(); }
      else showToast(d.error || 'Erro ao criar evento', 'error');
    }).catch(() => showToast('Erro ao criar evento', 'error'));
  }"""

new_ev = """  function openNewEventModal(prefillDate) {
    const today = prefillDate || new Date().toISOString().split('T')[0];
    document.getElementById('ev-modal-title').textContent = 'Novo Evento';
    document.getElementById('ev-id').value = '';
    document.getElementById('ev-title').value = '';
    document.getElementById('ev-date').value = today;
    document.getElementById('ev-time').value = '09:00';
    document.getElementById('ev-end-time').value = '10:00';
    document.getElementById('ev-location').value = '';
    document.getElementById('ev-description').value = '';
    document.getElementById('ev-repeat').value = 'none';
    document.getElementById('ev-reminder').value = '0';
    document.getElementById('ev-category').value = 'personal';
    document.getElementById('ev-color').value = '#6366F1';
    document.getElementById('ev-all-day').checked = false;
    document.getElementById('ev-form-error').style.display = 'none';
    openModal('modal-event-form');
  }
  function openEditEventModal(ev) {
    document.getElementById('ev-modal-title').textContent = 'Editar Evento';
    document.getElementById('ev-id').value = ev.id || '';
    document.getElementById('ev-title').value = ev.title || '';
    document.getElementById('ev-date').value = ev.date || '';
    document.getElementById('ev-time').value = ev.time || '09:00';
    document.getElementById('ev-end-time').value = ev.endTime || '';
    document.getElementById('ev-location').value = ev.location || '';
    document.getElementById('ev-description').value = ev.description || '';
    document.getElementById('ev-repeat').value = ev.repeat || 'none';
    document.getElementById('ev-reminder').value = String(ev.reminder || 0);
    document.getElementById('ev-category').value = ev.category || 'personal';
    document.getElementById('ev-color').value = ev.color || '#6366F1';
    document.getElementById('ev-all-day').checked = Boolean(ev.allDay);
    document.getElementById('ev-form-error').style.display = 'none';
    openModal('modal-event-form');
  }
  async function submitEventForm() {
    const id = document.getElementById('ev-id').value;
    const title = document.getElementById('ev-title').value.trim();
    const date = document.getElementById('ev-date').value;
    if (!title) { document.getElementById('ev-form-error').textContent = 'Título obrigatório'; document.getElementById('ev-form-error').style.display = 'block'; return; }
    if (!date) { document.getElementById('ev-form-error').textContent = 'Data obrigatória'; document.getElementById('ev-form-error').style.display = 'block'; return; }
    const payload = {
      title, date,
      time: document.getElementById('ev-time').value,
      endTime: document.getElementById('ev-end-time').value,
      location: document.getElementById('ev-location').value,
      description: document.getElementById('ev-description').value,
      repeat: document.getElementById('ev-repeat').value,
      reminder: Number(document.getElementById('ev-reminder').value),
      category: document.getElementById('ev-category').value,
      color: document.getElementById('ev-color').value,
      allDay: document.getElementById('ev-all-day').checked,
    };
    const btn = document.getElementById('ev-submit-btn');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const method = id ? 'PUT' : 'POST';
      if (id) payload.id = id;
      const r = await fetch('/api/events', { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (d.ok) { showToast(id ? 'Evento atualizado!' : 'Evento criado!', 'success'); closeModal(); loadAgenda(); }
      else { document.getElementById('ev-form-error').textContent = d.error || 'Erro ao salvar'; document.getElementById('ev-form-error').style.display = 'block'; }
    } catch { document.getElementById('ev-form-error').textContent = 'Erro de conexão'; document.getElementById('ev-form-error').style.display = 'block'; }
    finally { btn.disabled = false; btn.textContent = id ? 'Salvar alterações' : 'Criar evento'; }
  }
  async function deleteEvent(id) {
    if (!confirm('Excluir este evento?')) return;
    try {
      const r = await fetch('/api/events?id=' + id, { method: 'DELETE', credentials: 'same-origin' });
      const d = await r.json();
      if (d.ok) { showToast('Evento excluído', 'success'); loadAgenda(); }
      else showToast(d.error || 'Erro ao excluir', 'error');
    } catch { showToast('Erro ao excluir evento', 'error'); }
  }
  async function agendaSyncGoogle() {
    showToast('Sincronizando com Google Calendar...', 'info');
    try {
      const r = await fetch('/api/events', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'google-sync' }) });
      const d = await r.json();
      if (d.ok) { showToast(`${d.synced} eventos sincronizados do Google Calendar`, 'success'); loadAgenda(); }
      else showToast(d.error || 'Erro ao sincronizar Google Calendar', 'error');
    } catch { showToast('Erro ao sincronizar Google Calendar', 'error'); }
  }
  async function agendaSyncOutlook() {
    showToast('Sincronizando com Outlook...', 'info');
    try {
      const r = await fetch('/api/events', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'outlook-sync' }) });
      const d = await r.json();
      if (d.ok) { showToast(`${d.synced} eventos sincronizados do Outlook`, 'success'); loadAgenda(); }
      else showToast(d.error || 'Erro ao sincronizar Outlook', 'error');
    } catch { showToast('Erro ao sincronizar Outlook', 'error'); }
  }"""

if old_ev in content:
    content = content.replace(old_ev, new_ev, 1)
    print("✓ openNewEventModal replaced")
else:
    print("✗ openNewEventModal NOT found")

# ── 2. Substituir loadAgenda com versão completa (dia/semana/mês + busca + arrastar) ──
old_load_agenda = """  // ── loadAgenda: carrega eventos e tarefas de hoje ─────────────────────
  async function loadAgenda() {
    const eventsEl = document.getElementById('agenda-events-list');
    const tasksEl = document.getElementById('agenda-tasks-list');
    const today = new Date().toISOString().split('T')[0];
    // Eventos
    if (eventsEl) {
      try {
        const data = await apiFetch(`/api/events?date=${today}`);
        const events = data.events || [];
        if (!events.length) {
          eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Nenhum evento hoje. <button class="btn btn-ghost" style="font-size:12px;margin-top:8px" onclick="openNewEventModal()">+ Adicionar evento</button></div>';
        } else {
          const colors = ['var(--accent)', 'var(--green)', 'var(--amber)', 'var(--purple)', 'var(--cyan)'];
          eventsEl.innerHTML = events.map((e, i) => `
            <div style="display:flex;gap:12px;align-items:center;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md)">
              <div style="font-size:11px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;width:40px">${e.time || '—'}</div>
              <div style="flex:1"><div style="font-size:13px;font-weight:600">${e.title}</div><div style="font-size:11px;color:var(--text-secondary)">${e.duration || ''} ${e.location ? '· ' + e.location : ''}</div></div>
              <div style="width:4px;height:36px;border-radius:2px;background:${e.color || colors[i % colors.length]}"></div>
            </div>`).join('');
        }
      } catch { eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Erro ao carregar eventos.</div>'; }
    }
    // Tarefas do dia
    if (tasksEl) {
      try {
        const data = await apiFetch('/api/tasks');
        const tasks = (data.tasks || []).filter(t => t.dueDate === today || (!t.dueDate && t.status !== 'done')).slice(0, 8);
        if (!tasks.length) {
          tasksEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Nenhuma tarefa para hoje.</div>';
        } else {
          tasksEl.innerHTML = tasks.map(t => `
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:var(--radius-md);transition:background 0.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
              <input type="checkbox" ${t.status === 'done' ? 'checked' : ''} style="accent-color:var(--accent)" onchange="toggleTaskStatus('${t.id}', this.checked)" />
              <span style="font-size:13px${t.status === 'done' ? ';text-decoration:line-through;color:var(--text-muted)' : ''}">${t.title}</span>
            </label>`).join('');
        }
      } catch { tasksEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Erro ao carregar tarefas.</div>'; }
    }
  }"""

new_load_agenda = """  // ── Agenda: estado e funções de navegação ─────────────────────────────
  let _agendaView = 'day';
  let _agendaDate = new Date();
  let _agendaSearchTimeout = null;

  function agendaSetView(v) {
    _agendaView = v;
    ['day','week','month'].forEach(s => {
      const btn = document.getElementById('agenda-view-' + s);
      if (btn) btn.classList.toggle('active', s === v);
    });
    loadAgenda();
  }
  function agendaNavigate(dir) {
    if (_agendaView === 'day') _agendaDate.setDate(_agendaDate.getDate() + dir);
    else if (_agendaView === 'week') _agendaDate.setDate(_agendaDate.getDate() + dir * 7);
    else _agendaDate.setMonth(_agendaDate.getMonth() + dir);
    loadAgenda();
  }
  function agendaGoToday() {
    _agendaDate = new Date();
    loadAgenda();
  }
  function agendaSearch(q) {
    clearTimeout(_agendaSearchTimeout);
    _agendaSearchTimeout = setTimeout(() => {
      if (!q.trim()) { loadAgenda(); return; }
      apiFetch('/api/events?q=' + encodeURIComponent(q)).then(data => {
        const eventsEl = document.getElementById('agenda-events-list');
        if (!eventsEl) return;
        const events = data.events || [];
        if (!events.length) {
          eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Nenhum resultado para "' + q + '"</div>';
        } else {
          eventsEl.innerHTML = events.map(e => renderEventCard(e)).join('');
          if (window.lucide) lucide.createIcons();
        }
      }).catch(() => {});
    }, 300);
  }
  function renderEventCard(e) {
    const sourceIcon = e.source === 'google' ? '🔵' : e.source === 'outlook' ? '🟦' : '';
    return `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 12px;background:var(--bg-elevated);border-radius:var(--radius-md);border-left:3px solid ${e.color || 'var(--accent)'};cursor:pointer" onclick="openEditEventModal(${JSON.stringify(e).replace(/"/g, '&quot;')})">
      <div style="font-size:11px;color:var(--text-muted);font-family:monospace;width:44px;padding-top:2px">${e.time || (e.allDay ? 'Dia todo' : '—')}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${sourceIcon} ${e.title}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${e.endTime ? e.time + '–' + e.endTime : ''} ${e.location ? '· 📍 ' + e.location : ''} ${e.repeat && e.repeat !== 'none' ? '· 🔄' : ''} ${e.reminder ? '· 🔔' : ''}</div>
        ${e.description ? '<div style="font-size:11px;color:var(--text-muted);margin-top:3px">' + e.description.slice(0, 80) + (e.description.length > 80 ? '...' : '') + '</div>' : ''}
      </div>
      <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="event.stopPropagation();deleteEvent('${e.id}')">✕</button>
    </div>`;
  }
  function renderWeekView(events, from, to) {
    const days = [];
    const cur = new Date(from + 'T12:00:00');
    const end = new Date(to + 'T12:00:00');
    while (cur <= end) {
      days.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return '<div style="display:grid;grid-template-columns:repeat(' + days.length + ',1fr);gap:8px">' +
      days.map(d => {
        const dayEvents = events.filter(e => e.date === d);
        const isToday = d === new Date().toISOString().split('T')[0];
        const label = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
        return `<div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:8px;border:1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}">
          <div style="font-size:11px;font-weight:700;color:${isToday ? 'var(--accent)' : 'var(--text-muted)'};margin-bottom:6px;text-align:center">${label}</div>
          ${dayEvents.length ? dayEvents.map(e => `<div style="font-size:11px;padding:4px 6px;background:${e.color || 'var(--accent)'}22;border-radius:4px;margin-bottom:3px;cursor:pointer;border-left:2px solid ${e.color || 'var(--accent)'}" onclick="openEditEventModal(${JSON.stringify(e).replace(/"/g, '&quot;')})">${e.time ? e.time + ' ' : ''}${e.title}</div>`).join('') : '<div style="font-size:10px;color:var(--text-muted);text-align:center;padding:8px 0">—</div>'}
          <button style="width:100%;background:transparent;border:1px dashed var(--border);border-radius:4px;padding:4px;font-size:10px;color:var(--text-muted);cursor:pointer;margin-top:4px" onclick="openNewEventModal('${d}')">+</button>
        </div>`;
      }).join('') + '</div>';
  }
  function renderMonthView(events, year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const today = new Date().toISOString().split('T')[0];
    let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
    ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d => {
      html += `<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text-muted);padding:4px">${d}</div>`;
    });
    for (let i = 0; i < startDow; i++) html += '<div></div>';
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isToday = dateStr === today;
      html += `<div style="min-height:60px;background:var(--bg-elevated);border-radius:4px;padding:4px;border:1px solid ${isToday ? 'var(--accent)' : 'var(--border)'};cursor:pointer" onclick="openNewEventModal('${dateStr}')">
        <div style="font-size:11px;font-weight:${isToday ? '800' : '500'};color:${isToday ? 'var(--accent)' : 'var(--text-primary)'};margin-bottom:2px">${d}</div>
        ${dayEvents.slice(0,3).map(e => `<div style="font-size:9px;padding:1px 3px;background:${e.color || 'var(--accent)'}33;border-radius:2px;margin-bottom:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${e.title}</div>`).join('')}
        ${dayEvents.length > 3 ? `<div style="font-size:9px;color:var(--text-muted)">+${dayEvents.length - 3}</div>` : ''}
      </div>`;
    }
    html += '</div>';
    return html;
  }
  // ── loadAgenda: carrega eventos com suporte a dia/semana/mês ──────────
  async function loadAgenda() {
    const eventsEl = document.getElementById('agenda-events-list');
    const tasksEl = document.getElementById('agenda-tasks-list');
    const titleEl = document.getElementById('agenda-events-title');
    const dateLabel = document.getElementById('agenda-date-label');
    const category = document.getElementById('agenda-category-filter')?.value || '';
    const today = new Date().toISOString().split('T')[0];
    const d = _agendaDate;

    if (_agendaView === 'day') {
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (dateLabel) dateLabel.textContent = label;
      if (titleEl) titleEl.textContent = 'Eventos do Dia';
      if (eventsEl) {
        eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Carregando...</div>';
        try {
          let url = `/api/events?date=${dateStr}`;
          if (category) url += `&category=${encodeURIComponent(category)}`;
          const data = await apiFetch(url);
          const events = data.events || [];
          if (!events.length) {
            eventsEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Nenhum evento. <button class="btn btn-ghost" style="font-size:12px;margin-top:8px" onclick="openNewEventModal('${dateStr}')">+ Adicionar evento</button></div>`;
          } else {
            eventsEl.innerHTML = events.map(e => renderEventCard(e)).join('');
            if (window.lucide) lucide.createIcons();
          }
        } catch { eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Erro ao carregar eventos.</div>'; }
      }
    } else if (_agendaView === 'week') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const from = weekStart.toISOString().split('T')[0];
      const to = weekEnd.toISOString().split('T')[0];
      const label = weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) + ' – ' + weekEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
      if (dateLabel) dateLabel.textContent = label;
      if (titleEl) titleEl.textContent = 'Semana';
      if (eventsEl) {
        eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Carregando...</div>';
        try {
          let url = `/api/events?from=${from}&to=${to}`;
          if (category) url += `&category=${encodeURIComponent(category)}`;
          const data = await apiFetch(url);
          eventsEl.innerHTML = renderWeekView(data.events || [], from, to);
          if (window.lucide) lucide.createIcons();
        } catch { eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Erro ao carregar semana.</div>'; }
      }
    } else if (_agendaView === 'month') {
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (dateLabel) dateLabel.textContent = label;
      if (titleEl) titleEl.textContent = 'Mês';
      const from = `${year}-${String(month+1).padStart(2,'0')}-01`;
      const to = new Date(year, month + 1, 0).toISOString().split('T')[0];
      if (eventsEl) {
        eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Carregando...</div>';
        try {
          let url = `/api/events?from=${from}&to=${to}`;
          if (category) url += `&category=${encodeURIComponent(category)}`;
          const data = await apiFetch(url);
          eventsEl.innerHTML = renderMonthView(data.events || [], year, month);
          if (window.lucide) lucide.createIcons();
        } catch { eventsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Erro ao carregar mês.</div>'; }
      }
    }
    // Tarefas do dia (sempre mostra tarefas de hoje)
    if (tasksEl) {
      try {
        const data = await apiFetch('/api/tasks');
        const tasks = (data.tasks || []).filter(t => t.dueDate === today || (!t.dueDate && t.status !== 'done')).slice(0, 8);
        if (!tasks.length) {
          tasksEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Nenhuma tarefa para hoje.</div>';
        } else {
          tasksEl.innerHTML = tasks.map(t => `
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:var(--radius-md);transition:background 0.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
              <input type="checkbox" ${t.status === 'done' ? 'checked' : ''} style="accent-color:var(--accent)" onchange="toggleTaskStatus('${t.id}', this.checked)" />
              <span style="font-size:13px${t.status === 'done' ? ';text-decoration:line-through;color:var(--text-muted)' : ''}">${t.title}</span>
            </label>`).join('');
        }
      } catch { tasksEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Erro ao carregar tarefas.</div>'; }
    }
  }"""

if old_load_agenda in content:
    content = content.replace(old_load_agenda, new_load_agenda, 1)
    print("✓ loadAgenda replaced")
else:
    print("✗ loadAgenda NOT found")

# ── 3. Substituir loadHabits com versão completa ──
old_load_habits = """  // ── loadHabits: carrega hábitos reais ─────────────────────────────────
  async function loadHabits() {
    const listEl = document.getElementById('habits-list');
    if (!listEl) return;
    try {
      const data = await apiFetch('/api/habits');
      const habits = data.habits || [];
      const today = new Date().toISOString().split('T')[0];
      // Stats
      const active = habits.filter(h => h.active);
      const done = habits.filter(h => h.completions?.includes(today));
      const maxStreak = Math.max(...habits.map(h => h.streak || 0), 0);
      const rate = active.length > 0 ? Math.round((done.length / active.length) * 100) : 0;
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('h-streak', maxStreak > 0 ? `${maxStreak}d` : '0d');
      setEl('h-streak-text', maxStreak >= 7 ? 'Recorde!' : `${maxStreak} dias`);
      const streakLabel = document.getElementById('h-streak-label');
      if (streakLabel && maxStreak > 0) streakLabel.style.display = 'flex';
      setEl('h-rate', `${rate}%`);
      setEl('h-rate-sub', `${done.length} de ${active.length} completos`);
      setEl('h-active', active.length);
      setEl('h-active-sub', active.length === habits.length ? 'Todos ativos' : `${habits.length - active.length} inativos`);
      setEl('h-total', habits.length);
      // Lista
      if (!habits.length) {
        listEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:30px 0">Nenhum hábito cadastrado. <button class="btn btn-primary" style="margin-top:12px;display:block;margin-left:auto;margin-right:auto" onclick="openNewHabitModal()">+ Criar primeiro hábito</button></div>';
        return;
      }
      listEl.innerHTML = habits.map(h => {
        const isDone = h.completions?.includes(today);
        return `<div class="habit-item ${isDone ? 'done' : ''}" onclick="toggleHabitReal('${h.id}', this)" data-id="${h.id}">
          <div class="habit-check">${isDone ? '<i data-lucide="check" class="pg-icon" aria-hidden="true"></i>' : ''}</div>
          <span class="habit-name"><i data-lucide="circle-dot" class="pg-icon" aria-hidden="true"></i> ${h.title}</span>
          <span class="habit-streak"><i data-lucide="flame" class="pg-icon" aria-hidden="true"></i> ${h.streak || 0}d</span>
        </div>`;
      }).join('');
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      /* warn handled */
      if (listEl) listEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Erro ao carregar hábitos.</div>';
    }
  }"""

new_load_habits = """  // ── loadHabits: carrega hábitos reais com filtros e ações completas ──
  async function loadHabits() {
    const listEl = document.getElementById('habits-list');
    if (!listEl) return;
    try {
      const data = await apiFetch('/api/habits');
      let habits = data.habits || [];
      const today = new Date().toISOString().split('T')[0];
      // Filtro
      if (_habitsFilter === 'pending') habits = habits.filter(h => !h.completedToday && h.active !== false);
      else if (_habitsFilter === 'done') habits = habits.filter(h => h.completedToday);
      // Stats
      const allHabits = data.habits || [];
      const active = allHabits.filter(h => h.active !== false);
      const done = allHabits.filter(h => h.completedToday);
      const maxStreak = Math.max(...allHabits.map(h => h.streak || 0), 0);
      const rate = active.length > 0 ? Math.round((done.length / active.length) * 100) : 0;
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('h-streak', maxStreak > 0 ? `${maxStreak}d` : '0d');
      setEl('h-streak-text', maxStreak >= 7 ? '🔥 Recorde!' : `${maxStreak} dias`);
      const streakLabel = document.getElementById('h-streak-label');
      if (streakLabel && maxStreak > 0) streakLabel.style.display = 'flex';
      setEl('h-rate', `${rate}%`);
      setEl('h-rate-sub', `${done.length} de ${active.length} completos`);
      setEl('h-active', active.length);
      setEl('h-active-sub', active.length === allHabits.length ? 'Todos ativos' : `${allHabits.length - active.length} inativos`);
      setEl('h-total', done.length);
      // Lista
      if (!habits.length) {
        listEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:30px 0">
          ${_habitsFilter === 'all' ? 'Nenhum hábito cadastrado.' : 'Nenhum hábito nesta categoria.'}
          ${_habitsFilter === 'all' ? '<button class="btn btn-primary" style="margin-top:12px;display:block;margin-left:auto;margin-right:auto" onclick="openNewHabitModal()">+ Criar primeiro hábito</button>' : ''}
        </div>`;
        return;
      }
      listEl.innerHTML = habits.map(h => {
        const isDone = h.completedToday;
        const streakColor = h.streak >= 7 ? 'var(--amber)' : h.streak >= 3 ? 'var(--green)' : 'var(--text-muted)';
        return `<div class="habit-item ${isDone ? 'done' : ''}" data-id="${h.id}" style="border-left:3px solid ${h.color || 'var(--accent)'}">
          <div class="habit-check" onclick="toggleHabitReal('${h.id}', this.parentElement)" style="cursor:pointer">${isDone ? '<i data-lucide="check" class="pg-icon" aria-hidden="true"></i>' : ''}</div>
          <div style="flex:1;cursor:pointer" onclick="openHabitDetail('${h.id}')">
            <div class="habit-name">${h.title}</div>
            <div style="font-size:11px;color:var(--text-muted)">${h.frequency || 'daily'} · ${h.category || 'general'} ${h.reminderEnabled ? '· 🔔 ' + (h.reminderTime || '') : ''}</div>
          </div>
          <span class="habit-streak" style="color:${streakColor}"><i data-lucide="flame" class="pg-icon" aria-hidden="true"></i> ${h.streak || 0}d</span>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="openEditHabitModal(${JSON.stringify(h).replace(/"/g,'&quot;')})"><i data-lucide="pencil" class="pg-icon" aria-hidden="true"></i></button>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;color:var(--red)" onclick="deleteHabit('${h.id}')">✕</button>
        </div>`;
      }).join('');
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      if (listEl) listEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Erro ao carregar hábitos.</div>';
    }
  }"""

if old_load_habits in content:
    content = content.replace(old_load_habits, new_load_habits, 1)
    print("✓ loadHabits replaced")
else:
    print("✗ loadHabits NOT found")

# ── 4. Substituir loadGoals com versão completa ──
old_load_goals = """  // ── loadGoals: carrega metas reais ────────────────────────────────────
  async function loadGoals() {
    const gridEl = document.getElementById('goals-grid');
    if (!gridEl) return;
    try {
      const data = await apiFetch('/api/goals');
      const goals = data.goals || [];
      if (!goals.length) {
        gridEl.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;padding:40px 20px">
          <div style="font-size:48px;margin-bottom:16px">🎯</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px">Nenhuma meta cadastrada</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">Defina seus objetivos e acompanhe o progresso</div>
          <button class="btn btn-primary" onclick="openNewGoalModal()">+ Criar primeira meta</button>
        </div>`;
        return;
      }
      const gradients = [
        'linear-gradient(90deg,var(--accent),#06B6D4)',
        'linear-gradient(90deg,var(--amber),#FCD34D)',
        'linear-gradient(90deg,var(--green),#34D399)',
        'linear-gradient(90deg,var(--purple),#C4B5FD)',
        'linear-gradient(90deg,var(--pink),#F9A8D4)',
      ];
      gridEl.innerHTML = goals.map((g, i) => `
        <div class="card">
          <div style="font-size:24px;margin-bottom:12px"><i data-lucide="${g.icon || 'target'}" class="pg-icon" aria-hidden="true"></i></div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">${g.title}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">${g.description || ''} ${g.targetDate ? '· Prazo: ' + new Date(g.targetDate).toLocaleDateString('pt-BR', {month:'short',year:'numeric'}) : ''}</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${g.progress || 0}%;background:${gradients[i % gradients.length]}"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--text-muted)">
            <span>${g.progress || 0}%</span>
            <span>${g.status === 'done' ? '✅ Concluída' : g.status === 'paused' ? '⏸ Pausada' : 'Em andamento'}</span>
          </div>
        </div>`).join('');
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      /* warn handled */
      if (gridEl) gridEl.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">Erro ao carregar metas.</div>';
    }
  }"""

new_load_goals = """  // ── loadGoals: carrega metas reais com KPIs, filtros e ações ─────────
  async function loadGoals() {
    const gridEl = document.getElementById('goals-grid');
    if (!gridEl) return;
    try {
      let url = '/api/goals';
      if (_goalsFilter && _goalsFilter !== 'all') url += '?status=' + _goalsFilter;
      const data = await apiFetch(url);
      const goals = data.goals || [];
      // KPIs (sempre usa todos os dados)
      const allData = await apiFetch('/api/goals?view=stats').catch(() => ({ stats: {} }));
      const stats = allData.stats || {};
      const setKpi = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setKpi('goals-kpi-total', stats.total ?? '—');
      setKpi('goals-kpi-active', stats.active ?? '—');
      setKpi('goals-kpi-done', stats.done ?? '—');
      setKpi('goals-kpi-avg', stats.avgProgress !== undefined ? stats.avgProgress + '%' : '—');
      if (!goals.length) {
        gridEl.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;padding:40px 20px">
          <div style="font-size:48px;margin-bottom:16px">🎯</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px">Nenhuma meta ${_goalsFilter !== 'all' ? 'nesta categoria' : 'cadastrada'}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">Defina seus objetivos e acompanhe o progresso</div>
          ${_goalsFilter === 'all' ? '<button class="btn btn-primary" onclick="openNewGoalModal()">+ Criar primeira meta</button>' : ''}
        </div>`;
        return;
      }
      const statusColors = { active: 'var(--accent)', done: 'var(--green)', paused: 'var(--amber)', cancelled: 'var(--red)' };
      const statusLabels = { active: 'Em andamento', done: '✅ Concluída', paused: '⏸ Pausada', cancelled: '❌ Cancelada' };
      gridEl.innerHTML = goals.map(g => {
        const subtaskCount = (g.subtasks || []).length;
        const subtaskDone = (g.subtasks || []).filter(s => s.done).length;
        const milestoneCount = (g.milestones || []).length;
        const milestoneDone = (g.milestones || []).filter(m => m.done).length;
        return `<div class="card" style="cursor:pointer;border-left:3px solid ${g.color || statusColors[g.status] || 'var(--accent)'}" onclick="openGoalDetail('${g.id}')">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:15px;font-weight:700;flex:1">${g.title}</div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost" style="font-size:11px;padding:2px 6px" onclick="event.stopPropagation();openEditGoalModal(${JSON.stringify(g).replace(/"/g,'&quot;')})"><i data-lucide="pencil" class="pg-icon" aria-hidden="true"></i></button>
              <button class="btn btn-ghost" style="font-size:11px;padding:2px 6px;color:var(--red)" onclick="event.stopPropagation();deleteGoal('${g.id}')">✕</button>
            </div>
          </div>
          ${g.description ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">${g.description.slice(0,80)}${g.description.length > 80 ? '...' : ''}</div>` : ''}
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:6px">
            <span>${statusLabels[g.status] || g.status}</span>
            <span>${g.targetDate ? '📅 ' + new Date(g.targetDate + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit',month:'short',year:'numeric'}) : ''}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${g.progress || 0}%;background:${g.color || 'var(--accent)'}"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--text-muted)">
            <span>${g.progress || 0}% concluído</span>
            <span>${subtaskCount > 0 ? subtaskDone + '/' + subtaskCount + ' subtarefas' : ''} ${milestoneCount > 0 ? '· ' + milestoneDone + '/' + milestoneCount + ' marcos' : ''}</span>
          </div>
        </div>`;
      }).join('');
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      if (gridEl) gridEl.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">Erro ao carregar metas.</div>';
    }
  }"""

if old_load_goals in content:
    content = content.replace(old_load_goals, new_load_goals, 1)
    print("✓ loadGoals replaced")
else:
    print("✗ loadGoals NOT found")

with open('/home/ubuntu/lifeos/premium_ui/app_dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File saved. Lines: {content.count(chr(10))}")
