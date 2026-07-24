with open('/home/ubuntu/lifeos/premium_ui/app_dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Inserir os modais após o fechamento do modal-invite
ANCHOR = """<div class="modal-overlay" id="modal-invite">
  <div class="modal-box">
    <div class="modal-header">
      <span class="modal-title"><i data-lucide="mail" class="pg-icon" aria-hidden="true"></i> Convidar Usuário</span>
      <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    </div>
    <div id="invite-status" style="display:none;padding:10px 14px;border-radius:var(--radius-md);margin-bottom:16px;font-size:13px"></div>
    <div class="form-group">
      <label class="form-label">Nome</label>
      <input type="text" class="form-input" id="invite-name" placeholder="Nome do convidado" />
    </div>
    <div class="form-group">
      <label class="form-label">E-mail</label>
      <input type="email" class="form-input" id="invite-email" placeholder="email@empresa.com" />
    </div>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="submitInvite()">Enviar Convite</button>
  </div>
</div>"""

NEW_MODALS = """<div class="modal-overlay" id="modal-invite">
  <div class="modal-box">
    <div class="modal-header">
      <span class="modal-title"><i data-lucide="mail" class="pg-icon" aria-hidden="true"></i> Convidar Usuário</span>
      <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    </div>
    <div id="invite-status" style="display:none;padding:10px 14px;border-radius:var(--radius-md);margin-bottom:16px;font-size:13px"></div>
    <div class="form-group">
      <label class="form-label">Nome</label>
      <input type="text" class="form-input" id="invite-name" placeholder="Nome do convidado" />
    </div>
    <div class="form-group">
      <label class="form-label">E-mail</label>
      <input type="email" class="form-input" id="invite-email" placeholder="email@empresa.com" />
    </div>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="submitInvite()">Enviar Convite</button>
  </div>
</div>

<!-- ─── MODAL: EVENTO ─── -->
<div class="modal-overlay" id="modal-event-form" style="display:none">
  <div class="modal-box" style="max-width:520px">
    <div class="modal-header">
      <span class="modal-title" id="ev-modal-title"><i data-lucide="calendar-plus" class="pg-icon" aria-hidden="true"></i> Novo Evento</span>
      <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    </div>
    <input type="hidden" id="ev-id" />
    <div id="ev-form-error" style="display:none;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid var(--red);border-radius:var(--radius-md);color:var(--red);font-size:12px;margin-bottom:12px"></div>
    <div class="form-group">
      <label class="form-label">Título *</label>
      <input type="text" class="form-input" id="ev-title" placeholder="Ex: Reunião de equipe" />
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Data *</label>
        <input type="date" class="form-input" id="ev-date" />
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select class="form-input" id="ev-category">
          <option value="personal">Pessoal</option>
          <option value="work">Trabalho</option>
          <option value="health">Saúde</option>
          <option value="finance">Finanças</option>
          <option value="social">Social</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Início</label>
        <input type="time" class="form-input" id="ev-time" />
      </div>
      <div class="form-group">
        <label class="form-label">Fim</label>
        <input type="time" class="form-input" id="ev-end-time" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Local</label>
      <input type="text" class="form-input" id="ev-location" placeholder="Ex: Sala de reuniões, Google Meet..." />
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-input" id="ev-description" rows="2" placeholder="Detalhes do evento..." style="resize:vertical"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Recorrência</label>
        <select class="form-input" id="ev-repeat">
          <option value="none">Sem recorrência</option>
          <option value="daily">Diário</option>
          <option value="weekly">Semanal</option>
          <option value="biweekly">Quinzenal</option>
          <option value="monthly">Mensal</option>
          <option value="yearly">Anual</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Lembrete</label>
        <select class="form-input" id="ev-reminder">
          <option value="0">Sem lembrete</option>
          <option value="5">5 min antes</option>
          <option value="15">15 min antes</option>
          <option value="30">30 min antes</option>
          <option value="60">1h antes</option>
          <option value="1440">1 dia antes</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Cor</label>
        <input type="color" class="form-input" id="ev-color" value="#6366F1" style="height:40px;padding:4px" />
      </div>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="ev-all-day" style="accent-color:var(--accent)" />
      <label for="ev-all-day" class="form-label" style="margin-bottom:0;cursor:pointer">Dia inteiro</label>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" style="flex:2;justify-content:center" id="ev-submit-btn" onclick="submitEventForm()">Criar evento</button>
    </div>
  </div>
</div>

<!-- ─── MODAL: HÁBITO ─── -->
<div class="modal-overlay" id="modal-habit-form" style="display:none">
  <div class="modal-box" style="max-width:480px">
    <div class="modal-header">
      <span class="modal-title" id="habit-modal-title"><i data-lucide="zap" class="pg-icon" aria-hidden="true"></i> Novo Hábito</span>
      <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    </div>
    <input type="hidden" id="habit-id" />
    <div id="habit-form-error" style="display:none;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid var(--red);border-radius:var(--radius-md);color:var(--red);font-size:12px;margin-bottom:12px"></div>
    <div class="form-group">
      <label class="form-label">Título *</label>
      <input type="text" class="form-input" id="habit-title" placeholder="Ex: Meditar 10 minutos" />
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-input" id="habit-description" rows="2" placeholder="Detalhes do hábito..." style="resize:vertical"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Frequência</label>
        <select class="form-input" id="habit-frequency">
          <option value="daily">Diário</option>
          <option value="weekdays">Dias úteis</option>
          <option value="weekends">Fins de semana</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select class="form-input" id="habit-category">
          <option value="general">Geral</option>
          <option value="health">Saúde</option>
          <option value="fitness">Fitness</option>
          <option value="mind">Mente</option>
          <option value="productivity">Produtividade</option>
          <option value="finance">Finanças</option>
          <option value="social">Social</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Cor</label>
        <input type="color" class="form-input" id="habit-color" value="#6366F1" style="height:40px;padding:4px" />
      </div>
      <div class="form-group">
        <label class="form-label">Horário do lembrete</label>
        <input type="time" class="form-input" id="habit-reminder-time" value="08:00" />
      </div>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="habit-reminder-enabled" style="accent-color:var(--accent)" />
      <label for="habit-reminder-enabled" class="form-label" style="margin-bottom:0;cursor:pointer">Ativar lembrete diário</label>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" style="flex:2;justify-content:center" id="habit-submit-btn" onclick="submitHabitForm()">Criar hábito</button>
    </div>
  </div>
</div>

<!-- ─── MODAL: DETALHE DO HÁBITO ─── -->
<div class="modal-overlay" id="modal-habit-detail" style="display:none">
  <div class="modal-box" style="max-width:560px">
    <div class="modal-header">
      <span class="modal-title"><i data-lucide="zap" class="pg-icon" aria-hidden="true"></i> Detalhes do Hábito</span>
      <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    </div>
    <div id="habit-detail-content"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-ghost" style="flex:1;justify-content:center;color:var(--red)" id="habit-detail-delete-btn">Excluir</button>
      <button class="btn btn-primary" style="flex:2;justify-content:center" id="habit-detail-edit-btn">Editar hábito</button>
    </div>
  </div>
</div>

<!-- ─── MODAL: META ─── -->
<div class="modal-overlay" id="modal-goal-form" style="display:none">
  <div class="modal-box" style="max-width:520px">
    <div class="modal-header">
      <span class="modal-title" id="goal-modal-title"><i data-lucide="target" class="pg-icon" aria-hidden="true"></i> Nova Meta</span>
      <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    </div>
    <input type="hidden" id="goal-id" />
    <div id="goal-form-error" style="display:none;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid var(--red);border-radius:var(--radius-md);color:var(--red);font-size:12px;margin-bottom:12px"></div>
    <div class="form-group">
      <label class="form-label">Título *</label>
      <input type="text" class="form-input" id="goal-title" placeholder="Ex: Ler 24 livros em 2025" />
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-input" id="goal-description" rows="2" placeholder="Descreva sua meta..." style="resize:vertical"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select class="form-input" id="goal-category">
          <option value="personal">Pessoal</option>
          <option value="career">Carreira</option>
          <option value="health">Saúde</option>
          <option value="finance">Finanças</option>
          <option value="education">Educação</option>
          <option value="relationships">Relacionamentos</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Prazo</label>
        <input type="date" class="form-input" id="goal-target-date" />
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Meta numérica</label>
        <input type="number" class="form-input" id="goal-target-value" placeholder="Ex: 24" min="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Unidade</label>
        <input type="text" class="form-input" id="goal-unit" placeholder="Ex: livros" />
      </div>
      <div class="form-group">
        <label class="form-label">Cor</label>
        <input type="color" class="form-input" id="goal-color" value="#6366F1" style="height:40px;padding:4px" />
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" style="flex:2;justify-content:center" id="goal-submit-btn" onclick="submitGoalForm()">Criar meta</button>
    </div>
  </div>
</div>

<!-- ─── MODAL: DETALHE DA META ─── -->
<div class="modal-overlay" id="modal-goal-detail" style="display:none">
  <div class="modal-box" style="max-width:600px">
    <div class="modal-header">
      <span class="modal-title"><i data-lucide="target" class="pg-icon" aria-hidden="true"></i> Detalhes da Meta</span>
      <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    </div>
    <div id="goal-detail-content" style="max-height:60vh;overflow-y:auto"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-ghost" style="flex:1;justify-content:center;color:var(--red)" id="goal-detail-delete-btn">Excluir</button>
      <button class="btn btn-primary" style="flex:2;justify-content:center" id="goal-detail-edit-btn">Editar meta</button>
    </div>
  </div>
</div>"""

if ANCHOR in content:
    content = content.replace(ANCHOR, NEW_MODALS, 1)
    print("✓ Modals inserted after modal-invite")
else:
    print("✗ ANCHOR not found")

with open('/home/ubuntu/lifeos/premium_ui/app_dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File saved. Lines: {content.count(chr(10))}")
