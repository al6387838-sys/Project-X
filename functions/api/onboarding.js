// LifeOS Enterprise — Onboarding API v11.1
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

  const validSteps = [
    'welcome',
    'profile',
    'organization',
    'workspace',
    'plan',
    'goals',
    'habits',
    'integrations',
    'notifications',
    'tour',
    'checklist',
    'complete',
  ];
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
          const cleanText = (value, max = 160) => String(value || '').trim().slice(0, max);
          const cleanList = (value, max = 12) => Array.isArray(value)
            ? value.map(item => cleanText(item, 80)).filter(Boolean).slice(0, max)
            : [];
          const profile = data.profile && typeof data.profile === 'object' ? data.profile : {};
          const notifications = data.notifications && typeof data.notifications === 'object' ? data.notifications : {};
          userData.name = cleanText(profile.name, 100) || userData.name;
          userData.timezone = cleanText(profile.timezone, 80) || userData.timezone;
          userData.professionalRole = cleanText(profile.role, 100);
          userData.company = cleanText(profile.company, 120);
          userData.onboardingGoals = cleanList(data.goals, 8);
          userData.customGoal = cleanText(data.customGoal, 240);
          userData.preparedIntegrations = cleanList(data.integrations, 12);
          userData.notificationPreferences = {
            dailyBriefing: notifications.dailyBriefing !== false,
            smartAlerts: notifications.smartAlerts !== false,
            weeklyDigest: notifications.weeklyDigest !== false,
          };
          userData.onboarded = true;
          userData.onboardedAt = new Date().toISOString();
          userData.updatedAt = new Date().toISOString();
          await env.LIFEOS_KV.put(`user:${session.sub}`, JSON.stringify(userData));
        }
      }

      await env.LIFEOS_KV.put(onboardingKey, JSON.stringify(onboardingData));
    } catch (_) { /* KV error — continuar */ }
  }

  const nextStepMap = {
    welcome: 'profile',
    profile: 'organization',
    organization: 'workspace',
    workspace: 'plan',
    plan: 'complete',
    goals: 'integrations',
    integrations: 'notifications',
    notifications: 'complete',
    habits: 'workspace',
    tour: 'checklist',
    checklist: null,
    complete: null,
  };
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
