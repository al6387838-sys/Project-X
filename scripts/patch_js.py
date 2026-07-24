import re

with open('/home/ubuntu/lifeos/premium_ui/app_dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Substituir openNewEventModal (prompt-based) por modal rico ──
old_event_modal = '''  function openNewEventModal() {
    const today = new Date().toISOString().split('T')[0];
    const title = prompt('Título do evento:');
    if (!title) return;
    const time = prompt('Horário (ex: 14:30):', '09:00') || '09:00';
    const duration = prompt('Duração (ex: 1h):', '1h') || '1h';
    fetch('/api/events', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date: today, time, duration }),
    }).then(r => r.json()).then(d => {
      if (d.ok) { showToast('Evento criado!', 'success'); loadAgenda(); }
      else showToast(d.error || 'Erro ao criar evento', 'error');
    }).catch(() => showToast('Erro ao criar evento', 'error'));
  }'''

new_event_modal = '''  function openNewEventModal(prefillDate) {
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
  }'''

if old_event_modal in content:
    content = content.replace(old_event_modal, new_event_modal, 1)
    print("✓ openNewEventModal replaced")
else:
    print("✗ openNewEventModal NOT found - trying partial match")
    # Try to find and replace just the function
    idx = content.find("  function openNewEventModal()")
    if idx >= 0:
        print(f"  Found at index {idx}")
    else:
        print("  Not found at all")

# ── 2. Substituir openNewGoalModal (prompt-based) ──
old_goal_modal = '''  function openNewGoalModal() {
    const title = prompt('Título da meta:');
    if (!title) return;
    const description = prompt('Descrição (opcional):') || '';
    fetch('/api/goals', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    }).then(r => r.json()).then(d => {
      if (d.ok) { showToast('Meta criada!', 'success'); loadGoals(); }
      else showToast(d.error || 'Erro ao criar meta', 'error');
    }).catch(() => showToast('Erro ao criar meta', 'error'));
  }'''

new_goal_modal = '''  function openNewGoalModal() {
    document.getElementById('goal-modal-title').textContent = 'Nova Meta';
    document.getElementById('goal-id').value = '';
    document.getElementById('goal-title').value = '';
    document.getElementById('goal-description').value = '';
    document.getElementById('goal-category').value = 'personal';
    document.getElementById('goal-target-date').value = '';
    document.getElementById('goal-target-value').value = '';
    document.getElementById('goal-unit').value = '';
    document.getElementById('goal-color').value = '#6366F1';
    document.getElementById('goal-form-error').style.display = 'none';
    openModal('modal-goal-form');
  }
  function openEditGoalModal(g) {
    document.getElementById('goal-modal-title').textContent = 'Editar Meta';
    document.getElementById('goal-id').value = g.id || '';
    document.getElementById('goal-title').value = g.title || '';
    document.getElementById('goal-description').value = g.description || '';
    document.getElementById('goal-category').value = g.category || 'personal';
    document.getElementById('goal-target-date').value = g.targetDate || '';
    document.getElementById('goal-target-value').value = g.targetValue || '';
    document.getElementById('goal-unit').value = g.unit || '';
    document.getElementById('goal-color').value = g.color || '#6366F1';
    document.getElementById('goal-form-error').style.display = 'none';
    openModal('modal-goal-form');
  }
  async function submitGoalForm() {
    const id = document.getElementById('goal-id').value;
    const title = document.getElementById('goal-title').value.trim();
    if (!title) { document.getElementById('goal-form-error').textContent = 'Título obrigatório'; document.getElementById('goal-form-error').style.display = 'block'; return; }
    const payload = {
      title,
      description: document.getElementById('goal-description').value,
      category: document.getElementById('goal-category').value,
      targetDate: document.getElementById('goal-target-date').value,
      targetValue: document.getElementById('goal-target-value').value ? Number(document.getElementById('goal-target-value').value) : null,
      unit: document.getElementById('goal-unit').value,
      color: document.getElementById('goal-color').value,
    };
    const btn = document.getElementById('goal-submit-btn');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const method = id ? 'PUT' : 'POST';
      if (id) payload.id = id;
      const r = await fetch('/api/goals', { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (d.ok) { showToast(id ? 'Meta atualizada!' : 'Meta criada!', 'success'); closeModal(); loadGoals(); }
      else { document.getElementById('goal-form-error').textContent = d.error || 'Erro ao salvar'; document.getElementById('goal-form-error').style.display = 'block'; }
    } catch { document.getElementById('goal-form-error').textContent = 'Erro de conexão'; document.getElementById('goal-form-error').style.display = 'block'; }
    finally { btn.disabled = false; btn.textContent = id ? 'Salvar alterações' : 'Criar meta'; }
  }
  async function deleteGoal(id) {
    if (!confirm('Excluir esta meta?')) return;
    try {
      const r = await fetch('/api/goals?id=' + id, { method: 'DELETE', credentials: 'same-origin' });
      const d = await r.json();
      if (d.ok) { showToast('Meta excluída', 'success'); loadGoals(); }
      else showToast(d.error || 'Erro ao excluir', 'error');
    } catch { showToast('Erro ao excluir meta', 'error'); }
  }
  async function openGoalDetail(id) {
    try {
      const data = await apiFetch('/api/goals?id=' + id);
      if (!data.ok) { showToast('Erro ao carregar meta', 'error'); return; }
      const g = data.goal;
      const el = document.getElementById('goal-detail-content');
      if (!el) return;
      const subtaskHtml = (g.subtasks || []).map(s => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <input type="checkbox" ${s.done ? 'checked' : ''} style="accent-color:var(--accent)" onchange="toggleGoalSubtask('${g.id}','${s.id}',this.checked)" />
          <span style="font-size:13px${s.done ? ';text-decoration:line-through;color:var(--text-muted)' : ''}">${s.title}</span>
        </div>`).join('');
      const milestoneHtml = (g.milestones || []).map(m => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <input type="checkbox" ${m.done ? 'checked' : ''} style="accent-color:var(--accent)" onchange="toggleGoalMilestone('${g.id}','${m.id}',this.checked)" />
          <span style="font-size:13px${m.done ? ';text-decoration:line-through;color:var(--text-muted)' : ''}">${m.title}${m.date ? ' <span style=\'color:var(--text-muted);font-size:11px\'>· ' + new Date(m.date+'T12:00:00').toLocaleDateString('pt-BR') + '</span>' : ''}</span>
        </div>`).join('');
      const historyHtml = (g.history || []).slice(0,10).map(h => `
        <div style="font-size:11px;color:var(--text-muted);padding:3px 0">${new Date(h.at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} — ${h.action}</div>`).join('');
      el.innerHTML = `
        <div style="margin-bottom:16px">
          <div style="font-size:20px;font-weight:800;margin-bottom:4px">${g.title}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${g.description || ''}</div>
        </div>
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px"><span>Progresso</span><span>${g.progress || 0}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${g.progress || 0}%"></div></div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <input type="number" class="form-input" id="goal-detail-progress" value="${g.progress || 0}" min="0" max="100" style="width:80px;font-size:12px" placeholder="%" />
          <button class="btn btn-ghost" style="font-size:12px" onclick="updateGoalProgress('${g.id}')">Atualizar progresso</button>
          <button class="btn btn-ghost" style="font-size:12px" onclick="shareGoal('${g.id}')"><i data-lucide="share-2" class="pg-icon" aria-hidden="true"></i> Compartilhar</button>
        </div>
        ${g.subtasks && g.subtasks.length > 0 ? '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">Subtarefas</div>' + subtaskHtml + '</div>' : ''}
        ${g.milestones && g.milestones.length > 0 ? '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">Marcos</div>' + milestoneHtml + '</div>' : ''}
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <input type="text" class="form-input" id="goal-new-subtask" placeholder="Nova subtarefa..." style="flex:1;font-size:12px" />
          <button class="btn btn-ghost" style="font-size:12px" onclick="addGoalSubtask('${g.id}')">+ Subtarefa</button>
          <input type="text" class="form-input" id="goal-new-milestone" placeholder="Novo marco..." style="flex:1;font-size:12px" />
          <button class="btn btn-ghost" style="font-size:12px" onclick="addGoalMilestone('${g.id}')">+ Marco</button>
        </div>
        ${historyHtml ? '<div><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">Histórico</div>' + historyHtml + '</div>' : ''}
      `;
      document.getElementById('goal-detail-edit-btn').onclick = () => { closeModal(); openEditGoalModal(g); };
      document.getElementById('goal-detail-delete-btn').onclick = () => { closeModal(); deleteGoal(g.id); };
      if (window.lucide) lucide.createIcons();
      openModal('modal-goal-detail');
    } catch { showToast('Erro ao carregar detalhes da meta', 'error'); }
  }
  async function updateGoalProgress(id) {
    const val = Number(document.getElementById('goal-detail-progress')?.value);
    try {
      const r = await fetch('/api/goals', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update-progress', id, progress: val }) });
      const d = await r.json();
      if (d.ok) { showToast('Progresso atualizado!', 'success'); loadGoals(); openGoalDetail(id); }
      else showToast(d.error || 'Erro', 'error');
    } catch { showToast('Erro ao atualizar progresso', 'error'); }
  }
  async function addGoalSubtask(goalId) {
    const title = document.getElementById('goal-new-subtask')?.value?.trim();
    if (!title) return;
    try {
      const r = await fetch('/api/goals', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-subtask', id: goalId, subtaskTitle: title }) });
      const d = await r.json();
      if (d.ok) { showToast('Subtarefa adicionada!', 'success'); document.getElementById('goal-new-subtask').value = ''; openGoalDetail(goalId); loadGoals(); }
      else showToast(d.error || 'Erro', 'error');
    } catch { showToast('Erro ao adicionar subtarefa', 'error'); }
  }
  async function addGoalMilestone(goalId) {
    const title = document.getElementById('goal-new-milestone')?.value?.trim();
    if (!title) return;
    try {
      const r = await fetch('/api/goals', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-milestone', id: goalId, milestoneTitle: title }) });
      const d = await r.json();
      if (d.ok) { showToast('Marco adicionado!', 'success'); document.getElementById('goal-new-milestone').value = ''; openGoalDetail(goalId); loadGoals(); }
      else showToast(d.error || 'Erro', 'error');
    } catch { showToast('Erro ao adicionar marco', 'error'); }
  }
  async function toggleGoalSubtask(goalId, subtaskId, done) {
    try {
      const r = await fetch('/api/goals', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle-subtask', id: goalId, subtaskId }) });
      const d = await r.json();
      if (d.ok) { loadGoals(); openGoalDetail(goalId); }
    } catch { showToast('Erro ao atualizar subtarefa', 'error'); }
  }
  async function toggleGoalMilestone(goalId, milestoneId, done) {
    try {
      const r = await fetch('/api/goals', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle-milestone', id: goalId, milestoneId }) });
      const d = await r.json();
      if (d.ok) { loadGoals(); openGoalDetail(goalId); }
    } catch { showToast('Erro ao atualizar marco', 'error'); }
  }
  async function shareGoal(id) {
    try {
      const r = await fetch('/api/goals', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share', id }) });
      const d = await r.json();
      if (d.ok) { const url = window.location.origin + d.shareUrl; navigator.clipboard?.writeText(url).catch(() => {}); showToast('Link copiado: ' + url, 'success'); }
      else showToast(d.error || 'Erro ao compartilhar', 'error');
    } catch { showToast('Erro ao compartilhar meta', 'error'); }
  }
  let _goalsFilter = 'all';
  function goalsSetFilter(f) {
    _goalsFilter = f;
    ['all','active','done','paused'].forEach(s => {
      const btn = document.getElementById('goals-filter-' + s);
      if (btn) btn.style.background = s === f ? 'var(--accent-glow)' : '';
    });
    loadGoals();
  }'''

if old_goal_modal in content:
    content = content.replace(old_goal_modal, new_goal_modal, 1)
    print("✓ openNewGoalModal replaced")
else:
    print("✗ openNewGoalModal NOT found")

# ── 3. Substituir openNewHabitModal (prompt-based) ──
old_habit_modal = '''  function openNewHabitModal() {
    const title = prompt('Título do hábito:');
    if (!title) return;
    const frequency = prompt('Frequência (ex: daily, weekly):', 'daily') || 'daily';
    fetch('/api/habits', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, frequency }),
    }).then(r => r.json()).then(d => {
      if (d.ok) { showToast('Hábito criado!', 'success'); showPage('habits'); loadHabits(); }
      else showToast(d.error || 'Erro ao criar hábito', 'error');
    }).catch(() => showToast('Erro ao criar hábito', 'error'));
  }'''

new_habit_modal = '''  function openNewHabitModal() {
    document.getElementById('habit-modal-title').textContent = 'Novo Hábito';
    document.getElementById('habit-id').value = '';
    document.getElementById('habit-title').value = '';
    document.getElementById('habit-description').value = '';
    document.getElementById('habit-frequency').value = 'daily';
    document.getElementById('habit-category').value = 'general';
    document.getElementById('habit-color').value = '#6366F1';
    document.getElementById('habit-reminder-time').value = '08:00';
    document.getElementById('habit-reminder-enabled').checked = false;
    document.getElementById('habit-form-error').style.display = 'none';
    openModal('modal-habit-form');
  }
  function openEditHabitModal(h) {
    document.getElementById('habit-modal-title').textContent = 'Editar Hábito';
    document.getElementById('habit-id').value = h.id || '';
    document.getElementById('habit-title').value = h.title || '';
    document.getElementById('habit-description').value = h.description || '';
    document.getElementById('habit-frequency').value = h.frequency || 'daily';
    document.getElementById('habit-category').value = h.category || 'general';
    document.getElementById('habit-color').value = h.color || '#6366F1';
    document.getElementById('habit-reminder-time').value = h.reminderTime || '08:00';
    document.getElementById('habit-reminder-enabled').checked = Boolean(h.reminderEnabled);
    document.getElementById('habit-form-error').style.display = 'none';
    openModal('modal-habit-form');
  }
  async function submitHabitForm() {
    const id = document.getElementById('habit-id').value;
    const title = document.getElementById('habit-title').value.trim();
    if (!title) { document.getElementById('habit-form-error').textContent = 'Título obrigatório'; document.getElementById('habit-form-error').style.display = 'block'; return; }
    const payload = {
      title,
      description: document.getElementById('habit-description').value,
      frequency: document.getElementById('habit-frequency').value,
      category: document.getElementById('habit-category').value,
      color: document.getElementById('habit-color').value,
      reminderTime: document.getElementById('habit-reminder-time').value,
      reminderEnabled: document.getElementById('habit-reminder-enabled').checked,
    };
    const btn = document.getElementById('habit-submit-btn');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (id) {
        payload.action = 'edit'; payload.id = id;
        const r = await fetch('/api/habits', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (d.ok) { showToast('Hábito atualizado!', 'success'); closeModal(); loadHabits(); }
        else { document.getElementById('habit-form-error').textContent = d.error || 'Erro ao salvar'; document.getElementById('habit-form-error').style.display = 'block'; }
      } else {
        const r = await fetch('/api/habits', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (d.ok) { showToast('Hábito criado!', 'success'); closeModal(); showPage('habits'); loadHabits(); }
        else { document.getElementById('habit-form-error').textContent = d.error || 'Erro ao salvar'; document.getElementById('habit-form-error').style.display = 'block'; }
      }
    } catch { document.getElementById('habit-form-error').textContent = 'Erro de conexão'; document.getElementById('habit-form-error').style.display = 'block'; }
    finally { btn.disabled = false; btn.textContent = id ? 'Salvar alterações' : 'Criar hábito'; }
  }
  async function deleteHabit(id) {
    if (!confirm('Excluir este hábito?')) return;
    try {
      const r = await fetch('/api/habits?id=' + id, { method: 'DELETE', credentials: 'same-origin' });
      const d = await r.json();
      if (d.ok) { showToast('Hábito excluído', 'success'); loadHabits(); }
      else showToast(d.error || 'Erro ao excluir', 'error');
    } catch { showToast('Erro ao excluir hábito', 'error'); }
  }
  async function openHabitDetail(id) {
    try {
      const data = await apiFetch('/api/habits?id=' + id);
      if (!data.ok) { showToast('Erro ao carregar hábito', 'error'); return; }
      const h = data.habit;
      const stats = data.stats;
      const el = document.getElementById('habit-detail-content');
      if (!el) return;
      // Calendário dos últimos 28 dias
      const calDays = [];
      for (let i = 27; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        calDays.push({ date: ds, done: (h.completions || []).includes(ds), day: d.getDate() });
      }
      const calHtml = calDays.map(c => `<div title="${c.date}" style="width:20px;height:20px;border-radius:4px;background:${c.done ? 'var(--green)' : 'var(--border)'};display:inline-flex;align-items:center;justify-content:center;font-size:9px;color:${c.done ? '#fff' : 'var(--text-muted)'}">${c.day}</div>`).join('');
      const histHtml = (h.history || []).slice(0,10).map(hh => `<div style="font-size:11px;color:var(--text-muted);padding:2px 0">${new Date(hh.at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} — ${hh.action}</div>`).join('');
      el.innerHTML = `
        <div style="margin-bottom:16px">
          <div style="font-size:20px;font-weight:800;margin-bottom:4px">${h.title}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${h.description || ''}</div>
        </div>
        <div class="grid-4" style="margin-bottom:16px;gap:8px">
          <div class="card" style="padding:12px"><div class="card-title" style="font-size:10px">Streak</div><div style="font-size:22px;font-weight:800">${stats.streak}d</div></div>
          <div class="card" style="padding:12px"><div class="card-title" style="font-size:10px">Melhor</div><div style="font-size:22px;font-weight:800">${stats.bestStreak}d</div></div>
          <div class="card" style="padding:12px"><div class="card-title" style="font-size:10px">Total</div><div style="font-size:22px;font-weight:800">${stats.totalCompletions}</div></div>
          <div class="card" style="padding:12px"><div class="card-title" style="font-size:10px">Taxa 30d</div><div style="font-size:22px;font-weight:800">${stats.rate30}%</div></div>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">Calendário (28 dias)</div>
          <div style="display:flex;flex-wrap:wrap;gap:3px">${calHtml}</div>
        </div>
        ${histHtml ? '<div><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">Histórico</div>' + histHtml + '</div>' : ''}
      `;
      document.getElementById('habit-detail-edit-btn').onclick = () => { closeModal(); openEditHabitModal(h); };
      document.getElementById('habit-detail-delete-btn').onclick = () => { closeModal(); deleteHabit(h.id); };
      openModal('modal-habit-detail');
    } catch { showToast('Erro ao carregar detalhes do hábito', 'error'); }
  }
  let _habitsFilter = 'all';
  function habitsSetFilter(f) {
    _habitsFilter = f;
    ['all','pending','done'].forEach(s => {
      const btn = document.getElementById('habits-filter-' + s);
      if (btn) btn.style.background = s === f ? 'var(--accent-glow)' : '';
    });
    loadHabits();
  }'''

if old_habit_modal in content:
    content = content.replace(old_habit_modal, new_habit_modal, 1)
    print("✓ openNewHabitModal replaced")
else:
    print("✗ openNewHabitModal NOT found")

with open('/home/ubuntu/lifeos/premium_ui/app_dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File saved. Lines: {content.count(chr(10))}")
