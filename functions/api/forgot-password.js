// LifeOS Enterprise — Forgot Password compatibility route v16.5
import { json } from '../_auth.js';
import { onRequestPost as passwordResetRequest } from './password-reset.js';

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Requisição inválida' });
  }

  const forwardedRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ action: 'request', email: input.email }),
  });
  return passwordResetRequest({ request: forwardedRequest, env });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
