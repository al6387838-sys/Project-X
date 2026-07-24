// LifeOS Enterprise — Search API v2.0
// Cloudflare Pages Function: GET /api/search
// Busca global em todos os dados reais do KV
// Suporta filtros por categoria, pesquisa em documentos/fotos/mensagens/calendário/CRM/projetos
import { getCookie, json, verifySession } from '../_auth.js';

const CATEGORY_MAP = {
  tasks: { key: 'tasks', label: 'Tarefas', icon: '✅', typeLabel: 'Tarefa' },
  habits: { key: 'habits', label: 'Hábitos', icon: '🔄', typeLabel: 'Hábito' },
  goals: { key: 'goals', label: 'Metas', icon: '🎯', typeLabel: 'Meta' },
  notes: { key: 'notes', label: 'Notas', icon: '📝', typeLabel: 'Nota' },
  projects: { key: 'projects', label: 'Projetos', icon: '🚀', typeLabel: 'Projeto' },
  documents: { key: 'documents', label: 'Documentos', icon: '📄', typeLabel: 'Documento' },
  events: { key: 'events', label: 'Calendário', icon: '📅', typeLabel: 'Evento' },
  crm: { key: 'crm', label: 'CRM', icon: '👥', typeLabel: 'Contato' },
  messages: { key: 'messages', label: 'Mensagens', icon: '💬', typeLabel: 'Mensagem' },
  photos: { key: 'photos', label: 'Fotos', icon: '🖼️', typeLabel: 'Foto' },
  users: { key: 'users', label: 'Usuários', icon: '👤', typeLabel: 'Usuário' },
  finance: { key: 'finance', label: 'Finanças', icon: '💰', typeLabel: 'Transação' },
};

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').toLowerCase().trim();
  const filter = (url.searchParams.get('filter') || 'all').toLowerCase();
  if (!q) return json(200, { ok: true, results: [], total: 0, filter, suggestions: getSuggestions() });
  if (!kv) return json(200, { ok: true, results: [], total: 0, filter, suggestions: getSuggestions() });

  const results = [];
  const uid = session.sub;

  try {
    // Determine which categories to search
    const categories = filter === 'all'
      ? Object.keys(CATEGORY_MAP)
      : [filter];

    for (const cat of categories) {
      switch (cat) {
        case 'tasks': await searchKV(uid, 'tasks', q, 5, results, matchTask, CATEGORY_MAP.tasks); break;
        case 'habits': await searchKV(uid, 'habits', q, 5, results, matchHabit, CATEGORY_MAP.habits); break;
        case 'goals': await searchKV(uid, 'goals', q, 5, results, matchGoal, CATEGORY_MAP.goals); break;
        case 'notes': await searchKV(uid, 'notes', q, 5, results, matchNote, CATEGORY_MAP.notes); break;
        case 'projects': await searchKV(uid, 'projects', q, 3, results, matchProject, CATEGORY_MAP.projects); break;
        case 'documents': await searchDocuments(uid, q, 5, results, kv); break;
        case 'events': await searchEvents(uid, q, 5, results, kv); break;
        case 'crm': await searchCRM(uid, q, 5, results, kv); break;
        case 'messages': await searchMessages(uid, q, 5, results, kv); break;
        case 'photos': await searchPhotos(uid, q, 5, results, kv); break;
        case 'users': await searchUsers(uid, q, 5, results, kv, env); break;
        case 'finance': await searchFinance(uid, q, 5, results, kv); break;
      }
    }

    // Sort by relevance (exact match first, then starts-with, then contains)
    results.sort((a, b) => {
      if (a._relevance !== b._relevance) return b._relevance - a._relevance;
      return a.title.localeCompare(b.title);
    });

    // Remove internal fields
    const clean = results.slice(0, 30).map(r => {
      const { _relevance, ...rest } = r;
      return rest;
    });

    return json(200, { ok: true, results: clean, total: clean.length, filter, suggestions: getSuggestions() });
  } catch (err) {
    return json(200, { ok: true, results: [], total: 0, filter, error: 'Erro parcial na busca' });
  }
}

// ── SEARCH HELPERS ──────────────────────────────────────────────────────────

async function searchKV(uid, key, q, limit, results, matchFn, cat) {
  const raw = await env.LIFEOS_KV.get(`${key}:${uid}`);
  if (!raw) return;
  try {
    const items = JSON.parse(raw);
    for (const item of items) {
      if (results.length >= 30) return;
      const score = matchFn(item, q);
      if (score > 0) {
        results.push({
          ...cat,
          title: item.title || item.name || '',
          desc: item.description || item.content || item.status || '',
          id: item.id,
          category: key,
          _relevance: score,
        });
        if (results.filter(r => r.category === key).length >= limit) break;
      }
    }
  } catch { /* skip malformed data */ }
}

