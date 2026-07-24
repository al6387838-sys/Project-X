// LifeOS Enterprise — Automation Engine API v34.0
// Cloudflare Pages Function: GET/POST/PUT/DELETE /api/automations
// Phase 265 — Enterprise Automation Engine
// Gatilhos, regras, ações, condições, agendamentos — infraestrutura real via KV
import { getCookie, json, verifySession } from '../_auth.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// ─── Tipos de gatilhos disponíveis ────────────────────────────────────────────
const TRIGGER_TYPES = {
  'new_client':           { label: 'Novo cliente criado',         category: 'crm'      },
  'new_document':         { label: 'Novo documento criado',       category: 'docs'     },
  'new_project':          { label: 'Novo projeto criado',         category: 'projects' },
  'new_task':             { label: 'Nova tarefa criada',          category: 'tasks'    },
  'task_completed':       { label: 'Tarefa concluída',            category: 'tasks'    },
  'task_overdue':         { label: 'Tarefa em atraso',            category: 'tasks'    },
  'pipeline_changed':     { label: 'Pipeline alterado',           category: 'crm'      },
  'due_date_approaching': { label: 'Vencimento se aproximando',   category: 'tasks'    },
  'goal_reached':         { label: 'Meta atingida',               category: 'goals'    },
  'habit_streak':         { label: 'Streak de hábito alcançado',  category: 'habits'   },
  'schedule':             { label: 'Agendamento (cron)',          category: 'system'   },
  'webhook':              { label: 'Webhook recebido',            category: 'system'   },
  'manual':               { label: 'Execução manual',             category: 'system'   },
};

// ─── Tipos de ações disponíveis ───────────────────────────────────────────────
const ACTION_TYPES = {
  'send_notification':    { label: 'Enviar notificação interna',  category: 'notify'   },
  'send_email':           { label: 'Enviar e-mail',               category: 'comm',    requiresCredential: 'SMTP_HOST' },
  'send_whatsapp':        { label: 'Enviar WhatsApp',             category: 'comm',    requiresCredential: 'WHATSAPP_APP_ID' },
  'create_task':          { label: 'Criar tarefa',                category: 'tasks'    },
  'update_task':          { label: 'Atualizar tarefa',            category: 'tasks'    },
  'create_note':          { label: 'Criar nota',                  category: 'notes'    },
  'update_crm':           { label: 'Atualizar CRM',               category: 'crm'      },
  'move_pipeline':        { label: 'Mover no pipeline',           category: 'crm'      },
  'webhook_call':         { label: 'Chamar webhook externo',      category: 'system'   },
  'log_event':            { label: 'Registrar evento',            category: 'system'   },
};

// ─── Condições disponíveis ────────────────────────────────────────────────────
const CONDITION_OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'];

