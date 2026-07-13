// LifeOS Enterprise — Forgot Password v6.0
// Cloudflare Pages Function: POST /api/forgot-password
import { json } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  let input = {};
  try {
    input = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Requisição inválida' });
  }

  const email = String(input.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return json(400, { ok: false, error: 'E-mail inválido' });
  }

  // Sempre retornar sucesso por segurança (não revelar se e-mail existe)
  // Em produção: enviar e-mail de recuperação via SendGrid/Mailgun
  return json(200, {
    ok: true,
    message: 'Se este e-mail estiver cadastrado, você receberá as instruções de recuperação em breve.',
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
