// LifeOS Enterprise — Password Reset API v16.5
import { randomToken, revokeAllSessions } from '../_account.js';
import { json, passwordDigest } from '../_auth.js';
import { emailServiceReady, passwordResetEmail, sendTransactionalEmail } from '../_email.js';

const TOKEN_TTL = 3600;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function validReset(resetData, user) {
  if (!resetData || resetData.used || Date.parse(resetData.expiresAt) <= Date.now()) return false;
  if (user?.passwordChangedAt && Date.parse(resetData.createdAt) <= Date.parse(user.passwordChangedAt)) return false;
  return true;
}

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço de recuperação indisponível' });
  let input;
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }
  const action = String(input.action || 'request');

  if (action === 'request') {
    const email = String(input.email || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) return json(400, { ok: false, error: 'E-mail inválido' });
    if (!emailServiceReady(env)) {
      return json(503, { ok: false, code: 'EMAIL_PROVIDER_NOT_CONFIGURED', error: 'Serviço de e-mail ainda não configurado.' });
    }

    const userRaw = await env.LIFEOS_KV.get(`user:${email}`);
    if (userRaw) {
      const user = JSON.parse(userRaw);
      if (user.emailVerified && user.status !== 'deleted') {
        const token = randomToken();
        const createdAt = new Date().toISOString();
        await env.LIFEOS_KV.put(`reset:${token}`, JSON.stringify({
          email,
          createdAt,
          expiresAt: new Date(Date.now() + TOKEN_TTL * 1000).toISOString(),
          used: false,
        }), { expirationTtl: TOKEN_TTL });
        const origin = new URL(request.url).origin;
        const delivery = await sendTransactionalEmail(env, passwordResetEmail(email, `${origin}/reset-password?token=${token}`));
        if (!delivery.ok) {
          await env.LIFEOS_KV.delete(`reset:${token}`);
          return json(503, { ok: false, code: delivery.error, error: 'Não foi possível entregar o e-mail de recuperação.' });
        }
      }
    }
    return json(200, { ok: true, message: 'Se este e-mail estiver cadastrado, você receberá as instruções de recuperação em breve.' });
  }

  const token = String(input.token || '').trim();
  if (!token) return json(400, { ok: false, error: 'Token obrigatório' });
  const resetRaw = await env.LIFEOS_KV.get(`reset:${token}`);
  if (!resetRaw) return json(400, { ok: false, error: 'Token inválido ou expirado' });
  const resetData = JSON.parse(resetRaw);
  const userRaw = await env.LIFEOS_KV.get(`user:${resetData.email}`);
  if (!userRaw) return json(400, { ok: false, error: 'Token inválido ou expirado' });
  const user = JSON.parse(userRaw);
  if (!validReset(resetData, user)) return json(400, { ok: false, error: 'Token inválido, expirado ou já utilizado' });

  if (action === 'verify') return json(200, { ok: true, email: resetData.email });

  if (action === 'reset') {
    const newPassword = String(input.password || input.newPassword || '');
    if (newPassword.length < 8 || newPassword.length > 128) {
      return json(400, { ok: false, error: 'Senha deve ter entre 8 e 128 caracteres' });
    }
    const newHash = await passwordDigest(newPassword);
    if (newHash === user.passwordHash) return json(400, { ok: false, error: 'A nova senha deve ser diferente da senha atual' });
    const now = new Date().toISOString();
    user.passwordHash = newHash;
    user.passwordChangedAt = now;
    user.updatedAt = now;
    await env.LIFEOS_KV.put(`user:${resetData.email}`, JSON.stringify(user));
    resetData.used = true;
    await env.LIFEOS_KV.put(`reset:${token}`, JSON.stringify(resetData), { expirationTtl: 60 });
    await revokeAllSessions(env.LIFEOS_KV, resetData.email);
    return json(200, { ok: true, message: 'Senha redefinida. Todas as sessões anteriores foram encerradas.' });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
