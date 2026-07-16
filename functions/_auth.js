// LifeOS Enterprise — Auth Module v7.0 — RBAC (ADMIN + USER + MANAGER + VIEWER)
// Cloudflare Pages Functions — Web Crypto API
// Melhorias v7: jti em tokens, expiração reduzida, validação de tipo, hasPermission
const COOKIE_NAME = 'lifeos_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas
const COOKIE_MAX_AGE = 8 * 60 * 60; // segundos

export function json(statusCode, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

export async function passwordDigest(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  if (left.length !== right.length) return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

function generateJti() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64url(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function hmacSign(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const bytes = Array.from(new Uint8Array(sig));
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function hmacVerify(payload, suppliedSig, secret) {
  const expected = await hmacSign(payload, secret);
  return safeEqual(suppliedSig, expected);
}

// role: 'admin' | 'user' | 'manager' | 'viewer'
export async function createSession(username, role, secret) {
  const payloadObj = {
    sub: username,
    role: role || 'user',
    jti: generateJti(),
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS,
  };
  const payload = base64url(JSON.stringify(payloadObj));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifySession(token, secret, kv = null) {
  if (!token || typeof token !== 'string') return null;
  // Sanitizar: apenas chars válidos de base64url + ponto
  if (!/^[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+$/.test(token)) return null;
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const payload = token.slice(0, dotIdx);
  const suppliedSig = token.slice(dotIdx + 1);
  const valid = await hmacVerify(payload, suppliedSig, secret);
  if (!valid) return null;
  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(decoded);
    if (!data.sub || !data.role || !data.exp || !data.jti) return null;
    if (data.exp <= Date.now()) return null;
    if (kv && await kv.get(`revoked-session:${data.jti}`)) return null;
    return data;
  } catch {
    return null;
  }
}

// Verifica hierarquia de papéis
export function hasPermission(session, requiredRole) {
  const roleHierarchy = { admin: 4, manager: 3, user: 2, viewer: 1 };
  const userLevel = roleHierarchy[session?.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

export function getCookie(cookieHeader) {
  if (!cookieHeader) return undefined;
  const item = cookieHeader.split(';').map(p => p.trim()).find(p => p.startsWith(`${COOKIE_NAME}=`));
  return item?.slice(COOKIE_NAME.length + 1);
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`;
}

export function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
