// LifeOS Enterprise — Enterprise Onboarding API v1.0
// Cloudflare Pages Function: GET/POST /api/enterprise/onboarding
// Phase 232 — Enterprise Onboarding
import { getCookie, json, verifySession } from '../../_auth.js';

const ONBOARDING_STEPS = [
  { id: 'account', title: 'Criar Conta', description: 'Registre-se com seu e-mail' },
  { id: 'email-confirm', title: 'Confirmar E-mail', description: 'Verifique seu endereço de e-mail' },
  { id: 'organization', title: 'Criar Organização', description: 'Configure sua empresa ou workspace' },
  { id: 'workspace', title: 'Criar Workspace', description: 'Crie seu primeiro espaço de trabalho' },
  { id: 'profile', title: 'Configurar Perfil', description: 'Complete seu perfil pessoal' },
  { id: 'integrations', title: 'Conectar Integrações', description: 'Configure serviços desejados' },
  { id: 'first-document', title: 'Primeiro Documento', description: 'Faça upload do seu primeiro arquivo' },
  { id: 'complete', title: 'Concluído', description: 'Bem-vindo ao LifeOS Enterprise!' },
];

function genId() { return crypto.randomUUID().replace(/-/g,'').slice(0,16); }

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'status';

  if (view === 'status') {
    const onboardingRaw = await kv.get(`onboarding:${session.sub}`);
    const onboarding = onboardingRaw ? JSON.parse(onboardingRaw) : {
      userId: session.sub,
      started: false,
      completed: false,
      currentStep: 'account',
      completedSteps: [],
      progress: 0,
      startedAt: null,
      completedAt: null,
    };

    if (!onboarding.started) {
      onboarding.started = true;
      onboarding.startedAt = new Date().toISOString();
      await kv.put(`onboarding:${session.sub}`, JSON.stringify(onboarding));
    }

    return json(200, {
      ok: true,
      onboarding,
      steps: ONBOARDING_STEPS,
      progress: Math.round((onboarding.completedSteps.length / ONBOARDING_STEPS.length) * 100),
    });
  }

  if (view === 'steps') {
    return json(200, { ok: true, steps: ONBOARDING_STEPS });
  }

  return json(400, { ok: false, error: 'view inválida' });
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });
  const session = await verifySession(getCookie(request.headers.get('cookie')), secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });
  
  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { action } = body;

  if (action === 'complete-step') {
    const { stepId } = body;
    if (!stepId) return json(400, { ok: false, error: 'stepId obrigatório' });
    
    const step = ONBOARDING_STEPS.find(s => s.id === stepId);
    if (!step) return json(404, { ok: false, error: 'Step não encontrado' });

    const onboardingRaw = await kv.get(`onboarding:${session.sub}`);
    const onboarding = onboardingRaw ? JSON.parse(onboardingRaw) : {
      userId: session.sub,
      started: true,
      completed: false,
      currentStep: 'account',
      completedSteps: [],
      progress: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    if (!onboarding.completedSteps.includes(stepId)) {
      onboarding.completedSteps.push(stepId);
    }

    // Encontrar próximo step não completado
    const nextStep = ONBOARDING_STEPS.find(s => !onboarding.completedSteps.includes(s.id));
    onboarding.currentStep = nextStep?.id || 'complete';

    // Verificar se completou
    if (onboarding.completedSteps.length === ONBOARDING_STEPS.length) {
      onboarding.completed = true;
      onboarding.completedAt = new Date().toISOString();
    }

    onboarding.progress = Math.round((onboarding.completedSteps.length / ONBOARDING_STEPS.length) * 100);
    await kv.put(`onboarding:${session.sub}`, JSON.stringify(onboarding));

    return json(200, {
      ok: true,
      onboarding,
      progress: onboarding.progress,
      nextStep: onboarding.currentStep,
    });
  }

  if (action === 'skip-step') {
    const { stepId } = body;
    if (!stepId) return json(400, { ok: false, error: 'stepId obrigatório' });
    
    const onboardingRaw = await kv.get(`onboarding:${session.sub}`);
    const onboarding = onboardingRaw ? JSON.parse(onboardingRaw) : {
      userId: session.sub,
      started: true,
      completed: false,
      currentStep: 'account',
      completedSteps: [],
      progress: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    // Marcar como pulado (não completo, mas avançar)
    const nextStep = ONBOARDING_STEPS.find(s => s.id === stepId);
    if (nextStep) {
      const idx = ONBOARDING_STEPS.indexOf(nextStep);
      if (idx < ONBOARDING_STEPS.length - 1) {
        onboarding.currentStep = ONBOARDING_STEPS[idx + 1].id;
      }
    }

    await kv.put(`onboarding:${session.sub}`, JSON.stringify(onboarding));

    return json(200, {
      ok: true,
      onboarding,
      nextStep: onboarding.currentStep,
    });
  }

  if (action === 'reset') {
    await kv.delete(`onboarding:${session.sub}`);
    return json(200, { ok: true, message: 'Onboarding resetado' });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' });
  }
}
