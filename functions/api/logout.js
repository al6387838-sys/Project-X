// LifeOS Enterprise — Logout v6.0
// Cloudflare Pages Function: POST /api/logout
import { expiredSessionCookie, json } from '../_auth.js';

export async function onRequestPost() {
  return json(200, { ok: true }, { 'set-cookie': expiredSessionCookie() });
}

export async function onRequest({ request }) {
  if (request.method === 'POST') return onRequestPost();
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
