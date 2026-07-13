// LifeOS Enterprise — Onboarding API v7.0
// Cloudflare Pages Function: POST /api/onboarding
// Gerencia o fluxo de onboarding de novos usuários
import { getCookie, json, verifySession } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const step = String(input.step || '');
  const data = input.data || {};

  const validSteps = ['welcome', 'goals', 'habits', 'workspace', 'complete'];
  if (!validSteps.includes(step)) {
    return json(400, { ok: false, error: 'Etapa de onboarding inválida' });
  }

  if (env.LIFEOS_KV) {
    try {
      const onboardingKey = `onboarding:${session.sub}`;
      const existing = await env.LIFEOS_KV.get(onboardingKey);
      const onboardingData = existing ? JSON.parse(existing) : { steps: [], startedAt: new Date().toISOString() };

      if (!onboardingData.steps.includes(step)) {
        onboardingData.steps.push(step);
      }
      onboardingData[step] = { ...data, completedAt: new Date().toISOString() };

      if (step === 'complete') {
        onboardingData.completedAt = new Date().toISOString();
        // Marcar usuário como onboarded
        const userRaw = await env.LIFEOS_KV.get(`user:${session.sub}`);
        if (userRaw) {
          const userData = JSON.parse(userRaw);
          userData.onboarded = true;
          userData.onboardedAt = new Date().toISOString();
          await env.LIFEOS_KV.put(`user:${session.sub}`, JSON.stringify(userData));
        }
      }

      await env.LIFEOS_KV.put(onboardingKey, JSON.stringify(onboardingData));
    } catch (_) { /* KV error — continuar */ }
  }

  const nextStepMap = { welcome: 'goals', goals: 'habits', habits: 'workspace', workspace: 'complete', complete: null };
  return json(200, {
    ok: true,
    step,
    nextStep: nextStepMap[step],
    message: step === 'complete' ? 'Onboarding concluído! Bem-vindo ao LifeOS.' : `Etapa "${step}" concluída.`,
  });
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  if (env.LIFEOS_KV) {
    try {
      const raw = await env.LIFEOS_KV.get(`onboarding:${session.sub}`);
      if (raw) {
        const data = JSON.parse(raw);
        return json(200, { ok: true, onboarding: data });
      }
    } catch (_) { /* KV error */ }
  }

  return json(200, { ok: true, onboarding: { steps: [], startedAt: null } });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'GET') return onRequestGet({ request, env });
  return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
}
