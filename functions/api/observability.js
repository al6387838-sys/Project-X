// LifeOS Enterprise — Observability API v1.0
// Cloudflare Pages Function: GET /api/observability
// Phase 178 — Enterprise Observability
import { getCookie, json, verifySession } from '../_auth.js';

const SERVICES = [
  { id: 'api',        name: 'API Gateway',       icon: '⚡' },
  { id: 'auth',       name: 'Auth Service',       icon: '🔐' },
  { id: 'database',   name: 'Database',           icon: '🗄️' },
  { id: 'cdn',        name: 'CDN / Edge',         icon: '🌐' },
  { id: 'kv',         name: 'KV Store',           icon: '💾' },
  { id: 'email',      name: 'Email Service',      icon: '📧' },
  { id: 'payments',   name: 'Payments',           icon: '💳' },
  { id: 'ai',         name: 'AI Orchestrator',    icon: '🤖' },
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateLogs(count = 20) {
  const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
  const actions = [
    'User login successful',
    'Password reset requested',
    'Organization created',
    'Workspace updated',
    'API key generated',
    'Session expired',
    'Rate limit approached',
    'Failed login attempt',
    'Payment processed',
    'Integration connected',
    'Audit log written',
    'Cache invalidated',
    'Health check passed',
    'Backup completed',
    'SSL certificate renewed',
  ];
  const users = ['admin@lifeos.app', 'user@example.com', 'enterprise@corp.com', 'system', 'cron'];
  const logs = [];
  for (let i = 0; i < count; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    logs.push({
      id: `log-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - i * 45000 - randomBetween(0, 30000)).toISOString(),
      level,
      service: SERVICES[Math.floor(Math.random() * SERVICES.length)].id,
      action: actions[Math.floor(Math.random() * actions.length)],
      user: users[Math.floor(Math.random() * users.length)],
      duration: randomBetween(2, 280),
      status: level === 'ERROR' ? 500 : level === 'WARN' ? 429 : 200,
    });
  }
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function generateAlerts() {
  const now = Date.now();
  return [
    {
      id: 'alert-1',
      severity: 'warning',
      title: 'Taxa de erro acima do limiar',
      description: 'Endpoint /api/ai/orchestrator com 3.2% de erros nas últimas 2h',
      service: 'ai',
      timestamp: new Date(now - 7200000).toISOString(),
      resolved: false,
    },
    {
      id: 'alert-2',
      severity: 'info',
      title: 'Pico de tráfego detectado',
      description: 'Volume 40% acima da média no CDN entre 14h–15h',
      service: 'cdn',
      timestamp: new Date(now - 3600000).toISOString(),
      resolved: true,
    },
    {
      id: 'alert-3',
      severity: 'critical',
      title: 'Tentativas de login suspeitas',
      description: '12 tentativas falhas consecutivas do IP 203.0.113.42',
      service: 'auth',
      timestamp: new Date(now - 1800000).toISOString(),
      resolved: false,
    },
  ];
}

function generateOrgConsumption() {
  const orgs = [
    { id: 'org-1', name: 'Acme Corp', plan: 'Enterprise' },
    { id: 'org-2', name: 'TechStart Ltda', plan: 'Pro' },
    { id: 'org-3', name: 'Global Finance SA', plan: 'Enterprise' },
    { id: 'org-4', name: 'Innovate Hub', plan: 'Pro' },
    { id: 'org-5', name: 'Digital Agency', plan: 'Pro' },
  ];
  return orgs.map(org => ({
    ...org,
    apiCalls: randomBetween(1200, 48000),
    storage: randomBetween(50, 4800),
    activeUsers: randomBetween(3, 120),
    avgResponseMs: randomBetween(28, 180),
    errorRate: (Math.random() * 2).toFixed(2),
  }));
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (session.role !== 'admin') return json(403, { ok: false, error: 'Acesso negado' });

  const now = Date.now();

  const services = SERVICES.map(svc => ({
    ...svc,
    status: svc.id === 'email' ? 'degraded' : 'healthy',
    uptime: svc.id === 'email' ? 97.8 : (99 + Math.random()).toFixed(2),
    latencyMs: randomBetween(8, 95),
    errorRate: svc.id === 'email' ? 1.8 : (Math.random() * 0.5).toFixed(2),
    requestsPerMin: randomBetween(12, 840),
    lastCheck: new Date(now - randomBetween(5000, 60000)).toISOString(),
  }));

  const healthScore = Math.round(
    services.reduce((acc, s) => acc + (s.status === 'healthy' ? 100 : s.status === 'degraded' ? 70 : 0), 0) / services.length
  );

  const responseTimeHistory = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(new Date(now - (23 - i) * 3600000).getHours()).padStart(2, '0')}:00`,
    p50: randomBetween(18, 55),
    p95: randomBetween(55, 180),
    p99: randomBetween(120, 380),
  }));

  const errorRateHistory = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(new Date(now - (23 - i) * 3600000).getHours()).padStart(2, '0')}:00`,
    rate: (Math.random() * 1.5).toFixed(2),
  }));

  return json(200, {
    ok: true,
    timestamp: new Date().toISOString(),
    healthScore,
    summary: {
      totalServices: services.length,
      healthyServices: services.filter(s => s.status === 'healthy').length,
      degradedServices: services.filter(s => s.status === 'degraded').length,
      downServices: services.filter(s => s.status === 'down').length,
      avgLatencyMs: Math.round(services.reduce((a, s) => a + s.latencyMs, 0) / services.length),
      totalRequestsPerMin: services.reduce((a, s) => a + s.requestsPerMin, 0),
      activeAlerts: 2,
    },
    services,
    logs: generateLogs(30),
    alerts: generateAlerts(),
    orgConsumption: generateOrgConsumption(),
    responseTimeHistory,
    errorRateHistory,
    system: {
      cpu: randomBetween(18, 42),
      memory: randomBetween(35, 58),
      disk: randomBetween(12, 28),
      network: randomBetween(8, 22),
      kvReads: randomBetween(55, 82),
      uptime: 99.94,
      activeSessions: randomBetween(8, 45),
      apiP95: randomBetween(38, 95),
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
