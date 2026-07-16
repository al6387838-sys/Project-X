// LifeOS Enterprise — Transactional Email Service v16.5
// Provedores reais suportados: Resend e SendGrid.

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function emailDocument(title, intro, actionLabel, actionUrl, footer) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0a0e14;color:#f0f4ff;font-family:Inter,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;padding:40px 24px"><div style="background:#141b28;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:32px"><div style="font-size:14px;font-weight:800;color:#818cf8;margin-bottom:20px">LIFEOS ENTERPRISE</div><h1 style="font-size:24px;line-height:1.25;margin:0 0 12px">${escapeHtml(title)}</h1><p style="color:#a8b2c5;line-height:1.65;margin:0 0 26px">${escapeHtml(intro)}</p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#6366f1;color:#fff;padding:13px 22px;border-radius:10px;text-decoration:none;font-weight:700">${escapeHtml(actionLabel)}</a><p style="color:#687386;font-size:12px;line-height:1.6;margin:26px 0 0">${escapeHtml(footer)}</p></div></div></body></html>`;
}

async function sendWithResend(env, message) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    }),
  });
  if (!response.ok) throw new Error(`RESEND_${response.status}`);
}

async function sendWithSendGrid(env, message) {
  const from = String(env.EMAIL_FROM || '');
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  const fromPayload = match ? { name: match[1].trim(), email: match[2] } : { email: from };
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from: fromPayload,
      subject: message.subject,
      content: [{ type: 'text/html', value: message.html }],
    }),
  });
  if (!response.ok) throw new Error(`SENDGRID_${response.status}`);
}

export function emailServiceReady(env) {
  return Boolean(env?.EMAIL_FROM && (env.RESEND_API_KEY || env.SENDGRID_API_KEY));
}

export async function sendTransactionalEmail(env, message) {
  if (!emailServiceReady(env)) {
    return { ok: false, error: 'EMAIL_PROVIDER_NOT_CONFIGURED' };
  }
  try {
    if (env.RESEND_API_KEY) await sendWithResend(env, message);
    else await sendWithSendGrid(env, message);
    return { ok: true };
  } catch (error) {
    console.error('[LifeOS] Falha no provedor transacional:', error?.message || 'UNKNOWN');
    return { ok: false, error: 'EMAIL_DELIVERY_FAILED' };
  }
}

export function confirmationEmail(to, url) {
  return {
    to,
    subject: 'Confirme seu e-mail — LifeOS Enterprise',
    html: emailDocument(
      'Confirme seu e-mail',
      'Confirme este endereço para ativar sua conta e concluir o cadastro no LifeOS Enterprise.',
      'Confirmar meu e-mail',
      url,
      'O link expira em 24 horas. Se você não criou esta conta, ignore esta mensagem.'
    ),
  };
}

export function passwordResetEmail(to, url) {
  return {
    to,
    subject: 'Redefinição de senha — LifeOS Enterprise',
    html: emailDocument(
      'Redefinir sua senha',
      'Recebemos uma solicitação para definir uma nova senha para sua conta.',
      'Redefinir minha senha',
      url,
      'O link expira em 1 hora. Se você não fez esta solicitação, ignore esta mensagem.'
    ),
  };
}

export function emailChangeEmail(to, url) {
  return {
    to,
    subject: 'Confirme seu novo e-mail — LifeOS Enterprise',
    html: emailDocument(
      'Confirme o novo e-mail',
      'Confirme este endereço para concluir a alteração do e-mail da sua conta.',
      'Confirmar novo e-mail',
      url,
      'O link expira em 1 hora. Se você não solicitou a alteração, proteja sua conta trocando a senha.'
    ),
  };
}
