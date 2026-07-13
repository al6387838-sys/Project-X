// LifeOS Enterprise — Global Security Middleware v7.0
// Aplica headers de segurança enterprise em todas as rotas
// HSTS, CSP, CORS, X-Frame-Options, etc.

const SECURITY_HEADERS = {
  // Previne MIME sniffing
  'X-Content-Type-Options': 'nosniff',
  // Bloqueia iframes externos
  'X-Frame-Options': 'DENY',
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Desabilita recursos sensíveis
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  // Isolamento de origem
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // HSTS (somente HTTPS)
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // CSP rigorosa
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
};

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  // Bloquear métodos não permitidos em rotas de API
  if (url.pathname.startsWith('/api/')) {
    const allowedMethods = ['GET', 'POST', 'OPTIONS', 'HEAD'];
    if (!allowedMethods.includes(request.method)) {
      return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), {
        status: 405,
        headers: {
          'content-type': 'application/json',
          'allow': 'GET, POST, OPTIONS, HEAD',
          ...SECURITY_HEADERS,
        },
      });
    }

    // CORS: apenas mesma origem para APIs
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

  // Continuar para o próximo handler
  const response = await next();

  // Clonar e adicionar headers de segurança
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // Não sobrescrever CSP em rotas de API (já têm cache-control: no-store)
    if (key === 'Content-Security-Policy' && url.pathname.startsWith('/api/')) continue;
    newHeaders.set(key, value);
  }

  // Remover headers de informação de servidor
  newHeaders.delete('server');
  newHeaders.delete('x-powered-by');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
