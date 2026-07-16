// LifeOS Enterprise — Global Security Middleware v19.0 (Phase 182)
// Production Hardening: CSP, HSTS, Rate Limiting, Audit, Session Validation
import { getCookie, json, verifySession } from './_auth.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), accelerometer=(), autoplay=(), clipboard-write=(self), display-capture=(), encrypted-media=(), fullscreen=(self), gyroscope=(), magnetometer=(), picture-in-picture=(), publickey-credentials-get=(self), screen-wake-lock=(), sync-xhr=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-DNS-Prefetch-Control': 'on',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
  ].join('; '),
};

const RATE_LIMITS = {
  '/api/login':           { window: 60, max: 5 },
  '/api/register':        { window: 60, max: 3 },
  '/api/forgot-password': { window: 300, max: 3 },
  '/api/password-reset':  { window: 300, max: 5 },
  '/api/admin-login':     { window: 60, max: 5 },
  default:                { window: 60, max: 60 },
};

async function applyRateLimit(kv, ip, pathname) {
  if (!kv || !ip) return { allowed: true };
  const config = RATE_LIMITS[pathname] || RATE_LIMITS.default;
  const key = 'rl:' + pathname + ':' + ip;
  try {
    const raw = await kv.get(key);
    const data = raw ? JSON.parse(raw) : { count: 0, resetAt: Date.now() + config.window * 1000 };
    if (Date.now() > data.resetAt) { data.count = 0; data.resetAt = Date.now() + config.window * 1000; }
    data.count += 1;
    await kv.put(key, JSON.stringify(data), { expirationTtl: config.window });
    const remaining = Math.max(0, config.max - data.count);
    return { allowed: data.count <= config.max, remaining, resetAt: data.resetAt, limit: config.max };
  } catch (_) {
    return { allowed: true, remaining: config.max, limit: config.max };
  }
}

const PROTECTED_ROUTES = [
  '/api/profile', '/api/profile-update', '/api/sessions', '/api/security',
  '/api/settings', '/api/user-data', '/api/onboarding', '/api/workspaces',
  '/api/notifications', '/api/invite', '/api/logout', '/api/enterprise-data',
  '/api/observability',
];

const ADMIN_ROUTES = [
  '/api/admin-data', '/api/admin-logout', '/api/admin-session', '/api/observability',
];

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

  if (url.pathname.startsWith('/api/')) {
    const allowedMethods = ['GET', 'POST', 'OPTIONS', 'HEAD'];
    if (!allowedMethods.includes(request.method)) {
      return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), {
        status: 405,
        headers: { 'content-type': 'application/json', 'allow': 'GET, POST, OPTIONS, HEAD', ...SECURITY_HEADERS },
      });
    }

    if (request.method !== 'OPTIONS') {
      const rl = await applyRateLimit(env.LIFEOS_KV, ip, url.pathname);
      if (!rl.allowed) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Muitas requisições. Tente novamente em instantes.',
          retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
        }), {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            'x-ratelimit-limit': String(rl.limit),
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.ceil(rl.resetAt / 1000)),
            ...SECURITY_HEADERS,
          },
        });
      }
    }

    if (request.method !== 'OPTIONS' && PROTECTED_ROUTES.some(r => url.pathname === r || url.pathname.startsWith(r + '/'))) {
      const secret = env.LIFEOS_SESSION_SECRET;
      const session = secret ? await verifySession(getCookie(request.headers.get('cookie')), secret, env.LIFEOS_KV) : null;
      if (!session) return json(401, { ok: false, error: 'Sessão inválida, expirada ou revogada' });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': url.origin,
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
          ...SECURITY_HEADERS,
        },
      });
    }
  }

  const response = await next();
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (key === 'Content-Security-Policy' && url.pathname.startsWith('/api/')) continue;
    newHeaders.set(key, value);
  }
  newHeaders.delete('server');
  newHeaders.delete('x-powered-by');
  newHeaders.delete('x-aspnet-version');
  newHeaders.delete('x-aspnetmvc-version');
  if (url.pathname.startsWith('/admin') || ADMIN_ROUTES.some(r => url.pathname.startsWith(r))) {
    newHeaders.set('x-lifeos-audit', new Date().toISOString());
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
}
