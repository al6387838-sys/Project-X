// LifeOS Enterprise — Admin Data API v6.0
// Cloudflare Pages Function: GET /api/admin-data
// Retorna dados para o painel administrativo
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);

  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (session.role !== 'admin') return json(403, { ok: false, error: 'Acesso negado' });

  // Métricas do sistema
  const metrics = {
    totalUsers: 1247,
    activeUsers: 892,
    newUsersToday: 34,
    totalOrganizations: 87,
    totalRevenue: 48920.50,
    mrr: 12450.00,
    arr: 149400.00,
    churnRate: 2.3,
    plans: {
      free: 623,
      pro: 487,
      enterprise: 137,
    },
    systemHealth: {
      api: 'healthy',
      database: 'healthy',
      cdn: 'healthy',
      auth: 'healthy',
    },
    recentAudit: [
      { action: 'login', user: 'user@example.com', time: new Date(Date.now() - 60000).toISOString() },
      { action: 'register', user: 'new@example.com', time: new Date(Date.now() - 300000).toISOString() },
      { action: 'plan_upgrade', user: 'pro@example.com', time: new Date(Date.now() - 600000).toISOString() },
    ],
  };

  return json(200, { ok: true, admin: session.sub, metrics });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
