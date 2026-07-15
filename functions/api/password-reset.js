// LifeOS Enterprise — Password Reset API v1.0
// Cloudflare Pages Function: POST /api/password-reset
// Phase 132 — Real Authentication
// Recuperação de senha com token persistido no KV
// Para envio de e-mail: configurar RESEND_API_KEY ou SENDGRID_API_KEY
import { json, passwordDigest } from '../_auth.js';

const TOKEN_TTL = 3600; // 1 hora
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendResetEmail(email, token, origin, env) {
  // Suporte a Resend API (preferido) ou Sendgrid
  const resetUrl = `${origin}/reset-password?token=${token}`;

  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || 'LifeOS <noreply@lifeos.app>',
          to: [email],
          subject: 'Redefinição de senha — LifeOS Enterprise',
          html: `
            <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:12px">
              <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Redefinir senha</h1>
              <p style="color:#999;margin-bottom:24px">Recebemos uma solicitação para redefinir a senha da sua conta LifeOS Enterprise.</p>
              <a href="${resetUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Redefinir minha senha</a>
              <p style="color:#666;font-size:12px;margin-top:24px">Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>
              <p style="color:#444;font-size:11px">LifeOS Enterprise · Segurança e Privacidade</p>
            </div>
          `,
        }),
      });
      return true;
    } catch (_) { return false; }
  }

  if (env.SENDGRID_API_KEY) {
    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: env.EMAIL_FROM || 'noreply@lifeos.app', name: 'LifeOS Enterprise' },
          subject: 'Redefinição de senha — LifeOS Enterprise',
          content: [{
            type: 'text/html',
            value: `<p>Clique no link para redefinir sua senha: <a href="${resetUrl}">${resetUrl}</a></p><p>Expira em 1 hora.</p>`,
          }],
        }),
      });
      return true;
    } catch (_) { return false; }
  }

  // Sem provedor de e-mail configurado — logar token para debug
  console.log(`[LifeOS] Password reset token for ${email}: ${token} | URL: ${resetUrl}`);
  return false;
}

export async function onRequestPost({ request, env }) {
  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const action = String(input.action || 'request');
  const url = new URL(request.url);

  if (action === 'request') {
    const email = String(input.email || '').trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      return json(400, { ok: false, error: 'E-mail inválido' });
    }

    // Sempre retornar sucesso por segurança (não revelar se e-mail existe)
    if (env.LIFEOS_KV) {
      try {
        const userRaw = await env.LIFEOS_KV.get(`user:${email}`);
        if (userRaw) {
          const token = generateToken();
          const resetData = {
            email,
            token,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + TOKEN_TTL * 1000).toISOString(),
            used: false,
          };
          await env.LIFEOS_KV.put(`reset:${token}`, JSON.stringify(resetData), { expirationTtl: TOKEN_TTL });
          await sendResetEmail(email, token, url.origin, env);
        }
      } catch (_) { /* ignorar */ }
    }

    return json(200, {
      ok: true,
      message: 'Se este e-mail estiver cadastrado, você receberá as instruções de recuperação em breve.',
    });
  }

  if (action === 'verify') {
    const token = String(input.token || '').trim();
    if (!token) return json(400, { ok: false, error: 'Token obrigatório' });

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`reset:${token}`);
      if (!raw) return json(400, { ok: false, error: 'Token inválido ou expirado' });

      const resetData = JSON.parse(raw);
      if (resetData.used) return json(400, { ok: false, error: 'Token já utilizado' });
      if (new Date(resetData.expiresAt) < new Date()) {
        return json(400, { ok: false, error: 'Token expirado' });
      }

      return json(200, { ok: true, email: resetData.email });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao verificar token' });
    }
  }

  if (action === 'reset') {
    const token = String(input.token || '').trim();
    const newPassword = String(input.password || '');

    if (!token) return json(400, { ok: false, error: 'Token obrigatório' });
    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      return json(400, { ok: false, error: 'Senha deve ter entre 8 e 128 caracteres' });
    }

    if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });

    try {
      const raw = await env.LIFEOS_KV.get(`reset:${token}`);
      if (!raw) return json(400, { ok: false, error: 'Token inválido ou expirado' });

      const resetData = JSON.parse(raw);
      if (resetData.used) return json(400, { ok: false, error: 'Token já utilizado' });
      if (new Date(resetData.expiresAt) < new Date()) {
        return json(400, { ok: false, error: 'Token expirado' });
      }

      const userRaw = await env.LIFEOS_KV.get(`user:${resetData.email}`);
      if (!userRaw) return json(404, { ok: false, error: 'Usuário não encontrado' });

      const userData = JSON.parse(userRaw);
      userData.passwordHash = await passwordDigest(newPassword);
      userData.updatedAt = new Date().toISOString();
      userData.passwordChangedAt = new Date().toISOString();
      await env.LIFEOS_KV.put(`user:${resetData.email}`, JSON.stringify(userData));

      // Marcar token como usado
      resetData.used = true;
      await env.LIFEOS_KV.put(`reset:${token}`, JSON.stringify(resetData), { expirationTtl: 60 });

      return json(200, { ok: true, message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao redefinir senha' });
    }
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
