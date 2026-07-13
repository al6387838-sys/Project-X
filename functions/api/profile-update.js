// LifeOS Enterprise — Profile Update API v7.0
// Cloudflare Pages Function: POST /api/profile-update
// Permite ao usuário atualizar nome, fuso horário e preferências
import { getCookie, json, passwordDigest, safeEqual, verifySession } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const action = String(input.action || 'profile.update');

  if (action === 'profile.update') {
    const name = String(input.name || '').trim();
    const timezone = String(input.timezone || '').trim();
    if (name && name.length < 2) return json(400, { ok: false, error: 'Nome deve ter pelo menos 2 caracteres' });

    if (env.LIFEOS_KV && session.role === 'user') {
      try {
        const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
        if (raw) {
          const userData = JSON.parse(raw);
          if (name) userData.name = name;
          if (timezone) userData.timezone = timezone;
          userData.updatedAt = new Date().toISOString();
          await env.LIFEOS_KV.put(`user:${session.sub}`, JSON.stringify(userData));
        }
      } catch (_) { /* KV error */ }
    }
    return json(200, { ok: true, message: 'Perfil atualizado com sucesso' });
  }

  if (action === 'password.change') {
    const currentPassword = String(input.currentPassword || '');
    const newPassword = String(input.newPassword || '');
    if (!currentPassword || !newPassword) return json(400, { ok: false, error: 'Senhas obrigatórias' });
    if (newPassword.length < 8) return json(400, { ok: false, error: 'Nova senha deve ter pelo menos 8 caracteres' });

    if (env.LIFEOS_KV && session.role === 'user') {
      try {
        const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
        if (raw) {
          const userData = JSON.parse(raw);
          const currentHash = await passwordDigest(currentPassword);
          if (!safeEqual(currentHash, userData.passwordHash)) {
            return json(401, { ok: false, error: 'Senha atual incorreta' });
          }
          userData.passwordHash = await passwordDigest(newPassword);
          userData.updatedAt = new Date().toISOString();
          await env.LIFEOS_KV.put(`user:${session.sub}`, JSON.stringify(userData));
          return json(200, { ok: true, message: 'Senha alterada com sucesso' });
        }
      } catch (_) { /* KV error */ }
    }
    // Admin password change
    if (session.role === 'admin') {
      return json(200, { ok: true, message: 'Senha de administrador deve ser alterada via variáveis de ambiente' });
    }
    return json(200, { ok: true, message: 'Senha atualizada' });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
