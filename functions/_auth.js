// LifeOS Enterprise — Auth Module para Cloudflare Pages Functions
// Compatível com Web Crypto API (sem node:crypto)

const COOKIE_NAME = 'lifeos_admin_session';

export function json(statusCode, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
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
  if (left.length !== right.length) return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
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

export async function createSession(username, secret) {
  const payloadObj = { sub: username, role: 'admin', exp: Date.now() + 12 * 60 * 60 * 1000 };
  const payload = base64url(JSON.stringify(payloadObj));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifySession(token, secret) {
  if (!token) return null;
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const payload = token.slice(0, dotIdx);
  const suppliedSig = token.slice(dotIdx + 1);
  const valid = await hmacVerify(payload, suppliedSig, secret);
  if (!valid) return null;
  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(decoded);
    return data.role === 'admin' && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function getCookie(cookieHeader) {
  if (!cookieHeader) return undefined;
  const item = cookieHeader.split(';').map(p => p.trim()).find(p => p.startsWith(`${COOKIE_NAME}=`));
  return item?.slice(COOKIE_NAME.length + 1);
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
}

export function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
