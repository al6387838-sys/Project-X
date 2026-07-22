// LifeOS Enterprise — Real AI Platform API v2.0
// Cloudflare Pages Function: GET/POST /api/ai/platform
// Phase 228 — Real AI Platform
// OpenAI real · Histórico · Contexto · Memória · Ferramentas · Streaming · Prompts versionados
// Quando não existir chave: "Conecte sua API da OpenAI para habilitar a IA."
// ZERO respostas simuladas.
import { getCookie, json, verifySession } from '../../_auth.js';

// ─── Prompts do sistema versionados ──────────────────────────────────────────
const SYSTEM_PROMPTS = {
  v1: {
    version: 'v1',
    name: 'LifeOS Assistant v1',
    content: `Você é o LifeOS AI Copilot, um assistente inteligente integrado ao LifeOS Enterprise.
Você ajuda usuários a gerenciar tarefas, projetos, hábitos, metas, finanças e produtividade.
Seja conciso, útil e direto. Responda sempre em português brasileiro.
Não invente dados — use apenas informações fornecidas no contexto.
Se não souber algo, diga claramente.`,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  v2: {
    version: 'v2',
    name: 'LifeOS Enterprise Copilot v2',
    content: `Você é o LifeOS Enterprise AI Copilot — um assistente de produtividade e gestão empresarial.
Contexto: plataforma SaaS enterprise com módulos de tarefas, projetos, hábitos, metas, finanças, documentos, comunicação e análises.
Diretrizes:
- Responda sempre em português brasileiro
- Seja preciso, conciso e orientado a ações
- Sugira próximos passos concretos quando relevante
- Não invente dados ou informações não fornecidas
- Para dados financeiros, use apenas valores reais do contexto
- Mantenha tom profissional mas acessível`,
    createdAt: '2026-06-01T00:00:00.000Z',
  },
};
const CURRENT_PROMPT_VERSION = 'v2';

// ─── Ferramentas disponíveis ──────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'Obtém as tarefas do usuário com filtros opcionais',
      parameters: { type: 'object', properties: { status: { type: 'string', enum: ['pending','in_progress','done','all'] }, priority: { type: 'string', enum: ['urgent','high','medium','low'] }, limit: { type: 'number' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_goals',
      description: 'Obtém as metas do usuário',
      parameters: { type: 'object', properties: { status: { type: 'string', enum: ['active','completed','all'] } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_habits',
      description: 'Obtém os hábitos do usuário e status de hoje',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_day',
      description: 'Gera um resumo do dia com tarefas, hábitos e eventos',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

function genId() { return crypto.randomUUID().replace(/-/g,'').slice(0,16); }

async function appendMemory(kv, userId, entry) {
  try {
    const raw = await kv.get(`ai:memory:${userId}`);
    const mem = raw ? JSON.parse(raw) : [];
    mem.unshift({ id: genId(), ...entry, timestamp: new Date().toISOString() });
    await kv.put(`ai:memory:${userId}`, JSON.stringify(mem.slice(0, 100)));
  } catch { /* ignorar */ }
}

async function getConversationHistory(kv, userId, conversationId, limit = 20) {
  try {
    const raw = await kv.get(`ai:conv:${userId}:${conversationId}`);
    const messages = raw ? JSON.parse(raw) : [];
    return messages.slice(-limit);
  } catch { return []; }
}

async function saveConversationHistory(kv, userId, conversationId, messages) {
  try {
    await kv.put(`ai:conv:${userId}:${conversationId}`, JSON.stringify(messages.slice(-100)));
  } catch { /* ignorar */ }
}

async function callOpenAI(apiKey, model, messages, tools, stream = false) {
  const body = { model, messages, stream };
  if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error: ${res.status}`);
  }
  return res;
}

// ─── GET: status, histórico, memória, prompts ─────────────────────────────────
export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'status';

  if (view === 'status') {
    const hasKey = !!env.OPENAI_API_KEY;
    return json(200, {
      ok: true,
      configured: hasKey,
      message: hasKey ? 'OpenAI configurada e pronta.' : 'Conecte sua API da OpenAI para habilitar a IA.',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      promptVersion: CURRENT_PROMPT_VERSION,
      tools: TOOLS.map(t => t.function.name),
    });
  }

  if (view === 'prompts') {
    return json(200, { ok: true, prompts: SYSTEM_PROMPTS, current: CURRENT_PROMPT_VERSION });
  }

  if (view === 'memory') {
    if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
    const raw = await kv.get(`ai:memory:${session.sub}`);
    return json(200, { ok: true, memory: raw ? JSON.parse(raw) : [] });
  }

  if (view === 'conversations') {
    if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
    const raw = await kv.get(`ai:conversations:${session.sub}`);
    return json(200, { ok: true, conversations: raw ? JSON.parse(raw) : [] });
  }

  if (view === 'history') {
    const conversationId = url.searchParams.get('conversationId');
    if (!conversationId) return json(400, { ok: false, error: 'conversationId é obrigatório' });
    if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
    const messages = await getConversationHistory(kv, session.sub, conversationId);
    return json(200, { ok: true, messages, conversationId });
  }

  return json(400, { ok: false, error: 'view inválida. Use: status, prompts, memory, conversations, history' });
}

// ─── POST: chat, streaming, ferramentas ──────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }
  const { action } = body;

  // ── Chat com OpenAI ──────────────────────────────────────────────────────
  if (action === 'chat') {
    if (!env.OPENAI_API_KEY) {
      // Aviso elegante — nunca erro bruto
      return json(200, {
        ok: true,
        configured: false,
        status: 'not_configured',
        message: 'Conecte sua API da OpenAI para habilitar a IA.',
        hint: 'Acesse Configurações > Integrações > OpenAI para adicionar sua chave de API.',
        response: null,
      });
    }
    const { message, conversationId, useTools = true, stream = false, context } = body;
    if (!message) return json(400, { ok: false, error: 'message é obrigatório' });
    const convId = conversationId || genId();
    const model = env.OPENAI_MODEL || 'gpt-4o-mini';
    const systemPrompt = SYSTEM_PROMPTS[CURRENT_PROMPT_VERSION];
    // Carregar histórico da conversa
    const history = kv ? await getConversationHistory(kv, session.sub, convId) : [];
    // Construir mensagens
    const messages = [
      { role: 'system', content: systemPrompt.content + (context ? `\n\nContexto do usuário:\n${JSON.stringify(context)}` : '') },
      ...history,
      { role: 'user', content: message },
    ];
    try {
      if (stream) {
        // Streaming response
        const res = await callOpenAI(env.OPENAI_API_KEY, model, messages, useTools ? TOOLS : [], true);
        // Retornar stream diretamente
        return new Response(res.body, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Transfer-Encoding': 'chunked' },
        });
      }
      // Resposta normal
      const res = await callOpenAI(env.OPENAI_API_KEY, model, messages, useTools ? TOOLS : [], false);
      const data = await res.json();
      const choice = data.choices?.[0];
      const assistantMessage = choice?.message;
      if (!assistantMessage) return json(500, { ok: false, error: 'Resposta inválida da OpenAI' });
      // Salvar no histórico
      if (kv) {
        const updatedHistory = [...history, { role: 'user', content: message }, assistantMessage];
        await saveConversationHistory(kv, session.sub, convId, updatedHistory);
        // Atualizar lista de conversas
        const convsRaw = await kv.get(`ai:conversations:${session.sub}`);
        const convs = convsRaw ? JSON.parse(convsRaw) : [];
        const existingIdx = convs.findIndex(c => c.id === convId);
        const convMeta = { id: convId, lastMessage: message.slice(0, 100), updatedAt: new Date().toISOString(), messageCount: updatedHistory.filter(m => m.role !== 'system').length };
        if (existingIdx >= 0) convs[existingIdx] = convMeta;
        else convs.unshift(convMeta);
        await kv.put(`ai:conversations:${session.sub}`, JSON.stringify(convs.slice(0, 50)));
        // Memória de tópicos importantes
        if (message.length > 50) {
          await appendMemory(kv, session.sub, { type: 'conversation', conversationId: convId, snippet: message.slice(0, 200) });
        }
      }
      return json(200, {
        ok: true,
        message: assistantMessage.content,
        toolCalls: assistantMessage.tool_calls || null,
        conversationId: convId,
        model,
        usage: data.usage,
        promptVersion: CURRENT_PROMPT_VERSION,
      });
    } catch (e) {
      return json(500, { ok: false, error: e.message });
    }
  }

  // ── Limpar histórico de conversa ─────────────────────────────────────────
  if (action === 'clear-conversation') {
    const { conversationId } = body;
    if (!conversationId || !kv) return json(400, { ok: false, error: 'conversationId e armazenamento são obrigatórios' });
    await kv.delete(`ai:conv:${session.sub}:${conversationId}`);
    const convsRaw = await kv.get(`ai:conversations:${session.sub}`);
    if (convsRaw) {
      const convs = JSON.parse(convsRaw).filter(c => c.id !== conversationId);
      await kv.put(`ai:conversations:${session.sub}`, JSON.stringify(convs));
    }
    return json(200, { ok: true, cleared: conversationId });
  }

  // ── Limpar memória ───────────────────────────────────────────────────────
  if (action === 'clear-memory') {
    if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
    await kv.delete(`ai:memory:${session.sub}`);
    return json(200, { ok: true, message: 'Memória limpa com sucesso.' });
  }

  // ── Salvar memória manual ────────────────────────────────────────────────
  if (action === 'save-memory') {
    const { content, type = 'manual' } = body;
    if (!content) return json(400, { ok: false, error: 'content é obrigatório' });
    if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
    await appendMemory(kv, session.sub, { type, content });
    return json(200, { ok: true, message: 'Memória salva.' });
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: chat, clear-conversation, clear-memory, save-memory' });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
