// LifeOS Enterprise — Email Confirmation v16.5
import {
  deleteAccountTokens,
  EMAIL_CONFIRMATION_TTL_SECONDS,
  migrateUserKeys,
  randomToken,
  recordSession,
  revokeAllSessions,
} from '../_account.js';
import {
  createSession,
  expiredSessionCookie,
  json,
  sessionCookie,
  verifySession,
} from '../_auth.js';
import { confirmationEmail, sendTransactionalEmail } from '../_email.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

async function confirmRegistration(request, env, token, record) {
  const userRaw = await env.LIFEOS_KV.get(`user:${record.email}`);
  if (!userRaw) return json(400, { ok: false, error: 'Conta não encontrada' });
  const user = JSON.parse(userRaw);
  const now = new Date().toISOString();
  user.emailVerified = true;
  user.emailVerifiedAt = now;
  user.status = 'active';
  user.updatedAt = now;
  await env.LIFEOS_KV.put(`user:${record.email}`, JSON.stringify(user));
  await deleteAccountTokens(env.LIFEOS_KV, record.email, ['email-confirm:']);

  const authToken = await createSession(record.email, user.role || 'user', env.LIFEOS_SESSION_SECRET);
  const session = await verifySession(authToken, env.LIFEOS_SESSION_SECRET);
  await recordSession(env.LIFEOS_KV, session, request);
  return json(200, {
    ok: true,
    message: 'E-mail confirmado. Sua conta está ativa.',
    redirect: '/app?onboarding=true',
  }, { 'set-cookie': sessionCookie(authToken) });
}

async function confirmEmailChange(env, token, record) {
  const oldEmail = record.oldEmail;
  const newEmail = record.newEmail;
  const oldRaw = await env.LIFEOS_KV.get(`user:${oldEmail}`);
  if (!oldRaw) return json(400, { ok: false, error: 'Conta não encontrada' });
  if (await env.LIFEOS_KV.get(`user:${newEmail}`)) {
    return json(409, { ok: false, error: 'O novo e-mail já está em uso' });
  }

  const user = JSON.parse(oldRaw);
  await revokeAllSessions(env.LIFEOS_KV, oldEmail);
  await migrateUserKeys(env.LIFEOS_KV, oldEmail, newEmail);
  user.email = newEmail;
  user.emailVerified = true;
  user.emailVerifiedAt = new Date().toISOString();
  user.updatedAt = user.emailVerifiedAt;
  await env.LIFEOS_KV.put(`user:${newEmail}`, JSON.stringify(user));
  await env.LIFEOS_KV.delete(`user:${oldEmail}`);
  await env.LIFEOS_KV.delete(`email-change:${token}`);

  return json(200, {
    ok: true,
    message: 'Novo e-mail confirmado. Entre novamente com o endereço atualizado.',
    redirect: '/login?email_changed=1',
  }, { 'set-cookie': expiredSessionCookie() });
}

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_KV || !env.LIFEOS_SESSION_SECRET) {
    return json(503, { ok: false, error: 'Serviço de conta indisponível' });
  }
  let input;
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }
  const action = String(input.action || 'confirm');

  if (action === 'confirm') {
    const token = String(input.token || '').trim();
    if (!token) return json(400, { ok: false, error: 'Token obrigatório' });

    const registrationRaw = await env.LIFEOS_KV.get(`email-confirm:${token}`);
    if (registrationRaw) return confirmRegistration(request, env, token, JSON.parse(registrationRaw));

    const changeRaw = await env.LIFEOS_KV.get(`email-change:${token}`);
    if (changeRaw) return confirmEmailChange(env, token, JSON.parse(changeRaw));

    return json(400, { ok: false, error: 'Link inválido ou expirado' });
  }

  if (action === 'resend') {
    const email = String(input.email || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) return json(400, { ok: false, error: 'E-mail inválido' });
    const userRaw = await env.LIFEOS_KV.get(`user:${email}`);
    if (!userRaw) return json(200, { ok: true, message: 'Se houver uma conta pendente, um novo link será enviado.' });
    const user = JSON.parse(userRaw);
    if (user.emailVerified) return json(200, { ok: true, message: 'Este e-mail já está confirmado.' });

    await deleteAccountTokens(env.LIFEOS_KV, email, ['email-confirm:']);
    const token = randomToken();
    await env.LIFEOS_KV.put(`email-confirm:${token}`, JSON.stringify({ email, createdAt: new Date().toISOString() }), {
      expirationTtl: EMAIL_CONFIRMATION_TTL_SECONDS,
    });
    const origin = new URL(request.url).origin;
    const delivery = await sendTransactionalEmail(env, confirmationEmail(email, `${origin}/confirm-email?token=${token}`));
    if (!delivery.ok) {
      await env.LIFEOS_KV.delete(`email-confirm:${token}`);
      return json(503, { ok: false, code: delivery.error, error: 'Serviço de e-mail não configurado ou indisponível.' });
    }
    return json(200, { ok: true, message: 'Novo link de confirmação enviado.' });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
