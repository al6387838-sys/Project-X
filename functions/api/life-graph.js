// LifeOS Enterprise — Life Graph API v1.0
// Cloudflare Pages Function: GET/POST/DELETE /api/life-graph
// Phase 200 — Real Data Migration (zero mocks)
// Nós e conexões do grafo de vida do usuário
import { getCookie, json, verifySession } from '../_auth.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

const NODE_COLORS = {
  carreira: '#6366F1',
  saude: '#10B981',
  financas: '#F59E0B',
  relacionamentos: '#EC4899',
  aprendizado: '#8B5CF6',
  pessoal: '#3B82F6',
  habito: '#14B8A6',
  meta: '#F97316',
};

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(200, { ok: true, nodes: [], edges: [], source: 'empty' });
  try {
    // Nós customizados salvos pelo usuário
    const graphRaw = await kv.get(`lifegraph:${session.sub}`);
    const customGraph = graphRaw ? JSON.parse(graphRaw) : { nodes: [], edges: [] };
    // Gerar nós automaticamente a partir de dados reais
    const autoNodes = [];
    const autoEdges = [];
    // Nó central: usuário
    const userRaw = await kv.get(`user:${session.sub}`);
    const user = userRaw ? JSON.parse(userRaw) : {};
    const centerNode = {
      id: 'center',
      label: user.name || session.sub.split('@')[0] || 'Você',
      type: 'center',
      color: '#6366F1',
      size: 1.5,
      auto: true,
    };
    autoNodes.push(centerNode);
    // Nós de metas ativas
    const goalsRaw = await kv.get(`goals:${session.sub}`);
    const goals = goalsRaw ? JSON.parse(goalsRaw) : [];
    goals.filter(g => g.status === 'active').slice(0, 6).forEach(g => {
      const nodeId = `goal-${g.id}`;
      autoNodes.push({
        id: nodeId,
        label: g.title,
        type: 'meta',
        category: g.category || 'pessoal',
        color: NODE_COLORS[g.category] || NODE_COLORS.meta,
        progress: g.progress || 0,
        size: 1.0,
        auto: true,
      });
      autoEdges.push({ from: 'center', to: nodeId, strength: (g.progress || 0) / 100 });
    });
    // Nós de hábitos ativos
    const habitsRaw = await kv.get(`habits:${session.sub}`);
    const habits = habitsRaw ? JSON.parse(habitsRaw) : [];
    habits.filter(h => h.active !== false).slice(0, 6).forEach(h => {
      const nodeId = `habit-${h.id}`;
      autoNodes.push({
        id: nodeId,
        label: h.name,
        type: 'habito',
        color: NODE_COLORS.habito,
        streak: h.streak || 0,
        size: 0.8,
        auto: true,
      });
      autoEdges.push({ from: 'center', to: nodeId, strength: Math.min((h.streak || 0) / 30, 1) });
    });
    // Combinar nós automáticos com customizados
    const allNodes = [...autoNodes, ...customGraph.nodes.filter(n => !n.auto)];
    const allEdges = [...autoEdges, ...customGraph.edges.filter(e => !e.auto)];
    return json(200, {
      ok: true,
      nodes: allNodes,
      edges: allEdges,
      total: allNodes.length,
      source: 'real',
    });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar Life Graph' });
  }
}

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
  const { label, type, category, connectedTo } = body;
  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    return json(400, { ok: false, error: 'Label obrigatório' });
  }
  const node = {
    id: generateId(),
    label: label.trim(),
    type: type || 'pessoal',
    category: category || 'pessoal',
    color: NODE_COLORS[category] || NODE_COLORS.pessoal,
    size: 1.0,
    auto: false,
    createdAt: new Date().toISOString(),
  };
  try {
    const graphRaw = await kv.get(`lifegraph:${session.sub}`);
    const graph = graphRaw ? JSON.parse(graphRaw) : { nodes: [], edges: [] };
    graph.nodes.push(node);
    if (connectedTo) {
      graph.edges.push({ from: connectedTo, to: node.id, strength: 0.5, auto: false });
    }
    await kv.put(`lifegraph:${session.sub}`, JSON.stringify(graph));
    return json(201, { ok: true, node });
  } catch {
    return json(500, { ok: false, error: 'Erro ao salvar nó' });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' });
}