function matchTask(item, q) {
  const title = (item.title || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  if (title === q) return 3;
  if (title.startsWith(q)) return 2;
  if (title.includes(q) || desc.includes(q)) return 1;
  return 0;
}

function matchHabit(item, q) {
  const title = (item.title || '').toLowerCase();
  if (title === q) return 3;
  if (title.startsWith(q)) return 2;
  if (title.includes(q)) return 1;
  return 0;
}

function matchGoal(item, q) {
  const title = (item.title || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  if (title === q) return 3;
  if (title.startsWith(q)) return 2;
  if (title.includes(q) || desc.includes(q)) return 1;
  return 0;
}

function matchNote(item, q) {
  const title = (item.title || '').toLowerCase();
  const content = (item.content || '').toLowerCase();
  if (title === q) return 3;
  if (title.startsWith(q)) return 2;
  if (title.includes(q) || content.includes(q)) return 1;
  return 0;
}

function matchProject(item, q) {
  const title = (item.title || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  if (title === q) return 3;
  if (title.startsWith(q)) return 2;
  if (title.includes(q) || desc.includes(q)) return 1;
  return 0;
}

async function searchDocuments(uid, q, limit, results, kv) {
  const raw = await kv.get(`documents:${uid}`);
  if (!raw) return;
  try {
    const docs = JSON.parse(raw);
    for (const d of docs) {
      if (d.deleted || results.filter(r => r.category === 'documents').length >= limit) break;
      const name = (d.name || '').toLowerCase();
      const ocr = (d.ocrText || '').toLowerCase();
      const tags = (d.tags || []).join(' ').toLowerCase();
      if (name.includes(q) || ocr.includes(q) || tags.includes(q)) {
        const score = name === q ? 3 : name.startsWith(q) ? 2 : 1;
        results.push({
          typeLabel: 'Documento', icon: '📄', title: d.name || '',
          desc: d.isFolder ? 'Pasta' : (d.type || d.mimeType || 'Arquivo'),
          id: d.id, category: 'documents', _relevance: score,
        });
      }
    }
  } catch { /* skip */ }
}

async function searchEvents(uid, q, limit, results, kv) {
  const raw = await kv.get(`events:${uid}`);
  if (!raw) return;
  try {
    const events = JSON.parse(raw);
    for (const e of events) {
      if (results.filter(r => r.category === 'events').length >= limit) break;
      const title = (e.title || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      if (title.includes(q) || desc.includes(q)) {
        const score = title === q ? 3 : title.startsWith(q) ? 2 : 1;
        results.push({
          typeLabel: 'Evento', icon: '📅', title: e.title || '',
          desc: e.date ? `${e.date} · ${e.location || ''}` : e.location || '',
          id: e.id, category: 'events', _relevance: score,
        });
      }
    }
  } catch { /* skip */ }
}

async function searchCRM(uid, q, limit, results, kv) {
  const contactsRaw = await kv.get(`crm:contacts:${uid}`);
  if (contactsRaw) {
    try {
      const contacts = JSON.parse(contactsRaw);
      for (const c of contacts) {
        if (results.filter(r => r.category === 'crm').length >= limit) break;
        const name = (c.name || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const company = (c.company || '').toLowerCase();
        if (name.includes(q) || email.includes(q) || company.includes(q)) {
          const score = name === q ? 3 : name.startsWith(q) ? 2 : 1;
          results.push({
            typeLabel: 'Contato', icon: '👤', title: c.name || '',
            desc: `${c.company || ''} ${c.email ? '· ' + c.email : ''}`,
            id: c.id, category: 'crm', _relevance: score,
          });
        }
      }
    } catch { /* skip */ }
  }

  const dealsRaw = await kv.get(`crm:deals:${uid}`);
  if (dealsRaw) {
    try {
      const deals = JSON.parse(dealsRaw);
      for (const d of deals) {
        if (results.filter(r => r.category === 'crm').length >= limit) break;
        const title = (d.title || '').toLowerCase();
        const company = (d.company || '').toLowerCase();
        if (title.includes(q) || company.includes(q)) {
          results.push({
            typeLabel: 'Deal', icon: '💼', title: d.title || '',
            desc: `${d.company || ''} · R$ ${d.value || 0}`,
            id: d.id, category: 'crm', _relevance: title === q ? 3 : title.startsWith(q) ? 2 : 1,
          });
        }
      }
    } catch { /* skip */ }
  }
}

async function searchMessages(uid, q, limit, results, kv) {
  const raw = await kv.get(`messages:${uid}`);
  if (!raw) return;
  try {
    const messages = JSON.parse(raw);
    for (const m of messages) {
      if (results.filter(r => r.category === 'messages').length >= limit) break;
      const body = (m.body || '').toLowerCase();
      const sender = (m.sender || '').toLowerCase();
      const subject = (m.subject || '').toLowerCase();
      if (body.includes(q) || sender.includes(q) || subject.includes(q)) {
        results.push({
          typeLabel: 'Mensagem', icon: '💬', title: subject || sender || '',
          desc: `${sender || ''} · ${new Date(m.date || Date.now()).toLocaleDateString('pt-BR')}`,
          id: m.id, category: 'messages', _relevance: subject === q ? 3 : subject.startsWith(q) ? 2 : 1,
        });
      }
    }
  } catch { /* skip */ }
}

async function searchPhotos(uid, q, limit, results, kv) {
  const raw = await kv.get(`photos:${uid}`);
  if (!raw) return;
  try {
    const photos = JSON.parse(raw);
    for (const p of photos) {
      if (p.deleted || results.filter(r => r.category === 'photos').length >= limit) break;
      const name = (p.name || '').toLowerCase();
      const tags = (p.tags || []).join(' ').toLowerCase();
      const album = (p.album || '').toLowerCase();
      if (name.includes(q) || tags.includes(q) || album.includes(q)) {
        results.push({
          typeLabel: 'Foto', icon: '🖼️', title: p.name || 'Sem nome',
          desc: `${p.album || 'Sem álbum'} · ${p.type || 'image'}`,
          id: p.id, category: 'photos', _relevance: name === q ? 3 : name.startsWith(q) ? 2 : 1,
        });
      }
    }
  } catch { /* skip */ }
}

async function searchUsers(uid, q, limit, results, kv, env) {
  const usersRaw = await kv.get('admin:users');
  if (!usersRaw) return;
  try {
    const users = JSON.parse(usersRaw);
    for (const u of users) {
      if (results.filter(r => r.category === 'users').length >= limit) break;
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      if (name.includes(q) || email.includes(q)) {
        results.push({
          typeLabel: 'Usuário', icon: '👤', title: u.name || '',
          desc: `${u.email || ''} · ${u.role || 'user'}`,
          id: u.id || u.email, category: 'users', _relevance: name === q ? 3 : name.startsWith(q) ? 2 : 1,
        });
      }
    }
  } catch { /* skip */ }
}

async function searchFinance(uid, q, limit, results, kv) {
  const raw = await kv.get(`finance:${uid}`);
  if (!raw) return;
  try {
    const items = JSON.parse(raw);
    for (const f of items) {
      if (results.filter(r => r.category === 'finance').length >= limit) break;
      const desc = (f.description || '').toLowerCase();
      const cat = (f.category || '').toLowerCase();
      if (desc.includes(q) || cat.includes(q)) {
        results.push({
          typeLabel: 'Finança', icon: '💰', title: f.description || '',
          desc: `R$ ${f.amount || 0} · ${f.category || ''} · ${f.date || ''}`,
          id: f.id, category: 'finance', _relevance: desc === q ? 3 : desc.startsWith(q) ? 2 : 1,
        });
      }
    }
  } catch { /* skip */ }
}

function getSuggestions() {
  return [
    { title: 'Tarefas', page: 'tasks', icon: 'tasks', type: 'Módulo' },
    { title: 'Projetos', page: 'projects', icon: 'projects', type: 'Módulo' },
    { title: 'Documentos', page: 'documents', icon: 'documents', type: 'Módulo' },
    { title: 'Calendário', page: 'calendar', icon: 'calendar', type: 'Módulo' },
    { title: 'CRM', page: 'crm', icon: 'crm', type: 'Módulo' },
    { title: 'Finanças', page: 'finance', icon: 'finance', type: 'Módulo' },
    { title: 'Hábitos', page: 'habits', icon: 'habits', type: 'Módulo' },
    { title: 'Fotos', page: 'photos', icon: 'photos', type: 'Módulo' },
    { title: 'Mensagens', page: 'messages', icon: 'messages', type: 'Módulo' },
    { title: 'Configurações', page: 'settings', icon: 'settings', type: 'Config' },
  ];
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
