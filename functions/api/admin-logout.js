// LifeOS Enterprise — Admin Logout
// Cloudflare Pages Function: POST /api/admin-logout

import { expiredSessionCookie, json } from '../_auth.js';

export async function onRequestPost() {
  return json(200, { ok: true }, { 'set-cookie': expiredSessionCookie() });
}

export async function onRequest({ request }) {
  if (request.method === 'POST') return onRequestPost();
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
}
