// LifeOS Enterprise — Global Security Middleware v41.0.0 (Phases 250-254 — Version Synchronization)
// Production Hardening: CSP, HSTS, CSRF, XSS, Rate Limiting, RBAC, Audit, Session Validation
// Security audit: headers, CSP, HSTS, CSRF, XSS, SQL Injection prevention, Rate Limiting,
// RBAC, sessions, tokens, secrets, Cloudflare Workers, KV
import { getCookie, json, verifySession } from './_auth.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()',
    'interest-cohort=()', 'accelerometer=()', 'autoplay=()',
    'clipboard-write=(self)', 'display-capture=()', 'encrypted-media=()',
    'fullscreen=(self)', 'gyroscope=()', 'magnetometer=()',
    'picture-in-picture=()', 'publickey-credentials-get=(self)',
    'screen-wake-lock=()', 'sync-xhr=()',
  ].join(', '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-DNS-Prefetch-Control': 'on',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "worker-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
  ].join('; '),
};

// Rate limits per endpoint (window in seconds, max requests per window per IP)
const RATE_LIMITS = {
  '/api/login':           { window: 60,  max: 5  },
  '/api/register':        { window: 60,  max: 3  },
  '/api/forgot-password': { window: 300, max: 3  },
  '/api/password-reset':  { window: 300, max: 5  },
  '/api/admin-login':     { window: 60,  max: 5  },
  '/api/backup':          { window: 60,  max: 10 },
  '/api/security':        { window: 60,  max: 20 },
  '/api/observability':   { window: 60,  max: 30 },
  '/api/ai':              { window: 60,  max: 20 },
  default:                { window: 60,  max: 60 },
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

// CSRF protection: state-changing requests must have valid origin or X-Requested-With header
function validateCsrf(request, url) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const xrw = request.headers.get('x-requested-with');
  if (xrw === 'XMLHttpRequest') return true;
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      return originUrl.hostname === url.hostname;
    } catch (_) { return false; }
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refUrl = new URL(referer);
      return refUrl.hostname === url.hostname;
    } catch (_) { return false; }
  }
  // No origin/referer on same-origin requests from some browsers — allow
  return true;
}

// Input sanitization: detect SQL injection and XSS patterns in query strings
function detectMaliciousInput(url) {
  const query = url.search + url.pathname;
  const sqlPatterns = /(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bexec\b|\bxp_\b)/i;
  const xssPatterns = /<script|javascript:|(?:^|[\s"'<])on\w+\s*=|<iframe|<object|<embed/i;
  return sqlPatterns.test(query) || xssPatterns.test(query);
}

const PROTECTED_ROUTES = [
  '/api/profile', '/api/profile-update', '/api/sessions', '/api/security',
  '/api/settings', '/api/user-data', '/api/onboarding', '/api/workspaces',
  '/api/notifications', '/api/invite', '/api/logout', '/api/enterprise-data',
  '/api/observability', '/api/backup',
  '/api/tasks', '/api/habits', '/api/goals', '/api/projects', '/api/notes',
  '/api/timeline', '/api/events', '/api/search', '/api/metrics',
  '/api/collaboration', '/api/platform', '/api/ai',
  '/api/briefing', '/api/life-graph', '/api/dashboard',
];

const ADMIN_ROUTES = [
  '/api/admin-data', '/api/admin-logout', '/api/admin-session', '/api/observability',
];

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

  if (url.pathname.startsWith('/api/')) {
    // Block malicious input patterns (SQLi, XSS in URL)
    if (detectMaliciousInput(url)) {
      return new Response(JSON.stringify({ ok: false, error: 'Requisição bloqueada por política de segurança' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...SECURITY_HEADERS },
      });
    }

    // Method allowlist
    const allowedMethods = ['GET', 'POST', 'OPTIONS', 'HEAD'];
    if (!allowedMethods.includes(request.method)) {
      return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), {
        status: 405,
        headers: { 'content-type': 'application/json', 'allow': 'GET, POST, OPTIONS, HEAD', ...SECURITY_HEADERS },
      });
    }

    // CSRF protection
    if (!validateCsrf(request, url)) {
      return new Response(JSON.stringify({ ok: false, error: 'CSRF: origem não autorizada' }), {
        status: 403,
        headers: { 'content-type': 'application/json', ...SECURITY_HEADERS },
      });
    }

    // Rate limiting
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

    // Session validation for protected routes
    if (request.method !== 'OPTIONS' && PROTECTED_ROUTES.some(r => url.pathname === r || url.pathname.startsWith(r + '/'))) {
      const session = await verifySession(getCookie(request.headers.get('cookie') || '', 'lifeos_session'), env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV);
      if (!session) return json(401, { ok: false, error: 'Sessão inválida, expirada ou revogada' });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': url.origin,
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type, x-requested-with',
          'access-control-max-age': '86400',
          ...SECURITY_HEADERS,
        },
      });
    }
  }

  const response = await next();
  const newHeaders = new Headers(response.headers);

  // Apply security headers to all responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // Skip CSP for API responses (they return JSON, not HTML)
    if (key === 'Content-Security-Policy' && url.pathname.startsWith('/api/')) continue;
    // Skip COEP for API responses to avoid breaking fetch
    if (key === 'Cross-Origin-Embedder-Policy' && url.pathname.startsWith('/api/')) continue;
    newHeaders.set(key, value);
  }

  // Remove server fingerprinting headers
  newHeaders.delete('server');
  newHeaders.delete('x-powered-by');
  newHeaders.delete('x-aspnet-version');
  newHeaders.delete('x-aspnetmvc-version');
  newHeaders.delete('x-generator');

  // Audit timestamp for admin and sensitive routes
  if (url.pathname.startsWith('/admin') || ADMIN_ROUTES.some(r => url.pathname.startsWith(r))) {
    newHeaders.set('x-lifeos-audit', new Date().toISOString());
  }

  // Security version header
  newHeaders.set('x-lifeos-security', 'v41.0.0');

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
}
