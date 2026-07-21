// LifeOS Enterprise — Profile Update API v16.5
import { revokeAllSessions } from '../_account.js';
import { getCookie, json, passwordDigest, safeEqual, verifySession } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.LIFEOS_SESSION_SECRET || !env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), env.LIFEOS_SESSION_SECRET, env.LIFEOS_KV);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  if (session.role === 'admin') return json(403, { ok: false, error: 'Use a configuração administrativa para esta conta' });

  let input;
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }
  const action = String(input.action || 'profile.update');
  const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
  if (!raw) return json(404, { ok: false, error: 'Usuário não encontrado' });
  const user = JSON.parse(raw);

  if (action === 'profile.update') {
    const name = String(input.name ?? user.name ?? '').trim();
    const timezone = String(input.timezone ?? user.timezone ?? 'America/Sao_Paulo').trim();
    const bio = String(input.bio ?? user.bio ?? '').trim();
    const phone = String(input.phone ?? user.phone ?? '').trim();
    if (name && (name.length < 2 || name.length > 100)) return json(400, { ok: false, error: 'Nome deve ter entre 2 e 100 caracteres' });
    if (timezone && timezone.length > 100) return json(400, { ok: false, error: 'Fuso horário inválido' });
    if (bio.length > 500) return json(400, { ok: false, error: 'Bio deve ter no máximo 500 caracteres' });
    if (phone.length > 30) return json(400, { ok: false, error: 'Telefone inválido' });
    if (name) user.name = name;
    if (timezone) user.timezone = timezone;
    user.bio = bio;
    user.phone = phone;
    user.updatedAt = new Date().toISOString();
    await env.LIFEOS_KV.put(`user:${session.sub}`, JSON.stringify(user));
    const { passwordHash, ...profile } = user;
    return json(200, { ok: true, message: 'Perfil atualizado com sucesso', profile });
  }

  if (action === 'password.change') {
    const currentPassword = String(input.currentPassword || '');
    const newPassword = String(input.newPassword || '');
    if (!currentPassword || !newPassword) return json(400, { ok: false, error: 'Senhas obrigatórias' });
    if (newPassword.length < 8 || newPassword.length > 128) return json(400, { ok: false, error: 'Nova senha deve ter entre 8 e 128 caracteres' });
    const currentHash = await passwordDigest(currentPassword);
    if (!safeEqual(currentHash, user.passwordHash)) return json(401, { ok: false, error: 'Senha atual incorreta' });
    const newHash = await passwordDigest(newPassword);
    if (safeEqual(newHash, user.passwordHash)) return json(400, { ok: false, error: 'A nova senha deve ser diferente da senha atual' });

    const now = new Date().toISOString();
    user.passwordHash = newHash;
    user.passwordChangedAt = now;
    user.updatedAt = now;
    await env.LIFEOS_KV.put(`user:${session.sub}`, JSON.stringify(user));
    await revokeAllSessions(env.LIFEOS_KV, session.sub, session.jti);
    return json(200, { ok: true, message: 'Senha alterada. As outras sessões foram encerradas.' });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
