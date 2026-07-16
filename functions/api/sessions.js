// LifeOS Enterprise — Sessions Management API v16.5
import { revokeAllSessions, revokeSession, SESSION_TTL_SECONDS } from '../_account.js';
import { expiredSessionCookie, getCookie, json, verifySession } from '../_auth.js';

async function authenticatedSession(request, env) {
  return verifySession(
    getCookie(request.headers.get('cookie')),
    env.LIFEOS_SESSION_SECRET,
    env.LIFEOS_KV,
  );
}

export async function onRequestGet({ request, env }) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await authenticatedSession(request, env);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const key = `sessions:${session.sub}`;
  const raw = await env.LIFEOS_KV.get(key);
  const now = Date.now();
  const stored = raw ? JSON.parse(raw) : [];
  const sessions = stored
    .filter((item) => Date.parse(item.expiresAt) > now)
    .map((item) => ({ ...item, current: item.id === session.jti }));
  if (sessions.length !== stored.length) {
    await env.LIFEOS_KV.put(key, JSON.stringify(sessions), { expirationTtl: SESSION_TTL_SECONDS });
  }
  const devicesRaw = await env.LIFEOS_KV.get(`security:devices:${session.sub}`);
  const devices = devicesRaw ? JSON.parse(devicesRaw) : [];
  const currentSession = sessions.find((item) => item.current);
  const currentFingerprint = currentSession ? `${currentSession.userAgent}|${currentSession.ip}` : null;
  return json(200, {
    ok: true,
    sessions,
    devices: devices.map((device) => ({ ...device, current: device.fingerprint === currentFingerprint })),
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await authenticatedSession(request, env);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  let input;
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }
  const action = String(input.action || '');

  if (action === 'revoke') {
    const sessionId = String(input.id || input.sessionId || '');
    if (!sessionId) return json(400, { ok: false, error: 'ID da sessão obrigatório' });
    await revokeSession(env.LIFEOS_KV, session.sub, sessionId);
    const isCurrent = sessionId === session.jti;
    return json(200, { ok: true, currentRevoked: isCurrent, message: 'Sessão encerrada' }, isCurrent
      ? { 'set-cookie': expiredSessionCookie() }
      : {});
  }

  if (action === 'revoke_all') {
    const includeCurrent = input.includeCurrent === true;
    await revokeAllSessions(env.LIFEOS_KV, session.sub, includeCurrent ? null : session.jti);
    return json(200, {
      ok: true,
      currentRevoked: includeCurrent,
      message: includeCurrent ? 'Todas as sessões foram encerradas' : 'Todas as outras sessões foram encerradas',
    }, includeCurrent ? { 'set-cookie': expiredSessionCookie() } : {});
  }

  if (action === 'device.remove') {
    const deviceId = String(input.deviceId || input.id || '');
    if (!deviceId) return json(400, { ok: false, error: 'ID do dispositivo obrigatório' });
    const deviceKey = `security:devices:${session.sub}`;
    const devicesRaw = await env.LIFEOS_KV.get(deviceKey);
    const devices = devicesRaw ? JSON.parse(devicesRaw) : [];
    const target = devices.find((device) => device.id === deviceId);
    if (!target) return json(404, { ok: false, error: 'Dispositivo não encontrado' });
    const sessionsRaw = await env.LIFEOS_KV.get(`sessions:${session.sub}`);
    const storedSessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
    const matchingSessions = storedSessions.filter((item) => `${item.userAgent}|${item.ip}` === target.fingerprint);
    await Promise.all(matchingSessions.map((item) => revokeSession(env.LIFEOS_KV, session.sub, item.id)));
    await env.LIFEOS_KV.put(deviceKey, JSON.stringify(devices.filter((device) => device.id !== deviceId)));
    const currentRevoked = matchingSessions.some((item) => item.id === session.jti);
    return json(200, { ok: true, currentRevoked, message: 'Dispositivo removido e sessões associadas encerradas' }, currentRevoked
      ? { 'set-cookie': expiredSessionCookie() }
      : {});
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
