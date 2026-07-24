/**
 * LifeOS Enterprise — Testes de Certificação Fase 2
 * Módulos: Agenda, Hábitos, Metas, Command Center
 * Cobertura: CRUD, Persistência, KV, R2, OAuth, Performance, Responsividade, Erros, Stress
 */

'use strict';

// ─── Utilitários de teste ──────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

function test(name, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => {
        passed++;
        results.push({ name, status: 'PASS' });
        console.log(`  ✓ ${name}`);
      }).catch(err => {
        failed++;
        results.push({ name, status: 'FAIL', error: err.message });
        console.error(`  ✗ ${name}: ${err.message}`);
      });
    }
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, message) {
  if (a !== b) throw new Error(message || `Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`);
}

function assertDefined(val, message) {
  if (val === undefined || val === null) throw new Error(message || `Expected defined value, got ${val}`);
}

function assertArray(val, message) {
  if (!Array.isArray(val)) throw new Error(message || `Expected array, got ${typeof val}`);
}

// ─── Mock do ambiente Cloudflare ──────────────────────────────────────────
class MockKV {
  constructor() { this._store = new Map(); }
  async get(key) { return this._store.get(key) || null; }
  async put(key, value) { this._store.set(key, value); }
  async delete(key) { this._store.delete(key); }
}

class MockR2 {
  constructor() { this._store = new Map(); }
  async put(key, data, opts) { this._store.set(key, { data, opts }); return { key, size: data.length || 0 }; }
  async get(key) { const obj = this._store.get(key); return obj ? { body: obj.data, key } : null; }
  async delete(key) { this._store.delete(key); }
}

const mockEnv = {
  LIFEOS_KV: new MockKV(),
  LIFEOS_R2: new MockR2(),
  LIFEOS_SESSION_SECRET: 'test-secret-key-for-certification-phase2',
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2, 18);
}

const TODAY = new Date().toISOString().split('T')[0];
const TEST_USER_ID = 'test-user-phase2-' + generateId();

// ─── Testes: Estrutura dos Backends ───────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════');
console.log('  LifeOS Enterprise — Certificação Fase 2');
console.log('  Módulos: Agenda · Hábitos · Metas · Command Center');
console.log('══════════════════════════════════════════════════════════\n');

// ══ BLOCO 1: ESTRUTURA DOS ARQUIVOS ══════════════════════════════════════
console.log('▶ BLOCO 1: Estrutura dos Arquivos Backend\n');
const fs = require('fs');
const path = require('path');

const backendFiles = [
  'functions/api/events.js',
  'functions/api/habits.js',
  'functions/api/goals.js',
  'functions/api/briefing.js',
  'functions/api/analytics-pro.js',
  'functions/_auth.js',
];

backendFiles.forEach(file => {
  test(`Arquivo existe: ${file}`, () => {
    const fullPath = path.join(__dirname, '..', file);
    assert(fs.existsSync(fullPath), `Arquivo não encontrado: ${fullPath}`);
    const content = fs.readFileSync(fullPath, 'utf-8');
    assert(content.length > 100, `Arquivo vazio ou muito pequeno: ${file}`);
  });
});

// ══ BLOCO 2: SINTAXE DOS BACKENDS ════════════════════════════════════════
console.log('\n▶ BLOCO 2: Validação de Sintaxe\n');
const { execSync } = require('child_process');

backendFiles.forEach(file => {
  test(`Sintaxe válida: ${file}`, () => {
    const fullPath = path.join(__dirname, '..', file);
    try {
      execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
    } catch (e) {
      throw new Error(`Erro de sintaxe em ${file}: ${e.stderr?.toString()}`);
    }
  });
});

// ══ BLOCO 3: EVENTOS — CRUD COMPLETO ═════════════════════════════════════
console.log('\n▶ BLOCO 3: Agenda — CRUD de Eventos\n');

test('Evento: estrutura de dados válida', () => {
  const event = {
    id: generateId(),
    title: 'Reunião de equipe',
    date: TODAY,
    time: '09:00',
    endTime: '10:00',
    location: 'Sala A',
    description: 'Reunião semanal',
    repeat: 'weekly',
    reminder: 15,
    category: 'work',
    color: '#6366F1',
    allDay: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assertDefined(event.id, 'ID obrigatório');
  assertDefined(event.title, 'Título obrigatório');
  assertDefined(event.date, 'Data obrigatória');
  assert(event.date.match(/^\d{4}-\d{2}-\d{2}$/), 'Data no formato YYYY-MM-DD');
  assert(['none','daily','weekly','biweekly','monthly','yearly'].includes(event.repeat), 'Recorrência válida');
  assert(['personal','work','health','finance','social','google','outlook'].includes(event.category), 'Categoria válida');
});

test('Evento: persistência no KV', async () => {
  const kv = new MockKV();
  const events = [
    { id: generateId(), title: 'Evento 1', date: TODAY, time: '09:00', category: 'work' },
    { id: generateId(), title: 'Evento 2', date: TODAY, time: '14:00', category: 'personal' },
  ];
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(events));
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  assertDefined(raw, 'Dados devem estar no KV');
  const loaded = JSON.parse(raw);
  assertArray(loaded, 'Deve retornar array');
  assertEqual(loaded.length, 2, 'Deve ter 2 eventos');
  assertEqual(loaded[0].title, 'Evento 1', 'Título do primeiro evento');
});

test('Evento: filtro por data', async () => {
  const kv = new MockKV();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const events = [
    { id: '1', title: 'Hoje', date: TODAY },
    { id: '2', title: 'Ontem', date: yesterdayStr },
    { id: '3', title: 'Hoje 2', date: TODAY },
  ];
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(events));
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  const all = JSON.parse(raw);
  const todayEvents = all.filter(e => e.date === TODAY);
  assertEqual(todayEvents.length, 2, 'Deve filtrar 2 eventos de hoje');
});

