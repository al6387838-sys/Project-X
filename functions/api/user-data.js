// LifeOS Enterprise — User Data API v8.0
// Cloudflare Pages Function: GET /api/user-data
// Phase 131 — Real Data Foundation
// Todos os dados provêm do Cloudflare KV (sem mock)
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  // Dados base derivados da sessão (sem valores mock)
  let userData = {
    username: session.sub,
    role: session.role,
    name: session.sub.split('@')[0],
    plan: 'free',
    lifeScore: 0,
    streak: 0,
    tasksToday: 0,
    tasksCompleted: 0,
    habitsActive: 0,
    habitsCompleted: 0,
    goalsActive: 0,
    goalsProgress: 0,
    insightsCount: 0,
    notifications: 0,
    onboarded: false,
    timezone: 'America/Sao_Paulo',
    createdAt: null,
    updatedAt: null,
  };

  // Carregar dados reais do KV (usuários comuns)
  if (env.LIFEOS_KV && session.role !== 'admin') {
    try {
      const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
      if (raw) {
        const kv = JSON.parse(raw);
        const { passwordHash, ...safeKv } = kv;
        userData = { ...userData, ...safeKv };
      }
    } catch (_) { /* KV indisponível — retornar dados base */ }
  }

  // Admin: dados do perfil administrativo
  if (session.role === 'admin') {
    userData.name = 'Administrador';
    userData.plan = 'enterprise';
    userData.role = 'admin';
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`admin:${session.sub}`);
        if (raw) {
          const kv = JSON.parse(raw);
          const { passwordHash, ...safeKv } = kv;
          userData = { ...userData, ...safeKv };
        }
      } catch (_) { /* ignorar */ }
    }
  }

  return json(200, { ok: true, user: userData });
}

export async function onRequestGet_export({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });
  // Coletar todos os dados do usuário para exportação
  const keys = [
    `user:${session.sub}`,
    `tasks:${session.sub}`,
    `habits:${session.sub}`,
    `goals:${session.sub}`,
    `notes:${session.sub}`,
    `events:${session.sub}`,
    `crm:contacts:${session.sub}`,
    `crm:deals:${session.sub}`,
    `docs:${session.sub}`,
    `timeline:${session.sub}`,
  ];
  const exportData = { exportedAt: new Date().toISOString(), userId: session.sub, data: {} };
  for (const key of keys) {
    try {
      const raw = await kv.get(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const category = key.split(':')[0];
        // Remover dados sensíveis
        if (category === 'user') { const { passwordHash, ...safe } = parsed; exportData.data.profile = safe; }
        else { exportData.data[category] = parsed; }
      }
    } catch (_) { /* ignorar erros de KV */ }
  }
  // Gerar JSON para download
  const json_str = JSON.stringify(exportData, null, 2);
  return new Response(json_str, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="lifeos-export-${new Date().toISOString().slice(0,10)}.json"`,
      'cache-control': 'no-store',
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.searchParams.get('action') === 'export') return onRequestGet_export({ request, env });
    return onRequestGet({ request, env });
  }
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
