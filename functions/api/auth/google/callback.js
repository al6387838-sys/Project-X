// LifeOS Enterprise — Google OAuth Callback v1.0
// Cloudflare Pages Function: GET /api/auth/google/callback
// Phase 132 — Real Authentication
import { createSession, json, sessionCookie } from '../../../_auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect(`${url.origin}/login?error=google_cancelled`, 302);
  }

  if (!code || !state) {
    return Response.redirect(`${url.origin}/login?error=google_invalid`, 302);
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = env.LIFEOS_SESSION_SECRET;

  if (!clientId || !clientSecret || !sessionSecret) {
    return Response.redirect(`${url.origin}/login?error=config_missing`, 302);
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`;

  try {
    // Trocar código por token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return Response.redirect(`${url.origin}/login?error=google_token_failed`, 302);
    }

    const tokenData = await tokenRes.json();

    // Obter informações do usuário
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return Response.redirect(`${url.origin}/login?error=google_userinfo_failed`, 302);
    }

    const googleUser = await userRes.json();
    const email = googleUser.email?.toLowerCase();
    const name = googleUser.name || email?.split('@')[0] || 'Usuário';

    if (!email) {
      return Response.redirect(`${url.origin}/login?error=google_no_email`, 302);
    }

    // Verificar/criar usuário no KV
    if (env.LIFEOS_KV) {
      const existing = await env.LIFEOS_KV.get(`user:${email}`);
      if (!existing) {
        // Criar novo usuário via Google
        const userData = {
          email,
          name,
          role: 'user',
          plan: 'free',
          onboarded: false,
          authProvider: 'google',
          googleId: googleUser.sub,
          avatar: googleUser.picture || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          timezone: 'America/Sao_Paulo',
        };
        await env.LIFEOS_KV.put(`user:${email}`, JSON.stringify(userData));
      } else {
        // Atualizar último login
        const userData = JSON.parse(existing);
        userData.lastLoginAt = new Date().toISOString();
        userData.authProvider = userData.authProvider || 'google';
        if (googleUser.picture && !userData.avatar) userData.avatar = googleUser.picture;
        await env.LIFEOS_KV.put(`user:${email}`, JSON.stringify(userData));
      }
    }

    // Criar sessão
    const token = await createSession(email, 'user', sessionSecret);
    const cookie = sessionCookie(token);

    // Verificar se precisa de onboarding
    let redirectPath = '/app';
    if (env.LIFEOS_KV) {
      try {
        const raw = await env.LIFEOS_KV.get(`user:${email}`);
        if (raw) {
          const userData = JSON.parse(raw);
          if (!userData.onboarded) redirectPath = '/app?onboarding=true';
        }
      } catch (_) { /* ignorar */ }
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectPath,
        'Set-Cookie': cookie,
      },
    });
  } catch (err) {
    return Response.redirect(`${url.origin}/login?error=google_error`, 302);
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET' });
}