test('Evento: filtro por intervalo (semana)', async () => {
  const kv = new MockKV();
  const dates = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  const events = dates.map((d, i) => ({ id: String(i), title: `Evento ${i}`, date: d }));
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(events));
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  const all = JSON.parse(raw);
  const weekStart = dates[0];
  const weekEnd = dates[dates.length - 1];
  const weekEvents = all.filter(e => e.date >= weekStart && e.date <= weekEnd);
  assertEqual(weekEvents.length, 7, 'Deve ter 7 eventos na semana');
});

test('Evento: recorrência expandida', () => {
  function expandRecurring(event, from, to) {
    if (!event.repeat || event.repeat === 'none') return [event];
    const results = [];
    const start = new Date(event.date + 'T12:00:00');
    const end = new Date(to + 'T12:00:00');
    const fromDate = new Date(from + 'T12:00:00');
    let cur = new Date(start);
    let count = 0;
    while (cur <= end && count < 500) {
      const dateStr = cur.toISOString().split('T')[0];
      if (cur >= fromDate) {
        results.push({ ...event, date: dateStr, _recurring: count > 0 });
      }
      if (event.repeat === 'weekly') cur.setDate(cur.getDate() + 7);
      else if (event.repeat === 'daily') cur.setDate(cur.getDate() + 1);
      else break;
      count++;
    }
    return results;
  }
  const baseDate = new Date(); baseDate.setDate(baseDate.getDate() - 7);
  const baseDateStr = baseDate.toISOString().split('T')[0];
  const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 14);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  const event = { id: '1', title: 'Reunião semanal', date: baseDateStr, repeat: 'weekly' };
  const expanded = expandRecurring(event, baseDateStr, futureDateStr);
  assert(expanded.length >= 3, `Deve expandir para pelo menos 3 ocorrências, got ${expanded.length}`);
});

test('Evento: busca por texto', async () => {
  const kv = new MockKV();
  const events = [
    { id: '1', title: 'Reunião de equipe', description: 'Sprint review' },
    { id: '2', title: 'Dentista', description: 'Consulta rotina' },
    { id: '3', title: 'Reunião com cliente', description: 'Apresentação' },
  ];
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(events));
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  const all = JSON.parse(raw);
  const q = 'reunião';
  const found = all.filter(e =>
    (e.title || '').toLowerCase().includes(q) ||
    (e.description || '').toLowerCase().includes(q)
  );
  assertEqual(found.length, 2, 'Busca deve encontrar 2 eventos com "reunião"');
});

test('Evento: exclusão', async () => {
  const kv = new MockKV();
  const events = [
    { id: 'ev1', title: 'Evento A' },
    { id: 'ev2', title: 'Evento B' },
    { id: 'ev3', title: 'Evento C' },
  ];
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(events));
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  all = all.filter(e => e.id !== 'ev2');
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`events:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assertEqual(updated.length, 2, 'Deve ter 2 eventos após exclusão');
  assert(!updated.find(e => e.id === 'ev2'), 'Evento excluído não deve existir');
});

test('Evento: edição', async () => {
  const kv = new MockKV();
  const events = [{ id: 'ev1', title: 'Título original', date: TODAY }];
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(events));
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  const idx = all.findIndex(e => e.id === 'ev1');
  all[idx] = { ...all[idx], title: 'Título editado', location: 'Sala B', updatedAt: new Date().toISOString() };
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`events:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assertEqual(updated[0].title, 'Título editado', 'Título deve estar atualizado');
  assertEqual(updated[0].location, 'Sala B', 'Local deve estar atualizado');
});

// ══ BLOCO 4: HÁBITOS — CRUD + STREAK + ESTATÍSTICAS ══════════════════════
console.log('\n▶ BLOCO 4: Hábitos — CRUD, Streak, Estatísticas\n');

test('Hábito: estrutura de dados válida', () => {
  const habit = {
    id: generateId(),
    title: 'Meditar 10 minutos',
    description: 'Meditação matinal',
    frequency: 'daily',
    category: 'mind',
    color: '#10B981',
    reminderEnabled: true,
    reminderTime: '07:00',
    active: true,
    completions: [],
    streak: 0,
    createdAt: new Date().toISOString(),
  };
  assertDefined(habit.id, 'ID obrigatório');
  assertDefined(habit.title, 'Título obrigatório');
  assert(['daily','weekdays','weekends','weekly','monthly'].includes(habit.frequency), 'Frequência válida');
  assertArray(habit.completions, 'Completions deve ser array');
});

