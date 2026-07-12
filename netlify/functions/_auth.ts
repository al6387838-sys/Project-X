import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'lifeos_admin_session';

export function json(statusCode: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export function passwordDigest(password: string) {
  return createHash('sha256').update(password, 'utf8').digest('hex');
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function base64url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signature(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSession(username: string, secret: string) {
  const payload = base64url(JSON.stringify({ sub: username, role: 'admin', exp: Date.now() + 12 * 60 * 60 * 1000 }));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySession(token: string | undefined, secret: string) {
  if (!token) return null;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature || !safeEqual(suppliedSignature, signature(payload, secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub: string; role: string; exp: number };
    return data.role === 'admin' && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function getCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) return undefined;
  const item = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return item?.slice(COOKIE_NAME.length + 1);
}

export function sessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
}

export function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
