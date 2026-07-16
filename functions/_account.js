// LifeOS Enterprise — Account Lifecycle Utilities v16.5

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const EMAIL_CONFIRMATION_TTL_SECONDS = 24 * 60 * 60;
export const EMAIL_CHANGE_TTL_SECONDS = 60 * 60;

const USER_KEY_PREFIXES = [
  'settings:',
  'notifications:',
  'workspaces:',
  'sessions:',
  'onboarding:',
  'security:mfa:',
  'security:devices:',
  'security:policy:',
  'security:audit:',
];

export function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function sessionRecordFromRequest(session, request) {
  const country = request.headers.get('cf-ipcountry') || 'unknown';
  const city = request.cf?.city || '';
  return {
    id: session.jti,
    ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: String(request.headers.get('user-agent') || 'unknown').slice(0, 200),
    country,
    city,
    current: true,
    createdAt: new Date(session.iat).toISOString(),
    expiresAt: new Date(session.exp).toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
}

export async function recordSession(kv, session, request) {
  if (!kv || !session?.sub || !session?.jti) return null;
  const key = `sessions:${session.sub}`;
  const raw = await kv.get(key);
  const now = Date.now();
  let sessions = raw ? JSON.parse(raw) : [];
  sessions = sessions
    .filter((item) => Date.parse(item.expiresAt) > now && item.id !== session.jti)
    .map((item) => ({ ...item, current: false }));
  const current = sessionRecordFromRequest(session, request);
  sessions.unshift(current);
  await kv.put(key, JSON.stringify(sessions.slice(0, 10)), { expirationTtl: SESSION_TTL_SECONDS });
  await registerDevice(kv, session.sub, current);
  return current;
}

export async function registerDevice(kv, email, sessionRecord) {
  const key = `security:devices:${email}`;
  const raw = await kv.get(key);
  const devices = raw ? JSON.parse(raw) : [];
  const fingerprint = `${sessionRecord.userAgent}|${sessionRecord.ip}`;
  const existing = devices.find((item) => item.fingerprint === fingerprint);
  const device = {
    id: existing?.id || `device_${randomToken(12)}`,
    name: browserName(sessionRecord.userAgent),
    userAgent: sessionRecord.userAgent,
    platform: platformName(sessionRecord.userAgent),
    ip: sessionRecord.ip,
    country: sessionRecord.country,
    city: sessionRecord.city,
    trusted: Boolean(existing?.trusted),
    fingerprint,
    registeredAt: existing?.registeredAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
  const updated = [device, ...devices.filter((item) => item.id !== device.id)].slice(0, 20);
  await kv.put(key, JSON.stringify(updated));
  return device;
}

function browserName(userAgent) {
  if (/Edg\//.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//.test(userAgent)) return 'Opera';
  if (/Chrome\//.test(userAgent)) return 'Google Chrome';
  if (/Firefox\//.test(userAgent)) return 'Mozilla Firefox';
  if (/Safari\//.test(userAgent)) return 'Apple Safari';
  return 'Navegador web';
}

function platformName(userAgent) {
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Web';
}

export async function revokeSession(kv, email, sessionId) {
  if (!kv || !sessionId) return false;
  const key = `sessions:${email}`;
  const raw = await kv.get(key);
  const sessions = raw ? JSON.parse(raw) : [];
  const exists = sessions.some((item) => item.id === sessionId);
  await kv.put(key, JSON.stringify(sessions.filter((item) => item.id !== sessionId)));
  await kv.put(`revoked-session:${sessionId}`, '1', { expirationTtl: SESSION_TTL_SECONDS });
  return exists;
}

export async function revokeAllSessions(kv, email, exceptId = null) {
  if (!kv) return;
  const key = `sessions:${email}`;
  const raw = await kv.get(key);
  const sessions = raw ? JSON.parse(raw) : [];
  const remaining = [];
  await Promise.all(sessions.map(async (item) => {
    if (exceptId && item.id === exceptId) {
      remaining.push({ ...item, current: true });
      return;
    }
    await kv.put(`revoked-session:${item.id}`, '1', { expirationTtl: SESSION_TTL_SECONDS });
  }));
  await kv.put(key, JSON.stringify(remaining), { expirationTtl: SESSION_TTL_SECONDS });
}

export async function isSessionRevoked(kv, session) {
  if (!kv || !session?.jti) return false;
  return Boolean(await kv.get(`revoked-session:${session.jti}`));
}

export async function migrateUserKeys(kv, oldEmail, newEmail) {
  for (const prefix of USER_KEY_PREFIXES) {
    const oldKey = `${prefix}${oldEmail}`;
    const value = await kv.get(oldKey);
    if (value !== null) {
      await kv.put(`${prefix}${newEmail}`, value);
      await kv.delete(oldKey);
    }
  }
}

export async function deleteAccountTokens(kv, email, prefixes = ['email-confirm:', 'email-change:', 'reset:']) {
  for (const prefix of prefixes) {
    let cursor;
    do {
      const page = await kv.list({ prefix, cursor });
      for (const key of page.keys) {
        const raw = await kv.get(key.name);
        if (!raw) continue;
        try {
          const data = JSON.parse(raw);
          if (data.email === email || data.oldEmail === email || data.newEmail === email) {
            await kv.delete(key.name);
          }
        } catch {
          await kv.delete(key.name);
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
}

export async function deleteUserKeys(kv, email) {
  await Promise.all([
    kv.delete(`user:${email}`),
    ...USER_KEY_PREFIXES.map((prefix) => kv.delete(`${prefix}${email}`)),
  ]);
  await deleteAccountTokens(kv, email);
}
