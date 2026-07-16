// LifeOS Enterprise — Profile & Account Lifecycle API v16.5
import {
  deleteAccountTokens,
  deleteUserKeys,
  EMAIL_CHANGE_TTL_SECONDS,
  randomToken,
  revokeAllSessions,
} from '../_account.js';
import {
  expiredSessionCookie,
  getCookie,
  json,
  passwordDigest,
  safeEqual,
  verifySession,
} from '../_auth.js';
import { emailChangeEmail, sendTransactionalEmail } from '../_email.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

async function authenticate(request, env) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) return null;
  return verifySession(getCookie(request.headers.get('cookie')), env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV);
}

export async function onRequestGet({ request, env }) {
  const session = await authenticate(request, env);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (session.role === 'admin') {
    const profile = { email: session.sub, name: 'Administrador', role: 'admin', status: 'active', emailVerified: true };
    return json(200, { ok: true, profile, user: profile });
  }
  const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
  if (!raw) return json(404, { ok: false, error: 'Usuário não encontrado' });
  const user = JSON.parse(raw);
  const { passwordHash, ...profile } = user;
  return json(200, { ok: true, profile, user: profile });
}

export async function onRequestPost({ request, env }) {
  const session = await authenticate(request, env);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (session.role === 'admin') return json(403, { ok: false, error: 'Operação indisponível para a conta administrativa' });

  let input;
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }
  const action = String(input.action || '');
  const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
  if (!raw) return json(404, { ok: false, error: 'Usuário não encontrado' });
  const user = JSON.parse(raw);

  if (action === 'email.change' || action === 'change_email') {
    const newEmail = String(input.newEmail || input.email || '').trim().toLowerCase();
    const currentPassword = String(input.currentPassword || input.password || '');
    if (!EMAIL_REGEX.test(newEmail) || newEmail.length > 254) return json(400, { ok: false, error: 'Novo e-mail inválido' });
    if (newEmail === session.sub) return json(400, { ok: false, error: 'O novo e-mail deve ser diferente do atual' });
    if (await env.LIFEOS_KV.get(`user:${newEmail}`)) return json(409, { ok: false, error: 'Este e-mail já está em uso' });
    const currentHash = await passwordDigest(currentPassword);
    if (!safeEqual(currentHash, user.passwordHash)) return json(401, { ok: false, error: 'Senha atual incorreta' });

    await deleteAccountTokens(env.LIFEOS_KV, session.sub, ['email-change:']);
    const token = randomToken();
    await env.LIFEOS_KV.put(`email-change:${token}`, JSON.stringify({
      oldEmail: session.sub,
      newEmail,
      createdAt: new Date().toISOString(),
    }), { expirationTtl: EMAIL_CHANGE_TTL_SECONDS });
    const origin = new URL(request.url).origin;
    const delivery = await sendTransactionalEmail(env, emailChangeEmail(newEmail, `${origin}/confirm-email?token=${token}`));
    if (!delivery.ok) {
      await env.LIFEOS_KV.delete(`email-change:${token}`);
      return json(503, { ok: false, code: delivery.error, error: 'Serviço de e-mail não configurado ou indisponível.' });
    }
    return json(200, { ok: true, pendingEmail: newEmail, message: 'Enviamos um link de confirmação ao novo endereço.' });
  }

  if (action === 'account.delete' || action === 'delete_account') {
    const password = String(input.password || input.currentPassword || '');
    const confirmation = String(input.confirmation || input.confirmText || '').trim().toUpperCase();
    if (confirmation && confirmation !== 'EXCLUIR' && confirmation !== 'EXCLUIR MINHA CONTA') {
      return json(400, { ok: false, error: 'Confirmação de exclusão inválida' });
    }
    const suppliedHash = await passwordDigest(password);
    if (!safeEqual(suppliedHash, user.passwordHash)) return json(401, { ok: false, error: 'Senha incorreta' });

    await revokeAllSessions(env.LIFEOS_KV, session.sub);
    await deleteUserKeys(env.LIFEOS_KV, session.sub);
    return json(200, { ok: true, message: 'Conta e dados associados excluídos permanentemente', redirect: '/login?account_deleted=1' }, {
      'set-cookie': expiredSessionCookie(),
    });
  }

  if (action === 'update') {
    const allowedFields = ['name', 'bio', 'phone', 'timezone', 'language', 'avatar'];
    for (const field of allowedFields) {
      if (input[field] !== undefined) user[field] = String(input[field]).trim();
    }
    if (user.name && (user.name.length < 2 || user.name.length > 100)) {
      return json(400, { ok: false, error: 'Nome deve ter entre 2 e 100 caracteres' });
    }
    user.updatedAt = new Date().toISOString();
    await env.LIFEOS_KV.put(`user:${session.sub}`, JSON.stringify(user));
    const { passwordHash, ...profile } = user;
    return json(200, { ok: true, message: 'Perfil atualizado', profile, user: profile });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
