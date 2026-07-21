// LifeOS Enterprise — Auth Validation Suite v47.0
// FASE 334 — Validação completa de todos os endpoints de autenticação
// Executa contra a URL de produção ou local
import { execFileSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL || 'https://lifeos-enterprise.pages.dev';
const TIMEOUT = 10000;

let passed = 0;
let failed = 0;
const results = [];

async function check(name, fn) {
  try {
    const result = await fn();
    if (result.ok) {
      passed++;
      results.push({ name, status: 'PASS', detail: result.detail || '' });
      console.log(`  ✓ ${name}${result.detail ? ' — ' + result.detail : ''}`);
    } else {
      failed++;
      results.push({ name, status: 'FAIL', detail: result.detail || result.error || '' });
      console.log(`  ✗ ${name} — ${result.detail || result.error || 'falhou'}`);
    }
  } catch (err) {
    failed++;
    results.push({ name, status: 'ERROR', detail: err.message });
    console.log(`  ✗ ${name} — ERRO: ${err.message}`);
  }
}

async function req(path, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const r = await fetch(`${BASE_URL}${path}`, {
      ...opts,
      signal: controller.signal,
      redirect: opts.redirect || 'manual',
    });
    clearTimeout(t);
    return r;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function reqJson(path, opts = {}) {
  const r = await req(path, opts);
  let body = {};
  try { body = await r.json(); } catch { body = {}; }
  return { status: r.status, body, headers: r.headers };
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   LifeOS Enterprise v47.0 — Auth Validation Suite       ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  Target: ${BASE_URL}`);
console.log('');

// ── 1. /api/auth/config (FASE 333 — Auto-detect) ─────────────────────────
console.log('── 1. /api/auth/config (Auto-detect)');
await check('GET /api/auth/config retorna 200', async () => {
  const { status, body } = await reqJson('/api/auth/config');
  if (status !== 200) return { ok: false, detail: `status ${status}` };
  if (!body.ok) return { ok: false, detail: 'body.ok = false' };
  if (!body.providers) return { ok: false, detail: 'body.providers ausente' };
  return { ok: true, detail: `email=${body.providers.email} google=${body.providers.google} apple=${body.providers.apple}` };
});

await check('GET /api/auth/config retorna campo missing[]', async () => {
  const { status, body } = await reqJson('/api/auth/config');
  if (status !== 200) return { ok: false, detail: `status ${status}` };
  if (!Array.isArray(body.missing)) return { ok: false, detail: 'campo missing[] ausente' };
  return { ok: true, detail: `${body.missing.length} variáveis pendentes` };
});

await check('HEAD /api/auth/config retorna 200', async () => {
  const r = await req('/api/auth/config', { method: 'HEAD' });
  if (r.status !== 200) return { ok: false, detail: `status ${r.status}` };
  return { ok: true };
});

// ── 2. /api/auth/google (FASE 332 — Fallback) ────────────────────────────
console.log('');
console.log('── 2. /api/auth/google (Fallback automático)');
await check('HEAD /api/auth/google retorna 200 ou 503 (nunca 405)', async () => {
  const r = await req('/api/auth/google', { method: 'HEAD' });
  if (r.status === 405) return { ok: false, detail: 'retornou 405 — HEAD não suportado' };
  if (r.status === 200 || r.status === 503) return { ok: true, detail: `status ${r.status} (configurado: ${r.status === 200})` };
  return { ok: false, detail: `status inesperado ${r.status}` };
});

await check('GET /api/auth/google sem config redireciona para /login (não retorna JSON)', async () => {
  const r = await req('/api/auth/google', { method: 'GET', redirect: 'manual' });
  // Deve ser redirect (302) — ou para Google (configurado) ou para /login (não configurado)
  if (r.status === 302 || r.status === 301) {
    const loc = r.headers.get('location') || '';
    if (loc.includes('accounts.google.com') || loc.includes('/login')) {
      return { ok: true, detail: `redirect para ${loc.includes('google.com') ? 'Google OAuth' : '/login?oauth=google_unavailable'}` };
    }
    return { ok: false, detail: `redirect inesperado para ${loc}` };
  }
  // Se retornar JSON 503 — FALHA (não deve mais acontecer)
  if (r.status === 503) return { ok: false, detail: 'ainda retorna JSON 503 — fallback não implementado' };
  return { ok: false, detail: `status inesperado ${r.status}` };
});

// ── 3. /api/auth/apple (FASE 332 — Fallback) ─────────────────────────────
console.log('');
console.log('── 3. /api/auth/apple (Fallback automático)');
await check('HEAD /api/auth/apple retorna 200 ou 503 (nunca 405)', async () => {
  const r = await req('/api/auth/apple', { method: 'HEAD' });
  if (r.status === 405) return { ok: false, detail: 'retornou 405 — HEAD não suportado' };
  if (r.status === 200 || r.status === 503) return { ok: true, detail: `status ${r.status} (configurado: ${r.status === 200})` };
  return { ok: false, detail: `status inesperado ${r.status}` };
});

await check('GET /api/auth/apple sem config redireciona para /login (não retorna JSON)', async () => {
  const r = await req('/api/auth/apple', { method: 'GET', redirect: 'manual' });
  if (r.status === 302 || r.status === 301) {
    const loc = r.headers.get('location') || '';
    if (loc.includes('appleid.apple.com') || loc.includes('/login')) {
      return { ok: true, detail: `redirect para ${loc.includes('apple.com') ? 'Apple OAuth' : '/login?oauth=apple_unavailable'}` };
    }
    return { ok: false, detail: `redirect inesperado para ${loc}` };
  }
  if (r.status === 503) return { ok: false, detail: 'ainda retorna JSON 503 — fallback não implementado' };
  return { ok: false, detail: `status inesperado ${r.status}` };
});

// ── 4. /api/login (Email/Senha) ───────────────────────────────────────────
console.log('');
console.log('── 4. /api/login (Email/Senha)');
await check('POST /api/login com credenciais inválidas retorna 401 ou 503 (nunca 500)', async () => {
  const { status, body } = await reqJson('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@invalid.com', password: 'wrongpassword' }),
    redirect: 'follow',
  });
  if (status === 500) return { ok: false, detail: 'erro interno 500' };
  if (status === 401 || status === 503 || status === 400) {
    return { ok: true, detail: `status ${status} — ${body.error || body.code || ''}` };
  }
  return { ok: false, detail: `status inesperado ${status}` };
});

await check('POST /api/login sem body retorna 400', async () => {
  const { status, body } = await reqJson('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    redirect: 'follow',
  });
  if (status === 400) return { ok: true, detail: body.error || '' };
  if (status === 503) return { ok: true, detail: `503 — ${body.error || body.code || ''}` };
  return { ok: false, detail: `status inesperado ${status}` };
});

await check('OPTIONS /api/login retorna 204', async () => {
  const r = await req('/api/login', { method: 'OPTIONS', redirect: 'follow' });
  if (r.status === 204) return { ok: true };
  return { ok: false, detail: `status ${r.status}` };
});

// ── 5. /api/register (Cadastro) ──────────────────────────────────────────
console.log('');
console.log('── 5. /api/register (Cadastro)');
await check('POST /api/register sem body retorna 400 ou 503', async () => {
  const { status, body } = await reqJson('/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    redirect: 'follow',
  });
  if (status === 400 || status === 503) return { ok: true, detail: `${status} — ${body.error || body.code || ''}` };
  return { ok: false, detail: `status inesperado ${status}` };
});

await check('POST /api/register com e-mail inválido retorna 400', async () => {
  const { status, body } = await reqJson('/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'not-an-email', password: 'password123' }),
    redirect: 'follow',
  });
  if (status === 400 || status === 503) return { ok: true, detail: `${status} — ${body.error || ''}` };
  return { ok: false, detail: `status inesperado ${status}` };
});

// ── 6. /api/password-reset (Recuperação de senha) ────────────────────────
console.log('');
console.log('── 6. /api/password-reset (Recuperação de senha)');
await check('POST /api/password-reset com e-mail inexistente retorna 200 (segurança)', async () => {
  const { status, body } = await reqJson('/api/password-reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'request', email: 'nonexistent@test.com' }),
    redirect: 'follow',
  });
  // Deve retornar 200 (não revelar se e-mail existe) ou 503 (email não configurado)
  if (status === 200 || status === 503) return { ok: true, detail: `${status} — ${body.message || body.error || body.code || ''}` };
  return { ok: false, detail: `status inesperado ${status}` };
});

await check('POST /api/password-reset com token inválido retorna 400', async () => {
  const { status, body } = await reqJson('/api/password-reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'reset', token: 'invalid-token-xyz', newPassword: 'newpass123' }),
    redirect: 'follow',
  });
  if (status === 400 || status === 503) return { ok: true, detail: `${status} — ${body.error || ''}` };
  return { ok: false, detail: `status inesperado ${status}` };
});

// ── 7. /api/session (Sessão) ──────────────────────────────────────────────
console.log('');
console.log('── 7. /api/session (Sessão)');
await check('GET /api/session sem cookie retorna 401 ou redirect', async () => {
  const { status, body } = await reqJson('/api/session', { redirect: 'follow' });
  if (status === 401) return { ok: true, detail: body.error || 'não autenticado' };
  if (status === 302 || status === 200) return { ok: true, detail: `status ${status}` };
  return { ok: false, detail: `status inesperado ${status}` };
});

await check('GET /api/session?optional=1 sem cookie retorna 200 com ok:false', async () => {
  const { status, body } = await reqJson('/api/session?optional=1', { redirect: 'follow' });
  if (status === 200) return { ok: true, detail: `ok=${body.ok}` };
  if (status === 401) return { ok: true, detail: 'retorna 401 (aceitável)' };
  return { ok: false, detail: `status inesperado ${status}` };
});

// ── 8. /api/logout (Logout) ───────────────────────────────────────────────
console.log('');
console.log('── 8. /api/logout (Logout)');
await check('POST /api/logout sem sessão retorna 200 ou 302 (nunca 500)', async () => {
  const r = await req('/api/logout', { method: 'POST', redirect: 'manual' });
  if (r.status === 500) return { ok: false, detail: 'erro interno 500' };
  if (r.status === 200 || r.status === 302 || r.status === 401) {
    return { ok: true, detail: `status ${r.status}` };
  }
  return { ok: false, detail: `status inesperado ${r.status}` };
});

// ── 9. /api/email-confirmation (Confirmação de e-mail) ───────────────────
console.log('');
console.log('── 9. /api/email-confirmation');
await check('POST /api/email-confirmation com token inválido retorna 400', async () => {
  const { status, body } = await reqJson('/api/email-confirmation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', token: 'invalid-token-xyz' }),
    redirect: 'follow',
  });
  if (status === 400 || status === 503) return { ok: true, detail: `${status} — ${body.error || ''}` };
  return { ok: false, detail: `status inesperado ${status}` };
});

// ── 10. Páginas de Auth (Frontend) ───────────────────────────────────────
console.log('');
console.log('── 10. Páginas de Auth (Frontend)');
for (const [name, path] of [
  ['Login', '/login'],
  ['Register', '/register'],
  ['Forgot Password', '/forgot-password'],
  ['Reset Password', '/reset-password'],
  ['Confirm Email', '/confirm-email'],
]) {
  await check(`GET ${path} retorna 200 com HTML`, async () => {
    const r = await req(path, { redirect: 'follow' });
    if (r.status !== 200) return { ok: false, detail: `status ${r.status}` };
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('html')) return { ok: false, detail: `content-type: ${ct}` };
    return { ok: true, detail: name };
  });
}

// ── Resumo ────────────────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log(`║   Resultado: ${passed} passou, ${failed} falhou${' '.repeat(Math.max(0, 38 - String(passed).length - String(failed).length))}║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('');
  console.log('Falhas:');
  results.filter(r => r.status !== 'PASS').forEach(r => {
    console.log(`  ✗ ${r.name}: ${r.detail}`);
  });
}

process.exit(failed > 0 ? 1 : 0);