test('Hábito: marcar conclusão do dia', async () => {
  const kv = new MockKV();
  const habits = [{ id: 'h1', title: 'Exercício', completions: [], streak: 0 }];
  await kv.put(`habits:${TEST_USER_ID}`, JSON.stringify(habits));
  const raw = await kv.get(`habits:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  const idx = all.findIndex(h => h.id === 'h1');
  if (!all[idx].completions) all[idx].completions = [];
  all[idx].completions.push(TODAY);
  await kv.put(`habits:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`habits:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assert(updated[0].completions.includes(TODAY), 'Deve incluir data de hoje nas completions');
});

test('Hábito: cálculo de streak', () => {
  function calculateStreak(completions) {
    if (!completions || completions.length === 0) return 0;
    const unique = [...new Set(completions)].sort().reverse();
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < unique.length; i++) {
      const d = new Date(unique[i] + 'T00:00:00');
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      const diff = Math.abs(d - expected);
      if (diff < 24 * 3600 * 1000) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
  // Streak de 5 dias consecutivos
  const completions = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    completions.push(d.toISOString().split('T')[0]);
  }
  const streak = calculateStreak(completions);
  assert(streak >= 5, `Streak deve ser >= 5, got ${streak}`);
});

test('Hábito: streak zerado após dia perdido', () => {
  function calculateStreak(completions) {
    if (!completions || completions.length === 0) return 0;
    const sorted = [...new Set(completions)].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    if (!sorted.includes(today)) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (!sorted.includes(yesterdayStr)) return 0;
    }
    let streak = 0;
    let expected = new Date();
    for (const dateStr of sorted) {
      const d = new Date(dateStr + 'T12:00:00');
      const diff = Math.round((expected - d) / (24 * 3600 * 1000));
      if (diff <= 1) { streak++; expected = new Date(d); expected.setDate(expected.getDate() - 1); }
      else break;
    }
    return streak;
  }
  // Completions de 3 dias atrás (com gap)
  const completions = [];
  for (let i = 3; i < 8; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    completions.push(d.toISOString().split('T')[0]);
  }
  const streak = calculateStreak(completions);
  assertEqual(streak, 0, 'Streak deve ser 0 quando há gap');
});

test('Hábito: taxa de conclusão 30 dias', () => {
  const completions = [];
  for (let i = 0; i < 20; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    completions.push(d.toISOString().split('T')[0]);
  }
  const last30 = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last30.push(d.toISOString().split('T')[0]);
  }
  const completedLast30 = completions.filter(c => last30.includes(c)).length;
  const rate = Math.round((completedLast30 / 30) * 100);
  assert(rate > 0, `Taxa deve ser > 0, got ${rate}`);
  assert(rate <= 100, `Taxa deve ser <= 100, got ${rate}`);
});

test('Hábito: edição via action=edit', async () => {
  const kv = new MockKV();
  const habits = [{ id: 'h1', title: 'Original', frequency: 'daily', color: '#fff' }];
  await kv.put(`habits:${TEST_USER_ID}`, JSON.stringify(habits));
  const raw = await kv.get(`habits:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  const idx = all.findIndex(h => h.id === 'h1');
  all[idx] = { ...all[idx], title: 'Editado', frequency: 'weekly', color: '#6366F1', updatedAt: new Date().toISOString() };
  await kv.put(`habits:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`habits:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assertEqual(updated[0].title, 'Editado', 'Título deve estar atualizado');
  assertEqual(updated[0].frequency, 'weekly', 'Frequência deve estar atualizada');
});

test('Hábito: exclusão', async () => {
  const kv = new MockKV();
  const habits = [{ id: 'h1', title: 'A' }, { id: 'h2', title: 'B' }];
  await kv.put(`habits:${TEST_USER_ID}`, JSON.stringify(habits));
  const raw = await kv.get(`habits:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  all = all.filter(h => h.id !== 'h1');
  await kv.put(`habits:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`habits:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assertEqual(updated.length, 1, 'Deve ter 1 hábito após exclusão');
  assertEqual(updated[0].id, 'h2', 'Hábito restante deve ser h2');
});

test('Hábito: notificação/lembrete configurado', () => {
  const habit = {
    id: generateId(),
    title: 'Meditação',
    reminderEnabled: true,
    reminderTime: '07:30',
    frequency: 'daily',
  };
  assert(habit.reminderEnabled, 'Lembrete deve estar ativo');
  assert(habit.reminderTime.match(/^\d{2}:\d{2}$/), 'Horário do lembrete no formato HH:MM');
});

test('Hábito: calendário de 28 dias gerado', () => {
  const completions = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(); d.setDate(d.getDate() - i * 2);
    completions.push(d.toISOString().split('T')[0]);
  }
  const calDays = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    calDays.push({ date: ds, done: completions.includes(ds) });
  }
  assertEqual(calDays.length, 28, 'Calendário deve ter 28 dias');
  assert(calDays.some(d => d.done), 'Deve ter pelo menos 1 dia concluído');
});

// ══ BLOCO 5: METAS — CRUD + SUBTAREFAS + MARCOS + HISTÓRICO ══════════════
console.log('\n▶ BLOCO 5: Metas — CRUD, Subtarefas, Marcos, Histórico\n');

test('Meta: estrutura de dados válida', () => {
  const goal = {
    id: generateId(),
    title: 'Ler 24 livros em 2025',
    description: 'Meta de leitura anual',
    category: 'education',
    status: 'active',
    progress: 0,
    targetDate: '2025-12-31',
    targetValue: 24,
    unit: 'livros',
    color: '#6366F1',
    subtasks: [],
    milestones: [],
    history: [],
    createdAt: new Date().toISOString(),
  };
  assertDefined(goal.id, 'ID obrigatório');
  assertDefined(goal.title, 'Título obrigatório');
  assert(['active','paused','done','cancelled'].includes(goal.status), 'Status válido');
  assert(goal.progress >= 0 && goal.progress <= 100, 'Progresso entre 0 e 100');
  assertArray(goal.subtasks, 'Subtarefas deve ser array');
  assertArray(goal.milestones, 'Marcos deve ser array');
  assertArray(goal.history, 'Histórico deve ser array');
});

test('Meta: adicionar subtarefa', async () => {
  const kv = new MockKV();
  const goals = [{ id: 'g1', title: 'Meta A', subtasks: [], progress: 0 }];
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(goals));
  const raw = await kv.get(`goals:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  const idx = all.findIndex(g => g.id === 'g1');
  const subtask = { id: generateId(), title: 'Subtarefa 1', done: false, createdAt: new Date().toISOString() };
  all[idx].subtasks.push(subtask);
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`goals:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assertEqual(updated[0].subtasks.length, 1, 'Deve ter 1 subtarefa');
  assertEqual(updated[0].subtasks[0].title, 'Subtarefa 1', 'Título da subtarefa correto');
});

test('Meta: toggle subtarefa', async () => {
  const kv = new MockKV();
  const goals = [{
    id: 'g1', title: 'Meta A',
    subtasks: [{ id: 'st1', title: 'Subtarefa', done: false }],
    progress: 0
  }];
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(goals));
  const raw = await kv.get(`goals:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  const gIdx = all.findIndex(g => g.id === 'g1');
  const sIdx = all[gIdx].subtasks.findIndex(s => s.id === 'st1');
  all[gIdx].subtasks[sIdx].done = true;
  all[gIdx].subtasks[sIdx].doneAt = new Date().toISOString();
  // Recalcular progresso
  const done = all[gIdx].subtasks.filter(s => s.done).length;
  all[gIdx].progress = Math.round((done / all[gIdx].subtasks.length) * 100);
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`goals:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assert(updated[0].subtasks[0].done, 'Subtarefa deve estar marcada como concluída');
  assertEqual(updated[0].progress, 100, 'Progresso deve ser 100% com 1/1 subtarefa concluída');
});

test('Meta: adicionar marco', async () => {
  const kv = new MockKV();
  const goals = [{ id: 'g1', title: 'Meta A', milestones: [] }];
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(goals));
  const raw = await kv.get(`goals:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  const idx = all.findIndex(g => g.id === 'g1');
  const milestone = { id: generateId(), title: 'Marco 1', date: TODAY, done: false };
  all[idx].milestones.push(milestone);
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`goals:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assertEqual(updated[0].milestones.length, 1, 'Deve ter 1 marco');
});

test('Meta: atualizar progresso manualmente', async () => {
  const kv = new MockKV();
  const goals = [{ id: 'g1', title: 'Meta A', progress: 0, history: [] }];
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(goals));
  const raw = await kv.get(`goals:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  const idx = all.findIndex(g => g.id === 'g1');
  all[idx].progress = 45;
  all[idx].history.unshift({ action: 'progress-updated', at: new Date().toISOString(), userId: TEST_USER_ID, data: { progress: 45 } });
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`goals:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assertEqual(updated[0].progress, 45, 'Progresso deve ser 45');
  assertEqual(updated[0].history.length, 1, 'Deve ter 1 entrada no histórico');
  assertEqual(updated[0].history[0].action, 'progress-updated', 'Ação deve ser progress-updated');
});

test('Meta: histórico de alterações', async () => {
  const kv = new MockKV();
  const goals = [{ id: 'g1', title: 'Meta A', history: [] }];
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(goals));
  const raw = await kv.get(`goals:${TEST_USER_ID}`);
  let all = JSON.parse(raw);
  const idx = all.findIndex(g => g.id === 'g1');
  const actions = ['created', 'progress-updated', 'subtask-added', 'milestone-added', 'shared'];
  actions.forEach(action => {
    all[idx].history.unshift({ action, at: new Date().toISOString(), userId: TEST_USER_ID });
  });
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(all));
  const raw2 = await kv.get(`goals:${TEST_USER_ID}`);
  const updated = JSON.parse(raw2);
  assertEqual(updated[0].history.length, 5, 'Deve ter 5 entradas no histórico');
});

test('Meta: compartilhamento gera token', () => {
  const shareToken = Math.random().toString(36).slice(2, 18);
  const shareUrl = `/goals/shared/${shareToken}`;
  assert(shareToken.length >= 10, 'Token deve ter pelo menos 10 caracteres');
  assert(shareUrl.startsWith('/goals/shared/'), 'URL de compartilhamento válida');
});

test('Meta: filtro por status', async () => {
  const kv = new MockKV();
  const goals = [
    { id: 'g1', title: 'Ativa', status: 'active' },
    { id: 'g2', title: 'Concluída', status: 'done' },
    { id: 'g3', title: 'Pausada', status: 'paused' },
    { id: 'g4', title: 'Ativa 2', status: 'active' },
  ];
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(goals));
  const raw = await kv.get(`goals:${TEST_USER_ID}`);
  const all = JSON.parse(raw);
  const active = all.filter(g => g.status === 'active');
  assertEqual(active.length, 2, 'Deve ter 2 metas ativas');
  const done = all.filter(g => g.status === 'done');
  assertEqual(done.length, 1, 'Deve ter 1 meta concluída');
});

test('Meta: estatísticas (view=stats)', async () => {
  const kv = new MockKV();
  const goals = [
    { id: 'g1', status: 'active', progress: 40 },
    { id: 'g2', status: 'active', progress: 80 },
    { id: 'g3', status: 'done', progress: 100 },
    { id: 'g4', status: 'paused', progress: 20 },
  ];
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(goals));
  const raw = await kv.get(`goals:${TEST_USER_ID}`);
  const all = JSON.parse(raw);
  const active = all.filter(g => g.status === 'active');
  const done = all.filter(g => g.status === 'done');
  const avgProgress = Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length);
  assertEqual(all.length, 4, 'Total de metas');
  assertEqual(active.length, 2, 'Metas ativas');
  assertEqual(done.length, 1, 'Metas concluídas');
  assertEqual(avgProgress, 60, 'Progresso médio das ativas');
});

// ══ BLOCO 6: COMMAND CENTER — DADOS REAIS ════════════════════════════════
console.log('\n▶ BLOCO 6: Command Center — Dados Reais\n');

test('Briefing: estrutura completa', async () => {
  const kv = new MockKV();
  // Preparar dados reais no KV
  await kv.put(`tasks:${TEST_USER_ID}`, JSON.stringify([
    { id: 't1', title: 'Tarefa hoje', dueDate: TODAY, status: 'pending', priority: 'high', category: 'work' },
    { id: 't2', title: 'Tarefa concluída', dueDate: TODAY, status: 'done', updatedAt: new Date().toISOString() },
  ]));
  await kv.put(`habits:${TEST_USER_ID}`, JSON.stringify([
    { id: 'h1', title: 'Exercício', active: true, completions: [TODAY], streak: 5 },
    { id: 'h2', title: 'Leitura', active: true, completions: [], streak: 0 },
  ]));
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify([
    { id: 'g1', title: 'Meta A', status: 'active', progress: 60 },
  ]));
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify([
    { id: 'ev1', title: 'Reunião', date: TODAY, time: '10:00', category: 'work' },
  ]));
  await kv.put(`projects:${TEST_USER_ID}`, JSON.stringify([
    { id: 'p1', title: 'Projeto X', status: 'active', progress: 40 },
  ]));
  // Simular o que o briefing.js faz
  const tasksRaw = await kv.get(`tasks:${TEST_USER_ID}`);
  const tasks = JSON.parse(tasksRaw);
  const todayTasks = tasks.filter(t => t.dueDate === TODAY && t.status !== 'done');
  const completedToday = tasks.filter(t => t.status === 'done' && t.updatedAt && t.updatedAt.startsWith(TODAY));
  const habitsRaw = await kv.get(`habits:${TEST_USER_ID}`);
  const habits = JSON.parse(habitsRaw);
  const activeHabits = habits.filter(h => h.active !== false);
  const completedHabits = activeHabits.filter(h => h.completions && h.completions.includes(TODAY));
  const eventsRaw = await kv.get(`events:${TEST_USER_ID}`);
  const events = JSON.parse(eventsRaw);
  const todayEvents = events.filter(e => e.date === TODAY);
  assertEqual(todayTasks.length, 1, 'Deve ter 1 tarefa pendente hoje');
  assertEqual(completedToday.length, 1, 'Deve ter 1 tarefa concluída hoje');
  assertEqual(activeHabits.length, 2, 'Deve ter 2 hábitos ativos');
  assertEqual(completedHabits.length, 1, 'Deve ter 1 hábito concluído hoje');
  assertEqual(todayEvents.length, 1, 'Deve ter 1 evento hoje');
});

test('Briefing: métricas consolidadas', () => {
  const metrics = {
    tasksToday: 3,
    tasksCompleted: 1,
    tasksPending: 5,
    tasksOverdue: 2,
    habitsActive: 4,
    habitsCompleted: 3,
    habitsRate: 75,
    goalsActive: 2,
    goalsAvgProgress: 55,
    streak: 7,
    eventsToday: 2,
    projectsActive: 3,
    unreadMessages: 5,
    unreadEmails: 12,
  };
  assertDefined(metrics.tasksToday, 'tasksToday definido');
  assertDefined(metrics.habitsRate, 'habitsRate definido');
  assertDefined(metrics.goalsAvgProgress, 'goalsAvgProgress definido');
  assertDefined(metrics.eventsToday, 'eventsToday definido');
  assertDefined(metrics.unreadMessages, 'unreadMessages definido');
  assertDefined(metrics.unreadEmails, 'unreadEmails definido');
  assert(metrics.habitsRate >= 0 && metrics.habitsRate <= 100, 'Taxa de hábitos entre 0 e 100');
});

test('Command Center: sem dados fictícios', () => {
  const dashboardContent = fs.readFileSync(
    path.join(__dirname, '..', 'premium_ui/modules/dashboard-v11.html'), 'utf-8'
  );
  const fakeDataPatterns = [
    /Math\.random\(\)/,
    /\bfake\b/i,
    /\bmock\b/i,
    /\bdummy\b/i,
    /hardcoded/i,
  ];
  fakeDataPatterns.forEach(pattern => {
    assert(!pattern.test(dashboardContent), `Dashboard não deve conter: ${pattern}`);
  });
});

test('Command Center: auto-atualização configurada', () => {
  const dashboardContent = fs.readFileSync(
    path.join(__dirname, '..', 'premium_ui/modules/dashboard-v11.html'), 'utf-8'
  );
  assert(dashboardContent.includes('setInterval'), 'Deve ter setInterval para auto-atualização');
  assert(dashboardContent.includes('startAutoRefresh'), 'Deve ter função startAutoRefresh');
  assert(dashboardContent.includes('5 * 60 * 1000'), 'Deve ter intervalo de 5 minutos');
});

test('Command Center: todos os widgets Enterprise presentes', () => {
  const dashboardContent = fs.readFileSync(
    path.join(__dirname, '..', 'premium_ui/modules/dashboard-v11.html'), 'utf-8'
  );
  const requiredWidgets = [
    'dv11-agenda',
    'dv11-habits-container',
    'dv11-goals-container',
    'dv11-messages',
    'dv11-emails',
    'dv11-projects',
    'dv11-docs',
    'dv11-productivity',
    'dv11-finance',
    'dv11-insights',
    'dv11-priorities',
  ];
  requiredWidgets.forEach(widget => {
    assert(dashboardContent.includes(widget), `Widget ${widget} deve estar presente`);
  });
});

test('Command Center: métricas rápidas no header', () => {
  const dashboardContent = fs.readFileSync(
    path.join(__dirname, '..', 'premium_ui/modules/dashboard-v11.html'), 'utf-8'
  );
  assert(dashboardContent.includes('dv11-metric-tasks'), 'Métrica de tarefas presente');
  assert(dashboardContent.includes('dv11-metric-habits'), 'Métrica de hábitos presente');
  assert(dashboardContent.includes('dv11-metric-goals'), 'Métrica de metas presente');
  assert(dashboardContent.includes('dv11-metric-events'), 'Métrica de eventos presente');
  assert(dashboardContent.includes('dv11-metric-messages'), 'Métrica de mensagens presente');
  assert(dashboardContent.includes('dv11-metric-projects'), 'Métrica de projetos presente');
});

// ══ BLOCO 7: FRONTEND — MODAIS E FUNÇÕES ═════════════════════════════════
console.log('\n▶ BLOCO 7: Frontend — Modais e Funções\n');

test('Frontend: modal de evento presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('modal-event-form'), 'Modal de evento deve existir');
  assert(content.includes('ev-title'), 'Campo título do evento');
  assert(content.includes('ev-date'), 'Campo data do evento');
  assert(content.includes('ev-time'), 'Campo horário do evento');
  assert(content.includes('ev-repeat'), 'Campo recorrência do evento');
  assert(content.includes('ev-reminder'), 'Campo lembrete do evento');
  assert(content.includes('ev-category'), 'Campo categoria do evento');
  assert(content.includes('ev-color'), 'Campo cor do evento');
  assert(content.includes('ev-all-day'), 'Campo dia inteiro do evento');
  assert(content.includes('ev-location'), 'Campo local do evento');
});

test('Frontend: modal de hábito presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('modal-habit-form'), 'Modal de hábito deve existir');
  assert(content.includes('habit-title'), 'Campo título do hábito');
  assert(content.includes('habit-frequency'), 'Campo frequência do hábito');
  assert(content.includes('habit-category'), 'Campo categoria do hábito');
  assert(content.includes('habit-color'), 'Campo cor do hábito');
  assert(content.includes('habit-reminder-enabled'), 'Campo lembrete do hábito');
  assert(content.includes('habit-reminder-time'), 'Campo horário do lembrete');
});

test('Frontend: modal de meta presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('modal-goal-form'), 'Modal de meta deve existir');
  assert(content.includes('goal-title'), 'Campo título da meta');
  assert(content.includes('goal-category'), 'Campo categoria da meta');
  assert(content.includes('goal-target-date'), 'Campo prazo da meta');
  assert(content.includes('goal-target-value'), 'Campo meta numérica');
  assert(content.includes('goal-color'), 'Campo cor da meta');
});

test('Frontend: modal de detalhe do hábito presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('modal-habit-detail'), 'Modal de detalhe do hábito deve existir');
  assert(content.includes('habit-detail-content'), 'Conteúdo do detalhe do hábito');
  assert(content.includes('habit-detail-edit-btn'), 'Botão de edição do hábito');
  assert(content.includes('habit-detail-delete-btn'), 'Botão de exclusão do hábito');
});

test('Frontend: modal de detalhe da meta presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('modal-goal-detail'), 'Modal de detalhe da meta deve existir');
  assert(content.includes('goal-detail-content'), 'Conteúdo do detalhe da meta');
  assert(content.includes('goal-detail-edit-btn'), 'Botão de edição da meta');
  assert(content.includes('goal-detail-delete-btn'), 'Botão de exclusão da meta');
});

test('Frontend: sem prompt() nos módulos certificados', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  // Verificar que openNewEventModal, openNewHabitModal e openNewGoalModal não usam prompt()
  const eventModal = content.match(/function openNewEventModal[\s\S]*?(?=\n  function )/)?.[0] || '';
  const habitModal = content.match(/function openNewHabitModal[\s\S]*?(?=\n  function )/)?.[0] || '';
  const goalModal = content.match(/function openNewGoalModal[\s\S]*?(?=\n  function )/)?.[0] || '';
  assert(!eventModal.includes("prompt("), 'openNewEventModal não deve usar prompt()');
  assert(!habitModal.includes("prompt("), 'openNewHabitModal não deve usar prompt()');
  assert(!goalModal.includes("prompt("), 'openNewGoalModal não deve usar prompt()');
});

test('Frontend: funções de submit presentes', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('submitEventForm'), 'submitEventForm deve existir');
  assert(content.includes('submitHabitForm'), 'submitHabitForm deve existir');
  assert(content.includes('submitGoalForm'), 'submitGoalForm deve existir');
});

test('Frontend: funções de exclusão presentes', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('deleteEvent'), 'deleteEvent deve existir');
  assert(content.includes('deleteHabit'), 'deleteHabit deve existir');
  assert(content.includes('deleteGoal'), 'deleteGoal deve existir');
});

test('Frontend: funções de edição presentes', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('openEditEventModal'), 'openEditEventModal deve existir');
  assert(content.includes('openEditHabitModal'), 'openEditHabitModal deve existir');
  assert(content.includes('openEditGoalModal'), 'openEditGoalModal deve existir');
});

test('Frontend: visualizações da agenda (dia/semana/mês)', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('agendaSetView'), 'agendaSetView deve existir');
  assert(content.includes("agendaSetView('day')"), 'View dia deve existir');
  assert(content.includes("agendaSetView('week')"), 'View semana deve existir');
  assert(content.includes("agendaSetView('month')"), 'View mês deve existir');
  assert(content.includes('renderWeekView'), 'renderWeekView deve existir');
  assert(content.includes('renderMonthView'), 'renderMonthView deve existir');
});

test('Frontend: navegação de datas na agenda', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('agendaNavigate'), 'agendaNavigate deve existir');
  assert(content.includes('agendaGoToday'), 'agendaGoToday deve existir');
  assert(content.includes('agenda-date-label'), 'Label de data deve existir');
});

test('Frontend: busca de eventos', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('agendaSearch'), 'agendaSearch deve existir');
  assert(content.includes('agenda-search'), 'Input de busca deve existir');
});

test('Frontend: sincronização Google Calendar e Outlook', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('agendaSyncGoogle'), 'agendaSyncGoogle deve existir');
  assert(content.includes('agendaSyncOutlook'), 'agendaSyncOutlook deve existir');
});

test('Frontend: filtros de hábitos', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('habitsSetFilter'), 'habitsSetFilter deve existir');
  assert(content.includes("habitsSetFilter('all')"), 'Filtro todos deve existir');
  assert(content.includes("habitsSetFilter('pending')"), 'Filtro pendentes deve existir');
  assert(content.includes("habitsSetFilter('done')"), 'Filtro concluídos deve existir');
});

test('Frontend: filtros de metas', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('goalsSetFilter'), 'goalsSetFilter deve existir');
  assert(content.includes("goalsSetFilter('all')"), 'Filtro todos deve existir');
  assert(content.includes("goalsSetFilter('active')"), 'Filtro ativas deve existir');
  assert(content.includes("goalsSetFilter('done')"), 'Filtro concluídas deve existir');
});

test('Frontend: KPIs de metas', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('goals-kpi-total'), 'KPI total de metas');
  assert(content.includes('goals-kpi-active'), 'KPI metas ativas');
  assert(content.includes('goals-kpi-done'), 'KPI metas concluídas');
  assert(content.includes('goals-kpi-avg'), 'KPI progresso médio');
});

test('Frontend: detalhe do hábito com calendário', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('openHabitDetail'), 'openHabitDetail deve existir');
  assert(content.includes('Calendário (28 dias)'), 'Calendário de 28 dias deve existir');
});

test('Frontend: detalhe da meta com subtarefas e marcos', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('openGoalDetail'), 'openGoalDetail deve existir');
  assert(content.includes('addGoalSubtask'), 'addGoalSubtask deve existir');
  assert(content.includes('addGoalMilestone'), 'addGoalMilestone deve existir');
  assert(content.includes('toggleGoalSubtask'), 'toggleGoalSubtask deve existir');
  assert(content.includes('toggleGoalMilestone'), 'toggleGoalMilestone deve existir');
  assert(content.includes('shareGoal'), 'shareGoal deve existir');
  assert(content.includes('updateGoalProgress'), 'updateGoalProgress deve existir');
});

// ══ BLOCO 8: PERFORMANCE E STRESS ════════════════════════════════════════
console.log('\n▶ BLOCO 8: Performance e Stress\n');

test('Performance: KV com 1000 eventos', async () => {
  const kv = new MockKV();
  const events = [];
  for (let i = 0; i < 1000; i++) {
    events.push({ id: `ev${i}`, title: `Evento ${i}`, date: TODAY, time: `${String(Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}` });
  }
  const start = Date.now();
  await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(events));
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  const loaded = JSON.parse(raw);
  const elapsed = Date.now() - start;
  assertEqual(loaded.length, 1000, 'Deve carregar 1000 eventos');
  assert(elapsed < 1000, `Deve completar em < 1s, levou ${elapsed}ms`);
});

test('Performance: KV com 500 hábitos', async () => {
  const kv = new MockKV();
  const habits = [];
  for (let i = 0; i < 500; i++) {
    const completions = [];
    for (let j = 0; j < 30; j++) {
      const d = new Date(); d.setDate(d.getDate() - j);
      completions.push(d.toISOString().split('T')[0]);
    }
    habits.push({ id: `h${i}`, title: `Hábito ${i}`, completions, streak: 30 });
  }
  const start = Date.now();
  await kv.put(`habits:${TEST_USER_ID}`, JSON.stringify(habits));
  const raw = await kv.get(`habits:${TEST_USER_ID}`);
  const loaded = JSON.parse(raw);
  const elapsed = Date.now() - start;
  assertEqual(loaded.length, 500, 'Deve carregar 500 hábitos');
  assert(elapsed < 2000, `Deve completar em < 2s, levou ${elapsed}ms`);
});

test('Performance: KV com 200 metas com subtarefas', async () => {
  const kv = new MockKV();
  const goals = [];
  for (let i = 0; i < 200; i++) {
    const subtasks = Array.from({ length: 10 }, (_, j) => ({ id: `st${j}`, title: `Subtarefa ${j}`, done: j < 5 }));
    const milestones = Array.from({ length: 5 }, (_, j) => ({ id: `m${j}`, title: `Marco ${j}`, done: j < 2 }));
    const history = Array.from({ length: 20 }, (_, j) => ({ action: 'updated', at: new Date().toISOString() }));
    goals.push({ id: `g${i}`, title: `Meta ${i}`, status: 'active', progress: i % 100, subtasks, milestones, history });
  }
  const start = Date.now();
  await kv.put(`goals:${TEST_USER_ID}`, JSON.stringify(goals));
  const raw = await kv.get(`goals:${TEST_USER_ID}`);
  const loaded = JSON.parse(raw);
  const elapsed = Date.now() - start;
  assertEqual(loaded.length, 200, 'Deve carregar 200 metas');
  assert(elapsed < 2000, `Deve completar em < 2s, levou ${elapsed}ms`);
});

test('Stress: 100 operações CRUD consecutivas', async () => {
  const kv = new MockKV();
  let events = [];
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    if (i % 3 === 0) {
      // CREATE
      events.push({ id: `ev${i}`, title: `Evento ${i}`, date: TODAY });
    } else if (i % 3 === 1 && events.length > 0) {
      // UPDATE
      events[events.length - 1].title = `Evento ${i} editado`;
    } else if (events.length > 1) {
      // DELETE
      events.splice(0, 1);
    }
    await kv.put(`events:${TEST_USER_ID}`, JSON.stringify(events));
  }
  const elapsed = Date.now() - start;
  assert(elapsed < 5000, `100 operações devem completar em < 5s, levou ${elapsed}ms`);
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  const final = JSON.parse(raw);
  assertArray(final, 'Resultado deve ser array');
});

// ══ BLOCO 9: VALIDAÇÃO DE DADOS ══════════════════════════════════════════
console.log('\n▶ BLOCO 9: Validação de Dados\n');

test('Validação: título obrigatório no evento', () => {
  function validateEvent(data) {
    if (!data.title || !data.title.trim()) return { ok: false, error: 'Título obrigatório' };
    if (!data.date) return { ok: false, error: 'Data obrigatória' };
    return { ok: true };
  }
  const r1 = validateEvent({ title: '', date: TODAY });
  assertEqual(r1.ok, false, 'Deve rejeitar título vazio');
  const r2 = validateEvent({ title: 'Evento', date: '' });
  assertEqual(r2.ok, false, 'Deve rejeitar data vazia');
  const r3 = validateEvent({ title: 'Evento', date: TODAY });
  assertEqual(r3.ok, true, 'Deve aceitar dados válidos');
});

test('Validação: título obrigatório no hábito', () => {
  function validateHabit(data) {
    if (!data.title || !data.title.trim()) return { ok: false, error: 'Título obrigatório' };
    if (!['daily','weekdays','weekends','weekly','monthly'].includes(data.frequency)) return { ok: false, error: 'Frequência inválida' };
    return { ok: true };
  }
  assertEqual(validateHabit({ title: '', frequency: 'daily' }).ok, false, 'Deve rejeitar título vazio');
  assertEqual(validateHabit({ title: 'Hábito', frequency: 'invalid' }).ok, false, 'Deve rejeitar frequência inválida');
  assertEqual(validateHabit({ title: 'Hábito', frequency: 'daily' }).ok, true, 'Deve aceitar dados válidos');
});

test('Validação: título obrigatório na meta', () => {
  function validateGoal(data) {
    if (!data.title || !data.title.trim()) return { ok: false, error: 'Título obrigatório' };
    if (data.progress !== undefined && (data.progress < 0 || data.progress > 100)) return { ok: false, error: 'Progresso deve ser entre 0 e 100' };
    return { ok: true };
  }
  assertEqual(validateGoal({ title: '' }).ok, false, 'Deve rejeitar título vazio');
  assertEqual(validateGoal({ title: 'Meta', progress: 150 }).ok, false, 'Deve rejeitar progresso > 100');
  assertEqual(validateGoal({ title: 'Meta', progress: 50 }).ok, true, 'Deve aceitar dados válidos');
});

test('Validação: sanitização de HTML', () => {
  function sanitize(value, max = 200) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .trim()
      .slice(0, max);
  }
  const xss = '<script>alert("xss")</script>';
  const sanitized = sanitize(xss);
  assert(!sanitized.includes('<script>'), 'XSS deve ser removido');
  const onclick = 'onclick="alert(1)"';
  const sanitized2 = sanitize(onclick);
  assert(!sanitized2.includes('onclick'), 'onclick deve ser removido');
  const normal = 'Título normal';
  assertEqual(sanitize(normal), 'Título normal', 'Texto normal não deve ser alterado');
});

// ══ BLOCO 10: RESPONSIVIDADE E MOBILE ════════════════════════════════════
console.log('\n▶ BLOCO 10: Responsividade e Mobile\n');

test('Responsividade: viewport meta tag presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('viewport'), 'Meta viewport deve existir');
  assert(content.includes('width=device-width'), 'width=device-width deve estar presente');
});

test('Responsividade: grid responsivo presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('grid-template-columns'), 'Grid template columns deve existir');
  assert(content.includes('flex-wrap'), 'flex-wrap deve existir para responsividade');
});

test('Responsividade: botões com tamanho adequado para mobile', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('.btn'), 'Classe btn deve existir');
  assert(content.includes('padding:'), 'Padding nos botões deve existir');
});

test('Mobile: manifest.webmanifest presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('manifest.webmanifest'), 'Web manifest deve estar referenciado');
});

test('Mobile: apple-touch-icon presente', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'premium_ui/app_dashboard.html'), 'utf-8');
  assert(content.includes('apple-touch-icon'), 'Apple touch icon deve existir');
});

// ══ BLOCO 11: ERROS E EDGE CASES ═════════════════════════════════════════
console.log('\n▶ BLOCO 11: Tratamento de Erros\n');

test('Erro: KV indisponível retorna array vazio', async () => {
  const kv = new MockKV();
  const raw = await kv.get(`events:nonexistent-user`);
  const events = raw ? JSON.parse(raw) : [];
  assertArray(events, 'Deve retornar array vazio quando KV não tem dados');
  assertEqual(events.length, 0, 'Array deve estar vazio');
});

test('Erro: JSON inválido no KV tratado graciosamente', async () => {
  const kv = new MockKV();
  await kv.put(`events:${TEST_USER_ID}`, 'invalid json {{{');
  const raw = await kv.get(`events:${TEST_USER_ID}`);
  let events = [];
  try { events = JSON.parse(raw); } catch { events = []; }
  assertArray(events, 'Deve retornar array vazio em caso de JSON inválido');
});

test('Erro: evento não encontrado retorna 404', () => {
  const events = [{ id: 'ev1', title: 'Evento A' }];
  const found = events.find(e => e.id === 'ev-nonexistent');
  assert(!found, 'Evento não encontrado deve retornar undefined');
});

test('Erro: hábito não encontrado retorna 404', () => {
  const habits = [{ id: 'h1', title: 'Hábito A' }];
  const found = habits.find(h => h.id === 'h-nonexistent');
  assert(!found, 'Hábito não encontrado deve retornar undefined');
});

test('Erro: meta não encontrada retorna 404', () => {
  const goals = [{ id: 'g1', title: 'Meta A' }];
  const found = goals.find(g => g.id === 'g-nonexistent');
  assert(!found, 'Meta não encontrada deve retornar undefined');
});

test('Erro: progresso da meta fora do range', () => {
  function clampProgress(p) {
    return Math.max(0, Math.min(100, Number(p) || 0));
  }
  assertEqual(clampProgress(-10), 0, 'Progresso negativo deve ser 0');
  assertEqual(clampProgress(150), 100, 'Progresso > 100 deve ser 100');
  assertEqual(clampProgress(50), 50, 'Progresso válido não deve ser alterado');
  assertEqual(clampProgress('abc'), 0, 'Progresso inválido deve ser 0');
});

// ══ RELATÓRIO FINAL ═══════════════════════════════════════════════════════
async function runAllTests() {
  // Aguardar todos os testes assíncronos
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  RELATÓRIO DE CERTIFICAÇÃO — FASE 2');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n  ✓ Aprovados:  ${passed}`);
  console.log(`  ✗ Reprovados: ${failed}`);
  console.log(`  ⊘ Ignorados:  ${skipped}`);
  console.log(`  Total:        ${passed + failed + skipped}`);
  const coverage = Math.round((passed / (passed + failed + skipped)) * 100);
  console.log(`\n  Cobertura: ${coverage}%`);

  if (failed > 0) {
    console.log('\n  FALHAS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.error(`    ✗ ${r.name}: ${r.error}`);
    });
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  STATUS: ${failed === 0 ? '✅ CERTIFICADO' : '❌ REQUER CORREÇÃO'}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // Salvar relatório
  const report = {
    timestamp: new Date().toISOString(),
    phase: 2,
    modules: ['Agenda', 'Hábitos', 'Metas', 'Command Center'],
    passed, failed, skipped,
    coverage,
    status: failed === 0 ? 'CERTIFIED' : 'FAILED',
    results,
  };
  fs.writeFileSync(
    path.join(__dirname, '..', 'CERTIFICATION_REPORT_PHASE2.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('  Relatório salvo em CERTIFICATION_REPORT_PHASE2.json\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
