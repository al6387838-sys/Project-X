import type { Handler } from '@netlify/functions';
import { expiredSessionCookie, json } from './_auth.js';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'POST' });
  return json(200, { ok: true }, { 'set-cookie': expiredSessionCookie() });
};
