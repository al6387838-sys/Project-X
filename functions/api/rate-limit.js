// LifeOS Enterprise — Rate Limit Utility v7.0
// Usado internamente pelas APIs para proteger contra brute force
import { json } from '../_auth.js';

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 10;

export async function checkRateLimit(kv, key, maxAttempts = MAX_ATTEMPTS) {
  if (!kv) return { allowed: true, remaining: maxAttempts };

  try {
    const rlKey = `rl:${key}`;
    const raw = await kv.get(rlKey);
    const data = raw ? JSON.parse(raw) : { count: 0, resetAt: Date.now() + WINDOW_SECONDS * 1000 };

    if (Date.now() > data.resetAt) {
      data.count = 0;
      data.resetAt = Date.now() + WINDOW_SECONDS * 1000;
    }

    data.count += 1;
    await kv.put(rlKey, JSON.stringify(data), { expirationTtl: WINDOW_SECONDS });

    const remaining = Math.max(0, maxAttempts - data.count);
    return { allowed: data.count <= maxAttempts, remaining, resetAt: data.resetAt };
  } catch (_) {
    return { allowed: true, remaining: maxAttempts };
  }
}

export async function onRequest() {
  return json(404, { ok: false, error: 'Not found' });
}