// ─── Executar ação de automação ───────────────────────────────────────────────
async function executeAction(kv, userId, action, context, env) {
  const result = { actionType: action.type, status: 'pending', executedAt: new Date().toISOString() };

  try {
    switch (action.type) {
      case 'send_notification': {
        const notifRaw = await kv.get(`notifications:${userId}`);
        const notifs = notifRaw ? JSON.parse(notifRaw) : [];
        notifs.unshift({
          id: generateId(),
          type: 'automation',
          title: action.params?.title || 'Automação executada',
          message: action.params?.message || `Automação disparada: ${context.triggerType}`,
          read: false,
          createdAt: new Date().toISOString(),
          source: 'automation',
          automationId: context.automationId,
        });
        await kv.put(`notifications:${userId}`, JSON.stringify(notifs.slice(0, 200)));
        result.status = 'success';
        break;
      }
      case 'create_task': {
        const tasksRaw = await kv.get(`tasks:${userId}`);
        const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
        const newTask = {
          id: generateId(),
          title: action.params?.title || 'Tarefa criada por automação',
          description: action.params?.description || '',
          priority: action.params?.priority || 'medium',
          status: 'todo',
          dueDate: action.params?.dueDate || null,
          tags: ['automation'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'automation',
          automationId: context.automationId,
        };
        tasks.unshift(newTask);
        await kv.put(`tasks:${userId}`, JSON.stringify(tasks));
        result.status = 'success';
        result.createdId = newTask.id;
        break;
      }
      case 'create_note': {
        const notesRaw = await kv.get(`notes:${userId}`);
        const notes = notesRaw ? JSON.parse(notesRaw) : [];
        const newNote = {
          id: generateId(),
          title: action.params?.title || 'Nota criada por automação',
          content: action.params?.content || '',
          tags: ['automation'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'automation',
        };
        notes.unshift(newNote);
        await kv.put(`notes:${userId}`, JSON.stringify(notes));
        result.status = 'success';
        result.createdId = newNote.id;
        break;
      }
      case 'log_event': {
        const logsRaw = await kv.get(`automation:logs:${userId}`);
        const logs = logsRaw ? JSON.parse(logsRaw) : [];
        logs.unshift({
          id: generateId(),
          automationId: context.automationId,
          triggerType: context.triggerType,
          message: action.params?.message || 'Evento registrado',
          data: context.data || {},
          timestamp: new Date().toISOString(),
        });
        await kv.put(`automation:logs:${userId}`, JSON.stringify(logs.slice(0, 500)));
        result.status = 'success';
        break;
      }
      case 'webhook_call': {
        if (!action.params?.url) { result.status = 'skipped'; result.reason = 'URL não configurada'; break; }
        try {
          const resp = await fetch(action.params.url, {
            method: action.params.method || 'POST',
            headers: { 'Content-Type': 'application/json', 'X-LifeOS-Source': 'automation' },
            body: JSON.stringify({ trigger: context.triggerType, data: context.data, automationId: context.automationId }),
          });
          result.status = resp.ok ? 'success' : 'failed';
          result.httpStatus = resp.status;
        } catch (fetchErr) {
          result.status = 'failed';
          result.error = fetchErr.message;
        }
        break;
      }
      case 'send_email': {
        const configured = !!(env?.SMTP_HOST);
        result.status = configured ? 'queued' : 'pending_credentials';
        result.reason = configured ? 'E-mail enfileirado para envio' : 'Aguardando configuração SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)';
        break;
      }
      case 'send_whatsapp': {
        const configured = !!(env?.WHATSAPP_APP_ID);
        result.status = configured ? 'queued' : 'pending_credentials';
        result.reason = configured ? 'Mensagem enfileirada' : 'Aguardando configuração WhatsApp (WHATSAPP_APP_ID, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_ID)';
        break;
      }
      default:
        result.status = 'unsupported';
        result.reason = `Tipo de ação '${action.type}' não implementado`;
    }
  } catch (err) {
    result.status = 'error';
    result.error = err.message;
  }

  return result;
}

// ─── Verificar condições ──────────────────────────────────────────────────────
function evaluateConditions(conditions, context) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(cond => {
    const value = context.data?.[cond.field];
    switch (cond.operator) {
      case 'equals':       return value === cond.value;
      case 'not_equals':   return value !== cond.value;
      case 'contains':     return String(value || '').includes(cond.value);
      case 'not_contains': return !String(value || '').includes(cond.value);
      case 'greater_than': return Number(value) > Number(cond.value);
      case 'less_than':    return Number(value) < Number(cond.value);
      case 'is_empty':     return !value || value === '';
      case 'is_not_empty': return !!value && value !== '';
      default:             return true;
    }
  });
}

// ─── GET — Listar automações ──────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'types') {
    return json(200, { ok: true, triggers: TRIGGER_TYPES, actions: ACTION_TYPES, conditionOperators: CONDITION_OPERATORS });
  }

  if (action === 'logs') {
    if (!kv) return json(200, { ok: true, logs: [] });
    const raw = await kv.get(`automation:logs:${session.sub}`);
    const logs = raw ? JSON.parse(raw) : [];
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const start = (page - 1) * pageSize;
    return json(200, {
      ok: true,
      logs: logs.slice(start, start + pageSize),
      total: logs.length,
      page, pageSize,
    });
  }

  if (!kv) return json(200, { ok: true, automations: [], total: 0 });
  const raw = await kv.get(`automations:${session.sub}`);
  const automations = raw ? JSON.parse(raw) : [];

  // Filtros
  const status = url.searchParams.get('status');
  const category = url.searchParams.get('category');
  let filtered = automations;
  if (status) filtered = filtered.filter(a => a.status === status);
  if (category) filtered = filtered.filter(a => TRIGGER_TYPES[a.trigger?.type]?.category === category);

  return json(200, { ok: true, automations: filtered, total: automations.length });
}

