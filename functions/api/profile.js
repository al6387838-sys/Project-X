// LifeOS Enterprise — Profile API v1.0
// Cloudflare Pages Function: GET/POST /api/profile
// Phase 131 — Real Data Foundation
// Perfil completo persistido no Cloudflare KV
import { getCookie, json, passwordDigest, safeEqual, verifySession } from '../_auth.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let profile = {
    email: session.sub,
    name: session.sub.split('@')[0],
    role: session.role,
    plan: 'free',
    avatar: null,
    bio: '',
    phone: '',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    onboarded: false,
    createdAt: null,
    updatedAt: null,
  };

  if (env.LIFEOS_KV && session.role !== 'admin') {
    try {
      const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
      if (raw) {
        const kv = JSON.parse(raw);
        const { passwordHash, ...safeKv } = kv;
        profile = { ...profile, ...safeKv };
      }
    } catch (_) { /* KV indisponível */ }
  }

  return json(200, { ok: true, profile });
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  if (!env.LIFEOS_KV) {
    return json(503, { ok: false, error: 'Armazenamento não disponível' });
  }

  const action = String(input.action || 'update');

  if (action === 'update') {
    const allowedFields = ['name', 'bio', 'phone', 'timezone', 'language', 'avatar'];
    const updates = {};

    for (const field of allowedFields) {
      if (input[field] !== undefined) {
        updates[field] = String(input[field]).trim();
      }
    }

    if (updates.name && (updates.name.length < 2 || updates.name.length > 100)) {
      return json(400, { ok: false, error: 'Nome deve ter entre 2 e 100 caracteres' });
    }

    try {
      const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
      if (!raw) return json(404, { ok: false, error: 'Usuário não encontrado' });

      const userData = JSON.parse(raw);
      const updated = { ...userData, ...updates, updatedAt: new Date().toISOString() };
      await env.LIFEOS_KV.put(`user:${session.sub}`, JSON.stringify(updated));

      const { passwordHash, ...safeUpdated } = updated;
      return json(200, { ok: true, message: 'Perfil atualizado', profile: safeUpdated });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao atualizar perfil' });
    }
  }

  if (action === 'change_email') {
    const newEmail = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');

    if (!newEmail || !EMAIL_REGEX.test(newEmail)) {
      return json(400, { ok: false, error: 'E-mail inválido' });
    }
    if (!password) return json(400, { ok: false, error: 'Senha obrigatória para alterar e-mail' });

    try {
      // Verificar se novo e-mail já existe
      const existing = await env.LIFEOS_KV.get(`user:${newEmail}`);
      if (existing) return json(409, { ok: false, error: 'Este e-mail já está em uso' });

      const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
      if (!raw) return json(404, { ok: false, error: 'Usuário não encontrado' });

      const userData = JSON.parse(raw);
      const passwordHash = await passwordDigest(password);
      if (!safeEqual(passwordHash, userData.passwordHash)) {
        return json(401, { ok: false, error: 'Senha incorreta' });
      }

      // Migrar dados para nova chave
      const updatedUser = { ...userData, email: newEmail, updatedAt: new Date().toISOString() };
      await env.LIFEOS_KV.put(`user:${newEmail}`, JSON.stringify(updatedUser));
      await env.LIFEOS_KV.delete(`user:${session.sub}`);

      return json(200, { ok: true, message: 'E-mail alterado. Faça login novamente com o novo e-mail.' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao alterar e-mail' });
    }
  }

  if (action === 'delete_account') {
    const password = String(input.password || '');
    const confirmation = String(input.confirmation || '');

    if (confirmation !== 'EXCLUIR MINHA CONTA') {
      return json(400, { ok: false, error: 'Confirmação inválida. Digite: EXCLUIR MINHA CONTA' });
    }

    try {
      const raw = await env.LIFEOS_KV.get(`user:${session.sub}`);
      if (!raw) return json(404, { ok: false, error: 'Usuário não encontrado' });

      const userData = JSON.parse(raw);
      const passwordHash = await passwordDigest(password);
      if (!safeEqual(passwordHash, userData.passwordHash)) {
        return json(401, { ok: false, error: 'Senha incorreta' });
      }

      // Remover todos os dados do usuário
      await env.LIFEOS_KV.delete(`user:${session.sub}`);
      await env.LIFEOS_KV.delete(`settings:${session.sub}`);
      await env.LIFEOS_KV.delete(`notifications:${session.sub}`);
      await env.LIFEOS_KV.delete(`workspaces:${session.sub}`);

      return json(200, { ok: true, message: 'Conta excluída com sucesso' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao excluir conta' });
    }
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
