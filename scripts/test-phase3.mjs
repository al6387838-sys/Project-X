#!/usr/bin/env node
// LifeOS Enterprise — Test Suite Fase 3 v56.0.0
// Tasks · CRM · Financeiro · Notificações
// Executa testes reais contra a API de produção

import https from 'https';
import http from 'http';

const BASE = process.env.TEST_BASE || 'https://lifeos-enterprise.pages.dev';
const SESSION = process.env.TEST_SESSION || '';

let passed = 0;
let failed = 0;
let total = 0;
const results = [];

function req(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(SESSION ? { 'Cookie': `session=${SESSION}` } : {}),
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      ...extraHeaders,
    };
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
    };
    const reqObj = mod.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw), raw });
        } catch {
          resolve({ status: res.statusCode, body: null, raw });
        }
      });
    });
    reqObj.on('error', reject);
    if (data) reqObj.write(data);
    reqObj.end();
  });
}

async function test(name, fn) {
  total++;
  try {
    const result = await fn();
    if (result === true || result === undefined) {
      passed++;
      results.push({ name, status: 'PASS' });
      process.stdout.write(`  ✅ ${name}\n`);
    } else {
      failed++;
      results.push({ name, status: 'FAIL', reason: String(result) });
      process.stdout.write(`  ❌ ${name}: ${result}\n`);
    }
  } catch (err) {
    failed++;
    results.push({ name, status: 'ERROR', reason: err.message });
    process.stdout.write(`  ❌ ${name}: ERROR — ${err.message}\n`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function isOk(r) { return r.body && r.body.ok === true; }
function hasField(obj, field) { return obj && field in obj; }

// ─── TASKS TESTS ─────────────────────────────────────────────────────────────
let taskId = null;
let subtaskId = null;
let commentId = null;
let attachmentId = null;

console.log('\n📋 MÓDULO 1 — TASKS\n');

await test('GET /api/tasks — lista tarefas', async () => {
  const r = await req('GET', '/api/tasks');
  if (r.status === 401) return 'Não autenticado (esperado em produção sem sessão)';
  assert(r.status === 200, `Status ${r.status}`);
  assert(r.body && (r.body.ok || Array.isArray(r.body.tasks)), 'Resposta inválida');
});

await test('POST /api/tasks — criar tarefa', async () => {
  const r = await req('POST', '/api/tasks', {
    title: 'Tarefa de Teste Fase 3',
    description: 'Criada pelo test suite v56.0.0',
    priority: 'high',
    status: 'todo',
    labels: ['teste', 'fase3'],
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  });
  if (r.status === 401) return 'Não autenticado (esperado em produção sem sessão)';
  assert(r.status === 200 || r.status === 201, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  assert(r.body.task?.id, 'ID não retornado');
  taskId = r.body.task.id;
});

await test('GET /api/tasks — tarefa criada aparece na lista', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('GET', '/api/tasks');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  const tasks = r.body.tasks || [];
  assert(tasks.some(t => t.id === taskId), 'Tarefa não encontrada na lista');
});

await test('PUT /api/tasks — editar tarefa', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('PUT', '/api/tasks', {
    id: taskId,
    title: 'Tarefa Editada — Fase 3',
    priority: 'critical',
    status: 'progress',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  assert(r.body.task?.title === 'Tarefa Editada — Fase 3', 'Título não atualizado');
});

await test('POST /api/tasks — add-subtask', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('POST', '/api/tasks', {
    action: 'add-subtask',
    taskId,
    title: 'Subtarefa de teste',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  subtaskId = r.body.subtask?.id;
  assert(subtaskId, 'Subtask ID não retornado');
});

await test('POST /api/tasks — toggle-subtask', async () => {
  if (!taskId || !subtaskId) return 'Subtarefa não criada (pulando)';
  const r = await req('POST', '/api/tasks', {
    action: 'toggle-subtask',
    taskId,
    subtaskId,
    done: true,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
});

await test('POST /api/tasks — add-comment', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('POST', '/api/tasks', {
    action: 'add-comment',
    taskId,
    text: 'Comentário de teste do test suite v56.0.0',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  commentId = r.body.comment?.id;
  assert(commentId, 'Comment ID não retornado');
});

await test('POST /api/tasks — add-attachment', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('POST', '/api/tasks', {
    action: 'add-attachment',
    taskId,
    name: 'documento-teste.pdf',
    url: 'https://example.com/doc.pdf',
    size: 1024,
    mimeType: 'application/pdf',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  attachmentId = r.body.attachment?.id;
  assert(attachmentId, 'Attachment ID não retornado');
});

await test('POST /api/tasks — complete task', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('PUT', '/api/tasks', {
    id: taskId,
    status: 'done',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(r.body.task?.status === 'done', 'Status não atualizado para done');
});

await test('POST /api/tasks — reopen task', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('PUT', '/api/tasks', {
    id: taskId,
    status: 'todo',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(r.body.task?.status === 'todo', 'Status não atualizado para todo');
});

await test('GET /api/tasks?search= — pesquisa', async () => {
  const r = await req('GET', '/api/tasks?search=Fase+3');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(r.body && (r.body.ok || Array.isArray(r.body.tasks)), 'Resposta inválida');
});

await test('GET /api/tasks?priority=high — filtro por prioridade', async () => {
  const r = await req('GET', '/api/tasks?priority=high');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
});

await test('GET /api/tasks?sort=dueDate — ordenação', async () => {
  const r = await req('GET', '/api/tasks?sort=dueDate');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
});

await test('POST /api/tasks — delete-subtask', async () => {
  if (!taskId || !subtaskId) return 'Subtarefa não criada (pulando)';
  const r = await req('POST', '/api/tasks', {
    action: 'delete-subtask',
    taskId,
    subtaskId,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('POST /api/tasks — delete-comment', async () => {
  if (!taskId || !commentId) return 'Comentário não criado (pulando)';
  const r = await req('POST', '/api/tasks', {
    action: 'delete-comment',
    taskId,
    commentId,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('DELETE /api/tasks — excluir tarefa', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('DELETE', '/api/tasks?id=' + taskId);
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('GET /api/tasks — tarefa excluída não aparece', async () => {
  if (!taskId) return 'Tarefa não criada (pulando)';
  const r = await req('GET', '/api/tasks');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  const tasks = r.body.tasks || [];
  assert(!tasks.some(t => t.id === taskId), 'Tarefa excluída ainda aparece na lista');
});

// ─── TASKS RECORRÊNCIA ────────────────────────────────────────────────────────
let recurTaskId = null;

await test('POST /api/tasks — criar tarefa recorrente', async () => {
  const r = await req('POST', '/api/tasks', {
    title: 'Tarefa Recorrente Semanal',
    priority: 'medium',
    status: 'todo',
    recurrence: { type: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] },
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200 || r.status === 201, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  recurTaskId = r.body.task?.id;
  assert(r.body.task?.recurrence?.type === 'weekly', 'Recorrência não salva');
});

await test('DELETE /api/tasks — excluir tarefa recorrente', async () => {
  if (!recurTaskId) return 'Tarefa recorrente não criada (pulando)';
  const r = await req('DELETE', '/api/tasks?id=' + recurTaskId);
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

// ─── CRM TESTS ────────────────────────────────────────────────────────────────
let contactId = null;
let dealId = null;
let agendaId = null;

console.log('\n👥 MÓDULO 2 — CRM\n');

await test('POST /api/crm — criar contato', async () => {
  const r = await req('POST', '/api/crm', {
    action: 'contact.create',
    name: 'Cliente Teste Fase 3',
    email: 'teste.fase3@lifeos.test',
    phone: '+55 11 99999-0000',
    company: 'Empresa Teste Ltda',
    status: 'active',
    value: 50000,
    labels: ['teste', 'vip'],
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  contactId = r.body.contact?.id;
  assert(contactId, 'Contact ID não retornado');
});

await test('POST /api/crm — editar contato', async () => {
  if (!contactId) return 'Contato não criado (pulando)';
  const r = await req('POST', '/api/crm', {
    action: 'contact.update',
    id: contactId,
    name: 'Cliente Editado Fase 3',
    status: 'prospect',
    value: 75000,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(r.body.contact?.name === 'Cliente Editado Fase 3', 'Nome não atualizado');
});

await test('POST /api/crm — listar contatos', async () => {
  const r = await req('POST', '/api/crm', { action: 'contact.list' });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(Array.isArray(r.body.contacts), 'contacts não é array');
});

await test('POST /api/crm — buscar contato por query', async () => {
  const r = await req('POST', '/api/crm', { action: 'contact.list', query: 'Fase 3' });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('POST /api/crm — filtrar contatos por status', async () => {
  const r = await req('POST', '/api/crm', { action: 'contact.list', status: 'prospect' });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('POST /api/crm — adicionar nota ao contato', async () => {
  if (!contactId) return 'Contato não criado (pulando)';
  const r = await req('POST', '/api/crm', {
    action: 'contact.note',
    contactId,
    detail: 'Nota de teste do test suite v56.0.0',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
});

await test('POST /api/crm — agendar follow-up', async () => {
  if (!contactId) return 'Contato não criado (pulando)';
  const r = await req('POST', '/api/crm', {
    action: 'contact.followup',
    contactId,
    title: 'Follow-up de teste',
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    notes: 'Ligação de acompanhamento',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
});

await test('POST /api/crm — histórico do contato', async () => {
  if (!contactId) return 'Contato não criado (pulando)';
  const r = await req('POST', '/api/crm', {
    action: 'history.list',
    contactId,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(Array.isArray(r.body.history), 'history não é array');
});

await test('POST /api/crm — criar oportunidade (deal)', async () => {
  const r = await req('POST', '/api/crm', {
    action: 'deal.create',
    title: 'Oportunidade Teste Fase 3',
    contactId: contactId || null,
    stage: 'lead',
    value: 120000,
    probability: 60,
    expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  dealId = r.body.deal?.id;
  assert(dealId, 'Deal ID não retornado');
});

await test('POST /api/crm — editar oportunidade', async () => {
  if (!dealId) return 'Deal não criado (pulando)';
  const r = await req('POST', '/api/crm', {
    action: 'deal.update',
    id: dealId,
    stage: 'qualified',
    probability: 75,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(r.body.deal?.stage === 'qualified', 'Stage não atualizado');
});

await test('POST /api/crm — listar deals (pipeline)', async () => {
  const r = await req('POST', '/api/crm', { action: 'deal.list' });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(Array.isArray(r.body.deals), 'deals não é array');
});

await test('POST /api/crm — criar compromisso na agenda', async () => {
  const r = await req('POST', '/api/crm', {
    action: 'agenda.create',
    title: 'Reunião Teste Fase 3',
    type: 'meeting',
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time: '14:00',
    contactId: contactId || null,
    status: 'scheduled',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  agendaId = r.body.item?.id;
  assert(agendaId, 'Agenda ID não retornado');
});

await test('POST /api/crm — listar agenda', async () => {
  const r = await req('POST', '/api/crm', { action: 'agenda.list' });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(Array.isArray(r.body.agenda), 'agenda não é array');
});

await test('POST /api/crm — excluir compromisso', async () => {
  if (!agendaId) return 'Agenda não criada (pulando)';
  const r = await req('POST', '/api/crm', {
    action: 'agenda.delete',
    id: agendaId,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('POST /api/crm — excluir oportunidade', async () => {
  if (!dealId) return 'Deal não criado (pulando)';
  const r = await req('POST', '/api/crm', {
    action: 'deal.delete',
    id: dealId,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('POST /api/crm — excluir contato', async () => {
  if (!contactId) return 'Contato não criado (pulando)';
  const r = await req('POST', '/api/crm', {
    action: 'contact.delete',
    id: contactId,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('POST /api/crm — contato excluído não aparece na lista', async () => {
  if (!contactId) return 'Contato não criado (pulando)';
  const r = await req('POST', '/api/crm', { action: 'contact.list' });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  const contacts = r.body.contacts || [];
  assert(!contacts.some(c => c.id === contactId), 'Contato excluído ainda aparece');
});

// ─── FINANCEIRO TESTS ─────────────────────────────────────────────────────────
let txId = null;
let txId2 = null;

console.log('\n💰 MÓDULO 3 — FINANCEIRO\n');

await test('GET /api/finance/transactions — listar transações', async () => {
  const r = await req('GET', '/api/finance/transactions');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(r.body && (r.body.ok || Array.isArray(r.body.transactions)), 'Resposta inválida');
});

await test('POST /api/finance/transactions — criar receita', async () => {
  const r = await req('POST', '/api/finance/transactions', {
    type: 'credit',
    description: 'Salário Teste Fase 3',
    amount: 8500.00,
    category: 'salary',
    date: new Date().toISOString().slice(0, 10),
    account: 'checking',
    notes: 'Teste do test suite v56.0.0',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200 || r.status === 201, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  txId = r.body.transaction?.id;
  assert(txId, 'Transaction ID não retornado');
});

await test('POST /api/finance/transactions — criar despesa', async () => {
  const r = await req('POST', '/api/finance/transactions', {
    type: 'debit',
    description: 'Aluguel Teste Fase 3',
    amount: 2200.00,
    category: 'housing',
    date: new Date().toISOString().slice(0, 10),
    account: 'checking',
    costCenter: 'pessoal',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200 || r.status === 201, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  txId2 = r.body.transaction?.id;
  assert(txId2, 'Transaction ID não retornado');
});

await test('PUT /api/finance/transactions — editar transação', async () => {
  if (!txId) return 'Transação não criada (pulando)';
  const r = await req('PUT', '/api/finance/transactions', {
    id: txId,
    description: 'Salário Editado Fase 3',
    amount: 9000.00,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
  assert(r.body.transaction?.amount === 9000, 'Valor não atualizado');
});

await test('GET /api/finance/transactions — transação criada aparece na lista', async () => {
  if (!txId) return 'Transação não criada (pulando)';
  const r = await req('GET', '/api/finance/transactions');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  const txs = r.body.transactions || [];
  assert(txs.some(t => t.id === txId), 'Transação não encontrada na lista');
});

await test('GET /api/finance/transactions?view=categories — listar categorias', async () => {
  const r = await req('GET', '/api/finance/transactions?view=categories');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(r.body && (r.body.ok || r.body.categories), 'Resposta inválida');
});

await test('GET /api/finance/transactions?view=cost-centers — listar centros de custo', async () => {
  const r = await req('GET', '/api/finance/transactions?view=cost-centers');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(r.body && (r.body.ok || r.body.costCenters), 'Resposta inválida');
});

await test('POST /api/finance/transactions — add-category', async () => {
  const r = await req('POST', '/api/finance/transactions', {
    action: 'add-category',
    key: 'test_cat_fase3',
    label: 'Categoria Teste Fase 3',
    type: 'both',
    icon: 'tag',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
});

await test('POST /api/finance/transactions — add-cost-center', async () => {
  const r = await req('POST', '/api/finance/transactions', {
    action: 'add-cost-center',
    key: 'test_cc_fase3',
    label: 'Centro de Custo Teste Fase 3',
    description: 'Criado pelo test suite',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
});

await test('GET /api/finance/transactions?view=report — relatório', async () => {
  const r = await req('GET', '/api/finance/transactions?view=report&period=month');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(r.body && (r.body.ok || r.body.report), 'Resposta inválida');
});

await test('GET /api/finance/transactions?view=export-csv — exportação CSV', async () => {
  const r = await req('GET', '/api/finance/transactions?view=export-csv');
  if (r.status === 401) return 'Não autenticado';
  // CSV pode retornar text/csv ou application/json com data
  assert(r.status === 200, `Status ${r.status}`);
});

await test('GET /api/finance/transactions?search= — pesquisa', async () => {
  const r = await req('GET', '/api/finance/transactions?search=Fase+3');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
});

await test('GET /api/finance/transactions?type=credit — filtro por tipo', async () => {
  const r = await req('GET', '/api/finance/transactions?type=credit');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  const txs = r.body.transactions || [];
  assert(txs.every(t => t.type === 'credit'), 'Filtro não funcionou');
});

await test('GET /api/finance/transactions?category=salary — filtro por categoria', async () => {
  const r = await req('GET', '/api/finance/transactions?category=salary');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
});

await test('DELETE /api/finance/transactions — excluir receita', async () => {
  if (!txId) return 'Transação não criada (pulando)';
  const r = await req('DELETE', `/api/finance/transactions?id=${txId}`);
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('DELETE /api/finance/transactions — excluir despesa', async () => {
  if (!txId2) return 'Transação não criada (pulando)';
  const r = await req('DELETE', `/api/finance/transactions?id=${txId2}`);
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('POST /api/finance/transactions — delete-category', async () => {
  const r = await req('POST', '/api/finance/transactions', {
    action: 'delete-category',
    key: 'test_cat_fase3',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('POST /api/finance/transactions — delete-cost-center', async () => {
  const r = await req('POST', '/api/finance/transactions', {
    action: 'delete-cost-center',
    key: 'test_cc_fase3',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

// ─── NOTIFICAÇÕES TESTS ───────────────────────────────────────────────────────
let notifId = null;

console.log('\n🔔 MÓDULO 4 — NOTIFICAÇÕES\n');

await test('GET /api/notifications — listar notificações', async () => {
  const r = await req('GET', '/api/notifications');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(r.body && (r.body.ok || Array.isArray(r.body.notifications)), 'Resposta inválida');
});

await test('POST /api/notifications — criar notificação', async () => {
  const r = await req('POST', '/api/notifications', {
    action: 'create',
    title: 'Notificação Teste Fase 3',
    body: 'Criada pelo test suite v56.0.0',
    category: 'system',
    priority: 'medium',
    icon: '🔔',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
  notifId = r.body.notification?.id;
  assert(notifId, 'Notification ID não retornado');
});

await test('GET /api/notifications — notificação criada aparece na lista', async () => {
  if (!notifId) return 'Notificação não criada (pulando)';
  const r = await req('GET', '/api/notifications');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  const notifs = r.body.notifications || [];
  assert(notifs.some(n => n.id === notifId), 'Notificação não encontrada na lista');
});

await test('POST /api/notifications — mark_read (individual)', async () => {
  if (!notifId) return 'Notificação não criada (pulando)';
  const r = await req('POST', '/api/notifications', {
    action: 'mark_read',
    id: notifId,
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('GET /api/notifications — notificação marcada como lida', async () => {
  if (!notifId) return 'Notificação não criada (pulando)';
  const r = await req('GET', '/api/notifications');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  const notif = (r.body.notifications || []).find(n => n.id === notifId);
  if (notif) assert(notif.read === true, 'Notificação não marcada como lida');
});

await test('POST /api/notifications — mark_read all', async () => {
  const r = await req('POST', '/api/notifications', {
    action: 'mark_read',
    id: 'all',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false`);
});

await test('GET /api/notifications?view=preferences — carregar preferências', async () => {
  const r = await req('GET', '/api/notifications?view=preferences');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(r.body && (r.body.ok || r.body.preferences), 'Resposta inválida');
});

await test('POST /api/notifications — save_preferences', async () => {
  const r = await req('POST', '/api/notifications', {
    action: 'save_preferences',
    email: false,
    emailAddress: '',
    sound: true,
    minPriority: 'low',
    categories: {
      task: true, crm: true, finance: true, habit: true,
      goal: true, system: true, reminder: true, ai: true, integration: true,
    },
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
});

await test('POST /api/notifications — delete_batch', async () => {
  if (!notifId) return 'Notificação não criada (pulando)';
  const r = await req('POST', '/api/notifications', {
    action: 'delete_batch',
    ids: [notifId],
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
});

await test('GET /api/notifications — notificação excluída não aparece', async () => {
  if (!notifId) return 'Notificação não criada (pulando)';
  const r = await req('GET', '/api/notifications');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  const notifs = r.body.notifications || [];
  assert(!notifs.some(n => n.id === notifId), 'Notificação excluída ainda aparece');
});

await test('POST /api/notifications — clear_read', async () => {
  const r = await req('POST', '/api/notifications', {
    action: 'clear_read',
  });
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
  assert(isOk(r), `ok=false: ${r.raw?.slice(0, 200)}`);
});

await test('GET /api/notifications?category=system — filtro por categoria', async () => {
  const r = await req('GET', '/api/notifications?category=system');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
});

await test('GET /api/notifications?priority=medium — filtro por prioridade', async () => {
  const r = await req('GET', '/api/notifications?priority=medium');
  if (r.status === 401) return 'Não autenticado';
  assert(r.status === 200, `Status ${r.status}`);
});

// ─── STRESS TEST ──────────────────────────────────────────────────────────────
console.log('\n⚡ STRESS TEST\n');

await test('Stress: 10 requisições GET simultâneas /api/tasks', async () => {
  const start = Date.now();
  const promises = Array.from({ length: 10 }, () => req('GET', '/api/tasks'));
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;
  const allOk = results.every(r => r.status === 200 || r.status === 401);
  assert(allOk, `Algumas requisições falharam: ${results.map(r => r.status).join(',')}`);
  assert(elapsed < 15000, `Tempo excessivo: ${elapsed}ms`);
  process.stdout.write(`     → ${elapsed}ms para 10 requisições\n`);
});

await test('Stress: 10 requisições GET simultâneas /api/notifications', async () => {
  const start = Date.now();
  const promises = Array.from({ length: 10 }, () => req('GET', '/api/notifications'));
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;
  const allOk = results.every(r => r.status === 200 || r.status === 401);
  assert(allOk, `Algumas requisições falharam`);
  assert(elapsed < 15000, `Tempo excessivo: ${elapsed}ms`);
  process.stdout.write(`     → ${elapsed}ms para 10 requisições\n`);
});

await test('Stress: 10 requisições POST simultâneas /api/crm contact.list', async () => {
  const start = Date.now();
  const promises = Array.from({ length: 10 }, () =>
    req('POST', '/api/crm', { action: 'contact.list' })
  );
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;
  const allOk = results.every(r => r.status === 200 || r.status === 401);
  assert(allOk, `Algumas requisições falharam`);
  assert(elapsed < 15000, `Tempo excessivo: ${elapsed}ms`);
  process.stdout.write(`     → ${elapsed}ms para 10 requisições\n`);
});

await test('Stress: 10 requisições GET simultâneas /api/finance/transactions', async () => {
  const start = Date.now();
  const promises = Array.from({ length: 10 }, () => req('GET', '/api/finance/transactions'));
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;
  const allOk = results.every(r => r.status === 200 || r.status === 401);
  assert(allOk, `Algumas requisições falharam`);
  assert(elapsed < 15000, `Tempo excessivo: ${elapsed}ms`);
  process.stdout.write(`     → ${elapsed}ms para 10 requisições\n`);
});

// ─── PERFORMANCE TEST ─────────────────────────────────────────────────────────
console.log('\n🚀 PERFORMANCE TEST\n');

await test('Performance: GET /api/tasks < 3000ms', async () => {
  const start = Date.now();
  const r = await req('GET', '/api/tasks');
  const elapsed = Date.now() - start;
  assert(r.status === 200 || r.status === 401, `Status ${r.status}`);
  assert(elapsed < 3000, `Tempo excessivo: ${elapsed}ms`);
  process.stdout.write(`     → ${elapsed}ms\n`);
});

await test('Performance: GET /api/notifications < 3000ms', async () => {
  const start = Date.now();
  const r = await req('GET', '/api/notifications');
  const elapsed = Date.now() - start;
  assert(r.status === 200 || r.status === 401, `Status ${r.status}`);
  assert(elapsed < 3000, `Tempo excessivo: ${elapsed}ms`);
  process.stdout.write(`     → ${elapsed}ms\n`);
});

await test('Performance: GET /api/finance/transactions < 3000ms', async () => {
  const start = Date.now();
  const r = await req('GET', '/api/finance/transactions');
  const elapsed = Date.now() - start;
  assert(r.status === 200 || r.status === 401, `Status ${r.status}`);
  assert(elapsed < 3000, `Tempo excessivo: ${elapsed}ms`);
  process.stdout.write(`     → ${elapsed}ms\n`);
});

await test('Performance: POST /api/crm contact.list < 3000ms', async () => {
  const start = Date.now();
  const r = await req('POST', '/api/crm', { action: 'contact.list' });
  const elapsed = Date.now() - start;
  assert(r.status === 200 || r.status === 401, `Status ${r.status}`);
  assert(elapsed < 3000, `Tempo excessivo: ${elapsed}ms`);
  process.stdout.write(`     → ${elapsed}ms\n`);
});

// ─── VALIDAÇÃO DE ESTRUTURA DE RESPOSTA ──────────────────────────────────────
console.log('\n🔍 VALIDAÇÃO DE ESTRUTURA\n');

await test('Tasks: resposta tem campo ok e tasks', async () => {
  const r = await req('GET', '/api/tasks');
  if (r.status === 401) return 'Não autenticado';
  assert(hasField(r.body, 'ok'), 'Campo ok ausente');
  assert(hasField(r.body, 'tasks'), 'Campo tasks ausente');
});

await test('Notifications: resposta tem campo ok e notifications', async () => {
  const r = await req('GET', '/api/notifications');
  if (r.status === 401) return 'Não autenticado';
  assert(hasField(r.body, 'ok'), 'Campo ok ausente');
  assert(hasField(r.body, 'notifications'), 'Campo notifications ausente');
});

await test('Finance/transactions: resposta tem campo ok e transactions', async () => {
  const r = await req('GET', '/api/finance/transactions');
  if (r.status === 401) return 'Não autenticado';
  assert(hasField(r.body, 'ok'), 'Campo ok ausente');
  assert(hasField(r.body, 'transactions'), 'Campo transactions ausente');
});

await test('CRM: resposta contact.list tem ok e contacts', async () => {
  const r = await req('POST', '/api/crm', { action: 'contact.list' });
  if (r.status === 401) return 'Não autenticado';
  assert(hasField(r.body, 'ok'), 'Campo ok ausente');
  assert(hasField(r.body, 'contacts'), 'Campo contacts ausente');
});

// ─── RESULTADO FINAL ──────────────────────────────────────────────────────────
const coverage = Math.round((passed / total) * 100);
console.log('\n' + '═'.repeat(60));
console.log('📊 RESULTADO FINAL — FASE 3 v56.0.0');
console.log('═'.repeat(60));
console.log(`Total de testes:  ${total}`);
console.log(`Aprovados:        ${passed} ✅`);
console.log(`Reprovados:       ${failed} ❌`);
console.log(`Cobertura:        ${coverage}%`);
console.log('═'.repeat(60));

if (failed > 0) {
  console.log('\nFalhas:');
  results.filter(r => r.status !== 'PASS').forEach(r => {
    console.log(`  ❌ ${r.name}: ${r.reason}`);
  });
}

// Salvar resultado em JSON
import { writeFileSync } from 'fs';
const report = {
  version: 'v56.0.0',
  buildId: `lifeos-56.0.0-phase3`,
  date: new Date().toISOString(),
  total,
  passed,
  failed,
  coverage,
  results,
};
writeFileSync('/home/ubuntu/lifeos/test-results-phase3.json', JSON.stringify(report, null, 2));
console.log('\nResultados salvos em test-results-phase3.json');

process.exit(failed > 0 ? 1 : 0);