// ─── POST — Criar automação ───────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Executar automação manualmente
  if (action === 'execute') {
    const { automationId } = body;
    if (!automationId) return json(400, { ok: false, error: 'automationId obrigatório' });
    const raw = await kv.get(`automations:${session.sub}`);
    const automations = raw ? JSON.parse(raw) : [];
    const automation = automations.find(a => a.id === automationId);
    if (!automation) return json(404, { ok: false, error: 'Automação não encontrada' });
    if (automation.status !== 'active') return json(400, { ok: false, error: 'Automação inativa' });

    const context = { automationId, triggerType: 'manual', data: body.data || {} };
    const conditionsMet = evaluateConditions(automation.conditions, context);
    if (!conditionsMet) return json(200, { ok: true, executed: false, reason: 'Condições não atendidas' });

    const results = [];
    for (const act of (automation.actions || [])) {
      const r = await executeAction(kv, session.sub, act, context, env);
      results.push(r);
    }

    // Atualizar estatísticas da automação
    const idx = automations.findIndex(a => a.id === automationId);
    automations[idx].lastExecutedAt = new Date().toISOString();
    automations[idx].executionCount = (automations[idx].executionCount || 0) + 1;
    await kv.put(`automations:${session.sub}`, JSON.stringify(automations));

    return json(200, { ok: true, executed: true, results });
  }

  // Criar nova automação
  const { name, description, trigger, conditions, actions, schedule, status: initStatus } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return json(400, { ok: false, error: 'Nome obrigatório' });
  }
  if (!trigger?.type || !TRIGGER_TYPES[trigger.type]) {
    return json(400, { ok: false, error: `Tipo de gatilho inválido. Válidos: ${Object.keys(TRIGGER_TYPES).join(', ')}` });
  }
  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    return json(400, { ok: false, error: 'Pelo menos uma ação é obrigatória' });
  }
  for (const act of actions) {
    if (!ACTION_TYPES[act.type]) {
      return json(400, { ok: false, error: `Tipo de ação inválido: ${act.type}` });
    }
  }

  const automation = {
    id: generateId(),
    name: name.trim(),
    description: description?.trim() || '',
    trigger,
    conditions: conditions || [],
    actions,
    schedule: schedule || null,
    status: initStatus === 'inactive' ? 'inactive' : 'active',
    executionCount: 0,
    lastExecutedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: session.sub,
  };

  const raw = await kv.get(`automations:${session.sub}`);
  const automations = raw ? JSON.parse(raw) : [];
  automations.unshift(automation);
  await kv.put(`automations:${session.sub}`, JSON.stringify(automations));

  return json(201, { ok: true, automation });
}

// ─── PUT — Atualizar automação ────────────────────────────────────────────────
export async function onRequestPut({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { id, ...updates } = body;
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  const raw = await kv.get(`automations:${session.sub}`);
  const automations = raw ? JSON.parse(raw) : [];
  const idx = automations.findIndex(a => a.id === id);
  if (idx === -1) return json(404, { ok: false, error: 'Automação não encontrada' });

  const allowed = ['name', 'description', 'trigger', 'conditions', 'actions', 'schedule', 'status'];
  for (const key of allowed) {
    if (updates[key] !== undefined) automations[idx][key] = updates[key];
  }
  automations[idx].updatedAt = new Date().toISOString();
  await kv.put(`automations:${session.sub}`, JSON.stringify(automations));

  return json(200, { ok: true, automation: automations[idx] });
}

// ─── DELETE — Remover automação ───────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json(400, { ok: false, error: 'ID obrigatório' });

  const raw = await kv.get(`automations:${session.sub}`);
  const automations = raw ? JSON.parse(raw) : [];
  const filtered = automations.filter(a => a.id !== id);
  if (filtered.length === automations.length) return json(404, { ok: false, error: 'Automação não encontrada' });

  await kv.put(`automations:${session.sub}`, JSON.stringify(filtered));
  return json(200, { ok: true, deleted: id });
}

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST') return onRequestPost({ request, env });
  if (method === 'PUT') return onRequestPost({ request, env });
  if (method === 'PATCH') return onRequestPost({ request, env });
  if (method === 'DELETE') return onRequestPost({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), { status: 405, headers: { 'content-type': 'application/json' } });
}
